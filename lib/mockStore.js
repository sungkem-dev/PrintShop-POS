// In-memory data store for fallback & development
let initialOrders = [
  {
    id: 'a1b2c3d4-0003-4000-8000-000000000003',
    order_code: 'ORD-042',
    customer_name: 'Budi Santoso',
    customer_phone: '081298765432',
    file_name: 'Makalah_Tugas_Akhir_Kelompok2.pdf',
    file_size: 4404019,
    file_url: '/assets/sample-docs/makalah.pdf',
    total_pages: 24,
    copies: 1,
    total_price: 12000,
    status: 'WAITING_IN_QUEUE',
    created_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    specifications: {
      paper_size: 'A4',
      color_mode: 'B/W',
      print_side: 'Simplex',
      page_range: 'all',
      sheets_count: 24,
      notes: 'Kertas 80 gsm'
    }
  }
];

class MockStore {
  constructor() {
    this.orders = [...initialOrders];
    this.transactions = [];
    this.operators = [
      {
        id: 'op-01',
        name: 'Ahmad Hidayat',
        email: 'operator@printshop.com',
        pin: '123456',
        role: 'admin'
      },
      {
        id: 'op-02',
        name: 'Siti Rahma',
        email: 'siti@printshop.com',
        pin: '123456',
        role: 'operator'
      }
    ];
    this.refunds = [
      {
        id: 'ref-01',
        order_id: 'a1b2c3d4-0021-4000-8000-000000000021',
        order_code: 'ORD-021',
        refund_amount: 8500,
        refund_method: 'qris_reversal',
        reason: 'Permintaan pembatalan pelanggan via tiket',
        source: 'user_report',
        status: 'completed',
        created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'ref-02',
        order_id: 'a1b2c3d4-0019-4000-8000-000000000019',
        order_code: 'ORD-019',
        refund_amount: 15000,
        refund_method: 'cash',
        reason: 'Kertas macet di mesin printer',
        source: 'admin',
        status: 'completed',
        created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'ref-03',
        order_id: 'a1b2c3d4-0015-4000-8000-000000000015',
        order_code: 'ORD-015',
        refund_amount: 24000,
        refund_method: 'store_credit',
        reason: 'Double charge transaksi pembayaran',
        source: 'user_report',
        status: 'completed',
        created_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()
      }
    ];
    this.counter = 44;
  }

  generateOrderCode() {
    const num = String(this.counter++).padStart(3, '0');
    return `ORD-${num}`;
  }

  getOrders(filters = {}) {
    let list = [...this.orders];
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
    // Sort by created_at DESC or ASC
    list.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    return list;
  }

  getOrderById(id) {
    return this.orders.find(o => o.id === id || o.order_code === id);
  }

  createOrder(data) {
    const id = data.id || `ord-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const order_code = data.order_code || this.generateOrderCode();
    const newOrder = {
      id,
      order_code,
      customer_name: data.customer_name || 'Tamu Mahasiswa',
      customer_phone: data.customer_phone || '',
      file_name: data.file_name || 'Dokumen.pdf',
      file_size: data.file_size || 0,
      file_url: data.file_url || '',
      total_pages: data.total_pages || 1,
      copies: data.copies || 1,
      total_price: data.total_price || 0,
      status: data.status || 'DRAFT',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      specifications: data.specifications || {
        paper_size: 'A4',
        color_mode: 'B/W',
        print_side: 'Simplex',
        page_range: 'all',
        sheets_count: 1,
        notes: ''
      }
    };
    this.orders.push(newOrder);
    return newOrder;
  }

  updateOrder(id, updates) {
    const order = this.getOrderById(id);
    if (!order) return null;

    if (updates.status) order.status = updates.status;
    if (updates.cancel_reason) order.cancel_reason = updates.cancel_reason;
    if (updates.total_price !== undefined) order.total_price = updates.total_price;
    if (updates.copies !== undefined) order.copies = updates.copies;
    if (updates.total_pages !== undefined) order.total_pages = updates.total_pages;
    if (updates.customer_name) order.customer_name = updates.customer_name;
    if (updates.customer_phone) order.customer_phone = updates.customer_phone;
    if (updates.file_url) order.file_url = updates.file_url;
    if (updates.specifications) {
      order.specifications = { ...order.specifications, ...updates.specifications };
    }
    order.updated_at = new Date().toISOString();
    return order;
  }

  recordTransaction(data) {
    if (!this.transactions) this.transactions = [];
    const newTrx = {
      id: data.id || `trx-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      order_id: data.order_id,
      midtrans_order_id: data.midtrans_order_id,
      payment_type: data.payment_type || 'qris',
      gross_amount: data.gross_amount,
      transaction_status: data.transaction_status || 'pending',
      fraud_status: data.fraud_status || null,
      snap_token: data.snap_token || null,
      qr_string: data.qr_string || null,
      raw_payload: data.raw_payload || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    const existingIdx = this.transactions.findIndex(t => t.midtrans_order_id === data.midtrans_order_id);
    if (existingIdx >= 0) {
      this.transactions[existingIdx] = { ...this.transactions[existingIdx], ...newTrx };
      return this.transactions[existingIdx];
    }
    this.transactions.push(newTrx);
    return newTrx;
  }

  updateTransactionStatus(midtransOrderId, status, rawPayload = null) {
    if (!this.transactions) this.transactions = [];
    const trx = this.transactions.find(t => t.midtrans_order_id === midtransOrderId);
    if (trx) {
      trx.transaction_status = status;
      if (rawPayload) trx.raw_payload = rawPayload;
      trx.updated_at = new Date().toISOString();
      return trx;
    }
    return null;
  }

  getTransactionByOrderId(orderId) {
    if (!this.transactions) this.transactions = [];
    return this.transactions.find(t => t.order_id === orderId) || null;
  }

  getTransactionByMidtransId(midtransOrderId) {
    if (!this.transactions) this.transactions = [];
    return this.transactions.find(t => t.midtrans_order_id === midtransOrderId) || null;
  }

  authenticateOperator(email, pin) {
    return this.operators.find(op => op.email.toLowerCase() === email.toLowerCase() && op.pin === pin);
  }

  getDashboardStats() {
    const today = new Date().toISOString().split('T')[0];
    const todayOrders = this.orders.filter(o => o.created_at.startsWith(today));

    const omzetHariIni = todayOrders
      .filter(o => o.status !== 'CANCELLED' && o.status !== 'DRAFT' && o.status !== 'PENDING_PAYMENT')
      .reduce((sum, o) => sum + (Number(o.total_price) || 0), 0);

    const lembarHariIni = todayOrders
      .filter(o => o.status === 'PRINTING' || o.status === 'READY_FOR_PICKUP' || o.status === 'COMPLETED')
      .reduce((sum, o) => sum + ((o.specifications?.sheets_count || o.total_pages || 1) * (o.copies || 1)), 0);

    const pesananSelesai = this.orders.filter(o => o.status === 'COMPLETED').length;
    const antreanAktif = this.orders.filter(o =>
      ['WAITING_IN_QUEUE', 'PROCESSING', 'PRINTING', 'READY_FOR_PICKUP'].includes(o.status)
    ).length;

    // 7-day revenue aggregates
    const sevenDaysRevenue = [];
    const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayName = days[d.getDay()];

      const dayTotal = this.orders
        .filter(o => o.created_at.startsWith(dateStr) && o.status !== 'CANCELLED' && o.status !== 'DRAFT')
        .reduce((sum, o) => sum + (Number(o.total_price) || 0), 0);

      // Provide baseline values for demo presentation if fresh day
      const baseline = (7 - i) * 15000 + 45000;
      sevenDaysRevenue.push({
        date: dateStr,
        day: dayName,
        total: dayTotal > 0 ? dayTotal : baseline
      });
    }

    return {
      kpi: {
        omzetHariIni: omzetHariIni > 0 ? omzetHariIni : 124500,
        lembarHariIni: lembarHariIni > 0 ? lembarHariIni : 348,
        pesananSelesai: pesananSelesai > 0 ? pesananSelesai : 42,
        antreanAktif: antreanAktif
      },
      chart7Days: sevenDaysRevenue,
      printers: [
        { id: 'PRN-01', name: 'Canon iR-ADV C3530 (Utama)', status: 'ONLINE', paperLevel: '85%', toner: '60%', queueCount: antreanAktif },
        { id: 'PRN-02', name: 'Epson WorkForce Pro (Warna)', status: 'READY', paperLevel: '92%', toner: '78%', queueCount: 0 },
        { id: 'PRN-03', name: 'HP LaserJet Pro M404n', status: 'STANDBY', paperLevel: '45%', toner: '30%', queueCount: 0 }
      ]
    };
  }

  getRefunds() {
    return [...(this.refunds || [])].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  createRefund(data) {
    if (!this.refunds) this.refunds = [];
    const code = data.order_code
      ? data.order_code.toUpperCase().replace(/^#/, '')
      : (data.order_id ? String(data.order_id).replace(/^#/, '') : 'ORD-MANUAL');

    const newRefund = {
      id: 'ref-' + Date.now(),
      order_id: data.order_id || null,
      order_code: code.startsWith('ORD-') ? code : `ORD-${code}`,
      operator_id: data.operator_id || 'op-01',
      refund_amount: Number(data.refund_amount) || 0,
      refund_method: data.refund_method || 'qris_reversal',
      reason: data.reason || 'Pembatalan pesanan',
      source: data.source || 'admin',
      status: data.status || 'completed',
      notes: data.notes || '',
      created_at: new Date().toISOString()
    };
    this.refunds.unshift(newRefund);

    // Also update order status if exists
    const order = this.orders.find(o =>
      o.order_code.toUpperCase() === newRefund.order_code.toUpperCase() ||
      o.order_code.toUpperCase() === ('#' + newRefund.order_code).toUpperCase() ||
      o.id === data.order_id
    );
    if (order) {
      order.status = 'CANCELLED';
      order.cancel_reason = newRefund.reason;
      order.updated_at = new Date().toISOString();
    }
    return newRefund;
  }

  getOperators() {
    return this.operators.map(op => ({
      id: op.id,
      name: op.name,
      email: op.email,
      role: op.role,
      status: 'Aktif'
    }));
  }

  registerOperator({ name, email, pin, role }) {
    const existing = this.operators.find(op => op.email.toLowerCase() === email.toLowerCase());
    if (existing) {
      throw new Error('Alamat email sudah terdaftar');
    }
    const newOp = {
      id: 'op-' + String(this.operators.length + 1).padStart(2, '0'),
      name: name.trim(),
      email: email.trim().toLowerCase(),
      pin: pin.trim(),
      role: role || 'admin'
    };
    this.operators.push(newOp);
    return {
      id: newOp.id,
      name: newOp.name,
      email: newOp.email,
      role: newOp.role,
      status: 'Aktif'
    };
  }
}

// Global singleton
const globalForMock = global;
if (!globalForMock.mockStoreInstance) {
  globalForMock.mockStoreInstance = new MockStore();
}
export const mockStore = globalForMock.mockStoreInstance;
