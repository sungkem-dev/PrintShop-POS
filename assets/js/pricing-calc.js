/**
 * ═══════════════════════════════════════════════════════
 *  PrintShop POS — Live Dynamic Price Calculator
 *  File   : assets/js/pricing-calc.js
 *  Author : Ryan Ramadhan (Kelompok 2 — Divisi Web UI/UX)
 * ═══════════════════════════════════════════════════════
 *
 *  Tarif:
 *    Ukuran Kertas : A4 = Rp 500, F4 = Rp 600, A3 = Rp 1.000
 *    Full Color    : +Rp 2.000 per lembar fisik
 *    Duplex        : +Rp 900 per lembar fisik
 *
 *  Lembar fisik duplex: Math.ceil(totalPages / 2)
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
  const docTotalEl      = document.getElementById('doc-total-pages');
  const totalDocPages   = docTotalEl ? parseInt(docTotalEl.dataset.total, 10) || 24 : 24;

  // Radio groups
  const paperRadios     = form.querySelectorAll('input[name="ukuran-kertas"]');
  const colorRadios     = form.querySelectorAll('input[name="mode-warna"]');
  const sideRadios      = form.querySelectorAll('input[name="sisi-cetak"]');
  const rangeRadios     = form.querySelectorAll('input[name="rentang-halaman"]');

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

  // ── Helpers ────────────────────────────────────────

  /** Format number as Indonesian Rupiah string */
  function formatRupiah(num) {
    return 'Rp ' + num.toLocaleString('id-ID');
  }

  /** Get the checked value of a radio group */
  function getRadioValue(name) {
    const checked = form.querySelector('input[name="' + name + '"]:checked');
    return checked ? checked.value : null;
  }

  /**
   * Parse a page range string like "1-5, 8, 12-15"
   * Returns { valid: boolean, pages: number[], error: string }
   */
  function parsePageRange(input, maxPage) {
    const trimmed = input.trim();
    if (!trimmed) {
      return { valid: false, pages: [], error: 'Silakan masukkan rentang halaman.' };
    }

    // Validate characters: only digits, hyphens, commas, spaces allowed
    if (!/^[\d\s,\-–—]+$/.test(trimmed)) {
      return { valid: false, pages: [], error: 'Karakter tidak valid. Gunakan angka, tanda hubung (-), dan koma (,).' };
    }

    const pages = new Set();
    // Normalize dashes (en-dash, em-dash → hyphen)
    const normalized = trimmed.replace(/[–—]/g, '-');
    const parts = normalized.split(',');

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i].trim();
      if (!part) continue;

      if (part.includes('-')) {
        const rangeParts = part.split('-').map(function (s) { return s.trim(); });
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
          return { valid: false, pages: [], error: 'Rentang "' + part + '" salah — angka awal harus ≤ angka akhir.' };
        }
        if (end > maxPage) {
          return { valid: false, pages: [], error: 'Halaman ' + end + ' melebihi total halaman dokumen (' + maxPage + ').' };
        }
        for (let p = start; p <= end; p++) {
          pages.add(p);
        }
      } else {
        var pageNum = parseInt(part, 10);
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

    return { valid: true, pages: Array.from(pages).sort(function (a, b) { return a - b; }), error: '' };
  }

  // ── Core Calculator ────────────────────────────────

  function calculate() {
    // 1. Gather selections
    var paperSize  = getRadioValue('ukuran-kertas') || 'A4';
    var colorMode  = getRadioValue('mode-warna') || 'BW';
    var printSide  = getRadioValue('sisi-cetak') || 'simplex';
    var rangeMode  = getRadioValue('rentang-halaman') || 'all';
    var copies     = parseInt(copiesInput.value, 10) || 1;

    // Clamp copies
    copies = Math.max(1, Math.min(50, copies));
    copiesInput.value = copies;

    // 2. Determine pages to print
    var pagesToPrint = totalDocPages;
    var rangeValid = true;

    if (rangeMode === 'custom') {
      var parsed = parsePageRange(customRangeInput.value, totalDocPages);
      if (parsed.valid) {
        pagesToPrint = parsed.pages.length;
        hideRangeError();
        customRangeInput.classList.remove('input-error');
      } else {
        // Show error but still calculate with last known value or all pages
        showRangeError(parsed.error);
        customRangeInput.classList.add('input-error');
        rangeValid = false;
        // Fall back to all pages for the calculation display
        pagesToPrint = totalDocPages;
      }
    } else {
      hideRangeError();
      customRangeInput.classList.remove('input-error');
    }

    // 3. Calculate physical sheets
    var isDuplex = (printSide === 'duplex');
    var physicalSheets = isDuplex ? Math.ceil(pagesToPrint / 2) : pagesToPrint;

    // 4. Price per physical sheet
    var basePricePerSheet = RATES.paper[paperSize] || 500;
    var colorAddon = (colorMode === 'Color') ? RATES.color : 0;
    var duplexAddon = isDuplex ? RATES.duplex : 0;
    var pricePerSheet = basePricePerSheet + colorAddon + duplexAddon;

    // 5. Total
    var totalPrice = physicalSheets * pricePerSheet * copies;

    // ── Update Summary UI ──

    // Paper size labels
    var paperLabels = { A4: 'A4', F4: 'F4 / Folio', A3: 'A3' };
    sumPaper.textContent = paperLabels[paperSize] || paperSize;

    // Color mode
    sumColor.textContent = (colorMode === 'Color') ? 'Full Color' : 'Hitam & Putih';

    // Side
    sumSide.textContent = isDuplex ? 'Duplex (Bolak-balik)' : 'Simplex (Satu sisi)';

    // Pages & sheets
    sumPages.textContent = pagesToPrint + ' hal';
    sumSheets.textContent = physicalSheets + ' lbr';

    // Copies
    sumCopies.textContent = copies + '×';

    // Base price
    sumBasePrice.textContent = formatRupiah(basePricePerSheet);

    // Color addon row
    if (colorMode === 'Color') {
      sumColorRow.style.display = '';
      sumColorPrice.textContent = formatRupiah(RATES.color);
    } else {
      sumColorRow.style.display = 'none';
    }

    // Duplex addon row
    if (isDuplex) {
      sumDuplexRow.style.display = '';
      sumDuplexPrice.textContent = formatRupiah(RATES.duplex);
    } else {
      sumDuplexRow.style.display = 'none';
    }

    // Total
    sumTotal.textContent = formatRupiah(totalPrice);

    // ── Eco badge ──
    if (isDuplex) {
      ecoBadge.style.display = 'flex';
      ecoPagesInfo.textContent = pagesToPrint + ' halaman';
      ecoSheetsInfo.textContent = physicalSheets + ' lembar';
    } else {
      ecoBadge.style.display = 'none';
    }

    // ── Update stepper button states ──
    btnMinus.disabled = copies <= 1;
    btnPlus.disabled = copies >= 50;
  }

  function showRangeError(msg) {
    rangeError.classList.add('visible');
    rangeErrorMsg.textContent = msg;
  }

  function hideRangeError() {
    rangeError.classList.remove('visible');
    rangeErrorMsg.textContent = '';
  }

  // ── Event Listeners ────────────────────────────────

  // Radio cards: recalculate on change
  paperRadios.forEach(function (r) { r.addEventListener('change', calculate); });
  colorRadios.forEach(function (r) { r.addEventListener('change', calculate); });
  sideRadios.forEach(function (r) { r.addEventListener('change', calculate); });

  // Page range radio toggle
  rangeRadios.forEach(function (r) {
    r.addEventListener('change', function () {
      var isCustom = (getRadioValue('rentang-halaman') === 'custom');
      customRangeWrap.classList.toggle('visible', isCustom);
      if (isCustom) {
        customRangeInput.focus();
      } else {
        hideRangeError();
        customRangeInput.classList.remove('input-error');
      }
      calculate();
    });
  });

  // Custom page range input
  customRangeInput.addEventListener('input', function () {
    calculate();
  });

  // Stepper buttons
  btnMinus.addEventListener('click', function () {
    var val = parseInt(copiesInput.value, 10) || 1;
    if (val > 1) {
      copiesInput.value = val - 1;
      calculate();
    }
  });

  btnPlus.addEventListener('click', function () {
    var val = parseInt(copiesInput.value, 10) || 1;
    if (val < 50) {
      copiesInput.value = val + 1;
      calculate();
    }
  });

  // Direct input in stepper
  copiesInput.addEventListener('input', function () {
    var val = parseInt(copiesInput.value, 10);
    if (isNaN(val) || val < 1) {
      copiesInput.value = 1;
    } else if (val > 50) {
      copiesInput.value = 50;
    }
    calculate();
  });

  copiesInput.addEventListener('blur', function () {
    var val = parseInt(copiesInput.value, 10);
    if (isNaN(val) || val < 1) copiesInput.value = 1;
    else if (val > 50) copiesInput.value = 50;
    calculate();
  });

  // Textarea character counter
  if (notesTextarea && notesCounter) {
    notesTextarea.addEventListener('input', function () {
      var len = notesTextarea.value.length;
      notesCounter.textContent = len + ' / 200 karakter';
    });
  }

  // Form submit validation
  form.addEventListener('submit', function (e) {
    var rangeMode = getRadioValue('rentang-halaman');
    if (rangeMode === 'custom') {
      var parsed = parsePageRange(customRangeInput.value, totalDocPages);
      if (!parsed.valid) {
        e.preventDefault();
        showRangeError(parsed.error);
        customRangeInput.classList.add('input-error');
        customRangeInput.focus();
        return;
      }
    }
  });

  // ── Initialize range labels ────────────────────────
  if (rangeAllLabel) {
    rangeAllLabel.textContent = 'Halaman 1 – ' + totalDocPages;
  }
  if (rangeMaxHint) {
    rangeMaxHint.textContent = totalDocPages;
  }

  // ── Initial calculation on page load ───────────────
  calculate();

})();
