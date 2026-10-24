import midtransClient from 'midtrans-client';

const serverKey = process.env.MIDTRANS_SERVER_KEY || 'SB-Mid-server-sandbox-demo-key';
const clientKey = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || 'SB-Mid-client-sandbox-demo-key';
const isProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true';

export const isMidtransRealConfig = () => {
  return (
    Boolean(serverKey) &&
    !serverKey.includes('demo') &&
    !serverKey.includes('YOUR_SERVER_KEY')
  );
};

let snapInstance = null;
let coreApiInstance = null;

if (isMidtransRealConfig()) {
  snapInstance = new midtransClient.Snap({
    isProduction,
    serverKey,
    clientKey
  });

  coreApiInstance = new midtransClient.CoreApi({
    isProduction,
    serverKey,
    clientKey
  });
}

export const MidtransService = {
  /**
   * Create Midtrans QRIS charge and Snap transaction
   */
  async createQrisTransaction({ orderId, orderCode, grossAmount, customerName, customerPhone, items }) {
    const midtransOrderId = `${orderCode}-${Date.now()}`;
    const amount = Math.round(Number(grossAmount) || 10000);

    const parameter = {
      payment_type: 'qris',
      transaction_details: {
        order_id: midtransOrderId,
        gross_amount: amount
      },
      item_details: (items && items.length > 0) ? items : [
        {
          id: orderCode,
          price: amount,
          quantity: 1,
          name: `Print Cetak ${orderCode}`
        }
      ],
      customer_details: {
        first_name: customerName || 'Mahasiswa',
        phone: customerPhone || '081234567890'
      },
      qris: {
        acquirer: 'gopay'
      }
    };

    if (isMidtransRealConfig() && coreApiInstance) {
      try {
        // Attempt Core API QRIS charge
        const chargeResponse = await coreApiInstance.charge(parameter);
        
        let snapToken = null;
        if (snapInstance) {
          try {
            const snapRes = await snapInstance.createTransaction({
              transaction_details: parameter.transaction_details,
              item_details: parameter.item_details,
              customer_details: parameter.customer_details
            });
            snapToken = snapRes.token;
          } catch (e) {
            // Snap optional if Core API QRIS succeeds
          }
        }

        const qrAction = chargeResponse.actions?.find(a => a.name === 'generate-qr-code');
        const qrUrl = qrAction?.url || null;
        const qrString = chargeResponse.qr_string || null;

        return {
          success: true,
          isSimulation: false,
          midtransOrderId,
          transactionId: chargeResponse.transaction_id,
          snapToken,
          qrUrl,
          qrString,
          grossAmount: amount,
          status: chargeResponse.transaction_status || 'pending',
          raw: chargeResponse
        };
      } catch (err) {
        console.warn('Midtrans Core API call failed, falling back to simulated QRIS payload:', err.message);
      }
    }

    // Dynamic Simulated Midtrans QRIS Token & Payload (for Sandbox / Testing)
    const simulatedQrString = `00020101021226680016ID.CO.MIDTRANS01189360099900000100420215${midtransOrderId}5204581253033605407${amount}5802ID5913PRINTSHOP POS6007BANDUNG61054013262240120${orderCode}6304A1B2`;

    return {
      success: true,
      isSimulation: true,
      midtransOrderId,
      transactionId: `TRX-${Date.now()}`,
      snapToken: `SNAP-TOKEN-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
      qrUrl: `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(simulatedQrString)}`,
      qrString: simulatedQrString,
      grossAmount: amount,
      status: 'pending',
      clientKey: clientKey
    };
  },

  /**
   * Verify status of transaction from Midtrans
   */
  async checkStatus(midtransOrderId) {
    if (isMidtransRealConfig() && coreApiInstance) {
      try {
        const response = await coreApiInstance.transaction.status(midtransOrderId);
        return {
          status: response.transaction_status, // settlement, pending, cancel, expire
          grossAmount: response.gross_amount,
          paymentType: response.payment_type,
          fraudStatus: response.fraud_status,
          isPaid: response.transaction_status === 'settlement' || response.transaction_status === 'capture'
        };
      } catch (err) {
        console.warn('Midtrans status check error:', err.message);
      }
    }

    // In simulation mode, status remains pending unless manually settled
    return {
      status: 'pending',
      isPaid: false
    };
  }
};
