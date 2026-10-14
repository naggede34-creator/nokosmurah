// Backup SEMUA data (pengguna, saldo, transaksi, deposit, CS, pengumuman, config, dst) -> Telegram owner + ekspor/impor admin
import zlib from 'zlib'
import {kv,volatile} from './db'
import {sendFile} from './telegram'
import {getCfg} from './bonus'
import {toCsv,clean} from './userexport'
export const LIM=1800000 // maks karakter per paket data (aman di bawah batas 4,5MB request Vercel)
const PART=30e6          // maks ~30MB mentah per file Telegram (batas bot 50MB, setelah gzip)
const wibStamp=()=>new Date(Date.now()+7*36e5).toISOString().slice(0,16).replace('T','-').replace(':','')
export async function dumpParts(){
 const parts=[[]],sizes=[0];let n=0,after=''
 for(;;){const r=await kv.scan(after,300)
  for(const e of r.items){const s=JSON.stringify({k:e.k,v:e.v});let i=parts.length-1
   if(sizes[i]+s.length>PART&&parts[i].length){parts.push([]);sizes.push(0);i++}
   parts[i].push(s);sizes[i]+=s.length;n++}
  after=r.last;if(r.done)break}
 return {parts,count:n}}

// ---- DATA PENGGUNA: baca langsung semua kunci "u:" (bukan hanya dari daftar 'idx'), jadi tidak ada pengguna yang terlewat ----
export async function allUsers(){
 const out=[];let after=''
 for(;;){const r=await kv.scanPrefix('u:',after,200);for(const e of r.items)if(e.v&&typeof e.v==='object')out.push(e.v);after=r.last;if(r.done)break}
 return out}
// Pulihkan indeks: pengguna yang ada di database tapi hilang dari 'idx' (mis. daftar bersamaan / import lama) dimasukkan lagi.
// full=true: sekaligus cek pemetaan email -> id (e:), API key -> id (k:), kode ajakan -> id (rc:) dan buat yang hilang.
export async function reindexUsers(full=false){
 const us=await allUsers(),cur=(await kv.get('idx'))||[],have=new Set(cur),miss=us.filter(u=>u.id&&!have.has(u.id))
 for(const u of miss)await kv.sadd('idx',u.id)
 let maps=0
 if(full)for(const u of us){
  if(u.email&&!(await kv.get('e:'+u.email))){await kv.set('e:'+u.email,u.id);maps++}
  if(u.apikey&&!(await kv.get('k:'+u.apikey))){await kv.set('k:'+u.apikey,u.id);maps++}
  if(u.refCode&&!(await kv.get('rc:'+u.refCode))){await kv.set('rc:'+u.refCode,u.id);maps++}}
 return {users:us.length,indexed:cur.length,added:miss.length,maps}}
export async function userStats(){
 let n=0,after='';for(;;){const r=await kv.scanPrefix('u:',after,500);n+=r.items.length;after=r.last;if(r.done)break}
 return {users:n,indexed:((await kv.get('idx'))||[]).length}}
// Halaman data pengguna untuk unduhan di browser (tiap request < LIM karakter). Hash password TIDAK ikut.
export async function usersPage(after=''){
 const items=[];let size=0,cur=after
 for(;;){const r=await kv.scanPrefix('u:',cur,50)
  for(const e of r.items){const u=clean(e.v),sz=JSON.stringify(u).length
   if(size+sz>LIM&&items.length)return {items,next:cur}
   items.push(u);size+=sz;cur=e.k}
  if(r.done)return {items,next:null};cur=r.last}}

// Ringkasan ISI backup: biar pemilik situs bisa memastikan data reseller, bot, job, dan
// gateway benar-benar ikut terbawa. Dihitung dengan satu sapuan dan disimpan 60 detik.
const KEL=[
 ['users','Pengguna web & bot',k=>k.startsWith('u:')],
 ['reseller','Reseller (toko + dompet)',k=>k.startsWith('rs:')],
 ['rsCust','Daftar pelanggan reseller',k=>k.startsWith('rsc:')],
 ['bots','Daftar bot Telegram',k=>k==='bots'],
 ['gateway','Akun QRIS Gateway',k=>k.startsWith('pay:')],
 ['jobs','Daftar job',k=>k==='jobs'],
 ['jobSub','Bukti job dari pengguna',k=>k.startsWith('js:')],
 ['cs','Percakapan CS',k=>k.startsWith('cs:')],
 ['cfg','Pengaturan situs',k=>k==='cfg'||k==='sec'],
 ['deposit','Indeks deposit & gateway',k=>k.startsWith('d:')||k.startsWith('pay')],
]
export async function contents(){
 const c=globalThis.__bkc;if(c&&Date.now()-c.t<60000)return c.v
 const n=Object.fromEntries(KEL.map(x=>[x[0],0]));let total=0,after=''
 for(;;){const r=await kv.scan(after,400)
  for(const e of r.items){total++;for(const [k,,f] of KEL)if(f(e.k))n[k]++}
  after=r.last;if(r.done)break}
 const v={total,rows:KEL.map(([k,l])=>({k,l,n:n[k]}))}
 globalThis.__bkc={t:Date.now(),v};return v}

// Bangun + kirim backup. kind: 'auto' | 'manual'
export async function runBackup(kind='manual'){
 const cfg=await getCfg(),at=Date.now(),stamp=wibStamp()
 try{
  const ri=await reindexUsers(false).catch(()=>null)
  const {parts,count}=await dumpParts(),total=parts.length;let bytes=0,err=null
  for(let i=0;i<total;i++){
   const json=`{"app":"artapedia-id","version":1,"at":${at},"part":${i+1},"parts":${total},"entries":[${parts[i].join(',')}]}`
   const gz=zlib.gzipSync(Buffer.from(json));bytes+=gz.length
   const name=`artapedia-backup-${stamp}${total>1?`-bagian${i+1}dari${total}`:''}.json.gz`
   const cap=`💾 Backup ${kind==='auto'?'otomatis':'manual'} Artapedia ID\n🕒 ${stamp.replace('-',' ')} WIB\n📦 ${count} data${total>1?` · bagian ${i+1}/${total}`:''} · ${(gz.length/1024).toFixed(0)} KB\n\nSimpan baik-baik. Pulihkan lewat /admin > Backup > Import.`
   const r=await sendFile(gz,name,cap);if(!r.ok){err=r.error;break}}
  // File tambahan yang mudah dibaca: SEMUA pengguna (CSV untuk Excel + JSON lengkap dengan riwayat order/deposit/mutasi)
  let users=0
  if(!err){try{const us=await allUsers();users=us.length
   const csv=Buffer.from(toCsv(us),'utf8'),full=zlib.gzipSync(Buffer.from(JSON.stringify({app:'artapedia-id',type:'users',at,total:us.length,users:us.map(clean)})))
   const cap2=`👥 Data pengguna ${kind==='auto'?'otomatis':'manual'}\n🕒 ${stamp.replace('-',' ')} WIB\n📊 ${us.length} pengguna${ri&&ri.added?` (${ri.added} dipulihkan ke daftar)`:''}\n⚠️ Berisi API key pengguna, simpan rahasia.`
   let r=await sendFile(csv,`artapedia-pengguna-${stamp}.csv`,cap2,'text/csv');if(!r.ok)err=r.error
   if(!err){r=await sendFile(full,`artapedia-pengguna-lengkap-${stamp}.json.gz`,'📦 Data pengguna lengkap (riwayat order, deposit, mutasi). Tanpa hash password.');if(!r.ok)err=r.error}
  }catch(e){err='Data pengguna: '+e.message}}
  const meta={at,ok:!err,kind,parts:total,entries:count,users,bytes,error:err||null}
  if(err)meta.at=at-cfg.backup.hours*36e5+10*60000 // gagal: coba lagi 10 menit kemudian
  meta.shownAt=at;await kv.set('bk:meta',meta);return meta
 }catch(e){const meta={at:at-cfg.backup.hours*36e5+10*60000,shownAt:at,ok:false,kind,error:e.message};await kv.set('bk:meta',meta);return meta}}
// Dipanggil cron tiap menit; hanya jalan bila sudah waktunya
export async function autoBackup(){
 const cfg=await getCfg();if(!cfg.backup.on)return null
 const m=(await kv.get('bk:meta'))||{}
 if(Date.now()-(m.at||0)<Math.max(1,+cfg.backup.hours||24)*36e5)return null
 await kv.set('bk:meta',{...m,at:Date.now()-Math.max(1,+cfg.backup.hours||24)*36e5+10*60000}) // kunci 10 menit: kalau proses terhenti (timeout), otomatis dicoba lagi, tidak menunggu 1 interval penuh
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
 globalThis.__lb=null;globalThis.__bkc=null;return n}
export async function wipeAll(){await kv.wipe();globalThis.__lb=null;globalThis.__bkc=null}
