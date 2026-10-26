
-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create Custom ENUM for Order Status
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
    CREATE TYPE order_status AS ENUM (
      'DRAFT',
      'PENDING_PAYMENT',
      'WAITING_IN_QUEUE',
      'PROCESSING',
      'PRINTING',
      'READY_FOR_PICKUP',
      'COMPLETED',
      'CANCELLED'
    );
  END IF;
END $$;

-- 3. Create Orders Table
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_code VARCHAR(20) NOT NULL UNIQUE,
  customer_name VARCHAR(120) NOT NULL,
  customer_phone VARCHAR(25),
  file_url TEXT,
  file_name VARCHAR(255) NOT NULL,
  file_size BIGINT DEFAULT 0,
  total_pages INTEGER NOT NULL DEFAULT 1,
  copies INTEGER NOT NULL DEFAULT 1,
  total_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  status order_status NOT NULL DEFAULT 'DRAFT',
  cancel_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast FIFO queue & lookup
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_order_code ON public.orders(order_code);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at ASC);

-- 4. Create Print Specifications Table
CREATE TABLE IF NOT EXISTS public.print_specifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  paper_size VARCHAR(10) NOT NULL DEFAULT 'A4', -- 'A4', 'F4', 'A3'
  color_mode VARCHAR(20) NOT NULL DEFAULT 'B/W', -- 'B/W', 'Color'
  print_side VARCHAR(20) NOT NULL DEFAULT 'Simplex', -- 'Simplex', 'Duplex'
  page_range VARCHAR(100) NOT NULL DEFAULT 'all',
  sheets_count INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_print_spec_order_id ON public.print_specifications(order_id);

-- 5. Create Operators Table (Authentication for Store Staff)
CREATE TABLE IF NOT EXISTS public.operators (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(120) NOT NULL,
  email VARCHAR(120) NOT NULL UNIQUE,
  pin_hash VARCHAR(255) NOT NULL, -- SHA256 or bcrypt hash of 6-digit PIN
  role VARCHAR(50) NOT NULL DEFAULT 'operator', -- 'operator', 'admin', 'cashier'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_operators_email ON public.operators(email);

-- 6. Create Midtrans Transactions Table
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  midtrans_order_id VARCHAR(100) NOT NULL UNIQUE,
  payment_type VARCHAR(50) DEFAULT 'qris',
  gross_amount NUMERIC(12, 2) NOT NULL,
  transaction_status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, settlement, expire, cancel
  fraud_status VARCHAR(50),
  snap_token TEXT,
  qr_string TEXT,
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_order_id ON public.transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_transactions_midtrans_id ON public.transactions(midtrans_order_id);

-- 6b. Create Refunds Table (Riwayat Pengembalian)
CREATE TABLE IF NOT EXISTS public.refunds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  operator_id UUID REFERENCES public.operators(id) ON DELETE SET NULL,
  refund_amount NUMERIC(12, 2) NOT NULL,
  refund_method VARCHAR(50) NOT NULL DEFAULT 'qris_reversal', -- 'qris_reversal', 'store_credit', 'cash'
  reason TEXT NOT NULL,
  source VARCHAR(50) NOT NULL DEFAULT 'admin', -- 'admin', 'user_report'
  status VARCHAR(30) NOT NULL DEFAULT 'completed', -- 'pending', 'completed', 'rejected'
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refunds_order_id ON public.refunds(order_id);
CREATE INDEX IF NOT EXISTS idx_refunds_created_at ON public.refunds(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_refunds_status ON public.refunds(status);

-- 6c. Create Auth Sessions Table (Proper session management)
CREATE TABLE IF NOT EXISTS public.auth_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  operator_id UUID NOT NULL REFERENCES public.operators(id) ON DELETE CASCADE,
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_token ON public.auth_sessions(token);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_operator_id ON public.auth_sessions(operator_id);

-- ==============================================================================
-- 7. TABEL & STRUKTUR KHUSUS DASBOR (DASHBOARD)
-- ==============================================================================

-- 7.1 Tabel Status & Perangkat Mesin Printer (Dasbor)
CREATE TABLE IF NOT EXISTS public.printers (
  id VARCHAR(20) PRIMARY KEY, -- e.g. 'PRN-01', 'PRN-02'
  name VARCHAR(120) NOT NULL,
  model VARCHAR(100) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'READY', -- 'ONLINE', 'READY', 'PRINTING', 'STANDBY', 'ERROR'
  paper_level INTEGER NOT NULL DEFAULT 100, -- Persentase 0-100%
  toner_level INTEGER NOT NULL DEFAULT 100, -- Persentase 0-100%
  queue_count INTEGER NOT NULL DEFAULT 0,
  ip_address VARCHAR(45),
  last_maintenance TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7.2 View Agregasi KPI Dasbor Real-time (view_dashboard_kpis)
CREATE OR REPLACE VIEW public.view_dashboard_kpis AS
SELECT
  -- Pendapatan Hari Ini (Omzet dari pesanan lunas)
  COALESCE(SUM(CASE 
    WHEN o.created_at::date = CURRENT_DATE 
     AND o.status NOT IN ('DRAFT', 'PENDING_PAYMENT', 'CANCELLED') 
    THEN o.total_price ELSE 0 END), 0) AS omzet_hari_ini,
    
  -- Total Lembar Fisik Tercetak Hari Ini
  COALESCE(SUM(CASE 
    WHEN o.created_at::date = CURRENT_DATE 
     AND o.status IN ('PRINTING', 'READY_FOR_PICKUP', 'COMPLETED') 
    THEN (ps.sheets_count * o.copies) ELSE 0 END), 0) AS lembar_tercetak_hari_ini,
    
  -- Total Pesanan Selesai Hari Ini
  COUNT(CASE 
    WHEN o.created_at::date = CURRENT_DATE 
     AND o.status = 'COMPLETED' 
    THEN 1 END) AS pesanan_selesai_hari_ini,
    
  -- Antrean Aktif Saat Ini (Waiting, Processing, Printing)
  COUNT(CASE 
    WHEN o.status IN ('WAITING_IN_QUEUE', 'PROCESSING', 'PRINTING') 
    THEN 1 END) AS antrean_aktif_saat_ini,

  -- Pesanan Dibatalkan Hari Ini
  COUNT(CASE 
    WHEN o.created_at::date = CURRENT_DATE 
     AND o.status = 'CANCELLED' 
    THEN 1 END) AS pesanan_batal_hari_ini
FROM public.orders o
LEFT JOIN public.print_specifications ps ON o.id = ps.order_id;

-- 7.3 View Grafik Pendapatan 7 Hari Terakhir (view_dashboard_revenue_7days)
CREATE OR REPLACE VIEW public.view_dashboard_revenue_7days AS
WITH date_series AS (
  SELECT generate_series(
    (CURRENT_DATE - INTERVAL '6 days')::date,
    CURRENT_DATE::date,
    '1 day'::interval
  )::date AS report_date
)
SELECT
  ds.report_date,
  TO_CHAR(ds.report_date, 'Dy') AS day_short_name,
  TO_CHAR(ds.report_date, 'DD Mon YYYY') AS formatted_date,
  COALESCE(COUNT(o.id), 0) AS total_orders,
  COALESCE(SUM(CASE WHEN o.status NOT IN ('DRAFT', 'PENDING_PAYMENT', 'CANCELLED') THEN o.total_price ELSE 0 END), 0) AS total_revenue,
  COALESCE(SUM(CASE WHEN o.status NOT IN ('DRAFT', 'PENDING_PAYMENT', 'CANCELLED') THEN (ps.sheets_count * o.copies) ELSE 0 END), 0) AS total_sheets
FROM date_series ds
LEFT JOIN public.orders o ON ds.report_date = o.created_at::date
LEFT JOIN public.print_specifications ps ON o.id = ps.order_id
GROUP BY ds.report_date
ORDER BY ds.report_date ASC;

CREATE TABLE IF NOT EXISTS public.queue_audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  operator_id UUID REFERENCES public.operators(id) ON DELETE SET NULL,
  previous_status order_status,
  new_status order_status NOT NULL,
  action_type VARCHAR(50) NOT NULL, -- 'STATUS_CHANGE', 'CANCELLATION', 'MANUAL_ENTRY'
  reason TEXT, -- Alasan pembatalan jika CANCELLED
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_order_id ON public.queue_audit_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON public.queue_audit_logs(created_at DESC);

-- 8.2 View Antrean FIFO Real-time (view_active_queue_fifo)
-- Mengurutkan antrean berdasarkan waktu pesanan lunas secara adil (FIFO)
CREATE OR REPLACE VIEW public.view_active_queue_fifo AS
SELECT
  ROW_NUMBER() OVER (
    ORDER BY 
      CASE WHEN o.status = 'PRINTING' THEN 1
           WHEN o.status = 'PROCESSING' THEN 2
           WHEN o.status = 'WAITING_IN_QUEUE' THEN 3
           ELSE 4 END ASC,
      o.created_at ASC
  ) AS queue_number,
  o.id,
  o.order_code,
  o.customer_name,
  o.customer_phone,
  o.file_name,
  o.file_size,
  o.total_pages,
  o.copies,
  o.total_price,
  o.status,
  o.created_at,
  ps.paper_size,
  ps.color_mode,
  ps.print_side,
  ps.page_range,
  ps.sheets_count,
  ps.notes,
  -- Perkiraan waktu tunggu (3 menit per pesanan di depannya)
  (ROW_NUMBER() OVER (
    ORDER BY 
      CASE WHEN o.status = 'PRINTING' THEN 1
           WHEN o.status = 'PROCESSING' THEN 2
           WHEN o.status = 'WAITING_IN_QUEUE' THEN 3
           ELSE 4 END ASC,
      o.created_at ASC
  ) * 3) AS estimated_wait_minutes
FROM public.orders o
LEFT JOIN public.print_specifications ps ON o.id = ps.order_id
WHERE o.status IN ('WAITING_IN_QUEUE', 'PROCESSING', 'PRINTING', 'READY_FOR_PICKUP');

-- 8.3 Trigger Otomatis Pencatatan Audit Status Antrean
CREATE OR REPLACE FUNCTION log_order_status_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO public.queue_audit_logs (
      order_id,
      previous_status,
      new_status,
      action_type,
      reason
    ) VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      CASE WHEN NEW.status = 'CANCELLED' THEN 'CANCELLATION' ELSE 'STATUS_CHANGE' END,
      NEW.cancel_reason
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_log_order_status ON public.orders;
CREATE TRIGGER trigger_log_order_status
AFTER UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION log_order_status_changes();

-- ==============================================================================
-- 9. TRIGGERS UPDATED_AT
-- ==============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_orders_updated_at ON public.orders;
CREATE TRIGGER trigger_update_orders_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_update_transactions_updated_at ON public.transactions;
CREATE TRIGGER trigger_update_transactions_updated_at
BEFORE UPDATE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==============================================================================
-- 10. ROW LEVEL SECURITY (RLS)
-- ==============================================================================
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.print_specifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.printers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queue_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view and create orders" ON public.orders;
CREATE POLICY "Public can view and create orders" ON public.orders
FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public can view and create specifications" ON public.print_specifications;
CREATE POLICY "Public can view and create specifications" ON public.print_specifications
FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public can manage operators" ON public.operators;
CREATE POLICY "Public can manage operators" ON public.operators
FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public can view and manage transactions" ON public.transactions;
CREATE POLICY "Public can view and manage transactions" ON public.transactions
FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public can view printers" ON public.printers;
CREATE POLICY "Public can view printers" ON public.printers
FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public can view and create audit logs" ON public.queue_audit_logs;
CREATE POLICY "Public can view and create audit logs" ON public.queue_audit_logs
FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public can manage refunds" ON public.refunds;
CREATE POLICY "Public can manage refunds" ON public.refunds
FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public can manage auth sessions" ON public.auth_sessions;
CREATE POLICY "Public can manage auth sessions" ON public.auth_sessions
FOR ALL USING (true) WITH CHECK (true);

-- ==============================================================================
-- 11. SUPABASE REALTIME PUBLICATION
-- ==============================================================================
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  EXCEPTION WHEN OTHERS THEN END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.print_specifications;
  EXCEPTION WHEN OTHERS THEN END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
  EXCEPTION WHEN OTHERS THEN END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.printers;
  EXCEPTION WHEN OTHERS THEN END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.queue_audit_logs;
  EXCEPTION WHEN OTHERS THEN END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.refunds;
  EXCEPTION WHEN OTHERS THEN END;
END $$;

-- ==============================================================================
-- 12. DATA SEEDING (INITIAL DATA)
-- ==============================================================================

-- 12.1 Data Operator Toko
INSERT INTO public.operators (name, email, pin_hash, role)
VALUES 
  ('Ahmad Hidayat', 'operator@printshop.com', '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92', 'admin'),
  ('Siti Rahma', 'siti@printshop.com', '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92', 'operator')
ON CONFLICT (email) DO NOTHING;

-- 12.2 Data Mesin Printer Toko (Dasbor)
INSERT INTO public.printers (id, name, model, status, paper_level, toner_level, queue_count, ip_address)
VALUES
  ('PRN-01', 'Canon iR-ADV C3530 (Utama)', 'Canon imageRUNNER ADVANCE C3530i', 'ONLINE', 85, 60, 3, '192.168.1.101'),
  ('PRN-02', 'Epson WorkForce Pro (Warna)', 'Epson WF-C879R Heavy Duty', 'READY', 92, 78, 0, '192.168.1.102'),
  ('PRN-03', 'HP LaserJet Pro M404n (B&W)', 'HP LaserJet Pro M404n', 'STANDBY', 45, 30, 0, '192.168.1.103')
ON CONFLICT (id) DO UPDATE SET 
  status = EXCLUDED.status, 
  paper_level = EXCLUDED.paper_level, 
  toner_level = EXCLUDED.toner_level;

-- 12.3 Data Awal Antrean Pesanan & Spesifikasi (FIFO)
INSERT INTO public.orders (id, order_code, customer_name, customer_phone, file_name, file_size, total_pages, copies, total_price, status, created_at)
VALUES
  ('a1b2c3d4-0001-4000-8000-000000000001', 'ORD-040', 'Dewi Lestari', '081234567891', 'Laporan_PKL_Dewi.pdf', 3145728, 18, 1, 9000, 'READY_FOR_PICKUP', NOW() - INTERVAL '40 minutes'),
  ('a1b2c3d4-0002-4000-8000-000000000002', 'ORD-041', 'Rian Pratama', '085712345678', 'Modul_Praktikum_Fisika.pdf', 5242880, 32, 2, 32000, 'PRINTING', NOW() - INTERVAL '25 minutes'),
  ('a1b2c3d4-0003-4000-8000-000000000003', 'ORD-042', 'Budi Santoso', '081298765432', 'Makalah_Tugas_Akhir_Kelompok2.pdf', 4404019, 24, 1, 12000, 'WAITING_IN_QUEUE', NOW() - INTERVAL '10 minutes'),
  ('a1b2c3d4-0004-4000-8000-000000000004', 'ORD-043', 'Anisa Rahmawati', '081345678901', 'Proposal_Skripsi_Anisa.pdf', 2097152, 15, 1, 7500, 'WAITING_IN_QUEUE', NOW() - INTERVAL '5 minutes'),
  ('a1b2c3d4-0005-4000-8000-000000000005', 'ORD-039', 'Farhan Maulana', '087812345678', 'Jurnal_Teknik_Farhan.pdf', 1572864, 10, 1, 5000, 'COMPLETED', NOW() - INTERVAL '2 hours')
ON CONFLICT (order_code) DO NOTHING;

INSERT INTO public.print_specifications (order_id, paper_size, color_mode, print_side, page_range, sheets_count, notes)
VALUES
  ('a1b2c3d4-0001-4000-8000-000000000001', 'A4', 'B/W', 'Simplex', 'all', 18, 'Jilid mika bening'),
  ('a1b2c3d4-0002-4000-8000-000000000002', 'A4', 'B/W', 'Duplex', 'all', 16, 'Cetak rapi rangkap 2'),
  ('a1b2c3d4-0003-4000-8000-000000000003', 'A4', 'B/W', 'Simplex', 'all', 24, 'Kertas 80 gsm'),
  ('a1b2c3d4-0004-4000-8000-000000000004', 'A4', 'B/W', 'Simplex', 'all', 15, NULL),
  ('a1b2c3d4-0005-4000-8000-000000000005', 'A4', 'B/W', 'Simplex', 'all', 10, 'Sudah diambil')
ON CONFLICT DO NOTHING;

-- 12.4 Data Awal Transaksi Pembayaran (Transactions)
INSERT INTO public.transactions (order_id, midtrans_order_id, payment_type, gross_amount, transaction_status)
VALUES
  ('a1b2c3d4-0001-4000-8000-000000000001', 'ORD-040-17290001', 'qris', 9000, 'settlement'),
  ('a1b2c3d4-0002-4000-8000-000000000002', 'ORD-041-17290002', 'qris', 32000, 'settlement'),
  ('a1b2c3d4-0003-4000-8000-000000000003', 'ORD-042-17290003', 'qris', 12000, 'settlement'),
  ('a1b2c3d4-0004-4000-8000-000000000004', 'ORD-043-17290004', 'qris', 7500, 'settlement'),
  ('a1b2c3d4-0005-4000-8000-000000000005', 'ORD-039-17290005', 'qris', 5000, 'settlement')
ON CONFLICT (midtrans_order_id) DO NOTHING;
