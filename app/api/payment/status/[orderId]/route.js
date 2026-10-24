import { NextResponse } from 'next/server';
import { DataService, getSupabaseClient } from '@/lib/supabase';
import { MidtransService } from '@/lib/midtrans';

export async function GET(request, { params }) {
  try {
    const { orderId } = params;
    const order = await DataService.getOrderById(orderId);

    if (!order) {
      return NextResponse.json({ success: false, error: 'Pesanan tidak ditemukan' }, { status: 404 });
    }

    let isPaid = order.status !== 'DRAFT' && order.status !== 'PENDING_PAYMENT' && order.status !== 'CANCELLED';

    // If still pending, check Midtrans directly if transaction exists in Supabase
    if (!isPaid) {
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          const { data: trx } = await supabase
            .from('transactions')
            .select('midtrans_order_id')
            .eq('order_id', order.id)
            .maybeSingle();

          if (trx?.midtrans_order_id) {
            const statusCheck = await MidtransService.checkStatus(trx.midtrans_order_id);
            if (statusCheck && statusCheck.isPaid) {
              await DataService.updateOrder(order.id, { status: 'WAITING_IN_QUEUE' });
              await supabase
                .from('transactions')
                .update({ transaction_status: statusCheck.status, updated_at: new Date().toISOString() })
                .eq('order_id', order.id);
              isPaid = true;
              order.status = 'WAITING_IN_QUEUE';
            }
          }
        } catch (e) {
          // Ignore check errors
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        orderId: order.id,
        orderCode: order.order_code,
        status: order.status,
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
    const order = await DataService.getOrderById(orderId);

    if (!order) {
      return NextResponse.json({ success: false, error: 'Pesanan tidak ditemukan' }, { status: 404 });
    }

    const updated = await DataService.updateOrder(order.id, {
      status: 'WAITING_IN_QUEUE'
    });

    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase
        .from('transactions')
        .update({ transaction_status: 'settlement', updated_at: new Date().toISOString() })
        .eq('order_id', order.id);
    }

    return NextResponse.json({
      success: true,
      message: 'Pembayaran berhasil dikonfirmasi (Lunas via Midtrans QRIS)',
      data: updated
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
