// Dokumentasi API developer Admin Gateway (SMP Payment). Satu sumber: dipakai tampilan di
// admin > Gateway SMP > Dokumentasi, tombol unduh .md, dan docs/ADMIN-GATEWAY-API.md.
// base = alamat dasar API, mis. https://domainkamu.com/api/agw
const F='```'
export const docsMd=(base='https://DOMAINKAMU/api/agw')=>{
const origin=base.replace(/\/api\/agw$/,'')
return `# Admin Gateway API — Dokumentasi Developer

Payment gateway QRIS berbasis **SMP Payment**. Dipakai untuk menerbitkan tagihan QRIS dari aplikasi/server kamu, mengecek status, dan menerima notifikasi (webhook) saat tagihan lunas. Uang langsung masuk ke akun SMP Payment pemilik gateway — tidak ada saldo/dompet dan tidak ada penarikan dana.

- **Base URL:** \`${base}\`
- **Format:** JSON (UTF-8). Semua balasan berbentuk \`{"success": true|false, ...}\`
- **Akses:** API key hanya diterbitkan oleh admin. Minta key ke admin, jangan pernah menaruhnya di aplikasi mobile / JavaScript browser.

---

## 1. Cara kerja singkat

1. Server kamu memanggil \`POST /qris/create\` dengan nominal → dapat \`qr_string\` / \`qr_image\` dan **total_pay**.
2. Tampilkan QR ke pembeli. Pembeli membayar **total_pay persis** (nominal + kode unik) dengan aplikasi apa pun yang mendukung QRIS.
3. SMP Payment memberi tahu gateway → status tagihan jadi \`paid\` → gateway mengirim **webhook** \`invoice.paid\` ke server kamu (atau kamu bisa polling \`GET /qris/status\`).
4. Server kamu memverifikasi tanda tangan webhook, lalu memberikan barang/layanan ke pembeli.

> **Kode unik:** pembayaran dicocokkan lewat total. Karena itu \`total_pay = amount + unique_code\` (1–999). Pembeli yang membayar kurang/lebih dari \`total_pay\` tidak akan terdeteksi otomatis.

## 2. Mulai cepat

${F}bash
curl -X POST ${base}/qris/create \\
  -H "X-API-Key: agw_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{"amount": 25000, "order_id": "INV-1001", "description": "Top up akun Budi"}'
${F}

${F}json
{
  "success": true,
  "message": "Tagihan QRIS dibuat. Pembeli harus membayar total_pay PERSIS.",
  "idempotent": false,
  "invoice": {
    "invoice_id": "SMPLK3X9A1B2C3D4",
    "order_id": "INV-1001",
    "status": "pending",
    "amount": 25000,
    "unique_code": 137,
    "total_pay": 25137,
    "description": "Top up akun Budi",
    "customer_name": "",
    "metadata": null,
    "qr_string": "00020101021226...6304ABCD",
    "qr_image": "https://api.qrserver.com/v1/create-qr-code/?size=360x360&margin=8&data=...",
    "created_at": "2026-10-19T10:00:00.000Z",
    "expired_at": "2026-10-19T10:15:00.000Z",
    "paid_at": null,
    "payer_name": null,
    "issuer": null,
    "reference": null
  }
}
${F}

Cek koneksi & key kamu dulu dengan \`GET ${base}/ping\`.

---

## 3. Autentikasi

Kirim API key di salah satu header (query string **tidak** diterima):

| Header | Contoh |
|---|---|
| \`X-API-Key\` | \`X-API-Key: agw_live_...\` |
| \`Authorization\` | \`Authorization: Bearer agw_live_...\` |

### 3.1 Whitelist IP (opsional, diatur admin)
Jika admin mengisi whitelist untuk key-mu, hanya server dengan IP tersebut yang bisa memakainya. IP lain dibalas \`403 ip_not_allowed\`. \`GET /ping\` menampilkan \`your_ip\` supaya mudah didaftarkan.

### 3.2 Tanda tangan HMAC (opsional, diatur admin)
Jika admin mengaktifkan **API Secret** (\`agw_sec_...\`), setiap request wajib membawa dua header tambahan:

| Header | Isi |
|---|---|
| \`X-Timestamp\` | waktu sekarang dalam **detik** (Unix). Selisih maksimal 5 menit dari jam server |
| \`X-Signature\` | HMAC-SHA256 heksadesimal huruf kecil dari string kanonik di bawah, kunci = API Secret |

String kanonik (4 baris dipisah karakter newline \`\\n\`):

${F}
METHOD
/api/agw/<path tanpa query>
<body mentah persis seperti yang dikirim, kosong untuk GET>
<X-Timestamp>
${F}

Contoh \`POST /qris/create\` dengan body \`{"amount":25000}\`:

${F}
POST
/api/agw/qris/create
{"amount":25000}
1760868000
${F}

> Body yang ditandatangani harus **byte-per-byte sama** dengan yang dikirim. Serialisasi JSON sekali, tandatangani string itu, lalu kirim string yang sama.

---

## 4. Endpoint

### 4.1 GET /ping
Menguji key dan menampilkan batas gateway.

${F}json
{
  "success": true,
  "message": "pong",
  "app": { "id": "k1a2b3c4d5", "name": "Toko Budi" },
  "gateway": { "active": true, "min_amount": 1000, "max_amount": 10000000, "expire_minutes": 15 },
  "security": { "signature_required": false, "ip_whitelist": false, "webhook_enabled": true },
  "your_ip": "203.0.113.10",
  "server_time": "2026-10-19T10:00:00.000Z"
}
${F}

### 4.2 POST /qris/create
Menerbitkan tagihan QRIS dinamis. Batas: **30 request/menit** per key.

| Field | Tipe | Wajib | Keterangan |
|---|---|---|---|
| \`amount\` | integer | ya | Nominal dalam rupiah, dalam batas min/max gateway |
| \`order_id\` | string | tidak | ID pesanan milik aplikasimu. Huruf, angka, \`. : _ -\`, maks 64. **Idempotensi:** jika masih ada tagihan aktif dengan order_id sama (dan nominal sama), tagihan yang sama dikembalikan (\`idempotent: true\`) — aman untuk retry |
| \`description\` | string | tidak | Maks 100 karakter |
| \`customer_name\` | string | tidak | Maks 60 karakter |
| \`metadata\` | object | tidak | Objek JSON bebas, maks 1 KB. Dikembalikan apa adanya di status & webhook |

Kemungkinan galat khusus: \`422 invalid_amount\`, \`422 invalid_order_id\`, \`422 invalid_metadata\`, \`409 order_paid\` (order_id sudah dibayar), \`409 order_conflict\` (masih ada tagihan aktif dengan nominal beda), \`503 gateway_off\`, \`503 smp_not_ready\`.

### 4.3 GET /qris/status/{invoice_id}
Atau cari lewat order_id: \`GET /qris/status?order_id=INV-1001\`.

${F}json
{
  "success": true,
  "status": "paid",
  "message": "Pembayaran diterima.",
  "invoice": {
    "invoice_id": "SMPLK3X9A1B2C3D4", "order_id": "INV-1001", "status": "paid",
    "amount": 25000, "unique_code": 137, "total_pay": 25137,
    "paid_at": "2026-10-19T10:04:12.000Z", "payer_name": "BUDI S", "issuer": "DANA",
    "reference": "RRN123456789"
  }
}
${F}

Polling cukup **tiap 5 detik** dan berhenti saat status bukan \`pending\`. Lebih hemat: pakai webhook.

### 4.4 POST /qris/cancel/{invoice_id}
Membatalkan tagihan \`pending\` dan melepas kode uniknya. Tagihan yang sudah \`paid\` tidak bisa dibatalkan (\`409 already_paid\`). Body kosong boleh.

### 4.5 GET /qris/list
Riwayat tagihan milik key-mu (300 terbaru).

| Query | Keterangan |
|---|---|
| \`page\` | nomor halaman (bawaan 1) |
| \`limit\` | 1–50 (bawaan 20) |
| \`status\` | \`pending\` / \`paid\` / \`expired\` / \`canceled\` |
| \`search\` | cari invoice_id, order_id, atau nominal |

Balasan: \`{"success":true,"data":[...],"meta":{"page":1,"limit":20,"total":42,"total_pages":3}}\`

### 4.6 POST /webhook/test
Mengirim event \`webhook.test\` ke URL webhook yang diatur admin untuk key-mu. Balasan: \`{"success":true,"delivered":true,"http_status":200,"error":null}\`.

---

## 5. Status tagihan

| Status | Arti |
|---|---|
| \`pending\` | Menunggu pembayaran, belum lewat \`expired_at\` |
| \`paid\` | Pembayaran diterima. Final |
| \`expired\` | Lewat batas waktu tanpa pembayaran. Jika pembeli ternyata membayar total yang sama dalam **20 menit** setelah kedaluwarsa, tagihan tetap jadi \`paid\` (uang sudah masuk) — jadi jangan tutup pesanan permanen sebelum 20 menit lewat, atau andalkan webhook |
| \`canceled\` | Dibatalkan lewat API/admin. Final |

---

## 6. Webhook

Diatur admin per key (URL **https** publik). Dikirim \`POST\` JSON saat tagihan:

- \`invoice.paid\` — lunas
- \`invoice.expired\` — kedaluwarsa
- \`webhook.test\` — tes manual

Header:

| Header | Isi |
|---|---|
| \`X-AGW-Event\` | nama event |
| \`X-AGW-Delivery\` | id pengiriman unik (\`<invoice_id>:<percobaan ke->\`) |
| \`X-AGW-Timestamp\` | waktu kirim (detik Unix) |
| \`X-AGW-Signature\` | \`sha256=\` + HMAC-SHA256 hex dari \`<timestamp>.<body mentah>\`, kunci = **Webhook Secret** (\`whsec_...\`, dilihat admin) |

Body (event \`invoice.paid\`):

${F}json
{
  "event": "invoice.paid",
  "invoice_id": "SMPLK3X9A1B2C3D4",
  "order_id": "INV-1001",
  "status": "paid",
  "amount": 25000,
  "unique_code": 137,
  "total_pay": 25137,
  "description": "Top up akun Budi",
  "customer_name": "",
  "metadata": null,
  "created_at": "2026-10-19T10:00:00.000Z",
  "expired_at": "2026-10-19T10:15:00.000Z",
  "paid_at": "2026-10-19T10:04:12.000Z",
  "payer_name": "BUDI S",
  "issuer": "DANA",
  "reference": "RRN123456789"
}
${F}

**Aturan penerima webhook**

1. Verifikasi \`X-AGW-Signature\` memakai **body mentah** (bukan hasil parse ulang). Tolak jika timestamp lebih dari 5 menit dari jam kamu.
2. Balas **HTTP 2xx** secepatnya (timeout kami 7 detik). Selain 2xx dianggap gagal.
3. Gagal → diulang otomatis hingga **6 percobaan** dengan jeda bertahap (±1 mnt, 5 mnt, 15 mnt, 1 jam, 3 jam).
4. Webhook bisa datang **lebih dari sekali**. Jadikan proses idempoten: abaikan jika \`invoice_id\` sudah kamu proses.
5. Sebelum memberi barang, boleh konfirmasi ulang lewat \`GET /qris/status/{invoice_id}\`.

---

## 7. Contoh kode

### 7.1 Node.js (18+) — buat tagihan (dengan/ tanpa HMAC) dan cek status

${F}js
import crypto from 'crypto'

const BASE = '${base}'
const KEY = process.env.AGW_KEY            // agw_live_...
const SECRET = process.env.AGW_SECRET      // agw_sec_... (kosongkan jika key tanpa tanda tangan)

async function call(method, path, body) {
  const raw = body ? JSON.stringify(body) : ''
  const headers = { 'X-API-Key': KEY, 'Content-Type': 'application/json' }
  if (SECRET) {
    const ts = String(Math.floor(Date.now() / 1000))
    const canon = [method, '/api/agw' + path.split('?')[0], raw, ts].join('\\n')
    headers['X-Timestamp'] = ts
    headers['X-Signature'] = crypto.createHmac('sha256', SECRET).update(canon).digest('hex')
  }
  const r = await fetch(BASE + path, { method, headers, body: raw || undefined })
  const j = await r.json()
  if (!j.success) throw new Error(j.code + ': ' + j.message)
  return j
}

const { invoice } = await call('POST', '/qris/create', { amount: 25000, order_id: 'INV-1001' })
console.log('Bayar persis Rp', invoice.total_pay, '→', invoice.qr_image)

const st = await call('GET', '/qris/status/' + invoice.invoice_id)
console.log(st.status)
${F}

### 7.2 Node.js — menerima webhook (Express)

${F}js
import express from 'express'
import crypto from 'crypto'

const WHSEC = process.env.AGW_WEBHOOK_SECRET   // whsec_...
const app = express()

// WAJIB body mentah untuk verifikasi tanda tangan
app.post('/agw-webhook', express.raw({ type: '*/*' }), (req, res) => {
  const raw = req.body.toString('utf8')
  const ts = req.header('X-AGW-Timestamp') || ''
  const sig = req.header('X-AGW-Signature') || ''
  const exp = 'sha256=' + crypto.createHmac('sha256', WHSEC).update(ts + '.' + raw).digest('hex')
  const okSig = sig.length === exp.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(exp))
  if (!okSig || Math.abs(Date.now() / 1000 - Number(ts)) > 300) return res.sendStatus(401)

  const ev = JSON.parse(raw)
  if (ev.event === 'invoice.paid') {
    // idempoten: cek dulu apakah ev.invoice_id sudah pernah diproses
    // lalu tandai pesanan ev.order_id sebagai lunas
  }
  res.sendStatus(200)
})
app.listen(3000)
${F}

### 7.3 PHP

${F}php
<?php
$base = '${base}';
$key = getenv('AGW_KEY');
$secret = getenv('AGW_SECRET'); // kosong jika tanpa tanda tangan

function agw($method, $path, $body = null) {
  global $base, $key, $secret;
  $raw = $body ? json_encode($body, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES) : '';
  $h = ["X-API-Key: $key", 'Content-Type: application/json'];
  if ($secret) {
    $ts = (string) time();
    $canon = implode("\\n", [$method, '/api/agw' . explode('?', $path)[0], $raw, $ts]);
    $h[] = "X-Timestamp: $ts";
    $h[] = 'X-Signature: ' . hash_hmac('sha256', $canon, $secret);
  }
  $ch = curl_init($base . $path);
  curl_setopt_array($ch, [CURLOPT_CUSTOMREQUEST => $method, CURLOPT_HTTPHEADER => $h,
    CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 20]);
  if ($raw !== '') curl_setopt($ch, CURLOPT_POSTFIELDS, $raw);
  $res = json_decode(curl_exec($ch), true);
  return $res;
}

$r = agw('POST', '/qris/create', ['amount' => 25000, 'order_id' => 'INV-1001']);
if (!$r['success']) die($r['code'] . ': ' . $r['message']);
echo 'Bayar persis Rp ' . $r['invoice']['total_pay'];

// --- menerima webhook ---
$raw = file_get_contents('php://input');
$ts = $_SERVER['HTTP_X_AGW_TIMESTAMP'] ?? '';
$sig = $_SERVER['HTTP_X_AGW_SIGNATURE'] ?? '';
$exp = 'sha256=' . hash_hmac('sha256', $ts . '.' . $raw, getenv('AGW_WEBHOOK_SECRET'));
if (!hash_equals($exp, $sig) || abs(time() - (int)$ts) > 300) { http_response_code(401); exit; }
$ev = json_decode($raw, true);
if ($ev['event'] === 'invoice.paid') { /* tandai $ev['order_id'] lunas (idempoten) */ }
http_response_code(200);
${F}

### 7.4 Python 3

${F}python
import hashlib, hmac, json, os, time, requests

BASE = '${base}'
KEY = os.environ['AGW_KEY']
SECRET = os.environ.get('AGW_SECRET', '')

def agw(method, path, body=None):
    raw = json.dumps(body, separators=(',', ':'), ensure_ascii=False) if body else ''
    headers = {'X-API-Key': KEY, 'Content-Type': 'application/json'}
    if SECRET:
        ts = str(int(time.time()))
        canon = '\\n'.join([method, '/api/agw' + path.split('?')[0], raw, ts])
        headers['X-Timestamp'] = ts
        headers['X-Signature'] = hmac.new(SECRET.encode(), canon.encode(), hashlib.sha256).hexdigest()
    r = requests.request(method, BASE + path, headers=headers,
                         data=raw.encode() if raw else None, timeout=20)
    j = r.json()
    if not j.get('success'):
        raise RuntimeError(f"{j.get('code')}: {j.get('message')}")
    return j

inv = agw('POST', '/qris/create', {'amount': 25000, 'order_id': 'INV-1001'})['invoice']
print('Bayar persis Rp', inv['total_pay'])

# --- verifikasi webhook (Flask) ---
def verify(raw: bytes, ts: str, sig: str, whsec: str) -> bool:
    exp = 'sha256=' + hmac.new(whsec.encode(), ts.encode() + b'.' + raw, hashlib.sha256).hexdigest()
    return hmac.compare_digest(exp, sig) and abs(time.time() - int(ts)) <= 300
${F}

---

## 8. Kode galat

Galat selalu berbentuk \`{"success": false, "code": "...", "message": "..."}\`.

| HTTP | code | Arti |
|---|---|---|
| 400 | \`bad_request\`, \`invalid_json\`, \`missing_id\` | Permintaan tidak lengkap / body bukan JSON |
| 401 | \`missing_api_key\`, \`invalid_api_key\` | Key tidak dikirim / salah |
| 401 | \`signature_required\`, \`signature_invalid\`, \`timestamp_expired\` | Masalah tanda tangan HMAC (jam server kamu harus akurat) |
| 403 | \`key_disabled\`, \`ip_not_allowed\` | Key dinonaktifkan admin / IP tidak di whitelist |
| 404 | \`not_found\` | Endpoint atau tagihan tidak ada (atau milik key lain) |
| 409 | \`order_paid\`, \`order_conflict\`, \`already_paid\`, \`busy\` | Konflik status; \`busy\` = ulangi sebentar lagi |
| 422 | \`invalid_amount\`, \`invalid_order_id\`, \`invalid_metadata\` | Nilai field tidak valid |
| 429 | \`rate_limited\` | Terlalu banyak request; ikuti header \`Retry-After\` |
| 503 | \`gateway_off\`, \`smp_not_ready\` | Gateway dimatikan admin / SMP belum dikonfigurasi |
| 500 | \`server_error\` | Kesalahan server, coba lagi |

## 9. Batas & praktik terbaik

- Buat tagihan: 30/menit per key. Endpoint lain: 300/menit per key.
- Selalu kirim \`order_id\` unik per pesanan → retry jaringan tidak membuat tagihan ganda.
- Tampilkan **total_pay** (bukan amount) ke pembeli dan beri tahu harus dibayar persis.
- Tampilkan hitung mundur dari \`expired_at\`. Setelah itu, buat tagihan baru dengan order_id baru.
- Simpan \`invoice_id\` dan \`reference\` (RRN) untuk rekonsiliasi dengan mutasi SMP Payment.
- Jangan menaruh API key / secret di frontend atau repositori publik. Jika bocor, minta admin **Ganti key**.
- \`qr_image\` memakai layanan render QR pihak ketiga; untuk privasi penuh render sendiri dari \`qr_string\` dengan library QR di aplikasimu.

## 10. Pemecahan masalah

| Gejala | Penyebab umum |
|---|---|
| \`invalid_api_key\` | Key salah salin / sudah diganti admin. Cek spasi di awal/akhir |
| \`signature_invalid\` | Body yang ditandatangani berbeda dari yang dikirim, atau path salah (harus \`/api/agw/...\`, tanpa query) |
| \`timestamp_expired\` | Jam server aplikasimu menyimpang >5 menit. Sinkronkan NTP. Timestamp harus dalam **detik** |
| Pembeli sudah bayar tapi status \`pending\` | Pembeli membayar nominal berbeda dari \`total_pay\`. Hubungi admin untuk dicocokkan manual |
| Webhook tidak masuk | URL harus https publik, balas 2xx < 7 detik, dan tanda tangan diverifikasi dengan body mentah. Minta admin menekan **Tes webhook** / **Kirim ulang** |

---
*Ada pertanyaan atau butuh key? Hubungi admin gateway.*  
*Dokumen ini dibuat otomatis dari panel admin (${origin}/admin).*
`}
