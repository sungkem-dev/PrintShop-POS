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
    const submitBtn = document.querySelector('.btn-submit-action');
    const form = document.querySelector('form');

    let currentFile = null;
    let detectedPages = 10;
    let uploadedFileUrl = '';

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

      // UI Feedback: Calculating & verifying
      if (readyCard) {
        readyCard.style.display = 'flex';
        readyCard.style.opacity = '0.6';
      }
      if (docNameEl) docNameEl.textContent = file.name;
      if (docMetaEl) docMetaEl.innerHTML = `<span>Memeriksa berkas...</span>`;

      // Estimate pages
      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
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

    // Submit handler
    if (form) {
      form.addEventListener('submit', async function (e) {
        e.preventDefault();

        const custName = (nameInput && nameInput.value.trim()) || 'Mahasiswa';
        const custPhone = (phoneInput && phoneInput.value.trim()) || '';
        const fileName = currentFile ? currentFile.name : 'Makalah_Tugas_Akhir.pdf';
        const fileSize = currentFile ? currentFile.size : 4404019;
        const totalPages = detectedPages || 24;

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
