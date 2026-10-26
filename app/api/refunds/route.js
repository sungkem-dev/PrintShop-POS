import { NextResponse } from 'next/server';
import { DataService } from '@/lib/supabase';

export async function GET() {
  try {
    const refunds = await DataService.getRefunds();
    return NextResponse.json({
      success: true,
      data: refunds
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { order_id, order_code, refund_amount, refund_method, reason, notes, operator_id, source } = body;

    if (!order_id && !order_code) {
      return NextResponse.json({
        success: false,
        error: 'ID atau kode pesanan wajib disertakan'
      }, { status: 400 });
    }

    const newRefund = await DataService.createRefund({
      order_id,
      order_code,
      refund_amount,
      refund_method: refund_method || 'qris_reversal',
      reason: reason || 'Pembatalan pesanan dan pengembalian dana',
      notes,
      operator_id,
      source: source || 'admin',
      status: 'completed'
    });

    return NextResponse.json({
      success: true,
      message: 'Refund berhasil diproses dan dicatat dalam riwayat pengembalian',
      data: newRefund
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
