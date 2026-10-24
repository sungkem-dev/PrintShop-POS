import { NextResponse } from 'next/server';
import { DataService } from '@/lib/supabase';
import { MidtransService } from '@/lib/midtrans';

export async function GET(request, { params }) {
  try {
    const { orderId } = params;
    const order = await DataService.getOrderById(orderId);

    if (!order) {
      return NextResponse.json({ success: false, error: 'Pesanan tidak ditemukan' }, { status: 404 });
    }

    // Check if already updated to WAITING_IN_QUEUE or beyond
    const isPaid = order.status !== 'DRAFT' && order.status !== 'PENDING_PAYMENT' && order.status !== 'CANCELLED';

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

// POST endpoint to allow client payment simulator / manual settlement in sandbox
export async function POST(request, { params }) {
  try {
    const { orderId } = params;
    const order = await DataService.getOrderById(orderId);

    if (!order) {
      return NextResponse.json({ success: false, error: 'Pesanan tidak ditemukan' }, { status: 404 });
    }

    // Mark order as paid -> WAITING_IN_QUEUE (FIFO)
    const updated = await DataService.updateOrder(order.id, {
      status: 'WAITING_IN_QUEUE'
    });

    return NextResponse.json({
      success: true,
      message: 'Pembayaran berhasil dikonfirmasi (Lunas via Midtrans QRIS)',
      data: updated
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
