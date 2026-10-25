/**
 * PrintShop POS — Operator Queue Console & Real-time FIFO Management
 * File: assets/js/antrean.js
 */

;(function () {
  'use strict';

  let currentOrders = [];
  let filterStatus = 'ALL';
  let searchQuery = '';
  let pendingCancelOrder = null;

  function formatRupiah(num) {
    return 'Rp' + Number(num).toLocaleString('id-ID');
  }

  function formatTime(isoStr) {
    if (!isoStr) return '--:-- WIB';
    const d = new Date(isoStr);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} WIB`;
  }

  function getStatusBadge(status) {
    switch (status) {
      case 'WAITING_IN_QUEUE':
        return '<span class="status-badge status-badge--waiting">Waiting</span>';
      case 'PROCESSING':
        return '<span class="status-badge status-badge--processing">Processing</span>';
      case 'PRINTING':
        return '<span class="status-badge status-badge--printing">Printing</span>';
      case 'READY_FOR_PICKUP':
        return '<span class="status-badge status-badge--ready">Ready</span>';
      case 'COMPLETED':
        return '<span class="status-badge" style="background:#f1f5f9;color:#475569;">Completed</span>';
      case 'CANCELLED':
        return '<span class="status-badge" style="background:#fee2e2;color:#dc2626;">Cancelled</span>';
      default:
        return `<span class="status-badge">${status}</span>`;
    }
  }

  function renderTable() {
    const tbody = document.querySelector('.console-table tbody');
    if (!tbody) return;

    let filtered = [...currentOrders];

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

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10" style="text-align: center; padding: 36px 20px; color: var(--muted);">
            Tidak ada antrean cetak aktif yang cocok dengan kriteria.
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
          <button type="button" class="btn-action btn-action--primary btn-start-print" data-id="${order.id}">
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
          <button type="button" class="btn-action btn-action--success btn-mark-ready" data-id="${order.id}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            Siap Ambil
          </button>
        `;
      } else if (isReady) {
        actionHtml = `
          <button type="button" class="btn-action btn-action--success btn-mark-complete" data-id="${order.id}" style="background:#059669;">
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
            <small style="color:var(--muted); font-size:11px;">${order.customer_name || 'Tamu'}</small>
          </td>
          <td>
            <span class="spec-tag">${paper}</span>
            <span class="spec-tag ${isColor ? 'spec-tag--color' : ''}">${isColor ? 'Full Color' : 'B&W'}</span>
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

  function bindActionEvents() {
    // Mulai Cetak -> PRINTING
    document.querySelectorAll('.btn-start-print').forEach(btn => {
      btn.addEventListener('click', async function () {
        const id = this.dataset.id;
        btn.disabled = true;
        btn.textContent = 'Memulai...';
        if (window.PrintShopAPI) {
          await window.PrintShopAPI.updateOrder(id, { status: 'PRINTING' });
          await reloadOrders();
        }
      });
    });

    // Siap Ambil -> READY_FOR_PICKUP
    document.querySelectorAll('.btn-mark-ready').forEach(btn => {
      btn.addEventListener('click', async function () {
        const id = this.dataset.id;
        btn.disabled = true;
        if (window.PrintShopAPI) {
          await window.PrintShopAPI.updateOrder(id, { status: 'READY_FOR_PICKUP' });
          await reloadOrders();
        }
      });
    });

    // Serahkan -> COMPLETED
    document.querySelectorAll('.btn-mark-complete').forEach(btn => {
      btn.addEventListener('click', async function () {
        const id = this.dataset.id;
        btn.disabled = true;
        if (window.PrintShopAPI) {
          await window.PrintShopAPI.updateOrder(id, { status: 'COMPLETED' });
          await reloadOrders();
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

  async function reloadOrders() {
    if (!window.PrintShopAPI) return;
    try {
      const orders = await window.PrintShopAPI.getOrders({
        status: 'WAITING_IN_QUEUE,PROCESSING,PRINTING,READY_FOR_PICKUP'
      });
      currentOrders = orders;
      renderTable();
    } catch (e) {
      console.warn('Reload orders error:', e);
    }
  }

  // Export for external callers
  window.reloadOrders = reloadOrders;

  // ── Cancel Modal Handling ─────────────────────────

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
        }).then(reloadOrders);
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

  // ── Main Init ──────────────────────────────────────

  document.addEventListener('DOMContentLoaded', async function () {
    // Authentication guard
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

    // Filter controls
    const filterSelect = document.getElementById('filter-status') || document.querySelector('select[name="status-filter"]');
    if (filterSelect) {
      filterSelect.addEventListener('change', function () {
        const val = this.value.toUpperCase();
        if (val.includes('PRINT')) filterStatus = 'PRINTING';
        else if (val.includes('WAIT')) filterStatus = 'WAITING_IN_QUEUE';
        else if (val.includes('READY')) filterStatus = 'READY_FOR_PICKUP';
        else filterStatus = 'ALL';
        renderTable();
      });
    }

    const searchInput = document.getElementById('cari-pesanan') || document.getElementById('search-input') || document.querySelector('input[type="search"]');
    if (searchInput) {
      searchInput.addEventListener('input', function () {
        searchQuery = this.value.trim();
        renderTable();
      });
    }

    // Dedicated Cancel modal buttons
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
            await reloadOrders();
          }
        };
      }
    }

    // Initial Load & Realtime Polling
    await reloadOrders();

    if (window.PrintShopAPI) {
      window.PrintShopAPI.subscribeToOrders(() => {
        reloadOrders();
      }, 3500);
    }
  });
})();
