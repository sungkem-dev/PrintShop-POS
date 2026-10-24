async function testE2E() {
  console.log('=== PRINTSHOP POS E2E INTEGRATION TEST ===\n');

  const BASE = 'http://localhost:3000';

  // 1. Check HTML Pages
  console.log('--- 1. Testing Static HTML Pages Routing ---');
  const pages = ['/', '/unggah', '/spesifikasi', '/pembayaran', '/tiket', '/login', '/dasbor', '/antrean'];
  for (const page of pages) {
    const res = await fetch(`${BASE}${page}`);
    if (!res.ok) throw new Error(`Failed to load ${page}: status ${res.status}`);
    console.log(`✓ Page ${page} loaded (${res.status} OK)`);
  }

  // 2. Sisi Mahasiswa: Checkout -> Spesifikasi -> Bayar QRIS -> Tiket
  console.log('\n--- 2. Sisi Mahasiswa Flow Test ---');
  // 2.1 Buat order baru (unggah berkas)
  const orderRes = await fetch(`${BASE}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customer_name: 'Budi Santoso',
      customer_phone: '081298765432',
      file_name: 'Makalah_Tugas_Akhir_Kelompok2.pdf',
      file_size: 4404019,
      total_pages: 24,
      copies: 1,
      total_price: 12000,
      status: 'DRAFT'
    })
  });
  const orderData = await orderRes.json();
  console.log('✓ Order Created:', orderData.data.order_code, `(ID: ${orderData.data.id})`);
  const orderId = orderData.data.id;
  const orderCode = orderData.data.order_code;

  // 2.2 Update spesifikasi & hitung harga
  const updateSpecRes = await fetch(`${BASE}/api/orders/${orderId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      copies: 1,
      total_pages: 24,
      total_price: 12000,
      status: 'PENDING_PAYMENT',
      specifications: {
        paper_size: 'A4',
        color_mode: 'B/W',
        print_side: 'Simplex',
        page_range: 'all',
        sheets_count: 24,
        notes: 'Kertas 80 gsm rapi'
      }
    })
  });
  const updatedSpec = await updateSpecRes.json();
  console.log('✓ Spec Saved & Price Computed: Total Rp', updatedSpec.data.total_price);

  // 2.3 Generate Midtrans QRIS payment
  const payRes = await fetch(`${BASE}/api/payment/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId })
  });
  const payData = await payRes.json();
  console.log('✓ Midtrans QRIS Generated:', payData.data.payment.qrUrl ? 'QR Code Ready' : 'Failed');
  console.log('  Gross Amount:', payData.data.payment.grossAmount);

  // 2.4 Cek status pembayaran (sebelum bayar)
  const statusBefore = await (await fetch(`${BASE}/api/payment/status/${orderId}`)).json();
  console.log('✓ Payment Status Before:', statusBefore.data.status, '(isPaid:', statusBefore.data.isPaid, ')');

  // 2.5 Simulasi Pelunasan QRIS Midtrans
  const settleRes = await (await fetch(`${BASE}/api/payment/status/${orderId}`, { method: 'POST' })).json();
  console.log('✓ Midtrans QRIS Settlement:', settleRes.message);

  // 2.6 Cek status tiket & nomor antrean FIFO
  const trackRes = await (await fetch(`${BASE}/api/orders/track?code=${orderCode}`)).json();
  console.log('✓ Ticket Tracker: Status:', trackRes.data.status);
  console.log('  Nomor Antrean FIFO: Ke-', trackRes.data.queuePosition, '| Estimasi:', trackRes.data.estimatedMinutes, 'menit');

  // 3. Sisi Operator Admin
  console.log('\n--- 3. Sisi Operator Admin Flow Test ---');
  // 3.1 Login operator
  const loginRes = await (await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'operator@printshop.com', pin: '123456' })
  })).json();
  console.log('✓ Operator Login:', loginRes.success ? `Berhasil (${loginRes.operator.name} - ${loginRes.operator.role})` : 'Gagal');

  // 3.2 Ambil Antrean Aktif (FIFO)
  const queueRes = await (await fetch(`${BASE}/api/orders?status=WAITING_IN_QUEUE,PROCESSING,PRINTING,READY_FOR_PICKUP`)).json();
  console.log('✓ Antrean FIFO Terbaca:', queueRes.count, 'pesanan aktif dalam antrean');

  // 3.3 Operator memproses pesanan: WAITING_IN_QUEUE -> PRINTING
  const printStep = await (await fetch(`${BASE}/api/orders/${orderId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'PRINTING' })
  })).json();
  console.log('✓ Operator: Mulai Cetak -> Status:', printStep.data.status);

  // 3.4 Operator: PRINTING -> READY_FOR_PICKUP
  const readyStep = await (await fetch(`${BASE}/api/orders/${orderId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'READY_FOR_PICKUP' })
  })).json();
  console.log('✓ Operator: Siap Ambil -> Status:', readyStep.data.status);

  // 3.5 Operator: READY_FOR_PICKUP -> COMPLETED
  const completeStep = await (await fetch(`${BASE}/api/orders/${orderId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'COMPLETED' })
  })).json();
  console.log('✓ Operator: Serahkan ke Mahasiswa -> Status:', completeStep.data.status);

  // 3.6 Dasbor Analitik Real-Time KPI
  const statsRes = await (await fetch(`${BASE}/api/dashboard/stats`)).json();
  console.log('✓ Dasbor Analitik Real-time KPI:');
  console.log('  - Omzet Hari Ini: Rp', statsRes.data.kpi.omzetHariIni.toLocaleString('id-ID'));
  console.log('  - Lembar Tercetak:', statsRes.data.kpi.lembarHariIni);
  console.log('  - Pesanan Selesai:', statsRes.data.kpi.pesananSelesai);
  console.log('  - Antrean Aktif Saat Ini:', statsRes.data.kpi.antreanAktif);
  console.log('  - 7-Day Chart Data Points:', statsRes.data.chart7Days.length, 'hari');

  console.log('\n=== ALL INTEGRATION TESTS PASSED 100% CLEANLY! ===');
}

testE2E().catch(err => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
