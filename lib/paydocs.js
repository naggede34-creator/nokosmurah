// Isi dokumentasi API QRIS Gateway. Satu sumber, dipakai halaman /pay/docs dan tombol unduh.
export const EP=[
 {g:'Akun',ic:'👤',id:'akun',items:[
  ['GET','/account','Info akun pemilik API key: status, saldo gateway, dan ringkasan transaksi.',[],
   `{
  "success": true,
  "user": { "id": "a1b2", "username": "Budi", "email": "budi@mail.com", "status": "active",
            "wallet": { "balance": 150000 } },
  "stats": { "total_in": 2450000, "total_net": 2432850, "total_out": 2000000, "pending": 1 }
}`],
  ['GET','/transactions','Riwayat gabungan QRIS masuk & penarikan, dengan halaman dan penyaring.',
   [['page','nomor halaman (bawaan 1)'],['limit','baris per halaman, maks 50 (bawaan 10)'],['type','deposit / withdraw'],
    ['status','paid / pending / expired / canceled / success / rejected'],['date_from','YYYY-MM-DD'],['date_to','YYYY-MM-DD']],
   `{
  "success": true,
  "data": [ { "transaction_id": "APY-M2K9X1AB", "type": "deposit", "amount": 50000,
              "fee": 350, "net": 49650, "status": "paid" } ],
  "meta": { "page": 1, "limit": 10, "total": 42, "totalPages": 5 }
}`]]},
 {g:'QRIS masuk',ic:'▣',id:'qris',items:[
  ['POST','/deposit/create','Terbitkan QRIS dinamis. Dibatasi 5 permintaan per menit. Setelah terbit, polling status tiap 5 detik — atau pakai webhook supaya tidak perlu polling sama sekali.',
   [['amount','nominal yang ingin kamu terima, dalam rupiah (wajib)']],
   `{
  "success": true,
  "deposit": {
    "transaction_id": "APY-M2K9X1AB",
    "reference": "APG-A1B2C3D4",
    "receipt_token": "9f3c1a7b2e04",
    "amount": 50000,        // nominal yang kamu minta
    "fee": 350,             // biaya layanan kami
    "net": 49650,           // yang masuk ke saldo gateway kamu
    "total_paid": 50200,    // yang HARUS dibayar pembeli (sudah termasuk biaya penyedia QRIS)
    "qr_string": "00020101021226610016ID.CO...",
    "qr_image": "data:image/png;base64,iVBORw0KG...",
    "status": "pending",
    "expired_at": "2026-10-13T10:20:00.000Z",
    "created_at": "2026-10-13T10:10:00.000Z"
  }
}`],
  ['GET','/deposit/check/{id}','Cek status pembayaran. Saat berubah jadi paid, saldo gateway otomatis bertambah sebesar net.',
   [['id','transaction_id dari Create (boleh juga reference)']],
   `{
  "success": true,
  "status": "paid",
  "message": "Pembayaran diterima, saldo sudah ditambahkan.",
  "deposit": { "transaction_id": "APY-M2K9X1AB", "status": "paid", "net": 49650,
               "paid_at": "2026-10-13T10:12:31.000Z" }
}`],
  ['POST','/deposit/cancel/{id}','Batalkan QRIS yang masih pending. Kalau ternyata baru saja lunas, pembatalan ditolak dan saldo tetap dikreditkan.',
   [['id','transaction_id yang mau dibatalkan']],
   `{ "success": true, "status": "canceled", "message": "QRIS berhasil dibatalkan" }`],
  ['GET','/deposit/history','Riwayat QRIS masuk.',
   [['page','nomor halaman'],['limit','maks 50'],['status','pending / paid / expired / canceled'],['search','cari di transaction_id']],
   `{ "success": true, "data": [ { "transaction_id": "APY-M2K9X1AB", "amount": 50000, "status": "paid" } ],
  "total": 5, "page": 1, "limit": 10, "pages": 1 }`]]},
 {g:'Tarik dana (manual)',ic:'↗',id:'tarik',items:[
  ['GET','/withdraw/methods','Daftar tujuan tarik dana yang sedang aktif beserta batas nominal dan biayanya. Admin bisa menyalakan/mematikan tiap metode.',[],
   `{
  "success": true,
  "enabled": true,
  "min": 5000, "max": 10000000,
  "fee_percent": 3, "fee_flat": 0,
  "methods": [ { "code": "DANA", "name": "DANA", "type": "ewallet" },
               { "code": "BCA", "name": "Bank BCA", "type": "bank" } ]
}`],
  ['POST','/withdraw/create','Ajukan penarikan saldo gateway ke e-wallet / bank. Prosesnya MANUAL oleh admin: saldo langsung dipotong sebesar nominal, status pending, lalu berubah menjadi success setelah dana dikirim (10 menit sampai 2 jam, tergantung admin sibuk atau tidak). Kalau ditolak, saldo dikembalikan.',
   [['method','kode dari /withdraw/methods, mis. DANA atau BCA (wajib)'],['account','nomor HP e-wallet / nomor rekening bank, 5-20 digit (wajib)'],
    ['account_name','nama pemilik akun / rekening tujuan (wajib)'],['nominal','jumlah yang ditarik dari saldo, minimal 5.000 dan maksimal 10.000.000 (wajib)']],
   `{
  "success": true,
  "status": "pending",
  "message": "WD kamu sedang diproses. Dana masuk antara 10 menit sampai 2 jam ...",
  "withdraw": { "transaction_id": "APY-M2KA01CD", "method": "DANA", "destination": "081234567890",
                "account_name": "Budi Santoso", "nominal": 100000, "fee": 3000, "net": 97000,
                "total": 100000, "status": "pending" }
}`],
  ['GET','/withdraw/history','Riwayat penarikan beserta statusnya.',
   [['page','nomor halaman'],['limit','maks 50'],['status','pending / success / rejected']],
   `{ "success": true, "data": [ { "transaction_id": "APY-M2KA01CD", "method": "DANA",
  "nominal": 100000, "net": 97000, "status": "success" } ], "total": 14, "page": 1, "pages": 2 }`]]}]

export const EVENTS=[
 ['qris.paid','QRIS lunas dibayar pembeli. Saldo gateway sudah ditambah sebesar net.'],
 ['qris.expired','QRIS lewat batas waktu tanpa dibayar.'],
 ['qris.canceled','QRIS dibatalkan lewat API atau dashboard.'],
 ['withdraw.pending','Pengajuan penarikan diterima dan menunggu diproses admin.'],
 ['withdraw.success','Admin sudah memproses: dana sampai ke tujuan.'],
 ['withdraw.rejected','Penarikan ditolak admin. Saldo sudah dikembalikan.']]
export const ERRS=[
 ['200','OK','Permintaan berhasil diproses.'],
 ['400','Bad Request','Parameter kurang/salah, nominal di luar batas, atau saldo tidak cukup.'],
 ['401','Unauthorized','API key tidak ada, tidak valid, atau tanda tangan HMAC tidak cocok.'],
 ['403','Forbidden','Akun gateway dibekukan, atau IP pemanggil tidak ada di whitelist.'],
 ['404','Not Found','Transaksi atau endpoint tidak ditemukan.'],
 ['429','Too Many Requests','Rate limit terlampaui. Pakai jeda bertingkat (exponential backoff) sebelum mencoba lagi.'],
 ['500','Server Error','Gangguan di sisi kami. Coba lagi beberapa saat.']]
export const LIMITS=[
 ['POST /deposit/create','5 permintaan / menit','Dijaga ketat supaya QRIS tidak dibuat beruntun tanpa dibayar.'],
 ['Endpoint lainnya','300 permintaan / menit','Dihitung per API key.'],
 ['Lewat batas','HTTP 429','Balasan menyertakan header Retry-After (detik).']]

export const snippets=(root,key)=>{
 const K=key||'apay_live_xxxxxxxxxxxxxxxxxxxx'
 return {
  curl:`curl -X POST "${root}/api/pay/deposit/create" \\
  -H "X-API-Key: ${K}" \\
  -H "Content-Type: application/json" \\
  -d '{"amount":50000}'`,
  js:`const r = await fetch("${root}/api/pay/deposit/create", {
  method: "POST",
  headers: { "X-API-Key": "${K}", "Content-Type": "application/json" },
  body: JSON.stringify({ amount: 50000 }),
});
const d = await r.json();
if (!d.success) throw new Error(d.message);
console.log(d.deposit.qr_image, d.deposit.total_paid);`,
  php:`<?php
$ch = curl_init("${root}/api/pay/deposit/create");
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST           => true,
    CURLOPT_HTTPHEADER     => ["X-API-Key: ${K}", "Content-Type: application/json"],
    CURLOPT_POSTFIELDS     => json_encode(["amount" => 50000]),
]);
$res = json_decode(curl_exec($ch), true);
curl_close($ch);
echo $res["deposit"]["qr_image"];`}}

export const HMAC_JS=`import crypto from "node:crypto";

function sign(method, path, body, secret) {
  const timestamp = Date.now().toString();            // milidetik
  const payload = \`\${method}\\n\${path}\\n\${body}\\n\${timestamp}\`;
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return { timestamp, signature };
}

const path = "/api/pay/deposit/create";               // path murni, TANPA query string
const body = JSON.stringify({ amount: 50000 });
const { timestamp, signature } = sign("POST", path, body, process.env.APAY_SECRET);

await fetch(BASE + path, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-API-Key":    process.env.APAY_KEY,
    "X-Timestamp":  timestamp,
    "X-Signature":  signature,
  },
  body,
});`
export const HOOK_JS=`const crypto = require("crypto");

app.post("/webhook/apay", express.raw({ type: "application/json" }), (req, res) => {
  const ts  = req.headers["x-artapedia-timestamp"];
  const sig = req.headers["x-artapediapay-signature"];
  const expected = crypto.createHmac("sha256", process.env.APAY_WEBHOOK_SECRET)
    .update(ts + "." + req.body)                      // raw Buffer, bukan hasil JSON.parse
    .digest("hex");

  if (sig.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)))
    return res.status(401).json({ error: "signature tidak valid" });

  const { event, data } = JSON.parse(req.body);
  if (event === "qris.paid") {
    // tandai pesanan lunas — pakai data.transaction_id supaya tidak dobel
  }
  res.json({ success: true });                        // WAJIB 2xx dalam 10 detik
});`
