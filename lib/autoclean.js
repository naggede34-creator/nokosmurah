// MAINTENANCE OTOMATIS + PEMBERSIHAN SAMPAH
// Tiap jam yang dijadwalkan (bawaan 12:00 dan 03:00 WIB) situs masuk maintenance selama beberapa menit (bawaan 3),
// membersihkan sampah, lalu kembali normal sendiri. Semua kabar dikirim ke channel notifikasi.
// Dipanggil dari /api/cron (pinger tiap 1 menit). Batas waktu maintenance dijaga oleh getCfg (lib/bonus.js: autoView),
// jadi situs kembali normal TEPAT di menit ke-N walau cron terlambat.
import {kv} from './db'
import {getCfg} from './bonus'
import {notify,wibAt} from './telegram'
import {getBots,saveBots,tg,esc} from './tgpush'
import * as RS from './reseller'
import {startAll as bcStart} from './bcall'

export const AUTO_DEF={on:true,slots:['12:00','03:00'],mins:3,delUsers:true,userDays:90,delBots:true,botDays:14,msg:'',notifyUsers:true,doneMsg:''}
const DAY=86400000
const clamp=(v,lo,hi,df)=>{v=Math.floor(+v);return isNaN(v)?df:Math.min(hi,Math.max(lo,v))}
const SLOT=/^([01]?\d|2[0-3]):([0-5]\d)$/
const normSlots=a=>{
 const out=[];for(const x of (Array.isArray(a)?a:[])){const m=String(x||'').trim().match(SLOT);if(m){const t=String(m[1]).padStart(2,'0')+':'+m[2];if(!out.includes(t))out.push(t)}}
 return out.length?out.slice(0,6):[...AUTO_DEF.slots]}
export const normAuto=c=>{c=c||{}
 return {on:c.on!==false,slots:normSlots(c.slots),mins:clamp(c.mins,1,10,3),
  delUsers:c.delUsers!==false,userDays:clamp(c.userDays,14,3650,90),
  delBots:c.delBots!==false,botDays:clamp(c.botDays,3,3650,14),msg:String(c.msg||'').trim().slice(0,200),
  notifyUsers:c.notifyUsers!==false,doneMsg:String(c.doneMsg||'').trim().slice(0,300)}}
export const getAuto=async()=>normAuto(((await getCfg()).autoc))

const ST='tmp:auto',LAST='tmp:auto:last',CUR='tmp:auto:cur'
const wibParts=ms=>{const w=new Date(ms+7*36e5);return {Y:w.getUTCFullYear(),M:w.getUTCMonth(),D:w.getUTCDate()}}
// Daftar jadwal HARI INI (WIB) beserta waktunya dalam ms.
export const slotList=(now,slots)=>{const {Y,M,D}=wibParts(now)
 return slots.map(s=>{const [h,m]=s.split(':').map(Number);return {s,id:`${Y}-${M+1}-${D}|${s}`,ms:Date.UTC(Y,M,D,h,m)-7*36e5}})}
// Jadwal berikutnya (untuk ditampilkan di admin)
export const nextSlot=(now,slots)=>{
 let best=null
 for(const off of [0,1]){for(const x of slotList(now+off*DAY,slots)){if(x.ms>now&&(!best||x.ms<best.ms))best=x}}
 return best}

const DEFMSG=m=>`Maintenance otomatis ${m} menit: sistem sedang dibersihkan. Situs kembali normal sendiri, saldo dan pesananmu aman.`

// ------------------------------------------------------------------ sapuan sampah
const num=n=>(+n||0).toLocaleString('id-ID')
async function getCur(){return (await kv.get(CUR))||{}}
async function setCur(c){await kv.set(CUR,c)}
// Sapu satu awalan kunci. pred(v,key,now) true = hapus. Kursor disimpan supaya sapuan lanjut di menit berikutnya.
export async function sweepPrefix(cur,prefix,pred,deadline,dry,st){
 let after=cur[prefix]||'',n=0,scanned=0,done=false
 for(;;){
  if(Date.now()>deadline)break
  const r=await kv.raw(prefix,after,300);scanned+=r.items.length
  const del=[];for(const {k,v} of r.items){let hit=false;try{hit=!!pred(v,k,Date.now())}catch(e){}if(hit)del.push(k)}
  if(del.length){if(!dry)await kv.delMany(del);n+=del.length}
  after=r.last||after
  if(r.done){done=true;break}}
 cur[prefix]=done?'':after
 // dry-run tidak menyimpan kursor
 st.scanned=(st.scanned||0)+scanned
 return {n,done}}
const expired=(v,k,now)=>v==null||(typeof v==='object'&&(+v.exp||0)>0&&v.exp<now)
export const RULES=[
 // [awalan, nama statistik, predikat hapus]
 ['s:','sessions',(v,k,now)=>{if(v==null||typeof v!=='string')return true;const ts=+String(v).split('|')[1]||0;return !ts||now-ts>32*DAY}],   // cookie sesi berlaku 30 hari
 ['pr:','tokens',expired],            // token reset password
 ['tmp:tgl:','tokens',expired],       // kode hubungkan Telegram
 ['tmp:adm:','tokens',expired],       // token pintu rahasia admin
 ['tmp:bc:','jobs',(v,k,now)=>v==null||(v.done&&now-(+v.at||0)>DAY)||(!v.done&&now-(+v.at||0)>3*DAY)],     // antrean broadcast lama
 ['tmp:bca:','jobs',(v,k,now)=>v==null||(v.done&&now-(+v.at||0)>DAY)||(!v.done&&now-(+v.at||0)>3*DAY)],
 ['tmp:tg:','states',v=>v==null||(typeof v==='object'&&!Object.keys(v).length)]]   // sisa status percakapan bot yang sudah kosong

async function taskTemp(st,A,deadline,dry,cur){
 for(const [prefix,key,pred] of RULES){
  if(Date.now()>deadline)return false
  if(st.t&&st.t[prefix]==='ok')continue
  const r=await sweepPrefix(cur,prefix,pred,deadline,dry,st)
  st.stats[key]=(st.stats[key]||0)+r.n
  if(r.done){(st.t=st.t||{})[prefix]='ok'}}
 return true}

// ------------------------------------------------------------------ pengguna tidak terpakai
// Hanya akun yang BENAR-BENAR tidak pernah dipakai: saldo 0, tanpa transaksi/mutasi apa pun, tanpa referral, tidak diblokir,
// tanpa catatan admin, tanpa akun reseller / gateway / chat CS, dan sudah tidak login sejak batas hari.
function userCandidate(u,A,now){
 if(!u||!u.id||u.banned)return false
 const joined=Date.parse(u.joinedAt)||0;if(!joined)return false
 const last=Math.max(+u.lastLogin||0,joined);if(now-last<A.userDays*DAY)return false
 if((+u.balance||0)!==0)return false
 if((u.tx||[]).length||(u.mut||[]).length)return false
 if((+u.refCount||0)||(+u.refEarn||0))return false
 if(u.note||(u.hook&&u.hook.url)||(u.ipw||[]).length)return false
 return true}
const eqKey=async(k,id)=>{const v=await kv.get(k);return v!=null&&String(v)===String(id)}
async function removeUser(u){
 const id=u.id
 const keys=['u:'+id]
 if(u.email&&await eqKey('e:'+u.email,id))keys.push('e:'+u.email)
 if(u.apikey&&await eqKey('k:'+u.apikey,id))keys.push('k:'+u.apikey)
 if(u.refCode&&await eqKey('rc:'+u.refCode,id))keys.push('rc:'+u.refCode)
 if(u.tgId){const k=u.rs?`tgr:${u.rs}:${u.tgId}`:'tg:'+u.tgId;if(await eqKey(k,id))keys.push(k)}
 await kv.delMany(keys)
 await kv.srem('idx',id)
 if(u.tgId){
  if(u.rs){await kv.srem('rsc:'+u.rs,String(u.tgId));await kv.srem('rsc:'+u.rs,u.tgId)}
  else{await kv.srem('tgidx',u.tgId);await kv.srem('tgidx',String(u.tgId))}}}
async function taskUsers(st,A,deadline,dry,cur){
 if(!A.delUsers){st.t=st.t||{};st.t.users='ok';return true}
 let after=cur.u||'',done=false
 for(;;){
  if(Date.now()>deadline)break
  const r=await kv.scanPrefix('u:',after,150);st.scanned=(st.scanned||0)+r.items.length
  let stop=false,lastK=after
  for(const it of r.items){
   if(Date.now()>deadline+8000){stop=true;break}
   lastK=it.k;const u=it.v
   if(!userCandidate(u,A,Date.now()))continue
   // pemeriksaan tambahan (hanya untuk kandidat, supaya sapuan tetap ringan)
   const [rs,pay,cs]=await Promise.all([kv.get('rs:'+u.id),kv.get('pay:'+u.id),kv.get('cs:'+u.id)])
   if(rs&&rs.uid&&(rs.bot||rs.balance||rs.stok||rs.sold||rs.earn))continue
   if(pay||cs)continue
   if(dry){st.stats.users=(st.stats.users||0)+1;if((st.sample=st.sample||[]).length<5)st.sample.push((u.email||'').replace(/^(.{2}).*(@.*)$/,'$1***$2'));continue}
   try{await removeUser(u);st.stats.users=(st.stats.users||0)+1}catch(e){}}
  after=stop?lastK:(r.last||after)
  if(stop)break
  if(r.done){done=true;break}}
 cur.u=done?'':after
 if(done){(st.t=st.t||{}).users='ok'}
 return done}

// Indeks 'idx' yang masih memuat ID pengguna yang sudah tidak ada
export async function taskIdx(st,A,deadline,dry,cur){
 const ids=(await kv.get('idx'))||[];let off=+cur.idx||0
 while(off<ids.length&&Date.now()<deadline){
  const part=ids.slice(off,off+400),rows=await kv.mget(part.map(i=>'u:'+i));off+=part.length
  const miss=part.filter((id,i)=>!rows[i])
  if(miss.length){st.stats.idx=(st.stats.idx||0)+miss.length;if(!dry)for(const id of miss)await kv.srem('idx',id)}}
 cur.idx=off>=ids.length?0:off
 if(off>=ids.length){(st.t=st.t||{}).idx='ok'}
 return off>=ids.length}

// ------------------------------------------------------------------ bot reseller tidak terpakai
const botsOf=async()=>(await getBots()).filter(b=>b.rs)
async function taskBots(st,A,deadline,dry){
 if(st.t&&st.t.bots==='ok')return true
 const now=Date.now();let removed=0
 for(const b of await botsOf()){
  if(Date.now()>deadline||removed>=20)return false
  if(now-(+b.at||0)<3600000)continue                    // baru dibuat, jangan disentuh
  let a=null;try{a=await RS.getRs(b.rs)}catch(e){continue}
  const orphan=!a.bot||a.bot.id!==b.id                  // akun reseller sudah tidak menunjuk bot ini
  const age=now-(+b.at||0)
  const idle=!orphan&&A.delBots&&age>=A.botDays*DAY&&!(+a.sold>0)&&!(+a.cust>2)&&!(+a.balance>0)&&!(+a.stok>0)&&!(+a.earn>0)
   &&!(a.wd||[]).length&&!(a.dep||[]).length&&!(a.sreq||[]).length
  if(!orphan&&!idle)continue
  const name='@'+(b.username||b.id)
  if(dry){st.stats[orphan?'orphans':'bots']=(st.stats[orphan?'orphans':'bots']||0)+1;(st.botNames=st.botNames||[]).push(name);continue}
  try{
   if(idle&&a.bot&&a.bot.ownerId)await tg(b.token,'sendMessage',{chat_id:a.bot.ownerId,parse_mode:'HTML',disable_web_page_preview:true,
    text:`<b>🧹 BOT RESELLER DINONAKTIFKAN</b>\n━━━━━━━━━━━━━━━━━━\nBot <b>${esc(name)}</b> belum pernah dipakai berjualan selama ${A.botDays} hari lebih, jadi dibersihkan otomatis saat maintenance harian.\n\n<i>Tenang, akun resellermu aman. Kamu bisa membuat bot lagi kapan saja lewat menu Reseller di web.</i>`})
   if(orphan){try{await tg(b.token,'deleteWebhook',{drop_pending_updates:true})}catch(e){}
    await saveBots((await getBots()).filter(x=>x.id!==b.id))}
   else await RS.delBot(b.rs)
   st.stats[orphan?'orphans':'bots']=(st.stats[orphan?'orphans':'bots']||0)+1;(st.botNames=st.botNames||[]).push(name);removed++
  }catch(e){}}
 (st.t=st.t||{}).bots='ok'
 return true}

// ------------------------------------------------------------------ alur satu putaran
async function runTasks(st,A,deadline,dry,cur){
 const order=[taskTemp,taskBots,taskUsers,taskIdx]
 for(const fn of order){
  if(Date.now()>deadline)break
  try{await fn(st,A,deadline,dry,cur)}catch(e){(st.errs=st.errs||[]).push(String((e&&e.message)||e).slice(0,100))}}}
const statLine=s=>[['Sesi lama',s.sessions],['Token kedaluwarsa',s.tokens],['Antrean/broadcast lama',s.jobs],['Status bot kosong',s.states],
 ['Pengguna tidak terpakai',s.users],['Bot reseller tidak terpakai',s.bots],['Bot yatim',s.orphans],['Indeks rusak',s.idx]].filter(([k,v])=>v>0).map(([k,v])=>[k,num(v)])

async function begin(A,id,mode){
 const now=Date.now(),cfg=await getCfg(),was=cfg.maint||{}
 if(was.auto&&was.until&&now<was.until)return null
 const until=now+A.mins*60000
 const prev={on:!!was.on,mode:was.mode==='soft'?'soft':'full',msg:was.msg||'',srv:{...(was.srv||{})}}
 const raw=(await kv.get('cfg'))||{}
 raw.maint={on:true,mode:'full',msg:A.msg||DEFMSG(A.mins),srv:prev.srv,auto:id,until,prev}
 await kv.set('cfg',raw)
 const old=(await kv.get(ST))||{}
 const done={...(old.done||{})};if(mode==='auto')done[id]=now
 const keep=Object.keys(done).sort().slice(-12);const dn={};for(const k of keep)dn[k]=done[k]
 const st={active:true,id,mode,start:now,until,mins:A.mins,stats:{},t:{},scanned:0,done:dn}
 await kv.set(ST,st)
 await notify({i:'🛠',t:'Maintenance otomatis dimulai',st:'warn',
  rows:[['Jadwal',mode==='auto'?id.split('|')[1]+' WIB':'Dijalankan manual'],['Durasi',A.mins+' menit'],['Selesai',wibAt(until)],['Pembersihan',[A.delUsers&&'pengguna tidak terpakai',A.delBots&&'bot reseller tidak terpakai','sampah sistem'].filter(Boolean).join(', ')]],
  note:'Pesanan & deposit baru dihentikan sementara. Saldo dan pesanan yang sedang berjalan tetap aman. Situs kembali normal otomatis.'}).catch(()=>{})
 return st}

async function finish(st,A){
 const raw=(await kv.get('cfg'))||{}
 // kembalikan HANYA kalau maintenance ini masih milik kita (admin mungkin sudah mengubahnya manual)
 if(raw.maint&&raw.maint.auto===st.id){const p=raw.maint.prev||{};raw.maint={on:!!p.on,mode:p.mode==='soft'?'soft':'full',msg:p.msg||'',srv:p.srv||{}};await kv.set('cfg',raw)}
 st.active=false;st.end=Date.now();await kv.set(ST,st)
 const rows=statLine(st.stats)
 await kv.set(LAST,{at:st.end,id:st.id,mode:st.mode,mins:st.mins,stats:st.stats,scanned:st.scanned||0,botNames:(st.botNames||[]).slice(0,20),errs:st.errs||[]})
 await notify({i:'✅',t:'Maintenance otomatis selesai',st:'ok',
  rows:[['Durasi',Math.max(1,Math.round((st.end-st.start)/60000))+' menit'],['Dipindai',num(st.scanned||0)+' data'],...(rows.length?rows:[['Hasil','Tidak ada sampah, sistem sudah bersih']]),
   ...((st.botNames||[]).length?[['Bot dibersihkan',(st.botNames||[]).slice(0,5).join(', ')+((st.botNames||[]).length>5?' dll':'')]]:[]),
   ...((st.errs||[]).length?[['Catatan error',st.errs[0]]]:[])],
  note:'Situs sudah normal kembali. Pesanan & deposit bisa dipakai lagi.'}).catch(()=>{})
 // Kabari PENGGUNA lewat semua bot (utama, reseller tanpa modal, reseller mandiri). Dikirim bertahap oleh cron (bcaTick),
 // jadi tidak menahan putaran ini. Kalau masih ada broadcast lain yang berjalan, admin diberi tahu.
 let sent=null
 if(A.notifyUsers){
  const text=A.doneMsg?esc(A.doneMsg):'Maintenance sudah selesai. Situs &amp; bot normal kembali, pesanan dan deposit bisa dipakai lagi. Terima kasih sudah menunggu 🙏'
  try{await bcStart({text:`<b>✅ MAINTENANCE SELESAI</b>\n━━━━━━━━━━━━━━━━━━\n${text}`,by:0});sent=true}
  catch(e){sent=false;notify({i:'⚠️',t:'Notif maintenance selesai tidak terkirim ke pengguna',st:'warn',rows:[['Alasan',String((e&&e.message)||e).slice(0,120)]],note:'Situs sudah normal. Kirim manual lewat Broadcast kalau perlu.'}).catch(()=>{})}}
 return {finished:true,stats:st.stats,usersNotified:sent}}

// ------------------------------------------------------------------ dipanggil cron tiap menit
export async function autoTick(deadline){
 const A=await getAuto()
 // pemeriksaan murah dulu (tanpa kunci): kebanyakan menit tidak ada yang perlu dikerjakan
 const pre=await kv.get(ST),t0=Date.now()
 const dueOf=st=>A.on&&!(st&&st.active)?slotList(Date.now(),A.slots).find(x=>Date.now()>=x.ms&&Date.now()<x.ms+8*60000&&!((st&&st.done)||{})[x.id]):null
 if(!(pre&&pre.active)&&!dueOf(pre))return A.on?{idle:true}:{off:true}
 if(!(await kv.lock('autotick',55000)))return {busy:true}
 try{
  let st=await kv.get(ST),now=Date.now()
  if(st&&st.active){
   if(now>=st.until)return await finish(st,A)
   const cur=await getCur();await runTasks(st,A,deadline,false,cur);await setCur(cur);await kv.set(ST,st)
   return {active:true,left:Math.ceil((st.until-now)/1000),stats:st.stats}}
  const x=dueOf(st)
  if(!x)return {idle:true}
  st=await begin(A,x.id,'auto');if(!st)return {skipped:'maintenance lain sedang berjalan'}
  const cur=await getCur();await runTasks(st,A,deadline,false,cur);await setCur(cur);await kv.set(ST,st)
  return {started:x.id,stats:st.stats}
 }finally{await kv.unlock('autotick')}}

// ------------------------------------------------------------------ untuk panel admin
export async function autoStatus(){
 const A=await getAuto(),st=await kv.get(ST),last=await kv.get(LAST),now=Date.now(),nx=nextSlot(now,A.slots)
 return {cfg:A,active:!!(st&&st.active&&now<st.until),until:st&&st.active?st.until:0,next:nx?nx.ms:0,nextLabel:nx?nx.s:'',last:last||null}}
export async function autoSave(b){
 const A=normAuto(b);const raw=(await kv.get('cfg'))||{};raw.autoc=A;await kv.set('cfg',raw);return A}
// Simulasi: hitung apa yang AKAN dibersihkan, tanpa menghapus apa pun dan tanpa menyalakan maintenance.
export async function autoDry(deadline){
 const A=await getAuto(),st={stats:{},t:{},scanned:0},cur={}
 // simulasi selalu mulai dari awal (kursor sapuan tidak dipakai & tidak disimpan)
 await runTasks(st,A,deadline,true,cur)
 const finished=['users','bots','idx'].every(k=>(st.t||{})[k]==='ok')&&RULES.every(r=>(st.t||{})[r[0]]==='ok')
 return {stats:st.stats,scanned:st.scanned,sample:st.sample||[],botNames:st.botNames||[],lengkap:finished,errs:st.errs||[]}}
// Jalankan satu putaran sekarang (maintenance sungguhan selama N menit).
export async function autoRunNow(deadline){
 const A=await getAuto()
 if(!(await kv.lock('autotick',55000)))throw Error('Sedang ada proses maintenance lain, coba beberapa detik lagi')
 try{
  const cur0=await kv.get(ST)
  if(cur0&&cur0.active&&Date.now()<cur0.until)throw Error('Maintenance otomatis sedang berjalan')
  const st=await begin(A,'manual-'+Date.now(),'manual');if(!st)throw Error('Maintenance sedang berjalan')
  const cur=await getCur();await runTasks(st,A,deadline,false,cur);await setCur(cur);await kv.set(ST,st)
  return {until:st.until,stats:st.stats}
 }finally{await kv.unlock('autotick')}}
