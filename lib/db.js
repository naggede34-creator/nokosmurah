// MongoDB (koleksi "kv"). Tanpa MONGODB_URI => memori sementara (hanya dev lokal).
import {MongoClient} from 'mongodb'
const URI=process.env.MONGODB_URI
const mem=globalThis.__m||(globalThis.__m={})
async function col(){
 if(!globalThis.__mc){globalThis.__mc=new MongoClient(URI).connect().then(async c=>{const k=c.db(process.env.MONGODB_DB||'artapedia').collection('kv');await k.createIndex({exp:1},{expireAfterSeconds:0});return k})}
 return globalThis.__mc}
// Kunci sementara yang TIDAK ikut backup: sesi login, token reset, rate-limit, staging import, meta backup
export const VOL=/^(s:|pr:|tmp:|rl:|lg:|fg:|bk:)|^cs:[^:]+:\d+$/
export const volatile=k=>VOL.test(String(k))
export const kv={
 async get(k){if(!URI)return mem[k]??null;const d=await (await col()).findOne({_id:k});return d?d.v:null},
 async set(k,v){if(!URI){mem[k]=v;return}await (await col()).replaceOne({_id:k},{v},{upsert:true})},
 async del(k){if(!URI){delete mem[k];return}await (await col()).deleteOne({_id:k})},
 async incr(k){if(!URI){mem[k]=(mem[k]||0)+1;return mem[k]}
  const d=await (await col()).findOneAndUpdate({_id:k},{$inc:{v:1},$setOnInsert:{exp:new Date(Date.now()+120000)}},{upsert:true,returnDocument:'after'});return d.v},
 // Baca bertahap (untuk backup): semua kunci permanen > after, urut abjad. last = kunci terakhir yang dipindai.
 async scan(after,limit=100){
  if(!URI){const ks=Object.keys(mem).filter(k=>(!after||k>after)).sort().slice(0,limit);return {items:ks.filter(k=>!volatile(k)&&mem[k]!=null).map(k=>({k,v:mem[k]})),last:ks[ks.length-1]||after,done:ks.length<limit}}
  const r=await (await col()).find({_id:{$gt:after||''},exp:{$exists:false}}).sort({_id:1}).limit(limit).toArray()
  return {items:r.filter(d=>!volatile(d._id)&&d.v!=null).map(d=>({k:d._id,v:d.v})),last:r.length?r[r.length-1]._id:after,done:r.length<limit}},
 // Hapus semua data permanen (dipakai import mode "ganti total")
 async wipe(){
  if(!URI){for(const k of Object.keys(mem))if(!volatile(k))delete mem[k];return}
  await (await col()).deleteMany({exp:{$exists:false},_id:{$not:VOL}})}}
