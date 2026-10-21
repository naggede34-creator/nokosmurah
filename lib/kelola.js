// MENU KELOLA (admin): daftar & hapus massal bot reseller, serta pembersihan transaksi gagal + sampah web.
// Backup / impor memakai jalur yang sudah ada (lib/backup.js: backup/page, backup/import, backup/wipe).
import {kv} from './db'
import {save} from './auth'
import {getBots,saveBots,tg} from './tgpush'
import * as RS from './reseller'
import {notify} from './telegram'
import {expireIfLate,isLate} from './sync'
import {depPendRm,depLateRm} from './deposit'
import {RULES,sweepPrefix,taskIdx,sweepOrphans} from './autoclean'
import {wn,sc,dbn,SERVERS} from './providers'
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
// Tiga akun penyedia: WarungNokos (Server Plus/Express/Lite memakai satu akun), SMSCode, Dibanana (4 server satu akun).
// Tiap akun dicek paralel dengan batas 12 detik; satu akun yang gagal tidak menggagalkan yang lain.
const ACC=[
 {id:'wn',name:'WarungNokos',need:'WN_KEY',pre:'warungnokos_',get:async()=>{const d=((await wn('/api/user/profile',{timeout:12000}))||{}).data||{};return {balance:Math.round(+d.balance||0),who:d.username||d.email||''}}},
 {id:'sms',name:'SMSCode',need:'SMSCODE_KEY',pre:'smscode_',get:async()=>{const d=(await sc('/balance',{timeout:12000}))||{};return {balance:Math.round(+d.balance||0),currency:d.currency||'IDR'}}},
 {id:'dbn',name:'Dibanana',need:'DIBANANA_KEY',pre:'dibanana_',get:async()=>{const d=(await dbn('/balance',{timeout:12000}))||{};return {balance:Math.round(+d.balance||0),currency:d.currency||'IDR'}}}]
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

// Satu langkah (≤ deadline). state dikirim balik-balik oleh browser sampai done=true.
export async function cleanStep(state,dry,deadline){
 const s=state&&typeof state==='object'?state:{}
 const st={stage:s.stage||'tx',after:s.after||'',ri:+s.ri||0,cur:s.cur||{},stats:s.stats||{},scanned:+s.scanned||0,retry:s.retry||null,t:{}}
 const fake={stats:st.stats,t:{},scanned:0}
 if(st.stage==='tx'){
  for(;;){
   if(Date.now()>deadline)break
   const r=await kv.scanPrefix('u:',st.after,60)
   let stop=false
   for(const it of r.items){
    if(Date.now()>deadline){stop=true;break}
    let res=null
    try{res=await cleanUser(it.v&&it.v.id||it.k.slice(2),dry,st.stats,deadline)}catch(e){add(st.stats,'galat')}
    if(res==='retry'){
     // pengguna ini belum selesai: ulangi di langkah berikutnya (maks. 3x, lalu dilewati supaya tidak macet selamanya)
     const n=(st.retry&&st.retry.k===it.k?st.retry.n:0)+1
     if(n<3){st.retry={k:it.k,n};stop=true;break}
     add(st.stats,'dilewati')}
    st.after=it.k;st.scanned++}
   if(stop)break
   if(r.done){st.stage='junk';st.after='';break}
   st.after=r.last||st.after}}
 if(st.stage==='junk'){
  while(st.ri<RULES.length){
   if(Date.now()>deadline)break
   const [prefix,key,pred]=RULES[st.ri]
   const r=await sweepPrefix(st.cur,prefix,pred,deadline,dry,fake)
   add(st.stats,key,r.n)
   if(r.done)st.ri++;else break}
  if(st.ri>=RULES.length){st.stage='orphan';st.cur.oi=0}}
 if(st.stage==='orphan'){
  const fin=await sweepOrphans(fake,deadline,dry,st.cur,st.stats)
  if(fin){st.stage='idx';st.cur.idx=0}}
 if(st.stage==='idx'){
  const done=await taskIdx(fake,{},deadline,dry,st.cur)
  if(done)st.stage='done'}
 st.scanned+=fake.scanned||0
 const finished=st.stage==='done'
 if(finished&&!dry){
  const g=k=>st.stats[k]||0
  notify({i:'🧹',t:'Clean selesai (admin)',st:'admin',
   rows:[['Order batal / kadaluarsa / gagal',num(g('orderBatal')+g('orderKadaluarsa')+g('orderGagal'))],['Order macet (direfund)',num(g('pendingMacet'))],
    ['Deposit gagal / batal / kadaluarsa',num(g('depositGagal')+g('depositBatal')+g('depositKadaluarsa'))],['Sampah web',num(g('sessions')+g('tokens')+g('jobs')+g('states')+g('idx')+g('counters')+g('orphans'))]],
   note:'Dijalankan lewat menu Kelola. Saldo, order sukses, dan deposit sukses tidak disentuh.'}).catch(()=>{})}
 return {state:st,done:finished,stats:st.stats,scanned:st.scanned}}
