import midtransClient from 'midtrans-client';

function getMidtransConfig() {
  const serverKey = (process.env.MIDTRANS_SERVER_KEY || '').trim();
  const clientKey = (process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || '').trim();
  const isProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true';

  const isValid =
    Boolean(serverKey) &&
    !serverKey.includes('demo') &&
    !serverKey.includes('YOUR_SERVER_KEY');

  return { serverKey, clientKey, isProduction, isValid };
}

export const isMidtransRealConfig = () => getMidtransConfig().isValid;

export const MidtransService = {
  /**
   * Create official Midtrans Snap transaction (snap_token & redirect_url for all payment methods)
   * AND retrieve 100% pure, unmodified Midtrans QRIS (qr_url & qr_string).
   * Strictly NO fake/dummy QR fallback and NO modification of EMVCo qr_string.
   */
  async createQrisTransaction({ orderId, orderCode, grossAmount, customerName, customerPhone, items }) {
    const { serverKey, clientKey, isProduction, isValid } = getMidtransConfig();

    if (!isValid) {
      throw new Error(
        'Konfigurasi MIDTRANS_SERVER_KEY belum diatur dengan benar di .env.local.'
      );
    }

    const coreApi = new midtransClient.CoreApi({
      isProduction,
      serverKey,
      clientKey
    });

    const snap = new midtransClient.Snap({
      isProduction,
      serverKey,
      clientKey
    });

    const timestamp = Date.now();
    const midtransOrderId = `${orderCode}-${timestamp}`;
    const amount = Math.max(1, Math.round(Number(grossAmount) || 10000));

    const itemDetails = (items && items.length > 0) ? items : [
      {
        id: orderCode || 'PRINT-ITEM',
        price: amount,
        quantity: 1,
        name: `Print Cetak ${orderCode || ''}`.trim()
      }
    ];

    const customerDetails = {
      first_name: customerName || 'Mahasiswa',
      phone: customerPhone || '081234567890'
    };

    const apiBaseUrl = isProduction
      ? 'https://api.midtrans.com'
      : 'https://api.sandbox.midtrans.com';
    const snapBaseUrl = isProduction
      ? 'https://app.midtrans.com'
      : 'https://app.sandbox.midtrans.com';

    // 1. Always create an untouched Midtrans Snap Transaction (`snap_token` & `redirect_url`)
    //    so `window.snap.pay(snap_token)` opens the full payment selection popup
    //    (Virtual Account BCA/BRI/Mandiri/BNI, GoPay, ShopeePay, QRIS, dll).
    const snapTransaction = await snap.createTransaction({
      transaction_details: {
        order_id: midtransOrderId,
        gross_amount: amount
      },
      item_details: itemDetails,
      customer_details: customerDetails
    });

    const snapToken = snapTransaction.token;
    const redirectUrl = snapTransaction.redirect_url;

    // 2. Obtain 100% pure, unmodified qr_url & qr_string from Midtrans API for direct on-page display
    let qrUrl = null;
    let qrString = null;
    let qrisTransactionId = null;
    let qrisMidtransOrderId = `${orderCode}-QR-${timestamp}`;
    let qrisRawResponse = null;

    // 2a. Try Core API (/v2/charge) first
    try {
      const chargeResponse = await coreApi.charge({
        payment_type: 'qris',
        transaction_details: {
          order_id: qrisMidtransOrderId,
          gross_amount: amount
        },
        item_details: itemDetails,
        customer_details: customerDetails,
        qris: {
          acquirer: 'gopay'
        }
      });

      if (String(chargeResponse.status_code) === '201') {
        const qrAction =
          chargeResponse.actions?.find(a => a.name === 'generate-qr-code') ||
          chargeResponse.actions?.find(a => a.url && a.url.includes('qr-code'));

        // Pure 100% unmodified qr_url and qr_string from Midtrans
        qrUrl = qrAction ? qrAction.url : `${apiBaseUrl}/v2/qris/${chargeResponse.transaction_id}/qr-code`;
        qrString = chargeResponse.qr_string;
        qrisTransactionId = chargeResponse.transaction_id;
        qrisRawResponse = chargeResponse;
      }
    } catch (coreErr) {
      // Direct Core API not activated on this Sandbox merchant; obtain official QRIS from Snap API
    }

    // 2b. If Core API did not return QRIS, obtain official QRIS via a dedicated Snap QRIS transaction
    //     (keeping `snapToken` above 100% untouched for the multi-payment Snap popup!)
    if (!qrUrl || !qrString) {
      const qrisSnapRes = await snap.createTransaction({
        transaction_details: {
          order_id: qrisMidtransOrderId,
          gross_amount: amount
        },
        item_details: itemDetails,
        customer_details: customerDetails
      });

      const payRes = await fetch(`${snapBaseUrl}/snap/v1/transactions/${qrisSnapRes.token}/pay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ payment_type: 'other_qris' })
      });

      const payData = await payRes.json();

      if (String(payData.status_code) === '201' && payData.transaction_id) {
        // Pure 100% unmodified qr_string and official qr_url directly from Midtrans
        qrString = payData.qr_string;
        qrUrl = `${apiBaseUrl}/v2/qris/${payData.transaction_id}/qr-code`;
        qrisTransactionId = payData.transaction_id;
        qrisRawResponse = payData;
      } else {
        throw new Error(
          payData.status_message || `Midtrans QRIS gagal dibuat (status_code: ${payData.status_code})`
        );
      }
    }

    return {
      success: true,
      isSimulation: false,
      midtransOrderId,
      qrisMidtransOrderId,
      transactionId: qrisTransactionId,
      // Provide both camelCase and snake_case for full compatibility
      snapToken,
      snap_token: snapToken,
      redirectUrl,
      redirect_url: redirectUrl,
      qrUrl,
      qr_url: qrUrl,
      qrString,
      qr_string: qrString,
      grossAmount: amount,
      gross_amount: amount,
      status: 'pending',
      clientKey,
      client_key: clientKey,
      raw: {
        snap: snapTransaction,
        qris: qrisRawResponse,
        qris_midtrans_order_id: qrisMidtransOrderId,
        snap_midtrans_order_id: midtransOrderId,
        qr_url: qrUrl,
        transaction_id: qrisTransactionId
      }
    };
  },

  /**
   * Verify real-time status of transaction from Midtrans API (checks both Snap order_id and QRIS order_id)
   */
  async checkStatus(midtransOrderId, altMidtransOrderId = null) {
    const { serverKey, clientKey, isProduction, isValid } = getMidtransConfig();
    if (!isValid) {
      return { status: 'pending', isPaid: false };
    }

    const coreApi = new midtransClient.CoreApi({
      isProduction,
      serverKey,
      clientKey
    });

    const idsToCheck = [midtransOrderId, altMidtransOrderId].filter(Boolean);

    for (const id of idsToCheck) {
      try {
        const response = await coreApi.transaction.status(id);
        const txStatus = response.transaction_status;
        if (txStatus === 'settlement' || txStatus === 'capture') {
          return {
            status: txStatus,
            midtransOrderId: id,
            transactionId: response.transaction_id,
            grossAmount: response.gross_amount,
            paymentType: response.payment_type,
            fraudStatus: response.fraud_status,
            isPaid: true,
            raw: response
          };
        }
      } catch (err) {
        // 404 on Snap order_id means user hasn't selected a payment method in Snap popup yet; continue
      }
    }

    return {
      status: 'pending',
      isPaid: false
    };
  },

  /**
   * Trigger Midtrans Sandbox QRIS Simulator settlement for a real Midtrans QR URL
   */
  async settleSandboxQris(qrUrl) {
    if (!qrUrl || !qrUrl.includes('sandbox.midtrans.com')) return false;
    try {
      const scanRes = await fetch('https://simulator.sandbox.midtrans.com/v2/qris/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ qrCodeUrl: qrUrl }).toString()
      });
      const scanHtml = await scanRes.text();
      const refMatch = scanHtml.match(/name=["']referenceId["']\s+type=["']hidden["']\s+value=["']([^"']+)["']/i);
      const expMatch = scanHtml.match(/name=["']exploreData["']\s+type=["']hidden["']\s+value=["']([\s\S]*?)["']>/i);

      if (refMatch && expMatch) {
        const referenceId = refMatch[1];
        const exploreData = expMatch[1].replace(/&quot;/g, '"');
        const payRes = await fetch('https://simulator.sandbox.midtrans.com/v2/qris/payment/gopay', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ referenceId, exploreData }).toString()
        });
        return payRes.ok;
      }
    } catch (err) {
      console.warn('[Midtrans Sandbox Auto-Settle] Warning:', err.message);
    }
    return false;
  }
};
