/**
 * PrintShop POS — Dynamic Ticket Tracker & Real-Time FIFO Queue Flow
 * File   : assets/js/ticket-tracker.js
 */

;(function () {
  'use strict';

  // ── Stages Definition ─────────────────────────────
  const STAGES = {
    WAITING_IN_QUEUE: {
      index: 0,
      label: 'Menunggu Antrean',
      badgeClass: 'badge-waiting',
      progressPct: 25,
      title: 'Pesanan Masuk Antrean FIFO',
      description: 'Pesanan Anda sudah lunas dan terdaftar dalam antrean mesin cetak.',
      eta: '±10 menit',
      queuePos: 'Dalam Antrean'
    },
    PROCESSING: {
      index: 1,
      label: 'Sedang Diproses',
      badgeClass: 'badge-printing',
      progressPct: 50,
      title: 'Operator Menyiapkan Mesin',
      description: 'Berkas dokumen sedang ditransfer ke RIP mesin cetak Canon.',
      eta: '±5 menit',
      queuePos: 'Sedang Berjalan'
    },
    PRINTING: {
      index: 1,
      label: 'Sedang Dicetak',
      badgeClass: 'badge-printing',
      progressPct: 75,
      title: 'Dokumen Sedang Dicetak',
      description: 'Operator sedang memproses pencetakan pada mesin Canon iR-ADV C3530.',
      eta: '±2 menit',
      queuePos: 'Mesin Aktif'
    },
    READY_FOR_PICKUP: {
      index: 2,
      label: 'Siap Diambil',
      badgeClass: 'badge-ready',
      progressPct: 100,
      title: 'Cetakan Siap Diambil! 🎉',
      description: 'Dokumen Anda telah selesai dicetak rapi dan siap diambil di loket pengambilan.',
      eta: 'Siap Sekarang',
      queuePos: 'Siap di Loket'
    },
    COMPLETED: {
      index: 2,
      label: 'Pesanan Selesai',
      badgeClass: 'badge-ready',
      progressPct: 100,
      title: 'Pesanan Telah Diserahkan',
      description: 'Terima kasih telah mencetak di PrintShop POS. Semoga tugas/ujianmu lancar!',
      eta: 'Selesai',
      queuePos: 'Arsip Selesai'
    },
    CANCELLED: {
      index: 0,
      label: 'Pesanan Dibatalkan',
      badgeClass: 'badge-waiting',
      progressPct: 0,
      title: 'Pesanan Dibatalkan',
      description: 'Pesanan telah dibatalkan oleh operator.',
      eta: 'Batal',
      queuePos: 'Dibatalkan'
    }
  };

  // State
  let currentOrder = null;
  let currentOrderId = null;
  let orderCode = 'ORD-042';
  let refreshSeconds = 5;
  let refreshInterval = null;

  // DOM References
  const trackerStatusBadge = document.getElementById('tracker-status-badge');
  const trackerStatusDot   = document.getElementById('tracker-status-dot');
  const trackerStatusText  = document.getElementById('tracker-status-text');
  const trackerProgressBar = document.getElementById('tracker-progress-bar');
  const trackerCountdown   = document.getElementById('tracker-countdown');

  const stepWaiting   = document.getElementById('step-waiting');
  const stepPrinting  = document.getElementById('step-printing');
  const stepReady     = document.getElementById('step-ready');

  const stepWaitingMeta  = document.getElementById('step-waiting-meta');
  const stepPrintingMeta = document.getElementById('step-printing-meta');
  const stepReadyMeta    = document.getElementById('step-ready-meta');

  const btnSimulateStep = document.getElementById('btn-simulate-step');
  const btnRefreshStatus = document.getElementById('btn-refresh-status');
  const btnCopyClaim    = document.getElementById('btn-copy-claim');
  const btnPrintTicket  = document.getElementById('btn-print-ticket');

  const claimCodeEl = document.getElementById('claim-code');
  const toastEl     = document.getElementById('toast');
  const toastText   = document.getElementById('toast-text');

  // Dynamic order details elements
  const orderFilename = document.getElementById('order-filename');
  const orderPaper    = document.getElementById('order-paper');
  const orderColor    = document.getElementById('order-color');
  const orderSide     = document.getElementById('order-side');
  const orderPages    = document.getElementById('order-pages');
  const orderCopies   = document.getElementById('order-copies');
  const orderTotal    = document.getElementById('order-total');
  const bannerTotal   = document.getElementById('banner-total');

  function showToast(message, duration = 3000) {
    if (!toastEl || !toastText) return;
    toastText.textContent = message;
    toastEl.classList.add('visible');
    setTimeout(() => toastEl.classList.remove('visible'), duration);
  }

  function formatRupiah(num) {
    return 'Rp ' + Number(num).toLocaleString('id-ID');
  }

  // ── Render Tracker State ──────────────────────────

  function applyStageUI(statusKey, queuePos = 'No. 2', eta = '±6 menit') {
    const stage = STAGES[statusKey] || STAGES.WAITING_IN_QUEUE;

    // Progress bar
    if (trackerProgressBar) {
      trackerProgressBar.style.width = stage.progressPct + '%';
      const wrap = trackerProgressBar.parentElement;
      if (wrap) wrap.setAttribute('aria-valuenow', stage.progressPct);
    }

    // Status Badge
    if (trackerStatusBadge && trackerStatusText) {
      trackerStatusBadge.className = 'live-status-pill ' + stage.badgeClass;
      trackerStatusText.textContent = stage.label;
    }

    // Tracker steps styling
    const steps = [stepWaiting, stepPrinting, stepReady];
    const metas = [stepWaitingMeta, stepPrintingMeta, stepReadyMeta];

    steps.forEach((step, idx) => {
      if (!step) return;
      step.classList.remove('step-done', 'step-active', 'step-waiting');

      if (idx < stage.index) {
        step.classList.add('step-done');
        if (metas[idx]) metas[idx].textContent = 'Selesai ✓';
      } else if (idx === stage.index) {
        step.classList.add('step-active');
        if (metas[idx]) {
          if (idx === 0) metas[idx].textContent = `${queuePos} • ${eta}`;
          else if (idx === 1) metas[idx].textContent = 'Sedang Berjalan • ±2 mnt';
          else metas[idx].textContent = 'Siap Diambil Sekarang';
        }
      } else {
        step.classList.add('step-waiting');
        if (metas[idx]) metas[idx].textContent = 'Menunggu';
      }
    });
  }

  // ── Load Order Data ───────────────────────────────

  async function loadOrder() {
    const params = new URLSearchParams(window.location.search);
    const codeParam = params.get('code') || params.get('nomor-pesanan');
    const idParam = params.get('order_id') || params.get('id');

    let order = null;

    if (window.PrintShopAPI) {
      try {
        if (codeParam) {
          order = await window.PrintShopAPI.trackOrder(codeParam);
        } else if (idParam) {
          order = await window.PrintShopAPI.getOrder(idParam);
        }
      } catch (e) {
        console.warn('API lookup error:', e);
      }
    }

    // Fallback to sessionStorage
    if (!order) {
      try {
        const raw = sessionStorage.getItem('printshop_order');
        if (raw) order = JSON.parse(raw);
      } catch (e) {}
    }

    if (!order) {
      // Default sample fallback
      order = {
        order_code: 'ORD-042',
        customer_name: 'Budi Santoso',
        file_name: 'Makalah_Tugas_Akhir_Kelompok2.pdf',
        total_price: 12000,
        status: 'WAITING_IN_QUEUE',
        specifications: {
          paper_size: 'A4',
          color_mode: 'B/W',
          print_side: 'Simplex',
          sheets_count: 24
        },
        queuePosition: 2,
        estimatedMinutes: 6
      };
    }

    currentOrder = order;
    currentOrderId = order.id || idParam;
    orderCode = order.order_code || 'ORD-042';

    // Populate UI
    if (claimCodeEl) claimCodeEl.textContent = orderCode;

    // Chips
    const orderCodeChips = document.querySelectorAll('.success-banner-chips .chip-item strong');
    if (orderCodeChips.length > 0) orderCodeChips[0].textContent = `#${orderCode}`;
    if (orderCodeChips.length > 1) orderCodeChips[1].textContent = orderCode;

    const totalStr = order.total_price ? formatRupiah(order.total_price) : (order.total || 'Rp 12.000');
    if (bannerTotal) bannerTotal.textContent = totalStr;
    if (orderTotal) orderTotal.textContent = totalStr;

    const fn = order.file_name || order.filename || 'Dokumen.pdf';
    const spec = order.specifications || {};
    const paper = spec.paper_size || order.paper || 'A4';
    const color = spec.color_mode || order.color || 'Hitam & Putih';
    const side = spec.print_side || order.side || 'Simplex';
    const pages = order.total_pages || order.pages || '24 hal';
    const copies = order.copies || order.copies || 1;

    if (orderFilename) orderFilename.textContent = fn;
    if (orderPaper) orderPaper.textContent = paper;
    if (orderColor) orderColor.textContent = color.includes('Color') ? 'Full Color' : 'Hitam & Putih';
    if (orderSide) orderSide.textContent = side.includes('Duplex') ? 'Duplex' : 'Simplex';
    if (orderPages) orderPages.textContent = typeof pages === 'number' ? `${pages} hal` : pages;
    if (orderCopies) orderCopies.textContent = `${copies}x`;

    const qPos = order.queuePosition ? `No. ${order.queuePosition} Antrean` : 'No. 2 Antrean';
    const eta = order.estimatedMinutes ? `±${order.estimatedMinutes} menit` : '±6 menit';

    applyStageUI(order.status || 'WAITING_IN_QUEUE', qPos, eta);
  }

  // ── Polling & Real-time Sync ──────────────────────

  function startAutoRefresh() {
    refreshSeconds = 5;

    if (refreshInterval) clearInterval(refreshInterval);

    refreshInterval = setInterval(async () => {
      refreshSeconds--;
      if (trackerCountdown) {
        trackerCountdown.textContent = `Memperbarui dalam ${refreshSeconds} dtk`;
      }

      if (refreshSeconds <= 0) {
        refreshSeconds = 5;
        if (currentOrderId && window.PrintShopAPI) {
          try {
            const updated = await window.PrintShopAPI.getOrder(currentOrderId);
            if (updated && updated.status !== currentOrder?.status) {
              const oldStatus = currentOrder?.status;
              currentOrder = updated;
              applyStageUI(updated.status);
              showToast(`Status pesanan diperbarui: ${updated.status}`);
            }
          } catch (e) {}
        }
      }
    }, 1000);
  }

  // ── Interactive Buttons ───────────────────────────

  if (btnCopyClaim) {
    btnCopyClaim.addEventListener('click', function () {
      const code = claimCodeEl ? claimCodeEl.textContent.trim() : orderCode;
      navigator.clipboard.writeText(code).then(() => {
        showToast(`Kode klaim ${code} berhasil disalin!`);
      }).catch(() => {
        showToast(`Kode klaim: ${code}`);
      });
    });
  }

  if (btnPrintTicket) {
    btnPrintTicket.addEventListener('click', function () {
      window.print();
    });
  }

  if (btnRefreshStatus) {
    btnRefreshStatus.addEventListener('click', async function () {
      btnRefreshStatus.disabled = true;
      showToast('Memeriksa status antrean...');
      await loadOrder();
      setTimeout(() => {
        btnRefreshStatus.disabled = false;
        showToast('Status antrean telah diperbarui');
      }, 500);
    });
  }

  // Manual simulator for grading/demo
  if (btnSimulateStep) {
    btnSimulateStep.addEventListener('click', async function () {
      const stageKeys = ['WAITING_IN_QUEUE', 'PRINTING', 'READY_FOR_PICKUP'];
      const currIdx = stageKeys.indexOf(currentOrder?.status || 'WAITING_IN_QUEUE');
      const nextIdx = (currIdx + 1) % stageKeys.length;
      const nextStatus = stageKeys[nextIdx];

      if (currentOrderId && window.PrintShopAPI) {
        try {
          await window.PrintShopAPI.updateOrder(currentOrderId, { status: nextStatus });
        } catch (e) {}
      }

      if (currentOrder) currentOrder.status = nextStatus;
      applyStageUI(nextStatus);
      showToast(`Simulasi: status berubah menjadi "${STAGES[nextStatus].label}"`);
    });
  }

  // Init
  document.addEventListener('DOMContentLoaded', () => {
    loadOrder();
    startAutoRefresh();
  });
})();
