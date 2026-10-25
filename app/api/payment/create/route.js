import { NextResponse } from 'next/server';
import { DataService } from '@/lib/supabase';
import { MidtransService } from '@/lib/midtrans';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request) {
  try {
    const body = await request.json();
    const { orderId, orderData } = body;

    if (!orderId && !orderData) {
      return NextResponse.json(
        { success: false, error: 'orderId wajib diisi' },
        { status: 400 }
      );
    }

    let order = orderId ? await DataService.getOrderById(orderId) : null;
    const isUuid = id =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id || ''));

    // Ensure order exists in Supabase with a valid UUID
    if (!order || !isUuid(order.id)) {
      const seed = orderData || order || {};
      order = await DataService.createOrder({
        customer_name: seed.customer_name || 'Mahasiswa',
        customer_phone: seed.customer_phone || null,
        file_name: seed.file_name || seed.filename || 'Dokumen.pdf',
        file_size: Number(seed.file_size) || 0,
        total_pages: Number(seed.total_pages || parseInt(seed.pages, 10)) || 1,
        copies: Number(seed.copies || parseInt(seed.copies, 10)) || 1,
        total_price: Number(seed.total_price || seed.totalNum) || 500,
        status: 'PENDING_PAYMENT',
        specifications: seed.specifications || {
          paper_size: seed.paper || 'A4',
          color_mode: (seed.color || '').includes('Color') ? 'Color' : 'B/W',
          print_side: (seed.side || '').includes('Duplex') ? 'Duplex' : 'Simplex',
          page_range: 'all',
          sheets_count: Number(parseInt(seed.sheets, 10) || seed.total_pages) || 1,
          notes: seed.notes || null
        }
      });
    }

    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Pesanan tidak ditemukan di database Supabase' },
        { status: 404 }
      );
    }

    const grossAmount = Math.max(1, Math.round(Number(order.total_price) || 500));

    // Call official Midtrans API (returns both untouched Snap Token/Redirect URL and pure QRIS URL/String)
    const payment = await MidtransService.createQrisTransaction({
      orderId: order.id,
      orderCode: order.order_code,
      grossAmount,
      customerName: order.customer_name,
      customerPhone: order.customer_phone,
      items: [
        {
          id: order.order_code,
          price: grossAmount,
          quantity: 1,
          name: `Cetak ${(order.file_name || 'Dokumen').slice(0, 30)}`
        }
      ]
    });

    // Update order status to PENDING_PAYMENT if currently DRAFT
    if (order.status === 'DRAFT') {
      await DataService.updateOrder(order.id, { status: 'PENDING_PAYMENT' });
    }

    // Record transaction into Supabase transactions table with pure qr_string & snap_token
    const trxRecord = await DataService.recordTransaction({
      order_id: order.id,
      midtrans_order_id: payment.midtransOrderId,
      payment_type: 'qris',
      gross_amount: payment.grossAmount,
      transaction_status: payment.status || 'pending',
      fraud_status: 'accept',
      snap_token: payment.snapToken || null,
      qr_string: payment.qrString || null,
      raw_payload: {
        ...(payment.raw || {}),
        qr_url: payment.qrUrl,
        qr_string: payment.qrString,
        snap_token: payment.snapToken,
        redirect_url: payment.redirectUrl,
        transaction_id: payment.transactionId
      }
    });

    console.log(
      `[Midtrans & Supabase] Transaksi siap: midtrans_order_id=${payment.midtransOrderId}, snap_token=${payment.snapToken}, qr_url=${payment.qrUrl}`
    );

    return NextResponse.json({
      success: true,
      data: {
        orderId: order.id,
        orderCode: order.order_code,
        transactionRecordId: trxRecord?.id || null,
        snap_token: payment.snapToken,
        snapToken: payment.snapToken,
        redirect_url: payment.redirectUrl,
        redirectUrl: payment.redirectUrl,
        qr_url: payment.qrUrl,
        qrUrl: payment.qrUrl,
        qr_string: payment.qrString,
        qrString: payment.qrString,
        client_key: payment.clientKey,
        clientKey: payment.clientKey,
        payment
      }
    });
  } catch (error) {
    console.error('API /api/payment/create error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Gagal menghubungi Midtrans API'
      },
      { status: 502 }
    );
  }
}
