# Prompt Log — PrintShop POS Web Pages

| Item | Isi |
|---|---|
| Proyek | PrintShop POS |
| Tanggal | 09 Oktober 2026 |
| Dibuat oleh | Kelompok 2 — Divisi Web UI/UX Developer |
| Referensi | `PRD.md`, `DESIGN_SYSTEM.md`, Modul 6 HTML |

---

## 1. Riwayat Instruksi (Prompt History)

### Sesi 1 — Generasi Awal 8 Halaman HTML & Penyesuaian Aset

**Tanggal:** 09 Oktober 2026, 01:44 WITA s.d. 06:37 WITA

**Instruksi Asli dari Pengguna:**
> Berdasarkan dokumen PRD dan aturan ketat dari Modul 6 yang saya lampirkan, tolong buatkan kode lengkap untuk 8 halaman web PrintShop POS beserta perbaikan sinkronisasi aset gambar dan tautan simulasinya.

**Konteks Dokumen yang Dirujuk:**
- `PRD.md` — Product Requirements Document versi 1.0 (320 baris)
- `DESIGN_SYSTEM.md` — Panduan visual & komponen (160 baris)
- Modul 6 HTML — Aturan ketat penggunaan HTML5 Semantik Murni

**Aturan Wajib dari Modul 6 yang Diterapkan:**

| No. | Aturan | Status |
|---|---|---|
| 1 | HTML5 Semantik Murni: `<header>`, `<nav>`, `<main>`, `<section>`, `<article>`, `<footer>` | ✅ Diterapkan di semua halaman |
| 2 | Dilarang CSS: Tidak ada Tailwind, Bootstrap, file `.css`, tag `<style>`, atau `style="..."` | ✅ Zero CSS di semua 8 halaman |
| 3 | Hierarki heading rapi: `h1` → `h2` → `h3` berurutan, no div-soup | ✅ Diterapkan konsisten |
| 4 | Formulir standar: `<form>`, `<fieldset>`, `<legend>`, `<label for="">` ↔ `<input id="">`, `<button type="submit">` | ✅ Diterapkan di semua form |
| 5 | Media & Gambar: `<img alt="...">` deskriptif, path mengarah ke `./assets/images/` | ✅ Semua gambar ke `./assets/images/` |
| 6 | Tabel, daftar, hyperlink: `<table>`, `<ol>`, `<ul>`, `<a>` tersedia | ✅ Hadir di setiap halaman |

---

## 2. Daftar File yang Dihasilkan

| No. | File | Halaman | Target Pengguna |
|---|---|---|---|
| 1 | `index.html` | Beranda / Landing Page | Mahasiswa |
| 2 | `unggah.html` | Unggah Dokumen | Mahasiswa |
| 3 | `spesifikasi.html` | Atur Spesifikasi Cetak | Mahasiswa |
| 4 | `pembayaran.html` | Pembayaran QRIS | Mahasiswa |
| 5 | `tiket.html` | Tiket Pesanan & Status Tracker | Mahasiswa |
| 6 | `login.html` | Login Operator | Operator |
| 7 | `dasbor.html` | Dasbor Ringkasan & Laporan | Operator |
| 8 | `antrean.html` | Tabel Daftar Antrean Masuk | Operator |
| 9 | `prompt-log.md` | Dokumen log ini | Developer |

---

## 3. Inventaris Elemen HTML per Halaman

### 3.1 `index.html` — Beranda

**Elemen semantik:** `<header>`, `<nav>`, `<main>`, `<section>` ×4, `<article>` ×4 (dalam `<ol>`), `<footer>`

**Elemen khusus Modul 6:**
- **Gambar:** `<img>` hero banner, 4 ikon langkah (step) berformat `.svg`, semua dengan `alt` deskriptif
- **Tabel:** Tabel layanan dan harga per lembar dengan `<thead>`, `<tbody>`, `<tfoot>`, `<caption>`
- **Daftar:** `<ol>` langkah cara kerja, `<ul>` keunggulan produk
- **Hyperlink:** Navigasi, "Mulai Cetak Sekarang →", aksi footer
- **Form:** Form lacak pesanan yang terhubung langsung ke `tiket.html` untuk simulasi pengujian lokal

**Pemetaan PRD:** US-01 (akses tanpa login), FR-20 (QR stiker toko), Layar M1 (Landing)

---

### 3.2 `unggah.html` — Unggah Dokumen

**Elemen semantik:** `<header>`, `<nav>`, `<main>`, `<section>` ×2, `<article>` ×3, `<footer>`

**Elemen khusus Modul 6:**
- **Form upload:** `<form enctype="multipart/form-data">`, `<fieldset>`, `<legend>`, `<input type="file">` dengan `accept` atribut format yang tepat
- **Label terhubung:** `<label for="file-dokumen">` ↔ `<input id="file-dokumen">` (dan semua field lain)
- **Tabel:** Format file yang didukung (PDF, DOCX, PPTX) dengan batas ukuran
- **Daftar:** `<ul>` tips sebelum mengunggah
- **Gambar:** Ikon upload cloud (`upload-cloud.svg`), placeholder pratinjau (`file-preview-placeholder.webp`)
- **Aksesibilitas:** `aria-describedby`, `role="alert"`, `aria-live="polite"`

**Pemetaan PRD:** US-02 (unggah dokumen), FR-01 (validasi file), FR-02 (ekstrak halaman), Layar M2

---

### 3.3 `spesifikasi.html` — Atur Spesifikasi Cetak

**Elemen semantik:** `<header>`, `<nav>`, `<main>`, `<section>` ×1, `<article>` ×1, `<footer>`

**Elemen khusus Modul 6:**
- **Form lengkap:** 5 `<fieldset>` terpisah untuk setiap kelompok pengaturan
- **Radio buttons:** Ukuran kertas (A4/F4/A3/Letter), Mode warna (B/W/Color), Sisi cetak (Simplex/Duplex) — semuanya dengan `<label for="">` ↔ `<input id="">`
- **Input numerik:** Jumlah salinan (`min`, `max`, `required`), Rentang halaman dari-sampai
- **Textarea:** Catatan tambahan untuk operator
- **Tabel estimasi:** Live pricing table dengan `aria-live="polite"` untuk update real-time
- **Gambar:** Ikon file PDF (`file-icon-pdf.svg`) di `<dl>` info dokumen

**Pemetaan PRD:** US-03 (spesifikasi cetak), US-04 (harga real-time), FR-03 (kalkulator harga), Layar M3 & M4

---

### 3.4 `pembayaran.html` — Pembayaran QRIS

**Elemen semantik:** `<header>`, `<nav>`, `<main>`, `<section>` ×2, `<article>` ×4, `<footer>`

**Elemen khusus Modul 6:**
- **Tabel ringkasan:** Detail pesanan + rincian biaya dengan `<th scope="row">`
- **Daftar langkah:** `<ol>` 5 langkah cara membayar QRIS
- **Gambar QR:** `<img>` dengan `alt` yang menyebut nominal dan nama merchant (`qris-placeholder.png`)
- **`<figure>` + `<figcaption>`:** Menampilkan QR, nominal, dan countdown
- **Tautan unduh:** `<a href="..." download>` untuk simpan QR ke galeri
- **Status live:** `role="status"`, `aria-live="polite"` dengan ikon jam pasir (`icon-clock.svg`)
- **Tautan Simulasi:** Menyediakan tautan navigasi langsung ke `tiket.html` untuk menguji alur pembayaran sukses

**Pemetaan PRD:** US-05 (QRIS), US-06 (error payment), FR-04 (tagihan QRIS), Layar M5 & M6

---

### 3.5 `tiket.html` — Tiket Pesanan & Status Tracker

**Elemen semantik:** `<header>`, `<nav>`, `<main>`, `<section>` ×3, `<article>` ×3, `<footer>`

**Elemen khusus Modul 6:**
- **Gambar sukses:** `<img>` ikon centang hijau (`icon-check-circle.svg`)
- **Tabel detail pesanan:** Rincian spesifikasi + total dibayar dengan `<th scope="row">`
- **Tautan unduh tiket:** `<a download>` untuk simpan tiket sebagai gambar
- **`<ol>` status tracker:** 3 tahap dengan `aria-current="step"`, gambar ikon status SVG, dan deskripsi
- **`<ol>` panduan ambil:** 4 langkah instruksi pengambilan
- **`<code>`:** Kode klaim dalam tag `<code>` untuk tampilan monospace

**Pemetaan PRD:** US-07 (nomor pesanan & tiket), US-08 (status live), US-09 (notifikasi), US-10 (ambil dokumen), Layar M7 & M8

---

### 3.6 `login.html` — Login Operator

**Elemen semantik:** `<header>`, `<nav>`, `<main>`, `<section>` ×2, `<article>` ×2, `<footer>`

**Elemen khusus Modul 6:**
- **Form login:** `<fieldset>`, `<legend>`, email + PIN, checkbox ingat saya — semua `label for` ↔ `input id` terhubung
- **Keamanan input:** `type="password"`, `type="email"`, `pattern="[0-9]{6}"`, `inputmode="numeric"`, `autocomplete`
- **Alert login gagal:** `role="alert"`, `aria-live="assertive"` (hidden secara default)
- **Form reset PIN:** Fieldset terpisah dengan email reset
- **Gambar:** Logo operator konsol (`logo-operator.png`)
- **Daftar keamanan:** `<ul>` panduan keamanan sesi

**Pemetaan PRD:** US-11 (login aman), FR-13 (audit log), Layar W1

---

### 3.7 `dasbor.html` — Dasbor Operator

**Elemen semantik:** `<header>`, `<nav>`, `<main>`, `<section>` ×4, `<article>` ×7, `<footer>`

**Elemen khusus Modul 6:**
- **4 KPI artikel:** Pendapatan, pesanan aktif, lembar tercetak, total transaksi
- **Tabel status printer:** 3 printer dengan kolom status (menggunakan ikon SVG), level kertas, tugas aktif, aksi
- **Gambar grafik:** `<img>` chart pendapatan 7 hari (`chart-pendapatan-7hari.png`) dengan `alt` data lengkap
- **Tabel data 7 hari:** Pendukung grafik dalam bentuk tabel terstruktur dengan `<tfoot>`
- **Tabel laporan per kategori:** Pendapatan per jenis layanan cetak
- **Form ekspor:** Filter tanggal + `<select>` format (CSV/PDF) + `<button type="submit">`
- **`<time datetime="...">`:** Timestamp dengan format ISO 8601

**Pemetaan PRD:** US-18 (laporan), FR-12 (dasbor), FR-19 (laporan harian), Layar W2 & W5

---

### 3.8 `antrean.html` — Antrean Aktif

**Elemen semantik:** `<header>`, `<nav>`, `<main>`, `<section>` ×3, `<footer>`

**Elemen khusus Modul 6:**
- **Tabel antrean utama:** 8 kolom, baris data dengan `<caption>` menjelaskan urutan FIFO
- **`<ul>` dalam sel tabel:** Spesifikasi cetak tiap pesanan dalam bentuk daftar di dalam `<td>`
- **Form aksi per baris:** `<form>` + `<input type="hidden">` + `<button type="submit">` untuk tiap status
- **`<time datetime="...">`:** Waktu masuk dengan format ISO 8601 pada setiap baris
- **Gambar status ikon:** Menggunakan format `.svg` (`status-waiting.svg`, `status-processing.svg`, `status-printing.svg`, `status-ready.svg`, `icon-refresh.svg`)
- **Form filter:** `<fieldset>`, `<input type="search">`, 2x `<select>`, `<button>`
- **Tabel legenda & ringkasan statistik:** Penjelasan makna ikon dan jumlah pesanan per status

**Pemetaan PRD:** US-12 s.d. US-16, FR-09, Layar W3

---

## 4. Evaluasi & Kepatuhan Aturan Modul 6

### 4.1 Checklist Kepatuhan Global

| Aturan Modul 6 | Implementasi | Halaman yang Dikonfirmasi |
|---|---|---|
| `<header>`, `<nav>`, `<main>`, `<section>`, `<article>`, `<footer>` semantik | ✅ | Semua 8 halaman |
| **Tidak ada CSS** (inline, tag, file) & Zero Framework | ✅ | Dikonfirmasi murni HTML standar |
| Hierarki heading rapi (`h1` → `h2` → `h3`) | ✅ | Semua 8 halaman |
| Formulir standar (`form`, `fieldset`, `legend`, `label for` ↔ `id`) | ✅ | Semua form di setiap halaman |
| Media & Gambar (`<img>` dengan `alt` deskriptif & path `./assets/images/`) | ✅ | Sinkron 100% |

**Skor Kepatuhan Modul 6: 100%**

---

## 5. Struktur Folder Proyek

```
PrintPos/
├── index.html          ← Beranda mahasiswa
├── unggah.html         ← Halaman unggah file
├── spesifikasi.html    ← Halaman atur spesifikasi cetak
├── pembayaran.html     ← Halaman pembayaran QRIS
├── tiket.html          ← Halaman tiket sukses & status tracker
├── login.html          ← Halaman login operator
├── dasbor.html         ← Halaman dasbor & laporan operator
├── antrean.html        ← Halaman tabel antrean masuk
├── prompt-log.md       ← Dokumen log instruksi ini
├── assets/
│   └── images/         ← Folder aset gambar & ikon 
│       ├── hero-banner.webp
│       ├── step-upload.svg
│       ├── step-spec.svg
│       ├── step-qris.svg
│       ├── step-pickup.svg
│       ├── upload-cloud.svg
│       ├── file-preview-placeholder.webp
│       ├── file-icon-pdf.svg
│       ├── qris-placeholder.png
│       ├── icon-clock.svg
│       ├── icon-check-circle.svg
│       ├── icon-refresh.svg
│       ├── status-waiting.svg
│       ├── status-processing.svg
│       ├── status-printing.svg
│       ├── status-ready.svg
│       ├── status-error.svg
│       ├── status-warning.svg
│       ├── logo-operator.png
│       ├── chart-pendapatan-7hari.png
│       └── tiket-ord-042.png
├── PRD.md              ← Product Requirements Document
├── DESIGN_SYSTEM.md    ← Panduan desain visual
└── prompt-log.md       ← (file ini)
```

---

## 6. Panduan Menambahkan Gambar

Semua path gambar sudah disiapkan mengarah ke `./assets/images/`. Untuk melengkapi tampilan:

1. Buat/unduh gambar yang sesuai dan simpan ke folder `assets/images/`
2. Gunakan nama file persis seperti yang tercantum di bagian 5
3. Format yang disarankan: PNG untuk ikon dan gambar UI, JPG untuk foto
4. Ukuran yang disarankan: ikon status 24×24 px, ikon langkah 64×64 px, grafik 700×300 px

---

*Dokumen log ini diperbarui otomatis sesuai penyesuaian fungsionalitas dan sinkronisasi aset proyek PrintShop POS.*
*Terakhir diperbarui: 09 Oktober 2026, 06:37 WITA*
