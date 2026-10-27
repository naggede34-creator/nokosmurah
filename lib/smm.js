// ===========================================================================
// SUNTIK SOSMED (SMM) — satu modul untuk web, API developer, bot utama, dan bot reseller.
// Penyedia: MP Digital Solution (micypedia.id/api/v2, format panel SMM standar).
//
// Aturan emas (sama seperti nokos, tapi dibalik karena order SMM umumnya TIDAK bisa dibatalkan
// di sisi penyedia): saldo DIPOTONG DULU (di bawah kunci per pengguna), baru order dikirim ke
// penyedia. Kalau penyedia menolak / timeout, saldo langsung dikembalikan. Order yang
// tersangkut tanpa ID penyedia otomatis di-refund oleh cron setelah 10 menit.
//
// Status internal: pending (antre) · processing (diproses) · success · partial · cancelled
// Notifikasi (admin channel, DM Telegram, HP, channel reseller, webhook developer), semuanya
// dengan FOTO STRUK: created, processing, success, partial, cancelled, refill, refill_done,
// refill_rejected. Tiap kejadian hanya dikirim sekali (o.nf).
// ===========================================================================
import {kv} from './db'
import {save,rid,clientIp,normIp} from './auth'
import {getSec} from './settings'
import {notify,mask,rp} from './telegram'
import {pushUser,esc} from './tgpush'
import {strukPng} from './strukimg'
import {getCfg,mut} from './bonus'
import {deliver} from './webhook'
import {push as webPush,keyUser} from './push'

export class SmmError extends Error{constructor(m,code,status){super(m);this.code=code||'err';this.status=status||400}}
export const NOKEY='Layanan suntik sosmed belum diaktifkan admin (API key penyedia belum diisi).'
export const RESTOK_MSG='Layanan suntik sosmed sedang restok. Coba lagi beberapa saat lagi, saldo kamu tidak terpotong.'
const nf=n=>(+n||0).toLocaleString('id-ID')
const short=(l,n=44)=>{const t=String(l||'').replace(/^https?:\/\/(www\.)?/i,'');return t.length>n?t.slice(0,n-1)+'…':t}
const isRestock=m=>/not enough|insufficient|low balance|no funds|saldo.*(kurang|tidak cukup|habis)|balance/i.test(String(m||''))

// ---------- konfigurasi (admin > Suntik Sosmed) ----------
export const DEF={on:true,markup:20,kurs:1,round:1,minPrice:0,off:[],offPlat:[],mkp:{},refill:true,cancel:true}
export async function getCfgS(){
 const m=globalThis.__smmc;if(m&&Date.now()-m.t<5000)return m.v
 const c=(await kv.get('smmcfg'))||{}
 const v={...DEF,...c,off:Array.isArray(c.off)?c.off.map(Number):[],offPlat:Array.isArray(c.offPlat)?c.offPlat:[],mkp:c.mkp&&typeof c.mkp==='object'?c.mkp:{}}
 globalThis.__smmc={t:Date.now(),v};return v}
export async function saveCfgS(b){
 const o=await getCfgS(),n={...o};b=b||{}
 const num=(k,lo,hi,lbl)=>{const v=+b[k];if(!(v>=lo&&v<=hi))throw new SmmError(lbl+' harus '+lo+' – '+hi);return v}
 if('on' in b)n.on=!!b.on
 if('markup' in b)n.markup=num('markup',0,1000,'Markup (%)')
 if('kurs' in b)n.kurs=num('kurs',0.0001,1e6,'Kurs')
 if('round' in b)n.round=Math.round(num('round',1,10000,'Pembulatan'))
 if('minPrice' in b)n.minPrice=Math.round(num('minPrice',0,1e6,'Harga minimum'))
 if('refill' in b)n.refill=!!b.refill
 if('cancel' in b)n.cancel=!!b.cancel
 if('off' in b)n.off=[...new Set((Array.isArray(b.off)?b.off:[]).map(Number).filter(x=>x>0))].slice(0,20000)
 if('offPlat' in b)n.offPlat=[...new Set((Array.isArray(b.offPlat)?b.offPlat:[]).map(x=>String(x).slice(0,40)))].slice(0,60)
 if('mkp' in b){const m={};for(const [k,v] of Object.entries(b.mkp||{})){if(v===''||v==null)continue;const x=+v;if(!(x>=0&&x<=1000))throw new SmmError('Markup '+k+' harus 0 – 1000');m[String(k).slice(0,40)]=x}n.mkp=m}
 await kv.set('smmcfg',n);globalThis.__smmc=null;return n}

// ---------- klien penyedia ----------
async function prov(params,ms=20000){
 const sec=await getSec(),key=sec.SMM_KEY
 if(!key)throw new SmmError(NOKEY,'nokey',503)
 const base=(sec.SMM_BASE||'https://micypedia.id/api/v2').replace(/\/+$/,'')
 const r=await fetch(base,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','Accept':'application/json'},body:new URLSearchParams({key,...params}),signal:AbortSignal.timeout(ms)})
 const t=await r.text();let d
 try{d=JSON.parse(t)}catch(e){
  if(/<html|just a moment|cloudflare/i.test(t))throw new SmmError('Server penyedia sedang sibuk atau menolak koneksi. Coba lagi sebentar.','prov',502)
  throw new SmmError('Balasan penyedia tidak dikenali (HTTP '+r.status+')','prov',502)}
 if(d&&!Array.isArray(d)&&typeof d==='object'&&d.error)throw new SmmError(String(d.error),'prov',502)
 return d}
export const providerBalance=()=>prov({action:'balance'})

// ---------- platform ----------
export const PLAT=[
 ['Instagram',/instagram|\big\b/i,'📸','#E1306C'],['TikTok',/tiktok|\btt\b/i,'🎵','#111827'],['YouTube',/youtube|\byt\b/i,'▶️','#FF0000'],
 ['Facebook',/facebook|\bfb\b/i,'f','#1877F2'],['Twitter / X',/twitter|tweet|\bx\b\s*(\(|\/|-|followers|likes)/i,'𝕏','#111827'],['Telegram',/telegram/i,'✈️','#229ED9'],
 ['WhatsApp',/whatsapp/i,'💬','#25D366'],['Spotify',/spotify/i,'🎧','#1DB954'],['Shopee',/shopee/i,'🛍️','#EE4D2D'],['Threads',/threads/i,'@','#111827'],
 ['LinkedIn',/linkedin/i,'in','#0A66C2'],['Twitch',/twitch/i,'🎮','#9146FF'],['Discord',/discord/i,'🗨️','#5865F2'],['Snapchat',/snapchat/i,'👻','#FFFC00'],
 ['Pinterest',/pinterest/i,'📌','#E60023'],['Google',/google|maps|review/i,'🔎','#4285F4'],['Website Traffic',/traffic|website|visitor|pengunjung/i,'🌐','#0EA5E9']]
export const PMETA=Object.fromEntries([...PLAT.map(([n,,ic,c])=>[n,{ic,c}]),['Lainnya',{ic:'✨',c:'#6B7A95'}]])
const platOf=(cat,name)=>{for(const [n,re] of PLAT)if(re.test(cat))return n;for(const [n,re] of PLAT)if(re.test(name))return n;return 'Lainnya'}
const norm=s=>{
 const id=+s.service;if(!id)return null
 const type=String(s.type||'Default');if(!/^(default|custom comments)$/i.test(type))return null   // Package / Subscription / Poll belum didukung
 const rate=+s.rate;if(!(rate>=0))return null
 const name=String(s.name||'').trim().slice(0,220),cat=String(s.category||'Lainnya').trim().slice(0,140)
 const tr=v=>v===true||v==='true'||v===1||v==='1'
 return {id,name,type:/custom/i.test(type)?'comments':'default',category:cat,plat:platOf(cat,name),rate,min:Math.max(1,+s.min||1),max:Math.max(1,+s.max||1),refill:tr(s.refill),cancel:tr(s.cancel)}}
// Daftar layanan penyedia, di-cache 60 dtk di memori + salinan basi di database (dipakai kalau penyedia mati).
export async function allServices(force){
 const m=globalThis.__smms;if(!force&&m&&Date.now()-m.t<60000)return m.v
 let items
 try{const d=await prov({action:'services'},25000)
  if(!Array.isArray(d))throw new SmmError('Format daftar layanan penyedia tidak dikenal','prov',502)
  items=d.map(norm).filter(Boolean)
  await kv.set('tmp:smm:svc',{t:Date.now(),items})}
 catch(e){const c=await kv.get('tmp:smm:svc');if(c&&Array.isArray(c.items)&&c.items.length)items=c.items;else throw e}
 globalThis.__smms={t:Date.now(),v:items};return items}
export async function visible(cfgS){
 cfgS=cfgS||await getCfgS()
 return (await allServices()).filter(s=>!cfgS.off.includes(s.id)&&!cfgS.offPlat.includes(s.plat))}
export async function findService(id,cfgS){return (await visible(cfgS)).find(s=>s.id===+id)||null}

// ---------- harga ----------
// harga platform untuk qty unit = rate/1000 × qty × kurs × (1+markup%), dibulatkan ke atas
export function priceOf(s,qty,cfgS){
 const mk=cfgS.mkp&&cfgS.mkp[s.plat]!=null?+cfgS.mkp[s.plat]:+cfgS.markup
 let v=Math.ceil(s.rate*qty/1000*(+cfgS.kurs||1)*(1+mk/100)-1e-9)
 const st=+cfgS.round||1;if(st>1)v=Math.ceil(v/st)*st
 return Math.max(v,+cfgS.minPrice||0,s.rate>0?1:0)}
export const smmPct=a=>{const v=a&&a.smmPct;return v==null||v===''||isNaN(+v)?10:Math.min(100,Math.max(0,+v))}
// Pelanggan bot reseller membayar harga platform + markup % toko. Mode komisi: selisih = jatah reseller
// (cair saat order sukses). Mode mandiri: harga platform dipotong dari saldo stok reseller.
export async function priceFor(u,s,qty,cfgS){
 cfgS=cfgS||await getCfgS()
 const base=priceOf(s,qty,cfgS)
 if(!u||!u.rs)return {base,price:base,cut:0,stok:0}
 const RS=await import('./reseller'),a=await RS.getRs(u.rs),pct=smmPct(a),price=Math.ceil(base*(1+pct/100)),mand=RS.isMandiri(a)
 return {base,price,cut:mand?0:Math.max(0,price-base),stok:mand?base:0,pct,rs:a}}
// harga per 1000 untuk tampilan (platform, tanpa markup reseller; pemanggil bot menambah sendiri)
export const rate1k=(s,cfgS)=>priceOf(s,1000,cfgS)
export function pubService(s,cfgS,pct){
 let r=rate1k(s,cfgS);if(pct)r=Math.ceil(r*(1+pct/100))
 return {id:s.id,name:s.name,category:s.category,platform:s.plat,type:s.type,min:s.min,max:s.max,refill:s.refill,cancel:s.cancel,rate:r}}
export async function platforms(cfgS){
 const vis=await visible(cfgS),m=new Map()
 for(const s of vis){const e=m.get(s.plat)||{name:s.plat,n:0,from:Infinity};e.n++;e.from=Math.min(e.from,rate1k(s,cfgS));m.set(s.plat,e)}
 const order=[...PLAT.map(x=>x[0]),'Lainnya']
 return [...m.values()].sort((a,b)=>order.indexOf(a.name)-order.indexOf(b.name)).map(e=>({...e,...(PMETA[e.name]||PMETA.Lainnya)}))}

// ---------- status ----------
const MAP=[[/^(completed?|success|selesai|done)$/i,'success'],[/^partial$/i,'partial'],[/^(cancell?ed|refunded|failed|error|rejected|fail)$/i,'cancelled'],[/^(processing|in[ _-]?progress|running|active)$/i,'processing'],[/^(pending|new|waiting|queued|queue)$/i,'pending']]
export const mapSt=s=>{s=String(s||'').trim();for(const [re,v] of MAP)if(re.test(s))return v;return 'pending'}
const STD={pending:'Pending',processing:'In progress',success:'Completed',partial:'Partial',cancelled:'Canceled'}
export const FINAL=['success','partial','cancelled']
export const isFinal=o=>FINAL.includes(o.status)
export const ST_ID={pending:'Menunggu',processing:'Diproses',success:'Berhasil',partial:'Sebagian',cancelled:'Dibatalkan'}
const refillMap=s=>{s=String(s||'');return /complet|success|done/i.test(s)?'done':/reject|cancel|fail|error|ditolak/i.test(s)?'rejected':'wait'}
const findO=(u,id)=>(u.tx||[]).find(x=>x.type==='smm'&&x.id===String(id))

export function view(o,cfgS){
 const fin=isFinal(o),rf=o.refillSt?refillMap(o.refillSt):''
 return {orderId:o.id,serviceId:o.serviceId,serviceName:o.serviceName,category:o.category||'',platform:o.plat||'',link:o.link,quantity:o.qty,price:o.price,
  status:o.status,statusText:ST_ID[o.status]||o.status,providerStatus:o.provSt||'',startCount:o.start==null?null:o.start,remains:o.remains==null?null:o.remains,
  refunded:+o.refAmt||0,
  canRefill:!!(cfgS?cfgS.refill:true)&&!!o.canRefill&&['success','partial'].includes(o.status)&&rf!=='wait',
  canCancel:!!(cfgS?cfgS.cancel:true)&&!!o.canCancel&&!fin&&!o.cancelReq,
  cancelQueued:!!o.cancelReq&&!fin,
  refill:o.refillId?{id:o.refillId,status:rf==='done'?'completed':rf==='rejected'?'rejected':'pending',count:o.refillN||1}:null,
  createdAt:new Date(o.at).toISOString()}}

// ---------- refund aman (sekali per order, berkunci) ----------
async function refund(u,o,amt,note){
 amt=Math.max(0,Math.min(Math.round(+amt||0),+o.price||0))
 if(o.refunded)return 0
 if(!await kv.lock('smref:'+o.id,20000))return 0
 try{
  const f=await kv.get('u:'+u.id),fo=f&&findO(f,o.id)
  if(fo&&fo.refunded){o.refunded=true;o.refAmt=fo.refAmt;return 0}
  o.refunded=true;o.refAmt=amt
  if(amt>0)mut(u,amt,note||('Refund suntik '+o.id))
  await save(u);return amt}
 finally{await kv.unlock('smref:'+o.id)}}
async function rsBack(u,o,amt){
 try{if(!u.rs||!o.rsStok||!(amt>0))return
  const RS=await import('./reseller'),back=Math.min(o.rsStok,Math.round(o.rsStok*amt/Math.max(1,o.price)))
  if(back>0)await RS.stokAdd(u.rs,back,'Refund suntik '+o.id)}catch(e){}}
async function smmPayCut(u,o){
 try{if(!u||!u.rs||!(+o.rsPend>0)||o.rsPaid)return
  const RS=await import('./reseller')
  await RS.payCut(u.rs,'SM'+o.id,o.rsPend,'Suntik · '+String(o.serviceName||'').slice(0,40))
  o.rsPaid=1;o.rsCut=Math.round(+o.rsPend)}catch(e){}}

// ---------- terapkan status dari penyedia ke order (pemanggil menyimpan & mengumumkan) ----------
// Mengembalikan nama kejadian ('processing' | 'success' | 'partial' | 'cancelled') atau null.
async function applyStatus(u,o,p){
 if(isFinal(o)||!p)return null
 const st=mapSt(p.status)
 if(p.start_count!=null&&p.start_count!=='')o.start=+p.start_count||0
 if(p.remains!=null&&p.remains!=='')o.remains=+p.remains||0
 o.provSt=String(p.status||'');o.chk=Date.now()
 let ev=null
 if(st==='processing'&&o.status!=='processing'){o.status='processing';ev='processing'}
 else if(st==='success'){o.status='success';o.remains=0;ev='success';await smmPayCut(u,o)}
 else if(st==='partial'){
  const rem=Math.min(o.qty,Math.max(0,+o.remains||0)),amt=Math.floor(o.price*rem/Math.max(1,o.qty))
  o.status='partial';ev='partial'
  if(+o.rsPend>0)o.rsPend=Math.floor(o.rsPend*(o.qty-rem)/Math.max(1,o.qty))
  await refund(u,o,amt,'Refund suntik sebagian '+o.id);await rsBack(u,o,amt);await smmPayCut(u,o)}
 else if(st==='cancelled'){
  o.status='cancelled';ev='cancelled'
  await refund(u,o,o.price,'Refund suntik dibatalkan '+o.id);await rsBack(u,o,o.price)}
 if(ev){o.nf=[...(o.nf||[]),ev]}
 return ev}

// ---------- pengumuman: admin channel + DM Telegram + HP + channel reseller + webhook developer ----------
const EVT={
 created:{i:'🚀',t:'Order suntik sosmed baru',st:'pending',dm:'ORDER MASUK ANTREAN',note:'Pesanan masuk antrean penyedia, proses segera dimulai.'},
 processing:{i:'⚙️',t:'Suntik sedang diproses',st:'info',dm:'SEDANG DIPROSES',note:'Pesanan sedang dikerjakan penyedia.'},
 success:{i:'✅',t:'Suntik sosmed berhasil',st:'ok',dm:'SUNTIK BERHASIL',note:'Pesanan selesai.'},
 partial:{i:'🟠',t:'Suntik selesai sebagian',st:'warn',dm:'SELESAI SEBAGIAN',note:'Bagian yang tidak terkirim sudah dikembalikan ke saldo.'},
 cancelled:{i:'❌',t:'Suntik dibatalkan',st:'warn',dm:'PESANAN DIBATALKAN',note:'Saldo dikembalikan penuh.'},
 refill:{i:'🔁',t:'Refill diminta',st:'pending',dm:'REFILL DIMINTA',note:'Permintaan refill sudah dikirim ke penyedia.'},
 refill_done:{i:'🔁',t:'Refill selesai',st:'ok',dm:'REFILL SELESAI',note:'Isi ulang selesai dikerjakan.'},
 refill_rejected:{i:'⛔',t:'Refill ditolak',st:'warn',dm:'REFILL DITOLAK',note:'Penyedia menolak refill (mis. belum waktunya atau tidak ada yang turun).'}}
const hostOf=sec=>String((sec&&sec.SITE_URL)||'').replace(/^https?:\/\//,'').replace(/\/+$/,'')||'artapedia.id'
export const strukItem=(o,ev)=>({...o,orderId:o.id,createdAt:new Date(o.at).toISOString(),ev:ev||''})
function rowsFor(u,o,ev,forAdmin){
 const r=[]
 if(forAdmin)r.push(['Pengguna',mask(u.email)])
 r.push(['Layanan',o.serviceName],['Target',short(o.link)],['Jumlah',nf(o.qty)],['Harga',rp(o.price)])
 if(['success','partial'].includes(ev)&&o.start!=null)r.push(['Jumlah awal',nf(o.start)])
 if(ev==='partial')r.push(['Terkirim',nf(Math.max(0,o.qty-(+o.remains||0)))],['Sisa (di-refund)',nf(o.remains)])
 if(['partial','cancelled'].includes(ev))r.push(['Refund',rp(o.refAmt||0)],['Saldo sekarang',rp(u.balance)])
 if(ev.startsWith('refill')&&o.refillId)r.push(['ID Refill',o.refillId])
 if(forAdmin&&ev==='created')r.push(['Saldo sekarang',rp(u.balance)])
 return r}
export async function announce(u,o,ev){
 const m=EVT[ev];if(!m)return
 const sec=await getSec().catch(()=>({})),host=hostOf(sec)
 let png=null;try{png=await strukPng(strukItem(o,ev),'smm',host)}catch(e){}
 const name='struk-'+o.id+'.png',viaBot=o.via==='telegram'
 const jobs=[]
 // 1) channel admin
 jobs.push((async()=>{
  let extra=[];try{if(u.rs){const RS=await import('./reseller');extra=await RS.rows(u.rs)}}catch(e){}
  const rows=[...rowsFor(u,o,ev,true),...extra]
  await notify({...(viaBot?{src:'bot'}:{}),photo:png,photoName:name,i:m.i,t:m.t+(u.rs?' (reseller)':''),st:m.st,id:['ID Order',o.id],rows,note:m.note})})())
 // 2) DM Telegram pemilik akun
 jobs.push((async()=>{
  const L='━━━━━━━━━━━━━━━━━━'
  const body=rowsFor(u,o,ev,false).map(([k,v])=>`▫️ ${esc(k)}  <b>${esc(v)}</b>`).join('\n')
  await pushUser(u,`<b>${m.i} ${esc(m.dm)}</b>\n${L}\n${body}\n🆔 <code>${esc(o.id)}</code>\n${L}\n<i>${esc(m.note)}</i>`,null,png)})())
 // 3) notifikasi HP (web push)
 jobs.push(webPush(keyUser(u.id),{t:m.i+' '+m.t.replace(/^\S+\s/,''),b:(o.serviceName||'').slice(0,60)+' · '+nf(o.qty),u:'/suntik',tag:'smm-'+o.id+'-'+ev,ring:1}))
 // 4) channel milik reseller (bahasa toko untuk mata uang)
 if(u.rs)jobs.push((async()=>{
  const RS=await import('./reseller'),a=await RS.getRs(u.rs),{pack}=await import('./rslang'),P=pack(a)
  const rows=rowsFor(u,o,ev,false).map(([k,v])=>[k,k==='Harga'?P.rp(o.price):k==='Refund'?P.rp(o.refAmt||0):v])
  let pg=png;try{if((a.lang||'id')!=='id')pg=await strukPng(strukItem(o,ev),'smm','artapedia.id',P)}catch(e){}
  rows.push(['ID',o.id],...(+o.rsPend>0&&ev==='success'?[['Untung toko',P.rp(o.rsPend)]]:[]))
  await RS.chNotify(u.rs,RS.card(m.i,m.t,rows,m.note),null,pg,name)})())
 // 5) webhook developer
 jobs.push((async()=>{if(u.hook&&u.hook.on&&u.hook.url)await deliver(u,'smm.'+ev,{order_id:o.id,event:ev,status:o.status,service_id:o.serviceId,service:o.serviceName,link:o.link,quantity:o.qty,price:o.price,start_count:o.start,remains:o.remains,refunded:+o.refAmt||0,refill_id:o.refillId||null,created_at:new Date(o.at).toISOString()})})())
 await Promise.allSettled(jobs)
 await logPush(u,o)}
// log ringkas untuk panel admin (150 terakhir)
async function logPush(u,o){
 try{const l=(await kv.get('smmlog'))||[],e={id:o.id,uid:u.id,em:mask(u.email),s:String(o.serviceName||'').slice(0,60),p:o.price,q:o.qty,st:o.status,via:o.via||'web',at:o.at,up:Date.now()}
  const i=l.findIndex(x=>x.id===o.id);if(i>=0)l[i]=e;else l.unshift(e)
  await kv.set('smmlog',l.slice(0,150))}catch(e){}}

// ---------- daftar order yang masih perlu dipantau ----------
const PEND='smmpend',RFP='smmrfp'
const pendAdd=(uid,id)=>kv.sadd(PEND,uid+'|'+id)
const pendRm=(uid,id)=>kv.srem(PEND,uid+'|'+id)

// ---------- buat order ----------
export async function placeOrder(u0,x){
 const cfgS=await getCfgS(),g=await getCfg()
 if(!cfgS.on)throw new SmmError('Layanan suntik sosmed sedang dimatikan admin.','off',503)
 if(g.maint&&g.maint.on)throw new SmmError(g.maint.msg||'Situs sedang maintenance, pesanan baru dihentikan sementara.','maint',503)
 const sec=await getSec();if(!sec.SMM_KEY)throw new SmmError(NOKEY,'nokey',503)
 const s=await findService(x.serviceId,cfgS)
 if(!s)throw new SmmError('Layanan tidak ditemukan atau sedang tidak tersedia.','nosvc',404)
 const link=String(x.link||'').trim()
 if(link.length<3||link.length>500||/\s/.test(link)||/^(javascript|data|file):/i.test(link))throw new SmmError('Link / username target tidak valid (tanpa spasi).','link')
 let qty,comments=''
 if(s.type==='comments'){
  comments=String(x.comments||'').split(/\r?\n/).map(t=>t.trim()).filter(Boolean).join('\n')
  if(comments.length>20000)throw new SmmError('Komentar terlalu panjang.','qty')
  qty=comments?comments.split('\n').length:0}
 else qty=Math.floor(+x.quantity)
 if(!(qty>=s.min)||qty>s.max)throw new SmmError('Jumlah harus antara '+nf(s.min)+' – '+nf(s.max)+'.','qty')
 if(!await kv.lock('smm:ord:'+u0.id,30000))throw new SmmError('Pesanan sebelumnya masih diproses, tunggu sebentar lalu coba lagi.','busy',429)
 try{
  if(!await kv.lock('smm:dup:'+u0.id+':'+s.id+':'+link,10000))throw new SmmError('Pesanan yang sama baru saja dikirim. Tunggu sebentar sebelum mengulang.','dup',429)
  const f=(await kv.get('u:'+u0.id))||u0
  if(f.banned)throw new SmmError('Akun ditangguhkan.','ban',403)
  const pr=await priceFor(f,s,qty,cfgS)
  if(f.balance<pr.price)throw new SmmError('Saldo tidak cukup. Butuh '+rp(pr.price)+', saldo kamu '+rp(f.balance)+'.','saldo',402)
  const RS=pr.stok>0?await import('./reseller'):null
  if(pr.stok>0){const fresh=await RS.getRs(f.rs);if((+fresh.stok||0)<pr.stok)throw new SmmError('Stok toko sedang habis. Hubungi pemilik toko.','stok',503)}
  const rec={type:'smm',id:'T'+rid().slice(0,10),pid:null,serviceId:s.id,serviceName:s.name,category:s.category,plat:s.plat,link,qty,price:pr.price,status:'pending',provSt:'',
   start:null,remains:null,refunded:false,refAmt:0,canRefill:!!s.refill,canCancel:!!s.cancel,at:Date.now(),via:x.via||'web',nf:[],
   ...(pr.cut>0?{rsPend:pr.cut}:{}),...(pr.stok>0?{rsStok:pr.stok}:{})}
  // 1) potong saldo dulu (dan stok toko untuk mode mandiri)
  if(pr.stok>0){const ok=await RS.stokUse(f.rs,pr.stok,'Suntik · '+s.name.slice(0,40)).catch(()=>false);if(!ok)throw new SmmError('Stok toko sedang habis. Hubungi pemilik toko.','stok',503)}
  mut(f,-pr.price,'Suntik sosmed · '+s.name.slice(0,40))
  f.tx.unshift(rec)
  try{await save(f)}catch(e){if(pr.stok>0)await RS.stokAdd(f.rs,pr.stok,'Batal suntik').catch(()=>{});throw new SmmError('Gagal menyimpan pesanan. Saldo tidak terpotong, silakan coba lagi.','db',503)}
  // 2) kirim ke penyedia
  let pid=0
  try{
   const d=await prov({action:'add',service:s.id,link,...(s.type==='comments'?{comments}:{quantity:qty})})
   pid=+(d&&d.order);if(!pid)throw new SmmError('Penyedia tidak mengembalikan ID order','prov',502)}
  catch(e){
   const cur=findO(f,rec.id)||rec;cur.status='cancelled';cur.failed=1
   await refund(f,cur,pr.price,'Refund suntik gagal');await rsBack(f,cur,pr.price);await save(f).catch(()=>{})
   if(isRestock(e.message)){
    if(await kv.lock('restock:smm',30*60000))notify({i:'📦',t:'Saldo penyedia SUNTIK SOSMED habis, perlu top up',st:'warn',rows:[['Penyedia','micypedia.id'],['Pesan',String(e.message).slice(0,160)]],note:'Pembeli melihat: '+RESTOK_MSG}).catch(()=>{})
    throw new SmmError(RESTOK_MSG,'restock',503)}
   throw new SmmError(String(e.message||'Gagal mengirim pesanan ke penyedia').slice(0,200),'prov',e.status||502)}
  // 3) catat ID penyedia
  const cur=findO(f,rec.id)||rec
  cur.pid=pid;cur.id=String(pid);cur.provSt='Pending'
  await kv.set('smo:'+pid,f.id);await pendAdd(f.id,cur.id)
  for(let i=0;i<3;i++){try{await save(f);break}catch(e){if(i===2)throw e}}
  cur.nf=[...(cur.nf||[]),'created']
  await save(f).catch(()=>{})
  announce(f,cur,'created').catch(()=>{})
  return {order:cur,user:f,view:view(cur,cfgS)}}
 finally{await kv.unlock('smm:ord:'+u0.id)}}

// ---------- cek status satu order (berkunci, aman dari cron + web bersamaan) ----------
export async function refreshOrder(uid,oid,{force}={}){
 if(!await kv.lock('smst:'+oid,15000)){const u=await kv.get('u:'+uid);return {u,o:u&&findO(u,oid),ev:null}}
 let u,o,ev=null
 try{
  u=await kv.get('u:'+uid);o=u&&findO(u,oid);if(!o)return {u,o:null,ev:null}
  if(isFinal(o))return {u,o,ev:null}
  if(!o.pid){
   // tersangkut tanpa ID penyedia (proses terputus): refund otomatis setelah 10 menit
   if(Date.now()-o.at>10*60000){o.status='cancelled';o.failed=1;o.nf=[...(o.nf||[]),'cancelled'];await refund(u,o,o.price,'Refund suntik gagal');await rsBack(u,o,o.price);await save(u);ev='cancelled'}
   return {u,o,ev}}
  if(!force&&o.chk&&Date.now()-o.chk<5000)return {u,o,ev:null}
  const d=await prov({action:'status',order:o.pid})
  ev=await applyStatus(u,o,d)
  if(!ev)o.chk=Date.now()
  await save(u)}
 finally{await kv.unlock('smst:'+oid)}
 if(ev){if(isFinal(o))await pendRm(uid,oid);await announce(u,o,ev).catch(()=>{})}
 return {u,o,ev}}

// ---------- refill ----------
export async function requestRefill(u0,oid){
 const cfgS=await getCfgS()
 if(!cfgS.refill)throw new SmmError('Refill dimatikan admin.','off',403)
 if(!await kv.lock('smrf:'+oid,15000))throw new SmmError('Permintaan refill sedang diproses.','busy',429)
 let u,o
 try{
  u=await kv.get('u:'+u0.id);o=u&&findO(u,oid)
  if(!o)throw new SmmError('Pesanan tidak ditemukan.','404',404)
  if(!o.canRefill)throw new SmmError('Layanan ini tidak mendukung refill.','norefill')
  if(!['success','partial'].includes(o.status))throw new SmmError('Refill hanya untuk pesanan yang sudah selesai.','state')
  if(o.refillSt&&refillMap(o.refillSt)==='wait')throw new SmmError('Refill sebelumnya masih diproses penyedia.','wait')
  if(o.refillAt&&Date.now()-o.refillAt<60000)throw new SmmError('Tunggu semenit sebelum meminta refill lagi.','rate',429)
  const d=await prov({action:'refill',order:o.pid})
  const r=Array.isArray(d)?d[0]:d,id=r&&(r.refill&&r.refill.error?null:r.refill)
  if(!id)throw new SmmError(String((r&&r.refill&&r.refill.error)||(r&&r.error)||'Penyedia menolak refill (mungkin belum waktunya).').slice(0,200),'prov',502)
  o.refillId=String(id);o.refillSt='Pending';o.refillAt=Date.now();o.refillN=(o.refillN||0)+1
  o.nf=[...(o.nf||[]),'refill:'+o.refillId]
  await kv.set('smr:'+o.refillId,{u:u.id,o:o.id});await kv.sadd(RFP,u.id+'|'+o.id)
  await save(u)}
 finally{await kv.unlock('smrf:'+oid)}
 announce(u,o,'refill').catch(()=>{})
 return {u,o,view:view(o,cfgS)}}
// status refill: dipakai cron dan tombol cek
async function applyRefill(u,o,st){
 const k=refillMap(st);if(k==='wait')return null
 o.refillSt=k==='done'?'Completed':'Rejected'
 const key=(k==='done'?'refill_done:':'refill_rejected:')+o.refillId
 if((o.nf||[]).includes(key))return null
 o.nf=[...(o.nf||[]),key];return k==='done'?'refill_done':'refill_rejected'}
export async function refreshRefill(uid,oid){
 const u=await kv.get('u:'+uid),o=u&&findO(u,oid)
 if(!o||!o.refillId||refillMap(o.refillSt)!=='wait')return {u,o,ev:null}
 const d=await prov({action:'refill_status',refill:o.refillId}),ev=await applyRefill(u,o,d&&d.status&&d.status.error?'Pending':(d&&d.status))
 if(ev){await save(u);await kv.srem(RFP,uid+'|'+oid);await announce(u,o,ev).catch(()=>{})}
 return {u,o,ev}}

// ---------- batalkan ----------
export async function requestCancel(u0,oid){
 const cfgS=await getCfgS()
 if(!cfgS.cancel)throw new SmmError('Pembatalan dimatikan admin.','off',403)
 const u=await kv.get('u:'+u0.id),o=u&&findO(u,oid)
 if(!o)throw new SmmError('Pesanan tidak ditemukan.','404',404)
 if(isFinal(o))throw new SmmError('Pesanan ini sudah selesai / dibatalkan.','state',409)
 if(!o.canCancel)throw new SmmError('Layanan ini tidak mendukung pembatalan.','nocancel')
 if(!o.pid)throw new SmmError('Pesanan masih dikirim ke penyedia, coba sebentar lagi.','busy')
 if(o.cancelReq&&Date.now()-o.cancelReq<60000)throw new SmmError('Permintaan pembatalan sudah dikirim, menunggu penyedia.','wait')
 const d=await prov({action:'cancel',orders:String(o.pid)}),r=Array.isArray(d)?d[0]:d
 const bad=!r||r.error||(r.cancel&&typeof r.cancel==='object'&&r.cancel.error)
 if(bad)throw new SmmError(String((r&&(r.error||(r.cancel&&r.cancel.error)))||'Penyedia menolak pembatalan (pesanan sudah berjalan).').slice(0,200),'prov',502)
 const f=await kv.get('u:'+u.id),fo=findO(f,oid);if(fo){fo.cancelReq=Date.now();await save(f)}
 const rr=await refreshOrder(u.id,oid,{force:true})
 return {...rr,view:rr.o?view(rr.o,cfgS):null}}

// ---------- sinkron massal (dipanggil cron tiap menit) ----------
export async function sync(deadline){
 const list=(await kv.get(PEND))||[];let n=0,ev=0,err=0
 const items=list.map(e=>{const [uid,id]=String(e).split('|');return {uid,id,e}}).filter(x=>x.uid&&x.id)
 const users=new Map()
 for(let i=0;i<items.length&&Date.now()<deadline;i+=100){
  const chunk=items.slice(i,i+100),pids=[]
  for(const it of chunk){
   let u=users.get(it.uid);if(!u){u=await kv.get('u:'+it.uid);users.set(it.uid,u)}
   const o=u&&findO(u,it.id)
   if(!o||isFinal(o)){await kv.srem(PEND,it.e);continue}
   it.o=o;if(o.pid)pids.push(o.pid)}
  let map={}
  if(pids.length){try{const d=await prov({action:'status',orders:pids.join(',')},25000);if(d&&!Array.isArray(d))map=d}catch(e){err++}}
  for(const it of chunk){
   if(!it.o||Date.now()>deadline)continue
   const p=it.o.pid?map[String(it.o.pid)]:null
   try{
    if(p&&!p.error){
     if(!await kv.lock('smst:'+it.id,15000))continue
     let u,o,e1=null
     try{u=await kv.get('u:'+it.uid);o=u&&findO(u,it.id);if(!o||isFinal(o))continue
      e1=await applyStatus(u,o,p);await save(u)}
     finally{await kv.unlock('smst:'+it.id)}
     n++
     if(e1){ev++;if(isFinal(o))await kv.srem(PEND,it.e);await announce(u,o,e1).catch(()=>{})}}
    else if(!it.o.pid){const r=await refreshOrder(it.uid,it.id);if(r.ev){ev++;n++}}}
   catch(e){err++}}}
 // refill
 const rl=(await kv.get(RFP))||[];let rf=0
 const rit=rl.map(e=>{const [uid,id]=String(e).split('|');return {uid,id,e}}).filter(x=>x.uid&&x.id)
 for(let i=0;i<rit.length&&Date.now()<deadline;i+=30){
  await Promise.all(rit.slice(i,i+30).map(async it=>{
   try{const u=await kv.get('u:'+it.uid),o=u&&findO(u,it.id)
    if(!o||!o.refillId||refillMap(o.refillSt)!=='wait'){await kv.srem(RFP,it.e);return}
    const r=await refreshRefill(it.uid,it.id);if(r.ev)rf++}catch(e){err++}}))}
 return {checked:items.length,updated:n,events:ev,refills:rf,errors:err}}

// ---------- daftar & pencarian ----------
export const listFor=(u,{limit=50,page=1}={})=>{
 const all=(u.tx||[]).filter(x=>x.type==='smm'),lim=Math.min(Math.max(1,+limit||50),100),pg=Math.max(1,+page||1)
 return {page:pg,limit:lim,total:all.length,items:all.slice((pg-1)*lim,pg*lim)}}
export const findOrder=findO

// ===========================================================================
// API PUBLIK ala panel SMM: POST /api/smm/v2  (key, action, ...). Sama dengan format penyedia,
// jadi bisa dipasang sebagai "penyedia API" di panel SMM lain. key = API key akun Artapedia.
// ===========================================================================
const E2=(m,s=400)=>({status:s,body:{error:m}})
export async function v2(params,req){
 const a=String(params.action||'').toLowerCase(),key=String(params.key||'')
 if(!key)return E2('Incorrect API key',401)
 const id=await kv.get('k:'+key),u=id&&await kv.get('u:'+id)
 if(!u)return E2('Incorrect API key',401)
 if(u.banned)return E2('Account suspended',403)
 const w=Array.isArray(u.ipw)?u.ipw:[]
 if(w.length&&!w.includes(normIp(clientIp(req))))return E2('IP not whitelisted',403)
 const mn=Math.floor(Date.now()/60000),n=await kv.incr('rl:'+u.id+':smm:'+mn)
 if(n>120)return E2('Rate limit exceeded',429)
 const cfgS=await getCfgS()
 try{
  if(a==='services'){
   const vis=await visible(cfgS),pct=u.rs?smmPct(await (await import('./reseller')).getRs(u.rs)):0
   return {status:200,body:vis.map(s=>{const p=pubService(s,cfgS,pct);return {service:p.id,name:p.name,type:s.type==='comments'?'Custom Comments':'Default',category:p.category,rate:String(p.rate),min:String(p.min),max:String(p.max),refill:p.refill,cancel:p.cancel}})}}
  if(a==='balance')return {status:200,body:{balance:String(u.balance),currency:'IDR'}}
  if(a==='add'){
   if(await kv.incr('rl:'+u.id+':smmadd:'+mn)>30)return E2('Rate limit exceeded',429)
   const r=await placeOrder(u,{serviceId:params.service,link:params.link,quantity:params.quantity,comments:params.comments,via:'api'})
   return {status:200,body:{order:r.order.pid}}}
  const own=async pid=>{const uid=await kv.get('smo:'+pid);if(uid!==u.id)return null;const f=await kv.get('u:'+u.id);return f&&(f.tx||[]).find(x=>x.type==='smm'&&String(x.pid)===String(pid))||null}
  const stat=async pid=>{
   const o0=await own(pid);if(!o0)return {error:'Incorrect order ID'}
   const r=await refreshOrder(u.id,o0.id),o=(r.o)||o0
   return {charge:String(o.price),start_count:String(o.start==null?0:o.start),status:STD[o.status]||'Pending',remains:String(o.remains==null?o.qty:o.remains),currency:'IDR'}}
  const ids=v=>String(v||'').split(',').map(x=>x.trim()).filter(Boolean).slice(0,100)
  if(a==='status'){
   if(params.orders){const out={};for(const pid of ids(params.orders))out[pid]=await stat(pid);return {status:200,body:out}}
   const r=await stat(params.order);return r.error?E2(r.error,404):{status:200,body:r}}
  if(a==='refill'){
   const one=async pid=>{const o=await own(pid);if(!o)return {error:'Incorrect order ID'}
    try{const r=await requestRefill(u,o.id);return {refill:String(r.o.refillId)}}catch(e){return {error:e.message}}}
   if(params.orders)return {status:200,body:await Promise.all(ids(params.orders).map(async pid=>{const r=await one(pid);return {order:+pid,refill:r.error?{error:r.error}:+r.refill}}))}
   const r=await one(params.order);return r.error?E2(r.error):{status:200,body:r}}
  if(a==='refill_status'){
   const one=async rid2=>{const m=await kv.get('smr:'+rid2);if(!m||m.u!==u.id)return {error:'Refill not found'}
    await refreshRefill(m.u,m.o).catch(()=>{});const f=await kv.get('u:'+u.id),o=f&&findO(f,m.o)
    const k=o&&o.refillId===String(rid2)?refillMap(o.refillSt):'wait'
    return {status:k==='done'?'Completed':k==='rejected'?'Rejected':'Pending'}}
   if(params.refills)return {status:200,body:await Promise.all(ids(params.refills).map(async x=>{const r=await one(x);return {refill:+x,status:r.error?{error:r.error}:r.status}}))}
   const r=await one(params.refill);return r.error?E2(r.error,404):{status:200,body:r}}
  if(a==='cancel'){
   const out=[]
   for(const pid of ids(params.orders)){
    const o=await own(pid)
    if(!o){out.push({order:+pid,cancel:{error:'Incorrect order ID'}});continue}
    try{await requestCancel(u,o.id);out.push({order:+pid,cancel:1})}catch(e){out.push({order:+pid,cancel:{error:e.message}})}}
   return {status:200,body:out}}
  return E2('Incorrect action',400)}
 catch(e){return E2(e.message||'Server error',e.status||400)}}

// ===========================================================================
// ADMIN (dipanggil dari /api/admin/smm/*)
// ===========================================================================
export async function adminApi(a,b){
 b=b||{}
 if(a==='config'){
  const sec=await getSec(),cfg=await getCfgS(),log=(await kv.get('smmlog'))||[]
  let balance=null,berr='';if(sec.SMM_KEY){try{balance=await providerBalance()}catch(e){berr=e.message}}
  return {cfg,hasKey:!!sec.SMM_KEY,balance,balanceError:berr,log:log.slice(0,60),
   stats:{total:log.length,sukses:log.filter(x=>x.st==='success').length,proses:log.filter(x=>['pending','processing'].includes(x.st)).length,batal:log.filter(x=>x.st==='cancelled').length,omzet:log.filter(x=>['success','partial'].includes(x.st)).reduce((s,x)=>s+(+x.p||0),0)}}}
 if(a==='save'){return {ok:1,cfg:await saveCfgS(b)}}
 if(a==='services'){
  const cfg=await getCfgS(),all=await allServices(!!b.force)
  return {items:all.map(s=>({id:s.id,name:s.name,category:s.category,platform:s.plat,type:s.type,rate:s.rate,min:s.min,max:s.max,refill:s.refill,cancel:s.cancel,price1k:rate1k(s,cfg),on:!cfg.off.includes(s.id)&&!cfg.offPlat.includes(s.plat)})),platforms:[...new Set(all.map(s=>s.plat))]}}
 if(a==='sync'){return {ok:1,...await sync(Date.now()+40000)}}
 if(a==='order/sync'||a==='order/refund'){
  const pid=String(b.order||'').trim(),uid=pid&&await kv.get('smo:'+pid);if(!uid)throw new SmmError('Order tidak ditemukan','404',404)
  const u=await kv.get('u:'+uid),o=u&&(u.tx||[]).find(x=>x.type==='smm'&&String(x.pid)===pid);if(!o)throw new SmmError('Order tidak ditemukan','404',404)
  if(a==='order/sync'){const r=await refreshOrder(uid,o.id,{force:true});return {ok:1,status:r.o&&r.o.status,event:r.ev}}
  if(isFinal(o)&&o.refunded)throw new SmmError('Order ini sudah final dan sudah di-refund')
  if(!await kv.lock('smst:'+o.id,15000))throw new SmmError('Order sedang diproses, coba lagi')
  try{
   const f=await kv.get('u:'+uid),fo=findO(f,o.id)
   if(fo.status==='success'&&!b.force)throw new SmmError('Order sudah berhasil. Centang paksa untuk tetap refund.')
   fo.status='cancelled';fo.nf=[...(fo.nf||[]),'cancelled']
   const amt=await refund(f,fo,fo.price,'Refund suntik oleh admin '+fo.id);await rsBack(f,fo,amt);await save(f);await kv.srem(PEND,uid+'|'+o.id)
   await announce(f,fo,'cancelled').catch(()=>{});return {ok:1,refund:amt}}
  finally{await kv.unlock('smst:'+o.id)}}
 throw new SmmError('Perintah tidak dikenal','404',404)}

// fitur tampil (tombol web / bot) hanya kalau admin menyalakan DAN API key penyedia sudah diisi
export const enabled=async sec=>{try{const s=sec||await getSec();return !!(s.SMM_KEY&&(await getCfgS()).on)}catch(e){return false}}
