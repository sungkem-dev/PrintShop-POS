/**
 * ═══════════════════════════════════════════════════════
 *  PrintShop POS — Live Order Status Tracker & Ticket Flow
 *  File   : assets/js/ticket-tracker.js
 *  Author : Andrew Wijaya (Kelompok 2 — Divisi Web UI/UX)
 *  Role   : tiket.html (Layar M7 & M8)
 * ═══════════════════════════════════════════════════════
 *
 *  Features:
 *    - 3-stage live order status tracker (FIFO Queue)
 *    - Auto-polling simulation ticker (every 5 seconds)
 *    - Manual stage simulator for grading / demo purposes
 *    - Clipboard copy for claim code with toast feedback
 *    - Read order data from sessionStorage with fallback
 *    - Print ticket dialog helper
 */

;(function () {
  'use strict';

  // ── Stages Definition ─────────────────────────────
  var STAGES = [
    {
      id: 1,
      key: 'WAITING_IN_QUEUE',
      label: 'Menunggu Antrean',
      badgeClass: 'badge-waiting',
      progressPct: 20,
      title: 'Pesanan Masuk Antrean #ORD-042',
      description: 'Pesanan Anda terdaftar dalam antrean FIFO dan sedang menunggu giliran mesin cetak.',
      eta: '±10 menit',
      queuePos: 'No. 3'
    },
    {
      id: 2,
      key: 'PRINTING',
      label: 'Sedang Dicetak',
      badgeClass: 'badge-printing',
      progressPct: 65,
      title: 'Dokumen Sedang Dicetak',
      description: 'Operator sedang memproses pencetakan pada mesin Canon iR-ADV C3530.',
      eta: '±2 menit',
      queuePos: 'Sedang Berjalan'
    },
    {
      id: 3,
      key: 'READY_FOR_PICKUP',
      label: 'Siap Diambil',
      badgeClass: 'badge-ready',
      progressPct: 100,
      title: 'Cetakan Siap Diambil! 🎉',
      description: 'Dokumen Anda telah selesai dicetak rapi dan siap diambil di loket pengambilan.',
      eta: 'Siap Sekarang',
      queuePos: 'Siap di Loket'
    }
  ];

  // ── State ─────────────────────────────────────────
  var currentStageIndex = 0; // default: 0 (Waiting in Queue)
  var refreshSeconds = 5;
  var refreshInterval = null;

  // ── DOM References ────────────────────────────────
  var trackerStatusBadge = document.getElementById('tracker-status-badge');
  var trackerStatusDot   = document.getElementById('tracker-status-dot');
  var trackerStatusText  = document.getElementById('tracker-status-text');
  var trackerProgressBar = document.getElementById('tracker-progress-bar');
  var trackerCountdown   = document.getElementById('tracker-countdown');

  var stepWaiting   = document.getElementById('step-waiting');
  var stepPrinting  = document.getElementById('step-printing');
  var stepReady     = document.getElementById('step-ready');

  var stepWaitingMeta  = document.getElementById('step-waiting-meta');
  var stepPrintingMeta = document.getElementById('step-printing-meta');
  var stepReadyMeta    = document.getElementById('step-ready-meta');

  var btnSimulateStep = document.getElementById('btn-simulate-step');
  var btnRefreshStatus = document.getElementById('btn-refresh-status');
  var btnCopyClaim    = document.getElementById('btn-copy-claim');
  var btnPrintTicket  = document.getElementById('btn-print-ticket');

  var toastEl   = document.getElementById('toast');
  var toastText = document.getElementById('toast-text');

  // Dynamic order details elements
  var orderFilename = document.getElementById('order-filename');
  var orderPaper    = document.getElementById('order-paper');
  var orderColor    = document.getElementById('order-color');
  var orderSide     = document.getElementById('order-side');
  var orderPages    = document.getElementById('order-pages');
  var orderCopies   = document.getElementById('order-copies');
  var orderTotal    = document.getElementById('order-total');
  var bannerTotal   = document.getElementById('banner-total');

  // ── Helpers ───────────────────────────────────────

  function showToast(message, duration) {
    if (!toastEl || !toastText) return;
    duration = duration || 3000;
    toastText.textContent = message;
    toastEl.classList.add('visible');
    setTimeout(function () {
      toastEl.classList.remove('visible');
    }, duration);
  }

  // ── Load Session Data ─────────────────────────────

  function loadOrderData() {
    var data = null;
    try {
      var raw = sessionStorage.getItem('printshop_order');
      if (raw) {
        data = JSON.parse(raw);
      }
    } catch (e) {
      // Ignore JSON error
    }

    if (data) {
      if (data.filename && orderFilename) orderFilename.textContent = data.filename;
      if (data.paper && orderPaper) orderPaper.textContent = data.paper;
      if (data.color && orderColor) orderColor.textContent = data.color;
      if (data.side && orderSide) orderSide.textContent = data.side;
      if (data.pages && orderPages) orderPages.textContent = data.pages;
      if (data.copies && orderCopies) orderCopies.textContent = data.copies;
      if (data.total) {
        if (orderTotal) orderTotal.textContent = data.total;
        if (bannerTotal) bannerTotal.textContent = data.total;
      }
    }
  }

  // ── Render Tracker UI ─────────────────────────────

  function renderTracker() {
    var stage = STAGES[currentStageIndex];
    if (!stage) return;

    // Update main progress bar
    if (trackerProgressBar) {
      trackerProgressBar.style.width = stage.progressPct + '%';
      var wrap = trackerProgressBar.parentElement;
      if (wrap) wrap.setAttribute('aria-valuenow', stage.progressPct);
    }

    // Update status badge
    if (trackerStatusBadge && trackerStatusText) {
      trackerStatusBadge.className = 'live-status-pill ' + stage.badgeClass;
      trackerStatusText.textContent = stage.label;
    }

    // Update Step 1 (Waiting)
    if (stepWaiting) {
      stepWaiting.classList.remove('step-done', 'step-current', 'step-upcoming');
      if (currentStageIndex === 0) {
        stepWaiting.classList.add('step-current');
        stepWaiting.setAttribute('aria-current', 'step');
        if (stepWaitingMeta) stepWaitingMeta.innerHTML = 'Posisi Antrean: <strong>No. 3</strong> &bull; Estimasi: <strong>±10 menit</strong>';
      } else {
        stepWaiting.classList.add('step-done');
        stepWaiting.removeAttribute('aria-current');
        if (stepWaitingMeta) stepWaitingMeta.innerHTML = 'Pesanan diverifikasi &bull; <span class="text-success">Sudah Masuk Antrean ✓</span>';
      }
    }

    // Update Step 2 (Printing)
    if (stepPrinting) {
      stepPrinting.classList.remove('step-done', 'step-current', 'step-upcoming');
      if (currentStageIndex < 1) {
        stepPrinting.classList.add('step-upcoming');
        stepPrinting.removeAttribute('aria-current');
        if (stepPrintingMeta) stepPrintingMeta.innerHTML = '<span class="text-muted">Menunggu antrean selesai</span>';
      } else if (currentStageIndex === 1) {
        stepPrinting.classList.add('step-current');
        stepPrinting.setAttribute('aria-current', 'step');
        if (stepPrintingMeta) stepPrintingMeta.innerHTML = 'Sedang dicetak &bull; <strong>Mesin Canon iR-ADV C3530</strong> (±2 menit)';
      } else {
        stepPrinting.classList.add('step-done');
        stepPrinting.removeAttribute('aria-current');
        if (stepPrintingMeta) stepPrintingMeta.innerHTML = '<span class="text-success">Pencetakan Selesai 100% ✓</span>';
      }
    }

    // Update Step 3 (Ready for Pickup)
    if (stepReady) {
      stepReady.classList.remove('step-done', 'step-current', 'step-upcoming');
      if (currentStageIndex < 2) {
        stepReady.classList.add('step-upcoming');
        stepReady.removeAttribute('aria-current');
        if (stepReadyMeta) stepReadyMeta.innerHTML = '<span class="text-muted">Tunjukkan kode klaim saat tiba di loket</span>';
      } else {
        stepReady.classList.add('step-current');
        stepReady.setAttribute('aria-current', 'step');
        if (stepReadyMeta) stepReadyMeta.innerHTML = '<strong class="text-success">Siap Diambil!</strong> Tunjukkan kode <code class="ready-code-highlight">XK7-29F</code> ke kasir';
      }
    }

    // Banner alert for ready state
    var readyBanner = document.getElementById('ready-alert-banner');
    if (readyBanner) {
      if (currentStageIndex === 2) {
        readyBanner.classList.add('visible');
      } else {
        readyBanner.classList.remove('visible');
      }
    }
  }

  // ── Simulator Advancing ───────────────────────────

  function advanceStage() {
    currentStageIndex = (currentStageIndex + 1) % STAGES.length;
    renderTracker();

    var current = STAGES[currentStageIndex];
    showToast('Simulasi status: ' + current.label, 2500);
  }

  function refreshStatusManual() {
    if (btnRefreshStatus) {
      btnRefreshStatus.classList.add('spinning');
      setTimeout(function () {
        btnRefreshStatus.classList.remove('spinning');
      }, 700);
    }
    refreshSeconds = 5;
    if (trackerCountdown) trackerCountdown.textContent = '5 detik';
    renderTracker();
    showToast('Status pesanan berhasil disinkronisasi!', 2000);
  }

  // ── Auto Countdown Ticker ─────────────────────────

  function startAutoTicker() {
    if (refreshInterval) clearInterval(refreshInterval);
    refreshInterval = setInterval(function () {
      refreshSeconds--;
      if (refreshSeconds <= 0) {
        refreshSeconds = 5;
        // Optionally flash or re-render
        if (trackerCountdown) trackerCountdown.textContent = '5 detik';
      } else {
        if (trackerCountdown) trackerCountdown.textContent = refreshSeconds + ' detik';
      }
    }, 1000);
  }

  // ── Copy Claim Code ───────────────────────────────

  function copyClaimCode() {
    var code = 'XK7-29F';
    var claimCodeEl = document.getElementById('claim-code');
    if (claimCodeEl) {
      code = claimCodeEl.textContent.trim();
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code).then(function () {
        showToast('Kode klaim ' + code + ' berhasil disalin ke clipboard!', 3000);
      }).catch(function () {
        fallbackCopy(code);
      });
    } else {
      fallbackCopy(code);
    }
  }

  function fallbackCopy(text) {
    var temp = document.createElement('textarea');
    temp.value = text;
    temp.style.position = 'fixed';
    temp.style.opacity = '0';
    document.body.appendChild(temp);
    temp.select();
    try {
      document.execCommand('copy');
      showToast('Kode klaim ' + text + ' berhasil disalin!', 3000);
    } catch (err) {
      showToast('Gagal menyalin. Silakan catat: ' + text, 3000);
    }
    document.body.removeChild(temp);
  }

  // ── Print Dialog ──────────────────────────────────

  function printTicket() {
    window.print();
  }

  // ── Event Listeners ───────────────────────────────

  if (btnSimulateStep) {
    btnSimulateStep.addEventListener('click', function (e) {
      e.preventDefault();
      advanceStage();
    });
  }

  if (btnRefreshStatus) {
    btnRefreshStatus.addEventListener('click', function (e) {
      e.preventDefault();
      refreshStatusManual();
    });
  }

  if (btnCopyClaim) {
    btnCopyClaim.addEventListener('click', function (e) {
      e.preventDefault();
      copyClaimCode();
    });
  }

  if (btnPrintTicket) {
    btnPrintTicket.addEventListener('click', function (e) {
      e.preventDefault();
      printTicket();
    });
  }

  // ── Initialization ────────────────────────────────
  loadOrderData();
  renderTracker();
  startAutoTicker();

})();
