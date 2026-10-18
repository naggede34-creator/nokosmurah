import crypto from 'crypto'
import net from 'net'
import {kv,mutKey,txKey,resnap} from './db'
export const rid=()=>crypto.randomBytes(16).toString('hex')
export const hash=(p,s=crypto.randomBytes(8).toString('hex'))=>s+':'+crypto.scryptSync(p,s,32).toString('hex')
export const check=(p,h)=>hash(p,h.split(':')[0])===h
// ---------------------------------------------------------------------------
// save(u): simpan pengguna dengan AMAN terhadap tulis bersamaan.
// Masalah lama: web, bot, webhook gateway, dan cron bisa membaca pengguna yang sama lalu
// menimpa satu sama lain -> saldo deposit yang sudah dikreditkan bisa hilang ("deposit kadang masuk kadang tidak").
// Sekarang: tulis hanya diterima kalau revisi dokumen belum berubah. Kalau sudah berubah,
// perubahan KITA (selisih saldo, mutasi baru, status transaksi yang kita ubah) digabungkan
// ke data terbaru, lalu dicoba simpan lagi. Tidak ada yang hilang.
const SKIP=['tx','mut','balance','refCount','refEarn']
const TXF=['status','credited','bonus','refBonus','refunded','otp','msg','phone','oldPhone','replaced','id','expiredAt','hookAt','hookOk','cancelReq','cancelAt','cancelErr','tgSent','hooked','rsCut','rsStok','rsPend','rsPaid']
function merge(f,u){
 const b=u.__base||{balance:+u.balance||0,mut:new Set(),tx:{},rest:{},refCount:0,refEarn:0}
 // saldo: selisih yang KITA buat, ditempelkan ke saldo terbaru
 const delta=(+u.balance||0)-(+b.balance||0)
 // mutasi: baris yang kita tambahkan (belum ada di cuplikan awal) dipindahkan ke daftar terbaru
 const fresh=new Set((f.mut||[]).map(mutKey))
 const mine=(u.mut||[]).filter(m=>!b.mut.has(mutKey(m))&&!fresh.has(mutKey(m)))
 // transaksi: baris baru ditambahkan, baris yang kita ubah ditimpa field-nya saja
 const ftx=f.tx=Array.isArray(f.tx)?f.tx:[]
 for(const x of (u.tx||[])){
  const key=txKey(x),was=b.tx[key],at=ftx.find(y=>txKey(y)===key)||ftx.find(y=>y.type===x.type&&y.id===x.id)
  if(!at){if(!was)ftx.unshift(x);continue}
  if(was===JSON.stringify(x))continue            // tidak kita ubah -> pakai versi terbaru
  const old=was?JSON.parse(was):{}
  for(const k of TXF)if(x[k]!==old[k])at[k]=x[k]}
 ftx.sort((a,c)=>(c.at||0)-(a.at||0))
 f.mut=[...mine,...(f.mut||[])].slice(0,500)
 f.balance=Math.round((+f.balance||0)+delta)
 f.refCount=(+f.refCount||0)+((+u.refCount||0)-(+b.refCount||0))
 f.refEarn=(+f.refEarn||0)+((+u.refEarn||0)-(+b.refEarn||0))
 // field lain (nama, password, apikey, whitelist, webhook, telegram, dst): hanya yang KITA ubah yang ditimpa,
 // sisanya tetap memakai nilai terbaru dari database
 const rest=b.rest||{}
 for(const k of Object.keys(u))if(!SKIP.includes(k)&&JSON.stringify(u[k])!==rest[k])f[k]=u[k]
 for(const k of Object.keys(rest))if(!(k in u))delete f[k]
 return f}
export async function save(u){
 const key='u:'+u.id
 for(let i=0;i<5;i++){
  const rev=u.__rev||0
  if(await kv.casSet(key,u,rev)){resnap(u,rev+1);return u}
  const f=await kv.get(key)
  if(!f||f===u)break   // mode memori (tanpa MONGODB_URI): objeknya sama, tidak ada yang perlu digabung
  merge(f,u)
  // objek pemanggil ikut diperbarui supaya saldo/mutasi yang dilihat pemanggil sudah yang terbaru
  for(const k of Object.keys(u))if(!(k in f))delete u[k]
  Object.assign(u,f)
  resnap(u,f.__rev||0)}   // cuplikan disegarkan: percobaan berikutnya menghitung selisih dari keadaan gabungan ini
 await kv.set(key,u);resnap(u,(u.__rev||0)+1);return u}
// IP klien: Vercel mengisi header ini sendiri (tidak bisa dipalsukan klien). Di hosting lain pastikan proxy-mu menimpa x-forwarded-for.
export const normIp=x=>{x=String(x||'').trim().toLowerCase();const m=x.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);return m?m[1]:x}
export const clientIp=req=>normIp(req.headers.get('x-vercel-forwarded-for')||req.headers.get('x-real-ip')||(req.headers.get('x-forwarded-for')||'').split(',')[0]||'')
export const validIp=x=>net.isIP(normIp(x))>0
export async function who(req){
 const a=req.headers.get('authorization')||'',q=new URL(req.url).searchParams
 const key=a.startsWith('Bearer ')?a.slice(7):q.get('api_key')
 let id=key&&await kv.get('k:'+key),ses=0
 if(!id){const c=(req.headers.get('cookie')||'').match(/sid=([a-f0-9]+)/);const v=c&&await kv.get('s:'+c[1]);if(v){const [i,ts]=String(v).split('|');id=i;ses=+ts||0}}
 if(!id)return null
 const u=await kv.get('u:'+id)
 // sesi yang dibuat sebelum password direset otomatis tidak berlaku lagi
 if(u&&!key&&u.pwAt&&ses<u.pwAt)return null
 if(u&&key&&id){req.__key=true
  // whitelist IP: kalau diisi, API key hanya berlaku dari IP yang terdaftar (login lewat browser tidak terpengaruh)
  const w=Array.isArray(u.ipw)?u.ipw:[];if(w.length){const ip=clientIp(req);if(!w.includes(ip)){req.__ipBlock=ip||'tidak terdeteksi';return null}}}
 return u||null}
