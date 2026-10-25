/**
 * PrintShop POS — Dynamic Price Calculator & Specification Flow
 * File   : assets/js/pricing-calc.js
 */

;(function () {
  'use strict';

  // ── Tarif ──────────────────────────────────────────
  const RATES = {
    paper: { A4: 500, F4: 600, A3: 1000 },
    color: 2000,   // tambahan per lembar untuk Full Color
    duplex: 900    // tambahan per lembar fisik untuk Duplex
  };

  // ── DOM References ─────────────────────────────────
  const form            = document.getElementById('form-spesifikasi');
  const docFilenameEl   = document.getElementById('doc-filename');
  const docTotalEl      = document.getElementById('doc-total-pages');
  let totalDocPages     = docTotalEl ? parseInt(docTotalEl.dataset.total, 10) || 24 : 24;

  // Radio groups
  const paperRadios     = form ? form.querySelectorAll('input[name="ukuran-kertas"]') : [];
  const colorRadios     = form ? form.querySelectorAll('input[name="mode-warna"]') : [];
  const sideRadios      = form ? form.querySelectorAll('input[name="sisi-cetak"]') : [];
  const rangeRadios     = form ? form.querySelectorAll('input[name="rentang-halaman"]') : [];

  // Stepper
  const copiesInput     = document.getElementById('jumlah-salinan');
  const btnMinus        = document.getElementById('btn-copies-minus');
  const btnPlus         = document.getElementById('btn-copies-plus');

  // Page range
  const customRangeWrap = document.getElementById('custom-range-wrap');
  const customRangeInput = document.getElementById('halaman-custom');
  const rangeError      = document.getElementById('range-error');
  const rangeErrorMsg   = document.getElementById('range-error-msg');

  // Eco badge
  const ecoBadge        = document.getElementById('eco-badge');
  const ecoPagesInfo    = document.getElementById('eco-pages-info');
  const ecoSheetsInfo   = document.getElementById('eco-sheets-info');

  // Summary sidebar
  const sumPaper        = document.getElementById('sum-paper');
  const sumColor        = document.getElementById('sum-color');
  const sumSide         = document.getElementById('sum-side');
  const sumPages        = document.getElementById('sum-pages');
  const sumSheets       = document.getElementById('sum-sheets');
  const sumCopies       = document.getElementById('sum-copies');
  const sumBasePrice    = document.getElementById('sum-base-price');
  const sumColorRow     = document.getElementById('sum-color-row');
  const sumColorPrice   = document.getElementById('sum-color-price');
  const sumDuplexRow    = document.getElementById('sum-duplex-row');
  const sumDuplexPrice  = document.getElementById('sum-duplex-price');
  const sumTotal        = document.getElementById('sum-total');

  // Textarea counter
  const notesTextarea   = document.getElementById('catatan');
  const notesCounter    = document.getElementById('catatan-counter');

  // Range labels
  const rangeAllLabel   = document.getElementById('range-all-label');
  const rangeMaxHint    = document.getElementById('range-max-hint');

  let currentOrderId    = null;
  let currentOrderData  = null;

  // ── Helpers ────────────────────────────────────────

  function formatRupiah(num) {
    return 'Rp ' + num.toLocaleString('id-ID');
  }

  function getRadioValue(name) {
    if (!form) return null;
    const checked = form.querySelector('input[name="' + name + '"]:checked');
    return checked ? checked.value : null;
  }

  function showRangeError(msg) {
    if (rangeErrorMsg) rangeErrorMsg.textContent = msg;
    if (rangeError) rangeError.style.display = 'block';
  }

  function hideRangeError() {
    if (rangeError) rangeError.style.display = 'none';
    if (customRangeInput) customRangeInput.classList.remove('input-error');
  }

  function parsePageRange(input, maxPage) {
    const trimmed = input.trim();
    if (!trimmed) {
      return { valid: false, pages: [], error: 'Silakan masukkan rentang halaman.' };
    }

    if (!/^[\d\s,\-–—]+$/.test(trimmed)) {
      return { valid: false, pages: [], error: 'Karakter tidak valid. Gunakan angka, tanda hubung (-), dan koma (,).' };
    }

    const pages = new Set();
    const normalized = trimmed.replace(/[–—]/g, '-');
    const parts = normalized.split(',');

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i].trim();
      if (!part) continue;

      if (part.includes('-')) {
        const rangeParts = part.split('-').map(s => s.trim());
        if (rangeParts.length !== 2) {
          return { valid: false, pages: [], error: 'Format rentang "' + part + '" tidak valid. Gunakan format: 1-5' };
        }
        const start = parseInt(rangeParts[0], 10);
        const end = parseInt(rangeParts[1], 10);
        if (isNaN(start) || isNaN(end)) {
          return { valid: false, pages: [], error: 'Angka tidak valid pada rentang "' + part + '".' };
        }
        if (start < 1 || end < 1) {
          return { valid: false, pages: [], error: 'Nomor halaman harus mulai dari 1.' };
        }
        if (start > end) {
          return { valid: false, pages: [], error: 'Rentang "' + part + '" salah — angka awal harus <= angka akhir.' };
        }
        if (end > maxPage) {
          return { valid: false, pages: [], error: 'Halaman ' + end + ' melebihi total halaman dokumen (' + maxPage + ').' };
        }
        for (let p = start; p <= end; p++) {
          pages.add(p);
        }
      } else {
        const pageNum = parseInt(part, 10);
        if (isNaN(pageNum)) {
          return { valid: false, pages: [], error: 'Angka "' + part + '" tidak valid.' };
        }
        if (pageNum < 1) {
          return { valid: false, pages: [], error: 'Nomor halaman harus mulai dari 1.' };
        }
        if (pageNum > maxPage) {
          return { valid: false, pages: [], error: 'Halaman ' + pageNum + ' melebihi total halaman dokumen (' + maxPage + ').' };
        }
        pages.add(pageNum);
      }
    }

    if (pages.size === 0) {
      return { valid: false, pages: [], error: 'Tidak ada halaman yang dipilih.' };
    }

    return { valid: true, pages: Array.from(pages).sort((a, b) => a - b), error: null };
  }

  // ── Main Calculation ────────────────────────────────

  function calculate() {
    if (!form) return;

    const paperKey   = getRadioValue('ukuran-kertas') || 'A4';
    const colorKey   = getRadioValue('mode-warna')    || 'bw';
    const sideKey    = getRadioValue('sisi-cetak')     || 'simplex';
    const rangeMode  = getRadioValue('rentang-halaman')|| 'all';
    const copies     = parseInt(copiesInput ? copiesInput.value : 1, 10) || 1;

    let activePages = totalDocPages;

    if (rangeMode === 'custom') {
      if (customRangeWrap) customRangeWrap.classList.add('visible');
      const parsed = parsePageRange(customRangeInput ? customRangeInput.value : '', totalDocPages);
      if (parsed.valid) {
        activePages = parsed.pages.length;
        hideRangeError();
      } else {
        if (customRangeInput && customRangeInput.value.trim() !== '') {
          showRangeError(parsed.error);
        }
        activePages = 0;
      }
    } else {
      if (customRangeWrap) customRangeWrap.classList.remove('visible');
      hideRangeError();
      activePages = totalDocPages;
    }

    // Physical sheets calculation
    let physicalSheets = activePages;
    const isDuplex = (sideKey || '').toLowerCase() === 'duplex';
    if (isDuplex) {
      physicalSheets = Math.ceil(activePages / 2);
    }

    // Eco badge
    if (isDuplex && activePages > 1) {
      if (ecoBadge) ecoBadge.style.display = 'flex';
      if (ecoPagesInfo) ecoPagesInfo.textContent = activePages;
      if (ecoSheetsInfo) ecoSheetsInfo.textContent = physicalSheets;
    } else {
      if (ecoBadge) ecoBadge.style.display = 'none';
    }

    // Pricing rates
    const baseRatePerSheet = RATES.paper[paperKey] || 500;
    const isColor          = (colorKey || '').toLowerCase() === 'color';

    const colorRatePerSheet  = isColor ? RATES.color : 0;
    const duplexRatePerSheet = isDuplex ? RATES.duplex : 0;

    const pricePerSheet = baseRatePerSheet + colorRatePerSheet + duplexRatePerSheet;
    const totalEstimate = physicalSheets * pricePerSheet * copies;

    // Sidebar Summary updates
    if (sumPaper) sumPaper.textContent = paperKey;
    if (sumColor) sumColor.textContent = isColor ? 'Full Color' : 'Hitam & Putih';
    if (sumSide)  sumSide.textContent  = isDuplex ? 'Duplex (Bolak-balik)' : 'Simplex (Satu Sisi)';
    if (sumPages) sumPages.textContent = activePages + ' halaman';
    if (sumSheets)sumSheets.textContent= (physicalSheets * copies) + ' lbr fisik';
    if (sumCopies)sumCopies.textContent= copies + 'x';

    if (sumBasePrice) sumBasePrice.textContent = formatRupiah(baseRatePerSheet);

    if (sumColorRow && sumColorPrice) {
      if (isColor) {
        sumColorRow.style.display = 'flex';
        sumColorPrice.textContent = '+' + formatRupiah(colorRatePerSheet);
      } else {
        sumColorRow.style.display = 'none';
      }
    }

    if (sumDuplexRow && sumDuplexPrice) {
      if (isDuplex) {
        sumDuplexRow.style.display = 'flex';
        sumDuplexPrice.textContent = '+' + formatRupiah(duplexRatePerSheet);
      } else {
        sumDuplexRow.style.display = 'none';
      }
    }

    if (sumTotal) sumTotal.textContent = formatRupiah(totalEstimate);

    return {
      paperKey,
      isColor,
      isDuplex,
      copies,
      activePages,
      physicalSheets,
      totalEstimate
    };
  }

  // ── Load Dynamic Order Data ─────────────────────────

  async function loadOrderContext() {
    const params = new URLSearchParams(window.location.search);
    currentOrderId = params.get('order_id') || params.get('id');

    if (currentOrderId && window.PrintShopAPI) {
      try {
        currentOrderData = await window.PrintShopAPI.getOrder(currentOrderId);
      } catch (e) {
        console.warn('Could not load order by ID:', e);
      }
    }

    // Fallback to sessionStorage
    if (!currentOrderData) {
      try {
        const raw = sessionStorage.getItem('printshop_order');
        if (raw) currentOrderData = JSON.parse(raw);
      } catch (e) {}
    }

    if (currentOrderData) {
      if (currentOrderData.id) currentOrderId = currentOrderData.id;

      const filename = currentOrderData.file_name || currentOrderData.filename || 'Dokumen.pdf';
      const pages = Number(currentOrderData.total_pages || currentOrderData.pagesNum || parseInt(currentOrderData.pages, 10)) || 24;

      if (docFilenameEl) docFilenameEl.textContent = filename;
      if (docTotalEl) {
        docTotalEl.dataset.total = pages;
        docTotalEl.textContent = `${pages} halaman`;
      }
      totalDocPages = pages;

      if (rangeAllLabel) rangeAllLabel.textContent = `Halaman 1 – ${pages}`;
      if (rangeMaxHint) rangeMaxHint.textContent = pages;
    }

    calculate();
  }

  // ── Event Listeners ─────────────────────────────────

  if (form) {
    [paperRadios, colorRadios, sideRadios, rangeRadios].forEach(group => {
      group.forEach(radio => {
        radio.addEventListener('change', calculate);
      });
    });

    if (customRangeInput) {
      customRangeInput.addEventListener('input', calculate);
    }

    if (btnMinus && copiesInput) {
      btnMinus.addEventListener('click', function () {
        let val = parseInt(copiesInput.value, 10) || 1;
        if (val > 1) {
          copiesInput.value = val - 1;
          calculate();
        }
      });
    }

    if (btnPlus && copiesInput) {
      btnPlus.addEventListener('click', function () {
        let val = parseInt(copiesInput.value, 10) || 1;
        if (val < 50) {
          copiesInput.value = val + 1;
          calculate();
        }
      });
    }

    if (copiesInput) {
      copiesInput.addEventListener('input', function () {
        let val = parseInt(copiesInput.value, 10);
        if (isNaN(val) || val < 1) copiesInput.value = 1;
        else if (val > 50) copiesInput.value = 50;
        calculate();
      });
    }

    if (notesTextarea && notesCounter) {
      notesTextarea.addEventListener('input', function () {
        notesCounter.textContent = notesTextarea.value.length + ' / 200 karakter';
      });
    }

    // Submit handler: Save to Supabase database & transition to pembayaran.html
    form.addEventListener('submit', async function (e) {
      e.preventDefault();

      const calcResult = calculate();
      if (!calcResult || calcResult.activePages === 0) {
        alert('Rentang halaman tidak valid.');
        return;
      }

      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Menyimpan Spesifikasi...';
      }

      const paperVal = getRadioValue('ukuran-kertas') || 'A4';
      const colorVal = (getRadioValue('mode-warna') || '').toLowerCase() === 'color' ? 'Color' : 'B/W';
      const sideVal  = (getRadioValue('sisi-cetak') || '').toLowerCase() === 'duplex' ? 'Duplex' : 'Simplex';
      const rangeVal = getRadioValue('rentang-halaman') === 'custom' ? (customRangeInput?.value || 'custom') : 'all';
      const notesVal = notesTextarea?.value || '';

      const specData = {
        paper_size: paperVal,
        color_mode: colorVal,
        print_side: sideVal,
        page_range: rangeVal,
        sheets_count: calcResult.physicalSheets,
        notes: notesVal
      };

      try {
        let order = null;
        const isUuid = id => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id || ''));
        const orderPayload = {
          customer_name: currentOrderData?.customer_name || 'Mahasiswa',
          customer_phone: currentOrderData?.customer_phone || null,
          file_name: docFilenameEl ? docFilenameEl.textContent.trim() : (currentOrderData?.file_name || currentOrderData?.filename || 'Dokumen.pdf'),
          copies: calcResult.copies,
          total_pages: calcResult.activePages,
          total_price: calcResult.totalEstimate,
          status: 'PENDING_PAYMENT',
          specifications: specData
        };

        if (window.PrintShopAPI) {
          if (currentOrderId && isUuid(currentOrderId)) {
            order = await window.PrintShopAPI.updateOrder(currentOrderId, orderPayload);
          } else {
            order = await window.PrintShopAPI.createOrder(orderPayload);
          }
        }

        const finalOrderId = order?.id || currentOrderId;
        const finalOrderCode = order?.order_code || currentOrderData?.order_code || 'ORD-042';

        // Update sessionStorage
        const sessionPayload = {
          id: finalOrderId,
          order_code: finalOrderCode,
          customer_name: order?.customer_name || orderPayload.customer_name,
          customer_phone: order?.customer_phone || orderPayload.customer_phone,
          file_name: orderPayload.file_name,
          filename: orderPayload.file_name,
          total_pages: calcResult.activePages,
          total_price: calcResult.totalEstimate,
          paper: paperVal,
          color: colorVal === 'Color' ? 'Full Color' : 'Hitam & Putih',
          side: sideVal === 'Duplex' ? 'Duplex' : 'Simplex',
          pages: `${calcResult.activePages} hal`,
          sheets: `${calcResult.physicalSheets} lbr`,
          copies: `${calcResult.copies}x`,
          pricePer: formatRupiah(RATES.paper[paperVal] + (colorVal === 'Color' ? 2000 : 0) + (sideVal === 'Duplex' ? 900 : 0)),
          total: formatRupiah(calcResult.totalEstimate),
          totalNum: calcResult.totalEstimate,
          specifications: specData
        };
        sessionStorage.setItem('printshop_order', JSON.stringify(sessionPayload));

        const targetUrl = finalOrderId
          ? `pembayaran.html?order_id=${encodeURIComponent(finalOrderId)}`
          : 'pembayaran.html';

        window.location.href = targetUrl;
      } catch (err) {
        console.error('Error saving specs:', err);
        window.location.href = 'pembayaran.html';
      }
    });
  }

  // Initialize
  document.addEventListener('DOMContentLoaded', loadOrderContext);

})();
