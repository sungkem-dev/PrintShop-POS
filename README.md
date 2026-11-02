# PrintShop POS

**PrintShop POS** adalah aplikasi web berbasis *self-service* (layanan mandiri) yang dirancang untuk memenuhi kebutuhan pencetakan dokumen mahasiswa dan civitas akademika di lingkungan kampus. Sistem ini mengintegrasikan proses unggah dokumen, pengaturan spesifikasi cetak, pembayaran digital berbasis QRIS, serta manajemen antrean dan kasir operasional.

---

## Arsitektur Sistem dan Alur Pengguna

### 1. Alur Pelanggan (*Customer Journey*)

- **Landing Page (`index.html`)**  
  Halaman utama yang menyediakan informasi layanan dan fitur *Live Tracker* untuk melacak status pesanan menggunakan kode tiket unik.

- **Unggah Dokumen (`unggah.html`)**  
  Antarmuka untuk mengunggah berkas dengan validasi format dokumen dan navigasi yang responsif.

- **Pengaturan Spesifikasi (`spesifikasi.html`)**  
  Halaman konfigurasi cetak yang mencakup:
  - Ukuran kertas: A4, F4, dan A3.
  - Jenis cetakan: *Full Color* dan *Grayscale*.
  - Jumlah halaman dan pengaturan halaman tertentu.
  - Opsi cetak bolak-balik (*duplex*) untuk menghemat kertas.
  - Pilihan penjilidan dokumen.

- **Pembayaran QRIS (`pembayaran.html`)**  
  Halaman pembayaran yang dirancang untuk mendukung QRIS dinamis, dilengkapi penghitung waktu mundur lima menit melalui `qris-timer.js` dan simulasi verifikasi pembayaran yang mengarahkan pelanggan ke tiket digital.

- **Tiket Digital dan Pelacakan Pesanan (`tiket.html`)**  
  Halaman untuk memantau perkembangan pesanan dengan status:
  1. `Waiting in Queue`
  2. `Printing in Progress`
  3. `Ready for Pickup`
  4. `Completed`

  Halaman ini juga menyediakan notifikasi ketika kode tiket tidak ditemukan.

### 2. Alur Operator dan Kasir (*Operator Console*)

- **Autentikasi dan Registrasi (`login.html` dan `register.html`)**  
  Halaman untuk masuk dan mendaftarkan akun operator. Proteksi halaman operator dirancang menggunakan `auth-guard.js`.

- **Dasbor Analitik (`dasbor.html`)**  
  Pusat informasi operasional yang dirancang untuk menampilkan:
  - KPI omzet harian.
  - Jumlah antrean aktif.
  - Jumlah lembar yang dicetak.
  - Grafik analitik selama tujuh hari.
  - Ekspor laporan ke format CSV.

- **Manajemen Antrean dan Kasir (`antrean.html`)**  
  Halaman pengelolaan pesanan berdasarkan prinsip FIFO (*First In, First Out*), dengan fitur:
  - Pemantauan antrean aktif.
  - Pembaruan status pengerjaan.
  - Pengelolaan riwayat pesanan selesai.
  - Manajemen pengembalian dana (*refund*).

- **Kasir Walk-In (`order-manual.html`)**  
  Modul POS untuk melayani pelanggan yang datang langsung ke gerai, termasuk pencatatan pesanan dan kalkulasi uang kembalian tunai.

---

## Tech Stack dan Standar Pengkodean

### Frontend
- **HTML5:** Struktur halaman menggunakan elemen semantik seperti `<header>`, `<nav>`, `<main>`, `<section>`, `<article>`, dan `<footer>`.
- **CSS3:** Pengaturan tampilan menggunakan *custom properties*, Flexbox, CSS Grid, dan desain responsif.
- **JavaScript ES6+:** Implementasi interaksi dan logika aplikasi menggunakan Vanilla JavaScript.

### Backend dan API
- **Next.js API Routes:** Direncanakan sebagai lapisan API untuk menangani komunikasi antara antarmuka dan layanan backend.
- **Supabase PostgreSQL:** Digunakan sebagai teknologi penyimpanan basis data relasional.

### Tools dan Deployment
- **Git dan GitHub:** Pengelolaan versi kode dan kolaborasi tim.
- **Vercel:** Platform deployment aplikasi web.
- **Figma:** Perancangan antarmuka dan wireframe UI/UX.

---

## Struktur Direktori Proyek

```text
PrintShop-POS/
├── index.html
├── unggah.html
├── spesifikasi.html
├── pembayaran.html
├── tiket.html
├── login.html
├── register.html
├── dasbor.html
├── antrean.html
├── order-manual.html
├── public/
└── assets/
    ├── css/
    │   └── global.css
    └── js/
        ├── api.js
        ├── antrean.js
        ├── dasbor.js
        ├── order-manual.js
        ├── qris-timer.js
        ├── ticket-tracker.js
        └── auth-guard.js
```

### Keterangan Direktori dan File

| File atau Direktori | Fungsi |
|---|---|
| `index.html` | Halaman utama dan pelacakan pesanan. |
| `unggah.html` | Antarmuka unggah dokumen. |
| `spesifikasi.html` | Pengaturan spesifikasi dan tarif cetak. |
| `pembayaran.html` | Antarmuka pembayaran QRIS. |
| `tiket.html` | Tiket digital dan pelacakan status pesanan. |
| `login.html` | Halaman masuk operator. |
| `register.html` | Halaman registrasi operator. |
| `dasbor.html` | Dasbor analitik operasional. |
| `antrean.html` | Pengelolaan antrean dan riwayat pesanan. |
| `order-manual.html` | Kasir untuk pesanan langsung. |
| `assets/css/global.css` | Gaya visual dan komponen antarmuka global. |
| `assets/js/api.js` | Logika komunikasi dengan API dan Supabase. |
| `assets/js/antrean.js` | Logika pengelolaan antrean dan riwayat pesanan. |
| `assets/js/dasbor.js` | Kalkulasi metrik dan visualisasi data dasbor. |
| `assets/js/order-manual.js` | Logika pesanan manual dan perhitungan kembalian. |
| `assets/js/qris-timer.js` | Penghitung waktu pembayaran QRIS. |
| `assets/js/ticket-tracker.js` | Logika pelacakan tiket dan penanganan kesalahan. |
| `assets/js/auth-guard.js` | Pemeriksaan akses halaman operator. |
| `public/` | Direktori aset publik aplikasi. |

*Catatan: Struktur direktori di atas merupakan struktur yang direncanakan dalam dokumentasi. Sesuaikan dengan file yang benar-benar tersedia di repository.*

---

## Panduan Menjalankan Proyek

### 1. Clone Repository

Jalankan perintah berikut di terminal:

```bash
git clone https://github.com/sungkem-dev/PrintShop-POS
cd PrintShop-POS
```

### 2. Instalasi Dependensi

Jika proyek menggunakan Node.js dan memiliki file `package.json`, jalankan:

```bash
npm install
```

### 3. Jalankan Server Pengembangan

Jika proyek dikonfigurasi menggunakan Next.js dan menyediakan skrip `dev`, jalankan:

```bash
npm run dev
```

### 4. Buka Aplikasi

Akses alamat berikut melalui browser:

```text
http://localhost:3000
```

**Penting:** Perintah `npm install` dan `npm run dev` hanya dapat digunakan apabila konfigurasi Node.js dan skrip yang sesuai tersedia. Jika proyek berupa HTML, CSS, dan JavaScript statis, jalankan menggunakan server lokal yang sesuai.

---

## Fitur Utama

| Fitur | Deskripsi |
|---|---|
| Unggah Dokumen | Memfasilitasi pelanggan dalam mengirimkan dokumen untuk dicetak. |
| Konfigurasi Cetak | Menentukan ukuran kertas, warna, jumlah halaman, duplex, dan penjilidan. |
| Pembayaran QRIS | Mendukung alur pembayaran digital sesuai integrasi yang tersedia. |
| Tiket Digital | Menyediakan identitas pesanan untuk kebutuhan pelacakan. |
| Pelacakan Pesanan | Memantau status pesanan berdasarkan kode tiket. |
| Manajemen Antrean | Membantu operator mengelola pesanan berdasarkan urutan pengerjaan. |
| Dasbor Analitik | Menampilkan metrik operasional dan laporan apabila telah terintegrasi. |
| Kasir Walk-In | Memfasilitasi pencatatan transaksi pelanggan yang datang langsung. |
| Refund | Mendukung pengelolaan pengembalian dana sesuai implementasi sistem. |

---

## Tujuan Pengembangan

PrintShop POS dikembangkan untuk mendukung digitalisasi layanan percetakan melalui proses pemesanan yang lebih terstruktur, pemantauan antrean yang lebih mudah, dan pengelolaan transaksi yang terintegrasi.

Sistem ini diharapkan dapat meningkatkan efisiensi operasional percetakan serta memberikan pengalaman pemesanan yang praktis bagi mahasiswa dan civitas akademika.

---

*Dokumentasi ini disusun sebagai panduan proyek PrintShop POS dan perlu diperbarui sesuai dengan implementasi, konfigurasi, serta perkembangan fitur pada repository.*
