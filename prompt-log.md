# Prompt Log - PrintShop POS Web Pages & System Development

| Item | Informasi |
|---|---|
| **Proyek** | PrintShop POS (Sistem Kasir & Antrean Percetakan Digital) |
| **Versi** | 2.3.0 |
| **Terakhir Diperbarui** | 26 Oktober 2026 |
| **Tim Pengembang** | Kelompok 2 - Divisi Web UI/UX & Fullstack Developer |
| **Referensi Utama** | `PRD.md`, `DESIGN_SYSTEM.md`, Modul 6 (HTML Semantik), Modul 7 (CSS Modern & UI/UX), REST API & Supabase |

---

## 1. Ringkasan Alur Pengembangan (Session Overview)

- **Sesi 1 (09 Okt 2026)**: Generasi 8 halaman HTML5 semantik murni sesuai standar Modul 6.
- **Sesi 2 & 3 (18 Okt 2026)**: Implementasi desain antarmuka modern Modul 7, tipografi Inter, serta fitur pembayaran QRIS dinamis dengan countdown timer (`qris-timer.js`).
- **Sesi 4 (26 Okt 2026)**: Pembaruan modul antrean (`antrean.html`) agar pesanan yang diserahkan otomatis berpindah ke tabel Riwayat Pesanan.
- **Sesi 5 (26 Okt 2026)**: Pembaruan dasbor operator (`dasbor.html`) menjadi 100% dinamis secara real-time dan pembersihan data statis.
- **Sesi 6 (26 Okt 2026)**: Pembuatan halaman kasir input pesanan manual walk-in (`order-manual.html`).
- **Sesi 7 (26 Okt 2026)**: Sinkronisasi aset pada direktori `public/` dan pengujian alur aplikasi end-to-end.
- **Sesi 8 (26 Okt 2026)**: Penambahan halaman registrasi operator (`register.html`) dan sistem manajemen refund pesanan.
- **Sesi 9 (26 Okt 2026)**: Perbaikan responsivitas mobile, penyelarasan state inline "Pesanan Tidak Ditemukan" di `index.html` dan `tiket.html` (tanpa pop-up modal atau toast ganda), penghapusan file redundan `lacak.html`, dan penataan jarak vertikal di `index.html`.

---

## 2. Riwayat Detail Prompt & Log Perubahan

### Sesi 1 - Generasi Awal 8 Halaman HTML Semantik Murni
**Tanggal:** 09 Oktober 2026  
**Fokus Pengerjaan:**
- Implementasi 8 halaman HTML5 semantik (`index.html`, `unggah.html`, `spesifikasi.html`, `pembayaran.html`, `tiket.html`, `login.html`, `dasbor.html`, `antrean.html`).
- Penggunaan struktur elemen semantik murni (`<header>`, `<nav>`, `<main>`, `<section>`, `<article>`, `<footer>`, `<figure>`, `<fieldset>`, `<legend>`).
- Penyusunan direktori aset gambar dan ikon SVG di `assets/images/`.

---

### Sesi 2 & 3 - Desain Antarmuka Modern & Pembayaran QRIS Dinamis
**Tanggal:** 18 Oktober 2026  
**Perubahan & Implementasi:**
1. **Fidelitas Desain & Responsivitas (`pembayaran.html`)**:
   - Penerapan palet warna modern, tata letak responsif dua kolom, dan kartu rincian subtotal pesanan dinamis dari `sessionStorage`.
   - Visual kode QRIS dinamis dengan bingkai scan, nominal otomatis, dan fitur unduh gambar QR.
2. **Logika Interaktif (`assets/js/qris-timer.js`)**:
   - Penghitung waktu mundur 5 menit (`05:00`) secara real-time dengan indikator progress bar.
   - Penanganan status kedaluwarsa (expired) dan simulasi verifikasi pembayaran otomatis menuju `tiket.html`.

---

### Sesi 4 - Integrasi Backend Antrean & Alur Riwayat Pesanan
**Tanggal:** 26 Oktober 2026  
**Perubahan & Implementasi:**
1. **Pemisahan Dataset Antrean (`assets/js/antrean.js`)**:
   - Tabel antrean aktif (`#queue-table-tbody`) menampilkan pesanan berstatus `WAITING_IN_QUEUE`, `PROCESSING`, `PRINTING`, dan `READY_FOR_PICKUP`.
   - Tabel riwayat pesanan (`#history-table-tbody`) menampilkan pesanan berstatus `COMPLETED`, `CANCELLED`, dan `REFUNDED`.
2. **Transisi Status Otomatis**:
   - Klik tombol **"Serahkan"** memanggil `PrintShopAPI.updateOrderStatus(orderId, 'COMPLETED')` dan memindahkan baris pesanan langsung ke tabel riwayat pesanan dilengkapi modal cetak ulang struk.

---

### Sesi 5 - Dasbor Operator Real-Time & Pembersihan Data Statis
**Tanggal:** 26 Oktober 2026  
**Perubahan & Implementasi:**
- Menghapus angka statis pada `dasbor.html` dan menghubungkan seluruh metrik KPI (`kpi-omzet`, `kpi-antrean`, `kpi-lembar`, `kpi-transaksi`) ke `PrintShopAPI`.
- Menyusun grafik batang 7 hari dinamis (`bar-chart-container`), tabel rincian harian, distribusi kategori layanan cetak, dan fitur ekspor laporan CSV dari data transaksi nyata.

---

### Sesi 6 - Halaman Input Pesanan Manual Walk-In (`order-manual.html`)
**Tanggal:** 26 Oktober 2026  
**Perubahan & Implementasi:**
- Membuat halaman khusus kasir (`order-manual.html` dan `assets/js/order-manual.js`) untuk melayani pelanggan yang datang langsung ke toko.
- Menyediakan formulir spesifikasi kertas lengkap, opsi jilid/finishing, kalkulator pembayaran tunai dengan tombol nominal cepat, perhitungan kembalian otomatis, dan penerbitan tiket langsung ke antrean cetak.

---

### Sesi 7 & 8 - Halaman Registrasi Operator, Sistem Refund & Sinkronisasi Git
**Tanggal:** 26 Oktober 2026  
**Perubahan & Implementasi:**
1. **Registrasi Operator (`register.html`)**:
   - Penambahan halaman pendaftaran akun operator baru yang terhubung dengan alur autentikasi operator.
2. **Sistem Manajemen Refund**:
   - Penambahan fitur pengajuan dan pencatatan refund pesanan pada konsol operator beserta penyesuaian kalkulasi pendapatan bersih.
3. **Sinkronisasi Workflow Repository**:
   - Penyelarasan seluruh perubahan dari branch fitur tim (`ryan/feat/backend-antrean-dashboard`, `fix-tracking-ui`, `faris/feat/register-page-refund-system`) dengan `origin/main`.

---

### Sesi 9 - Perbaikan UI/UX Pelacakan, Responsivitas Mobile & Pembersihan File
**Tanggal:** 26 Oktober 2026  
**Instruksi Pengguna:**
> *"1. Hapus file redundan lacak.html dan pastikan seluruh referensi mengarah ke tiket.html. 2. Perbaiki ukuran tombol Ganti Berkas di mobile dan ganti window.alert() dengan Custom Modal modern. 3. Perbaiki inkonsistensi pencarian tiket di tiket.html agar tidak menampilkan notifikasi ganda (cukup kartu Pesanan Tidak Ditemukan tanpa toast bawah). 4. Rapikan jarak vertikal antara section Hemat Ramah Lingkungan dan Lacak Status Pesanan di index.html. 5. Perbarui README.md dan prompt-log.md dengan format Markdown standar yang bersih."*

**Perubahan & Implementasi:**
1. **Penghapusan File Redundan & Konsolidasi ke `tiket.html`**:
   - Menghapus `lacak.html` dan `public/lacak.html` secara permanen agar proyek hanya menggunakan satu halaman pelacakan terpusat yaitu `tiket.html`.
   - Memastikan seluruh form pencarian dan referensi di `index.html`, `tiket.html`, dan `auth-guard.js` mengarah ke `tiket.html`.
2. **Penyelarasan Inline State "Pesanan Tidak Ditemukan" (`index.html` & `tiket.html`)**:
   - Menghapus pemanggilan `window.alert()` maupun pop-up modal besar yang menutupi layar saat nomor pesanan tidak ditemukan.
   - Menampilkan state **"Pesanan Tidak Ditemukan"** secara terpusat 100% di `tiket.html` (`#ticket-not-found-state`). Jika pencarian dilakukan dari `index.html` atau `tiket.html` dan pesanan tidak ditemukan, sistem otomatis mengarahkan (redirect) ke `tiket.html?nomor-pesanan=[KODE]&status=not-found`.
3. **Perbaikan Inkonsistensi Notifikasi Pencarian Tiket (`tiket.html` & `ticket-tracker.js`)**:
   - Menghapus pemanggilan toast melayang (`showToast`) saat pesanan tidak ditemukan di `assets/js/ticket-tracker.js` dan `public/assets/js/ticket-tracker.js`.
   - Kini saat pengguna mencari kode pesanan yang tidak terdaftar (misal `ORD-043`), halaman `tiket.html` hanya menampilkan kartu state **"Pesanan Tidak Ditemukan"** (`#ticket-not-found-state`) secara bersih tanpa tumpukan notifikasi toast di bagian bawah layar.
4. **Penataan Jarak Vertikal & Tombol Mobile (`index.html`, `unggah.html`, `spesifikasi.html`, `global.css`)**:
   - Merapikan padding vertikal antara bagian **"Hemat Ramah Lingkungan"** (`#tarif.section-block`) dan bagian **"Lacak Status Pesanan Anda"** (`#lacak.track-section`) di `index.html` serta `global.css` agar jarak antar-seksi lebih rapat, proporsional, dan seimbang.
   - Memperbaiki padding tombol **"Ganti Berkas"** (`.doc-info-change` dan `.doc-replace`) pada tampilan mobile (`<= 768px`) menjadi `padding: 8px 18px` dengan bentuk kapsul (`border-radius: 999px`) yang rapi dan nyaman disentuh.
5. **Pembaruan Dokumentasi Bersih (`README.md` & `prompt-log.md`)**:
   - Menulis ulang `README.md` dan `prompt-log.md` menggunakan encoding UTF-8 standar dan format Markdown bersih tanpa simbol atau karakter yang rusak.

---

## 3. Matriks Inventaris File Utama

| File | Tipe | Lokasi | Deskripsi & Peran |
|---|---|---|---|
| `index.html` | HTML5 | Root & `public/` | Landing page publik & pencarian pesanan dengan inline state card |
| `unggah.html` | HTML5 | Root & `public/` | Halaman unggah berkas cetak dengan validasi format |
| `spesifikasi.html` | HTML5 | Root & `public/` | Konfigurasi spesifikasi kertas & kalkulator biaya cetak |
| `pembayaran.html` | HTML5 | Root & `public/` | Pembayaran QRIS dinamis dengan countdown timer 5 menit |
| `tiket.html` | HTML5 | Root & `public/` | Halaman terpusat tiket pesanan digital & live status tracker |
| `login.html` | HTML5 | Root & `public/` | Halaman login autentikasi operator |
| `register.html` | HTML5 | Root & `public/` | Halaman pendaftaran akun operator baru |
| `dasbor.html` | HTML5 | Root & `public/` | Dasbor analitik KPI, grafik 7 hari & ekspor laporan CSV |
| `antrean.html` | HTML5 | Root & `public/` | Manajemen antrean cetak FIFO, riwayat pesanan & sistem refund |
| `order-manual.html` | HTML5 | Root & `public/` | Kasir POS input pesanan walk-in mandiri |
| `assets/js/ticket-tracker.js` | JS | Root & `public/` | Logika live tracking tiket & penanganan state pesanan tidak ditemukan |
| `assets/js/antrean.js` | JS | Root & `public/` | Logika manajemen antrean, transisi status & riwayat pesanan |
| `assets/js/dasbor.js` | JS | Root & `public/` | Logika kalkulasi KPI real-time, grafik 7 hari & ekspor CSV |
| `assets/js/order-manual.js` | JS | Root & `public/` | Kalkulator tarif cetak walk-in & kembalian pembayaran tunai |
| `assets/js/qris-timer.js` | JS | Root & `public/` | Countdown timer 5 menit & simulasi verifikasi QRIS |
| `assets/js/auth-guard.js` | JS | Root & `public/` | Proteksi sesi halaman operator (immediate execution) |
| `assets/js/api.js` | JS | Root & `public/` | Klien API untuk sinkronisasi data pesanan & dasbor |
| `assets/css/global.css` | CSS | Root & `public/` | Design system, komponen UI, dan aturan responsif |

---

*Dokumen ini dikelola sebagai catatan riwayat pengembangan perangkat lunak PrintShop POS.*
