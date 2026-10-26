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

    if (trackerProgressBar) {
      trackerProgressBar.style.width = stage.progressPct + '%';
      const wrap = trackerProgressBar.parentElement;
      if (wrap) wrap.setAttribute('aria-valuenow', stage.progressPct);
    }

    if (trackerStatusBadge && trackerStatusText) {
      trackerStatusBadge.className = 'live-status-pill ' + stage.badgeClass;
      trackerStatusText.textContent = stage.label;
    }

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
          if (idx === 0) metas[idx].textContent = queuePos + ' • ' + eta;
          else if (idx === 1) metas[idx].textContent = 'Sedang Berjalan • ±2 mnt';
          else metas[idx].textContent = 'Siap Diambil Sekarang';
        }
      } else {
        step.classList.add('step-waiting');
        if (metas[idx]) metas[idx].textContent = 'Menunggu';
      }
    });
  }

  // ── Load Order Data (Strict Database / ORD-042 / Active Checkout) ──
  async function loadOrder() {
    const params = new URLSearchParams(window.location.search);
    const codeParam = (params.get('code') || params.get('nomor-pesanan') || params.get('order') || '').trim();
    const idParam = (params.get('order_id') || params.get('id') || '').trim();

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

    // Explicitly reject any dummy codes that might linger in client cache
    const forbiddenDummies = ['ORD-041', 'ORD-040', 'ORD-043', 'ORD-039', '#ORD-041', '#ORD-040', '#ORD-043', '#ORD-039'];
    if (order && forbiddenDummies.includes(order.order_code)) {
      order = null;
    }

    // Special allowance ONLY for ORD-042 simulation test
    if (!order && (codeParam.toUpperCase() === 'ORD-042' || codeParam.toUpperCase() === '#ORD-042')) {
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

    // Fallback to active checkout session ONLY if user didn't enter a query parameter
    if (!order && !codeParam && !idParam) {
      try {
        const raw = sessionStorage.getItem('printshop_order');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && !forbiddenDummies.includes(parsed.order_code)) {
            order = parsed;
          }
        }
      } catch (e) {}
    }

    // Default visit to ticket page with NO query params -> default demo ORD-042
    if (!order && !codeParam && !idParam) {
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

    const notFoundEl = document.getElementById('ticket-not-found-state');
    const notFoundCode = document.getElementById('not-found-code-text');
    const successBanner = document.querySelector('.success-banner');
    const ticketCard = document.querySelector('.ticket-card:not(#ticket-not-found-state)');
    const trackerCard = document.querySelector('.tracker-card');
    const guideCard = document.querySelector('.guide-card');
    const helpSection = document.querySelector('.help-section');
    const simulatorPanel = document.querySelector('.simulator-panel');

    // ── Handle Order Not Found (STRICT 404) ────────────────
    if (!order) {
      const queryTerm = (codeParam || idParam || 'yang dicari').trim();
      
      // Hide all ticket sections completely!
      if (successBanner) successBanner.style.setProperty('display', 'none', 'important');
      if (ticketCard) ticketCard.style.setProperty('display', 'none', 'important');
      if (trackerCard) trackerCard.style.setProperty('display', 'none', 'important');
      if (guideCard) guideCard.style.setProperty('display', 'none', 'important');
      if (helpSection) helpSection.style.setProperty('display', 'none', 'important');
      if (simulatorPanel) simulatorPanel.style.setProperty('display', 'none', 'important');

      // Show ONLY the clean Not Found State card
      if (notFoundEl) {
        notFoundEl.style.setProperty('display', 'block', 'important');
        if (notFoundCode) notFoundCode.textContent = queryTerm;
        const retryInput = document.getElementById('retry-search-input');
        if (retryInput) retryInput.value = queryTerm;
      }
      showToast('Pesanan dengan kode "' + queryTerm + '" tidak ditemukan!', 4000);
      return;
    }

    // ── Order Found: Show Normal Ticket Sections ────
    if (notFoundEl) notFoundEl.style.setProperty('display', 'none', 'important');
    if (successBanner) successBanner.style.setProperty('display', '', '');
    if (ticketCard) ticketCard.style.setProperty('display', '', '');
    if (trackerCard) trackerCard.style.setProperty('display', '', '');
    if (guideCard) guideCard.style.setProperty('display', '', '');
    if (helpSection) helpSection.style.setProperty('display', '', '');
    if (simulatorPanel) simulatorPanel.style.setProperty('display', '', '');

    currentOrder = order;
    currentOrderId = order.id || idParam;
    let cleanCode = order.order_code || (codeParam || 'ORD-042');
    if (cleanCode.startsWith('#')) cleanCode = cleanCode.substring(1);
    orderCode = cleanCode;
    const claimCodeVal = order.claim_code || cleanCode;

    // 1. Success Banner Sync
    const bannerDescCode = document.querySelector('.success-desc strong');
    if (bannerDescCode) bannerDescCode.textContent = '#' + cleanCode;

    const orderCodeChips = document.querySelectorAll('.success-banner-chips .chip-item strong');
    if (orderCodeChips.length > 0) orderCodeChips[0].textContent = '#' + cleanCode;
    if (orderCodeChips.length > 1) orderCodeChips[1].textContent = claimCodeVal;

    const totalStr = order.total_price ? formatRupiah(order.total_price) : (order.total || 'Rp 12.000');
    if (bannerTotal) bannerTotal.textContent = totalStr;
    if (orderTotal) orderTotal.textContent = totalStr;

    // 2. Ticket Card Sync
    if (claimCodeEl) claimCodeEl.textContent = claimCodeVal;

    const orderIdHighlight = document.querySelector('.order-id-highlight');
    if (orderIdHighlight) orderIdHighlight.textContent = '#' + cleanCode;

    const specCaption = document.querySelector('.ticket-spec-table caption');
    if (specCaption) specCaption.textContent = 'Rincian spesifikasi cetak untuk pesanan #' + cleanCode;

    const fn = order.file_name || order.filename || 'Dokumen.pdf';
    const spec = order.specifications || {};
    const paper = spec.paper_size || order.paper || 'A4';
    let color = spec.color_mode || order.color || 'Hitam & Putih';
    if (color === 'B/W' || color.toLowerCase().includes('black') || color.toLowerCase().includes('hitam')) {
      color = 'Hitam & Putih';
    } else if (color.toLowerCase().includes('color') || color.toLowerCase().includes('warna')) {
      color = 'Full Color';
    }
    const side = (spec.print_side || order.side || 'Simplex').includes('Duplex') ? 'Dua Sisi (Duplex)' : 'Satu Sisi (Simplex)';
    const pages = order.total_pages || order.pages || spec.sheets_count || 24;
    const copies = order.copies || 1;

    if (orderFilename) orderFilename.textContent = fn;
    if (orderPaper) orderPaper.textContent = paper;
    if (orderColor) orderColor.textContent = color;
    if (orderSide) orderSide.textContent = side;
    if (orderPages) orderPages.textContent = typeof pages === 'number' ? (pages + ' lembar') : pages;
    if (orderCopies) orderCopies.textContent = copies + ' salinan';

    // Download ticket action sync
    const btnDownloadTicket = document.querySelector('.ticket-actions-bar a[download]');
    if (btnDownloadTicket) {
      btnDownloadTicket.setAttribute('download', 'tiket-' + cleanCode + '.png');
    }

    // 3. Ready Alert Sync
    const readyAlert = document.querySelector('.tracker-ready-alert');
    if (readyAlert) {
      const readyStrong = readyAlert.querySelectorAll('strong');
      if (readyStrong.length > 0) readyStrong[0].textContent = '#' + cleanCode;
      if (readyStrong.length > 1) readyStrong[1].textContent = claimCodeVal;
    }

    // 4. Pickup Guide Step 3 Sync
    const pickupItems = document.querySelectorAll('.pickup-step-item');
    if (pickupItems.length >= 2) {
      const pStrong = pickupItems[1].querySelectorAll('strong');
      if (pStrong.length > 0) pStrong[0].textContent = '#' + cleanCode;
      if (pStrong.length > 1) pStrong[1].textContent = claimCodeVal;
    }

    const qPos = order.queuePosition ? ('No. ' + order.queuePosition + ' Antrean') : 'No. 2 Antrean';
    const eta = order.estimatedMinutes ? ('±' + order.estimatedMinutes + ' menit') : '±6 menit';

    applyStageUI(order.status || 'WAITING_IN_QUEUE', qPos, eta);
  }

  // ── Polling & Real-time Sync ──────────────────────
  function startAutoRefresh() {
    refreshSeconds = 5;
    if (refreshInterval) clearInterval(refreshInterval);

    refreshInterval = setInterval(async () => {
      refreshSeconds--;
      if (trackerCountdown) {
        trackerCountdown.textContent = 'Memperbarui dalam ' + refreshSeconds + ' dtk';
      }

      if (refreshSeconds <= 0) {
        refreshSeconds = 5;
        if (currentOrderId && window.PrintShopAPI) {
          try {
            const updated = await window.PrintShopAPI.getOrder(currentOrderId);
            if (updated && updated.status !== currentOrder?.status) {
              currentOrder = updated;
              applyStageUI(updated.status);
              showToast('Status pesanan diperbarui: ' + updated.status);
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
        showToast('Kode klaim ' + code + ' berhasil disalin!');
      }).catch(() => {
        showToast('Kode klaim: ' + code);
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
      showToast('Simulasi: status berubah menjadi "' + STAGES[nextStatus].label + '"');
    });
  }

  // Init
  document.addEventListener('DOMContentLoaded', () => {
    loadOrder();
    startAutoRefresh();
  });
})();
