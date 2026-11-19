/**
 * PrintShop POS — Dynamic Real-time Dashboard & Analytics Controller
 * File: assets/js/dasbor.js
 */

;(function () {
  'use strict';

  let cachedOrders = [];
  let cachedStats = null;
  let activePeriod = 'today'; // 'today' | 'yesterday' | 'week'
  let activeChartBarIdx = 6; // default: Hari Ini (bar ke-7)

  function toLocalDateKey(dateObj) {
    const d = dateObj instanceof Date ? dateObj : new Date(dateObj);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function getPeriodLabel(period) {
    if (period === 'yesterday') return 'Kemarin';
    if (period === 'week') return 'Pekan Ini';
    return 'Hari Ini';
  }

  function filterOrdersByPeriod(orders, period) {
    const now = new Date();
    const todayKey = toLocalDateKey(now);
    const yesterdayDate = new Date(now);
    yesterdayDate.setDate(now.getDate() - 1);
    const yesterdayKey = toLocalDateKey(yesterdayDate);
    const weekStartDate = new Date(now);
    weekStartDate.setDate(now.getDate() - 6);
    const weekStartKey = toLocalDateKey(weekStartDate);

    return (orders || []).filter(o => {
      if (!o.created_at) return false;
      const orderKey = toLocalDateKey(new Date(o.created_at));
      if (period === 'today') return orderKey === todayKey;
      if (period === 'yesterday') return orderKey === yesterdayKey;
      return orderKey >= weekStartKey && orderKey <= todayKey;
    });
  }

  function formatRupiah(num) {
    return 'Rp ' + Number(num || 0).toLocaleString('id-ID');
  }

  function formatTime(isoStr) {
    if (!isoStr) return '--:-- WIB';
    const d = new Date(isoStr);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} WIB`;
  }

  function formatShortDate(isoStr) {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    return `${d.getDate()} ${d.toLocaleDateString('id-ID', { month: 'short' })}`;
  }

  function getStatusBadge(status) {
    switch (status) {
      case 'WAITING_IN_QUEUE':
        return '<span class="status-badge status-badge--waiting">Menunggu</span>';
      case 'PROCESSING':
        return '<span class="status-badge status-badge--processing">Diproses</span>';
      case 'PRINTING':
        return '<span class="status-badge status-badge--printing">Mencetak</span>';
      case 'READY_FOR_PICKUP':
        return '<span class="status-badge status-badge--ready">Siap Ambil</span>';
      case 'COMPLETED':
        return '<span class="status-badge" style="background:#ecfdf5;color:#047857;border:1px solid #a7f3d0;font-weight:700;">Diserahkan</span>';
      case 'CANCELLED':
        return '<span class="status-badge" style="background:#fef2f2;color:#b91c1c;border:1px solid #fecaca;font-weight:600;">Batal</span>';
      default:
        return `<span class="status-badge">${status}</span>`;
    }
  }

  // ── Update All Dashboard Data ──────────────────────────────────────
  async function refreshDashboard() {
    if (!window.PrintShopAPI) return;

    try {
      // 1. Fetch live orders & live stats concurrently
      const [orders, stats] = await Promise.all([
        window.PrintShopAPI.getOrders(),
        window.PrintShopAPI.getDashboardStats()
      ]);

      cachedOrders = Array.isArray(orders) ? orders : [];
      cachedStats = stats || {};

      // 2. Real-time Calculation for Active Period ('today' | 'yesterday' | 'week')
      const periodLabel = getPeriodLabel(activePeriod);
      const periodOrders = filterOrdersByPeriod(cachedOrders, activePeriod);

      // Omzet periode aktif (hanya dari pesanan aktif/selesai, bukan batal/draft)
      const validPeriodOrders = periodOrders.filter(o => !['CANCELLED', 'DRAFT', 'PENDING_PAYMENT'].includes(o.status));
      const liveOmzet = validPeriodOrders.reduce((sum, o) => sum + (Number(o.total_price) || 0), 0);

      // Antrean aktif saat ini
      const activeQueueOrders = cachedOrders.filter(o =>
        ['WAITING_IN_QUEUE', 'PROCESSING', 'PRINTING', 'READY_FOR_PICKUP'].includes(o.status)
      );

      // Lembar tercetak pada periode aktif
      const liveLembar = periodOrders
        .filter(o => ['PRINTING', 'READY_FOR_PICKUP', 'COMPLETED'].includes(o.status))
        .reduce((sum, o) => {
          const spec = o.specifications || {};
          const sheets = spec.sheets_count || o.total_pages || 1;
          const copies = o.copies || 1;
          return sum + (sheets * copies);
        }, 0);

      // Total transaksi selesai pada periode aktif
      const completedPeriodOrders = periodOrders.filter(o => o.status === 'COMPLETED');

      const displayOmzet = liveOmzet;
      const displayAntrean = activeQueueOrders.length;
      const displayLembar = liveLembar;
      const displayTransaksi = completedPeriodOrders.length;

      // ── Update 4 KPI Cards ─────────────────────────────
      const omzetEl = document.getElementById('kpi-omzet');
      const antreanEl = document.getElementById('kpi-antrean');
      const lembarEl = document.getElementById('kpi-lembar');
      const transaksiEl = document.getElementById('kpi-transaksi');

      const omzetCardTitle = omzetEl?.closest('.kpi-metric-card')?.querySelector('.kpi-card-title');
      if (omzetCardTitle) omzetCardTitle.textContent = `Pendapatan ${periodLabel}`;

      const lembarCardTitle = lembarEl?.closest('.kpi-metric-card')?.querySelector('.kpi-card-title');
      if (lembarCardTitle) lembarCardTitle.textContent = `Lembar Tercetak ${periodLabel}`;

      if (omzetEl) omzetEl.textContent = formatRupiah(displayOmzet);
      if (antreanEl) antreanEl.textContent = `${displayAntrean} Pesanan`;
      if (lembarEl) lembarEl.textContent = `${displayLembar} Lembar`;
      if (transaksiEl) transaksiEl.textContent = `${displayTransaksi} Selesai`;

      // Update KPI Card Subtitles dynamically
      const waitingCount = activeQueueOrders.filter(o => o.status === 'WAITING_IN_QUEUE').length;
      const printingCount = activeQueueOrders.filter(o => o.status === 'PRINTING').length;
      const readyCount = activeQueueOrders.filter(o => o.status === 'READY_FOR_PICKUP').length;

      const kpiSubAntrean = document.getElementById('kpi-sub-antrean');
      if (kpiSubAntrean) {
        kpiSubAntrean.textContent = `${printingCount} mencetak, ${waitingCount} menunggu, ${readyCount} siap`;
      }

      const qrisTotal = validPeriodOrders
        .filter(o => (o.payment_method || '').toUpperCase() === 'QRIS')
        .reduce((s, o) => s + (Number(o.total_price) || 0), 0);
      const tunaiTotal = Math.max(0, displayOmzet - qrisTotal);

      const kpiSubOmzet = document.getElementById('kpi-sub-omzet');
      if (kpiSubOmzet) {
        const avgOrder = validPeriodOrders.length > 0 ? Math.round(displayOmzet / validPeriodOrders.length) : 0;
        kpiSubOmzet.textContent = `QRIS: ${formatRupiah(qrisTotal)} • Tunai: ${formatRupiah(tunaiTotal)} • Rata-rata: ${formatRupiah(avgOrder)}/order`;
      }

      // ── Update Audit Reconcile Banner ──────────────────
      const auditLembar = document.getElementById('audit-lembar-count');
      if (auditLembar) auditLembar.textContent = `${displayLembar} halaman`;

      const auditSync = document.getElementById('audit-spooler-sync');
      if (auditSync) {
        const now = new Date();
        auditSync.textContent = `Spooler Sync: ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} WIB`;
      }

      // ── Update Dynamic 7-Day Chart (100% Real Data) ────
      const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
      const chart7Days = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateKey = toLocalDateKey(d);
        const dayOrders = cachedOrders.filter(o => o.created_at && toLocalDateKey(new Date(o.created_at)) === dateKey);
        const validDayOrders = dayOrders.filter(o => !['CANCELLED', 'DRAFT', 'PENDING_PAYMENT'].includes(o.status));
        const dayTotal = validDayOrders.reduce((sum, o) => sum + (Number(o.total_price) || 0), 0);
        const daySheets = dayOrders
          .filter(o => ['PRINTING', 'READY_FOR_PICKUP', 'COMPLETED'].includes(o.status))
          .reduce((sum, o) => {
            const spec = o.specifications || {};
            const sheets = spec.sheets_count || o.total_pages || 1;
            const copies = o.copies || 1;
            return sum + (sheets * copies);
          }, 0);

        const shortDate = `${d.getDate()} ${d.toLocaleDateString('id-ID', { month: 'short' })}`;
        const fullDate = `${d.getDate()} ${d.toLocaleDateString('id-ID', { month: 'short' })} ${d.getFullYear()}`;
        chart7Days.push({
          dateKey,
          shortDate,
          fullDate,
          day: days[d.getDay()],
          txCount: validDayOrders.length,
          sheetCount: daySheets,
          total: dayTotal
        });
      }

      const total7Days = chart7Days.reduce((sum, d) => sum + d.total, 0);
      const avg7Days = Math.round(total7Days / 7);
      const chartSubtitle = document.getElementById('chart-7day-subtitle');
      if (chartSubtitle && chart7Days.length === 7) {
        const yearNow = new Date().getFullYear();
        chartSubtitle.textContent = `${chart7Days[0].shortDate} – ${chart7Days[6].shortDate} ${yearNow} • Rata-rata: ${formatRupiah(avg7Days)}/hari`;
      }

      const barContainer = document.getElementById('bar-chart-container') || document.querySelector('.bar-chart-visual');
      if (barContainer && chart7Days.length > 0) {
        const maxVal = Math.max(...chart7Days.map(d => d.total), 1);
        const isToday = (idx) => idx === chart7Days.length - 1;
        if (activeChartBarIdx < 0 || activeChartBarIdx >= chart7Days.length) {
          activeChartBarIdx = chart7Days.length - 1;
        }

        barContainer.innerHTML = chart7Days.map((d, idx) => {
          const heightPct = d.total > 0 ? Math.max(18, Math.round((d.total / maxVal) * 100)) : 10;
          const activeClass = idx === activeChartBarIdx ? ' active' : '';
          const revenueClass = d.total > 0 ? ' has-revenue' : '';
          const tooltipText = `${formatRupiah(d.total)}${isToday(idx) ? ' (Hari Ini)' : ` (${d.shortDate})`}`;

          return `
            <div class="bar-col${activeClass}${revenueClass}" data-bar-idx="${idx}">
              <div class="bar-fill" style="height: ${heightPct}%;">
                <span class="bar-tooltip">${tooltipText}</span>
              </div>
              <span class="bar-label">${d.day}<br><small>${d.shortDate}</small></span>
            </div>
          `;
        }).join('');

        const barCols = barContainer.querySelectorAll('.bar-col[data-bar-idx]');
        barCols.forEach(col => {
          const activateBar = () => {
            activeChartBarIdx = parseInt(col.dataset.barIdx, 10);
            barCols.forEach(c => c.classList.remove('active'));
            col.classList.add('active');
          };
          col.addEventListener('click', activateBar);
          col.addEventListener('mouseenter', activateBar);
        });
      }

      // Update Chart Legends
      const legendToday = document.getElementById('legend-today');
      if (legendToday && chart7Days.length > 0) {
        legendToday.textContent = formatRupiah(chart7Days[chart7Days.length - 1].total);
      }

      const legendTotal = document.getElementById('legend-total-7days');
      if (legendTotal) {
        legendTotal.textContent = formatRupiah(total7Days);
      }

      // ── Update 7-Day Semantic Table (100% Real Data) ───
      const tableTbody = document.getElementById('chart-table-tbody');
      const tableTfoot = document.getElementById('chart-table-tfoot');
      if (tableTbody && chart7Days.length > 0) {
        tableTbody.innerHTML = chart7Days.map((d, idx) => {
          const isTodayRow = idx === chart7Days.length - 1;
          const rowStyle = isTodayRow ? 'style="background: #ecfdf5; font-weight: 700;"' : '';
          const priceColor = isTodayRow ? 'style="color: #065f46;"' : '';
          const dayLabel = isTodayRow ? `${d.day} (Hari Ini)` : d.day;

          return `
            <tr ${rowStyle}>
              <td>${d.fullDate}</td>
              <td>${dayLabel}</td>
              <td>${d.txCount}</td>
              <td>${d.sheetCount}</td>
              <td ${priceColor}>${formatRupiah(d.total)}</td>
            </tr>
          `;
        }).join('');

        if (tableTfoot) {
          const total7Tx = chart7Days.reduce((s, d) => s + d.txCount, 0);
          const total7Sheets = chart7Days.reduce((s, d) => s + d.sheetCount, 0);
          tableTfoot.innerHTML = `
            <tr>
              <th scope="row" colspan="2">Total 7 Hari</th>
              <td>${total7Tx} transaksi</td>
              <td>${total7Sheets} lembar</td>
              <td><strong>${formatRupiah(total7Days)}</strong></td>
            </tr>
          `;
        }
      }

      // ── Update Categories Breakdown (Filtered by Active Period) ──
      const bwOrders = validPeriodOrders.filter(o => !(o.specifications?.color_mode || '').includes('Color') && !(o.specifications?.paper_size || '').includes('F4') && !(o.specifications?.paper_size || '').includes('Folio'));
      const colorOrders = validPeriodOrders.filter(o => (o.specifications?.color_mode || '').includes('Color'));
      const folioOrders = validPeriodOrders.filter(o => (o.specifications?.paper_size || '').includes('F4') || (o.specifications?.paper_size || '').includes('Folio'));

      const bwTotal = bwOrders.reduce((s, o) => s + (Number(o.total_price) || 0), 0);
      const colorTotal = colorOrders.reduce((s, o) => s + (Number(o.total_price) || 0), 0);
      const folioTotal = folioOrders.reduce((s, o) => s + (Number(o.total_price) || 0), 0);
      const allOrdersTotal = bwTotal + colorTotal + folioTotal;

      const bwPct = allOrdersTotal > 0 ? Math.round((bwTotal / allOrdersTotal) * 100) : 0;
      const colorPct = allOrdersTotal > 0 ? Math.round((colorTotal / allOrdersTotal) * 100) : 0;
      const folioPct = allOrdersTotal > 0 ? Math.max(0, 100 - bwPct - colorPct) : 0;

      const catContainer = document.getElementById('category-breakdown-list');
      if (catContainer) {
        catContainer.innerHTML = `
          <div>
            <div class="category-row-head">
              <strong>Cetak Hitam-Putih A4</strong>
              <span>${formatRupiah(bwTotal)} (${bwPct}%) &bull; ${bwOrders.length} Pesanan</span>
            </div>
            <div class="progress-track" role="progressbar" aria-valuenow="${bwPct}" aria-valuemin="0" aria-valuemax="100">
              <div class="progress-bar-fill c-green" style="width: ${bwPct}%;"></div>
            </div>
          </div>
          <div>
            <div class="category-row-head">
              <strong>Cetak Warna A4</strong>
              <span>${formatRupiah(colorTotal)} (${colorPct}%) &bull; ${colorOrders.length} Pesanan</span>
            </div>
            <div class="progress-track" role="progressbar" aria-valuenow="${colorPct}" aria-valuemin="0" aria-valuemax="100">
              <div class="progress-bar-fill c-blue" style="width: ${colorPct}%;"></div>
            </div>
          </div>
          <div>
            <div class="category-row-head">
              <strong>Cetak F4 (Folio) &amp; Khusus</strong>
              <span>${formatRupiah(folioTotal)} (${folioPct}%) &bull; ${folioOrders.length} Pesanan</span>
            </div>
            <div class="progress-track" role="progressbar" aria-valuenow="${folioPct}" aria-valuemin="0" aria-valuemax="100">
              <div class="progress-bar-fill c-amber" style="width: ${folioPct}%;"></div>
            </div>
          </div>
        `;
      }

      const catOmzet = document.getElementById('category-total-omzet');
      if (catOmzet) catOmzet.textContent = formatRupiah(displayOmzet);

      const catVol = document.getElementById('category-total-volume');
      if (catVol) catVol.textContent = `${displayLembar} Lembar (${periodOrders.length} Pesanan)`;

      // ── Update Printer Active Task ─────────────────────
      const printingOrder = cachedOrders.find(o => o.status === 'PRINTING');
      const p1Task = document.getElementById('printer-1-task');
      if (p1Task) {
        if (printingOrder) {
          p1Task.innerHTML = `Tugas Aktif: <strong style="color:#0f766e; font-weight:600;">Mencetak #${printingOrder.order_code} (${printingOrder.file_name})</strong>`;
        } else {
          p1Task.innerHTML = `Tugas Aktif: <strong style="color:#059669;">Siap (Standby / Menunggu antrean)</strong>`;
        }
      }

      // ── Update Realtime Recent Orders Table (Filtered by Active Period) ──
      const recentTbody = document.getElementById('dashboard-recent-tbody');
      if (recentTbody) {
        const sorted = [...periodOrders].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 7);

        if (sorted.length === 0) {
          recentTbody.innerHTML = `
            <tr>
              <td colspan="6" style="text-align: center; padding: 24px; color: var(--muted);">
                Belum ada data transaksi pada periode ${periodLabel}.
              </td>
            </tr>
          `;
        } else {
          recentTbody.innerHTML = sorted.map(o => {
            const spec = o.specifications || {};
            const isColor = (spec.color_mode || '').includes('Color');
            return `
              <tr>
                <td><strong class="order-id">${o.order_code}</strong></td>
                <td><time>${formatTime(o.created_at)}</time></td>
                <td>
                  <strong>${o.customer_name || 'Tamu Walk-In'}</strong>
                  <br><small style="color:var(--muted);">${o.file_name}</small>
                </td>
                <td>
                  <span class="spec-tag">${spec.paper_size || 'A4'}</span>
                  <span class="spec-tag ${isColor ? 'spec-tag--color' : ''}">${isColor ? 'Color' : 'B&W'}</span>
                  <span class="spec-tag">${o.copies || 1} Copy</span>
                </td>
                <td><strong>${formatRupiah(o.total_price)}</strong></td>
                <td>${getStatusBadge(o.status)}</td>
              </tr>
            `;
          }).join('');
        }
      }

    } catch (err) {
      console.warn('[Dashboard] Refresh error:', err);
    }
  }

  // ── CSV & Report Exporter ───────────────────────────────────────────
  function escapeCsvCell(val) {
    return `"${String(val ?? '').replace(/"/g, '""')}"`;
  }

  async function exportOrdersToCsv(filename = null, dateRange = null) {
    let orders = cachedOrders;
    if (!orders || orders.length === 0) {
      if (window.PrintShopAPI) {
        orders = await window.PrintShopAPI.getOrders();
      }
    }

    let filtered = orders || [];
    let periodSlug = activePeriod === 'yesterday' ? 'kemarin' : (activePeriod === 'week' ? 'pekan-ini' : 'hari-ini');

    if (dateRange && dateRange.dari && dateRange.sampai) {
      filtered = filtered.filter(o => {
        if (!o.created_at) return false;
        const key = toLocalDateKey(new Date(o.created_at));
        return key >= dateRange.dari && key <= dateRange.sampai;
      });
      periodSlug = `${dateRange.dari}_sd_${dateRange.sampai}`;
    } else {
      filtered = filterOrdersByPeriod(filtered, activePeriod);
    }

    if (filtered.length === 0) {
      return { exported: false, count: 0 };
    }

    const headers = [
      'ID Pesanan',
      'Tanggal & Waktu',
      'Nama Pelanggan',
      'Nama Berkas',
      'Spesifikasi',
      'Halaman',
      'Copy',
      'Printer',
      'Metode Bayar',
      'Total Tagihan (Rp)',
      'Status'
    ];

    let totalPagesSum = 0;
    let totalCopiesSum = 0;
    let totalPriceSum = 0;

    const rows = filtered.map((o) => {
      const spec = o.specifications || o.spec || {};
      const paper = spec.paper_size || o.paper || 'A4';
      const color = (spec.color_mode || o.color || '').toLowerCase().includes('color') ? 'Full Color' : 'B&W';
      const side = (spec.print_side || o.side || 'Simplex').toLowerCase().includes('duplex') ? 'Duplex' : 'Simplex';
      const finishing = spec.finishing || o.finishing || 'Tanpa Jilid';
      const pages = Number(o.total_pages || o.pages || 1);
      const copies = Number(o.copies || 1);
      const price = Number(o.total_price || 0);
      const printer = o.printer_name || spec.printer || 'Printer 1 - HP LaserJet';
      const paymentMethod = o.payment_method || (o.payment && o.payment.method) || 'TUNAI';
      const dateStr = new Date(o.created_at || Date.now()).toLocaleString('id-ID', {
        year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
      });

      totalPagesSum += pages;
      totalCopiesSum += copies;
      totalPriceSum += price;

      return [
        escapeCsvCell(o.order_code || o.id || ''),
        escapeCsvCell(dateStr),
        escapeCsvCell(o.customer_name || 'Tamu Walk-In'),
        escapeCsvCell(o.file_name || 'Dokumen.pdf'),
        escapeCsvCell(`${paper} • ${color} • ${side} • ${finishing}`),
        pages,
        copies,
        escapeCsvCell(printer),
        escapeCsvCell(paymentMethod),
        price,
        escapeCsvCell(o.status || 'COMPLETED')
      ];
    });

    const summaryRow = [
      escapeCsvCell(`TOTAL (${filtered.length} Transaksi)`),
      '""',
      '""',
      '""',
      '""',
      totalPagesSum,
      totalCopiesSum,
      '""',
      '""',
      totalPriceSum,
      '""'
    ];

    // Prepend UTF-8 BOM (\uFEFF) for Microsoft Excel & Google Sheets compatibility
    const csvContent = '\uFEFF' + [
      headers.map(escapeCsvCell).join(','),
      ...rows.map(r => r.join(',')),
      summaryRow.join(',')
    ].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const defaultFilename = `laporan-dasbor-${periodSlug}-${toLocalDateKey(new Date())}.csv`;
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename || defaultFilename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return { exported: true, count: filtered.length, filename: filename || defaultFilename };
  }

  // ── PDF Official Report Generator ──────────────────────────────────
  async function exportOrdersToPdf(dateRange = null) {
    let orders = cachedOrders;
    if (!orders || orders.length === 0) {
      if (window.PrintShopAPI) {
        orders = await window.PrintShopAPI.getOrders();
      }
    }

    let filtered = orders || [];
    if (dateRange && dateRange.dari && dateRange.sampai) {
      filtered = filtered.filter(o => {
        if (!o.created_at) return false;
        const key = toLocalDateKey(new Date(o.created_at));
        return key >= dateRange.dari && key <= dateRange.sampai;
      });
    }

    if (filtered.length === 0) {
      return { exported: false, count: 0 };
    }

    const session = window.PrintShopAPI ? window.PrintShopAPI.getOperatorSession() : null;
    const operatorName = session?.name || 'Ahmad Hidayat';
    const stationLabel = session?.station_name || session?.loket_id || 'Loket 1';
    const totalOmzet = filtered.reduce((acc, o) => acc + (o.status !== 'CANCELLED' ? (o.total_price || 0) : 0), 0);
    const totalLembar = filtered.reduce((acc, o) => {
      const side = (o.specifications?.print_side || o.side || 'Simplex');
      const p = Number(o.total_pages || o.pages || 1);
      const c = Number(o.copies || 1);
      return acc + (Math.ceil(p / (side.includes('Duplex') ? 2 : 1)) * c);
    }, 0);

    let iframe = document.getElementById('report-print-frame');
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'report-print-frame';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);
    }

    const tableRows = filtered.map((o, idx) => {
      const spec = o.specifications || o.spec || {};
      const paper = spec.paper_size || o.paper || 'A4';
      const color = (spec.color_mode || o.color || '').toLowerCase().includes('color') ? 'Color' : 'B/W';
      const side = (spec.print_side || o.side || 'Simplex').toLowerCase().includes('duplex') ? 'Duplex' : 'Simplex';
      const pages = Number(o.total_pages || o.pages || 1);
      const copies = Number(o.copies || 1);
      const sheets = Math.ceil(pages / (side.includes('Duplex') ? 2 : 1)) * copies;
      const dateStr = new Date(o.created_at || Date.now()).toLocaleString('id-ID', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
      });

      return `
        <tr>
          <td style="text-align:center; padding:6px 4px; border:1px solid #cbd5e1;">${idx + 1}</td>
          <td style="padding:6px 8px; border:1px solid #cbd5e1; font-weight:bold;">${o.order_code || o.id}</td>
          <td style="padding:6px 8px; border:1px solid #cbd5e1;">${dateStr}</td>
          <td style="padding:6px 8px; border:1px solid #cbd5e1;">${o.customer_name || 'Walk-In'}</td>
          <td style="padding:6px 8px; border:1px solid #cbd5e1; word-break:break-all;">${o.file_name || '-'}</td>
          <td style="padding:6px 8px; border:1px solid #cbd5e1; font-size:10px;">${paper} • ${color} • ${side}</td>
          <td style="text-align:center; padding:6px 4px; border:1px solid #cbd5e1;">${sheets}</td>
          <td style="text-align:right; padding:6px 8px; border:1px solid #cbd5e1; font-weight:bold;">Rp${Number(o.total_price || 0).toLocaleString('id-ID')}</td>
          <td style="text-align:center; padding:6px 4px; border:1px solid #cbd5e1; font-size:10px;">${o.status}</td>
        </tr>
      `;
    }).join('');

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Laporan PrintShop POS</title>
        <style>
          @page { size: A4 landscape; margin: 12mm 15mm; }
          body { font-family: system-ui, -apple-system, sans-serif; font-size: 11px; color: #0f172a; margin: 0; padding: 10px; }
          .header { border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end; }
          .title { font-size: 20px; font-weight: 800; color: #0f172a; }
          .sub { font-size: 12px; color: #64748b; margin-top: 2px; }
          .kpi-boxes { display: flex; gap: 16px; margin-bottom: 16px; }
          .kpi-card { flex: 1; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 14px; background: #f8fafc; }
          .kpi-card-label { font-size: 10.5px; color: #64748b; text-transform: uppercase; font-weight: 700; }
          .kpi-card-val { font-size: 18px; font-weight: 800; color: #0f172a; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 10.5px; }
          th { background: #f1f5f9; padding: 8px 6px; border: 1px solid #94a3b8; font-weight: 700; text-align: left; }
          .footer { margin-top: 24px; display: flex; justify-content: space-between; font-size: 11px; color: #64748b; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="title">PRINTSHOP POS — LAPORAN REKAPITULASI TRANSAKSI</div>
            <div class="sub">Platform Self-Service Digital Print • Gerai Ruko Kampus</div>
          </div>
          <div style="text-align:right;">
            <div><strong>Periode:</strong> ${dateRange ? `${dateRange.dari} s.d. ${dateRange.sampai}` : 'Semua Data'}</div>
            <div class="sub">Dicetak oleh: ${operatorName} (${stationLabel})</div>
          </div>
        </div>

        <div class="kpi-boxes">
          <div class="kpi-card">
            <div class="kpi-card-label">Total Omzet Tervalidasi</div>
            <div class="kpi-card-val" style="color:#059669;">Rp${totalOmzet.toLocaleString('id-ID')}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-card-label">Jumlah Transaksi</div>
            <div class="kpi-card-val">${filtered.length} Pesanan</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-card-label">Total Lembar Fisik</div>
            <div class="kpi-card-val">${totalLembar} Lembar</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width:30px; text-align:center;">No</th>
              <th style="width:75px;">No. Order</th>
              <th style="width:105px;">Tanggal</th>
              <th style="width:110px;">Pelanggan</th>
              <th>Nama Dokumen</th>
              <th style="width:130px;">Spesifikasi</th>
              <th style="width:55px; text-align:center;">Lembar</th>
              <th style="width:85px; text-align:right;">Biaya</th>
              <th style="width:85px; text-align:center;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>

        <div class="footer">
          <div>Laporan resmi dihasilkan otomatis oleh sistem PrintShop POS.</div>
          <div>Tanggal cetak: ${new Date().toLocaleString('id-ID')}</div>
        </div>
      </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    }, 250);
  }

  // ── Main Init ──────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', async function () {
    // 1. Check Authentication Guard
    const session = window.PrintShopAPI ? window.PrintShopAPI.getOperatorSession() : null;
    if (!session) {
      window.location.href = 'login.html';
      return;
    }

    // 2. Set Operator Info & Isolated Station
    const userNameEl = document.querySelector('.console-user-name');
    const userRoleEl = document.querySelector('.console-user-role');
    const userAvatarEl = document.querySelector('.console-user-avatar');
    const sessionInfoEl = document.getElementById('dasbor-operator-session-info');

    const stationLabel = session.station_name || session.loket_id || 'Loket 1';
    if (userNameEl) userNameEl.textContent = session.name || 'Ahmad Hidayat';
    if (userRoleEl) userRoleEl.innerHTML = `${stationLabel} | Online`;
    if (userAvatarEl && session.name) {
      userAvatarEl.textContent = session.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    }
    if (sessionInfoEl) {
      sessionInfoEl.innerHTML = `Operator: <strong>${session.name || 'Operator'}</strong> | Sesi Aktif: <strong>${stationLabel}</strong>`;
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

    // 3. Live Clock Update
    const clockEl = document.getElementById('live-clock');
    function updateLiveClock() {
      if (!clockEl) return;
      const now = new Date();
      const opts = { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' };
      clockEl.textContent = now.toLocaleDateString('id-ID', opts) + ' WIB';
    }
    updateLiveClock();
    setInterval(updateLiveClock, 10000);

    // 4. Set Default Export Date Range (Dynamic)
    const dariInput = document.getElementById('periode-dari');
    const sampaiInput = document.getElementById('periode-sampai');
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    if (sampaiInput && !sampaiInput.value) sampaiInput.value = todayStr;
    if (dariInput && !dariInput.value) dariInput.value = thirtyDaysAgo;

    // 5. Export CSV Quick Actions
    const exportBtn = document.getElementById('btn-export-csv-quick');
    const quickExportCard = document.getElementById('btn-quick-export-csv-card');

    function showExportToast(msg, isError = false) {
      const exportToast = document.getElementById('export-toast');
      if (!exportToast) return;
      exportToast.style.display = 'block';
      exportToast.style.background = isError ? '#fef2f2' : '#ecfdf5';
      exportToast.style.borderColor = isError ? '#fecaca' : '#a7f3d0';
      exportToast.style.color = isError ? '#dc2626' : '#065f46';
      exportToast.textContent = msg;
      clearTimeout(exportToast._timer);
      exportToast._timer = setTimeout(() => { exportToast.style.display = 'none'; }, 4500);
    }

    async function handleQuickCsvExport(btn) {
      if (btn) btn.disabled = true;
      const originalText = btn ? btn.innerHTML : '';
      if (btn) btn.innerHTML = '<span>Menyiapkan CSV...</span>';
      try {
        const res = await exportOrdersToCsv();
        if (res && !res.exported) {
          showExportToast(`Tidak ada data transaksi pada periode ${getPeriodLabel(activePeriod)}.`, true);
        } else {
          showExportToast(`Laporan CSV periode ${getPeriodLabel(activePeriod)} (${res.count} transaksi) berhasil diunduh!`);
        }
      } catch (e) {
        showExportToast('Gagal mengekspor CSV: ' + e.message, true);
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = originalText;
        }
      }
    }

    if (exportBtn) {
      exportBtn.addEventListener('click', () => handleQuickCsvExport(exportBtn));
    }
    if (quickExportCard) {
      quickExportCard.addEventListener('click', (e) => {
        e.preventDefault();
        handleQuickCsvExport(null);
      });
    }

    // 6. Form Ekspor Berkas (Date range filter + CSV / PDF)
    const exportForm = document.getElementById('form-ekspor');

    if (exportForm) {
      exportForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        const submitBtn = document.getElementById('btn-submit-export');
        const format = document.getElementById('format-ekspor').value;
        const dari = document.getElementById('periode-dari').value;
        const sampai = document.getElementById('periode-sampai').value;

        if (dari && sampai && dari > sampai) {
          showExportToast('Tanggal mulai tidak boleh lebih besar dari tanggal akhir.', true);
          return;
        }

        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = '<span>Memproses Laporan...</span>';
        }

        try {
          const dateRange = (dari && sampai) ? { dari, sampai } : null;
          if (format === 'csv') {
            const res = await exportOrdersToCsv(`laporan-dasbor-${dari}_sd_${sampai}.csv`, dateRange);
            if (res && !res.exported) {
              showExportToast(`Tidak ada data pesanan pada rentang ${dari} s.d. ${sampai}.`, true);
            } else {
              showExportToast(`Laporan periode ${dari} s.d. ${sampai} (${res.count} transaksi CSV) berhasil diunduh.`);
            }
          } else {
            const pdfRes = await exportOrdersToPdf(dateRange);
            if (pdfRes && pdfRes.exported === false) {
              showExportToast(`Tidak ada data pesanan pada rentang ${dari} s.d. ${sampai}.`, true);
            } else {
              showExportToast(`Laporan periode ${dari} s.d. ${sampai} (PDF) berhasil dihasilkan.`);
            }
          }
        } catch (err) {
          showExportToast('Gagal memproses laporan: ' + err.message, true);
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              <span>Unduh Laporan</span>
            `;
          }
        }
      });
    }

    // 6. Mobile Sidebar Toggle
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

    // 7. Toggle Table view button
    const toggleTableBtn = document.getElementById('toggle-table-btn');
    const chartTableWrap = document.getElementById('chart-table-wrap');
    if (toggleTableBtn && chartTableWrap) {
      toggleTableBtn.addEventListener('click', function () {
        const isHidden = chartTableWrap.style.display === 'none';
        chartTableWrap.style.display = isHidden ? 'block' : 'none';
        toggleTableBtn.textContent = isHidden ? 'Sembunyikan Tabel' : 'Tampilkan Tabel';
      });
    }

    // 8. Filter buttons (Hari Ini | Kemarin | Pekan Ini)
    const filterBtns = document.querySelectorAll('.date-filter-btn');
    filterBtns.forEach(btn => {
      btn.addEventListener('click', function () {
        filterBtns.forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        const label = (this.textContent || '').trim().toLowerCase();
        if (label.includes('kemarin')) {
          activePeriod = 'yesterday';
        } else if (label.includes('pekan')) {
          activePeriod = 'week';
        } else {
          activePeriod = 'today';
        }
        refreshDashboard();
      });
    });

    // 9. Initial Load & Polling every 4 seconds for real-time live updates
    await refreshDashboard();

    if (window.PrintShopAPI && typeof window.PrintShopAPI.subscribeToOrders === 'function') {
      window.PrintShopAPI.subscribeToOrders(() => {
        refreshDashboard();
      }, 4000);
    }
  });
})();
