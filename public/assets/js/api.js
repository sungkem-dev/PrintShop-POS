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
        const res = await fetch(`${API_BASE}/orders?${query}`);
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
        const res = await fetch(`${API_BASE}/orders/${encodeURIComponent(idOrCode)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return data.data || null;
      } catch (err) {
        console.warn('API getOrder failed, fallback to local storage:', err.message);
        return this.getLocalOrder(idOrCode);
      }
    },

    async trackOrder(code) {
      try {
        const res = await fetch(`${API_BASE}/orders/track?code=${encodeURIComponent(code)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return data.data || null;
      } catch (err) {
        console.warn('API trackOrder failed, fallback to local:', err.message);
        const order = this.getLocalOrder(code);
        if (!order) return null;
        return {
          ...order,
          queuePosition: 2,
          estimatedMinutes: 8
        };
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

    // ── Midtrans Payment ────────────────────────────────
    async createPayment(orderId) {
      try {
        const res = await fetch(`${API_BASE}/payment/create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return data.data;
      } catch (err) {
        console.warn('API createPayment fallback:', err.message);
        return {
          orderId,
          orderCode: 'ORD-042',
          payment: {
            isSimulation: true,
            midtransOrderId: `ORD-042-${Date.now()}`,
            qrUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=MIDTRANS_DEMO_QRIS',
            qrString: '00020101021226680016ID.CO.MIDTRANS',
            grossAmount: 12000,
            status: 'pending'
          }
        };
      }
    },

    async checkPaymentStatus(orderId) {
      try {
        const res = await fetch(`${API_BASE}/payment/status/${encodeURIComponent(orderId)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return data.data;
      } catch (err) {
        return { isPaid: false, status: 'pending' };
      }
    },

    async simulatePaymentSuccess(orderId) {
      try {
        const res = await fetch(`${API_BASE}/payment/status/${encodeURIComponent(orderId)}`, {
          method: 'POST'
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return data.data;
      } catch (err) {
        return this.updateOrder(orderId, { status: 'WAITING_IN_QUEUE' });
      }
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
        }
        return data;
      } catch (err) {
        // Fallback demo authentication
        if (email.toLowerCase().includes('operator') && pin === '123456') {
          const op = {
            id: 'op-01',
            name: 'Ahmad Hidayat',
            email: 'operator@printshop.com',
            role: 'Kasir Loket A1'
          };
          localStorage.setItem('printshop_operator', JSON.stringify(op));
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
      localStorage.removeItem('printshop_operator');
      window.location.href = 'login.html';
    },

    // ── Dashboard Stats ─────────────────────────────────
    async getDashboardStats() {
      try {
        const res = await fetch(`${API_BASE}/dashboard/stats`);
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
        let list = raw ? JSON.parse(raw) : [];
        if (!list || list.length === 0) {
          list = this.getDefaultSeedOrders();
          localStorage.setItem('printshop_orders_cache', JSON.stringify(list));
        }

        if (filters.status) {
          const statuses = filters.status.split(',').map(s => s.trim());
          list = list.filter(o => statuses.includes(o.status));
        }
        if (filters.search) {
          const q = filters.search.toLowerCase();
          list = list.filter(o =>
            (o.order_code && o.order_code.toLowerCase().includes(q)) ||
            (o.customer_name && o.customer_name.toLowerCase().includes(q)) ||
            (o.file_name && o.file_name.toLowerCase().includes(q))
          );
        }
        return list;
      } catch (e) {
        return this.getDefaultSeedOrders();
      }
    },

    getLocalOrder(idOrCode) {
      const list = this.getLocalOrders();
      return list.find(o => o.id === idOrCode || o.order_code === idOrCode || o.order_code === `#${idOrCode}`) || null;
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
          id: 'a1b2c3d4-0001-4000-8000-000000000001',
          order_code: 'ORD-040',
          customer_name: 'Dewi Lestari',
          customer_phone: '081234567891',
          file_name: 'Laporan_PKL_Dewi.pdf',
          file_size: 3145728,
          total_pages: 18,
          copies: 1,
          total_price: 9000,
          status: 'READY_FOR_PICKUP',
          created_at: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
          specifications: { paper_size: 'A4', color_mode: 'B/W', print_side: 'Simplex', sheets_count: 18, notes: 'Jilid mika bening' }
        },
        {
          id: 'a1b2c3d4-0002-4000-8000-000000000002',
          order_code: 'ORD-041',
          customer_name: 'Rian Pratama',
          customer_phone: '085712345678',
          file_name: 'Modul_Praktikum_Fisika.pdf',
          file_size: 5242880,
          total_pages: 32,
          copies: 2,
          total_price: 32000,
          status: 'PRINTING',
          created_at: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
          specifications: { paper_size: 'A4', color_mode: 'B/W', print_side: 'Duplex', sheets_count: 16, notes: 'Cetak rapi rangkap 2' }
        },
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
        },
        {
          id: 'a1b2c3d4-0004-4000-8000-000000000004',
          order_code: 'ORD-043',
          customer_name: 'Anisa Rahmawati',
          customer_phone: '081345678901',
          file_name: 'Proposal_Skripsi_Anisa.pdf',
          file_size: 2097152,
          total_pages: 15,
          copies: 1,
          total_price: 7500,
          status: 'WAITING_IN_QUEUE',
          created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
          specifications: { paper_size: 'A4', color_mode: 'B/W', print_side: 'Simplex', sheets_count: 15, notes: '' }
        },
        {
          id: 'a1b2c3d4-0005-4000-8000-000000000005',
          order_code: 'ORD-039',
          customer_name: 'Farhan Maulana',
          customer_phone: '087812345678',
          file_name: 'Jurnal_Teknik_Farhan.pdf',
          file_size: 1572864,
          total_pages: 10,
          copies: 1,
          total_price: 5000,
          status: 'COMPLETED',
          created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          specifications: { paper_size: 'A4', color_mode: 'B/W', print_side: 'Simplex', sheets_count: 10, notes: 'Sudah diambil' }
        }
      ];
    }
  };

  window.PrintShopAPI = PrintShopAPI;
})();
