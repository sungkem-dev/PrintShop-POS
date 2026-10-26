/**
 * PrintShop POS — Manual Walk-In Order Controller
 * File: assets/js/order-manual.js
 */

;(function () {
  'use strict';

  function formatRupiah(num) {
    return 'Rp' + Number(num || 0).toLocaleString('id-ID');
  }

  // ── Pricing Rate Matrix ───────────────────────────────────────────
  const RATE_MATRIX = {
    A4: { 'B/W': 500, 'Spot Color': 1200, 'Full Color': 2500 },
    'F4 / Folio': { 'B/W': 600, 'Spot Color': 1400, 'Full Color': 2800 },
    A3: { 'B/W': 1500, 'Spot Color': 3000, 'Full Color': 5500 }
  };

  const PAPER_EXTRA_RATES = {
    'HVS 70g': 0,
    'HVS 80g': 100,
    'Art Paper 150g': 1000
  };

  const FINISHING_RATES = {
    None: 0,
    Steples: 1000,
    Lakban: 3000,
    Spiral: 7000,
    SoftCover: 15000
  };

  let currentCalculatedTotal = 500;
  let targetOrderStatus = 'WAITING_IN_QUEUE';

  // ── Live Calculation Function ─────────────────────────────────────
  function calculateTotal() {
    const customerName = (document.getElementById('customer_name')?.value || '').trim();
    const fileName = (document.getElementById('file_name')?.value || '').trim();
    const paperSize = document.querySelector('input[name="paper_size"]:checked')?.value || 'A4';
    const colorMode = document.querySelector('input[name="color_mode"]:checked')?.value || 'B/W';
    const printSide = document.getElementById('print_side')?.value || 'Simplex';
    const paperType = document.getElementById('paper_type')?.value || 'HVS 70g';
    const finishing = document.getElementById('finishing')?.value || 'None';
    const totalPages = Math.max(1, parseInt(document.getElementById('total_pages')?.value, 10) || 1);
    const copies = Math.max(1, parseInt(document.getElementById('copies')?.value, 10) || 1);

    // Calculate base rate per page
    const baseRates = RATE_MATRIX[paperSize] || RATE_MATRIX['A4'];
    let ratePerPage = baseRates[colorMode] || 500;

    // Duplex discount 10% on print rate
    if (printSide === 'Duplex') {
      ratePerPage = Math.round(ratePerPage * 0.9);
    }

    // Number of physical sheets
    const sheetsPerPage = printSide === 'Duplex' ? Math.ceil(totalPages / 2) : totalPages;
    const totalSheets = sheetsPerPage * copies;

    // Subtotal calculations
    const printSubtotal = ratePerPage * totalPages * copies;
    const paperExtraRate = PAPER_EXTRA_RATES[paperType] || 0;
    const paperSubtotal = paperExtraRate * totalSheets;
    const finishingRate = FINISHING_RATES[finishing] || 0;
    const finishingSubtotal = finishingRate * copies;

    currentCalculatedTotal = printSubtotal + paperSubtotal + finishingSubtotal;

    // ── Update Right-side Receipt Summary UI ─────────
    const summaryCustomer = document.getElementById('summary-customer-name');
    const summaryFile = document.getElementById('summary-file-name');
    const summaryFormat = document.getElementById('summary-format');
    const summaryVolume = document.getElementById('summary-volume');
    const summaryFinishing = document.getElementById('summary-finishing');
    const summaryRate = document.getElementById('summary-rate');
    const summaryPrintSubtotal = document.getElementById('summary-print-subtotal');
    const summaryExtraSubtotal = document.getElementById('summary-extra-subtotal');
    const summaryTotal = document.getElementById('summary-total-price');

    if (summaryCustomer) summaryCustomer.textContent = customerName || 'Tamu Walk-In';
    if (summaryFile) summaryFile.textContent = fileName || 'Dokumen Tanpa Judul';
    if (summaryFormat) summaryFormat.textContent = `${paperSize} • ${colorMode} (${printSide})`;
    if (summaryVolume) summaryVolume.textContent = `${totalPages} Hal × ${copies} Copy (${totalSheets} lbr)`;

    const finishingLabels = {
      None: 'Tanpa Jilid',
      Steples: 'Steples',
      Lakban: 'Jilid Lakban',
      Spiral: 'Jilid Spiral',
      SoftCover: 'Jilid Soft Cover'
    };
    if (summaryFinishing) summaryFinishing.textContent = finishingLabels[finishing] || 'Tanpa Jilid';

    if (summaryRate) summaryRate.textContent = `${formatRupiah(ratePerPage)} / hlm`;
    if (summaryPrintSubtotal) summaryPrintSubtotal.textContent = formatRupiah(printSubtotal);
    if (summaryExtraSubtotal) summaryExtraSubtotal.textContent = formatRupiah(paperSubtotal + finishingSubtotal);
    if (summaryTotal) summaryTotal.textContent = formatRupiah(currentCalculatedTotal);

    // Update Change calculation
    updateChangeDisplay();
  }

  // ── Cash Change Calculator ─────────────────────────────────────────
  function updateChangeDisplay() {
    const cashInput = document.getElementById('cash_received');
    const changeBox = document.getElementById('change-display');
    const changeAmount = document.getElementById('change-amount');
    if (!cashInput || !changeBox || !changeAmount) return;

    const cashVal = parseFloat(cashInput.value);
    if (isNaN(cashVal) || cashVal === 0) {
      changeBox.classList.remove('shortage');
      changeAmount.textContent = formatRupiah(0);
      return;
    }

    const diff = cashVal - currentCalculatedTotal;
    if (diff < 0) {
      changeBox.classList.add('shortage');
      changeAmount.textContent = `Kurang ${formatRupiah(Math.abs(diff))}`;
    } else {
      changeBox.classList.remove('shortage');
      changeAmount.textContent = formatRupiah(diff);
    }
  }

  // ── Main Init ──────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    // 1. Session & Auth Guard
    const session = window.PrintShopAPI ? window.PrintShopAPI.getOperatorSession() : null;
    if (!session) {
      window.location.href = 'login.html';
      return;
    }

    // Set operator name
    const userNameEl = document.querySelector('.console-user-name');
    const userRoleEl = document.querySelector('.console-user-role');
    const userAvatarEl = document.querySelector('.console-user-avatar');

    if (userNameEl) userNameEl.textContent = session.name || 'Ahmad Hidayat';
    if (userRoleEl) userRoleEl.innerHTML = `${session.role || 'Kasir Loket A1'} &bull; Online`;
    if (userAvatarEl && session.name) {
      userAvatarEl.textContent = session.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    }

    // Logout
    const logoutBtn = document.querySelector('.console-logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function (e) {
        e.preventDefault();
        if (confirm('Keluar dari konsol operator?')) {
          if (window.PrintShopAPI) window.PrintShopAPI.logoutOperator();
        }
      });
    }

    // 2. Live Clock
    const clockEl = document.getElementById('live-clock');
    function updateClock() {
      if (!clockEl) return;
      const now = new Date();
      clockEl.textContent = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} WIB`;
    }
    updateClock();
    setInterval(updateClock, 10000);

    // 3. Mobile Sidebar Toggle
    const toggleBtn = document.getElementById('btn-sidebar-toggle');
    const sidebar = document.getElementById('console-sidebar');
    const backdrop = document.getElementById('console-backdrop');

    if (toggleBtn && sidebar && backdrop) {
      toggleBtn.addEventListener('click', function () {
        sidebar.classList.toggle('is-open');
        backdrop.classList.toggle('is-open');
      });

      backdrop.addEventListener('click', function () {
        sidebar.classList.remove('is-open');
        backdrop.classList.remove('is-open');
      });
    }

    // 4. Attach Listeners for Calculation
    const form = document.getElementById('pos-manual-order-form');
    if (form) {
      const inputsToListen = form.querySelectorAll('input, select, textarea');
      inputsToListen.forEach(el => {
        el.addEventListener('input', calculateTotal);
        el.addEventListener('change', calculateTotal);
      });
    }

    // Cash received inputs & quick buttons
    const cashInput = document.getElementById('cash_received');
    if (cashInput) {
      cashInput.addEventListener('input', updateChangeDisplay);
    }

    const btnExactCash = document.getElementById('btn-exact-cash');
    if (btnExactCash) {
      btnExactCash.addEventListener('click', function () {
        if (cashInput) {
          cashInput.value = currentCalculatedTotal;
          updateChangeDisplay();
        }
      });
    }

    document.querySelectorAll('.btn-quick-cash[data-amount]').forEach(btn => {
      btn.addEventListener('click', function () {
        if (cashInput) {
          cashInput.value = this.dataset.amount;
          updateChangeDisplay();
        }
      });
    });

    // Payment method toggle visibility
    const paymentRadios = document.querySelectorAll('input[name="payment_method"]');
    const cashCalcWrap = document.getElementById('cash-calculator-wrap');
    paymentRadios.forEach(radio => {
      radio.addEventListener('change', function () {
        if (cashCalcWrap) {
          cashCalcWrap.style.display = this.value === 'CASH' ? 'block' : 'none';
        }
      });
    });

    // 5. Submit Handlers
    const btnDirectPrint = document.getElementById('btn-submit-direct-print');
    if (btnDirectPrint) {
      btnDirectPrint.addEventListener('click', function () {
        targetOrderStatus = 'PRINTING';
        if (form.reportValidity()) {
          form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        }
      });
    }

    const btnQueueSubmit = document.getElementById('btn-submit-queue');
    if (btnQueueSubmit) {
      btnQueueSubmit.addEventListener('click', function () {
        targetOrderStatus = 'WAITING_IN_QUEUE';
      });
    }

    if (form) {
      form.addEventListener('submit', async function (e) {
        e.preventDefault();

        const customerName = document.getElementById('customer_name').value.trim();
        const customerPhone = document.getElementById('customer_phone').value.trim();
        const fileName = document.getElementById('file_name').value.trim();
        const paperSize = document.querySelector('input[name="paper_size"]:checked')?.value || 'A4';
        const colorMode = document.querySelector('input[name="color_mode"]:checked')?.value || 'B/W';
        const printSide = document.getElementById('print_side').value;
        const paperType = document.getElementById('paper_type').value;
        const finishing = document.getElementById('finishing').value;
        const totalPages = Math.max(1, parseInt(document.getElementById('total_pages').value, 10) || 1);
        const copies = Math.max(1, parseInt(document.getElementById('copies').value, 10) || 1);
        const notes = document.getElementById('operator_notes').value.trim();
        const paymentMethod = document.querySelector('input[name="payment_method"]:checked')?.value || 'CASH';

        // Calculate sheets count
        const sheetsPerPage = printSide === 'Duplex' ? Math.ceil(totalPages / 2) : totalPages;
        const sheetsCount = sheetsPerPage * copies;

        const payload = {
          customer_name: customerName,
          customer_phone: customerPhone || null,
          file_name: fileName,
          file_size: totalPages * 120000,
          file_url: '/assets/sample-docs/manual-walkin.pdf',
          total_pages: totalPages,
          copies: copies,
          total_price: currentCalculatedTotal,
          status: targetOrderStatus,
          payment_method: paymentMethod,
          specifications: {
            paper_size: paperSize,
            color_mode: colorMode,
            print_side: printSide,
            paper_type: paperType,
            finishing: finishing,
            sheets_count: sheetsCount,
            notes: notes ? `[Walk-In POS] ${notes}` : '[Walk-In POS]'
          }
        };

        // Disable submit button while saving
        const submitBtn = document.getElementById('btn-submit-queue');
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Menyimpan pesanan...';
        }

        try {
          let createdOrder = null;
          if (window.PrintShopAPI) {
            createdOrder = await window.PrintShopAPI.createOrder(payload);
          }

          const orderCode = createdOrder?.order_code || `ORD-${Math.floor(Math.random() * 900) + 100}`;

          // Show success modal
          const modal = document.getElementById('modal-order-success');
          if (modal) {
            document.getElementById('success-order-code').textContent = `#${orderCode}`;
            document.getElementById('success-customer-name').textContent = customerName;
            document.getElementById('success-file-name').textContent = fileName;
            document.getElementById('success-pages').textContent = `${totalPages} hal × ${copies} copy (${sheetsCount} lembar)`;
            document.getElementById('success-payment-method').textContent = paymentMethod === 'CASH' ? 'Tunai (Lunas di Kasir)' : (paymentMethod === 'QRIS' ? 'QRIS Kasir' : 'Bayar Saat Ambil');
            document.getElementById('success-total-price').textContent = formatRupiah(currentCalculatedTotal);

            const statusNote = document.getElementById('success-status-note');
            if (statusNote) {
              statusNote.textContent = targetOrderStatus === 'PRINTING'
                ? 'Pesanan langsung diteruskan ke mesin printer untuk dicetak.'
                : 'Pesanan telah masuk ke dalam antrean cetak aktif.';
            }

            modal.style.display = 'flex';
          } else {
            alert(`Pesanan #${orderCode} berhasil disimpan ke antrean cetak!`);
            window.location.href = 'antrean.html';
          }
        } catch (err) {
          alert('Gagal menyimpan pesanan: ' + err.message);
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Simpan & Masukkan Antrean';
          }
        }
      });
    }

    // Modal Add Another Order button
    const btnAddAnother = document.getElementById('btn-add-another-order');
    if (btnAddAnother) {
      btnAddAnother.addEventListener('click', function () {
        const modal = document.getElementById('modal-order-success');
        if (modal) modal.style.display = 'none';
        if (form) form.reset();
        calculateTotal();
      });
    }

    // Initial calculation
    calculateTotal();
  });
})();
