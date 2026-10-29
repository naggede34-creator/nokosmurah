// ===========================================================================
// PRODUK LAINNYA — toko produk digital yang diatur admin.
// Tiap produk: nama, harga, deskripsi, stok, ikon (emoji / gambar), dan DATA yang dikirim ke pembeli, pilih salah satu:
//   link  → tautan (satu untuk semua, atau satu per stok)
//   text  → teks (mis. kode / akun / petunjuk; satu untuk semua, atau satu baris per stok)
//   photo → foto (tampil langsung)
//   file  → file unduhan (maks 3 MB)
// Saldo dipotong setelah stok diamankan; kalau gagal disimpan, stok dikembalikan. Data hanya bisa dibuka pemiliknya.
// ===========================================================================
import {kv} from './db'
import {save,rid} from './auth'
import {mut,getCfg} from './bonus'
import {notify,mask,rp} from './telegram'

export class ProdError extends Error{constructor(m,status){super(m);this.status=status||400}}
export const TYPES=['link','text','photo','file']
export const LIM={file:3*1024*1024,photo:2*1024*1024,icon:200*1024,qty:10}
const IMG=/^image\/(png|jpe?g|webp|gif)$/i
const BAD=/\.(exe|bat|cmd|com|scr|msi|sh|js|mjs|html?|php|vbs|jar|apk)$/i
const KEY='prods'
const bytes=b64=>Math.floor(String(b64||'').length*3/4)
const okUrl=u=>/^https?:\/\/[^\s]{3,500}$/i.test(String(u||''))
const list=async()=>{const l=await kv.get(KEY);return Array.isArray(l)?l:[]}
const saveList=l=>kv.set(KEY,l)

export const stockOf=async p=>p.unlimited&&!p.unique?null:p.unique?((await kv.get('pi:'+p.id))||[]).length:Math.max(0,+p.stock||0)
export async function pub(p,full){
 const st=await stockOf(p)
 return {id:p.id,name:p.name,price:p.price,desc:p.desc||'',emoji:p.emoji||'📦',iconUrl:p.iconV?`/api/prod/icon?id=${p.id}&v=${p.iconV}`:null,type:p.type,stock:st,unlimited:st===null,on:p.on!==false,
  ...(full?{link:p.link||'',text:p.text||'',unique:!!p.unique,fileName:p.fileName||'',fileSize:p.fileSize||0,photoSize:p.photoSize||0,hasFile:!!p.hasFile,sold:p.sold||0,at:p.at,
   items:p.unique?((await kv.get('pi:'+p.id))||[]).join('\n'):''}:{})}}
export async function catalog(){
 const l=(await list()).filter(p=>p.on!==false)
 const out=await Promise.all(l.map(p=>pub(p)));return out.sort((a,b)=>(+(b.stock!==0)-+(a.stock!==0)))}
export const getProd=async id=>(await list()).find(p=>p.id===String(id))||null

// ---------- admin ----------
export async function adminList(){const l=await list();return {items:await Promise.all(l.map(p=>pub(p,true))),limits:LIM}}
export async function adminSave(b){
 b=b||{};const l=await list()
 const name=String(b.name||'').trim().replace(/\s+/g,' ');if(name.length<2||name.length>80)throw new ProdError('Nama produk 2 – 80 karakter')
 const price=Math.floor(+b.price);if(!(price>=0&&price<=50000000))throw new ProdError('Harga Rp0 – Rp50.000.000')
 const type=TYPES.includes(b.type)?b.type:null;if(!type)throw new ProdError('Pilih jenis data: link, teks, foto, atau file')
 let p=b.id?l.find(x=>x.id===String(b.id)):null;if(b.id&&!p)throw new ProdError('Produk tidak ditemukan',404)
 const isNew=!p;if(isNew){p={id:'p'+rid().slice(0,8),at:Date.now(),sold:0};l.unshift(p)}
 p.name=name;p.price=price;p.desc=String(b.desc||'').slice(0,1500);p.emoji=String(b.emoji||'').trim().slice(0,4)||p.emoji||'📦';p.on=b.on!==false;p.type=type
 p.unique=(type==='link'||type==='text')&&!!b.unique;p.unlimited=!p.unique&&!!b.unlimited
 // ikon gambar (opsional)
 if(b.removeIcon){await kv.del('pf:'+p.id+':icon');p.iconV=0}
 if(b.icon&&b.icon.b64){if(!IMG.test(b.icon.mime||''))throw new ProdError('Ikon harus PNG/JPG/WEBP/GIF');if(bytes(b.icon.b64)>LIM.icon)throw new ProdError('Ikon maksimal 200 KB')
  await kv.set('pf:'+p.id+':icon',{mime:b.icon.mime,b64:b.icon.b64});p.iconV=Date.now()}
 // data produk sesuai jenis
 if(type==='link'){
  if(p.unique){const it=String(b.items||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);if(!it.length&&isNew)throw new ProdError('Isi minimal satu link (satu per baris)')
   if(it.some(x=>!okUrl(x)))throw new ProdError('Semua baris harus berupa link http(s)');await kv.set('pi:'+p.id,it.slice(0,5000))}
  else{if(!okUrl(b.link))throw new ProdError('Link harus diawali http:// atau https://');p.link=String(b.link).trim()}}
 if(type==='text'){
  if(p.unique){const it=String(b.items||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);if(!it.length&&isNew)throw new ProdError('Isi minimal satu baris teks');await kv.set('pi:'+p.id,it.map(x=>x.slice(0,500)).slice(0,5000))}
  else{const t=String(b.text||'').trim();if(!t)throw new ProdError('Isi teks yang dikirim ke pembeli');p.text=t.slice(0,3000)}}
 for(const k of ['photo','file']){
  if(type!==k)continue
  const f=b[k]
  if(f&&f.b64){
   const mime=String(f.mime||'application/octet-stream'),nm=String(f.name||k).replace(/[\\/\r\n]/g,'_').slice(0,100)
   if(k==='photo'&&!IMG.test(mime))throw new ProdError('Foto harus PNG/JPG/WEBP/GIF')
   if(k==='file'&&BAD.test(nm))throw new ProdError('Jenis file ini tidak diizinkan (demi keamanan). Kirim sebagai .zip')
   if(bytes(f.b64)>LIM[k])throw new ProdError(`${k==='photo'?'Foto':'File'} maksimal ${LIM[k]/1048576} MB`)
   await kv.set('pf:'+p.id+':file',{mime:k==='photo'?mime:mime,name:nm,b64:f.b64});p.hasFile=true;p.fileName=nm;p.fileSize=bytes(f.b64);p.fileKind=k}
  else if(!p.hasFile||p.fileKind!==k)throw new ProdError(k==='photo'?'Unggah fotonya dulu':'Unggah filenya dulu')}
 if(type!=='photo'&&type!=='file'){p.hasFile=false}
 p.stock=p.unique?0:Math.max(0,Math.floor(+b.stock||0))
 await saveList(l);return pub(p,true)}
export async function adminDel(id){
 const l=await list(),i=l.findIndex(x=>x.id===String(id));if(i<0)throw new ProdError('Produk tidak ditemukan',404)
 l.splice(i,1);await saveList(l);await Promise.all([kv.del('pf:'+id+':file'),kv.del('pf:'+id+':icon'),kv.del('pi:'+id)]);return {ok:1}}
export async function adminToggle(id,on){
 const l=await list(),p=l.find(x=>x.id===String(id));if(!p)throw new ProdError('Produk tidak ditemukan',404);p.on=!!on;await saveList(l);return pub(p,true)}
export async function adminRestock(id,{stock,add}){
 const l=await list(),p=l.find(x=>x.id===String(id));if(!p)throw new ProdError('Produk tidak ditemukan',404)
 if(p.unique){const it=String(add||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);if(!it.length)throw new ProdError('Isi baris yang mau ditambahkan')
  if(p.type==='link'&&it.some(x=>!okUrl(x)))throw new ProdError('Semua baris harus berupa link http(s)')
  const cur=(await kv.get('pi:'+p.id))||[];await kv.set('pi:'+p.id,[...cur,...it.map(x=>x.slice(0,500))].slice(0,5000))}
 else p.stock=Math.max(0,Math.floor(+stock||0))
 await saveList(l);return pub(p,true)}
export const iconOf=async id=>{const f=await kv.get('pf:'+String(id)+':icon');return f&&{buf:Buffer.from(f.b64,'base64'),mime:f.mime}}

// ---------- beli ----------
export async function buy(u0,id,qty,via='web'){
 const cfg=await getCfg();if(cfg.maint&&cfg.maint.on)throw new ProdError(cfg.maint.msg||'Situs sedang maintenance, pembelian dihentikan sementara.',503)
 qty=Math.floor(+qty||1);if(!(qty>=1&&qty<=LIM.qty))throw new ProdError('Jumlah beli 1 – '+LIM.qty)
 if(!await kv.lock('prodbuy:'+u0.id,30000))throw new ProdError('Pembelian sebelumnya masih diproses, tunggu sebentar.',429)
 try{
  if(!await kv.lock('prodstock:'+id,15000))throw new ProdError('Produk sedang diproses pembeli lain, coba lagi sebentar.',429)
  let p,got=[],reserved=false
  try{
   const l=await list();p=l.find(x=>x.id===String(id))
   if(!p||p.on===false)throw new ProdError('Produk tidak ditemukan atau sedang tidak dijual.',404)
   const total=p.price*qty,f=(await kv.get('u:'+u0.id))||u0
   if(f.banned)throw new ProdError('Akun ditangguhkan.',403)
   if(f.balance<total)throw new ProdError('Saldo tidak cukup. Butuh '+rp(total)+', saldo kamu '+rp(f.balance)+'.',402)
   // amankan stok dulu
   if(p.unique){const it=(await kv.get('pi:'+p.id))||[];if(it.length<qty)throw new ProdError(it.length?`Stok tinggal ${it.length}.`:'Stok habis.',409)
    got=it.slice(0,qty);await kv.set('pi:'+p.id,it.slice(qty));reserved=true}
   else if(!p.unlimited){if((+p.stock||0)<qty)throw new ProdError(p.stock?`Stok tinggal ${p.stock}.`:'Stok habis.',409);p.stock-=qty;reserved=true}
   p.sold=(p.sold||0)+qty;await saveList(l)
   const rec={type:'prod',id:'PR'+rid().slice(0,8).toUpperCase(),prodId:p.id,name:p.name,emoji:p.emoji||'📦',qty,price:total,status:'success',pdType:p.type,via,at:Date.now(),
    ...(p.type==='link'?{items:p.unique?got:[p.link]}:{}),...(p.type==='text'?{items:p.unique?got:[p.text]}:{}),
    ...((p.type==='file'||p.type==='photo')&&p.hasFile?{fileName:p.fileName,fileSize:p.fileSize}:{})}
   mut(f,-total,'Produk: '+p.name.slice(0,40));f.tx.unshift(rec)
   try{await save(f)}catch(e){ // gagal simpan: kembalikan stok & statistik
    const l2=await list(),q=l2.find(x=>x.id===p.id);if(q){q.sold=Math.max(0,(q.sold||0)-qty);if(!p.unique&&!p.unlimited)q.stock=(+q.stock||0)+qty;await saveList(l2)}
    if(p.unique&&got.length)await kv.set('pi:'+p.id,[...got,...((await kv.get('pi:'+p.id))||[])])
    throw new ProdError('Gagal menyimpan pesanan. Saldo tidak terpotong, coba lagi.',503)}
   const left=await stockOf(p)
   notify({i:'🛒',t:'Pembelian produk lainnya',st:'ok',id:['ID',rec.id],rows:[['Pengguna',mask(f.email)],['Produk',p.name],['Jumlah',String(qty)],['Harga',rp(total)],['Sisa stok',left===null?'tak terbatas':String(left)],['Via',via==='telegram'?'Bot Telegram':'Web']],note:left!==null&&left<=2?'⚠️ Stok hampir habis, segera restok.':''}).catch(()=>{})
   return {rec,user:f,product:p}}
  finally{await kv.unlock('prodstock:'+id)}}
 finally{await kv.unlock('prodbuy:'+u0.id)}}

export const ordersOf=(u,{limit=50}={})=>(u.tx||[]).filter(x=>x.type==='prod').slice(0,Math.min(100,+limit||50))
export const viewOrder=o=>({orderId:o.id,productId:o.prodId,name:o.name,emoji:o.emoji,qty:o.qty,price:o.price,dataType:o.pdType,items:o.items||[],fileName:o.fileName||'',fileSize:o.fileSize||0,hasFile:!!o.fileName,createdAt:new Date(o.at).toISOString()})
export async function fileOf(u,orderId){
 const o=(u.tx||[]).find(x=>x.type==='prod'&&x.id===String(orderId));if(!o||!o.fileName)return null
 const f=await kv.get('pf:'+o.prodId+':file');if(!f)return null
 return {buf:Buffer.from(f.b64,'base64'),mime:f.mime,name:f.name||o.fileName,photo:o.pdType==='photo'}}
export const hasAny=async()=>(await list()).some(p=>p.on!==false)
export const fileByProd=async id=>{const f=await kv.get('pf:'+String(id)+':file');return f&&{buf:Buffer.from(f.b64,'base64'),mime:f.mime,name:f.name}}
