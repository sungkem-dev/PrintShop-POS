<div align="center">

# 🖨️ PrintShop POS

**Aplikasi Web Percetakan Kampus Berbasis Self-Service & Point of Sale**

[![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
[![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com/)

[🐛 Laporkan Bug](https://github.com/sungkem-dev/PrintShop-POS/issues)

</div>

---

## 📖 Tentang PrintShop POS

**PrintShop POS** adalah aplikasi web layanan cetak mandiri (*self-service*) untuk mahasiswa dan civitas akademika di lingkungan kampus. Tanpa perlu antre lama di depan komputer atau membawa flashdisk, mahasiswa cukup mengunggah dokumen dari HP/laptop, mengatur spesifikasi cetak, membayar lewat QRIS, lalu memantau antrean secara *real-time* hingga cetakan siap diambil.

Di sisi toko, operator dilengkapi **Operator Console** untuk mengelola antrean berbasis FIFO, melayani pelanggan *walk-in* (kasir tunai), memproses *refund*, serta memantau omzet harian.

---

## 🧭 Cara Menggunakan Aplikasi

### Untuk Mahasiswa (Pelanggan)
1. **Buka Beranda (`index.html`)** lalu klik **Mulai Cetak Sekarang**, atau masukkan kode pesanan di kolom **Lacak Pesanan** jika sudah memesan.
2. **Unggah Dokumen (`unggah.html`)**: pilih berkas dokumen (`PDF`) dari HP atau laptop.
3. **Atur Spesifikasi Cetak (`spesifikasi.html`)**: tentukan ukuran kertas (`A4`, `F4`, `A3`), mode warna (*Hitam Putih* / *Full Color*), sisi cetak (*Simplex* / *Duplex*), jilid, dan jumlah rangkap. Total biaya dihitung otomatis.
4. **Bayar via QRIS (`pembayaran.html`)**: pindai kode QR sebelum batas waktu 5 menit berakhir.
5. **Simpan Tiket Digital (`tiket.html`)**: pantau status antrean secara langsung (*Waiting in Queue → Printing in Progress → Ready for Pickup*). Tunjukkan **Kode Klaim** ke operator saat mengambil cetakan, atau cetak tiket fisik jika diperlukan.

### Untuk Operator Toko
1. **Masuk ke Console (`login.html`)**: login menggunakan akun operator (atau daftar terlebih dahulu di `register.html`).
2. **Kelola Antrean (`antrean.html`)**: proses pesanan masuk berdasarkan urutan FIFO, perbarui status pengerjaan, lihat riwayat selesai, atau proses pengembalian dana (*refund*).
3. **Kasir Walk-In (`order-manual.html`)**: catat pesanan pelanggan yang datang langsung ke gerai lengkap dengan kalkulasi kembalian tunai.
4. **Pantau Performa (`dasbor.html`)**: lihat ringkasan omzet harian, antrean aktif, total lembar tercetak, grafik 7 hari terakhir, dan ekspor laporan ke format CSV.

---

## ✨ Fitur Utama

| Modul | Fitur | Keterangan |
| :--- | :--- | :--- |
| **Mahasiswa** | Unggah & Konfigurasi Cetak | Validasi file, kalkulasi tarif otomatis (kertas, warna, duplex, jilid). |
| **Mahasiswa** | Pembayaran QRIS Dinamis | Dilengkapi *countdown timer* 5 menit dan verifikasi pembayaran. |
| **Mahasiswa** | Tiket Digital & Live Tracker | Pelacakan status *real-time*, salin kode klaim, dan cetak tiket fisik 1 halaman. |
| **Operator** | Manajemen Antrean FIFO | Kelola pesanan aktif, ubah status, riwayat selesai, dan fitur *refund*. |
| **Operator** | Kasir Walk-In | Pencatatan transaksi langsung di loket dengan hitung kembalian otomatis. |
| **Operator** | Dasbor Analitik | KPI harian, grafik tren 7 hari, dan ekspor laporan CSV. |
| **Keamanan** | API Rate Limiting | Pembatasan trafik per endpoint untuk mencegah *spam* dan menjaga stabilitas server. |

---

## 🛠️ Tech Stack

* **Frontend:** HTML5 Semantik, CSS3 (Flexbox, CSS Grid, Mobile-First Responsive), Vanilla JavaScript (ES6+)
* **Backend & API:** Next.js API Routes
* **Database:** Supabase PostgreSQL
* **Pembayaran:** Integrasi QRIS / Midtrans
* **Pengujian Beban:** k6 Load Testing
* **Deployment & Desain:** Vercel, GitHub, Figma

---

## 🚀 Menjalankan Proyek Secara Lokal

### Prasyarat
* [Node.js](https://nodejs.org/) (disarankan versi 18+)
* [Git](https://git-scm.com/)
* Konfigurasi database Supabase (file `.env.local`)

### Langkah Instalasi

1. **Clone repository**
   ```bash
   git clone [https://github.com/sungkem-dev/PrintShop-POS.git](https://github.com/sungkem-dev/PrintShop-POS.git)
   cd PrintShop-POS
   ```

2. **Install dependensi**
   ```bash
   npm install
   ```

3. **Atur Environment Variables**
   Buat file `.env.local` di root proyek dan isi kredensial Supabase serta Midtrans yang digunakan tim.

4. **Jalankan server pengembangan**
   ```bash
   npm run dev
   ```

5. **Buka di browser**
   Akses aplikasi melalui `http://localhost:3000`.

---

## 📁 Struktur Direktori

```text
PrintShop-POS/
├── index.html               # Beranda & Live Tracker
├── unggah.html              # Langkah 1: Unggah Dokumen
├── spesifikasi.html         # Langkah 2: Pengaturan Spesifikasi Cetak
├── pembayaran.html          # Langkah 3: Pembayaran QRIS
├── tiket.html               # Langkah 4: Tiket Digital & Cetak Fisik
├── login.html               # Masuk Operator
├── register.html            # Registrasi Operator
├── dasbor.html              # Dasbor Analitik Operator
├── antrean.html             # Manajemen Antrean & Refund
├── order-manual.html        # Kasir Walk-In
├── assets/
│   ├── css/global.css       # Styling global & responsif mobile
│   └── js/                  # Logika API, timer QRIS, tracker, & console
├── public/                  # Aset publik tersinkronisasi untuk deployment
└── load-tests/              # Skrip uji beban & rate limiting (k6)
```

---

## 🧪 Pengujian API & Rate Limiting

Seluruh endpoint API dilindungi oleh *rate limiter* (default 60 request/menit per IP untuk endpoint umum, 10 request/menit untuk upload, dan 120 request/menit untuk webhook Midtrans).

Untuk menjalankan tes kontrak dan tes beban secara lokal (pastikan **k6** terpasang dan server lokal berjalan):

```powershell
k6 run .\load-tests\orders\rate-limit-contract.js
k6 run .\load-tests\orders\rate-limit-load.js
k6 run .\load-tests\payment\rate-limit-contract.js
k6 run .\load-tests\auth\rate-limit-contract.js
k6 run .\load-tests\upload\rate-limit-contract.js
```

> Jalankan tes beban hanya di lingkungan lokal atau lingkungan uji, jangan arahkan ke server *production*.