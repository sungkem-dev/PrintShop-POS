/**
 * PrintShop POS — Operator Queue Console & Real-time FIFO Management with Order History
 * File: assets/js/antrean.js
 */

;(function () {
  'use strict';

  let activeOrders = [];
  let historyOrders = [];
  let filterStatus = 'ALL';
  let searchQuery = '';
  let historyRange = 'today';
  let pendingCancelOrder = null;

  function formatRupiah(num) {
    return 'Rp' + Number(num || 0).toLocaleString('id-ID');
  }

  function formatTime(isoStr) {
    if (!isoStr) return '--:-- WIB';
    const d = new Date(isoStr);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} WIB`;
  }

  function formatDateTime(isoStr) {
    if (!isoStr) return '--';
    const d = new Date(isoStr);
    const day = String(d.getDate()).padStart(2, '0');
    const month = d.toLocaleDateString('id-ID', { month: 'short' });
    const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    return `${day} ${month}, ${time} WIB`;
  }

  function getStatusBadge(status) {
    switch (status) {
      case 'WAITING_IN_QUEUE':
        return '<span class="status-badge status-badge--waiting"><span class="console-status-dot" style="background:#f59e0b;"></span> Menunggu</span>';
      case 'PROCESSING':
        return '<span class="status-badge status-badge--processing"><span class="console-status-dot" style="background:#3b82f6;"></span> Diproses</span>';
      case 'PRINTING':
        return '<span class="status-badge status-badge--printing"><span class="console-status-dot" style="background:#2563eb;"></span> Mencetak</span>';
      case 'READY_FOR_PICKUP':
        return '<span class="status-badge status-badge--ready"><span class="console-status-dot" style="background:#10b981;"></span> Siap Ambil</span>';
      case 'COMPLETED':
        return '<span class="status-badge" style="background:#ecfdf5;color:#047857;border:1px solid #a7f3d0;font-weight:700;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:3px;vertical-align:-1px;"><polyline points="20 6 9 17 4 12"></polyline></svg>Diserahkan</span>';
      case 'CANCELLED':
        return '<span class="status-badge" style="background:#fef2f2;color:#b91c1c;border:1px solid #fecaca;font-weight:600;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:3px;vertical-align:-1px;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>Dibatalkan</span>';
      default:
        return `<span class="status-badge">${status}</span>`;
    }
  }

  // Toast Notification Helper
  function showToast(message, type = 'success') {
    let toast = document.getElementById('global-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'global-toast';
      toast.style.cssText = `
        position: fixed;
        bottom: 24px;
        right: 24px;
        padding: 14px 22px;
        background: #0f172a;
        color: #ffffff;
        font-size: 13.5px;
        font-weight: 500;
        border-radius: 12px;
        box-shadow: 0 10px 25px -5px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        gap: 10px;
        z-index: 99999;
        transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        opacity: 0;
        transform: translateY(20px);
      `;
      document.body.appendChild(toast);
    }

    const icon = type === 'success' 
      ? '<span style="color:#10b981;font-size:16px;">✓</span>' 
      : '<span style="color:#ef4444;font-size:16px;">✕</span>';

    toast.innerHTML = `${icon} <span>${message}</span>`;
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';

    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(20px)';
    }, 4000);
  }

  // ── Render Active Queue Table ──────────────────────────────────────
  function renderActiveTable() {
    const tbody = document.getElementById('queue-table-tbody') || document.querySelector('.console-table tbody');
    if (!tbody) return;

    let filtered = [...activeOrders];

    if (filterStatus !== 'ALL') {
      filtered = filtered.filter(o => o.status === filterStatus);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(o =>
        (o.order_code && o.order_code.toLowerCase().includes(q)) ||
        (o.customer_name && o.customer_name.toLowerCase().includes(q)) ||
        (o.file_name && o.file_name.toLowerCase().includes(q))
      );
    }

    // Update badge count in header
    const countBadge = document.querySelector('#tabel-antrean-heading .badge-count') || document.querySelector('.badge-count');
    if (countBadge) {
      countBadge.textContent = `${filtered.length} Pesanan`;
    }

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10" style="text-align: center; padding: 48px 20px; color: var(--muted);">
            <div style="font-size: 28px; margin-bottom: 8px;">📭</div>
            <strong style="display:block; color:var(--ink); font-size:15px; margin-bottom:4px;">Tidak ada antrean cetak aktif</strong>
            <p style="margin:0; font-size:13px;">Semua pesanan saat ini sudah selesai diserahkan atau belum ada pesanan baru.</p>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map((order, idx) => {
      const spec = order.specifications || {};
      const paper = spec.paper_size || 'A4';
      const isColor = (spec.color_mode || '').includes('Color');
      const side = spec.print_side || 'Simplex';
      const copies = order.copies || 1;
      const pages = order.total_pages || 1;
      const sheets = spec.sheets_count || pages;
      const price = formatRupiah(order.total_price || 0);
      const isPrinting = order.status === 'PRINTING' || order.status === 'PROCESSING';
      const isReady = order.status === 'READY_FOR_PICKUP';
      const isWaiting = order.status === 'WAITING_IN_QUEUE';

      let actionHtml = '';
      if (isWaiting) {
        actionHtml = `
          <button type="button" class="btn-action btn-action--primary btn-start-print" data-id="${order.id}" data-code="${order.order_code}" title="Mulai cetak pesanan">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 6 2 18 2 18 9"></polyline>
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
              <rect x="6" y="14" width="12" height="8"></rect>
            </svg>
            Mulai Cetak
          </button>
        `;
      } else if (isPrinting) {
        actionHtml = `
          <button type="button" class="btn-action btn-action--success btn-mark-ready" data-id="${order.id}" data-code="${order.order_code}" title="Tandai cetakan selesai dan siap diambil">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            Siap Ambil
          </button>
        `;
      } else if (isReady) {
        actionHtml = `
          <button type="button" class="btn-action btn-action--success btn-mark-complete" data-id="${order.id}" data-code="${order.order_code}" style="background:#059669; border-color:#059669;" title="Serahkan hasil cetak kepada pemesan dan selesaikan pesanan">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            Serahkan
          </button>
        `;
      }

      return `
        <tr data-order-id="${order.id}">
          <td>${idx + 1}</td>
          <td><strong class="order-id">${order.order_code}</strong></td>
          <td><time>${formatTime(order.created_at)}</time></td>
          <td>
            <div class="file-info" title="${order.file_name}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
              </svg>
              <span>${order.file_name}</span>
            </div>
            <small style="color:var(--muted); font-size:11px;">${order.customer_name || 'Tamu Walk-In'}</small>
          </td>
          <td>
            <span class="spec-tag">${paper}</span>
            <span class="spec-tag ${isColor ? 'spec-tag--color' : ''}">${isColor ? 'Color' : 'B&W'}</span>
            <span class="spec-tag">${copies} Copy</span>
            <span class="spec-tag">${side}</span>
          </td>
          <td class="text-center">${sheets}</td>
          <td><strong>${price}</strong></td>
          <td>Canon 1</td>
          <td>${getStatusBadge(order.status)}</td>
          <td>
            <div class="action-btn-group">
              ${actionHtml}
              <button type="button" class="btn-action-icon btn-action-icon--danger btn-cancel-trigger" data-id="${order.id}" data-code="${order.order_code}" title="Batalkan pesanan">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="15" y1="9" x2="9" y2="15"></line>
                  <line x1="9" y1="9" x2="15" y2="15"></line>
                </svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    bindActionEvents();
  }

  // ── Render History (Riwayat) Table ─────────────────────────────────
  function renderHistoryTable() {
    const tbody = document.getElementById('history-table-tbody') || document.querySelector('#riwayat table tbody');
    if (!tbody) return;

    let filtered = [...historyOrders];

    // Filter by date range
    const today = new Date().toISOString().split('T')[0];
    if (historyRange === 'today') {
      filtered = filtered.filter(o => o.created_at && o.created_at.startsWith(today));
    } else if (historyRange === 'week') {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      filtered = filtered.filter(o => o.created_at && o.created_at >= sevenDaysAgo);
    }

    // Update history header count
    const historyBadge = document.querySelector('#riwayat-heading .badge-count');
    if (historyBadge) {
      historyBadge.textContent = `${filtered.length} Transaksi`;
    }

    // Update Riwayat KPI Cards
    const completedCount = filtered.filter(o => o.status === 'COMPLETED').length;
    const cancelledCount = filtered.filter(o => o.status === 'CANCELLED').length;
    const totalRevenue = filtered
      .filter(o => o.status === 'COMPLETED')
      .reduce((sum, o) => sum + (Number(o.total_price) || 0), 0);

    const kpiVals = document.querySelectorAll('#riwayat .history-kpi-value');
    if (kpiVals.length >= 4) {
      kpiVals[0].textContent = filtered.length;
      kpiVals[1].textContent = completedCount;
      kpiVals[2].textContent = cancelledCount;
      kpiVals[3].textContent = formatRupiah(totalRevenue);
    }

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 36px 20px; color: var(--muted);">
            <div style="font-size: 24px; margin-bottom: 6px;">📋</div>
            Belum ada riwayat pesanan yang diserahkan untuk periode ini.
          </td>
        </tr>
      `;
      return;
    }

    // Sort by latest updated/created
    filtered.sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));

    tbody.innerHTML = filtered.map(order => {
      const spec = order.specifications || {};
      const paper = spec.paper_size || 'A4';
      const isColor = (spec.color_mode || '').includes('Color');
      const copies = order.copies || 1;
      const pages = order.total_pages || 1;
      const sheets = spec.sheets_count || pages;
      const price = formatRupiah(order.total_price || 0);

      return `
        <tr data-order-id="${order.id}">
          <td><strong class="order-id">${order.order_code}</strong></td>
          <td><time title="${formatDateTime(order.created_at)}">${formatTime(order.updated_at || order.created_at)}</time></td>
          <td>
            <div class="file-info" title="${order.file_name}">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
              </svg>
              <span>${order.file_name}</span>
            </div>
            <small style="color:var(--muted); font-size:11px;">${order.customer_name || 'Tamu Walk-In'}</small>
          </td>
          <td>
            <span class="spec-tag">${paper}</span>
            <span class="spec-tag ${isColor ? 'spec-tag--color' : ''}">${isColor ? 'Color' : 'B&W'}</span>
            <span class="spec-tag">${copies} Copy</span>
          </td>
          <td class="text-center">${sheets}</td>
          <td><strong>${price}</strong></td>
          <td>${getStatusBadge(order.status)}</td>
          <td>
            <button type="button" class="btn-action-icon btn-view-receipt" data-id="${order.id}" data-code="${order.order_code}" title="Cetak ulang struk / lihat detail" aria-label="Detail ${order.order_code}">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
            </button>
          </td>
        </tr>
      `;
    }).join('');

    // Bind receipt view buttons
    document.querySelectorAll('.btn-view-receipt').forEach(btn => {
      btn.addEventListener('click', function () {
        const id = this.dataset.id;
        const order = historyOrders.find(o => o.id === id);
        if (order) openReceiptModal(order);
      });
    });
  }

  // ── Update Summary Stat Counters ──────────────────────────────────
  function updateStatCards() {
    const totalActive = activeOrders.length;
    const waitingCount = activeOrders.filter(o => o.status === 'WAITING_IN_QUEUE').length;
    const processingCount = activeOrders.filter(o => o.status === 'PROCESSING').length;
    const printingCount = activeOrders.filter(o => o.status === 'PRINTING').length;
    const readyCount = activeOrders.filter(o => o.status === 'READY_FOR_PICKUP').length;

    const statValues = document.querySelectorAll('.stats-card-row .stat-card-value');
    if (statValues.length >= 5) {
      statValues[0].textContent = totalActive;
      statValues[1].textContent = waitingCount;
      statValues[2].textContent = processingCount;
      statValues[3].textContent = printingCount;
      statValues[4].textContent = readyCount;
    }
  }

  // ── Action Button Event Handlers ───────────────────────────────────
  function bindActionEvents() {
    // Mulai Cetak -> PRINTING
    document.querySelectorAll('.btn-start-print').forEach(btn => {
      btn.addEventListener('click', async function () {
        const id = this.dataset.id;
        const code = this.dataset.code;
        btn.disabled = true;
        btn.textContent = 'Memulai...';
        try {
          if (window.PrintShopAPI) {
            await window.PrintShopAPI.updateOrder(id, { status: 'PRINTING' });
            showToast(`Pesanan #${code} mulai dicetak di mesin.`);
            await reloadOrders();
          }
        } catch (e) {
          alert('Gagal memulai cetak: ' + e.message);
          btn.disabled = false;
        }
      });
    });

    // Siap Ambil -> READY_FOR_PICKUP
    document.querySelectorAll('.btn-mark-ready').forEach(btn => {
      btn.addEventListener('click', async function () {
        const id = this.dataset.id;
        const code = this.dataset.code;
        btn.disabled = true;
        btn.textContent = 'Menyimpan...';
        try {
          if (window.PrintShopAPI) {
            await window.PrintShopAPI.updateOrder(id, { status: 'READY_FOR_PICKUP' });
            showToast(`Pesanan #${code} selesai dicetak & siap diambil.`);
            await reloadOrders();
          }
        } catch (e) {
          alert('Gagal memperbarui status: ' + e.message);
          btn.disabled = false;
        }
      });
    });

    // SERAHKAN -> COMPLETED (Moves immediately to Riwayat Pesanan)
    document.querySelectorAll('.btn-mark-complete').forEach(btn => {
      btn.addEventListener('click', async function () {
        const id = this.dataset.id;
        const code = this.dataset.code;
        btn.disabled = true;
        btn.textContent = 'Menyerahkan...';
        try {
          if (window.PrintShopAPI) {
            await window.PrintShopAPI.updateOrder(id, { status: 'COMPLETED' });
            showToast(`Pesanan #${code} berhasil diserahkan kepada pelanggan & masuk ke Riwayat Pesanan!`, 'success');
            await reloadOrders();
          }
        } catch (e) {
          alert('Gagal menyelesaikan penyerahan: ' + e.message);
          btn.disabled = false;
        }
      });
    });

    // Trigger Cancel Modal
    document.querySelectorAll('.btn-cancel-trigger').forEach(btn => {
      btn.addEventListener('click', function () {
        const id = this.dataset.id;
        const code = this.dataset.code;
        openCancelModal(id, code);
      });
    });
  }

  // ── Reload Orders from API ────────────────────────────────────────
  async function reloadOrders() {
    if (!window.PrintShopAPI) return;
    try {
      // Fetch all orders
      const orders = await window.PrintShopAPI.getOrders();
      if (Array.isArray(orders)) {
        activeOrders = orders.filter(o =>
          ['WAITING_IN_QUEUE', 'PROCESSING', 'PRINTING', 'READY_FOR_PICKUP'].includes(o.status)
        );
        historyOrders = orders.filter(o =>
          ['COMPLETED', 'CANCELLED'].includes(o.status)
        );
      }
      renderActiveTable();
      renderHistoryTable();
      updateStatCards();

      // Update timestamp
      const lastUpdateEl = document.getElementById('last-update-time');
      if (lastUpdateEl) {
        const now = new Date();
        lastUpdateEl.textContent = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')} WIB`;
      }
    } catch (e) {
      console.warn('Reload orders error:', e);
    }
  }

  // Export for external callers
  window.reloadOrders = reloadOrders;

  // ── Cancel Modal Handling ─────────────────────────────────────────
  function openCancelModal(id, code) {
    pendingCancelOrder = { id, code };
    const modal = document.getElementById('cancel-modal');
    if (modal) {
      modal.hidden = false;
      modal.style.display = 'flex';
      const orderCodeDisplay = document.getElementById('cancel-order-code');
      if (orderCodeDisplay) orderCodeDisplay.textContent = `#${code}`;
      const reasonInput = document.getElementById('cancel-modal-reason');
      if (reasonInput) reasonInput.value = '';
    } else {
      const reason = prompt(`Masukkan alasan pembatalan pesanan ${code}:`, 'Kertas macet / file rusak');
      if (reason && window.PrintShopAPI) {
        window.PrintShopAPI.updateOrder(id, {
          status: 'CANCELLED',
          cancel_reason: reason
        }).then(() => {
          showToast(`Pesanan #${code} dibatalkan & masuk ke Riwayat.`);
          reloadOrders();
        });
      }
    }
  }

  function closeCancelModal() {
    const modal = document.getElementById('cancel-modal');
    if (modal) {
      modal.hidden = true;
      modal.style.display = 'none';
    }
    pendingCancelOrder = null;
  }

  // ── Receipt Modal Handling ────────────────────────────────────────
  function openReceiptModal(order) {
    let modal = document.getElementById('receipt-view-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'receipt-view-modal';
      modal.style.cssText = `
        position: fixed; inset: 0; background: rgba(15,23,42,0.6); backdrop-filter: blur(4px);
        display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 20px;
      `;
      document.body.appendChild(modal);
    }

    const spec = order.specifications || {};
    modal.innerHTML = `
      <div style="background:#fff; border-radius:16px; max-width:440px; width:100%; box-shadow:0 20px 40px rgba(0,0,0,0.25); overflow:hidden; font-family:var(--font-sans, Inter, sans-serif);">
        <div style="padding:20px 24px; background:#1e293b; color:#fff; display:flex; justify-content:space-between; align-items:center;">
          <div>
            <h3 style="margin:0; font-size:16px; font-weight:700;">Detail Pesanan &amp; Struk</h3>
            <span style="font-size:12px; color:#94a3b8;">Status: ${order.status}</span>
          </div>
          <button type="button" id="btn-close-receipt" style="background:transparent; border:none; color:#cbd5e1; font-size:20px; cursor:pointer; line-height:1;">&times;</button>
        </div>
        <div style="padding:24px; font-size:13px; line-height:1.6; color:#334155;">
          <div style="text-align:center; padding-bottom:16px; border-bottom:1px dashed #cbd5e1; margin-bottom:16px;">
            <strong style="font-size:18px; color:#0f172a; display:block;">PrintShop POS</strong>
            <span style="color:#64748b; font-size:12px;">Gerai Kampus Utama | Kios Loket A1</span>
            <div style="margin-top:8px; font-size:14px; font-weight:800; color:#1d4ed8; letter-spacing:1px;">#${order.order_code}</div>
          </div>
          <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
            <span style="color:#64748b;">Nama Pemesan:</span>
            <strong>${order.customer_name || 'Tamu Walk-In'}</strong>
          </div>
          <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
            <span style="color:#64748b;">Nama Berkas:</span>
            <strong style="max-width:200px; text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${order.file_name}</strong>
          </div>
          <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
            <span style="color:#64748b;">Format &amp; Kertas:</span>
            <span>${spec.paper_size || 'A4'} &bull; ${(spec.color_mode || '').includes('Color') ? 'Full Color' : 'Hitam-Putih'}</span>
          </div>
          <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
            <span style="color:#64748b;">Halaman &amp; Salinan:</span>
            <span>${order.total_pages || 1} Halaman &times; ${order.copies || 1} Rangkap</span>
          </div>
          <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
            <span style="color:#64748b;">Waktu Selesai:</span>
            <span>${formatDateTime(order.updated_at || order.created_at)}</span>
          </div>
          <div style="border-top:1px dashed #cbd5e1; margin-top:14px; padding-top:12px; display:flex; justify-content:space-between; font-size:15px;">
            <strong style="color:#0f172a;">Total Biaya:</strong>
            <strong style="color:#047857; font-size:16px;">${formatRupiah(order.total_price)}</strong>
          </div>
        </div>
        <div style="padding:16px 24px; background:#f8fafc; border-top:1px solid #e2e8f0; display:flex; gap:10px; justify-content:flex-end;">
          <button type="button" onclick="window.print()" class="btn-export-outline" style="font-size:12.5px; padding:8px 14px;">
            🖨️ Cetak Struk
          </button>
          <button type="button" id="btn-done-receipt" class="btn-primary" style="font-size:12.5px; padding:8px 18px;">
            Tutup
          </button>
        </div>
      </div>
    `;

    modal.style.display = 'flex';
    document.getElementById('btn-close-receipt').onclick = () => { modal.style.display = 'none'; };
    document.getElementById('btn-done-receipt').onclick = () => { modal.style.display = 'none'; };
  }

  // ── Main Init ──────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', async function () {
    // 1. Authentication Guard
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

    // 2. Active Queue Filter Controls
    const filterSelect = document.getElementById('filter-status') || document.querySelector('select[name="status"]');
    if (filterSelect) {
      filterSelect.addEventListener('change', function () {
        filterStatus = this.value || 'ALL';
        renderActiveTable();
      });
    }

    const searchInput = document.getElementById('cari-pesanan') || document.getElementById('search-input');
    if (searchInput) {
      searchInput.addEventListener('input', function () {
        searchQuery = this.value.trim();
        renderActiveTable();
      });
    }

    // 3. History Date Range Buttons
    const rangeBtns = document.querySelectorAll('[data-history-range]');
    rangeBtns.forEach(btn => {
      btn.addEventListener('click', function () {
        rangeBtns.forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        historyRange = this.dataset.historyRange;
        renderHistoryTable();
      });
    });

    // 4. Export History to CSV
    const exportHistoryBtn = document.getElementById('btn-export-history');
    if (exportHistoryBtn) {
      exportHistoryBtn.addEventListener('click', function () {
        const rows = [
          ['ID Pesanan', 'Waktu Masuk', 'Waktu Selesai', 'Pelanggan', 'Nama File', 'Halaman', 'Rangkap', 'Total Bayar', 'Status'],
          ...historyOrders.map(o => [
            o.order_code,
            o.created_at,
            o.updated_at || o.created_at,
            `"${(o.customer_name || '').replace(/"/g, '""')}"`,
            `"${(o.file_name || '').replace(/"/g, '""')}"`,
            o.total_pages || 1,
            o.copies || 1,
            o.total_price || 0,
            o.status
          ])
        ];
        const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(r => r.join(',')).join('\n');
        const link = document.createElement('a');
        link.setAttribute('href', encodeURI(csvContent));
        link.setAttribute('download', `Riwayat_PrintShop_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      });
    }

    // 5. Cancel Modal Actions
    const cancelModal = document.getElementById('cancel-modal');
    if (cancelModal) {
      const closeBtn = document.getElementById('btn-close-cancel-modal');
      const dismissBtn = document.getElementById('btn-dismiss-cancel-modal');
      const confirmBtn = document.getElementById('btn-confirm-cancel-modal');

      if (closeBtn) closeBtn.onclick = closeCancelModal;
      if (dismissBtn) dismissBtn.onclick = closeCancelModal;
      if (confirmBtn) {
        confirmBtn.onclick = async function () {
          if (!pendingCancelOrder) return;
          const reasonInput = document.getElementById('cancel-modal-reason');
          const reason = (reasonInput && reasonInput.value.trim()) || 'Dibatalkan oleh operator';

          if (window.PrintShopAPI) {
            confirmBtn.disabled = true;
            await window.PrintShopAPI.updateOrder(pendingCancelOrder.id, {
              status: 'CANCELLED',
              cancel_reason: reason
            });
            confirmBtn.disabled = false;
            closeCancelModal();
            showToast(`Pesanan #${pendingCancelOrder.code} telah dibatalkan & masuk ke Riwayat.`);
            await reloadOrders();
          }
        };
      }
    }

    // 6. Refresh Button
    const refreshBtn = document.getElementById('btn-refresh-queue');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async function () {
        refreshBtn.disabled = true;
        await reloadOrders();
        showToast('Data antrean & riwayat berhasil diperbarui.');
        setTimeout(() => { refreshBtn.disabled = false; }, 800);
      });
    }

    // 7. Initial Load & Realtime Polling
    await reloadOrders();

    // Auto-poll every 3.5 seconds
    if (window.PrintShopAPI && typeof window.PrintShopAPI.subscribeToOrders === 'function') {
      window.PrintShopAPI.subscribeToOrders(() => {
        reloadOrders();
      }, 3500);
    }
  });
})();
