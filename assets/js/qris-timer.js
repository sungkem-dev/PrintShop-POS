/**
 * PrintShop POS — Midtrans QRIS & Multi-Method Snap Payment Flow
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
  let currentQrUrl = '';
  let currentQrString = '';
  let currentSnapToken = '';
  let currentRedirectUrl = '';

  // DOM References
  const countdownEl     = document.getElementById('countdown');
  const progressBar     = document.getElementById('progress-bar');
  const statusBadge     = document.getElementById('status-badge');
  const statusDot       = document.getElementById('status-dot');
  const statusText      = document.getElementById('status-text');
  const expiredAlert    = document.getElementById('expired-alert');
  const paidAlert       = document.getElementById('paid-alert');
  const qrImage         = document.getElementById('qr-image') || document.getElementById('qris-image');
  const qrOverlayExp    = document.getElementById('qr-overlay-expired');
  const qrOverlayPaid   = document.getElementById('qr-overlay-paid');
  const btnSnapPay      = document.getElementById('btn-snap-pay');
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

  function showToast(message, duration = 3500) {
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
      const pagesNum = Number(currentOrder.total_pages || parseInt(currentOrder.pages, 10)) || 24;
      const isDuplex = String(side).toLowerCase().includes('duplex');
      const sheetsNum = Number(spec.sheets_count || parseInt(currentOrder.sheets, 10)) || (isDuplex ? Math.ceil(pagesNum / 2) : pagesNum);
      const copiesNum = Number(currentOrder.copies || parseInt(currentOrder.copies, 10)) || 1;

      const basePaperRate = paper === 'A3' ? 1000 : (paper === 'F4' ? 600 : 500);
      const isColor = String(color).toLowerCase().includes('color');
      const calcPricePerSheet = basePaperRate + (isColor ? 2000 : 0) + (isDuplex ? 900 : 0);
      const totalNum = Number(currentOrder.total_price || currentOrder.totalNum) || (sheetsNum * copiesNum * calcPricePerSheet);
      const totalFormatted = formatRupiah(totalNum);

      if (payFilename) payFilename.textContent = fn;
      if (payPaper) payPaper.textContent = paper;
      if (payColor) payColor.textContent = isColor ? 'Full Color' : 'Hitam & Putih';
      if (paySide) paySide.textContent = isDuplex ? 'Duplex' : 'Simplex';
      if (payPages) payPages.textContent = `${pagesNum} hal`;
      if (paySheets) paySheets.textContent = `${sheetsNum * copiesNum} lbr`;
      if (payCopies) payCopies.textContent = `${copiesNum}×`;
      if (payPricePer) payPricePer.textContent = currentOrder.pricePer || formatRupiah(calcPricePerSheet);
      if (payTotal) payTotal.textContent = totalFormatted;
      if (qrAmount) qrAmount.textContent = totalFormatted;
    }

    // Call Midtrans API for official QRIS & Snap Token payload
    await initMidtransPayment();
  }

  // ── Midtrans Payment Generation (Official QR URL & Snap Token) ──

  async function initMidtransPayment() {
    if (!window.PrintShopAPI) return;

    try {
      const result = await window.PrintShopAPI.createPayment(currentOrderId, currentOrder);
      if (result) {
        if (result.orderId && result.orderId !== currentOrderId) {
          currentOrderId = result.orderId;
          if (currentOrder) {
            currentOrder.id = result.orderId;
            currentOrder.order_code = result.orderCode || currentOrder.order_code;
            sessionStorage.setItem('printshop_order', JSON.stringify(currentOrder));
          }
          const newUrl = `${window.location.pathname}?order_id=${encodeURIComponent(currentOrderId)}`;
          window.history.replaceState({}, '', newUrl);
        }

        const p = result.payment || result;
        const qrUrl = result.qr_url || result.qrUrl || p.qr_url || p.qrUrl;
        const qrString = result.qr_string || result.qrString || p.qr_string || p.qrString;
        const snapToken = result.snap_token || result.snapToken || p.snap_token || p.snapToken;
        const redirectUrl = result.redirect_url || result.redirectUrl || p.redirect_url || p.redirectUrl;

        if (qrUrl) {
          currentQrUrl = qrUrl;
          if (qrImage) {
            qrImage.src = qrUrl;
            qrImage.alt = `QRIS Resmi Midtrans (${p.midtransOrderId || ''})`;
          }
        }
        if (qrString) {
          currentQrString = qrString;
        }
        if (snapToken) {
          currentSnapToken = snapToken;
        }
        if (redirectUrl) {
          currentRedirectUrl = redirectUrl;
        }
        if (p.grossAmount && qrAmount) {
          qrAmount.textContent = formatRupiah(p.grossAmount);
        }

        showToast('QRIS & Metode Pembayaran Midtrans siap digunakan!');
      }
    } catch (err) {
      console.error('Midtrans payment init failed:', err);
      showToast('Error Midtrans: ' + (err.message || 'Gagal memuat pembayaran'), 5000);
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
          handlePaidSuccess(res.orderCode);
        }
      } catch (e) {
        // Silent ignore
      }
    }, 3000);
  }

  // ── Payment Success Handler ─────────────────────────

  function handlePaidSuccess(resolvedOrderCode) {
    if (paymentState === 'PAID') return;
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

    if (btnSnapPay) btnSnapPay.disabled = true;
    if (btnSimulate) {
      btnSimulate.disabled = true;
      btnSimulate.textContent = 'Pembayaran Lunas ✓';
    }
    if (btnSaveQr) btnSaveQr.disabled = true;

    showToast('Pembayaran lunas! Pesanan masuk antrean cetak...');

    const orderCode = resolvedOrderCode || currentOrder?.order_code || 'ORD-042';
    const redirectUrl = currentOrderId
      ? `tiket.html?order_id=${encodeURIComponent(currentOrderId)}&code=${encodeURIComponent(orderCode)}`
      : `tiket.html?code=${encodeURIComponent(orderCode)}`;

    setTimeout(() => {
      window.location.href = redirectUrl;
    }, 1500);
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
    if (btnSnapPay) btnSnapPay.disabled = true;
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

  // 1. Official Midtrans Snap Multi-Method Popup Button
  if (btnSnapPay) {
    btnSnapPay.addEventListener('click', async function () {
      if (!currentSnapToken) {
        btnSnapPay.disabled = true;
        const prevText = btnSnapPay.textContent;
        btnSnapPay.textContent = 'Menyiapkan Metode Pembayaran Midtrans...';
        await initMidtransPayment();
        btnSnapPay.disabled = false;
        btnSnapPay.textContent = prevText;
      }

      if (window.snap && typeof window.snap.pay === 'function' && currentSnapToken) {
        window.snap.pay(currentSnapToken, {
          onSuccess: async function (result) {
            console.log('[Midtrans Snap] Payment Success:', result);
            showToast('Pembayaran berhasil! Memperbarui status transaksi & antrean...');
            let settledOrder = null;
            if (currentOrderId && window.PrintShopAPI) {
              try {
                settledOrder = await window.PrintShopAPI.simulatePaymentSuccess(currentOrderId, result);
              } catch (e) {
                console.warn('Error updating status after Snap onSuccess:', e);
              }
            }
            handlePaidSuccess(settledOrder?.order_code);
          },
          onPending: function (result) {
            console.log('[Midtrans Snap] Payment Pending:', result);
            showToast('Menunggu pembayaran diselesaikan. Sistem memantau status otomatis...');
            startStatusPolling();
          },
          onError: function (result) {
            console.error('[Midtrans Snap] Payment Error:', result);
            showToast('Pembayaran gagal diproses. Silakan coba lagi.');
          },
          onClose: function () {
            showToast('Jendela pilihan metode pembayaran ditutup.');
          }
        });
      } else if (currentRedirectUrl) {
        window.open(currentRedirectUrl, '_blank');
      } else {
        showToast('Token Midtrans Snap belum tersedia, silakan muat ulang halaman.');
      }
    });
  }

  // 2. Sandbox Simulate Paid Button
  if (btnSimulate) {
    btnSimulate.addEventListener('click', async function () {
      btnSimulate.disabled = true;
      btnSimulate.textContent = 'Memverifikasi & Memasukkan ke Antrean...';

      let settledOrder = null;
      if (currentOrderId && window.PrintShopAPI) {
        try {
          settledOrder = await window.PrintShopAPI.simulatePaymentSuccess(currentOrderId);
        } catch (e) {
          console.warn('Simulation error:', e);
        }
      }
      handlePaidSuccess(settledOrder?.order_code);
    });
  }

  // 4. Reload QRIS Button
  if (btnReloadQr) {
    btnReloadQr.addEventListener('click', function () {
      paymentState = 'PENDING_PAYMENT';
      if (qrOverlayExp) qrOverlayExp.classList.remove('visible');
      if (expiredAlert) expiredAlert.classList.remove('visible');
      if (btnReloadQr) btnReloadQr.classList.remove('visible');
      if (btnSnapPay) btnSnapPay.disabled = false;
      if (btnSimulate) {
        btnSimulate.disabled = false;
        btnSimulate.textContent = 'Simulasi Bayar Lunas (Sandbox Test)';
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

  // 5. Save QR Image Button
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
