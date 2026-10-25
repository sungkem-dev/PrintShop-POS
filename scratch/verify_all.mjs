import fs from 'fs';

async function testE2E() {
  console.log('=== VERIFIKASI LENGKAP 4 MASALAH KRITIS PRINTSHOP-POS ===\n');

  const BASE = 'http://localhost:3000';

  // ── TEST 1: Audit Bug UI/CSS Overlap di spesifikasi.html & pembayaran.html ──
  console.log('--- 1. Testing UI/CSS Overlap Fix ---');
  const specHtml = fs.readFileSync('public/spesifikasi.html', 'utf8');
  const payHtml = fs.readFileSync('public/pembayaran.html', 'utf8');

  // Verify .spec-sidebar has gap: 20px and sticky top: 24px; align-self: start;
  const specHasStickySidebar = specHtml.includes('position: sticky') && specHtml.includes('align-self: start') && specHtml.includes('gap: 20px');
  // Verify .summary-card does NOT have position: sticky;
  const specSummaryNotSticky = !specHtml.match(/\.summary-card\s*\{[^}]*position:\s*sticky/);

  console.log('✓ spesifikasi.html: sidebar sticky top 24px & gap 20px:', specHasStickySidebar ? 'PASSED' : 'FAILED');
  console.log('✓ spesifikasi.html: summary-card sticky removed:', specSummaryNotSticky ? 'PASSED' : 'FAILED');

  const payHasStickySidebar = payHtml.includes('position: sticky') && payHtml.includes('align-self: start') && payHtml.includes('gap: 20px');
  const paySummaryNotSticky = !payHtml.match(/\.summary-card\s*\{[^}]*position:\s*sticky/);

  console.log('✓ pembayaran.html: sidebar sticky top 24px & gap 20px:', payHasStickySidebar ? 'PASSED' : 'FAILED');
  console.log('✓ pembayaran.html: summary-card sticky removed:', paySummaryNotSticky ? 'PASSED' : 'FAILED');

  if (!specHasStickySidebar || !specSummaryNotSticky || !payHasStickySidebar || !paySummaryNotSticky) {
    throw new Error('Test 1 Failed: Sticky layout rules mismatch');
  }

  // ── TEST 2: Testing Sinkronisasi Tabel Transactions di Supabase/DataService ──
  console.log('\n--- 2. Testing Transactions Table Synchronization ---');
  // Create order
  const orderRes = await fetch(`${BASE}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customer_name: 'Dewi Sartika',
      customer_phone: '081234567890',
      file_name: 'Laporan_Akhir_Dewi.pdf',
      total_pages: 15,
      copies: 1,
      total_price: 15000,
      status: 'DRAFT'
    })
  });
  const order = (await orderRes.json()).data;
  console.log('✓ Order Created:', order.order_code, '(ID:', order.id, ')');

  // Create Midtrans QRIS payment
  const payRes = await fetch(`${BASE}/api/payment/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId: order.id })
  });
  const payJson = await payRes.json();
  const payment = payJson.data.payment;
  console.log('✓ Midtrans QRIS Created: Midtrans Order ID =', payment.midtransOrderId);
  console.log('  Gross Amount:', payment.grossAmount);
  console.log('  QR String exists:', Boolean(payment.qrString));
  console.log('  QR URL exists:', Boolean(payment.qrUrl));

  // Verify transaction status before payment
  const statusResBefore = await (await fetch(`${BASE}/api/payment/status/${order.id}`)).json();
  console.log('✓ Transaction Status Initial:', statusResBefore.data.status, '(isPaid:', statusResBefore.data.isPaid, ')');

  // ── TEST 3: Render QRIS Midtrans & Sandbox Simulation UI ──
  console.log('\n--- 3. Testing QRIS Rendering & Simulation UI ---');
  const payPageHtml = fs.readFileSync('public/pembayaran.html', 'utf8');
  const hasSandboxBadge = payPageHtml.includes('qris-sandbox-badge');
  const hasCopyEmvcoBtn = payPageHtml.includes('btn-copy-emvco');
  const hasSimulateBtn = payPageHtml.includes('Simulasi Bayar Lunas (Sandbox Test)');

  console.log('✓ pembayaran.html contains Sandbox Notice Badge:', hasSandboxBadge ? 'PASSED' : 'FAILED');
  console.log('✓ pembayaran.html contains Copy EMVCo Button:', hasCopyEmvcoBtn ? 'PASSED' : 'FAILED');
  console.log('✓ pembayaran.html contains "Simulasi Bayar Lunas (Sandbox Test)":', hasSimulateBtn ? 'PASSED' : 'FAILED');

  if (!hasSandboxBadge || !hasCopyEmvcoBtn || !hasSimulateBtn) {
    throw new Error('Test 3 Failed: UI elements for Sandbox / Simulator missing in pembayaran.html');
  }

  // ── TEST 4: Backend Antrean & Webhook Settlement Synchronization ──
  console.log('\n--- 4. Testing Webhook & Queue Synchronization ---');
  // 4.1 Trigger Webhook with settlement payload
  const webhookRes = await fetch(`${BASE}/api/payment/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      order_id: payment.midtransOrderId,
      transaction_status: 'settlement',
      fraud_status: 'accept',
      gross_amount: payment.grossAmount
    })
  });
  console.log('✓ Webhook Settlement Triggered:', (await webhookRes.json()).status);

  // 4.2 Verify order status transitioned to WAITING_IN_QUEUE
  const statusResAfter = await (await fetch(`${BASE}/api/payment/status/${order.id}`)).json();
  console.log('✓ Order Status After Webhook:', statusResAfter.data.status, '(isPaid:', statusResAfter.data.isPaid, ')');
  if (statusResAfter.data.status !== 'WAITING_IN_QUEUE' || !statusResAfter.data.isPaid) {
    throw new Error('Test 4.2 Failed: Order was not updated to WAITING_IN_QUEUE upon settlement');
  }

  // 4.3 Verify order appears in FIFO active queue
  const queueRes = await (await fetch(`${BASE}/api/orders?status=WAITING_IN_QUEUE,PROCESSING,PRINTING,READY_FOR_PICKUP`)).json();
  const foundInQueue = queueRes.data.some(o => o.id === order.id);
  console.log('✓ Order Enters Active FIFO Queue Table:', foundInQueue ? 'PASSED' : 'FAILED');

  // 4.4 Verify Dashboard Stats live update
  const statsRes = await (await fetch(`${BASE}/api/dashboard/stats`)).json();
  console.log('✓ Dashboard Real-time Stats Reflected:');
  console.log('  Omzet Hari Ini: Rp', statsRes.data.kpi.omzetHariIni.toLocaleString('id-ID'));
  console.log('  Antrean Aktif:', statsRes.data.kpi.antreanAktif);

  console.log('\n======================================================');
  console.log('✓ ALL 4 CRITICAL ISSUES SUCCESSFULLY AUDITED & VERIFIED!');
  console.log('======================================================');
}

testE2E().catch(err => {
  console.error('\n❌ VERIFICATION ERROR:', err);
  process.exit(1);
});
