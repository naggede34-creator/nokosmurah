// Backup SEMUA data (pengguna, saldo, transaksi, deposit, CS, pengumuman, config, dst) -> Telegram owner + ekspor/impor admin
import zlib from 'zlib'
import {kv,volatile} from './db'
import {sendFile} from './telegram'
import {getCfg} from './bonus'
export const LIM=1800000 // maks karakter per paket data (aman di bawah batas 4,5MB request Vercel)
const PART=30e6          // maks ~30MB mentah per file Telegram (batas bot 50MB, setelah gzip)
const wibStamp=()=>new Date(Date.now()+7*36e5).toISOString().slice(0,16).replace('T','-').replace(':','')
export async function dumpParts(){
 const parts=[[]],sizes=[0];let n=0,after=''
 for(;;){const r=await kv.scan(after,100)
  for(const e of r.items){const s=JSON.stringify({k:e.k,v:e.v});let i=parts.length-1
   if(sizes[i]+s.length>PART&&parts[i].length){parts.push([]);sizes.push(0);i++}
   parts[i].push(s);sizes[i]+=s.length;n++}
  after=r.last;if(r.done)break}
 return {parts,count:n}}
// Bangun + kirim backup. kind: 'auto' | 'manual'
export async function runBackup(kind='manual'){
 const cfg=await getCfg(),at=Date.now(),stamp=wibStamp()
 try{
  const {parts,count}=await dumpParts(),total=parts.length;let bytes=0,err=null
  for(let i=0;i<total;i++){
   const json=`{"app":"artapedia-id","version":1,"at":${at},"part":${i+1},"parts":${total},"entries":[${parts[i].join(',')}]}`
   const gz=zlib.gzipSync(Buffer.from(json));bytes+=gz.length
   const name=`artapedia-backup-${stamp}${total>1?`-bagian${i+1}dari${total}`:''}.json.gz`
   const cap=`💾 Backup ${kind==='auto'?'otomatis':'manual'} Artapedia ID\n🕒 ${stamp.replace('-',' ')} WIB\n📦 ${count} data${total>1?` · bagian ${i+1}/${total}`:''} · ${(gz.length/1024).toFixed(0)} KB\n\nSimpan baik-baik. Pulihkan lewat /admin > Backup > Import.`
   const r=await sendFile(gz,name,cap);if(!r.ok){err=r.error;break}}
  const meta={at,ok:!err,kind,parts:total,entries:count,bytes,error:err||null}
  if(err)meta.at=at-cfg.backup.hours*36e5+10*60000 // gagal: coba lagi 10 menit kemudian
  meta.shownAt=at;await kv.set('bk:meta',meta);return meta
 }catch(e){const meta={at:at-cfg.backup.hours*36e5+10*60000,shownAt:at,ok:false,kind,error:e.message};await kv.set('bk:meta',meta);return meta}}
// Dipanggil cron tiap menit; hanya jalan bila sudah waktunya
export async function autoBackup(){
 const cfg=await getCfg();if(!cfg.backup.on)return null
 const m=(await kv.get('bk:meta'))||{}
 if(Date.now()-(m.at||0)<Math.max(1,+cfg.backup.hours||24)*36e5)return null
 await kv.set('bk:meta',{...m,at:Date.now()}) // kunci supaya tidak dobel
 return runBackup('auto')}
// ---- Ekspor bertahap untuk unduhan di browser (tiap request < LIM karakter) ----
export async function backupPage(cur){
 let {after='',ck=null,o=0}=cur||{},items=[],size=0
 if(ck){const s=JSON.stringify(await kv.get(ck));return {items:[{k:ck,part:{o,total:s.length,s:s.slice(o,o+LIM)}}],next:o+LIM>=s.length?{after}:{ck,o:o+LIM,after}}}
 for(;;){const r=await kv.scan(after,100)
  for(const e of r.items){const s=JSON.stringify(e.v)
   if(size+s.length+e.k.length>LIM){
    if(items.length)return {items,next:{after}}
    return {items:[{k:e.k,part:{o:0,total:s.length,s:s.slice(0,LIM)}}],next:s.length>LIM?{ck:e.k,o:LIM,after:e.k}:{after:e.k}}}
   items.push({k:e.k,v:e.v});size+=s.length+e.k.length+12;after=e.k}
  after=r.last;if(r.done)return {items,next:null}}}
// ---- Impor ----
const UNION=['idx','csidx']
async function put(k,v){
 if(typeof k!=='string'||!k||k.length>250||volatile(k))return 0
 if(UNION.includes(k)&&Array.isArray(v)){const cur=(await kv.get(k))||[];v=[...new Set([...cur,...v])]}
 await kv.set(k,v);return 1}
export async function importItems(items){
 let n=0
 for(const it of items||[]){
  if(it&&it.part&&typeof it.part.s==='string'){
   const st=(await kv.get('tmp:imp'))||{};let s=''
   if(it.part.o>0){if(st.k!==it.k)throw Error('Urutan bagian data salah, ulangi import');s=st.s}
   s+=it.part.s
   if(it.part.o+it.part.s.length>=it.part.total){n+=await put(it.k,JSON.parse(s));await kv.del('tmp:imp')}
   else await kv.set('tmp:imp',{k:it.k,s})}
  else if(it&&'v' in it)n+=await put(it.k,it.v)}
 globalThis.__lb=null;return n}
export async function wipeAll(){await kv.wipe();globalThis.__lb=null}
