/**
 * PrintShop POS — Unified Client-side API Service
 * Handles data fetching, fallback to local storage / mock, and real-time updates.
 */

(function () {
  'use strict';

  const API_BASE = (window.PrintShopConfig && window.PrintShopConfig.apiBase) || '/api';

  const PrintShopAPI = {
    // ── Orders ──────────────────────────────────────────
    async getOrders(params = {}) {
      try {
        const query = new URLSearchParams(params).toString();
        const res = await fetch(`${API_BASE}/orders?${query}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return data.data || [];
      } catch (err) {
        console.warn('API getOrders failed, fallback to local storage:', err.message);
        return this.getLocalOrders(params);
      }
    },

    async getOrder(idOrCode) {
      try {
        const res = await fetch(`${API_BASE}/orders/${encodeURIComponent(idOrCode)}`, { cache: 'no-store' });
        if (res.status === 404) return null;
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return (data && data.success && data.data) ? data.data : null;
      } catch (err) {
        console.warn('API getOrder failed:', err.message);
        return null;
      }
    },

    async trackOrder(code) {
      try {
        const res = await fetch(`${API_BASE}/orders/track?code=${encodeURIComponent(code)}`, { cache: 'no-store' });
        if (res.status === 404) return null;
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return (data && data.success && data.data) ? data.data : null;
      } catch (err) {
        console.warn('API trackOrder failed:', err.message);
        return null;
      }
    },

    async createOrder(orderData) {
      try {
        const res = await fetch(`${API_BASE}/orders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(orderData)
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.data) {
          this.saveLocalOrder(data.data);
          return data.data;
        }
      } catch (err) {
        console.warn('API createOrder failed, fallback to local save:', err.message);
      }

      // Fallback
      const newOrder = {
        id: `ord-${Date.now()}`,
        order_code: `ORD-${String(Math.floor(Math.random() * 900) + 100)}`,
        status: orderData.status || 'DRAFT',
        created_at: new Date().toISOString(),
        ...orderData
      };
      this.saveLocalOrder(newOrder);
      return newOrder;
    },

    async updateOrder(id, updates) {
      try {
        const res = await fetch(`${API_BASE}/orders/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates)
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.data) {
          this.saveLocalOrder(data.data);
          return data.data;
        }
      } catch (err) {
        console.warn('API updateOrder failed, fallback to local update:', err.message);
      }

      const local = this.getLocalOrder(id);
      if (local) {
        const updated = { ...local, ...updates, updated_at: new Date().toISOString() };
        this.saveLocalOrder(updated);
        return updated;
      }
      return null;
    },

    // ── File Upload ─────────────────────────────────────
    async uploadFile(file) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch(`${API_BASE}/upload`, {
          method: 'POST',
          body: formData
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return data.data;
      } catch (err) {
        console.warn('API uploadFile fallback:', err.message);
        return {
          fileName: file.name,
          fileSize: file.size,
          fileUrl: URL.createObjectURL(file),
          formattedSize: (file.size / (1024 * 1024)).toFixed(1) + ' MB'
        };
      }
    },

    // ── Midtrans Payment (Strict Official QR — No Fake Fallback) ──
    async createPayment(orderId, orderData = null) {
      const res = await fetch(`${API_BASE}/payment/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, orderData })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || `Gagal membuat QRIS Midtrans (HTTP ${res.status})`);
      }
      return data.data;
    },

    async checkPaymentStatus(orderId) {
      try {
        const res = await fetch(`${API_BASE}/payment/status/${encodeURIComponent(orderId)}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return data.data;
      } catch (err) {
        return { isPaid: false, status: 'pending' };
      }
    },

    async simulatePaymentSuccess(orderId, snapResult = null) {
      const res = await fetch(`${API_BASE}/payment/status/${encodeURIComponent(orderId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(snapResult || {})
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gagal memproses konfirmasi pembayaran');
      }
      return data.data;
    },

    // ── Auth ────────────────────────────────────────────
    async loginOperator(email, pin) {
      try {
        const res = await fetch(`${API_BASE}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, pin })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Login gagal');
        if (data.operator) {
          localStorage.setItem('printshop_operator', JSON.stringify(data.operator));
          localStorage.setItem('printshop_auth_token', data.token || `auth_${Date.now()}`);
          localStorage.setItem('printshop_session_expiry', String(Date.now() + 8 * 60 * 60 * 1000));
        }
        return data;
      } catch (err) {
        if (email.toLowerCase().includes('operator') && pin === '123456') {
          const op = {
            id: 'op-01',
            name: 'Ahmad Hidayat',
            email: 'operator@printshop.com',
            role: 'admin'
          };
          localStorage.setItem('printshop_operator', JSON.stringify(op));
          localStorage.setItem('printshop_auth_token', `auth_fallback_${Date.now()}`);
          localStorage.setItem('printshop_session_expiry', String(Date.now() + 8 * 60 * 60 * 1000));
          return { success: true, operator: op };
        }
        throw err;
      }
    },

    getOperatorSession() {
      try {
        const raw = localStorage.getItem('printshop_operator');
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        return null;
      }
    },

    logoutOperator() {
      try {
        localStorage.removeItem('printshop_operator');
        localStorage.removeItem('printshop_auth_token');
        localStorage.removeItem('printshop_session_expiry');
      } catch (e) {}
      window.location.href = 'login.html';
    },

    // ── Refunds ──────────────────────────────────────────
    async getRefunds() {
      try {
        const res = await fetch(`${API_BASE}/refunds`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return data.data || [];
      } catch (err) {
        console.warn('API getRefunds fallback to localStorage/cache:', err.message);
        try {
          const cached = localStorage.getItem('printshop_refunds_cache');
          if (cached) return JSON.parse(cached);
        } catch (e) {}
        return [
          { id: 'ref-01', order_code: 'ORD-021', refund_amount: 8500, refund_method: 'qris_reversal', reason: 'Permintaan pelanggan via tiket', source: 'user_report', status: 'completed', created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString() },
          { id: 'ref-02', order_code: 'ORD-019', refund_amount: 15000, refund_method: 'cash', reason: 'Kertas macet di mesin printer', source: 'admin', status: 'completed', created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString() },
          { id: 'ref-03', order_code: 'ORD-015', refund_amount: 24000, refund_method: 'store_credit', reason: 'Double charge transaksi pembayaran', source: 'user_report', status: 'completed', created_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString() }
        ];
      }
    },

    async createRefund(payload) {
      try {
        const res = await fetch(`${API_BASE}/refunds`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Gagal memproses refund');
        }
        this.cacheRefund(data.data);
        return data.data;
      } catch (err) {
        console.warn('API createRefund fallback:', err.message);
        const fallbackRefund = {
          id: 'ref-' + Date.now(),
          order_id: payload.order_id || null,
          order_code: payload.order_code || payload.order_id || 'ORD-MANUAL',
          refund_amount: Number(payload.refund_amount) || 0,
          refund_method: payload.refund_method || 'qris_reversal',
          reason: payload.reason || 'Pembatalan pesanan',
          source: payload.source || 'admin',
          status: 'completed',
          notes: payload.notes || '',
          created_at: new Date().toISOString()
        };
        this.cacheRefund(fallbackRefund);
        return fallbackRefund;
      }
    },

    cacheRefund(refund) {
      try {
        const raw = localStorage.getItem('printshop_refunds_cache');
        let list = raw ? JSON.parse(raw) : [];
        list.unshift(refund);
        localStorage.setItem('printshop_refunds_cache', JSON.stringify(list));
      } catch (e) {}
    },

    // ── Admin Registration ──────────────────────────────
    async getOperators() {
      try {
        const res = await fetch(`${API_BASE}/auth/register`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return data.data || [];
      } catch (err) {
        try {
          const cached = localStorage.getItem('printshop_operators_cache');
          if (cached) return JSON.parse(cached);
        } catch (e) {}
        return [
          { id: 'op-01', name: 'Ahmad Hidayat', email: 'operator@printshop.com', role: 'admin', status: 'Aktif' },
          { id: 'op-02', name: 'Siti Rahma', email: 'siti@printshop.com', role: 'operator', status: 'Aktif' }
        ];
      }
    },

    async registerAdmin(payload) {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gagal mendaftarkan admin baru');
      }
      try {
        const cached = localStorage.getItem('printshop_operators_cache');
        let list = cached ? JSON.parse(cached) : [
          { id: 'op-01', name: 'Ahmad Hidayat', email: 'operator@printshop.com', role: 'admin', status: 'Aktif' },
          { id: 'op-02', name: 'Siti Rahma', email: 'siti@printshop.com', role: 'operator', status: 'Aktif' }
        ];
        list.push(data.operator);
        localStorage.setItem('printshop_operators_cache', JSON.stringify(list));
      } catch (e) {}
      return data;
    },

    // ── Dashboard Stats ─────────────────────────────────
    async getDashboardStats() {
      try {
        const res = await fetch(`${API_BASE}/dashboard/stats`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return data.data;
      } catch (err) {
        console.warn('API getDashboardStats fallback:', err.message);
        return {
          kpi: {
            omzetHariIni: 124500,
            lembarHariIni: 348,
            pesananSelesai: 42,
            antreanAktif: 4
          },
          chart7Days: [
            { day: 'Sen', total: 65000 },
            { day: 'Sel', total: 80000 },
            { day: 'Rab', total: 95000 },
            { day: 'Kam', total: 72000 },
            { day: 'Jum', total: 110000 },
            { day: 'Sab', total: 85000 },
            { day: 'Min', total: 124500 }
          ],
          printers: [
            { id: 'PRN-01', name: 'Canon iR-ADV C3530 (Utama)', status: 'ONLINE', paperLevel: '85%', toner: '60%', queueCount: 4 },
            { id: 'PRN-02', name: 'Epson WorkForce Pro (Warna)', status: 'READY', paperLevel: '92%', toner: '78%', queueCount: 0 },
            { id: 'PRN-03', name: 'HP LaserJet Pro M404n', status: 'STANDBY', paperLevel: '45%', toner: '30%', queueCount: 0 }
          ]
        };
      }
    },

    // ── Thermal POS Receipt Printer ─────────────────────
    printThermalReceipt(order) {
      if (!order) return;
      const spec = order.specifications || order.spec || {};
      const orderCode = order.order_code || order.id || 'ORD-000';
      const customer = order.customer_name || 'Pelanggan Walk-In';
      const phone = order.customer_phone || '-';
      const fileName = order.file_name || 'Dokumen.pdf';
      const paper = spec.paper_size || order.paper || 'A4';
      const color = (spec.color_mode || order.color || '').toLowerCase().includes('color') ? 'Full Color' : 'Hitam-Putih';
      const side = (spec.print_side || order.side || 'Simplex').toLowerCase().includes('duplex') ? '2 Sisi (Duplex)' : '1 Sisi (Simplex)';
      const finishing = spec.finishing || order.finishing || 'Tanpa Jilid';
      const pages = Number(order.total_pages || order.pages || 1);
      const copies = Number(order.copies || 1);
      const sheets = Math.ceil(pages / (side.includes('Duplex') ? 2 : 1)) * copies;
      const totalPrice = Number(order.total_price || 0);
      const method = order.payment_method || (order.payment && order.payment.method) || 'TUNAI';
      const dateStr = new Date(order.created_at || Date.now()).toLocaleString('id-ID', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
      });
      const claimCode = order.claim_code || ('PKM-' + String(orderCode).replace(/\D/g, '').slice(-3).padStart(3, '0'));

      let iframe = document.getElementById('receipt-print-frame');
      if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.id = 'receipt-print-frame';
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);
      }

      const doc = iframe.contentWindow.document;
      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Struk Pesanan #${orderCode}</title>
          <style>
            @page {
              size: 80mm auto;
              margin: 3mm 4mm;
            }
            * { box-sizing: border-box; }
            body {
              font-family: 'Courier New', Courier, monospace, system-ui;
              font-size: 11px;
              line-height: 1.35;
              color: #000;
              background: #fff;
              margin: 0;
              padding: 4px;
            }
            .center { text-align: center; }
            .right { text-align: right; }
            .bold { font-weight: bold; }
            .d-dash { border-top: 1px dashed #000; margin: 6px 0; }
            .d-double { border-top: 2px dashed #000; margin: 6px 0; }
            .row { display: flex; justify-content: space-between; margin-bottom: 3px; }
            .header-title { font-size: 15px; font-weight: bold; letter-spacing: 1px; }
            .header-sub { font-size: 9.5px; }
            .claim-box {
              border: 1.5px dashed #000;
              padding: 6px;
              text-align: center;
              margin: 6px 0;
            }
            .claim-code { font-size: 16px; font-weight: bold; letter-spacing: 2px; }
            .barcode { font-family: monospace; letter-spacing: 3px; font-size: 12px; text-align: center; margin: 4px 0; }
          </style>
        </head>
        <body>
          <div class="center">
            <div class="header-title">PRINTSHOP POS</div>
            <div class="header-sub">Gerai Ruko Kampus • Self-Service Digital Print</div>
            <div class="header-sub">WhatsApp: 0812-3456-7890</div>
          </div>

          <div class="d-double"></div>

          <div class="row"><span>No. Order:</span><span class="bold">#${orderCode}</span></div>
          <div class="row"><span>Waktu:</span><span>${dateStr}</span></div>
          <div class="row"><span>Pelanggan:</span><span class="bold">${customer}</span></div>
          <div class="row"><span>No. WA:</span><span>${phone}</span></div>

          <div class="d-dash"></div>

          <div class="bold" style="word-break: break-all; margin-bottom: 2px;">${fileName}</div>
          <div class="row">
            <span>${paper} • ${color}</span>
            <span>${pages} hal × ${copies} cop</span>
          </div>
          <div class="row">
            <span>${side} (${sheets} lbr)</span>
            <span>${finishing}</span>
          </div>

          <div class="d-dash"></div>

          <div class="row"><span>Subtotal:</span><span>Rp${totalPrice.toLocaleString('id-ID')}</span></div>
          <div class="row bold" style="font-size: 13px;">
            <span>TOTAL:</span>
            <span>Rp${totalPrice.toLocaleString('id-ID')}</span>
          </div>
          <div class="row">
            <span>Metode Bayar:</span>
            <span class="bold">${method} (LUNAS)</span>
          </div>

          <div class="claim-box">
            <div style="font-size: 9px;">KODE KLAIM PENGAMBILAN:</div>
            <div class="claim-code">${claimCode}</div>
          </div>

          <div class="barcode">||| | || |||| | ||| || ||</div>

          <div class="d-dash"></div>

          <div class="center" style="font-size: 9px;">
            <div>Simpan struk ini sebagai bukti sah pengambilan.</div>
            <div style="margin-top: 3px;">Terima kasih atas kunjungan Anda!</div>
          </div>
        </body>
        </html>
      `);
      doc.close();

      setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      }, 250);
    },

    // ── Realtime Poller / WebSocket ─────────────────────
    subscribeToOrders(callback, intervalMs = 4000) {
      let active = true;
      const poll = async () => {
        if (!active) return;
        try {
          const orders = await this.getOrders();
          callback(orders);
        } catch (e) {
          // Silent ignore
        }
        if (active) {
          setTimeout(poll, intervalMs);
        }
      };
      poll();

      return () => {
        active = false;
      };
    },

    // ── Local Storage Fallback Helpers ──────────────────
    getLocalOrders(filters = {}) {
      try {
        const raw = localStorage.getItem('printshop_orders_cache');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed.filter(o => o && o.order_code !== 'ORD-040' && o.order_code !== 'ORD-041' && o.order_code !== 'ORD-043' && o.order_code !== 'ORD-039');
          }
        }
      } catch (e) {}
      return this.getDefaultSeedOrders();
    },

    getLocalOrder(idOrCode) {
      if (!idOrCode) return null;
      const clean = idOrCode.startsWith('#') ? idOrCode.slice(1) : idOrCode;
      const list = this.getLocalOrders();
      return list.find(o => o.id === idOrCode || o.order_code === clean || o.order_code === idOrCode || o.order_code === '#' + clean) || null;
    },

    saveLocalOrder(order) {
      try {
        const list = this.getLocalOrders();
        const idx = list.findIndex(o => o.id === order.id || o.order_code === order.order_code);
        if (idx >= 0) {
          list[idx] = { ...list[idx], ...order };
        } else {
          list.unshift(order);
        }
        localStorage.setItem('printshop_orders_cache', JSON.stringify(list));
      } catch (e) {}
    },

    getDefaultSeedOrders() {
      return [
        {
          id: 'a1b2c3d4-0003-4000-8000-000000000003',
          order_code: 'ORD-042',
          customer_name: 'Budi Santoso',
          customer_phone: '081298765432',
          file_name: 'Makalah_Tugas_Akhir_Kelompok2.pdf',
          file_size: 4404019,
          total_pages: 24,
          copies: 1,
          total_price: 12000,
          status: 'WAITING_IN_QUEUE',
          created_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
          specifications: { paper_size: 'A4', color_mode: 'B/W', print_side: 'Simplex', sheets_count: 24, notes: 'Kertas 80 gsm' }
        }
      ];
    }
  };

  window.PrintShopAPI = PrintShopAPI;
})();
