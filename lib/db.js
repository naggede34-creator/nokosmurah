// MongoDB (koleksi "kv"). Tanpa MONGODB_URI => memori sementara (hanya dev lokal).
import {MongoClient} from 'mongodb'
const URI=process.env.MONGODB_URI
const mem=globalThis.__m||(globalThis.__m={})
const memr=globalThis.__mr||(globalThis.__mr={})
// Opsi koneksi untuk serverless: pool kecil (tiap instance hanya butuh beberapa koneksi, pool 100 bawaan
// malah menumpuk koneksi di Atlas), batas tunggu jelas supaya request tidak menggantung puluhan detik,
// dan koneksi menganggur dilepas. Semua bisa ditimpa lewat env kalau perlu.
const OPTS={maxPoolSize:+process.env.MONGO_POOL||20,minPoolSize:1,maxIdleTimeMS:60000,
 serverSelectionTimeoutMS:7000,connectTimeoutMS:7000,socketTimeoutMS:25000,retryReads:true,retryWrites:true}
async function col(){
 if(!globalThis.__mc){
  const p=new MongoClient(URI,OPTS).connect().then(async c=>{const k=c.db(process.env.MONGODB_DB||'artapedia').collection('kv')
   // indeks dibuat di latar: tidak boleh menahan request pertama (dulu setiap cold start menunggu createIndex)
   k.createIndex({exp:1},{expireAfterSeconds:0}).catch(()=>{});return k})
  // KONEKSI GAGAL TIDAK BOLEH DISIMPAN: dulu promise yang gagal tersimpan selamanya, jadi satu gangguan
  // singkat membuat semua request (web & bot) gagal terus sampai instance dimatikan.
  p.catch(()=>{if(globalThis.__mc===p)globalThis.__mc=null})
  globalThis.__mc=p}
 return globalThis.__mc}
// Kunci sementara yang TIDAK ikut backup: sesi login, token reset, rate-limit, staging import, meta backup
export const VOL=/^(s:|pr:|tmp:|rl:|lg:|fg:|bk:)|^cs:[^:]+:\d+$/
export const volatile=k=>VOL.test(String(k))
// Cuplikan keadaan awal dokumen pengguna: dipakai save() untuk tahu MANA yang kita ubah,
// lalu perubahan itu digabungkan ke data terbaru saat terjadi tabrakan tulis (lihat lib/auth.js).
export const mutKey=m=>[m.at,m.amt,m.note].join('|')
// Penanda transaksi: pakai waktu dibuat, BUKAN id. Order dengan Jaminan OTP bisa berganti id
// saat nomornya diganti otomatis; kalau dikenali lewat id, baris yang sama bisa terduplikasi saat penggabungan.
export const txKey=x=>x.type+':'+(x.at||('id'+x.id))
const SKIP=['tx','mut','balance','refCount','refEarn']
export const snapUser=u=>({balance:+u.balance||0,
 mut:new Set((u.mut||[]).map(mutKey)),
 tx:Object.fromEntries((u.tx||[]).map(x=>[txKey(x),JSON.stringify(x)])),
 rest:Object.fromEntries(Object.keys(u).filter(k=>!SKIP.includes(k)).map(k=>[k,JSON.stringify(u[k])])),
 refCount:+u.refCount||0,refEarn:+u.refEarn||0})
const hide=(o,k,v)=>{try{Object.defineProperty(o,k,{value:v,enumerable:false,configurable:true,writable:true})}catch(e){}}
// Setel ulang penanda tersembunyi setelah menyimpan: __rev = revisi yang sekarang ada di database,
// __base = keadaan yang sudah tersimpan (jadi selisih berikutnya dihitung dari sini). Non-enumerable: tidak ikut tersimpan.
export const resnap=(u,rev)=>{hide(u,'__rev',+rev||0);hide(u,'__base',snapUser(u));return u}
function stamp(v,rev,k){
 if(v&&typeof v==='object'){hide(v,'__rev',rev);if(String(k).startsWith('u:'))hide(v,'__base',snapUser(v))}
 return v}
export const kv={
 // Nilai yang dibaca ditempeli dua properti TERSEMBUNYI (non-enumerable, jadi tidak ikut JSON / backup):
 //  __rev  = nomor revisi dokumen saat dibaca, dipakai save() untuk mendeteksi tabrakan tulis
 //  __base = cuplikan keadaan awal (khusus dokumen pengguna) supaya perubahan kita bisa digabung ke data terbaru
 async get(k){
  if(!URI)return stamp(mem[k]??null,memr[k]||0,k)
  const d=await (await col()).findOne({_id:k});return d?stamp(d.v,+d.r||0,k):null},
 // Tulis tanpa peduli revisi (dipakai untuk data non-pengguna). Revisi tetap dinaikkan supaya pembaca lain tahu.
 async set(k,v){if(!URI){mem[k]=v;memr[k]=(memr[k]||0)+1;return}
  await (await col()).updateOne({_id:k},{$set:{v},$inc:{r:1}},{upsert:true})},
 // Tulis HANYA kalau revisi di database masih sama dengan rev. FALSE = ada proses lain yang menyimpan lebih dulu.
 async casSet(k,v,rev){
  if(!URI){if((memr[k]||0)!==(+rev||0))return false;mem[k]=v;memr[k]=(memr[k]||0)+1;return true}
  const c=await col(),r=+rev||0
  if(!r){try{const x=await c.updateOne({_id:k,$or:[{r:{$exists:false}},{r:0}]},{$set:{v},$inc:{r:1}},{upsert:true});return x.matchedCount===1||x.upsertedCount===1}
   catch(e){return false}}
  const x=await c.updateOne({_id:k,r},{$set:{v},$inc:{r:1}});return x.matchedCount===1},
 // Baca BANYAK kunci sekaligus dengan satu query $in per 300 kunci (dulu: satu query per kunci, ribuan
 // query paralel yang membanjiri koneksi dan membuat semua request lain ikut antre). Urutan hasil = urutan kunci.
 async mget(keys){
  keys=[...keys];if(!keys.length)return []
  if(!URI)return keys.map(k=>stamp(mem[k]??null,memr[k]||0,k))
  const c=await col(),got=new Map()
  for(let i=0;i<keys.length;i+=300){
   const r=await c.find({_id:{$in:keys.slice(i,i+300)}}).toArray();for(const d of r)got.set(d._id,d)}
  return keys.map(k=>{const d=got.get(k);return d&&d.v!=null?stamp(d.v,+d.r||0,k):null})},
 async del(k){if(!URI){delete mem[k];delete memr[k];return}await (await col()).deleteOne({_id:k})},
 async incr(k){if(!URI){mem[k]=(mem[k]||0)+1;return mem[k]}
  const d=await (await col()).findOneAndUpdate({_id:k},{$inc:{v:1},$setOnInsert:{exp:new Date(Date.now()+120000)}},{upsert:true,returnDocument:'after'});return d.v},
 // Kunci kerja berumur pendek (anti-dobel). TRUE = kunci berhasil didapat, FALSE = sedang dipegang proses lain.
 // WAJIB dilepas lewat unlock() di blok finally supaya proses yang gagal tidak memblokir percobaan berikutnya.
 async lock(k,ttl=45000){
  const key='tmp:lock:'+k,now=Date.now()
  if(!URI){if(mem[key]&&mem[key]>now)return false;mem[key]=now+ttl;return true}
  const c=await col()
  try{await c.updateOne({_id:key,$or:[{t:{$lte:now}},{t:{$exists:false}}]},{$set:{t:now+ttl,v:1,exp:new Date(now+Math.max(ttl,60000))}},{upsert:true});return true}
  catch(e){if(e&&(e.code===11000||e.code===11001))return false
   // dokumen ada tapi masih berlaku -> gagal dapat kunci
   const d=await c.findOne({_id:key});return !(d&&d.t>now)}},
 async unlock(k){const key='tmp:lock:'+k;if(!URI){delete mem[key];return}try{await (await col()).deleteOne({_id:key})}catch(e){}},
 // Hapus satu nilai dari daftar (array) secara atomik
 async srem(k,val){
  if(!URI){const a=Array.isArray(mem[k])?mem[k]:[];mem[k]=a.filter(x=>x!==val);return}
  try{await (await col()).updateOne({_id:k},{$pull:{v:val}})}catch(e){}},
 // Tambah ke daftar (array) secara ATOMIK, tanpa baca-tulis ulang: mencegah pengguna hilang dari 'idx' saat dua orang daftar bersamaan
 async sadd(k,val){
  if(!URI){const a=Array.isArray(mem[k])?mem[k]:[];if(!a.includes(val))a.push(val);mem[k]=a;return}
  // Langsung $addToSet (1 round-trip). Dokumen lama yang isinya bukan array jarang terjadi: baru diperbaiki kalau Mongo menolak.
  const c=await col()
  try{await c.updateOne({_id:k},{$addToSet:{v:val}},{upsert:true})}
  catch(e){const d=await c.findOne({_id:k},{projection:{v:1}})
   if(d&&!Array.isArray(d.v)){await c.replaceOne({_id:k},{v:[]});await c.updateOne({_id:k},{$addToSet:{v:val}},{upsert:true})}
   else throw e}},
 // Baca bertahap semua kunci berawalan prefix (mis. 'u:' = semua pengguna), urut abjad, > after
 async scanPrefix(prefix,after,limit=100){
  if(!URI){const ks=Object.keys(mem).filter(k=>k.startsWith(prefix)&&(!after||k>after)).sort().slice(0,limit);return {items:ks.filter(k=>mem[k]!=null).map(k=>({k,v:mem[k]})),last:ks[ks.length-1]||after,done:ks.length<limit}}
  const hi=prefix.slice(0,-1)+String.fromCharCode(prefix.charCodeAt(prefix.length-1)+1)
  const r=await (await col()).find({$and:[{_id:{$gte:prefix,$lt:hi}},{_id:{$gt:after||''}},{exp:{$exists:false}}]}).sort({_id:1}).limit(limit).toArray()
  return {items:r.filter(d=>d.v!=null).map(d=>({k:d._id,v:d.v})),last:r.length?r[r.length-1]._id:after,done:r.length<limit}},
 // Baca bertahap (untuk backup): semua kunci permanen > after, urut abjad. last = kunci terakhir yang dipindai.
 async scan(after,limit=100){
  if(!URI){const ks=Object.keys(mem).filter(k=>(!after||k>after)).sort().slice(0,limit);return {items:ks.filter(k=>!volatile(k)&&mem[k]!=null).map(k=>({k,v:mem[k]})),last:ks[ks.length-1]||after,done:ks.length<limit}}
  const r=await (await col()).find({_id:{$gt:after||''},exp:{$exists:false}}).sort({_id:1}).limit(limit).toArray()
  return {items:r.filter(d=>!volatile(d._id)&&d.v!=null).map(d=>({k:d._id,v:d.v})),last:r.length?r[r.length-1]._id:after,done:r.length<limit}},
 // Baca bertahap SEMUA dokumen berawalan prefix, TERMASUK yang nilainya null / sudah kedaluwarsa (khusus pembersihan sampah).
 async raw(prefix,after,limit=200){
  if(!URI){const ks=Object.keys(mem).filter(k=>k.startsWith(prefix)&&(!after||k>after)).sort().slice(0,limit);return {items:ks.map(k=>({k,v:mem[k]})),last:ks[ks.length-1]||after,done:ks.length<limit}}
  const hi=prefix.slice(0,-1)+String.fromCharCode(prefix.charCodeAt(prefix.length-1)+1)
  const r=await (await col()).find({$and:[{_id:{$gte:prefix,$lt:hi}},{_id:{$gt:after||''}}]}).sort({_id:1}).limit(limit).toArray()
  return {items:r.map(d=>({k:d._id,v:d.v})),last:r.length?r[r.length-1]._id:after,done:r.length<limit}},
 // Hapus banyak kunci sekaligus
 async delMany(keys){
  keys=[...keys];if(!keys.length)return 0
  if(!URI){for(const k of keys){delete mem[k];delete memr[k]}return keys.length}
  const x=await (await col()).deleteMany({_id:{$in:keys}});return x.deletedCount||0},
 // Hapus semua data permanen (dipakai import mode "ganti total")
 async wipe(){
  if(!URI){for(const k of Object.keys(mem))if(!volatile(k))delete mem[k];return}
  await (await col()).deleteMany({exp:{$exists:false},_id:{$not:VOL}})}}
