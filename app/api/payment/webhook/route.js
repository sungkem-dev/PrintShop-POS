import { NextResponse } from 'next/server';
import { DataService, getSupabaseClient } from '@/lib/supabase';

export async function POST(request) {
  try {
    const notification = await request.json();
    console.log('[Midtrans Webhook] Received Notification Payload:', notification);

    const orderIdStr = notification.order_id; // e.g. ORD-042-1729000000000
    const transactionStatus = notification.transaction_status;
    const fraudStatus = notification.fraud_status;

    if (!orderIdStr) {
      return NextResponse.json({ status: 'ignored', message: 'No order_id in payload' }, { status: 400 });
    }

    // 1. Locate order via transactions table or orderCode
    let order = null;
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data: trxRows } = await supabase
          .from('transactions')
          .select('order_id')
          .eq('midtrans_order_id', orderIdStr)
          .limit(1);

        if (trxRows?.[0]?.order_id) {
          order = await DataService.getOrderById(trxRows[0].order_id);
        }
      } catch (e) {
        console.warn('[Webhook] Lookup by transaction error:', e.message);
      }
    }

    if (!order) {
      const orderCode = orderIdStr.split('-').slice(0, 2).join('-'); // 'ORD-042'
      order = await DataService.getOrderById(orderCode);
    }

    if (order) {
      let mappedTxStatus = transactionStatus;
      if (transactionStatus === 'capture' || transactionStatus === 'settlement') {
        if (fraudStatus === 'challenge') {
          console.warn(`[Webhook] Transaction ${orderIdStr} fraud challenge.`);
        } else {
          mappedTxStatus = 'settlement';
          // Success paid -> Advance to WAITING_IN_QUEUE (Active FIFO Queue)
          await DataService.updateOrder(order.id, {
            status: 'WAITING_IN_QUEUE'
          });
          console.log(`[Webhook] Order ${order.order_code} advanced to WAITING_IN_QUEUE (FIFO Active).`);
        }
      } else if (transactionStatus === 'cancel' || transactionStatus === 'deny' || transactionStatus === 'expire') {
        await DataService.updateOrder(order.id, {
          status: 'CANCELLED',
          cancel_reason: `Pembayaran ${transactionStatus} via Midtrans`
        });
        console.log(`[Webhook] Order ${order.order_code} status CANCELLED due to ${transactionStatus}.`);
      }

      // 2. Update transactions table status in Supabase
      await DataService.updateTransactionStatus(
        orderIdStr,
        mappedTxStatus,
        notification,
        order.id,
        order.total_price
      );
    } else {
      console.warn(`[Webhook] Order not found for midtrans_order_id: ${orderIdStr}`);
    }

    return NextResponse.json({ status: 'OK' });
  } catch (error) {
    console.error('[Midtrans Webhook Error]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
