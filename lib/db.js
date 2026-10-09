// MongoDB (koleksi "kv"). Tanpa MONGODB_URI => memori sementara (hanya dev lokal).
import {MongoClient} from 'mongodb'
const URI=process.env.MONGODB_URI
const mem=globalThis.__m||(globalThis.__m={})
async function col(){
 if(!globalThis.__mc){globalThis.__mc=new MongoClient(URI).connect().then(async c=>{const k=c.db(process.env.MONGODB_DB||'artapedia').collection('kv');await k.createIndex({exp:1},{expireAfterSeconds:0});return k})}
 return globalThis.__mc}
export const kv={
 async get(k){if(!URI)return mem[k]??null;const d=await (await col()).findOne({_id:k});return d?d.v:null},
 async set(k,v){if(!URI){mem[k]=v;return}await (await col()).replaceOne({_id:k},{v},{upsert:true})},
 async incr(k){if(!URI){mem[k]=(mem[k]||0)+1;return mem[k]}
  const d=await (await col()).findOneAndUpdate({_id:k},{$inc:{v:1},$setOnInsert:{exp:new Date(Date.now()+120000)}},{upsert:true,returnDocument:'after'});return d.v}}
