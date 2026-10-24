// In-memory data store for fallback & development
let initialOrders = [
  {
    id: 'a1b2c3d4-0001-4000-8000-000000000001',
    order_code: 'ORD-040',
    customer_name: 'Dewi Lestari',
    customer_phone: '081234567891',
    file_name: 'Laporan_PKL_Dewi.pdf',
    file_size: 3145728,
    file_url: '/assets/sample-docs/laporan.pdf',
    total_pages: 18,
    copies: 1,
    total_price: 9000,
    status: 'READY_FOR_PICKUP',
    created_at: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    specifications: {
      paper_size: 'A4',
      color_mode: 'B/W',
      print_side: 'Simplex',
      page_range: 'all',
      sheets_count: 18,
      notes: 'Jilid mika bening'
    }
  },
  {
    id: 'a1b2c3d4-0002-4000-8000-000000000002',
    order_code: 'ORD-041',
    customer_name: 'Rian Pratama',
    customer_phone: '085712345678',
    file_name: 'Modul_Praktikum_Fisika.pdf',
    file_size: 5242880,
    file_url: '/assets/sample-docs/modul.pdf',
    total_pages: 32,
    copies: 2,
    total_price: 32000,
    status: 'PRINTING',
    created_at: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    specifications: {
      paper_size: 'A4',
      color_mode: 'B/W',
      print_side: 'Duplex',
      page_range: 'all',
      sheets_count: 16,
      notes: 'Cetak rapi rangkap 2'
    }
  },
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
  },
  {
    id: 'a1b2c3d4-0004-4000-8000-000000000004',
    order_code: 'ORD-043',
    customer_name: 'Anisa Rahmawati',
    customer_phone: '081345678901',
    file_name: 'Proposal_Skripsi_Anisa.pdf',
    file_size: 2097152,
    file_url: '/assets/sample-docs/proposal.pdf',
    total_pages: 15,
    copies: 1,
    total_price: 7500,
    status: 'WAITING_IN_QUEUE',
    created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    specifications: {
      paper_size: 'A4',
      color_mode: 'B/W',
      print_side: 'Simplex',
      page_range: 'all',
      sheets_count: 15,
      notes: ''
    }
  },
  {
    id: 'a1b2c3d4-0005-4000-8000-000000000005',
    order_code: 'ORD-039',
    customer_name: 'Farhan Maulana',
    customer_phone: '087812345678',
    file_name: 'Jurnal_Teknik_Farhan.pdf',
    file_size: 1572864,
    file_url: '/assets/sample-docs/jurnal.pdf',
    total_pages: 10,
    copies: 1,
    total_price: 5000,
    status: 'COMPLETED',
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    specifications: {
      paper_size: 'A4',
      color_mode: 'B/W',
      print_side: 'Simplex',
      page_range: 'all',
      sheets_count: 10,
      notes: 'Sudah diambil'
    }
  }
];

class MockStore {
  constructor() {
    this.orders = [...initialOrders];
    this.operators = [
      {
        id: 'op-01',
        name: 'Ahmad Hidayat',
        email: 'operator@printshop.com',
        pin: '123456',
        role: 'Kasir Loket A1'
      },
      {
        id: 'op-02',
        name: 'Siti Rahma',
        email: 'siti@printshop.com',
        pin: '123456',
        role: 'Operator Mesin B1'
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
      o.status === 'WAITING_IN_QUEUE' || o.status === 'PROCESSING' || o.status === 'PRINTING'
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
}

// Global singleton
const globalForMock = global;
if (!globalForMock.mockStoreInstance) {
  globalForMock.mockStoreInstance = new MockStore();
}
export const mockStore = globalForMock.mockStoreInstance;
