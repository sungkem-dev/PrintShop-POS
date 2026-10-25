/**
 * PrintShop POS — Dashboard & Analytics Controller
 * File: assets/js/dasbor.js
 */

;(function () {
  'use strict';

  function formatRupiah(num) {
    return 'Rp ' + Number(num).toLocaleString('id-ID');
  }

  document.addEventListener('DOMContentLoaded', async function () {
    // 1. Check Authentication
    const session = window.PrintShopAPI ? window.PrintShopAPI.getOperatorSession() : null;
    if (!session) {
      window.location.href = 'login.html';
      return;
    }

    // 2. Set Operator Info
    const userNameEl = document.querySelector('.console-user-name');
    const userRoleEl = document.querySelector('.console-user-role');
    const userAvatarEl = document.querySelector('.console-user-avatar');

    if (userNameEl) userNameEl.textContent = session.name || 'Ahmad Hidayat';
    if (userRoleEl) userRoleEl.innerHTML = `${session.role || 'Kasir Loket A1'} &bull; Online`;
    if (userAvatarEl && session.name) {
      const initials = session.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
      userAvatarEl.textContent = initials;
    }

    // Logout handler
    const logoutBtn = document.querySelector('.console-logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function (e) {
        e.preventDefault();
        if (confirm('Keluar dari konsol operator?')) {
          if (window.PrintShopAPI) window.PrintShopAPI.logoutOperator();
        }
      });
    }

    // 3. Load Dynamic Analytics & KPIs
    try {
      if (window.PrintShopAPI) {
        const stats = await window.PrintShopAPI.getDashboardStats();
        if (stats && stats.kpi) {
          const kpiValues = document.querySelectorAll('.kpi-metric-value');
          if (kpiValues.length >= 4) {
            kpiValues[0].textContent = formatRupiah(stats.kpi.omzetHariIni);
            kpiValues[1].textContent = `${stats.kpi.antreanAktif} Pesanan`;
            kpiValues[2].textContent = `${stats.kpi.lembarHariIni} Lembar`;
            kpiValues[3].textContent = `${stats.kpi.pesananSelesai} Transaksi`;
          }

          // Dynamic 7-day Bar Chart
          if (stats.chart7Days && stats.chart7Days.length > 0) {
            const barContainer = document.querySelector('.bar-chart-visual');
            if (barContainer) {
              const maxVal = Math.max(...stats.chart7Days.map(d => d.total), 150000);
              const isToday = (idx) => idx === stats.chart7Days.length - 1;

              barContainer.innerHTML = stats.chart7Days.map((d, idx) => {
                const heightPct = Math.max(15, Math.round((d.total / maxVal) * 100));
                const activeClass = isToday(idx) ? ' active' : '';
                const tooltipText = `${formatRupiah(d.total)}${isToday(idx) ? ' (Hari Ini)' : ''}`;

                return `
                  <div class="bar-col${activeClass}">
                    <div class="bar-fill" style="height: ${heightPct}%;">
                      <span class="bar-tooltip">${tooltipText}</span>
                    </div>
                    <span class="bar-label">${d.day}<br><small>${d.date?.slice(5) || ''}</small></span>
                  </div>
                `;
              }).join('');
            }
          }
        }
      }
    } catch (err) {
      console.warn('Dashboard stats load error:', err);
    }

    // 4. Export CSV Action
    const exportBtn = document.getElementById('btn-export-csv-quick') || document.getElementById('btn-export-csv');
    if (exportBtn) {
      exportBtn.addEventListener('click', async function () {
        exportBtn.disabled = true;
        const originalText = exportBtn.innerHTML;
        exportBtn.innerHTML = '<span>Menyiapkan CSV...</span>';

        try {
          let orders = [];
          if (window.PrintShopAPI) {
            orders = await window.PrintShopAPI.getOrders();
          }

          if (!orders || orders.length === 0) {
            orders = [
              { order_code: 'ORD-042', customer_name: 'Budi Santoso', file_name: 'Makalah.pdf', total_pages: 24, total_price: 12000, status: 'WAITING_IN_QUEUE', created_at: new Date().toISOString() },
              { order_code: 'ORD-041', customer_name: 'Rian Pratama', file_name: 'Modul.pdf', total_pages: 32, total_price: 32000, status: 'PRINTING', created_at: new Date().toISOString() }
            ];
          }

          // Generate CSV content
          const headers = ['Order Code', 'Pelanggan', 'No HP', 'Nama Berkas', 'Halaman', 'Salinan', 'Total Biaya', 'Status', 'Tanggal'];
          const rows = orders.map(o => [
            o.order_code,
            `"${(o.customer_name || '').replace(/"/g, '""')}"`,
            o.customer_phone || '-',
            `"${(o.file_name || '').replace(/"/g, '""')}"`,
            o.total_pages || 1,
            o.copies || 1,
            o.total_price || 0,
            o.status,
            o.created_at
          ]);

          const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
          const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);

          const link = document.createElement('a');
          link.setAttribute('href', url);
          link.setAttribute('download', `Laporan-PrintShop-POS-${new Date().toISOString().split('T')[0]}.csv`);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        } catch (e) {
          alert('Gagal mengekspor CSV: ' + e.message);
        } finally {
          exportBtn.disabled = false;
          exportBtn.innerHTML = originalText;
        }
      });
    }

    // 5. Sidebar Toggle on Mobile
    const toggleBtn = document.getElementById('btn-sidebar-toggle');
    const sidebar = document.getElementById('console-sidebar');
    const backdrop = document.getElementById('console-backdrop');

    if (toggleBtn && sidebar && backdrop) {
      toggleBtn.addEventListener('click', function () {
        sidebar.classList.toggle('is-open'); sidebar.classList.toggle('open');
        backdrop.classList.toggle('is-open'); backdrop.classList.toggle('visible');
      });

      backdrop.addEventListener('click', function () {
        sidebar.classList.remove('is-open'); sidebar.classList.remove('open');
        backdrop.classList.remove('is-open'); backdrop.classList.remove('visible');
      });
    }

    // 6. Toggle Table view button
    const toggleTableBtn = document.getElementById('toggle-table-btn');
    const chartTableWrap = document.getElementById('chart-table-wrap');
    if (toggleTableBtn && chartTableWrap) {
      toggleTableBtn.addEventListener('click', function () {
        const isHidden = chartTableWrap.style.display === 'none';
        chartTableWrap.style.display = isHidden ? 'block' : 'none';
        toggleTableBtn.textContent = isHidden ? 'Sembunyikan Tabel' : 'Tampilkan Tabel';
      });
    }
  });
})();
