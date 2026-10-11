'use client'
import {useState,useEffect} from 'react'
import {CopyBtn,Snippets} from '../../components/ApiPanel'

// ---------- Data dokumentasi ----------
// Server nokos (id dipakai di parameter `server`). Aktif/nonaktif diatur admin, selalu cek GET /servers.
const SV=[
 ['warungnokos_s1','Server Plus','Utama','Artapedia (WarungNokos)','Pilih paket harga dari /countries → kirim provider_id & country_id apa adanya.'],
 ['warungnokos_s2','Server Express','Global','Artapedia (WarungNokos S2)','Sama seperti server 1. Cocok saat stok server utama kosong.'],
 ['jasaotp_s1','JasaOTP 1','Pilih operator','JasaOTP / Ditznesia','providerId = nama operator (telkomsel, indosat, …) atau "any" untuk acak.'],
 ['jasaotp_s2','JasaOTP 2','Banyak varian','JasaOTP / Ditznesia','Beberapa varian harga per layanan. providerId = id varian dari /countries.'],
 ['jasaotp_s3','JasaOTP 3','Simpel','JasaOTP / Ditznesia','Satu harga per layanan. providerId = "default".'],
 ['jasaotp_s4','JasaOTP 4','Global','JasaOTP / Ditznesia','Banyak negara & varian harga. providerId = id varian.'],
 ['jasaotp_s5','JasaOTP 5','Multi provider','JasaOTP / Ditznesia','Varian dari banyak provider. providerId = id varian.']]
// Metode deposit (kode dipakai di field `provider` pada POST /deposit)
const MD=[
 ['qris','QRIS','Artapedia · Pakasir · Ditznesia (acak berbobot, otomatis pindah rute jika gagal)','Rp2.000','Rp10.000.000'],
 ['bri_va','VA BRI','Pakasir','Rp10.000','Rp50.000.000'],['bni_va','VA BNI','Pakasir','Rp10.000','Rp50.000.000'],
 ['cimb_niaga_va','VA CIMB Niaga','Pakasir','Rp10.000','Rp50.000.000'],['permata_va','VA Permata','Pakasir','Rp10.000','Rp50.000.000'],
 ['maybank_va','VA Maybank','Pakasir','Rp10.000','Rp50.000.000'],['bnc_va','VA Bank Neo Commerce','Pakasir','Rp10.000','Rp50.000.000'],
 ['artha_graha_va','VA Artha Graha','Pakasir','Rp10.000','Rp50.000.000'],['sampoerna_va','VA Sahabat Sampoerna','Pakasir','Rp10.000','Rp50.000.000']]
const ORDER_ST=[['pending','Menunggu kode OTP'],['success','Kode masuk (done). otpCode terisi'],['cancelled','Dibatalkan pengguna, saldo kembali'],['expired','Kedaluwarsa tanpa kode, saldo kembali otomatis']]
const DEP_ST=[['pending','Menunggu pembayaran'],['completed','Lunas, saldo + bonus sudah masuk'],['canceled','Dibatalkan'],['expired','Lewat batas bayar'],['failed','Gagal dari gateway']]
const G=[
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
  ['POST','/orders/cancel','Batalkan order. Baru bisa setelah 3 menit sejak order dibuat, lalu saldo kembali.',[['order_id','id order']],'{ "status": "cancelled", "refunded": true, "balance": 48500 }']]},
 {id:'deposit',t:'Deposit',ic:'💳',c:'#16c47f',items:[
  ['GET','/deposit/methods','Metode deposit yang sedang aktif beserta batas nominalnya. Selalu cek dulu: admin bisa menyalakan/mematikan tiap metode & rute.',[],'{ "methods": [{ "provider": "qris", "name": "QRIS", "type": "qris", "min": 2000, "max": 10000000 }, { "provider": "bri_va", "name": "BRI", "type": "va", "min": 10000, "max": 50000000 }], "min": 2000, "max": 10000000 }'],
  ['POST','/deposit','Buat deposit. Untuk QRIS, rute gateway dipilih acak oleh server (kamu tidak perlu memilih). Maks 3 deposit belum dibayar sekaligus. Bonus cashback masuk otomatis saat lunas.',[['amount','nominal dalam rupiah (sesuai min/max metode)'],['provider','kode metode dari /deposit/methods: qris, bri_va, bni_va, …']],'{ "order_id": "ARTMG2K9X1AB", "method": "qris", "method_name": "QRIS", "amount": 10000, "total_amount": 10120, "admin_fee": 120, "status": "pending", "qr_string": "000201...", "qr_image": "https://...", "va_number": "", "expired_at": "2026-10-12T10:30:00Z" }'],
  ['GET','/deposit?order_id=','Status deposit. Tanpa order_id = 20 deposit terakhir. Polling tiap 5 detik sampai status bukan pending.',[['order_id','ID deposit (order_id) dari POST /deposit']],'{ "order_id": "ARTMG2K9X1AB", "status": "completed", "credited": true, "balance": 58500 }'],
  ['POST','/deposit/cancel','Batalkan deposit yang belum dibayar. Kalau ternyata sudah dibayar, saldo dikreditkan dan pembatalan ditolak.',[['order_id','ID deposit']],'{ "ok": 1, "status": "canceled" }']]},
 {id:'publik',t:'Publik (tanpa API key)',ic:'🌍',c:'#f59e0b',items:[
  ['GET','/announcements','Pengumuman dari admin.',[],'{ "items": [{ "title": "...", "body": "..." }] }'],
  ['GET','/leaderboard','Leaderboard saldo, transaksi, mingguan, dan bulanan (email disensor).',[],'{ "bal": [], "trx": [], "wk": [], "mo": [] }'],
  ['GET','/promo','Info cashback deposit, referral, hadiah leaderboard, dan base URL API.',[],'{ "bonus": { "on": true, "pct": 2, "minAmt": 5000 }, "ref": {}, "weekly": {} }']]}]
const FLOW_ORDER=`const BASE = "BASE_URL/api/v1";
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
const FLOW_DEP=`// 1) metode aktif
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
const ERR=[['401','API key tidak valid atau belum login'],['403','Akun ditangguhkan'],['400','Parameter salah, saldo tidak cukup, nominal di luar batas, atau terlalu banyak deposit belum dibayar'],['404','Data / order / deposit tidak ditemukan'],['429','Rate limit: 60 request/menit per key (POST /order 20/mnt, POST /deposit 6/mnt). Lihat header Retry-After'],['502','Penyedia nomor menolak / gangguan (saldo order otomatis dikembalikan)'],['503','Server nokos dimatikan admin']]
function Code({text}){return <div className="ap-code"><div className="ap-ct"><span style={{flex:1,color:'#b6c4ee',fontWeight:800,fontSize:12,letterSpacing:'.1em',paddingLeft:6}}>JAVASCRIPT</span><CopyBtn text={text}/></div><pre>{text}</pre></div>}
function Ep({root,m,p,d,pa,ex}){
 const url=root+'/api/v1'+p
 return <details className="dc-ep"><summary><span className={'dc-m '+m.toLowerCase()}>{m}</span><code>{p}</code><i>{d}</i></summary>
  <div className="dc-bd">
   {pa.length>0&&<><div className="ap-lbl">PARAMETER</div><div className="dc-pa">{pa.map(x=><div key={x[0]}><code>{x[0]}</code><span>{x[1]}</span></div>)}</div></>}
   <div className="ap-lbl" style={{marginTop:12}}>URL</div><div className="ap-url"><code>{m} {url}</code><CopyBtn text={url}/></div>
   <div className="ap-lbl" style={{marginTop:12}}>CONTOH RESPON</div><pre className="dc-ex">{ex}</pre></div></details>}
export default function D(){
 const [base,setBase]=useState('')
 useEffect(()=>{setBase(location.origin);fetch('/api/v1/promo').then(r=>r.json()).then(d=>{if(d.site&&d.site.baseUrl)setBase(d.site.baseUrl)}).catch(()=>{})},[])
 const root=base.replace(/\/+$/,'').replace(/\/api(\/v1)?$/,'')
 const toc=[['server','Server nokos'],['metode','Metode deposit'],['alur','Alur & contoh kode'],['akun','Akun'],['order','Order'],['deposit','Deposit'],['status','Status'],['error','Error']]
 return <div className="dc">
  <div className="dc-hero"><span className="dc-chip">Developer API v1</span><h1>Dokumentasi API</h1><p>Beli nomor OTP di <b>7 server nokos</b>, isi saldo lewat <b>QRIS &amp; 8 Virtual Account</b>, cek kode, dan kelola akun dari aplikasimu sendiri. Semua respon berformat JSON.</p>
   <div className="dc-st"><div><b>REST</b><small>JSON</small></div><div><b>60/mnt</b><small>rate limit</small></div><div><b>Bearer</b><small>autentikasi</small></div><div><b>7</b><small>server nokos</small></div><div><b>9</b><small>metode deposit</small></div></div></div>
  <nav className="dc-toc" aria-label="Daftar isi">{toc.map(([k,t])=><a key={k} href={'#'+k}>{t}</a>)}</nav>
  <div className="ap-card"><div className="ap-lbl">BASE URL</div><div className="ap-url"><code>{root+'/api/v1'}</code><CopyBtn text={root+'/api/v1'}/></div>
   <div className="ap-lbl" style={{marginTop:14}}>AUTENTIKASI</div><p style={{margin:'4px 0 8px',fontSize:14}}>Kirim API key di header, atau lewat <code>?api_key=KEY</code>. Key ada di Dashboard › menu garis tiga › API Key &amp; Docs.</p>
   <div className="ap-url"><code>Authorization: Bearer API_KEY</code><CopyBtn text="Authorization: Bearer API_KEY"/></div></div>
  <div className="ap-card"><div className="ap-lbl">MULAI CEPAT</div><Snippets root={root}/></div>

  <section id="server" className="dc-sec"><h2 style={{'--c':'#7a5cff'}}><span>🖥️</span>Server nokos</h2>
   <p className="dc-p">Kirim id server di parameter <code>server</code> pada <code>/services</code>, <code>/countries</code>, dan <code>/order</code>. Server yang dimatikan admin tidak muncul di <code>/servers</code> dan menolak order (503). Harga &amp; stok berbeda tiap server, bandingkan lewat <code>/countries</code>.</p>
   <div className="dc-tb"><table><thead><tr><th>ID server</th><th>Nama</th><th>Penyedia</th><th>Cara pakai providerId</th></tr></thead><tbody>
    {SV.map(s=><tr key={s[0]}><td><code>{s[0]}</code></td><td><b>{s[1]}</b><em className="dc-bdg">{s[2]}</em></td><td>{s[3]}</td><td>{s[4]}</td></tr>)}</tbody></table></div>
   <div className="dc-note">🛡️ <b>Jaminan OTP</b> (<code>guarantee:true</code>, +10% dari harga) berlaku di semua server: kode belum masuk dalam 4 menit → nomor diganti otomatis; kalau tetap gagal, seluruh saldo kembali. Order bisa dibatalkan manual setelah 3 menit.</div></section>

  <section id="metode" className="dc-sec"><h2 style={{'--c':'#16c47f'}}><span>💳</span>Metode &amp; rute deposit</h2>
   <p className="dc-p">Kamu hanya memilih <b>metode</b> (field <code>provider</code>). <b>Rute</b> gateway di belakang QRIS dipilih server secara acak berbobot di antara rute yang aktif; jika satu rute gagal, otomatis pindah ke rute lain. Virtual Account selalu lewat Pakasir. Batas nominal bisa berubah, ambil dari <code>/deposit/methods</code>.</p>
   <div className="dc-tb"><table><thead><tr><th>Kode (provider)</th><th>Metode</th><th>Rute gateway</th><th>Min</th><th>Maks</th></tr></thead><tbody>
    {MD.map(s=><tr key={s[0]}><td><code>{s[0]}</code></td><td><b>{s[1]}</b></td><td>{s[2]}</td><td>{s[3]}</td><td>{s[4]}</td></tr>)}</tbody></table></div>
   <div className="dc-note">🎁 <b>Bonus &amp; ID deposit</b>: cashback % (diatur admin, lihat <code>/promo</code>) masuk otomatis ke saldo saat deposit lunas. Setiap deposit punya <code>order_id</code> unik (ID Deposit) yang juga tampil di dashboard, riwayat, mutasi saldo, dan notifikasi. QRIS: tampilkan <code>qr_image</code> / render <code>qr_string</code>. VA: tampilkan <code>va_number</code> dan bayar <b>tepat</b> sebesar <code>total_amount</code> sebelum <code>expired_at</code>.</div></section>

  <section id="alur" className="dc-sec"><h2 style={{'--c':'#ff7a1a'}}><span>🧭</span>Alur &amp; contoh kode</h2>
   <div className="ap-card"><div className="ap-lbl">ALUR PEMBELIAN OTP</div><div className="dc-flow">{[['1','Pilih server','GET /servers'],['2','Aplikasi & harga','GET /services, /countries'],['3','Buat order','POST /order'],['4','Tunggu OTP','GET /orders/status'],['5','Selesai / batal','refund otomatis']].map(x=><div key={x[0]}><span>{x[0]}</span><b>{x[1]}</b><small>{x[2]}</small></div>)}</div></div>
   <div className="ap-card"><div className="ap-lbl">ALUR DEPOSIT</div><div className="dc-flow">{[['1','Cek metode','GET /deposit/methods'],['2','Buat deposit','POST /deposit'],['3','Bayar QR / VA','sebelum expired_at'],['4','Polling status','GET /deposit?order_id='],['5','Saldo masuk','completed + bonus']].map(x=><div key={x[0]}><span>{x[0]}</span><b>{x[1]}</b><small>{x[2]}</small></div>)}</div></div>
   <div className="ap-card"><div className="ap-lbl">CONTOH: BELI OTP (JS)</div><Code text={FLOW_ORDER.replace('BASE_URL',root)}/></div>
   <div className="ap-card"><div className="ap-lbl">CONTOH: DEPOSIT (JS)</div><Code text={FLOW_DEP}/></div></section>

  {G.map(g=><section key={g.t} id={g.id==='server'?undefined:g.id} className="dc-sec"><h2 style={{'--c':g.c}}><span>{g.ic}</span>{g.t}</h2>{g.items.map(i=><Ep key={i[0]+i[1]} root={root} m={i[0]} p={i[1]} d={i[2]} pa={i[3]} ex={i[4]}/>)}</section>)}

  <section id="status" className="dc-sec"><h2 style={{'--c':'#3b7fe0'}}><span>📍</span>Status</h2>
   <div className="dc-two">
    <div className="ap-card"><div className="ap-lbl">STATUS ORDER (status)</div><div className="dc-pa">{ORDER_ST.map(x=><div key={x[0]}><code>{x[0]}</code><span>{x[1]}</span></div>)}</div></div>
    <div className="ap-card"><div className="ap-lbl">STATUS DEPOSIT (status)</div><div className="dc-pa">{DEP_ST.map(x=><div key={x[0]}><code>{x[0]}</code><span>{x[1]}</span></div>)}</div></div></div></section>

  <section id="error" className="ap-card"><div className="ap-lbl">KODE ERROR</div><div className="dc-pa">{ERR.map(x=><div key={x[0]}><code>{x[0]}</code><span>{x[1]}</span></div>)}</div></section></div>}
