// ===========================================================================
// SUMBER TUNGGAL isi dokumentasi API. Dipakai halaman /docs untuk ditampilkan,
// DAN oleh tombol "Download dokumentasi lengkap" untuk membuat berkas HTML /
// Markdown / OpenAPI. Satu tempat, jadi isi web dan isi unduhan tidak pernah beda.
// ===========================================================================
// Server nokos (id dipakai di parameter `server`). Aktif/nonaktif diatur admin, selalu cek GET /servers.
export const SV=[
 ['warungnokos_s1','Server Plus','Utama','Artapedia (WarungNokos)','Pilih paket harga dari /countries → kirim provider_id & country_id apa adanya.'],
 ['warungnokos_s2','Server Express','Global','Artapedia (WarungNokos S2)','Sama seperti server 1. Cocok saat stok server utama kosong.'],
 ['jasaotp_s1','JasaOTP 1','Pilih operator','JasaOTP / Ditznesia','providerId = nama operator (telkomsel, indosat, …) atau "any" untuk acak.'],
 ['jasaotp_s2','JasaOTP 2','Banyak varian','JasaOTP / Ditznesia','Beberapa varian harga per layanan. providerId = id varian dari /countries.'],
 ['jasaotp_s3','JasaOTP 3','Simpel','JasaOTP / Ditznesia','Satu harga per layanan. providerId = "default".'],
 ['jasaotp_s4','JasaOTP 4','Global','JasaOTP / Ditznesia','Banyak negara & varian harga. providerId = id varian.'],
 ['jasaotp_s5','JasaOTP 5','Multi provider','JasaOTP / Ditznesia','Varian dari banyak provider. providerId = id varian.']]
// Metode deposit (kode dipakai di field `provider` pada POST /deposit)
export const MD=[
 ['qris','QRIS','Artapedia · Pakasir · Ditznesia (acak berbobot, otomatis pindah rute jika gagal)','Rp2.000','Rp10.000.000'],
 ['bri_va','VA BRI','Pakasir','Rp10.000','Rp50.000.000'],['bni_va','VA BNI','Pakasir','Rp10.000','Rp50.000.000'],
 ['cimb_niaga_va','VA CIMB Niaga','Pakasir','Rp10.000','Rp50.000.000'],['permata_va','VA Permata','Pakasir','Rp10.000','Rp50.000.000'],
 ['maybank_va','VA Maybank','Pakasir','Rp10.000','Rp50.000.000'],['bnc_va','VA Bank Neo Commerce','Pakasir','Rp10.000','Rp50.000.000'],
 ['artha_graha_va','VA Artha Graha','Pakasir','Rp10.000','Rp50.000.000'],['sampoerna_va','VA Sahabat Sampoerna','Pakasir','Rp10.000','Rp50.000.000']]
export const ORDER_ST=[['pending','Menunggu kode OTP'],['success','Kode masuk (done). otpCode terisi'],['cancelled','Dibatalkan pengguna, saldo kembali'],['expired','Kedaluwarsa tanpa kode, saldo kembali otomatis']]
export const DEP_ST=[['pending','Menunggu pembayaran'],['completed','Lunas, saldo + bonus sudah masuk'],['canceled','Dibatalkan'],['expired','Lewat batas bayar'],['failed','Gagal dari gateway']]
export const G=[
 {id:'akun',t:'Akun',ic:'👤',c:'#3b7fe0',items:[
  ['GET','/me','Info akun, saldo, dan API key.',[],'{ "name": "Budi", "email": "budi@mail.com", "balance": 48500, "apikey": "...", "refCode": "AB12CD" }'],
  ['GET','/mutasi','100 mutasi saldo terakhir. Setiap deposit mencatat ID-nya, mis. "Deposit ART...".',[],'{ "items": [{ "note": "Deposit ARTMG2K...", "amt": 10000, "at": 1760000000000 }] }'],
  ['POST','/apikey','Buat API key baru. Key lama langsung mati.',[],'{ "apikey": "key_baru..." }']]},
 {id:'server',t:'Server & harga',ic:'🖥️',c:'#7a5cff',items:[
  ['GET','/servers','Daftar server nokos yang sedang aktif (id, nama, badge, deskripsi).',[],'{ "items": [{ "server": "warungnokos_s1", "name": "Server Plus", "badge": "Utama" }, { "server": "jasaotp_s1", "name": "JasaOTP 1" }] }'],
  ['GET','/services?server=','Daftar aplikasi/layanan OTP pada satu server.',[['server','id server, mis. warungnokos_s1, jasaotp_s1 … jasaotp_s5']],'{ "server": "jasaotp_s1", "items": [{ "service_code": "wa", "service_name": "WhatsApp" }] }'],
  ['GET','/countries?server=&service_id=','Negara, stok, dan harga jual (sell_price) per paket. provider_id & country_id dipakai di /order.',[['server','id server'],['service_id','service_code dari /services']],'{ "items": [{ "name": "Indonesia", "flag": "🇮🇩", "pricelist": [{ "provider_id": "any", "country_id": "id", "sell_price": 3500, "stock": 120 }] }] }']]},
 {id:'order',t:'Order nomor',ic:'🛒',c:'#ff7a1a',items:[
  ['POST','/order','Buat order nomor. Saldo langsung terpotong. Kalau penyedia gagal, saldo otomatis kembali.',[['server','id server (bawaan warungnokos_s1)'],['serviceId','service_code'],['countryId','country_id dari /countries'],['providerId','provider_id dari /countries'],['serviceName','opsional, nama aplikasi untuk riwayat'],['countryName','opsional, nama negara untuk riwayat'],['guarantee','true = Jaminan OTP (+10%)']],'{ "orderId": "123", "server": "jasaotp_s1", "phoneNumber": "628123...", "price": 3500, "fee": 0, "guarantee": false, "expiredAt": 1760000000000, "balance": 45000 }'],
  ['GET','/orders','Daftar order (terbaru dulu).',[['limit','maks 100'],['page','nomor halaman']],'{ "page": 1, "items": [{ "orderId": "123", "status": "pending", "phoneNumber": "628123..." }] }'],
  ['GET','/orders/status?order_id=','Cek status dan kode OTP. Panggil tiap 3–5 detik. Order Jaminan OTP otomatis ganti nomor setelah 4 menit (orderId & phoneNumber bisa berubah, replaced=true).',[['order_id','id order']],'{ "status": "success", "otpCode": "482913", "replaced": false, "refunded": false }'],
  ['POST','/orders/cancel','Batalkan order selama kode OTP belum masuk, lalu saldo kembali.',[['order_id','id order']],'{ "status": "cancelled", "refunded": true, "balance": 48500 }']]},
 {id:'deposit',t:'Deposit',ic:'💳',c:'#16c47f',items:[
  ['GET','/deposit/methods','Metode deposit yang sedang aktif beserta batas nominalnya. Selalu cek dulu: admin bisa menyalakan/mematikan tiap metode & rute.',[],'{ "methods": [{ "provider": "qris", "name": "QRIS", "type": "qris", "min": 2000, "max": 10000000 }, { "provider": "bri_va", "name": "BRI", "type": "va", "min": 10000, "max": 50000000 }], "min": 2000, "max": 10000000 }'],
  ['POST','/deposit','Buat deposit. Untuk QRIS, rute gateway dipilih acak oleh server (kamu tidak perlu memilih). Maks 3 deposit belum dibayar sekaligus. Bonus cashback masuk otomatis saat lunas.',[['amount','nominal dalam rupiah (sesuai min/max metode)'],['provider','kode metode dari /deposit/methods: qris, bri_va, bni_va, …']],'{ "order_id": "ARTMG2K9X1AB", "method": "qris", "method_name": "QRIS", "amount": 10000, "total_amount": 10120, "admin_fee": 120, "status": "pending", "qr_string": "000201...", "qr_image": "https://...", "va_number": "", "expired_at": "2026-10-12T10:30:00Z" }'],
  ['GET','/deposit?order_id=','Status deposit. Tanpa order_id = 20 deposit terakhir. Polling tiap 5 detik sampai status bukan pending.',[['order_id','ID deposit (order_id) dari POST /deposit']],'{ "order_id": "ARTMG2K9X1AB", "status": "completed", "credited": true, "balance": 58500 }'],
  ['POST','/deposit/cancel','Batalkan deposit yang belum dibayar. Kalau ternyata sudah dibayar, saldo dikreditkan dan pembatalan ditolak.',[['order_id','ID deposit']],'{ "ok": 1, "status": "canceled" }']]},
 {id:'publik',t:'Publik (tanpa API key)',ic:'🌍',c:'#f59e0b',items:[
  ['GET','/announcements','Pengumuman dari admin.',[],'{ "items": [{ "title": "...", "body": "..." }] }'],
  ['GET','/leaderboard','Leaderboard saldo, transaksi, mingguan, dan bulanan (email disensor).',[],'{ "bal": [], "trx": [], "wk": [], "mo": [] }'],
  ['GET','/promo','Info cashback deposit, referral, hadiah leaderboard, dan base URL API.',[],'{ "bonus": { "on": true, "pct": 2, "minAmt": 5000 }, "ref": {}, "weekly": {} }']]}]
export const FLOW_ORDER=`const BASE = "BASE_URL/api/v1";
const H = { Authorization: "Bearer API_KEY", "Content-Type": "application/json" };
const get = (p) => fetch(BASE + p, { headers: H }).then(r => r.json());
const post = (p, b) => fetch(BASE + p, { method: "POST", headers: H, body: JSON.stringify(b) }).then(r => r.json());

// 1) pilih server, aplikasi, negara
const { items: servers } = await get("/servers");
const server = servers[0].server;
const { items: apps } = await get("/services?server=" + server);
const wa = apps.find(a => /whatsapp/i.test(a.service_name));
const { items: negara } = await get("/countries?server=" + server + "&service_id=" + wa.service_code);
const paket = negara[0].pricelist[0];

// 2) order (saldo terpotong)
const o = await post("/order", { server, serviceId: wa.service_code, serviceName: wa.service_name,
  countryId: paket.country_id, providerId: paket.provider_id, countryName: negara[0].name, guarantee: true });
if (o.error) throw new Error(o.error);

// 3) tunggu OTP (polling)
let s;
do { await new Promise(r => setTimeout(r, 4000)); s = await get("/orders/status?order_id=" + o.orderId); }
while (s.status === "pending");
console.log(s.status, s.otpCode); // success 482913 / expired (saldo kembali)`
export const FLOW_DEP=`// 1) metode aktif
const { methods } = await get("/deposit/methods");     // qris, bri_va, ...
// 2) buat deposit
const d = await post("/deposit", { amount: 20000, provider: "qris" });
console.log("ID Deposit:", d.order_id, "| bayar:", d.total_amount);
// QRIS: tampilkan d.qr_image (atau render d.qr_string). VA: tampilkan d.va_number
// 3) polling status tiap 5 detik
let x;
do { await new Promise(r => setTimeout(r, 5000)); x = await get("/deposit?order_id=" + d.order_id); }
while (x.status === "pending");
console.log(x.status, x.balance); // completed 78500 (sudah termasuk bonus cashback)`
export const ERR=[['401','API key tidak valid atau belum login'],['403','Akun ditangguhkan'],['400','Parameter salah, saldo tidak cukup, nominal di luar batas, atau terlalu banyak deposit belum dibayar'],['404','Data / order / deposit tidak ditemukan'],['429','Rate limit: 60 request/menit per key (POST /order 20/mnt, POST /deposit 6/mnt). Lihat header Retry-After'],['502','Penyedia nomor menolak / gangguan (saldo order otomatis dikembalikan)'],['503','Server nokos dimatikan admin']]

// ===========================================================================
// Pembuat berkas "dokumentasi lengkap" untuk diunduh.
// Isinya SAMA PERSIS dengan yang tampil di /docs, dirangkum jadi satu berkas
// supaya pengguna tidak perlu membuka tiap bagian satu-satu.
// ===========================================================================
export const META={title:'Dokumentasi API Artapedia ID',version:'v1',
 intro:'Beli nomor OTP di 7 server nokos, isi saldo lewat QRIS & 8 Virtual Account, cek kode, dan kelola akun dari aplikasimu sendiri. Semua respon berformat JSON.'}
export const LIMITS=[['Rate limit umum','60 request / menit per API key'],['POST /order','20 request / menit'],['POST /deposit','6 request / menit'],
 ['Header sisa kuota','X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset'],['Kena limit','HTTP 429 + header Retry-After (detik)']]
export const NOTES=[
 ['Jaminan OTP','Kirim guarantee:true pada POST /order (+10% dari harga). Kode belum masuk dalam 4 menit → nomor diganti otomatis sekali (orderId & phoneNumber berubah, replaced:true). Kalau tetap gagal, seluruh saldo termasuk biaya jaminan dikembalikan.'],
 ['Saldo saat order gagal','Nomor dipesan ke penyedia DULU, saldo baru dipotong setelah nomor didapat. Order yang gagal / timeout tidak pernah memotong saldo.'],
 ['Maintenance','Saat admin menyalakan maintenance, POST /order dan POST /deposit membalas 503 dengan {"error":"...","maintenance":true}. Maintenance per server hanya menolak server itu (/servers menandainya maintenance:true). Cek status, pembatalan, dan refund tetap jalan.'],
 ['Rute deposit','Kamu hanya memilih metode (field provider). Rute gateway di belakang QRIS dipilih server secara acak berbobot; kalau satu rute gagal, otomatis pindah ke rute lain. Virtual Account selalu lewat Pakasir.'],
 ['Bonus deposit','Cashback persen (diatur admin, lihat GET /promo) masuk otomatis ke saldo saat deposit lunas, bersama bonus ajakan teman untuk deposit pertama.'],
 ['Keamanan key','Whitelist IP: kalau diisi, request dari IP lain dibalas 403. Webhook OTP (https, ditandatangani HMAC-SHA256 di header X-Artapedia-Signature) diatur di dashboard. Buat ulang key hanya bisa lewat login dashboard, tidak lewat API key.'],
 ['Webhook OTP','Saat kode masuk, kami POST JSON ke URL-mu. Tanda tangan: HMAC_SHA256(secret, timestamp + "." + rawBody), dikirim di X-Artapedia-Signature sebagai sha256=<hex>, dengan X-Artapedia-Timestamp. Balas HTTP 2xx. Dikirim sekali per order (diulang 1x kalau gagal) — cegah dobel dengan order_id.']]

const pad=(s,n)=>String(s)+' '.repeat(Math.max(0,n-String(s).length))
const tableMd=(head,rows)=>['| '+head.join(' | ')+' |','|'+head.map(()=>'---').join('|')+'|',
 ...rows.map(r=>'| '+r.map(c=>String(c).replace(/\|/g,'\\|')).join(' | ')+' |')].join('\n')

// ---------- Markdown ----------
export function buildMarkdown(root,at=new Date()){
 const base=root+'/api/v1',L=[]
 L.push('# '+META.title,'',META.intro,'',
  '- **Base URL:** `'+base+'`','- **Autentikasi:** `Authorization: Bearer API_KEY` (atau `?api_key=KEY`)',
  '- **Versi:** '+META.version,'- **Diunduh:** '+at.toLocaleString('id-ID',{timeZone:'Asia/Jakarta'})+' WIB','',
  'API key ada di Dashboard › **API Key & Docs developer**. Ganti `API_KEY` di contoh-contoh di bawah dengan key milikmu.','',
  '> Berkas ini dibuat otomatis dari halaman dokumentasi, jadi isinya selalu sama dengan versi web.','','---','')
 L.push('## Daftar isi','',
  ['Server nokos','Metode & rute deposit','Alur & contoh kode','Daftar endpoint','Status','Batas pemakaian','Kode error','Catatan penting']
   .map((t,i)=>(i+1)+'. '+t).join('\n'),'','---','')
 L.push('## 1. Server nokos','',
  'Kirim id server di parameter `server` pada `/services`, `/countries`, dan `/order`. Server yang dimatikan admin tidak muncul di `/servers` dan menolak order (503). Harga & stok berbeda tiap server.','',
  tableMd(['ID server','Nama','Lencana','Penyedia','Cara pakai providerId'],SV),'','---','')
 L.push('## 2. Metode & rute deposit','',
  tableMd(['Kode (provider)','Metode','Rute gateway','Min','Maks'],MD),'',
  'Batas nominal bisa diubah admin — selalu ambil nilai terbaru dari `GET /deposit/methods`.','','---','')
 L.push('## 3. Alur & contoh kode','',
  '**Alur beli OTP:** pilih server (`GET /servers`) → aplikasi & harga (`GET /services`, `GET /countries`) → buat order (`POST /order`) → tunggu OTP (`GET /orders/status`) → selesai atau batal (refund otomatis).','',
  '**Alur deposit:** cek metode (`GET /deposit/methods`) → buat deposit (`POST /deposit`) → bayar QR / VA sebelum `expired_at` → polling (`GET /deposit?order_id=`) → `completed`, saldo + bonus masuk.','',
  '### Contoh: beli OTP (JavaScript)','','```js',FLOW_ORDER.replace('BASE_URL',root),'```','',
  '### Contoh: deposit (JavaScript)','','```js',FLOW_DEP,'```','','---','')
 L.push('## 4. Daftar endpoint','')
 for(const g of G){
  L.push('### '+g.ic+' '+g.t,'')
  for(const [m,p,d,pa,ex] of g.items){
   L.push('#### `'+m+' '+p+'`','',d,'','**URL:** `'+m+' '+base+p+'`','')
   if(pa.length)L.push('**Parameter:**','',tableMd(['Nama','Keterangan'],pa.map(x=>['`'+x[0]+'`',x[1]])),'')
   L.push('**Contoh respon:**','','```json',ex,'```','')}}
 L.push('---','')
 L.push('## 5. Status','','**Status order (`status`):**','',tableMd(['Nilai','Arti'],ORDER_ST.map(x=>['`'+x[0]+'`',x[1]])),'',
  '**Status deposit (`status`):**','',tableMd(['Nilai','Arti'],DEP_ST.map(x=>['`'+x[0]+'`',x[1]])),'','---','')
 L.push('## 6. Batas pemakaian','',tableMd(['Hal','Nilai'],LIMITS),'','---','')
 L.push('## 7. Kode error','',tableMd(['HTTP','Arti'],ERR.map(x=>['`'+x[0]+'`',x[1]])),'',
  'Semua error berbentuk `{"error":"pesan yang bisa ditampilkan ke pengguna"}`.','','---','')
 L.push('## 8. Catatan penting','')
 for(const [t,d] of NOTES)L.push('### '+t,'',d,'')
 L.push('---','','_'+META.title+' · '+base+'_')
 return L.join('\n')}

// ---------- HTML mandiri (bisa dibuka offline, rapi saat di-print jadi PDF) ----------
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
export function buildHtml(root,at=new Date()){
 const base=root+'/api/v1'
 const tb=(head,rows)=>'<div class="tw"><table><thead><tr>'+head.map(h=>'<th>'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'
  +rows.map(r=>'<tr>'+r.map(c=>'<td>'+c+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>'
 const code=t=>'<pre><code>'+esc(t)+'</code></pre>'
 const toc=[['server','1. Server nokos'],['deposit','2. Metode & rute deposit'],['alur','3. Alur & contoh kode'],
  ['endpoint','4. Daftar endpoint'],['status','5. Status'],['limit','6. Batas pemakaian'],['error','7. Kode error'],['catatan','8. Catatan penting']]
 let h=''
 h+='<h2 id="server">1. Server nokos</h2><p>Kirim id server di parameter <code>server</code> pada <code>/services</code>, <code>/countries</code>, dan <code>/order</code>. Server yang dimatikan admin tidak muncul di <code>/servers</code> dan menolak order (503).</p>'
 h+=tb(['ID server','Nama','Lencana','Penyedia','Cara pakai providerId'],SV.map(s=>['<code>'+esc(s[0])+'</code>','<b>'+esc(s[1])+'</b>',esc(s[2]),esc(s[3]),esc(s[4])]))
 h+='<h2 id="deposit">2. Metode &amp; rute deposit</h2>'
 h+=tb(['Kode (provider)','Metode','Rute gateway','Min','Maks'],MD.map(s=>['<code>'+esc(s[0])+'</code>','<b>'+esc(s[1])+'</b>',esc(s[2]),esc(s[3]),esc(s[4])]))
 h+='<p class="note">Batas nominal bisa diubah admin &mdash; selalu ambil nilai terbaru dari <code>GET /deposit/methods</code>.</p>'
 h+='<h2 id="alur">3. Alur &amp; contoh kode</h2>'
 h+='<p><b>Alur beli OTP:</b> pilih server (<code>GET /servers</code>) &rarr; aplikasi &amp; harga (<code>GET /services</code>, <code>GET /countries</code>) &rarr; buat order (<code>POST /order</code>) &rarr; tunggu OTP (<code>GET /orders/status</code>) &rarr; selesai atau batal (refund otomatis).</p>'
 h+='<p><b>Alur deposit:</b> cek metode (<code>GET /deposit/methods</code>) &rarr; buat deposit (<code>POST /deposit</code>) &rarr; bayar QR / VA sebelum <code>expired_at</code> &rarr; polling (<code>GET /deposit?order_id=</code>) &rarr; <code>completed</code>, saldo + bonus masuk.</p>'
 h+='<h3>Contoh: beli OTP (JavaScript)</h3>'+code(FLOW_ORDER.replace('BASE_URL',root))
 h+='<h3>Contoh: deposit (JavaScript)</h3>'+code(FLOW_DEP)
 h+='<h2 id="endpoint">4. Daftar endpoint</h2>'
 for(const g of G){
  h+='<h3>'+g.ic+' '+esc(g.t)+'</h3>'
  for(const [m,p,d,pa,ex] of g.items){
   h+='<div class="ep"><div class="ep-h"><span class="m '+m.toLowerCase()+'">'+m+'</span><code>'+esc(p)+'</code></div><p>'+esc(d)+'</p>'
   h+='<p class="url"><b>URL</b> <code>'+m+' '+esc(base+p)+'</code></p>'
   if(pa.length)h+='<p><b>Parameter</b></p>'+tb(['Nama','Keterangan'],pa.map(x=>['<code>'+esc(x[0])+'</code>',esc(x[1])]))
   h+='<p><b>Contoh respon</b></p>'+code(ex)+'</div>'}}
 h+='<h2 id="status">5. Status</h2><h3>Status order</h3>'+tb(['Nilai','Arti'],ORDER_ST.map(x=>['<code>'+esc(x[0])+'</code>',esc(x[1])]))
 h+='<h3>Status deposit</h3>'+tb(['Nilai','Arti'],DEP_ST.map(x=>['<code>'+esc(x[0])+'</code>',esc(x[1])]))
 h+='<h2 id="limit">6. Batas pemakaian</h2>'+tb(['Hal','Nilai'],LIMITS.map(x=>['<b>'+esc(x[0])+'</b>','<code>'+esc(x[1])+'</code>']))
 h+='<h2 id="error">7. Kode error</h2>'+tb(['HTTP','Arti'],ERR.map(x=>['<code>'+esc(x[0])+'</code>',esc(x[1])]))
 h+='<p class="note">Semua error berbentuk <code>{"error":"pesan yang bisa ditampilkan ke pengguna"}</code>.</p>'
 h+='<h2 id="catatan">8. Catatan penting</h2>'
 for(const [t,d] of NOTES)h+='<h3>'+esc(t)+'</h3><p>'+esc(d)+'</p>'
 return `<!doctype html>
<html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(META.title)}</title>
<style>
*{box-sizing:border-box}
:root{--ink:#14203d;--mut:#5b6b88;--line:#dbe3f2;--blue:#2563eb;--bg:#f6f9ff;--card:#fff}
body{margin:0;padding:0 16px 64px;font:16px/1.65 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:var(--ink);background:var(--bg);-webkit-text-size-adjust:100%}
.wrap{max-width:900px;margin:0 auto}
header{background:linear-gradient(135deg,#1f4fd0,#4b8bff);color:#fff;border-radius:0 0 26px 26px;margin:0 -16px 24px;padding:30px 20px}
header .in{max-width:900px;margin:0 auto}
header h1{margin:6px 0 8px;font-size:30px;line-height:1.2}
header p{margin:0 0 16px;opacity:.92;max-width:620px}
.chip{display:inline-block;background:rgba(255,255,255,.2);border-radius:99px;padding:4px 12px;font-size:12px;font-weight:700;letter-spacing:.06em}
.meta{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px}
.meta div{background:rgba(255,255,255,.14);border-radius:14px;padding:9px 13px;min-width:0}
.meta small{display:block;font-size:11px;font-weight:700;letter-spacing:.06em;opacity:.85}
.meta code{font-size:13px;word-break:break-all;color:#fff;background:none;padding:0;border:0}
nav{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:14px 18px;margin-bottom:26px}
nav b{display:block;font-size:12px;letter-spacing:.08em;color:var(--mut);margin-bottom:8px}
nav ol{margin:0;padding-left:20px;columns:2;column-gap:28px}
nav a{color:var(--blue);text-decoration:none}nav a:hover{text-decoration:underline}
h2{margin:38px 0 12px;font-size:23px;padding-bottom:8px;border-bottom:2px solid var(--line);scroll-margin-top:16px}
h3{margin:24px 0 8px;font-size:17px}
p{margin:8px 0}
code{background:#eef3ff;border:1px solid #dde7fb;border-radius:6px;padding:1px 5px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:13.5px;word-break:break-word}
pre{background:#14203d;color:#d6e2ff;border-radius:14px;padding:14px;overflow-x:auto;font-size:12.5px;line-height:1.6}
pre code{background:none;border:0;padding:0;color:inherit;white-space:pre-wrap;word-break:break-word;font-size:12.5px}
table{width:100%;border-collapse:collapse;margin:10px 0 16px;background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden;font-size:14px}
th{background:#14203d;color:#fff;text-align:left;padding:9px 12px;font-size:12.5px;letter-spacing:.04em}
td{padding:9px 12px;border-top:1px solid var(--line);vertical-align:top}
tr:nth-child(even) td{background:#f7faff}
.ep{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:14px 16px;margin:12px 0}
.ep-h{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:4px}
.ep-h code{font-size:14.5px;font-weight:700;background:none;border:0;padding:0}
.m{font-size:11.5px;font-weight:800;letter-spacing:.05em;color:#fff;border-radius:8px;padding:3px 9px}
.m.get{background:#16a35f}.m.post{background:#e8740c}
.url code{font-size:12.5px}
.tw{margin:0}
.note{background:#fff8e2;border:1px solid #f3e0a8;border-radius:12px;padding:10px 13px;font-size:14px}
footer{margin-top:40px;padding-top:16px;border-top:1px solid var(--line);color:var(--mut);font-size:13px;text-align:center}
@media print{body{background:#fff;padding:0}header{background:#1f4fd0 !important;-webkit-print-color-adjust:exact;print-color-adjust:exact;border-radius:0;margin:0 0 20px}
 pre,th{-webkit-print-color-adjust:exact;print-color-adjust:exact}.ep,table{break-inside:avoid}h2{break-after:avoid}}
@media(max-width:620px){nav ol{columns:1}header h1{font-size:24px}header{padding:22px 16px}
 body{font-size:15px}h2{font-size:20px}h3{font-size:16px}
 /* tabel lebar digeser di dalam kotaknya sendiri, halaman tidak ikut melebar */
 .tw{overflow-x:auto;-webkit-overflow-scrolling:touch;margin:10px 0 16px;border:1px solid var(--line);border-radius:14px;background:var(--card)}
 .tw table{margin:0;border:0;border-radius:0;min-width:460px}
 .ep{padding:12px 13px}.ep-h code{font-size:13.5px}
 pre{font-size:11.5px;padding:12px}pre code{font-size:11.5px}
}
</style></head><body>
<header><div class="in"><span class="chip">DEVELOPER API ${esc(META.version.toUpperCase())}</span>
<h1>${esc(META.title)}</h1><p>${esc(META.intro)}</p>
<div class="meta">
 <div><small>BASE URL</small><code>${esc(base)}</code></div>
 <div><small>AUTENTIKASI</small><code>Authorization: Bearer API_KEY</code></div>
 <div><small>RATE LIMIT</small><code>60 request / menit</code></div>
 <div><small>DIUNDUH</small><code>${esc(at.toLocaleString('id-ID',{timeZone:'Asia/Jakarta'}))} WIB</code></div>
</div></div></header>
<div class="wrap">
<p class="note">Berkas ini berisi <b>seluruh dokumentasi</b> dan bisa dibaca tanpa internet. API key ada di Dashboard › <b>API Key &amp; Docs developer</b> &mdash; ganti <code>API_KEY</code> pada contoh di bawah dengan key milikmu, dan jangan bagikan key itu ke siapa pun. Untuk menyimpan sebagai PDF: buka berkas ini lalu tekan Ctrl/Cmd + P › Simpan sebagai PDF.</p>
<nav><b>DAFTAR ISI</b><ol>${toc.map(t=>'<li><a href="#'+t[0]+'">'+esc(t[1].replace(/^\d+\.\s*/,''))+'</a></li>').join('')}</ol></nav>
${h}
<footer>${esc(META.title)} &middot; ${esc(base)}</footer>
</div></body></html>`}

// ---------- OpenAPI 3.1 (untuk diimpor ke Postman / Insomnia / generator SDK) ----------
export function buildOpenApi(root){
 const paths={}
 for(const g of G)for(const [m,p,d,pa,ex] of g.items){
  const [path,query]=p.split('?')
  const op={tags:[g.t],summary:d.split('.')[0],description:d,
   responses:{200:{description:'Berhasil',content:{'application/json':{example:safeJson(ex)}}},
    400:{description:'Permintaan tidak valid'},401:{description:'API key tidak valid atau belum login'},429:{description:'Rate limit terlampaui'}}}
  const inQuery=m==='GET'
  if(pa.length&&inQuery)op.parameters=pa.map(x=>({name:x[0],in:'query',description:x[1],required:/wajib/i.test(x[1]),schema:{type:'string'}}))
  else if(pa.length)op.requestBody={required:true,content:{'application/json':{schema:{type:'object',
    properties:Object.fromEntries(pa.map(x=>[x[0],{type:/true|false/.test(x[1])?'boolean':/nominal|limit|halaman/i.test(x[1])?'integer':'string',description:x[1]}]))}}}}
  else if(!inQuery)op.requestBody={required:false,content:{'application/json':{schema:{type:'object'}}}}
  if(query&&!pa.length)op.parameters=query.split('&').filter(Boolean).map(q=>({name:q.replace(/=$/,''),in:'query',schema:{type:'string'}}))
  paths[path]={...(paths[path]||{}),[m.toLowerCase()]:op}}
 return JSON.stringify({openapi:'3.1.0',
  info:{title:META.title,version:META.version,description:META.intro+'\n\nAPI key ada di Dashboard > API Key & Docs developer.'},
  servers:[{url:root+'/api/v1'}],
  security:[{bearerAuth:[]}],
  components:{securitySchemes:{bearerAuth:{type:'http',scheme:'bearer',description:'Authorization: Bearer API_KEY (bisa juga ?api_key=KEY)'}}},
  tags:G.map(g=>({name:g.t})),paths},null,1)}
const safeJson=t=>{try{return JSON.parse(t)}catch(e){return t}}

// Nama berkas: artapedia-api-docs-2026-10-13.html
export const fileName=(ext,at=new Date())=>'artapedia-api-docs-'+at.toISOString().slice(0,10)+'.'+ext
