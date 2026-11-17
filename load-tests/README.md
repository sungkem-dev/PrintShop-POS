# Rate limiter load tests

Kumpulan tes k6 ini disusun per fitur API. Logika request dan assertion
digunakan bersama dari folder `shared/`; setiap folder fitur menentukan
endpoint, status respons normal, dan kuota yang diuji.

Rate limiter diterapkan pada semua endpoint API. Tes k6 memeriksa kontrak dan
perilaku beban untuk endpoint utama berikut:

## Cakupan tes

| Fitur | Endpoint default | Respons normal | Catatan |
|---|---|---:|---|
| Orders | `GET /api/orders` | `200` | Membutuhkan koneksi database. |
| Payment | `GET /api/payment/status/load-test-missing-order` | `404` | Hanya membaca status; tidak membuat atau menyelesaikan pembayaran. |
| Auth | `POST /api/auth/login` | `401` | Mengirim kredensial uji yang tidak valid; tidak membuat akun. |
| Upload | `POST /api/upload` | `400` | Form multipart kosong; tidak mengunggah file atau menulis ke storage. |

Tes kontrak memeriksa bahwa:

- Request sampai batas kuota mendapat respons normal.
- Request yang melebihi kuota mendapat `429`.
- Respons menyediakan header `RateLimit-Limit`, `RateLimit-Remaining`,
  `RateLimit-Reset` (RFC 9333), serta `Retry-After` pada respons `429`.
- Request kembali mendapat respons normal setelah jendela kuota berakhir.

Tes beban mengirim request secara konstan di atas kuota, lalu memeriksa status,
header pada respons `429`, dan ambang latensi p95.

## Menjalankan tes

Jalankan dari root repository. Pastikan k6 terpasang dan aplikasi lokal sudah
berjalan dengan konfigurasi database yang diperlukan.

```powershell
k6 run .\load-tests\orders\rate-limit-contract.js
k6 run .\load-tests\orders\rate-limit-load.js

k6 run .\load-tests\payment\rate-limit-contract.js
k6 run .\load-tests\payment\rate-limit-load.js

k6 run .\load-tests\auth\rate-limit-contract.js
k6 run .\load-tests\auth\rate-limit-load.js

k6 run .\load-tests\upload\rate-limit-contract.js
k6 run .\load-tests\upload\rate-limit-load.js
```

## Konfigurasi

Backend membatasi 60 request per menit per IP untuk setiap kelompok route dan
HTTP method; upload dibatasi 10 per menit dan webhook Midtrans 120 per menit.
Contohnya, `GET /api/orders` dan `GET /api/orders/track` memiliki kuota
terpisah. Beban default adalah 20 request per detik selama 30 detik. Nilai
`LOAD_RPS` harus lebih besar daripada kuota dibagi durasi jendela.

| Variabel | Fungsi | Default |
|---|---|---|
| `RATE_LIMIT_BASE_URL` | Base URL aplikasi. | `http://localhost:3000` |
| `RATE_LIMIT_URL` | Mengganti endpoint default fitur. | Sesuai fitur |
| `RATE_LIMIT_MAX_REQUESTS` | Jumlah request yang diizinkan per jendela. | Orders/Auth/Payment `60`; Upload `10` |
| `RATE_LIMIT_WINDOW_SECONDS` | Durasi jendela kuota dalam detik. | `60` |
| `RATE_LIMIT_METHOD` | Mengganti HTTP method default. | Sesuai fitur |
| `RATE_LIMIT_BODY` | Mengganti body request (teks JSON). | Sesuai fitur |
| `RATE_LIMIT_HEADERS` | Header tambahan dalam format objek JSON. | — |
| `RATE_LIMIT_TOKEN` | Token Bearer untuk endpoint yang memerlukannya. | — |
| `RATE_LIMIT_SUCCESS_STATUS` | Status normal yang diharapkan. | Sesuai fitur |
| `RATE_LIMIT_OVERAGE` | Jumlah request tambahan pada tes kontrak. | `2` |
| `LOAD_RPS` | Request per detik pada tes beban. | `20` |
| `LOAD_DURATION` | Durasi tes beban. | `30s` |
| `LOAD_PRE_ALLOCATED_VUS` | VU yang disiapkan sebelum tes dimulai. | `10` |
| `LOAD_MAX_VUS` | Batas maksimum VU. | `100` |
| `LOAD_MAX_P95_MS` | Ambang latensi p95 dalam milidetik. | `1000` |

Contoh mengubah kuota sebelum menjalankan tes Orders:

```powershell
$env:RATE_LIMIT_MAX_REQUESTS = "60"
$env:RATE_LIMIT_WINDOW_SECONDS = "60"
$env:LOAD_RPS = "20"
k6 run .\load-tests\orders\rate-limit-contract.js
```

Rate limiter menggunakan memori proses. Penghitung tidak dibagi antar-instance
dan akan terhapus saat proses restart, jadi konfigurasi ini cocok untuk trafik
kecil pada satu instance, bukan perlindungan konsisten di deployment
multi-instance. Di Vercel, alamat klien diambil dari `request.ip` yang
disediakan platform; limiter tidak mempercayai `X-Forwarded-For` dari request.
Jika dijalankan secara lokal tanpa IP yang disediakan platform, semua request
menggunakan bucket `unknown`.

Jalankan tes hanya pada lingkungan lokal atau lingkungan uji yang diizinkan.
Tes beban menghasilkan traffic berkelanjutan; jangan arahkan ke production.
