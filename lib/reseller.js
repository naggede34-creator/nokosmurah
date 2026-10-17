// ===========================================================================
// BOT RESELLER — "jualan nokos tanpa modal"
// Pengguna mendaftarkan bot Telegram miliknya sendiri. Bot itu menjual nokos ke
// PELANGGAN DIA, dengan harga = harga platform + markup yang dia tentukan.
// Selisih markup masuk ke dompet reseller dan bisa ditarik otomatis lewat AustinPay.
//
// Catatan desain:
//  - Bot reseller memakai mesin bot yang sama (lib/tgbot.js), hanya dengan bendera
//    `bot.rs = <uid reseller>`. Jadi tidak ada dua mesin bot yang harus dirawat.
//  - Pelanggan bot reseller punya akun TERPISAH dari akun web (kunci `tgr:<uid>:<tgId>`),
//    supaya saldo pelanggan satu reseller tidak tercampur dengan reseller lain
//    maupun dengan saldo akun web.
//  - Deposit di bot reseller DIPAKSA lewat Pakasir saja (permintaan pemilik situs).
//  - Dompet reseller hanya bertambah dari markup. Modal/biaya nokos ditanggung platform,
//    karena uang deposit pelanggan masuk ke platform.
// ===========================================================================
import crypto from 'crypto'
import {kv} from './db'
import {getSec} from './settings'
import {tg,getBots,saveBots,botSetup} from './tgpush'
import * as A from './austin'
import {notify,mask,rp} from './telegram'
import {LANGS,LANG_KEYS,money,rateOf,pack,PACK_ID} from './rslang'

export const KEY=uid=>'rs:'+uid
export const MARK_MIN=0, MARK_MAX=100
export const WD_MIN=10000          // minimal tarik
// Batas deposit pelanggan lewat QRIS manual toko (mode mandiri saja).
export const DEP_MIN=2000, DEP_MAX=10000000
const nid=()=>crypto.randomBytes(8).toString('hex')
const clampMark=v=>{const x=Math.round(+v*10)/10;return isNaN(x)?5:Math.min(MARK_MAX,Math.max(MARK_MIN,x))}

// mode: 'komisi' = tanpa modal (stok & pembayaran ditanggung platform, reseller dapat markup)
//       'mandiri' = stok dibeli sendiri (saldo stok) dan pembayaran pelanggan masuk ke QRIS reseller
const DEF=uid=>({uid,on:true,mode:'komisi',lang:'id',rate:0,bot:null,markup:5,brand:'',ch:{id:'',user:''},
 balance:0,earn:0,sold:0,cust:0,stok:0,qris:{img:'',name:'',note:''},dep:[],wd:[],log:[],at:Date.now(),tnc:0})
export const MODES={komisi:'Jual nokos tanpa modal',mandiri:'Jual nokos stok mandiri'}
export const isMandiri=a=>((a||{}).mode==='mandiri')
export async function getRs(uid){const a=await kv.get(KEY(uid));return a&&a.uid?a:DEF(uid)}
// Tulis aman dari tabrakan (dua proses menulis bersamaan): baca ulang lalu coba lagi.
async function mutate(uid,fn){
 for(let i=0;i<6;i++){
  const a=await getRs(uid),rev=a.__rev||0
  const out=fn(a);if(out===false)return {a,out:false}
  a.wd=(a.wd||[]).slice(0,300);a.log=(a.log||[]).slice(0,300);a.dep=(a.dep||[]).slice(0,200);a.sreq=(a.sreq||[]).slice(0,60)
  if(await kv.casSet(KEY(uid),a,rev))return {a,out}
  await new Promise(r=>setTimeout(r,60+i*60))}
 throw Error('Gagal menyimpan data reseller, coba lagi')}

export const accept=uid=>mutate(uid,a=>{a.tnc=Date.now();return true}).then(r=>r.a)

// ---------- buka/tutup pendaftaran + slot bot per mode (diatur admin) ----------
// open  = pendaftaran bot reseller baru untuk mode itu dibuka / ditutup.
// slots = jumlah bot maksimal yang boleh terdaftar untuk mode itu (slot penuh = pendaftaran otomatis tertutup).
// Bot yang sudah terdaftar TIDAK terpengaruh: menutup pendaftaran hanya menolak pendaftar baru.
const CFGK='rscfg'
export const SLOT_MAX=5000
export const REG_DEF={komisi:{open:true,slots:200},mandiri:{open:true,slots:200}}
const clampSlot=(v,df)=>{v=Math.floor(+v);return isNaN(v)?df:Math.min(SLOT_MAX,Math.max(0,v))}
// depPct = komisi (%) untuk reseller TANPA MODAL dari setiap deposit pelanggan botnya yang sukses (bawaan 5%).
export const DEP_PCT_DEF=5
const clampPct=v=>{v=Math.round(+v*10)/10;return isNaN(v)?DEP_PCT_DEF:Math.min(50,Math.max(0,v))}
export const normRegCfg=c=>{c=c||{};const o={}
 for(const m of ['komisi','mandiri']){const x=c[m]||{};o[m]={open:x.open!==false,slots:clampSlot(x.slots,REG_DEF[m].slots)}}
 o.depPct=c.depPct==null?DEP_PCT_DEF:clampPct(c.depPct)
 return o}
export const getRegCfg=async()=>normRegCfg(await kv.get(CFGK))
export async function saveRegCfg(b){const was=await getRegCfg(),c=normRegCfg(b);await kv.set(CFGK,c);return {was,cfg:c}}
// Pemakaian slot: jumlah bot reseller yang sedang terdaftar per mode.
async function regUsed(){
 const bots=(await getBots()).filter(x=>x.rs),used={komisi:0,mandiri:0}
 if(!bots.length)return used
 const rows=await kv.mget(bots.map(b=>KEY(b.rs)))
 rows.forEach(a=>{used[a&&a.mode==='mandiri'?'mandiri':'komisi']++})
 return used}
// Status lengkap untuk panel admin & halaman /reseller.
export async function regStatus(){
 const [cfg,used]=await Promise.all([getRegCfg(),regUsed()]),out={}
 for(const m of ['komisi','mandiri']){const {open,slots}=cfg[m],u=used[m],free=Math.max(0,slots-u)
  out[m]={open,slots,used:u,free,accepting:open&&free>0,why:!open?'ditutup':(free<=0?'penuh':'')}}
 out.depPct=cfg.depPct
 return out}

// ---------- daftar / hapus bot ----------
export async function createBot(uid,b,site){
 const a=await getRs(uid)
 if(a.bot)throw Error('Satu akun hanya boleh punya satu bot reseller. Hapus bot lama dulu.')
 if(!a.tnc)throw Error('Setujui syarat & ketentuan dulu')
 const token=String(b.token||'').trim()
 if(!/^\d{6,}:[A-Za-z0-9_-]{30,}$/.test(token))throw Error('Token bot tidak valid. Salin ulang dari @BotFather.')
 const ownerId=String(b.ownerId||'').replace(/\D/g,'')
 if(!/^\d{5,15}$/.test(ownerId))throw Error('ID Telegram owner harus angka (kirim /id ke bot mana pun untuk melihatnya)')
 const want=String(b.username||'').trim().replace(/^@/,'')
 const ownerUser=String(b.ownerUser||'').trim().replace(/^@/,'')
 if(!/^[A-Za-z0-9_]{4,32}$/.test(ownerUser))throw Error('Username Telegram owner tidak valid (tanpa @, 4-32 huruf/angka/garis bawah)')
 const brand=String(b.brand||'').trim().slice(0,32)
 if(brand.length<3)throw Error('Nama toko minimal 3 huruf')
 const ch=parseCh(b)
 const markup=clampMark(b.markup)
 const mode=b.mode==='mandiri'?'mandiri':'komisi'
 const lang=LANG_KEYS.includes(String(b.lang||''))?String(b.lang):'id'
 if(!String(site||'').startsWith('https://'))throw Error('Alamat situs harus HTTPS supaya webhook Telegram bisa dipasang')
 {const rg=(await regStatus())[mode]
  if(!rg.open)throw Error(`Pendaftaran reseller "${MODES[mode]}" sedang ditutup admin. Coba lagi nanti atau pilih mode lain.`)
  if(rg.free<=0)throw Error(`Slot reseller "${MODES[mode]}" sudah penuh (${rg.used}/${rg.slots} bot). Coba lagi nanti atau pilih mode lain.`)}

 const me=await tg(token,'getMe')
 if(!me.ok||!me.result)throw Error('Token ditolak Telegram: '+(me.description||'tidak dikenal'))
 const uname=me.result.username||''
 if(want&&want.toLowerCase()!==uname.toLowerCase())throw Error(`Username bot tidak cocok. Token ini milik @${uname}.`)
 const bots=await getBots()
 if(bots.some(x=>x.token===token))throw Error('Bot ini sudah terdaftar')

 const bot={id:nid(),token,username:uname,name:me.result.first_name||uname,secret:crypto.randomBytes(16).toString('hex'),
  admins:[ownerId],on:true,site,at:Date.now(),rs:uid,brand,ownerUser}
 const w=await botSetup(bot)
 if(!w.ok)throw Error('Gagal memasang webhook: '+w.error)
 await saveBots([...bots,bot])
 const {a:out}=await mutate(uid,x=>{x.bot={id:bot.id,username:uname,name:bot.name,ownerId,ownerUser,at:bot.at}
  x.brand=brand;x.markup=markup;x.on=true;x.ch=ch;x.mode=mode;x.lang=lang;return true})
 notify({i:'🏪',t:'Bot reseller baru',st:'ok',
  rows:[['Bot','@'+uname],['Toko',brand],['Mode',MODES[mode]],['Bahasa',(LANGS[lang]||{}).name||lang],['Markup',markup+'%'],['Owner','@'+ownerUser],['ID owner',ownerId],
   ['Channel reseller',ch.id?(ch.user?'@'+ch.user+' ('+ch.id+')':ch.id):'belum diatur'],
   ['Akun web',uid]],
  note:'Reseller baru bergabung. Semua transaksi tokonya ikut dikabarkan ke channel ini.'}).catch(()=>{})
 return out}

export async function delBot(uid){
 const a=await getRs(uid);if(!a.bot)throw Error('Kamu belum punya bot reseller')
 const bots=await getBots(),bot=bots.find(x=>x.id===a.bot.id)
 if(bot){try{await tg(bot.token,'deleteWebhook',{drop_pending_updates:true})}catch(e){}
  await saveBots(bots.filter(x=>x.id!==bot.id))}
 const {a:out}=await mutate(uid,x=>{x.bot=null;return true})
 return out}

export async function refresh(uid){
 const a=await getRs(uid);if(!a.bot)throw Error('Kamu belum punya bot reseller')
 const bot=(await getBots()).find(x=>x.id===a.bot.id);if(!bot)throw Error('Data bot hilang, daftarkan ulang')
 const w=await botSetup(bot);if(!w.ok)throw Error(w.error)
 return {ok:1,url:w.url}}

export async function setMarkup(uid,pct){
 const m=clampMark(pct)
 const {a}=await mutate(uid,x=>{x.markup=m;return true})
 const bots=await getBots(),i=bots.findIndex(x=>x.rs===uid)
 if(i>=0){bots[i]={...bots[i],markupAt:Date.now()};await saveBots(bots)}
 return a}
export async function setBrand(uid,brand){
 const s=String(brand||'').trim().slice(0,32);if(s.length<3)throw Error('Nama toko minimal 3 huruf')
 const {a}=await mutate(uid,x=>{x.brand=s;return true})
 const bots=await getBots(),i=bots.findIndex(x=>x.rs===uid)
 if(i>=0){bots[i]={...bots[i],brand:s};await saveBots(bots)}
 return a}

// ---------- bahasa, mode, QRIS manual, saldo stok ----------
export async function setLang(uid,lang,rate){
 if(!LANG_KEYS.includes(String(lang||'')))throw Error('Bahasa tidak dikenal')
 const r=Math.max(0,+rate||0)
 const {a}=await mutate(uid,x=>{x.lang=String(lang);x.rate=r;return true})
 return a}
export async function setMode(uid,mode){
 const m=mode==='mandiri'?'mandiri':'komisi'
 const {a}=await mutate(uid,x=>{x.mode=m;return true})
 return a}
// QRIS milik reseller (mode mandiri): gambar QR + nama penerima + catatan singkat.
export async function setQris(uid,q){
 const img=String((q||{}).img||'')
 if(img&&!/^data:image\/(jpeg|png|webp);base64,/.test(img))throw Error('Gambar QRIS tidak valid')
 if(img.length>400000)throw Error('Gambar QRIS terlalu besar (maks ~300KB)')
 const {a}=await mutate(uid,x=>{x.qris={img,name:String((q||{}).name||'').trim().slice(0,40),note:String((q||{}).note||'').trim().slice(0,160)};return true})
 return a}
// Saldo stok: dipakai mode mandiri untuk membeli nokos dari platform.
export async function stokAdd(uid,amount,note){
 const n=Math.round(+amount||0);if(!n)return null
 const {a,out}=await mutate(uid,x=>{
  const v=Math.round((+x.stok||0)+n);if(v<0)return false
  x.stok=v
  x.log=[{t:n>0?'stok+':'stok-',amt:n,bal:v,note:String(note||'').slice(0,80),at:Date.now()},...(x.log||[])]
  return true})
 if(out===false)throw Error('Saldo stok tidak cukup')
 return a}
// Potong saldo stok saat pelanggan memesan (mode mandiri). false = stok kurang.
export async function stokUse(uid,amount,note){
 const n=Math.round(+amount||0);if(n<=0)return true
 const {out}=await mutate(uid,x=>{
  if((+x.stok||0)<n)return false
  x.stok=Math.round((+x.stok||0)-n)
  x.sold=(+x.sold||0)+1
  x.log=[{t:'stok-',amt:-n,bal:x.stok,note:String(note||'').slice(0,80),at:Date.now()},...(x.log||[])]
  return true})
 return out!==false}

// ---------- ISI SALDO STOK: QRIS MANUAL MILIK ADMIN ----------
// Reseller mandiri membayar ke QRIS admin, mengunggah bukti transfer, lalu ADMIN
// yang menyetujui. Saldo stok bertambah tepat sekali (berkunci + penanda credited).
export async function stokReqNew(uid,{amount,proof}){
 const a=await getRs(uid);if(!a.uid||!isMandiri(a))throw Error('Isi saldo stok hanya untuk mode mandiri')
 const n=Math.floor(+amount||0)
 if(!(n>=10000))throw Error('Minimal Rp10.000')
 if(n>10000000)throw Error('Maksimal Rp10.000.000')
 const img=String(proof||'')
 if(!/^data:image\/(jpeg|png|webp);base64,/.test(img))throw Error('Unggah foto bukti transfernya dulu')
 if(img.length>400000)throw Error('Foto terlalu besar (maks ~300KB)')
 if(((a.sreq||[]).filter(x=>x.status==='menunggu'&&!x.via)).length>=3)throw Error('Masih ada 3 permintaan yang menunggu persetujuan admin')
 const rec={id:nid().slice(0,10),amount:n,proof:img,status:'menunggu',credited:false,at:Date.now()}
 await mutate(uid,x=>{x.sreq=[rec,...(x.sreq||[])].slice(0,60);return true})
 await kv.sadd('rssreq',uid)
 notify({i:'📦',t:'Permintaan isi saldo stok',st:'pending',
  rows:[['Toko',a.brand||'-'],['Nominal',rp(n)],['ID',rec.id]],
  note:'Cek mutasi QRIS, lalu setujui di /admin › Reseller.'}).catch(()=>{})
 return {...rec,proof:''}}
// ---------- ISI SALDO STOK LEWAT SMP PAYMENT (OTOMATIS) ----------
// Reseller mandiri mengisi saldo stok dengan QRIS dinamis SMP Payment. Tidak ada unggah bukti dan
// tidak ada ACC admin: begitu pembayaran terbaca, SMP memanggil callback (app/api/callbackqris),
// lalu stokSmpPaid() menambah saldo stok TEPAT SEKALI (berkunci + penanda credited).
// Catatan tagihan disimpan di a.sreq dengan via:'smp' supaya riwayatnya tampil di web & bot.
export const STK_MIN=10000, STK_MAX=10000000
const STK_GRACE=15*60000
const stokLive=r=>r.via==='smp'&&r.status==='menunggu'
export async function stokSmpNew(uid,amount){
 const a=await getRs(uid);if(!a.uid||!isMandiri(a))throw Error('Isi saldo stok hanya untuk mode mandiri')
 const n=Math.floor(+amount||0)
 if(!(n>=STK_MIN))throw Error('Minimal Rp'+STK_MIN.toLocaleString('id-ID'))
 if(n>STK_MAX)throw Error('Maksimal Rp'+STK_MAX.toLocaleString('id-ID'))
 const {smpReady,smpCreate}=await import('./smp')
 if(!await smpReady())throw Error('SMP Payment belum aktif. Hubungi admin platform.')
 const live=(a.sreq||[]).filter(x=>stokLive(x)&&(!x.expMs||Date.now()<x.expMs+STK_GRACE))
 if(live.length>=3)throw Error('Masih ada 3 tagihan isi saldo stok yang belum dibayar. Bayar atau batalkan salah satu dulu.')
 const d=await smpCreate(n,{kind:'stok',uid})
 const rec={id:d.id,via:'smp',amount:n,total:d.total,fee:d.fee||0,qr:d.qr||'',qrImg:d.qrImg||'',exp:d.exp,
  expMs:Date.parse(d.exp)||0,status:'menunggu',credited:false,at:Date.now()}
 await mutate(uid,x=>{x.sreq=[rec,...(x.sreq||[])].slice(0,60);return true})
 return rec}
// DM ke pemilik toko lewat BOT RESELLER-nya sendiri. Tidak pernah melempar.
async function ownerDm(uid,text,markup){
 try{const a=await getRs(uid);if(!a.bot||!a.bot.ownerId)return
  const bot=(await getBots()).find(x=>x.id===a.bot.id);if(!bot)return
  await tg(bot.token,'sendMessage',{chat_id:a.bot.ownerId,text,parse_mode:'HTML',disable_web_page_preview:true,...(markup?{reply_markup:markup}:{})})}catch(e){}}
// Kreditkan saldo stok untuk satu tagihan SMP yang sudah lunas. Aman dipanggil berulang / berbarengan.
// Return {ok,first,rec}: first=true hanya untuk panggilan yang BENAR-BENAR menambah saldo.
export async function stokSmpPaid(uid,id,info){
 if(!await kv.lock('stoksmp:'+uid+':'+id,20000))return {ok:false,busy:true}
 try{
  let first=false,found=false
  const {a}=await mutate(uid,x=>{first=false;found=false
   const r=(x.sreq||[]).find(y=>y.id===String(id)&&y.via==='smp');if(!r)return false
   found=true;if(r.credited)return false
   r.status='diterima';r.credited=true;r.doneAt=Date.now();if(info&&info.rrn)r.rrn=String(info.rrn)
   x.stok=Math.round((+x.stok||0)+r.amount)
   x.log=[{t:'stok+',amt:r.amount,bal:x.stok,note:'Isi saldo stok (SMP Payment)',at:Date.now()},...(x.log||[])]
   first=true;return true})
  const rec=(a.sreq||[]).find(y=>y.id===String(id))||null
  if(!found)return {ok:false,missing:true}
  if(first){
   notify({i:'✅',t:'Saldo stok reseller ditambah (SMP)',st:'ok',id:['ID Tagihan',String(id)],
    rows:[['Toko',a.brand||'-'],['Nominal',rp(rec.amount)],['Saldo stok',rp(a.stok)],['RRN',(info&&info.rrn)||'-']]}).catch(()=>{})
   ownerDm(uid,`✅ <b>Saldo stok masuk</b>\n\n💵 Nominal: <b>${rp(rec.amount)}</b>\n📦 Saldo stok sekarang: <b>${rp(a.stok)}</b>\n🆔 <code>${String(id)}</code>`,
    {inline_keyboard:[[{text:'🏪 Panel Toko',callback_data:'a',style:'primary'}]]})}
  return {ok:true,first,rec}}
 finally{await kv.unlock('stoksmp:'+uid+':'+id)}}
// Cek satu tagihan (tombol "Saya sudah bayar", polling halaman web). Hanya MEMBACA penanda lunas dari callback.
export async function stokSmpCheck(uid,id){
 const a=await getRs(uid),r=(a.sreq||[]).find(x=>x.id===String(id)&&x.via==='smp')
 if(!r)throw Error('Tagihan tidak ditemukan')
 if(r.status==='diterima'||r.status==='batal')return r
 const {PAID}=await import('./smp')
 const p=await kv.get(PAID(r.id))
 if(p){await stokSmpPaid(uid,id,p);return ((await getRs(uid)).sreq||[]).find(x=>x.id===String(id))||r}
 if(r.status==='menunggu'&&r.expMs&&Date.now()>r.expMs+STK_GRACE){
  await mutate(uid,x=>{const y=(x.sreq||[]).find(z=>z.id===String(id));if(!y||y.status!=='menunggu')return false;y.status='kedaluwarsa';return true})
  return ((await getRs(uid)).sreq||[]).find(x=>x.id===String(id))||r}
 return r}
export async function stokSmpCancel(uid,id){
 const r=await stokSmpCheck(uid,id)
 if(r.status==='diterima')return r                       // ternyata sudah dibayar
 if(r.status!=='menunggu')throw Error('Tagihan sudah '+r.status)
 const {smpCancel}=await import('./smp');await smpCancel({id:r.id,total:r.total})
 await mutate(uid,x=>{const y=(x.sreq||[]).find(z=>z.id===String(id));if(!y||y.status!=='menunggu')return false;y.status='batal';y.doneAt=Date.now();return true})
 return ((await getRs(uid)).sreq||[]).find(x=>x.id===String(id))||r}
export const stokSmpGet=async(uid,id)=>((await getRs(uid)).sreq||[]).find(x=>x.id===String(id)&&x.via==='smp')||null

// Daftar permintaan yang menunggu (untuk admin). Gambar TIDAK ikut supaya ringan.
export async function stokReqAll(limit=60){
 const ids=(await kv.get('rssreq'))||[],out=[]
 for(const uid of ids){const a=await getRs(uid)
  const pend=(a.sreq||[]).filter(x=>x.status==='menunggu'&&!x.via)
  if(!pend.length){await kv.srem('rssreq',uid);continue}
  for(const r of pend)out.push({uid,brand:a.brand||'',stok:+a.stok||0,id:r.id,amount:r.amount,at:r.at})}
 return out.sort((x,y)=>y.at-x.at).slice(0,limit)}
export const stokReqImg=async(uid,id)=>{const a=await getRs(uid),r=(a.sreq||[]).find(x=>x.id===String(id));return r?{id:r.id,img:r.proof||'',amount:r.amount,at:r.at,status:r.status}:null}
// ACC / tolak oleh ADMIN. Berkunci: satu bukti tidak pernah menambah stok dua kali.
export async function stokReqReview(uid,id,ok){
 if(!await kv.lock('rssreq:'+uid+':'+id,20000))throw Error('Permintaan ini sedang diproses')
 try{
  const a0=await getRs(uid),r0=(a0.sreq||[]).find(x=>x.id===String(id))
  if(!r0)throw Error('Permintaan tidak ditemukan')
  if(r0.status!=='menunggu')throw Error('Permintaan ini sudah '+r0.status)
  await mutate(uid,x=>{const r=(x.sreq||[]).find(y=>y.id===String(id));if(!r||r.status!=='menunggu')return false
   r.status=ok?'diterima':'ditolak';r.doneAt=Date.now()
   if(ok&&!r.credited){r.credited=true
    x.stok=Math.round((+x.stok||0)+r.amount)
    x.log=[{t:'stok+',amt:r.amount,bal:x.stok,note:'Isi saldo stok (QRIS manual)',at:Date.now()},...(x.log||[])]}
   return true})
  const a=await getRs(uid)
  notify({i:ok?'✅':'🚫',t:ok?'Saldo stok reseller ditambah':'Permintaan isi stok ditolak',st:ok?'ok':'warn',
   rows:[['Toko',a.brand||'-'],['Nominal',rp(r0.amount)],['Saldo stok',rp(a.stok)]]}).catch(()=>{})
  const r=(a.sreq||[]).find(y=>y.id===String(id))
  return r?{...r,proof:''}:null}
 finally{await kv.unlock('rssreq:'+uid+':'+id)}}

// ---------- deposit manual (mode mandiri) ----------
// Pelanggan bayar ke QRIS reseller, kirim bukti, lalu reseller meng-ACC.
export async function depNew(uid,d){
 const rec={id:nid().slice(0,10),cust:String(d.cust||''),tgId:String(d.tgId||''),nama:String(d.nama||'').slice(0,32),
  amount:Math.round(+d.amount||0),status:'menunggu',proof:'',at:Date.now()}
 if(rec.amount<=0)throw Error('Nominal tidak valid')
 if(rec.amount<DEP_MIN||rec.amount>DEP_MAX)throw Error(`Nominal deposit harus Rp${DEP_MIN.toLocaleString('id-ID')} - Rp${DEP_MAX.toLocaleString('id-ID')}`)
 await mutate(uid,x=>{x.dep=[rec,...(x.dep||[])].slice(0,200);return true})
 return rec}
export async function depProof(uid,id,fileId){
 const {a}=await mutate(uid,x=>{const r=(x.dep||[]).find(y=>y.id===id);if(!r)return false
  r.proof=String(fileId||'');r.proofAt=Date.now();return true})
 return (a.dep||[]).find(y=>y.id===id)||null}
export const depPending=async uid=>((await getRs(uid)).dep||[]).filter(x=>x.status==='menunggu')
export const depGet=async(uid,id)=>((await getRs(uid)).dep||[]).find(x=>x.id===id)||null
// ACC / tolak. Berkunci supaya satu bukti tidak pernah dibayar dua kali.
export async function depReview(uid,id,ok){
 if(!await kv.lock('rsdep:'+uid+':'+id,20000))throw Error('Deposit ini sedang diproses')
 try{
  const a0=await getRs(uid),r0=(a0.dep||[]).find(x=>x.id===id)
  if(!r0)throw Error('Deposit tidak ditemukan')
  if(r0.status!=='menunggu')throw Error('Deposit ini sudah '+r0.status)
  const {a}=await mutate(uid,x=>{const r=(x.dep||[]).find(y=>y.id===id);if(!r||r.status!=='menunggu')return false
   r.status=ok?'diterima':'ditolak';r.doneAt=Date.now()
   if(ok){x.log=[{t:'dep',amt:r.amount,bal:x.stok,note:'Deposit pelanggan '+(r.nama||r.tgId),at:Date.now()},...(x.log||[])]}
   return true})
  return (a.dep||[]).find(y=>y.id===id)||null}
 finally{await kv.unlock('rsdep:'+uid+':'+id)}}

// ---------- channel notifikasi milik reseller ----------
// id channel Telegram: -1001234567890 (supergroup/channel) atau angka biasa.
// username channel (tanpa @) hanya dipakai untuk tombol "Buka channel" di notifikasi.
export function parseCh(b){
 const id=String(b.chId==null?'':b.chId).trim()
 const user=String(b.chUser||'').trim().replace(/^@/,'')
 if(!id&&!user)return {id:'',user:''}
 if(id&&!/^-?\d{5,20}$/.test(id))throw Error('ID channel harus angka, contoh -1001234567890 (ambil dari @userinfobot)')
 if(user&&!/^[A-Za-z0-9_]{4,32}$/.test(user))throw Error('Username channel tidak valid (tanpa @, 4-32 huruf/angka/garis bawah)')
 if(!id)throw Error('Isi juga ID channel-nya, username saja tidak cukup untuk mengirim notifikasi')
 return {id,user}}
export async function setChannel(uid,b){
 const ch=parseCh(b)
 const {a}=await mutate(uid,x=>{x.ch=ch;return true})
 return a}
// Kirim notifikasi ke channel milik reseller, memakai BOT RESELLER itu sendiri.
// Tidak pernah melempar: channel adalah pelengkap, bukan syarat transaksi berhasil.
// photo (Buffer PNG struk) opsional: kalau ada, dikirim sebagai foto dengan teks jadi keterangannya,
// dan otomatis jatuh kembali ke pesan teks biasa kalau fotonya ditolak.
export async function chNotify(uid,text,markup,photo,photoName){
 try{
  const a=await getRs(uid);const ch=a.ch||{}
  if(!ch.id||!a.bot)return {ok:false,error:'Channel belum diatur'}
  const bot=(await getBots()).find(x=>x.id===a.bot.id);if(!bot)return {ok:false,error:'Bot tidak ditemukan'}
  if(photo){try{const {tgSend}=await import('./telegram')
   const r=await tgSend(bot.token,ch.id,text,markup,photo,photoName);if(r&&r.ok)return {ok:true}}catch(e){}}
  const r=await tg(bot.token,'sendMessage',{chat_id:ch.id,text,parse_mode:'HTML',disable_web_page_preview:true,...(markup?{reply_markup:markup}:{})})
  if(!r.ok)return {ok:false,error:r.description||'ditolak Telegram'}
  return {ok:true}}
 catch(e){return {ok:false,error:e.message}}}
// Tombol uji dari halaman /reseller: pesan contoh + pesan error yang bisa dibaca pemilik toko.
export async function testCh(uid){
 const a=await getRs(uid)
 if(!(a.ch&&a.ch.id))throw Error('Isi ID channel dulu, lalu simpan')
 const r=await chNotify(uid,`<b>🔔 TES NOTIFIKASI CHANNEL</b>\n━━━━━━━━━━━━━━━━━━\nKalau pesan ini masuk, semua transaksi di <b>${String(a.brand||'tokomu').replace(/[<>&]/g,'')}</b> akan dikabarkan ke sini.`)
 if(!r.ok)throw Error('Gagal kirim ke channel: '+r.error+'. Pastikan botmu sudah dijadikan ADMIN di channel itu dan ID channelnya benar.')
 return {ok:1}}

// Kartu siap pakai untuk channel reseller. Nomor & identitas pembeli DISAMARKAN
// karena channel biasanya publik — pemilik toko tetap tahu ada transaksi apa.
const esc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
const rpx=n=>'Rp'+(+n||0).toLocaleString('id-ID')
export const samar=v=>{const t=String(v||'');return t.length<7?t:t.slice(0,4)+'•••••'+t.slice(-3)}
export const card=(ic,judul,baris,catatan)=>`<b>${ic} ${esc(judul)}</b>\n━━━━━━━━━━━━━━━━━━\n`+
 baris.filter(x=>x&&x[1]!==''&&x[1]!=null).map(([k,v])=>`${k}  <b>${esc(v)}</b>`).join('\n')+
 (catatan?`\n━━━━━━━━━━━━━━━━━━\n<i>${esc(catatan)}</i>`:'')
// ---------- notifikasi kejadian pelanggan ke DUA channel ----------
// Permintaan pemilik situs: setiap pelanggan bot reseller (mode komisi maupun mandiri),
// saat deposit menunggu bayar / deposit sukses / beli nokos / OTP diterima, dikabarkan ke
// channel RESELLER *dan* channel ADMIN, selalu dengan FOTO STRUK.
// Bahasa kartu & struk di channel reseller MENGIKUTI bahasa toko; channel admin tetap Indonesia.
const strukDraw=async(item,kind,P)=>{try{const {strukPng}=await import('./strukimg')
 return await strukPng(item,kind,'artapedia.id',P)}catch(e){return null}}
// Struk bahasa Indonesia yang sudah digambar pemanggil dipakai ulang kalau toko memang
// berbahasa Indonesia, supaya satu kejadian tidak menggambar struk dua kali.
const strukFor=async(a,item,kind,png)=>{
 if(((a&&a.lang)||'id')==='id')return png||await strukDraw(item,kind,PACK_ID)
 return await strukDraw(item,kind,pack(a))}
const ordItem=o=>({...o,orderId:o.id,phoneNumber:o.phone,createdAt:new Date(o.at||Date.now()).toISOString()})
const depItem=(o,status,method)=>({order_id:o.id,amount:o.amount,total_amount:o.total||o.amount,
 bonus:o.bonus||0,method_name:method||'QRIS',status,createdAt:new Date(o.at||Date.now()).toISOString()})
// Uang pelanggan ditulis dalam mata uang toko; dompet/stok reseller tetap Rupiah
// karena saldonya memang disimpan & diisi dalam Rupiah di platform.
// Pesanan nokos baru.
export async function chOrder(uid,o,png,pembeli){
 const a=await getRs(uid).catch(()=>null);if(!a)return {ok:false,error:'Reseller tidak ditemukan'}
 const P=pack(a),T=k=>P.t(k)
 const baris=[['📲 '+T('r.service'),o.serviceName+(o.countryName?' · '+o.countryName:'')],
  ['☎️ '+T('r.number'),samar(o.phone)],['💵 '+T('r.price'),P.rp(o.price)],
  ...(o.rsStok?[['📦 '+T('n.stock'),rpx(o.rsStok)]]:[['💰 '+T('n.profit'),o.rsCut?rpx(o.rsCut):'']]),
  ['👤 '+T('n.cust'),pembeli||''],['🆔 '+T('n.id'),o.id]]
 const pg=await strukFor(a,ordItem(o),'order',png)
 return chNotify(uid,card('📱',T('n.order'),baris,T('n.waitotp')),null,pg,'struk-'+o.id+'.png')}
// OTP masuk — dipanggil dari bot, dari sinkron cron, dan dari web.
export async function chOtp(uid,o,png){
 const a=await getRs(uid).catch(()=>null);if(!a)return {ok:false,error:'Reseller tidak ditemukan'}
 const P=pack(a),T=k=>P.t(k)
 const baris=[['📲 '+T('r.service'),o.serviceName+(o.countryName?' · '+o.countryName:'')],
  ['☎️ '+T('r.number'),samar(o.phone)],['💵 '+T('r.price'),P.rp(o.price)],
  ...(o.rsStok?[['📦 '+T('n.stock'),rpx(o.rsStok)]]:[['💰 '+T('n.profit'),o.rsCut?rpx(o.rsCut):'']]),
  ['🆔 '+T('n.id'),o.id]]
 const pg=await strukFor(a,ordItem(o),'order',png)
 return chNotify(uid,card('🔑',T('n.otp'),baris,T('n.done')),null,pg,'struk-'+o.id+'.png')}
// Deposit pelanggan — st: 'pending' | 'lunas'. o.method==='manual' = QRIS manual milik toko.
export async function chDep(uid,o,st,saldo,png){
 const a=await getRs(uid).catch(()=>null);if(!a)return {ok:false,error:'Reseller tidak ditemukan'}
 const P=pack(a),T=k=>P.t(k),lunas=st==='lunas'
 const cara=o.method==='manual'?T('n.manual')+' · '+((a.qris&&a.qris.name)||a.brand||'QRIS'):'QRIS'
 const baris=lunas
  ?[['💵 '+T('r.nominal'),P.rp(o.amount)],['🏦 '+T('r.method'),cara],
    ['👛 '+T('n.bal'),saldo==null?'':P.rp(saldo)],['🆔 '+T('n.id'),o.id]]
  :[['💵 '+T('r.nominal'),P.rp(o.amount)],['💳 '+T('r.pay'),P.rp(o.total||o.amount)],
    ['🏦 '+T('r.method'),cara],['🆔 '+T('n.id'),o.id]]
 const pg=await strukFor(a,depItem(o,lunas?'completed':'pending',cara),'deposit',png)
 return chNotify(uid,card(lunas?'✅':'💰',T(lunas?'n.depok':'n.deppend'),baris,
  T(lunas?'n.added':(o.method==='manual'?'n.waitacc':'n.waitpay'))),null,pg,'struk-'+o.id+'.png')}
// Deposit QRIS MANUAL toko mandiri: channel reseller + channel admin, keduanya dengan struk.
// st: 'pending' (bukti transfer masuk, menunggu ACC) | 'lunas' (sudah di-ACC pemilik toko)
export async function chDepMan(uid,d,st,saldo){
 const rec={...d,method:'manual',total:d.amount}
 const lunas=st==='lunas'
 chDep(uid,rec,st,saldo,null).catch(()=>{})
 try{
  const pg=await strukDraw(depItem(rec,lunas?'completed':'pending','QRIS manual toko'),'deposit',PACK_ID)
  const extra=await rows(uid).catch(()=>[])
  await notify({photo:pg,photoName:'struk-'+d.id+'.png',src:'bot',i:lunas?'✅':'🧾',
   t:(lunas?'Deposit QRIS toko diterima':'Bukti transfer masuk')+' (reseller)',st:lunas?'ok':'pending',
   id:['ID Deposit',d.id],
   rows:[['Pengguna',String(d.nama||d.tgId||'-').slice(0,32)],['Nominal',rp(d.amount)],
    ['Metode','QRIS manual toko'],['Saldo pelanggan',saldo==null?'':rp(saldo)],...extra],
   note:lunas?'Pemilik toko sudah menyetujui bukti transfernya'
             :'Menunggu pemilik toko menyetujui bukti transfernya'})}catch(e){}
 return {ok:1}}

// ---------- komisi deposit pelanggan (mode TANPA MODAL) ----------
// Setiap deposit pelanggan bot reseller yang SUKSES memberi reseller komisi depPct% (bawaan 5%) dari nominal deposit,
// langsung masuk dompet reseller (bisa ditarik). Mode stok mandiri tidak dapat: uang deposit pelanggannya sudah
// masuk ke QRIS-nya sendiri. Aman dipanggil berulang: satu ID deposit hanya dihitung sekali (penanda a.dk).
export async function depCommission(uid,o){
 try{
  const a0=await getRs(uid);if(!a0.uid||isMandiri(a0))return null
  const pct=(await getRegCfg()).depPct
  const base=Math.floor(+o.amount||0),amt=Math.floor(base*pct/100)
  if(!(amt>0)||!o.id)return null
  let first=false
  const {a}=await mutate(uid,x=>{first=false
   const dk=x.dk||[];if(dk.includes(String(o.id)))return false
   x.dk=[String(o.id),...dk].slice(0,400)
   x.balance=Math.round((+x.balance||0)+amt);x.earn=Math.round((+x.earn||0)+amt)
   x.log=[{t:'depkom',amt,bal:x.balance,note:`Komisi deposit ${pct}% · ${rp(base)}`,at:Date.now()},...(x.log||[])]
   first=true;return true})
  if(first)ownerDm(uid,`💸 <b>Komisi deposit masuk</b>\n\n🏦 Deposit pelanggan: <b>${rp(base)}</b>\n🎁 Komisi ${pct}%: <b>+${rp(amt)}</b>\n👛 Saldo reseller: <b>${rp(a.balance)}</b>`,
   {inline_keyboard:[[{text:'🏪 Panel Toko',callback_data:'a',style:'primary'}]]}).catch(()=>{})
  return first?amt:null}
 catch(e){return null}}

// Daftar bot reseller untuk halaman publik /bot-reseller. Hanya data yang memang boleh dilihat umum:
// nama toko, username bot, username Telegram CS toko. ID Telegram owner & token TIDAK ikut.
export async function publicList(){
 const bots=(await getBots()).filter(b=>b.rs&&b.on!==false&&b.username)
 if(!bots.length)return []
 const rows=await kv.mget(bots.map(b=>KEY(b.rs)))
 const out=[]
 bots.forEach((b,i)=>{const a=rows[i];if(!a||!a.uid||a.on===false||!a.bot||a.bot.id!==b.id)return
  out.push({brand:a.brand||b.brand||('@'+b.username),bot:b.username,cs:(a.bot.ownerUser||b.ownerUser||'').replace(/^@/,''),
   mode:a.mode==='mandiri'?'mandiri':'komisi',lang:a.lang||'id',at:+b.at||0})})
 return out.sort((x,y)=>x.at-y.at)}

// ---------- pendapatan ----------
// Dipanggil mesin bot setiap pelanggan berhasil memesan nokos.
export async function addEarn(uid,amount,note){
 // n negatif dipakai saat order di-refund: bagian reseller ditarik kembali.
 const n=Math.floor(+amount||0);if(!n)return null
 const {a}=await mutate(uid,x=>{x.balance=Math.round((+x.balance||0)+n);x.earn=Math.round((+x.earn||0)+n)
  if(n>0)x.sold=(+x.sold||0)+1;else x.sold=Math.max(0,(+x.sold||0)-1)
  x.log=[{t:n>0?'earn':'back',amt:n,bal:x.balance,note:String(note||'').slice(0,80),at:Date.now()},...(x.log||[])]
  return true})
 return a}
// Admin menambah / mengurangi saldo dompet reseller.
// Sama seperti gateway: pengurangan tidak boleh membuat saldo minus.
export async function adminSaldo(uid,delta,note){
 const n=Math.round(+delta||0);if(!n)throw Error('Nominal harus lebih dari 0')
 // uid WAJIB sudah punya catatan reseller: tanpa penjagaan ini, salah ketik uid akan
 // diam-diam membuat rekening reseller baru dan saldonya hilang entah ke mana.
 const ada=await kv.get(KEY(uid));if(!ada||!ada.uid)throw Error('Reseller tidak ditemukan')
 const {a,out}=await mutate(uid,x=>{
  const bal=Math.round((+x.balance||0)+n)
  if(bal<0)return false
  x.balance=bal
  x.log=[{t:n>0?'adm+':'adm-',amt:n,bal,note:String(note||(n>0?'Admin tambah saldo':'Admin kurangi saldo')).slice(0,80),at:Date.now()},...(x.log||[])]
  return true})
 if(out===false)throw Error('Saldo reseller tidak cukup untuk dikurangi sebanyak itu')
 return a}
// Daftar semua reseller untuk panel admin.
export async function listAll(){
 const out=[];let after=''
 for(;;){const r=await kv.scanPrefix('rs:',after,200)
  for(const e of r.items){const a=e.v
   if(a&&a.uid)out.push({uid:a.uid,brand:a.brand||'',markup:a.markup,balance:a.balance||0,earn:a.earn||0,
    mode:a.mode||'komisi',lang:a.lang||'id',stok:+a.stok||0,depWait:(a.dep||[]).filter(x=>x.status==='menunggu').length,
    sold:a.sold||0,cust:a.cust||0,on:a.on!==false,bot:a.bot?{username:a.bot.username,ownerUser:a.bot.ownerUser,ownerId:a.bot.ownerId}:null,at:a.at})}
  after=r.last;if(r.done)break}
 return out.sort((x,y)=>y.earn-x.earn)}
export const addCust=uid=>mutate(uid,x=>{x.cust=(+x.cust||0)+1;return true}).then(r=>r.a).catch(()=>null)

// ---------- pelanggan semua bot reseller (untuk panel admin) ----------
// Pelanggan bot reseller adalah pengguna biasa dengan penanda u.rs = uid resellernya,
// jadi cukup disapu dari daftar pengguna lalu dikelompokkan per toko.
export async function customers({uid='',q='',limit=300}={}){
 const cari=String(q||'').toLowerCase().trim()
 const toko=new Map()
 for(const a of await listAll())toko.set(a.uid,{brand:a.brand||'(tanpa nama)',bot:a.bot&&a.bot.username||'',mode:a.mode||'komisi'})
 const out=[];let after='',total=0
 for(;;){const r=await kv.scanPrefix('u:',after,200)
  for(const {v:u} of r.items){
   if(!u||!u.rs)continue
   if(uid&&u.rs!==uid)continue
   total++
   if(cari&&![u.name,u.email,u.tgUser,u.tgId,u.id].some(x=>String(x||'').toLowerCase().includes(cari)))continue
   if(out.length>=limit)continue
   const ok=(u.tx||[]).filter(x=>x.type==='order'&&x.status==='success')
   const dep=(u.tx||[]).filter(x=>x.type==='deposit'&&x.status==='completed')
   const t=toko.get(u.rs)||{brand:'(toko terhapus)',bot:'',mode:'komisi'}
   out.push({id:u.id,rs:u.rs,brand:t.brand,bot:t.bot,mode:t.mode,name:u.name||'',tgId:u.tgId||'',tgUser:u.tgUser||'',
    balance:+u.balance||0,orders:ok.length,spent:ok.reduce((x,o)=>x+(+o.price||0),0),
    deposit:dep.reduce((x,o)=>x+(+o.amount||0),0),banned:!!u.banned,at:Date.parse(u.joinedAt)||0,last:u.lastLogin||0})}
  after=r.last;if(r.done)break}
 out.sort((x,y)=>y.balance-x.balance||y.orders-x.orders)
 return {total,shown:out.length,items:out,
  toko:[...toko.entries()].map(([k,v])=>({uid:k,brand:v.brand,bot:v.bot}))}}

// ---------- penarikan otomatis (AustinPay) ----------
export const wallets=()=>A.iwWallets()
export const products=w=>A.iwProducts(w)

export async function withdraw(uid,b){
 const a0=await getRs(uid)
 // Mode stok mandiri tidak punya dompet komisi, jadi tidak ada penarikan sama sekali.
 if(isMandiri(a0))throw Error('Mode stok mandiri tidak punya dompet komisi, jadi tidak ada penarikan. Untungmu sudah masuk ke QRIS-mu sendiri.')
 if(!a0.bot)throw Error('Daftarkan bot reseller dulu')
 const wallet=String(b.wallet||'').trim(),code=String(b.product_code||'').trim()
 const dest=String(b.phone||'').replace(/[\s-]/g,'')
 if(!wallet||!code)throw Error('Pilih dompet dan produk tujuan dulu')
 if(!/^[0-9]{5,20}$/.test(dest))throw Error('Nomor tujuan harus 5-20 digit angka')
 const list=(await A.iwProducts(wallet)).products||[]
 const pr=list.find(x=>String(x.code)===code)
 if(!pr)throw Error('Produk tidak ditemukan di dompet '+wallet)
 let nominal,cost
 if(pr.open_denom){
  nominal=Math.floor(+b.nominal||0)
  const lo=Math.max(1,+pr.min||1),hi=+pr.max||1e9
  if(!(nominal>=lo&&nominal<=hi))throw Error(`Nominal harus antara Rp${lo.toLocaleString('id-ID')} - Rp${hi.toLocaleString('id-ID')}`)
  cost=nominal+Math.max(0,+pr.fee||0)}
 else{nominal=Math.floor(+pr.nominal||0);cost=Math.floor(+pr.sell_price||0)
  if(!cost)throw Error('Harga produk tidak tersedia')}
 if(nominal<WD_MIN)throw Error(`Penarikan minimal Rp${WD_MIN.toLocaleString('id-ID')}`)

 const rec={id:nid(),wallet,code,phone:dest,nominal,fee:Math.max(0,cost-nominal),total:cost,
  status:'processing',ref:'',msg:'',refunded:false,at:Date.now()}
 // Saldo dipotong DULU di satu tulis atomik, jadi dua permintaan bersamaan tidak bisa menarik dua kali.
 const {out}=await mutate(uid,x=>{
  if((+x.balance||0)<cost)return false
  x.balance=Math.round((+x.balance||0)-cost)
  x.wd=[rec,...(x.wd||[])]
  x.log=[{t:'wd',amt:-cost,bal:x.balance,note:'Tarik ke '+wallet+' '+dest,at:rec.at},...(x.log||[])]
  return true})
 if(out===false)throw Error('Saldo reseller tidak cukup. Butuh '+rp(cost)+'.')
 await kv.sadd('rswd',uid)

 let res=null,err=null
 try{res=await A.iwCreate({wallet,product_code:code,phone:dest,...(pr.open_denom?{nominal}:{})})}
 catch(e){err=e.message}
 const st=err?'failed':String((res&&res.status)||'processing').toLowerCase()
 await mutate(uid,x=>{const r=(x.wd||[]).find(y=>y.id===rec.id);if(!r)return false
  r.status=st==='success'?'success':st==='failed'?'failed':'processing'
  r.ref=String((res&&res.id)||'');r.msg=err||String((res&&res.message)||'')
  if(r.status==='failed'&&!r.refunded){r.refunded=true;x.balance=Math.round((+x.balance||0)+r.total)
   x.log=[{t:'refund',amt:r.total,bal:x.balance,note:'Penarikan gagal, saldo kembali',at:Date.now()},...(x.log||[])]}
  return true})
 const fin=(await getRs(uid)).wd.find(x=>x.id===rec.id)
 if(fin.status==='failed')throw Error('Penarikan gagal: '+(fin.msg||'ditolak penyedia')+'. Saldo sudah dikembalikan.')
 notify({i:'🏧',t:'Reseller menarik dana',st:'ok',rows:[['Toko',a0.brand||'-'],['Dompet',wallet],['Tujuan',dest],['Nominal',rp(nominal)],['Total potong',rp(cost)],['Status',fin.status]]}).catch(()=>{})
 return fin}

// Sinkron penarikan yang masih diproses
export async function syncWd(uid){
 const a=await getRs(uid)
 const open=(a.wd||[]).filter(x=>x.status==='processing'&&x.ref)
 if(!open.length){await kv.srem('rswd',uid);return 0}
 let n=0
 for(const w of open.slice(0,10)){
  let st=null
  try{const h=await A.iwHistory({id:w.ref})
   const row=(h.transactions||h.data||[]).find(x=>String(x.id)===String(w.ref))
   st=row&&String(row.status||'').toLowerCase()}catch(e){continue}
  if(!st||st==='processing'||st==='pending')continue
  await mutate(uid,x=>{const r=(x.wd||[]).find(y=>y.id===w.id);if(!r||r.status!=='processing')return false
   r.status=st==='success'?'success':'failed'
   if(r.status==='failed'&&!r.refunded){r.refunded=true;x.balance=Math.round((+x.balance||0)+r.total)
    x.log=[{t:'refund',amt:r.total,bal:x.balance,note:'Penarikan gagal, saldo kembali',at:Date.now()},...(x.log||[])]}
   return true});n++}
 return n}

// ---------- penanda untuk channel ADMIN (pemilik situs) ----------
// Setiap kejadian yang datang dari bot reseller diberi baris "Toko" + "Bot" supaya
// pemilik situs bisa langsung tahu transaksi itu milik reseller yang mana.
// Hasilnya disimpan sebentar di memori karena dipanggil tiap transaksi.
export async function rows(uid){
 if(!uid)return []
 const m=globalThis.__rsrow||(globalThis.__rsrow={}),c=m[uid]
 if(c&&Date.now()-c.t<15000)return c.v
 let v=[]
 try{const a=await getRs(uid)
  v=[['Toko',a.brand||'(tanpa nama)'],['Bot',a.bot&&a.bot.username?'@'+a.bot.username:'-'],
     ['Markup',a.markup+'%'],['Saldo reseller',rp(a.balance)]]}
 catch(e){v=[['Toko','(gagal dibaca)']]}
 m[uid]={t:Date.now(),v};return v}

// Status webhook: cache 20 detik per bot + batas tunggu 2,5 detik. Dulu SETIAP aksi di halaman /reseller
// menunggu getWebhookInfo ke Telegram (bisa 1-3 detik), sehingga semua tombol terasa lemot.
async function hookInfo(bot){
 const m=globalThis.__rshk||(globalThis.__rshk={}),c=m[bot.id]
 if(c&&Date.now()-c.t<20000)return c.v
 const info=await Promise.race([tg(bot.token,'getWebhookInfo').catch(()=>null),new Promise(r=>setTimeout(()=>r(null),2500))])
 const v=info?{ok:!!(info.ok&&info.result&&info.result.url),pending:(info.result&&info.result.pending_update_count)||0,
  error:(info.result&&info.result.last_error_message)||''}:(c?c.v:null)
 if(info)m[bot.id]={t:Date.now(),v};return v}
// ---------- tampilan untuk halaman /reseller ----------
export async function view(uid){
 await syncWd(uid).catch(()=>{})
 const a=await getRs(uid)
 let hook=null
 if(a.bot){const bot=(await getBots()).find(x=>x.id===a.bot.id)
  if(bot){hook=await hookInfo(bot)}}
 return {on:a.on,tnc:a.tnc,bot:a.bot,brand:a.brand,markup:a.markup,ch:a.ch||{id:'',user:''},balance:a.balance,earn:a.earn,sold:a.sold,cust:a.cust,
  mode:a.mode||'komisi',lang:a.lang||'id',rate:rateOf(a),cur:(LANGS[a.lang||'id']||LANGS.id).cur,
  stok:+a.stok||0,qris:{...(a.qris||{img:'',name:'',note:''})},
  dep:(a.dep||[]).slice(0,40),depWait:(a.dep||[]).filter(x=>x.status==='menunggu').length,
  sreq:(a.sreq||[]).slice(0,12).map(({proof,...x})=>x),
  langs:LANG_KEYS.map(k=>({k,...LANGS[k]})),modes:MODES,
  wd:(a.wd||[]).slice(0,30),log:(a.log||[]).slice(0,40),hook,wdMin:WD_MIN,reg:await regStatus()}}

// Disapu cron: penarikan yang masih diproses ikut diperbarui walau pemiliknya tidak membuka halaman.
export async function sweepWd(limit=20){
 const ids=((await kv.get('rswd'))||[]).slice(0,limit);let n=0
 for(const uid of ids){try{n+=await syncWd(uid)}catch(e){}}
 return n}
