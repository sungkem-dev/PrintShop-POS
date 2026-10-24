/**
 * PrintShop POS — Midtrans QRIS Payment Flow & Real-Time Status Poller
 * File: assets/js/qris-timer.js
 */

;(function () {
  'use strict';

  const TOTAL_SECONDS = 300; // 5 minutes
  const WARNING_THRESHOLD = 60;

  let secondsRemaining = TOTAL_SECONDS;
  let timerInterval = null;
  let statusPollInterval = null;
  let paymentState = 'PENDING_PAYMENT'; // 'PENDING_PAYMENT' | 'EXPIRED' | 'PAID'
  let currentOrderId = null;
  let currentOrder = null;

  // DOM References
  const countdownEl     = document.getElementById('countdown');
  const progressBar     = document.getElementById('progress-bar');
  const statusBadge     = document.getElementById('status-badge');
  const statusDot       = document.getElementById('status-dot');
  const statusText      = document.getElementById('status-text');
  const expiredAlert    = document.getElementById('expired-alert');
  const paidAlert       = document.getElementById('paid-alert');
  const qrImage         = document.getElementById('qr-image');
  const qrOverlayExp    = document.getElementById('qr-overlay-expired');
  const qrOverlayPaid   = document.getElementById('qr-overlay-paid');
  const btnSaveQr       = document.getElementById('btn-save-qr');
  const btnSimulate     = document.getElementById('btn-simulate');
  const btnReloadQr     = document.getElementById('btn-reload-qr');
  const toastEl         = document.getElementById('toast');
  const toastText       = document.getElementById('toast-text');

  // Sidebar summary elements
  const payFilename     = document.getElementById('pay-filename');
  const payPaper        = document.getElementById('pay-paper');
  const payColor        = document.getElementById('pay-color');
  const paySide         = document.getElementById('pay-side');
  const payPages        = document.getElementById('pay-pages');
  const paySheets       = document.getElementById('pay-sheets');
  const payCopies       = document.getElementById('pay-copies');
  const payPricePer     = document.getElementById('pay-price-per');
  const payTotal        = document.getElementById('pay-total');
  const qrAmount        = document.getElementById('qr-amount');

  function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  function formatRupiah(num) {
    return 'Rp ' + Number(num).toLocaleString('id-ID');
  }

  function showToast(message, duration = 3000) {
    if (!toastEl || !toastText) return;
    toastText.textContent = message;
    toastEl.classList.add('visible');
    setTimeout(() => toastEl.classList.remove('visible'), duration);
  }

  // ── Load & Display Dynamic Order Data ────────────────

  async function loadOrderData() {
    const params = new URLSearchParams(window.location.search);
    currentOrderId = params.get('order_id') || params.get('id');

    if (currentOrderId && window.PrintShopAPI) {
      try {
        currentOrder = await window.PrintShopAPI.getOrder(currentOrderId);
      } catch (e) {
        console.warn('Could not fetch order:', e);
      }
    }

    if (!currentOrder) {
      try {
        const raw = sessionStorage.getItem('printshop_order');
        if (raw) currentOrder = JSON.parse(raw);
      } catch (e) {}
    }

    if (currentOrder) {
      currentOrderId = currentOrder.id || currentOrderId;
      const fn = currentOrder.file_name || currentOrder.filename || 'Dokumen.pdf';
      const spec = currentOrder.specifications || {};
      const paper = spec.paper_size || currentOrder.paper || 'A4';
      const color = spec.color_mode || currentOrder.color || 'Hitam & Putih';
      const side = spec.print_side || currentOrder.side || 'Simplex';
      const pages = currentOrder.total_pages || currentOrder.pages || '24 hal';
      const sheets = spec.sheets_count || currentOrder.sheets || '24 lbr';
      const copies = currentOrder.copies || currentOrder.copies || '1x';
      const total = currentOrder.total_price ? formatRupiah(currentOrder.total_price) : (currentOrder.total || 'Rp 12.000');

      if (payFilename) payFilename.textContent = fn;
      if (payPaper) payPaper.textContent = paper;
      if (payColor) payColor.textContent = color.includes('Color') ? 'Full Color' : 'Hitam & Putih';
      if (paySide) paySide.textContent = side.includes('Duplex') ? 'Duplex' : 'Simplex';
      if (payPages) payPages.textContent = typeof pages === 'number' ? `${pages} hal` : pages;
      if (paySheets) paySheets.textContent = typeof sheets === 'number' ? `${sheets} lbr` : sheets;
      if (payCopies) payCopies.textContent = typeof copies === 'number' ? `${copies}x` : copies;
      if (payPricePer) payPricePer.textContent = currentOrder.pricePer || 'Rp 500';
      if (payTotal) payTotal.textContent = total;
      if (qrAmount) qrAmount.textContent = total;
    }

    // Call Midtrans API for payment payload
    initMidtransPayment();
  }

  // ── Midtrans Payment Generation ─────────────────────

  async function initMidtransPayment() {
    if (!currentOrderId || !window.PrintShopAPI) return;

    try {
      const result = await window.PrintShopAPI.createPayment(currentOrderId);
      if (result && result.payment) {
        const p = result.payment;
        if (p.qrUrl && qrImage) {
          qrImage.src = p.qrUrl;
        }
        if (p.grossAmount && qrAmount) {
          qrAmount.textContent = formatRupiah(p.grossAmount);
        }
        showToast('Kode QRIS Midtrans siap dipindai');
      }
    } catch (err) {
      console.warn('Midtrans payment init failed:', err);
    }

    startStatusPolling();
  }

  // ── Auto-polling for Midtrans Settlement ────────────

  function startStatusPolling() {
    if (statusPollInterval) clearInterval(statusPollInterval);

    statusPollInterval = setInterval(async () => {
      if (paymentState !== 'PENDING_PAYMENT' || !currentOrderId || !window.PrintShopAPI) {
        return;
      }

      try {
        const res = await window.PrintShopAPI.checkPaymentStatus(currentOrderId);
        if (res && res.isPaid) {
          handlePaidSuccess();
        }
      } catch (e) {
        // Silent ignore
      }
    }, 3500);
  }

  // ── Payment Success Handler ─────────────────────────

  function handlePaidSuccess() {
    paymentState = 'PAID';
    if (timerInterval) clearInterval(timerInterval);
    if (statusPollInterval) clearInterval(statusPollInterval);

    if (statusBadge) {
      statusBadge.className = 'status-badge status-badge--paid';
      if (statusDot) statusDot.className = 'status-dot status-dot--paid';
      if (statusText) statusText.textContent = 'Lunas Terverifikasi';
    }

    if (qrOverlayPaid) qrOverlayPaid.classList.add('visible');
    if (paidAlert) paidAlert.classList.add('visible');
    if (expiredAlert) expiredAlert.classList.remove('visible');

    if (btnSimulate) btnSimulate.disabled = true;
    if (btnSaveQr) btnSaveQr.disabled = true;

    showToast('Pembayaran QRIS berhasil! Mengalihkan ke tiket...');

    const orderCode = currentOrder?.order_code || 'ORD-042';
    const redirectUrl = currentOrderId
      ? `tiket.html?order_id=${encodeURIComponent(currentOrderId)}&code=${encodeURIComponent(orderCode)}`
      : `tiket.html?code=${encodeURIComponent(orderCode)}`;

    setTimeout(() => {
      window.location.href = redirectUrl;
    }, 2200);
  }

  // ── Timer Logic ─────────────────────────────────────

  function updateTimerUI() {
    if (countdownEl) countdownEl.textContent = formatTime(secondsRemaining);

    const pct = (secondsRemaining / TOTAL_SECONDS) * 100;
    if (progressBar) progressBar.style.width = pct + '%';

    if (secondsRemaining <= WARNING_THRESHOLD && secondsRemaining > 0) {
      if (countdownEl) countdownEl.classList.add('warning');
      if (progressBar) progressBar.classList.add('warning');
    }

    if (secondsRemaining <= 0) {
      handleExpired();
    }
  }

  function handleExpired() {
    paymentState = 'EXPIRED';
    if (timerInterval) clearInterval(timerInterval);
    if (statusPollInterval) clearInterval(statusPollInterval);

    if (statusBadge) {
      statusBadge.className = 'status-badge status-badge--expired';
      if (statusDot) statusDot.className = 'status-dot status-dot--expired';
      if (statusText) statusText.textContent = 'Kedaluwarsa';
    }

    if (qrOverlayExp) qrOverlayExp.classList.add('visible');
    if (expiredAlert) expiredAlert.classList.add('visible');
    if (btnReloadQr) btnReloadQr.classList.add('visible');
    if (btnSimulate) btnSimulate.disabled = true;
    if (btnSaveQr) btnSaveQr.disabled = true;

    showToast('Waktu pembayaran telah habis.');
  }

  function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    secondsRemaining = TOTAL_SECONDS;
    updateTimerUI();

    timerInterval = setInterval(() => {
      if (secondsRemaining > 0) {
        secondsRemaining--;
        updateTimerUI();
      }
    }, 1000);
  }

  // ── Event Handlers ──────────────────────────────────

  if (btnSimulate) {
    btnSimulate.addEventListener('click', async function () {
      btnSimulate.disabled = true;
      btnSimulate.textContent = 'Memverifikasi...';

      if (currentOrderId && window.PrintShopAPI) {
        try {
          await window.PrintShopAPI.simulatePaymentSuccess(currentOrderId);
        } catch (e) {
          console.warn('Simulation error:', e);
        }
      }
      handlePaidSuccess();
    });
  }

  if (btnReloadQr) {
    btnReloadQr.addEventListener('click', function () {
      paymentState = 'PENDING_PAYMENT';
      if (qrOverlayExp) qrOverlayExp.classList.remove('visible');
      if (expiredAlert) expiredAlert.classList.remove('visible');
      if (btnReloadQr) btnReloadQr.classList.remove('visible');
      if (btnSimulate) {
        btnSimulate.disabled = false;
        btnSimulate.textContent = 'Cek Status Bayar';
      }
      if (btnSaveQr) btnSaveQr.disabled = false;

      if (statusBadge) {
        statusBadge.className = 'status-badge status-badge--pending';
        if (statusDot) statusDot.className = 'status-dot status-dot--pending';
        if (statusText) statusText.textContent = 'Menunggu Pembayaran';
      }

      startTimer();
      initMidtransPayment();
    });
  }

  if (btnSaveQr) {
    btnSaveQr.addEventListener('click', function () {
      if (qrImage && qrImage.src) {
        const link = document.createElement('a');
        link.href = qrImage.src;
        link.download = `QRIS-PrintShop-${currentOrder?.order_code || 'ORD'}.png`;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('Gambar QRIS sedang diunduh.');
      }
    });
  }

  // Init
  document.addEventListener('DOMContentLoaded', () => {
    loadOrderData();
    startTimer();
  });
})();
