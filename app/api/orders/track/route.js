import { NextResponse } from 'next/server';
import { DataService } from '@/lib/supabase';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code') || searchParams.get('nomor-pesanan');
    if (!code) {
      return NextResponse.json({ success: false, error: 'Nomor pesanan wajib diisi' }, { status: 400 });
    }

    const order = await DataService.getOrderById(code.trim());
    if (!order) {
      return NextResponse.json({ success: false, error: 'Nomor pesanan tidak ditemukan' }, { status: 404 });
    }

    // Also calculate current queue position
    const allQueue = await DataService.getOrders({ status: 'WAITING_IN_QUEUE,PROCESSING,PRINTING' });
    const queueIndex = allQueue.findIndex(o => o.id === order.id);
    const queuePosition = queueIndex >= 0 ? queueIndex + 1 : 0;

    return NextResponse.json({
      success: true,
      data: {
        ...order,
        queuePosition,
        estimatedMinutes: queuePosition > 0 ? queuePosition * 3 + 2 : 0
      }
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
