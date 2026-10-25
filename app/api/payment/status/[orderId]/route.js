import { NextResponse } from 'next/server';
import { DataService, getSupabaseClient } from '@/lib/supabase';
import { MidtransService } from '@/lib/midtrans';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request, { params }) {
  try {
    const { orderId } = params;
    const order = await DataService.getOrderById(orderId);

    if (!order) {
      return NextResponse.json({ success: false, error: 'Pesanan tidak ditemukan' }, { status: 404 });
    }

    const trx = await DataService.getTransactionByOrderId(order.id);
    let isPaid =
      order.status !== 'DRAFT' &&
      order.status !== 'PENDING_PAYMENT' &&
      order.status !== 'CANCELLED';

    // If transaction in DB is already settlement/capture, ensure order is in WAITING_IN_QUEUE
    if (!isPaid && trx && (trx.transaction_status === 'settlement' || trx.transaction_status === 'capture')) {
      await DataService.updateOrder(order.id, { status: 'WAITING_IN_QUEUE' });
      isPaid = true;
      order.status = 'WAITING_IN_QUEUE';
    }

    // Poll Midtrans API directly for live transaction status (both Snap order_id and QRIS order_id)
    if (!isPaid && trx?.midtrans_order_id) {
      const qrisOrderId = trx.raw_payload?.qris_midtrans_order_id || null;
      const statusCheck = await MidtransService.checkStatus(trx.midtrans_order_id, qrisOrderId);
      if (statusCheck && statusCheck.isPaid) {
        await DataService.updateOrder(order.id, { status: 'WAITING_IN_QUEUE' });
        await DataService.updateTransactionStatus(
          trx.midtrans_order_id,
          statusCheck.status || 'settlement',
          statusCheck.raw || statusCheck,
          order.id,
          order.total_price
        );
        isPaid = true;
        order.status = 'WAITING_IN_QUEUE';
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        orderId: order.id,
        orderCode: order.order_code,
        status: order.status,
        transactionStatus: isPaid ? 'settlement' : (trx?.transaction_status || 'pending'),
        isPaid
      }
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const { orderId } = params;
    let snapResult = null;
    try {
      snapResult = await request.json();
    } catch (e) {
      // Optional body
    }

    const order = await DataService.getOrderById(orderId);
    if (!order) {
      return NextResponse.json({ success: false, error: 'Pesanan tidak ditemukan' }, { status: 404 });
    }

    const trx = await DataService.getTransactionByOrderId(order.id);

    // 1. If triggered by Sandbox QRIS button (no snapResult), also settle on Midtrans QRIS Simulator
    if (!snapResult?.transaction_status) {
      const qrUrl =
        trx?.raw_payload?.qr_url ||
        (trx?.raw_payload?.transaction_id
          ? `https://api.sandbox.midtrans.com/v2/qris/${trx.raw_payload.transaction_id}/qr-code`
          : null);
      if (qrUrl) {
        await MidtransService.settleSandboxQris(qrUrl);
      }
    }

    // 2. Update order status in Supabase orders table to WAITING_IN_QUEUE (FIFO Active Queue)
    const updated = await DataService.updateOrder(order.id, {
      status: 'WAITING_IN_QUEUE'
    });

    // 3. Update transaction status (and payment_type if paid via Snap VA/GoPay/ShopeePay) in Supabase transactions table to 'settlement'
    const resolvedPaymentType = snapResult?.payment_type || trx?.payment_type || 'qris';
    const resolvedMidtransOrderId = snapResult?.order_id || trx?.midtrans_order_id || `${order.order_code}-${Date.now()}`;

    const settledTrx = await DataService.updateTransactionStatus(
      resolvedMidtransOrderId,
      'settlement',
      {
        ...(trx?.raw_payload || {}),
        snap_result: snapResult || null,
        settlement_method: snapResult ? `midtrans_snap_${resolvedPaymentType}` : 'sandbox_test_settlement',
        settled_at: new Date().toISOString()
      },
      order.id,
      order.total_price
    );

    // If paid via another method in Snap (e.g. bank_transfer, gopay, shopeepay), update payment_type column too
    if (snapResult?.payment_type) {
      const supabase = getSupabaseClient();
      if (supabase) {
        await supabase
          .from('transactions')
          .update({ payment_type: snapResult.payment_type })
          .eq('order_id', order.id);
      }
    }

    console.log(
      `[Payment Settle] Order ${order.order_code} (${order.id}) LUNAS (${resolvedPaymentType}) -> orders=WAITING_IN_QUEUE, transactions=settlement`
    );

    return NextResponse.json({
      success: true,
      message: 'Pembayaran berhasil dikonfirmasi (Lunas via Midtrans)',
      data: {
        ...updated,
        transaction: settledTrx
      }
    });
  } catch (error) {
    console.error('API /api/payment/status POST error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
