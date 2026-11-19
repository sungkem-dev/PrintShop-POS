/**
 * PrintShop POS — Dynamic Upload & Document Verification
 * File: assets/js/upload.js
 */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    const fileInput = document.getElementById('file-dokumen');
    const dropzone = document.querySelector('.dropzone-box');
    const readyCard = document.querySelector('.ready-doc-card');
    const docNameEl = document.querySelector('.doc-name');
    const docMetaEl = document.querySelector('.doc-meta');
    const nameInput = document.getElementById('nama-pemesan');
    const phoneInput = document.getElementById('nomor-hp');
    const fileErrorEl = document.getElementById('upload-file-error');
    const nameErrorEl = document.getElementById('nama-pemesan-error');
    const phoneErrorEl = document.getElementById('nomor-hp-error');
    const submitBtn = document.querySelector('.btn-submit-action');
    const form = document.querySelector('form');

    let currentFile = null;
    let detectedPages = 0;
    let uploadedFileUrl = '';

    // Hide preview card initially; keep submit button active (solid green)
    if (readyCard) {
      readyCard.hidden = true;
    }

    function clearFileError() {
      if (fileErrorEl) fileErrorEl.hidden = true;
      if (dropzone) dropzone.classList.remove('is-invalid');
    }

    function clearNameError() {
      if (nameErrorEl) nameErrorEl.hidden = true;
      if (nameInput) nameInput.classList.remove('is-invalid');
    }

    function clearPhoneError() {
      if (phoneErrorEl) phoneErrorEl.hidden = true;
      if (phoneInput) phoneInput.classList.remove('is-invalid');
    }

    function showNameError(msg) {
      if (nameErrorEl) {
        nameErrorEl.textContent = msg;
        nameErrorEl.hidden = false;
      }
      if (nameInput) nameInput.classList.add('is-invalid');
    }

    function showPhoneError(msg) {
      if (phoneErrorEl) {
        phoneErrorEl.textContent = msg;
        phoneErrorEl.hidden = false;
      }
      if (phoneInput) phoneInput.classList.add('is-invalid');
    }

    function validateName(raw) {
      const val = (raw || '').trim();
      if (!val) {
        return 'Nama pemesan wajib diisi.';
      }
      const allowedPattern = /^[a-zA-ZÀ-ÿ0-9\s.,'-]+$/;
      const hasLetter = /[a-zA-ZÀ-ÿ]/.test(val);
      if (!allowedPattern.test(val) || !hasLetter) {
        return 'Masukkan nama pemesan yang valid (gunakan huruf, boleh disertai angka/spasi).';
      }
      return '';
    }

    function validatePhone(raw, isLiveInput) {
      const val = (raw || '').trim();
      if (!val) {
        return '';
      }
      if (!/^\+?\d*$/.test(val)) {
        return 'Nomor WhatsApp harus berupa angka, bukan huruf.';
      }
      if (!isLiveInput) {
        const digits = val.replace(/^\+/, '');
        if (!digits) {
          return 'Nomor WhatsApp harus berupa angka, bukan huruf.';
        }
        if (digits.length < 10 || digits.length > 14) {
          return 'Nomor WhatsApp harus terdiri dari 10–14 digit angka.';
        }
      }
      return '';
    }

    // Estimate PDF page count from file buffer if PDF
    async function estimatePdfPages(file) {
      try {
        const arrayBuffer = await file.slice(0, 1024 * 1024 * 3).arrayBuffer();
        const text = new TextDecoder('latin1').decode(arrayBuffer);
        const matches = text.match(/\/Type\s*\/Page\b/g);
        if (matches && matches.length > 0) {
          return matches.length;
        }
      } catch (e) {
        // Fallback
      }
      // Heuristic fallback: ~50KB per page
      return Math.max(1, Math.min(60, Math.round(file.size / (65 * 1024))));
    }

    function formatFileSize(bytes) {
      if (bytes >= 1024 * 1024) {
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
      }
      return Math.round(bytes / 1024) + ' KB';
    }

    async function handleFileSelect(file) {
      if (!file) return;

      // Validate file extension
      const validExts = ['.pdf', '.docx', '.pptx'];
      const fileExt = '.' + file.name.split('.').pop().toLowerCase();
      if (!validExts.includes(fileExt)) {
        alert('Format berkas tidak didukung. Harap unggah file PDF, DOCX, atau PPTX.');
        return;
      }

      // Validate size (< 50MB)
      if (file.size > 50 * 1024 * 1024) {
        alert('Ukuran berkas melebihi batas maksimal 50 MB.');
        return;
      }

      currentFile = file;
      clearFileError();

      // UI Feedback: Calculating & verifying
      if (readyCard) {
        readyCard.hidden = false;
        readyCard.style.display = 'flex';
        readyCard.style.opacity = '0.6';
      }
      if (docNameEl) docNameEl.textContent = file.name;
      if (docMetaEl) docMetaEl.innerHTML = `<span>Memeriksa berkas...</span>`;

      // Estimate pages
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        detectedPages = await estimatePdfPages(file);
      } else {
        detectedPages = Math.max(1, Math.round(file.size / (120 * 1024)));
      }

      // Update UI with real details
      if (docMetaEl) {
        docMetaEl.innerHTML = `
          <span>Ukuran: <strong>${formatFileSize(file.size)}</strong></span>
          <span> | </span>
          <span>Halaman: <strong class="doc-meta-pages">${detectedPages} Halaman</strong></span>
          <span> | </span>
          <span class="doc-meta-ok">✓ Terverifikasi</span>
        `;
      }
      if (readyCard) readyCard.style.opacity = '1';

      // Persist selected file metadata to sessionStorage
      try {
        sessionStorage.setItem('printshop_uploaded_file', JSON.stringify({
          filename: file.name,
          file_size: formatFileSize(file.size),
          raw_size: file.size,
          pages: detectedPages,
          pagesNum: detectedPages
        }));
      } catch (e) {
        // Ignore storage quota errors
      }

      // Upload in background to Supabase Storage / API
      try {
        if (window.PrintShopAPI) {
          const res = await window.PrintShopAPI.uploadFile(file);
          if (res && res.fileUrl) {
            uploadedFileUrl = res.fileUrl;
          }
        }
      } catch (err) {
        console.warn('Upload error, continuing with local blob:', err);
      }
    }

    // Event listeners
    if (fileInput) {
      fileInput.addEventListener('click', function () {
        fileInput.value = '';
      });
      fileInput.addEventListener('change', function (e) {
        if (e.target.files && e.target.files[0]) {
          handleFileSelect(e.target.files[0]);
        }
      });
    }

    if (dropzone) {
      ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, function (e) {
          e.preventDefault();
          dropzone.classList.add('dropzone--dragover');
        });
      });

      ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, function (e) {
          e.preventDefault();
          dropzone.classList.remove('dropzone--dragover');
        });
      });

      dropzone.addEventListener('drop', function (e) {
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
          handleFileSelect(e.dataTransfer.files[0]);
        }
      });
    }

    if (nameInput) {
      nameInput.addEventListener('input', function () {
        const val = nameInput.value.trim();
        if (!val) {
          clearNameError();
          return;
        }
        const err = validateName(val);
        if (err) {
          showNameError(err);
        } else {
          clearNameError();
        }
      });
    }

    if (phoneInput) {
      phoneInput.addEventListener('input', function () {
        const err = validatePhone(phoneInput.value, true);
        if (err) {
          showPhoneError(err);
        } else {
          clearPhoneError();
        }
      });
    }

    // Submit handler
    if (form) {
      form.addEventListener('submit', async function (e) {
        e.preventDefault();

        if (!currentFile) {
          if (fileErrorEl) fileErrorEl.hidden = false;
          if (dropzone) {
            dropzone.classList.add('is-invalid');
            dropzone.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          return;
        }

        const custName = nameInput ? nameInput.value.trim() : '';
        const nameErr = validateName(custName);
        if (nameErr) {
          showNameError(nameErr);
          if (nameInput) {
            nameInput.focus();
            nameInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          return;
        }
        clearNameError();

        const custPhone = phoneInput ? phoneInput.value.trim() : '';
        const phoneErr = validatePhone(custPhone, false);
        if (phoneErr) {
          showPhoneError(phoneErr);
          if (phoneInput) {
            phoneInput.focus();
            phoneInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          return;
        }
        clearPhoneError();
        const fileName = currentFile.name;
        const fileSize = currentFile.size;
        const totalPages = detectedPages || 1;

        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Menyiapkan Spesifikasi...';
        }

        try {
          let order = null;
          if (window.PrintShopAPI) {
            order = await window.PrintShopAPI.createOrder({
              customer_name: custName,
              customer_phone: custPhone,
              file_name: fileName,
              file_size: fileSize,
              file_url: uploadedFileUrl || null,
              total_pages: totalPages,
              copies: 1,
              total_price: totalPages * 500,
              status: 'DRAFT',
              specifications: {
                paper_size: 'A4',
                color_mode: 'B/W',
                print_side: 'Simplex',
                page_range: 'all',
                sheets_count: totalPages,
                notes: ''
              }
            });
          }

          // Cache in sessionStorage for fast transition
          const sessionPayload = {
            id: order?.id || `ord-${Date.now()}`,
            order_code: order?.order_code || 'ORD-042',
            customer_name: custName,
            customer_phone: custPhone,
            filename: fileName,
            file_size: formatFileSize(fileSize),
            pages: totalPages,
            pagesNum: totalPages,
            paper: 'A4',
            color: 'Hitam & Putih',
            side: 'Simplex',
            sheets: totalPages,
            copies: 1,
            totalNum: totalPages * 500,
            total: `Rp ${(totalPages * 500).toLocaleString('id-ID')}`
          };
          sessionStorage.setItem('printshop_order', JSON.stringify(sessionPayload));

          const nextUrl = order?.id
            ? `spesifikasi.html?order_id=${encodeURIComponent(order.id)}`
            : `spesifikasi.html`;

          window.location.href = nextUrl;
        } catch (err) {
          console.error('Error on upload submit:', err);
          window.location.href = 'spesifikasi.html';
        }
      });
    }
  });
})();
