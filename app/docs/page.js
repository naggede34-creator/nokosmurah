'use client'
import {useState,useEffect} from 'react'
import {CopyBtn,Snippets} from '../../components/ApiPanel'
const G=[
 {t:'Akun',ic:'👤',c:'#3b7fe0',items:[['GET','/me','Info akun, saldo, dan API key.',[],'{ "name": "Budi", "balance": 48500, "apikey": "..." }']]},
 {t:'Layanan & harga',ic:'📱',c:'#7a5cff',items:[
  ['GET','/servers','Daftar server yang aktif.',[],'{ "items": [{ "server": "warungnokos_s1", "name": "Server Plus" }] }'],
  ['GET','/services?server=','Daftar aplikasi/layanan OTP.',[['server','warungnokos_s1 atau warungnokos_s2']],'{ "items": [{ "service_code": "wa", "service_name": "WhatsApp" }] }'],
  ['GET','/countries?server=&service_id=','Negara, stok, dan harga jual (sell_price).',[['server','server pilihan'],['service_id','kode layanan']],'{ "items": [{ "name": "Indonesia", "pricelist": [{ "provider_id": 1, "sell_price": 3500, "stock": 120 }] }] }']]},
 {t:'Order nomor',ic:'🛒',c:'#ff7a1a',items:[
  ['POST','/order','Buat order nomor. Saldo langsung terpotong.',[['server','server'],['serviceId','kode layanan'],['countryId','id negara'],['providerId','id penyedia'],['operatorId','opsional'],['guarantee','true = Jaminan OTP (+10%)']],'{ "orderId": "123", "phoneNumber": "628123...", "price": 3500, "expiredAt": 1760000000000 }'],
  ['GET','/orders','Daftar order (limit, page).',[['limit','maks 100'],['page','nomor halaman']],'{ "items": [{ "orderId": "123", "status": "pending" }] }'],
  ['GET','/orders/status?order_id=','Cek status dan kode OTP.',[['order_id','id order']],'{ "status": "success", "otpCode": "482913" }'],
  ['POST','/orders/cancel','Batalkan order (bisa setelah 3 menit, saldo refund).',[['order_id','id order']],'{ "status": "cancelled", "refunded": true }']]},
 {t:'Deposit',ic:'💳',c:'#16c47f',items:[
  ['GET','/deposit/methods','Metode deposit yang tersedia.',[],'{ "methods": [{ "provider": "qris" }] }'],
  ['POST','/deposit','Buat QRIS. Nominal Rp2.000 - Rp10.000.000. Bonus deposit masuk otomatis.',[['amount','nominal'],['provider','dari /deposit/methods']],'{ "order_id": "D1", "total_amount": 10120, "qr_image": "..." }'],
  ['GET','/deposit?order_id=','Status deposit (tanpa order_id = 20 deposit terakhir).',[['order_id','id deposit']],'{ "status": "completed", "credited": true, "balance": 58500 }'],
  ['POST','/deposit/cancel','Batalkan deposit yang belum dibayar.',[['order_id','id deposit']],'{ "ok": 1, "status": "canceled" }']]},
 {t:'Publik (tanpa API key)',ic:'🌍',c:'#f59e0b',items:[
  ['GET','/announcements','Pengumuman dari admin.',[],'{ "items": [{ "title": "...", "body": "..." }] }'],
  ['GET','/leaderboard','Leaderboard saldo, transaksi, mingguan, dan bulanan (email disensor).',[],'{ "bal": [], "trx": [], "wk": [], "mo": [] }'],
  ['GET','/promo','Info bonus deposit, referral, dan hadiah leaderboard.',[],'{ "bonus": { "pct": 2 }, "ref": {}, "weekly": {} }']]}]
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
 return <div className="dc">
  <div className="dc-hero"><span className="dc-chip">Developer API v1</span><h1>Dokumentasi API</h1><p>Beli nomor OTP, cek kode, dan isi saldo dari aplikasimu sendiri. Semua respon berformat JSON.</p>
   <div className="dc-st"><div><b>REST</b><small>JSON</small></div><div><b>60/mnt</b><small>rate limit</small></div><div><b>Bearer</b><small>autentikasi</small></div></div></div>
  <div className="ap-card"><div className="ap-lbl">BASE URL</div><div className="ap-url"><code>{root+'/api/v1'}</code><CopyBtn text={root+'/api/v1'}/></div>
   <div className="ap-lbl" style={{marginTop:14}}>AUTENTIKASI</div><p style={{margin:'4px 0 8px',fontSize:14}}>Kirim API key di header, atau lewat <code>?api_key=KEY</code>. Key ada di Dashboard › Lainnya › API Key.</p>
   <div className="ap-url"><code>Authorization: Bearer API_KEY</code><CopyBtn text="Authorization: Bearer API_KEY"/></div></div>
  <div className="ap-card"><div className="ap-lbl">MULAI CEPAT</div><Snippets root={root}/></div>
  <div className="ap-card"><div className="ap-lbl">ALUR PEMBELIAN</div><div className="dc-flow">{[['1','Cek harga','GET /countries'],['2','Buat order','POST /order'],['3','Tunggu OTP','GET /orders/status'],['4','Selesai / batal','refund otomatis']].map(x=><div key={x[0]}><span>{x[0]}</span><b>{x[1]}</b><small>{x[2]}</small></div>)}</div></div>
  {G.map(g=><section key={g.t} className="dc-sec"><h2 style={{'--c':g.c}}><span>{g.ic}</span>{g.t}</h2>{g.items.map(i=><Ep key={i[0]+i[1]} root={root} m={i[0]} p={i[1]} d={i[2]} pa={i[3]} ex={i[4]}/>)}</section>)}
  <div className="ap-card"><div className="ap-lbl">KODE ERROR</div><div className="dc-pa">{[['401','API key tidak valid atau belum login'],['403','Akun ditangguhkan'],['400','Parameter salah / saldo tidak cukup'],['404','Data tidak ditemukan'],['429','Terlalu banyak request, lihat header Retry-After'],['502','Penyedia nomor menolak / gangguan']].map(x=><div key={x[0]}><code>{x[0]}</code><span>{x[1]}</span></div>)}</div></div></div>}
