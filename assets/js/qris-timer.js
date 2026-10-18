/**
 * ═══════════════════════════════════════════════════════
 *  PrintShop POS — QRIS Countdown Timer & Payment Flow
 *  File   : assets/js/qris-timer.js
 *  Author : Ryan Ramadhan (Kelompok 2 — Divisi Web UI/UX)
 * ═══════════════════════════════════════════════════════
 *
 *  Features:
 *    - 5-minute countdown timer with progress bar
 *    - EXPIRED state with reload QR button
 *    - Save QR image to device
 *    - Simulate payment → redirect to tiket.html
 *    - Read order data from sessionStorage (fallback defaults)
 */

;(function () {
  'use strict';

  // ── Constants ─────────────────────────────────────
  var TOTAL_SECONDS = 300; // 5 minutes
  var WARNING_THRESHOLD = 60; // last 60 seconds = red warning

  // ── State ─────────────────────────────────────────
  var secondsRemaining = TOTAL_SECONDS;
  var timerInterval = null;
  var paymentState = 'PENDING_PAYMENT'; // 'PENDING_PAYMENT' | 'EXPIRED' | 'PAID'

  // ── DOM References ────────────────────────────────
  var countdownEl     = document.getElementById('countdown');
  var progressBar     = document.getElementById('progress-bar');
  var statusBadge     = document.getElementById('status-badge');
  var statusDot       = document.getElementById('status-dot');
  var statusText      = document.getElementById('status-text');
  var expiredAlert    = document.getElementById('expired-alert');
  var paidAlert       = document.getElementById('paid-alert');
  var qrOverlayExp    = document.getElementById('qr-overlay-expired');
  var qrOverlayPaid   = document.getElementById('qr-overlay-paid');
  var btnSaveQr       = document.getElementById('btn-save-qr');
  var btnSimulate     = document.getElementById('btn-simulate');
  var btnReloadQr     = document.getElementById('btn-reload-qr');
  var toastEl         = document.getElementById('toast');
  var toastText       = document.getElementById('toast-text');

  // Sidebar summary elements
  var payFilename     = document.getElementById('pay-filename');
  var payPaper        = document.getElementById('pay-paper');
  var payColor        = document.getElementById('pay-color');
  var paySide         = document.getElementById('pay-side');
  var payPages        = document.getElementById('pay-pages');
  var paySheets       = document.getElementById('pay-sheets');
  var payCopies       = document.getElementById('pay-copies');
  var payPricePer     = document.getElementById('pay-price-per');
  var payTotal        = document.getElementById('pay-total');
  var qrAmount        = document.getElementById('qr-amount');

  // ── Helpers ───────────────────────────────────────

  /** Format seconds to MM:SS */
  function formatTime(sec) {
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  /** Format number as Indonesian Rupiah */
  function formatRupiah(num) {
    return 'Rp ' + num.toLocaleString('id-ID');
  }

  /** Show toast notification */
  function showToast(message, duration) {
    duration = duration || 3000;
    toastText.textContent = message;
    toastEl.classList.add('visible');
    setTimeout(function () {
      toastEl.classList.remove('visible');
    }, duration);
  }

  // ── Load Order Data from sessionStorage ───────────

  function loadOrderData() {
    var data = null;
    try {
      var raw = sessionStorage.getItem('printshop_order');
      if (raw) {
        data = JSON.parse(raw);
      }
    } catch (e) {
      // Silently fall back to defaults
    }

    // Default values
    var defaults = {
      filename: 'tugas-akhir-bab3.pdf',
      paper: 'A4',
      color: 'Hitam & Putih',
      side: 'Simplex',
      pages: '24 hal',
      sheets: '24 lbr',
      copies: '1×',
      pricePer: 'Rp 500',
      total: 'Rp 12.000',
      totalNum: 12000
    };

    if (data) {
      if (data.filename && payFilename) payFilename.textContent = data.filename;
      if (data.paper && payPaper) payPaper.textContent = data.paper;
      if (data.color && payColor) payColor.textContent = data.color;
      if (data.side && paySide) paySide.textContent = data.side;
      if (data.pages && payPages) payPages.textContent = data.pages;
      if (data.sheets && paySheets) paySheets.textContent = data.sheets;
      if (data.copies && payCopies) payCopies.textContent = data.copies;
      if (data.pricePer && payPricePer) payPricePer.textContent = data.pricePer;
      if (data.total && payTotal) payTotal.textContent = data.total;
      if (data.total && qrAmount) qrAmount.textContent = data.total;
    } else {
      // Apply defaults
      if (payFilename) payFilename.textContent = defaults.filename;
      if (payPaper) payPaper.textContent = defaults.paper;
      if (payColor) payColor.textContent = defaults.color;
      if (paySide) paySide.textContent = defaults.side;
      if (payPages) payPages.textContent = defaults.pages;
      if (paySheets) paySheets.textContent = defaults.sheets;
      if (payCopies) payCopies.textContent = defaults.copies;
      if (payPricePer) payPricePer.textContent = defaults.pricePer;
      if (payTotal) payTotal.textContent = defaults.total;
      if (qrAmount) qrAmount.textContent = defaults.total;
    }
  }

  // ── Timer Logic ───────────────────────────────────

  function updateTimerUI() {
    var timeStr = formatTime(secondsRemaining);
    countdownEl.textContent = timeStr;

    // Progress bar
    var pct = (secondsRemaining / TOTAL_SECONDS) * 100;
    progressBar.style.width = pct + '%';

    // ARIA
    var progressWrap = progressBar.parentElement;
    if (progressWrap) {
      progressWrap.setAttribute('aria-valuenow', Math.round(pct));
    }

    // Warning styling under threshold
    if (secondsRemaining <= WARNING_THRESHOLD && secondsRemaining > 0) {
      countdownEl.classList.add('timer--warning');
      countdownEl.classList.remove('timer--expired');
      progressBar.classList.add('progress--warning');
      progressBar.classList.remove('progress--expired');
    } else if (secondsRemaining <= 0) {
      countdownEl.classList.add('timer--expired');
      countdownEl.classList.remove('timer--warning');
      progressBar.classList.add('progress--expired');
      progressBar.classList.remove('progress--warning');
    } else {
      countdownEl.classList.remove('timer--warning', 'timer--expired');
      progressBar.classList.remove('progress--warning', 'progress--expired');
    }
  }

  function tick() {
    if (paymentState !== 'PENDING_PAYMENT') return;

    secondsRemaining--;

    if (secondsRemaining <= 0) {
      secondsRemaining = 0;
      clearInterval(timerInterval);
      timerInterval = null;
      setExpiredState();
    }

    updateTimerUI();
  }

  function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(tick, 1000);
  }

  // ── State Transitions ─────────────────────────────

  function setPendingState() {
    paymentState = 'PENDING_PAYMENT';

    // Status badge
    statusBadge.className = 'status-badge status-badge--pending';
    statusDot.className = 'status-dot status-dot--pending';
    statusText.textContent = 'Menunggu Pembayaran';

    // Hide alerts
    expiredAlert.classList.remove('visible');
    paidAlert.classList.remove('visible');

    // Hide overlays
    qrOverlayExp.classList.remove('visible');
    qrOverlayPaid.classList.remove('visible');

    // Buttons
    btnSaveQr.disabled = false;
    btnSimulate.disabled = false;
    btnReloadQr.classList.remove('visible');
  }

  function setExpiredState() {
    paymentState = 'EXPIRED';

    // Status badge
    statusBadge.className = 'status-badge status-badge--expired';
    statusDot.className = 'status-dot status-dot--expired';
    statusText.textContent = 'QRIS Kedaluwarsa';

    // Show expired alert
    expiredAlert.classList.add('visible');
    paidAlert.classList.remove('visible');

    // QR overlay
    qrOverlayExp.classList.add('visible');
    qrOverlayPaid.classList.remove('visible');

    // Buttons
    btnSaveQr.disabled = true;
    btnSimulate.disabled = true;
    btnReloadQr.classList.add('visible');
  }

  function setPaidState() {
    paymentState = 'PAID';

    // Stop timer
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }

    // Status badge
    statusBadge.className = 'status-badge status-badge--paid';
    statusDot.className = 'status-dot status-dot--paid';
    statusText.textContent = 'Pembayaran Lunas ✅';

    // Show paid alert
    paidAlert.classList.add('visible');
    expiredAlert.classList.remove('visible');

    // QR overlay
    qrOverlayPaid.classList.add('visible');
    qrOverlayExp.classList.remove('visible');

    // Buttons
    btnSaveQr.disabled = true;
    btnSimulate.disabled = true;
    btnReloadQr.classList.remove('visible');

    showToast('Pembayaran berhasil! Mengalihkan ke tiket...', 3000);

    // Redirect to tiket.html after delay
    setTimeout(function () {
      window.location.href = 'tiket.html';
    }, 3500);
  }

  // ── Reload QRIS ───────────────────────────────────

  function reloadQRIS() {
    // Reset timer
    secondsRemaining = TOTAL_SECONDS;
    updateTimerUI();

    // Reset state
    setPendingState();

    // Restart timer
    startTimer();

    showToast('Kode QRIS baru berhasil dimuat!', 2500);
  }

  // ── Save QR Image ─────────────────────────────────

  function saveQRImage() {
    if (paymentState !== 'PENDING_PAYMENT') return;

    var imgEl = document.getElementById('qr-image');

    // Try canvas approach for cross-origin compatible images
    try {
      var canvas = document.createElement('canvas');
      canvas.width = imgEl.naturalWidth || 280;
      canvas.height = imgEl.naturalHeight || 280;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(imgEl, 0, 0);
      var dataUrl = canvas.toDataURL('image/png');

      var link = document.createElement('a');
      link.href = dataUrl;
      link.download = 'qris-printshop-pos.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast('Gambar QR berhasil disimpan!', 2500);
    } catch (e) {
      // Fallback: direct download link
      var fallbackLink = document.createElement('a');
      fallbackLink.href = imgEl.src;
      fallbackLink.download = 'qris-printshop-pos.jpg';
      document.body.appendChild(fallbackLink);
      fallbackLink.click();
      document.body.removeChild(fallbackLink);

      showToast('Gambar QR berhasil disimpan!', 2500);
    }
  }

  // ── Event Listeners ───────────────────────────────

  // Save QR button
  btnSaveQr.addEventListener('click', function () {
    saveQRImage();
  });

  // Simulate payment button
  btnSimulate.addEventListener('click', function () {
    if (paymentState !== 'PENDING_PAYMENT') return;
    setPaidState();
  });

  // Reload QRIS button
  btnReloadQr.addEventListener('click', function () {
    reloadQRIS();
  });

  // ── Initialize ────────────────────────────────────

  // Load order data from sessionStorage
  loadOrderData();

  // Set initial pending state
  setPendingState();

  // Update timer UI initially
  updateTimerUI();

  // Start countdown
  startTimer();

})();
