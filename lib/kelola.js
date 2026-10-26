// MENU KELOLA (admin): daftar & hapus massal bot reseller, serta pembersihan transaksi gagal + sampah web.
// Backup / impor memakai jalur yang sudah ada (lib/backup.js: backup/page, backup/import, backup/wipe).
import {kv} from './db'
import {save} from './auth'
import {getBots,saveBots,tg} from './tgpush'
import * as RS from './reseller'
import {notify} from './telegram'
import {expireIfLate,isLate} from './sync'
import {depPendRm,depLateRm} from './deposit'
import {RULES,sweepPrefix,taskIdx,sweepOrphans,removeUser} from './autoclean'
import {dbn,tlk,tlkBalance,SERVERS} from './providers'
import {getSec} from './settings'

const DAY=86400000
const num=n=>(+n||0).toLocaleString('id-ID')

// ------------------------------------------------------------------ bot reseller
// "Penggunaan" sebuah bot = berapa pelanggan & pesanan yang lewat botnya.
//  - penggunaan terbanyak  : diurutkan dari pesanan sukses terbanyak
//  - tanpa penggunaan      : tidak punya pelanggan, tidak ada pesanan, dan reseller belum pernah dapat untung / terjual
//  - untung Rp0            : reseller belum pernah mendapat keuntungan (earn = 0), apa pun yang lain
// Pemindaian semua pengguna dilakukan BERTAHAP (state dikirim balik-balik oleh browser) supaya satu panggilan
// tidak melewati batas waktu server (dulu: timeout -> "An error occurred..." -> "Unexpected token 'A'").
const pendingOf=a=>((a&&a.wd)||[]).filter(x=>/menunggu|proses|pending/i.test(String(x.status||''))).length+((a&&a.dep)||[]).filter(x=>x.status==='menunggu').length+((a&&a.sreq)||[]).filter(x=>x.status==='menunggu').length
export async function listBots(state,deadline){
 const s=state&&typeof state==='object'?state:{}
 const stat=s.stat&&typeof s.stat==='object'?s.stat:{}
 let after=String(s.after||''),scanned=+s.scanned||0,done=false
 for(;;){
  if(deadline&&Date.now()>deadline)break
  const r=await kv.scanPrefix('u:',after,100)
  for(const {v:u} of r.items){scanned++;if(!u||!u.rs)continue
   const t=stat[u.rs]||(stat[u.rs]={cust:0,orders:0,ok:0,spent:0})
   t.cust++
   for(const x of (u.tx||[]))if(x&&x.type==='order'){t.orders++;if(x.status==='success'){t.ok++;t.spent+=+x.price||0}}}
  after=r.last||after;if(r.done){done=true;break}}
 if(!done)return {partial:true,state:{after,stat,scanned},scanned}
 const bots=(await getBots()).filter(b=>b.rs)
 const uids=[...new Set(bots.map(b=>b.rs))]
 const [rows,owners]=await Promise.all([kv.mget(uids.map(i=>'rs:'+i)),kv.mget(uids.map(i=>'u:'+i))])
 const A=new Map(uids.map((id,i)=>[id,rows[i]])),O=new Map(uids.map((id,i)=>[id,owners[i]]))
 const now=Date.now()
 const items=bots.map(b=>{
  const a=A.get(b.rs)||{},o=O.get(b.rs)||{},s2=stat[b.rs]||{cust:0,orders:0,ok:0,spent:0}
  const yatim=!a.bot||a.bot.id!==b.id
  const uang=(+a.balance||0)+(+a.stok||0)
  const tunggu=pendingOf(a)
  const unused=s2.cust===0&&s2.orders===0&&!(+a.sold>0)&&!(+a.earn>0)
  return {id:b.id,uid:b.rs,username:b.username||'',name:b.name||'',brand:a.brand||b.brand||'',mode:a.mode==='mandiri'?'mandiri':'komisi',
   ownerEmail:o.email||'',ownerName:o.name||'',ownerTg:(a.bot&&a.bot.ownerUser)||b.ownerUser||'',ownerTgId:(a.bot&&a.bot.ownerId)||(b.admins||[])[0]||'',
   on:b.on!==false&&a.on!==false,at:+b.at||0,days:Math.floor((now-(+b.at||now))/DAY),
   cust:s2.cust,orders:s2.orders,ok:s2.ok,spent:s2.spent,sold:+a.sold||0,earn:+a.earn||0,balance:+a.balance||0,stok:+a.stok||0,
   uang,tunggu,unused,yatim,zero:!(+a.earn>0)}})
 const total={bots:items.length,unused:items.filter(x=>x.unused).length,unusedAman:items.filter(x=>x.unused&&!x.uang&&!x.tunggu).length,
  zero:items.filter(x=>x.zero).length,cust:items.reduce((a,x)=>a+x.cust,0),ok:items.reduce((a,x)=>a+x.ok,0)}
 return {items:items.sort((x,y)=>y.ok-x.ok||y.orders-x.orders||y.cust-x.cust),total}}

// Bot dengan keuntungan Rp0: hanya perlu data bot + dompet reseller (tanpa memindai semua pengguna, jadi cepat).
// Tarikan/isi saldo yang masih menunggu SELALU dilewati. Bot yang dompetnya masih berisi dilewati kecuali inclMoney
// (saldo dompet tetap tersimpan di akun reseller, jadi aman walau botnya dihapus).
async function zeroTargets(minDays,inclMoney){
 const bots=(await getBots()).filter(b=>b.rs)
 const uids=[...new Set(bots.map(b=>b.rs))]
 const rows=await kv.mget(uids.map(i=>'rs:'+i)),A=new Map(uids.map((id,i)=>[id,rows[i]||{}]))
 const now=Date.now()
 return bots.filter(b=>{const a=A.get(b.rs)||{}
  if(+a.earn>0||pendingOf(a))return false
  if(!inclMoney&&((+a.balance||0)+(+a.stok||0))>0)return false
  return Math.floor((now-(+b.at||now))/DAY)>=minDays}).map(b=>b.id)}

// Hapus bot. Webhook dicabut & bot dilepas dari daftar; dompet/untung reseller TIDAK dihapus
// (akun reseller tetap ada dan bisa membuat bot baru). Mode `unused` / `zero`: server menghitung sendiri
// daftar bot yang memenuhi syarat supaya tidak bergantung pada kiriman browser. Browser lalu memakai `left`.
export async function delBots({ids,unused,zero,inclMoney,minDays},deadline){
 let target=Array.isArray(ids)?ids.map(String):[]
 const md=Math.max(0,Math.floor(+minDays)||0)
 if(zero)target=await zeroTargets(md,!!inclMoney)
 else if(unused){
  let st=null
  for(let n=0;n<500;n++){const r=await listBots(st,Date.now()+20000);if(!r.partial){target=r.items.filter(x=>x.unused&&!x.uang&&!x.tunggu&&x.days>=md).map(x=>x.id);break}st=r.state}}
 target=[...new Set(target)].slice(0,2000)
 const done=[],failed=[],names=[]
 let i=0
 for(;i<target.length;i++){
  if(Date.now()>deadline)break
  const id=target[i],b=(await getBots()).find(x=>String(x.id)===id)
  if(!b){done.push(id);continue}   // sudah tidak ada
  try{
   const a=b.rs?await RS.getRs(b.rs):null
   const yatim=!a||!a.bot||a.bot.id!==b.id
   if(yatim||!b.rs){try{await tg(b.token,'deleteWebhook',{drop_pending_updates:true})}catch(e){}
    await saveBots((await getBots()).filter(x=>x.id!==b.id))}
   else await RS.delBot(b.rs)
   done.push(id);names.push('@'+(b.username||b.id))
  }catch(e){failed.push({id,error:String((e&&e.message)||e).slice(0,120)})}}
 const left=target.slice(i)
 if(names.length)notify({i:'🗑',t:'Bot reseller dihapus massal (admin)',st:'admin',
  rows:[['Jumlah',num(names.length)],['Bot',names.slice(0,8).join(', ')+(names.length>8?' dll':'')],...(failed.length?[['Gagal',num(failed.length)]]:[])],
  note:'Dihapus lewat menu Kelola. Dompet reseller tetap aman, reseller bisa membuat bot baru.'}).catch(()=>{})
 return {done:done.length,failed,left,total:target.length}}

// ------------------------------------------------------------------ SALDO SERVER NOKOS
// Satu akun penyedia: Dibanana (4 server memakai satu akun).
// Tiap akun dicek paralel dengan batas 12 detik; satu akun yang gagal tidak menggagalkan yang lain.
const ACC=[
 {id:'dbn',name:'Dibanana',need:'DIBANANA_KEY',pre:'dibanana_',get:async()=>{const d=(await dbn('/balance',{timeout:12000}))||{};return {balance:Math.round(+d.balance||0),currency:d.currency||'IDR'}}},
 {id:'tlk',name:'Telekos',need:'TELEKOS_KEY',pre:'telekos_',get:async()=>({balance:tlkBalance(await tlk('/api/balance',{timeout:12000})),currency:'IDR'})}]
export async function serverBalances(){
 const sec=await getSec()
 const res=await Promise.all(ACC.map(async a=>{
  const base={id:a.id,name:a.name,configured:!!sec[a.need]}
  if(!base.configured)return {...base,ok:false,error:'API key belum diisi (Admin > Integrasi)'}
  try{return {...base,ok:true,...(await a.get())}}
  catch(e){return {...base,ok:false,error:String((e&&e.message)||e).slice(0,160)}}}))
 const by=new Map(res.map(x=>[x.id,x]))
 const servers=SERVERS.map(s=>{const a=ACC.find(x=>s.server.startsWith(x.pre)),r=a&&by.get(a.id)||{}
  return {server:s.server,name:s.name,provider:s.provider,account:a?a.name:'-',ok:!!r.ok,balance:r.ok?r.balance:null,currency:r.currency||'IDR',error:r.ok?'':(r.error||'')}})
 return {accounts:res,servers,total:res.filter(x=>x.ok).reduce((a,x)=>a+x.balance,0),at:Date.now()}}

// ------------------------------------------------------------------ CLEAN
// Yang dibersihkan:
//  1) Transaksi GAGAL / BATAL / KEDALUWARSA di riwayat semua pengguna (order & deposit). Order yang uangnya belum
//     kembali TIDAK dihapus (ditahan & dilaporkan). Deposit baru dihapus setelah 24 jam supaya pembayaran telat masih bisa masuk.
//  2) Transaksi BERMASALAH: order "menunggu" yang sudah lewat batas tunggu diselesaikan dulu (refund otomatis) lalu dihapus.
//  3) Sampah web: sesi login lama, token reset, antrean kerja lama, status bot kosong, indeks pengguna rusak.
// Saldo, mutasi saldo, order sukses, dan deposit sukses TIDAK pernah disentuh.
const ORD_JUNK=new Set(['cancelled','canceled','expired','failed','gagal','error'])
const DEP_JUNK=new Set(['failed','canceled','cancelled','expired','gagal'])
const ORD_AGE=10*60000, DEP_AGE=DAY
export const classify=(x,now=Date.now())=>{
 if(!x)return null
 if(x.type==='order'){
  if(!ORD_JUNK.has(x.status))return null
  if(now-(+x.at||0)<ORD_AGE)return null
  if(x.status!=='failed'&&x.status!=='gagal'&&x.status!=='error'&&x.refunded!==true)return 'ditahan'
  return x.status==='expired'?'orderKadaluarsa':(x.status==='cancelled'||x.status==='canceled')?'orderBatal':'orderGagal'}
 if(x.type==='deposit'){
  if(x.credited||!DEP_JUNK.has(x.status))return null
  if(now-(+x.at||0)<DEP_AGE)return null
  return x.status==='expired'?'depositKadaluarsa':(x.status==='failed'||x.status==='gagal')?'depositGagal':'depositBatal'}
 return null}
const add=(st,k,n=1)=>{st[k]=(st[k]||0)+n}
// Gangguan jaringan/database yang sifatnya sementara (mis. "connection 14 to ...:27017 timed out"): aman diulang.
export const transient=e=>/timed out|timeout|ECONN|EPIPE|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|socket|network|server selection|topology|pool.*clear|connection.*(closed|reset|timed|refused)|not primary|interrupted|MongoNetwork|MongoServerSelection|MongoPoolCleared/i.test(String(e&&((e.name||'')+' '+(e.message||e))))
// Ulangi operasi baca yang gagal sementara (maks. n kali, jeda bertambah)
const tr=async(fn,n=3)=>{for(let i=1;;i++){try{return await fn()}catch(e){if(i>=n||!transient(e))throw e;await new Promise(r=>setTimeout(r,250*i))}}}

async function cleanUser(id,dry,stats,deadline){
 const key='u:'+id
 let u=await kv.get(key);if(!u||!Array.isArray(u.tx)||!u.tx.length)return
 const now=Date.now()
 // order macet: lewat batas tunggu tapi masih "menunggu" -> refund dulu
 const macet=u.tx.filter(x=>x.type==='order'&&isLate(x))
 if(macet.length){
  if(dry)add(stats,'pendingMacet',macet.length)
  else{let ch=false
   let habis=false
   for(const o of macet){
    // satu panggilan ke penyedia bisa lambat: kalau waktu hampir habis, simpan yang sudah selesai lalu minta diulang
    if(deadline&&Date.now()>deadline-8000){habis=true;break}
    try{if(await expireIfLate(u,o,'dibersihkan admin')){ch=true;add(stats,'pendingMacet')}}catch(e){}}
   if(ch){try{await save(u)}catch(e){}}
   if(habis)return 'retry'
   u=await kv.get(key);if(!u)return}}
 const hit=u.tx.map(x=>[x,classify(x,now)]).filter(([,c])=>c)
 if(!hit.length)return
 if(dry){for(const [,c] of hit)add(stats,c);return}
 // tulis dengan pemeriksaan revisi (casSet): kalau pengguna sedang bertransaksi, baca ulang lalu coba lagi
 for(let i=0;i<4;i++){
  const f=i===0?u:await kv.get(key);if(!f||!Array.isArray(f.tx))return
  const rem=[],keep=[]
  for(const x of f.tx){const c=classify(x,now);if(c&&c!=='ditahan')rem.push([x,c]);else keep.push(x)}
  const tahan=f.tx.filter(x=>classify(x,now)==='ditahan').length
  if(!rem.length){if(tahan)add(stats,'ditahan',tahan);return}
  f.tx=keep
  if(await kv.casSet(key,f,f.__rev)){
   for(const [x,c] of rem){add(stats,c)
    try{if(x.type==='order')await kv.del('o:'+x.id)
     else{await kv.del('d:'+x.id);await depPendRm(x.id);await depLateRm(x.id)}}catch(e){}}
   if(tahan)add(stats,'ditahan',tahan)
   return}
  await new Promise(r=>setTimeout(r,80+i*80))}
 add(stats,'dilewati')}

// ===========================================================================================
// DUA MODE CLEAN (semuanya menghapus PERMANEN: tidak ada arsip, tempat sampah, atau salinan yang disimpan)
//  mode "web" (Clean 1 · sampah website): transaksi gagal/batal/kedaluwarsa, deposit gagal/batal/kedaluwarsa (>24 jam),
//      bot reseller untung Rp0, pengguna saldo Rp0 yang tidak pernah membeli, sampah web (sesi, token, antrean, penghitung),
//      data yatim, indeks rusak.
//  mode "db"  (Clean V2 · sampah MongoDB): dokumen kosong & kedaluwarsa di seluruh koleksi, sampah sementara, data yatim,
//      indeks rusak, dan SISA penyedia lama di pengaturan & data reseller (kredensial, konfigurasi server, rute, markup).
// Selalu dilindungi (tidak pernah disentuh): saldo > 0, order sukses, deposit sukses, order/deposit yang masih menunggu,
// pengguna yang punya referral / catatan admin / webhook / gateway / chat CS / dompet reseller.
// Berjalan bertahap (state dikirim balik-balik oleh browser sampai done=true). Mode uji (dry) hanya menghitung.
// ===========================================================================================
const STAGES={web:['tx','bots','users','junk','orphan','idx'],db:['legacy','dbscan','junk','orphan','idx']}
const OLD_SV=/^(warungnokos|smscode)_/
const OLD_SEC=['WN_KEY','WN_BASE','SMSCODE_KEY','SMSCODE_BASE','SMSCODE_HOOK_SECRET','ARTA_KEY','ARTA_BASE']
// Awalan kunci yang dikenal aplikasi (hanya untuk LAPORAN awalan tak dikenal; tidak dipakai untuk menghapus)
const KNOWN=new RegExp('^(?:(?:agw|agwk|agwo|bk|cs|csbot|d|dbnwh|dep|dpend|e|h2h|h2hid|js|jsr|jsub|k|lb|lg|mo|o|once|ord|pay|payk|payrcp|payref|paywd|pr|rc|ref|ref1|restock|rl|rs|rsc|rsdep|rssreq|s|smp|stoksmp|tg|tgbn|tgr|tmp|u|wb|wk):|(?:ann|autotick|bcq|bots|cfg|csidx|h2hlog|idx|jobs|lb_manual|live_cfg|live_manual|livefeed|payidx|paypend|paywdq|rswd|rssreq|sec|shopstat|site_buttons|strukkey|tgidx|vapid)$)')
export const normOpts=o=>{o=o||{};const c=(v,lo,hi,df)=>{v=Math.floor(+v);return isNaN(v)?df:Math.min(hi,Math.max(lo,v))}
 return {mode:o.mode==='db'?'db':'web',minDays:c(o.minDays,1,3650,7),botDays:c(o.botDays,0,3650,7)}}

// Pengguna yang boleh dihapus: saldo 0, TIDAK PERNAH membeli (tidak ada order sukses / menunggu / deposit berhasil / pengeluaran saldo
// yang tidak dikembalikan), tidak ada referral, tidak ada catatan admin / webhook, tidak diblokir, sudah lewat batas hari.
const spentNet=u=>{let out=0,back=0;for(const m of (u.mut||[])){const a=+m.amt||0;if(a<0)out+=-a;else if(a>0&&/refund|kembali|batal|gagal/i.test(String(m.note||'')))back+=a}return out-back}
export const userJunk=(u,minDays,now=Date.now())=>{
 if(!u||!u.id||u.banned)return false
 const joined=Date.parse(u.joinedAt)||0;if(!joined)return false
 if(now-Math.max(+u.lastLogin||0,joined)<minDays*DAY)return false
 if((+u.balance||0)!==0)return false
 for(const x of (u.tx||[])){
  if(!x)continue
  if(x.type==='order'){if(!ORD_JUNK.has(x.status))return false}
  else if(x.type==='deposit'){if(x.credited||!DEP_JUNK.has(x.status))return false}
  else return false}
 if(spentNet(u)>0)return false
 if((+u.refCount||0)||(+u.refEarn||0))return false
 if(u.note||(u.hook&&u.hook.url)||(u.ipw||[]).length)return false
 return true}
const rsEmpty=a=>!!a&&!(+a.balance>0)&&!(+a.stok>0)&&!(+a.earn>0)&&!(+a.sold>0)&&!a.bot&&!pendingOf(a)&&!(a.wd||[]).length&&!(a.dep||[]).length&&!(a.sreq||[]).length

// Hapus satu bot reseller secara permanen; akun reseller yang benar-benar kosong ikut dihapus.
async function delOneBot(id){
 const b=(await getBots()).find(x=>String(x.id)===String(id));if(!b)return false
 const a=b.rs?await RS.getRs(b.rs):null
 const yatim=!a||!a.bot||a.bot.id!==b.id
 if(yatim||!b.rs){try{await tg(b.token,'deleteWebhook',{drop_pending_updates:true})}catch(e){}
  await saveBots((await getBots()).filter(x=>x.id!==b.id))}
 else await RS.delBot(b.rs)
 if(b.rs){const r=await kv.get('rs:'+b.rs);if(r&&rsEmpty(r))await kv.del('rs:'+b.rs)}
 return true}

export async function cleanStep(state,dry,deadline,opts){
 const s=state&&typeof state==='object'?state:{}
 const o=normOpts(opts),ord=STAGES[o.mode]
 const same=s.mode===o.mode
 const st={mode:o.mode,stage:same&&ord.includes(s.stage)?s.stage:ord[0],after:same?(s.after||''):'',ri:same?(+s.ri||0):0,cur:same?(s.cur||{}):{},stats:same?(s.stats||{}):{},
  scanned:same?(+s.scanned||0):0,retry:same?(s.retry||null):null,fails:same?(+s.fails||0):0,bq:same?s.bq:undefined,bi:same?(+s.bi||0):0,owners:same&&Array.isArray(s.owners)?s.owners:[],unk:same?(s.unk||{}):{},t:{}}
 if(same&&s.stage==='done')st.stage='done'
 try{const r=await cleanStepInner(st,!!dry,deadline,o);st.fails=0;return r}
 catch(e){
  // koneksi database putus/lambat di tengah jalan: kembalikan kemajuan terakhir supaya browser melanjutkan dari titik yang sama
  if(!transient(e))throw e
  st.fails++
  if(st.fails>6)throw Error('Database tidak bisa dihubungi berulang kali ('+String(e.message||e).slice(0,120)+'). Cek MongoDB Atlas (status cluster & Network Access), lalu coba lagi.')
  return {state:st,done:false,stats:st.stats,scanned:st.scanned,unknown:st.unk,warn:'Koneksi database lambat, mengulang ('+st.fails+'/6)…'}}}

// ---- tahap: transaksi gagal / batal / kedaluwarsa (dan order macet yang direfund dulu) ----
async function stageTx(st,dry,deadline){
 for(;;){
  if(Date.now()>deadline)return false
  const r=await tr(()=>kv.scanPrefix('u:',st.after,25))
  for(const it of r.items){
   if(Date.now()>deadline)return false
   let res=null
   // gangguan koneksi sementara: ulangi pengguna ini di langkah berikutnya (bukan dihitung galat)
   try{res=await cleanUser(it.v&&it.v.id||it.k.slice(2),dry,st.stats,deadline)}catch(e){if(transient(e))res='retry';else add(st.stats,'galat')}
   if(res==='retry'){
    // pengguna ini belum selesai: ulangi di langkah berikutnya (maks. 3x, lalu dilewati supaya tidak macet selamanya)
    const n=(st.retry&&st.retry.k===it.k?st.retry.n:0)+1
    if(n<3){st.retry={k:it.k,n};return false}
    add(st.stats,'dilewati')}
   st.after=it.k;st.scanned++}
  if(r.done)return true
  st.after=r.last||st.after}}

// ---- tahap: bot reseller untung Rp0 ----
async function stageBots(st,dry,deadline,opt){
 if(!Array.isArray(st.bq)){
  const semua=await zeroTargets(opt.botDays,true),aman=await zeroTargets(opt.botDays,false)
  st.bq=aman;st.bi=0
  if(semua.length>aman.length)add(st.stats,'botsDitahan',semua.length-aman.length)}
 if(dry){add(st.stats,'botsZero',st.bq.length)
  // pemilik bot yang akan dihapus: akun reseller-nya jadi kosong, jadi ikut dihitung sebagai calon pengguna sampah (uji = hasil sungguhan)
  const bl=await getBots();st.owners=st.bq.map(id=>(bl.find(b=>String(b.id)===String(id))||{}).rs).filter(Boolean)
  st.bq=[];st.bi=0;return true}
 while(st.bi<st.bq.length){
  if(Date.now()>deadline-4000)return false
  const id=st.bq[st.bi]
  try{if(await delOneBot(id))add(st.stats,'botsZero')}catch(e){if(transient(e))throw e;add(st.stats,'galat')}
  st.bi++}
 st.bq=[];st.bi=0;return true}

// ---- tahap: pengguna saldo 0 yang tidak pernah membeli ----
async function stageUsers(st,dry,deadline,opt){
 for(;;){
  if(Date.now()>deadline)return false
  const r=await tr(()=>kv.scanPrefix('u:',st.after,25))
  for(const it of r.items){
   if(Date.now()>deadline)return false
   const u=it.v;st.scanned++
   if(userJunk(u,opt.minDays,Date.now())){
    const [rs,pay,cs]=await tr(()=>Promise.all([kv.get('rs:'+u.id),kv.get('pay:'+u.id),kv.get('cs:'+u.id)]))
    const rs2=rs&&(st.owners||[]).includes(u.id)?{...rs,bot:null}:rs
    if(!(rs2&&rs2.uid&&!rsEmpty(rs2))&&!pay&&!cs){
     if(dry)add(st.stats,'users')
     else{try{await removeUser(u);add(st.stats,'users')}catch(e){if(transient(e))throw e;add(st.stats,'galat')}}}}
   st.after=it.k}
  if(r.done)return true
  st.after=r.last||st.after}}

// ---- tahap: sampah web sementara (sesi, token, antrean, penghitung) ----
async function stageJunk(st,dry,deadline,opt,fake){
 while(st.ri<RULES.length){
  if(Date.now()>deadline)return false
  const [prefix,key,pred]=RULES[st.ri]
  const r=await sweepPrefix(st.cur,prefix,pred,deadline,dry,fake)
  add(st.stats,key,r.n)
  if(r.done)st.ri++;else return false}
 st.cur.oi=0;return true}

// ---- tahap: sisa penyedia lama di pengaturan & data reseller (dihapus permanen) ----
function scrubCfg(c){let n=0
 if(c.wn!==undefined){delete c.wn;n++}
 for(const k of Object.keys(c.srv||{}))if(OLD_SV.test(k)){delete c.srv[k];n++}
 for(const k of Object.keys(c.mks||{}))if(OLD_SV.test(k)){delete c.mks[k];n++}
 if(Array.isArray(c.off)){const f=c.off.filter(k=>!OLD_SV.test(String(k)));n+=c.off.length-f.length;c.off=f}
 for(const m of [c.maint,c.maint&&c.maint.prev])if(m&&m.srv)for(const k of Object.keys(m.srv))if(OLD_SV.test(k)){delete m.srv[k];n++}
 for(const k of ['routes','routes2','routes3','routes4']){const r=c.dep&&c.dep[k];if(r)for(const x of ['warungnokos','artapedia'])if(r[x]!==undefined){delete r[x];n++}}
 return n}
async function casEdit(key,fn,dry){
 for(let i=0;i<4;i++){
  const v0=await kv.get(key);if(!v0||typeof v0!=='object')return 0
  const v=dry?JSON.parse(JSON.stringify(v0)):v0
  const n=fn(v);if(!n)return 0
  if(dry)return n
  if(await kv.casSet(key,v,v.__rev))return n
  await new Promise(r=>setTimeout(r,80+i*80))}
 return 0}
async function stageLegacy(st,dry,deadline){
 const c=st.cur
 if(!c.lg)c.lg='sec'
 if(c.lg==='sec'){
  const n=await casEdit('sec',v=>{let k=0;for(const x of OLD_SEC)if(v[x]!==undefined){delete v[x];k++};return k},dry)
  add(st.stats,'legacy',n)
  if(n&&!dry){try{(await import('./settings')).resetSec()}catch(e){}}
  c.lg='cfg'}
 if(c.lg==='cfg'){
  add(st.stats,'legacy',await casEdit('cfg',scrubCfg,dry))
  c.lg='rs';c.lgAfter=''}
 if(c.lg==='rs'){
  for(;;){
   if(Date.now()>deadline)return false
   const r=await tr(()=>kv.scanPrefix('rs:',c.lgAfter||'',50))
   for(const it of r.items){
    st.scanned++
    const a=it.v
    if(a&&a.mkS&&Object.keys(a.mkS).some(k=>OLD_SV.test(k)))
     add(st.stats,'legacy',await casEdit(it.k,x=>{let k=0;for(const s of Object.keys(x.mkS||{}))if(OLD_SV.test(s)){delete x.mkS[s];k++};return k},dry))
    c.lgAfter=it.k}
   if(r.done)break
   c.lgAfter=r.last||c.lgAfter}
  c.lg='';return true}
 return true}

// ---- tahap: seluruh koleksi MongoDB: dokumen kosong & kedaluwarsa; awalan tak dikenal hanya DILAPORKAN ----
async function stageDb(st,dry,deadline){
 for(;;){
  if(Date.now()>deadline)return false
  const r=await tr(()=>kv.rawAll(st.after,300)),now=Date.now(),del=[]
  for(const it of r.items){
   st.scanned++
   if(it.v==null){del.push(it.k);add(st.stats,'dbKosong');continue}
   if(it.exp&&it.exp<now){del.push(it.k);add(st.stats,'dbKedaluwarsa');continue}
   if(!KNOWN.test(it.k)){const p=(String(it.k).match(/^[^:]*:?/)||[''])[0].slice(0,40)||'(kosong)'
    if(st.unk[p]||Object.keys(st.unk).length<30)st.unk[p]=(st.unk[p]||0)+1}}
  if(del.length&&!dry)await tr(()=>kv.delMany(del))
  st.after=r.last||st.after
  if(r.done)return true}}

const STAGE_FN={tx:stageTx,bots:stageBots,users:stageUsers,junk:stageJunk,legacy:stageLegacy,dbscan:stageDb,
 orphan:async(st,dry,deadline,opt,fake)=>sweepOrphans(fake,deadline,dry,st.cur,st.stats),
 idx:async(st,dry,deadline,opt,fake)=>taskIdx(fake,{},deadline,dry,st.cur)}

async function cleanStepInner(st,dry,deadline,opt){
 const fake={stats:st.stats,t:{},scanned:0}
 const ord=STAGES[st.mode]
 while(st.stage!=='done'&&Date.now()<deadline){
  const fin=await STAGE_FN[st.stage](st,dry,deadline,opt,fake)
  if(!fin)break
  st.stage=ord[ord.indexOf(st.stage)+1]||'done';st.after='';st.retry=null}
 st.scanned+=fake.scanned||0
 const finished=st.stage==='done'
 if(finished&&!dry){
  const g=k=>st.stats[k]||0
  const web=st.mode==='web'
  notify({i:'🧹',t:web?'Clean 1 selesai (sampah website)':'Clean V2 selesai (sampah MongoDB)',st:'admin',
   rows:web?[['Order batal / kadaluarsa / gagal',num(g('orderBatal')+g('orderKadaluarsa')+g('orderGagal'))],['Order macet (direfund)',num(g('pendingMacet'))],
    ['Deposit gagal / batal / kadaluarsa',num(g('depositGagal')+g('depositBatal')+g('depositKadaluarsa'))],['Bot reseller untung Rp0',num(g('botsZero'))],['Pengguna saldo 0 tanpa pembelian',num(g('users'))],
    ['Sampah web',num(g('sessions')+g('tokens')+g('jobs')+g('states')+g('idx')+g('counters')+g('orphans'))]]
   :[['Dokumen kosong',num(g('dbKosong'))],['Dokumen kedaluwarsa',num(g('dbKedaluwarsa'))],['Sisa penyedia lama',num(g('legacy'))],
    ['Sampah sementara',num(g('sessions')+g('tokens')+g('jobs')+g('states')+g('counters'))],['Data yatim + indeks rusak',num(g('orphans')+g('idx'))]],
   note:'Dihapus permanen lewat menu Kelola. Saldo, order sukses, dan deposit sukses tidak disentuh.'}).catch(()=>{})}
 return {state:st,done:finished,stats:st.stats,scanned:st.scanned,unknown:st.unk}}
