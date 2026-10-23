// Live transaksi: daftar order terbaru seluruh pengguna, dari yang paling lama sampai yang terbaru.
// Yang disimpan hanya PENUNJUK ringan [idPengguna, waktuOrder] (maks 150) di kunci sementara "tmp:livefeed".
// Status, layanan, dan harga SELALU dibaca dari data order aslinya, jadi tidak pernah basi atau beda dengan riwayat.
// Nomor telepon & kode OTP tidak pernah ikut keluar; nama disensor.
import {kv} from './db'
import {bg} from './bg'
const KEY='tmp:livefeed',CAP=150,SHOW=60
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
const star=s=>{s=String(s||'').trim();return s.length<=1?s+'***':s.slice(0,2)+'***'+(s.length>3?s.slice(-1):'')}
const maskMail=e=>{const [a,d]=String(e||'').split('@');return d?star(a)+'@'+d:star(a)}
const nm=u=>{const n=String(u.name||'').trim();return n&&!/^\S+@\S+$/.test(n)?star(n):maskMail(u.email)}
const stOf=s=>s==='success'?'sukses':s==='pending'?'proses':'batal'

// Dipanggil setiap ada order baru. Tidak pernah melempar error, order tetap jalan kalau ini gagal.
export async function feedAdd(uid,at){
 try{
  let got=false
  for(let i=0;i<6&&!got;i++){got=await kv.lock('livefeed',4000);if(!got)await sleep(60)}
  try{const a=(await kv.get(KEY))||[];a.push([String(uid),+at]);await kv.set(KEY,a.slice(-CAP))}
  finally{if(got)await kv.unlock('livefeed')}
 }catch(e){}}
export const feedAddBg=(uid,at)=>bg(feedAdd(uid,at))

// Pertama kali (atau setelah kunci sementara terhapus): bangun dari data pengguna, maksimal 1x per menit.
async function backfill(){
 if(Date.now()-(globalThis.__lvbf||0)<60000)return []
 globalThis.__lvbf=Date.now()
 const ids=(await kv.get('idx'))||[]
 const us=(await kv.mget(ids.map(i=>'u:'+i))).filter(Boolean),all=[]
 for(const u of us){if(u.rs||u.banned)continue;for(const x of (u.tx||[]))if(x.type==='order'&&x.at)all.push([String(u.id),+x.at])}
 all.sort((a,b)=>a[1]-b[1])
 const refs=all.slice(-100)
 if(refs.length)await kv.set(KEY,refs).catch(()=>{})
 return refs}

async function build(){
 let refs=(await kv.get(KEY))||[]
 if(!refs.length)refs=await backfill()
 refs=refs.slice(-100)
 const uids=[...new Set(refs.map(r=>r[0]))]
 const us=await kv.mget(uids.map(i=>'u:'+i)),by=new Map()
 uids.forEach((id,i)=>{if(us[i])by.set(id,us[i])})
 const items=[],dup=new Set()
 for(const [uid,at] of refs){
  const dk=uid+'|'+at;if(dup.has(dk))continue;dup.add(dk)   // satu order tidak boleh tampil dua kali
  const u=by.get(uid);if(!u||u.rs||u.banned)continue
  const o=(u.tx||[]).find(x=>x.type==='order'&&+x.at===+at);if(!o)continue
  items.push({k:uid.slice(-4)+at.toString(36),n:nm(u),s:String(o.serviceName||o.serviceId||'Layanan').slice(0,40),c:String(o.countryName||'').slice(0,30),p:+o.price||0,st:stOf(o.status),at:+at})}
 // Data manual dari admin (Admin > Beranda > Live transaksi): nama, layanan, harga, status. Nama berupa email otomatis disensor.
 for(const m of ((await kv.get('live_manual'))||[])){
  const n=String(m.name||'').trim();if(!n)continue
  items.push({k:'m'+m.id,n:/^\S+@\S+\.\S+$/.test(n)?maskMail(n):n.slice(0,40),s:String(m.service||'Layanan').slice(0,40),c:String(m.country||'').slice(0,30),p:+m.price||0,st:['proses','sukses','batal'].includes(m.st)?m.st:'sukses',at:+m.at||Date.now()})}
 items.sort((a,b)=>a.at-b.at)
 const cf=(await kv.get('live_cfg'))||{},num=x=>Math.min(1e9,Math.max(0,Math.floor(+x||0)))
 return {items:items.slice(-SHOW),add:{trx:num(cf.trx),proses:num(cf.proses),sukses:num(cf.sukses)},now:Date.now()}}
// Dipanggil admin setelah mengubah data manual supaya langsung tampil (tanpa menunggu cache 3 detik).
export const feedBust=()=>{globalThis.__lv=null}

// Cache 3 detik per instance + satu pembacaan saja pada satu waktu: banyak pengunjung tidak membebani database.
export async function feedList(){
 const c=globalThis.__lv
 if(c&&Date.now()-c.t<3000)return c.d
 if(globalThis.__lvp)return globalThis.__lvp
 const p=build().then(d=>{globalThis.__lv={t:Date.now(),d};return d}).catch(e=>{if(c)return c.d;throw e}).finally(()=>{globalThis.__lvp=null})
 globalThis.__lvp=p
 return p}
