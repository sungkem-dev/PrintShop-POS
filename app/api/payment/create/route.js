import { NextResponse } from 'next/server';
import { DataService } from '@/lib/supabase';
import { MidtransService } from '@/lib/midtrans';

export async function POST(request) {
  try {
    const body = await request.json();
    const { orderId } = body;

    if (!orderId) {
      return NextResponse.json({ success: false, error: 'orderId wajib diisi' }, { status: 400 });
    }

    const order = await DataService.getOrderById(orderId);
    if (!order) {
      return NextResponse.json({ success: false, error: 'Pesanan tidak ditemukan' }, { status: 404 });
    }

    // Call Midtrans service
    const payment = await MidtransService.createQrisTransaction({
      orderId: order.id,
      orderCode: order.order_code,
      grossAmount: order.total_price || 12000,
      customerName: order.customer_name,
      customerPhone: order.customer_phone,
      items: [
        {
          id: order.order_code,
          price: Math.round(Number(order.total_price) || 12000),
          quantity: 1,
          name: `Cetak ${order.file_name?.slice(0, 30) || 'Dokumen'}`
        }
      ]
    });

    // Update order status to PENDING_PAYMENT
    if (order.status === 'DRAFT') {
      await DataService.updateOrder(order.id, { status: 'PENDING_PAYMENT' });
    }

    return NextResponse.json({
      success: true,
      data: {
        orderId: order.id,
        orderCode: order.order_code,
        payment
      }
    });
  } catch (error) {
    console.error('API /api/payment/create error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
