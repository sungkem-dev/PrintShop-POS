import { NextResponse } from 'next/server';
import { DataService } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || '';
    const search = searchParams.get('search') || '';

    const orders = await DataService.getOrders({ status, search });
    return NextResponse.json({ success: true, count: orders.length, data: orders });
  } catch (error) {
    console.error('API /api/orders error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    if (!body.customer_name && !body.file_name) {
      return NextResponse.json({ success: false, error: 'Nama pemesan atau nama berkas wajib diisi' }, { status: 400 });
    }

    const newOrder = await DataService.createOrder(body);
    return NextResponse.json({ success: true, data: newOrder }, { status: 201 });
  } catch (error) {
    console.error('API /api/orders POST error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
