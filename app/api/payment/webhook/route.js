import { NextResponse } from 'next/server';
import { DataService, getSupabaseClient } from '@/lib/supabase';

export async function POST(request) {
  try {
    const notification = await request.json();
    console.log('Received Midtrans Notification Webhook:', notification);

    const orderIdStr = notification.order_id; // e.g. ORD-042-1729000000000
    const transactionStatus = notification.transaction_status;
    const fraudStatus = notification.fraud_status;

    if (!orderIdStr) {
      return NextResponse.json({ status: 'ignored', message: 'No order_id in payload' }, { status: 400 });
    }

    // Extract original order_code
    const orderCode = orderIdStr.split('-').slice(0, 2).join('-'); // 'ORD-042'
    const order = await DataService.getOrderById(orderCode);

    if (order) {
      if (transactionStatus === 'capture' || transactionStatus === 'settlement') {
        if (fraudStatus === 'challenge') {
          // Challenge
        } else {
          // Success paid -> Advance to WAITING_IN_QUEUE
          await DataService.updateOrder(order.id, {
            status: 'WAITING_IN_QUEUE'
          });
          console.log(`Order ${order.order_code} status advanced to WAITING_IN_QUEUE via Midtrans Settlement.`);
        }
      } else if (transactionStatus === 'cancel' || transactionStatus === 'deny' || transactionStatus === 'expire') {
        await DataService.updateOrder(order.id, {
          status: 'CANCELLED',
          cancel_reason: `Pembayaran ${transactionStatus} via Midtrans`
        });
      }

      // Update transactions table if Supabase is connected
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          await supabase
            .from('transactions')
            .update({
              transaction_status: transactionStatus,
              fraud_status: fraudStatus || null,
              raw_payload: notification,
              updated_at: new Date().toISOString()
            })
            .eq('midtrans_order_id', orderIdStr);
        } catch (trxErr) {
          console.warn('Could not update transactions in webhook:', trxErr.message);
        }
      }
    }

    return NextResponse.json({ status: 'OK' });
  } catch (error) {
    console.error('Midtrans Webhook Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
