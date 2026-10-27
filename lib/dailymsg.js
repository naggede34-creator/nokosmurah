// ===========================================================================
// PESAN OTOMATIS HARIAN ke SEMUA pengguna di SEMUA bot (bot utama, bot tambahan, reseller tanpa modal, reseller stok mandiri).
// Memakai mesin broadcast-semua-bot (lib/bcall.js), jadi tiap pengguna menerima lewat bot tempat dia terdaftar.
// Empat slot: pagi · siang · menjelang Magrib (otomatis mengikuti jadwal Magrib kota) · malam.
// Isi: sapaan + semangat (bergilir, tidak monoton), jadwal Magrib hari ini, ajakan Order Nokos / Suntik Sosmed.
// Dikirim sekali per slot per hari; dijalankan oleh /api/cron tiap menit (jendela 90 menit kalau cron sempat telat).
// ===========================================================================
import {kv} from './db'
import {getCfg} from './bonus'
import {maghrib,CITIES} from './prayer'
import * as BCA from './bcall'
import * as SMM from './smm'

export const DM_DEF={on:false,city:'Jakarta',targets:{main:true,komisi:true,mandiri:true},
 slots:[{id:'pagi',label:'Pagi',on:true,at:'06:30',custom:''},{id:'siang',label:'Siang',on:true,at:'12:00',custom:''},
  {id:'magrib',label:'Menjelang Magrib',on:true,offset:15,custom:''},{id:'malam',label:'Malam',on:true,at:'19:30',custom:''}]}
const hhmmOk=t=>/^([01]\d|2[0-3]):[0-5]\d$/.test(String(t||''))
export const normDm=c=>{c=c||{};const d=DM_DEF
 return {on:!!c.on,city:CITIES[c.city]?c.city:d.city,targets:BCA.normTargets(c.targets),
  slots:d.slots.map(s=>{const x=(c.slots||[]).find(y=>y&&y.id===s.id)||{}
   return {id:s.id,label:s.label,on:x.on==null?s.on:!!x.on,
    ...(s.id==='magrib'?{offset:Math.min(120,Math.max(0,Math.round(+x.offset>=0?+x.offset:s.offset)))}:{at:hhmmOk(x.at)?x.at:s.at}),
    custom:String(x.custom||'').slice(0,1500)}})}}
export const getDm=async()=>normDm(await kv.get('dmcfg'))
export async function saveDm(b){
 const n=normDm(b);if(b&&b.city&&!CITIES[b.city])throw Error('Kota tidak dikenal')
 for(const s of (b&&b.slots)||[])if(s&&s.at&&!hhmmOk(s.at))throw Error('Jam '+s.at+' tidak valid (format 06:30)')
 if(n.on&&!n.targets.main&&!n.targets.komisi&&!n.targets.mandiri)throw Error('Pilih minimal satu kelompok penerima')
 await kv.set('dmcfg',n);return n}

// ---------- isi pesan ----------
const SALAM={
 pagi:['🌅 <b>Selamat pagi!</b>\nHari baru, semangat baru. Kerjakan satu hal kecil dulu, sisanya ikut lancar. 💪',
  '☀️ <b>Pagi yang cerah!</b>\nRezeki datang buat yang mau bergerak. Yuk mulai harimu dengan senyum.',
  '🌤 <b>Selamat pagi, sobat!</b>\nTarget besar dimulai dari langkah pertama hari ini. Gaspol!',
  '🌄 <b>Good morning!</b>\nJangan tunggu sempurna untuk mulai. Mulai dulu, sempurnakan sambil jalan.',
  '☕ <b>Selamat pagi!</b>\nSeruput kopinya, tarik napas, lalu kerjakan yang paling penting dulu.'],
 siang:['🌞 <b>Selamat siang!</b>\nSetengah hari sudah terlewati, kamu hebat sudah sejauh ini. Lanjut, semangat! 💪',
  '🍽 <b>Selamat siang!</b>\nIstirahat sebentar, isi tenaga, lalu lanjut berkarya.',
  '⚡ <b>Siang!</b>\nEnergi turun? Itu tanda butuh jeda, bukan menyerah. Semangat!',
  '🌤 <b>Siang yang produktif!</b>\nSedikit lagi, hasilnya akan terasa. Jangan kendor!',
  '🔥 <b>Semangat siang!</b>\nHari masih panjang, kesempatan masih banyak.'],
 magrib:['🌇 <b>Menjelang Magrib</b>\nSebentar lagi waktu Magrib. Yuk rehat sejenak dan bersiap beribadah bagi yang menjalankan. 🤲',
  '🕌 <b>Sebentar lagi Magrib</b>\nTutup aktivitas sejenak, semoga hari ini penuh berkah.',
  '🌆 <b>Senja tiba</b>\nSyukuri hari ini, apa pun hasilnya. Besok kita gas lagi.',
  '🤲 <b>Waktu Magrib mendekat</b>\nBerhenti sebentar, tenangkan hati, lalu lanjutkan dengan semangat baru.',
  '🌅 <b>Selamat sore!</b>\nHari hampir selesai, kamu sudah berusaha dengan baik.'],
 malam:['🌙 <b>Selamat malam!</b>\nTerima kasih sudah berjuang hari ini. Istirahat yang cukup, besok kita lanjut. ✨',
  '⭐ <b>Malam yang tenang</b>\nApa pun hasilnya hari ini, kamu sudah melakukan yang terbaik.',
  '🌃 <b>Selamat malam, semangat terus!</b>\nTidur yang cukup adalah investasi untuk hari esok.',
  '🛌 <b>Selamat beristirahat</b>\nTutup hari dengan syukur, bangun dengan semangat.',
  '🌌 <b>Malam!</b>\nBesok adalah kesempatan baru. Siapkan energi terbaikmu.']}
const AJAK_SMM=[
 '🛍 Butuh nomor OTP? <b>Order Nokos</b> ada di menu bot ini.\n🚀 Mau akun sosmed makin ramai? Coba <b>Suntik Sosmed</b>: followers, likes, views.',
 'Kebutuhan nomor virtual dan booster sosmed? Semua ada di menu bot ini:\n🛍 <b>Order Nokos</b>  ·  🚀 <b>Suntik Sosmed</b>\nTekan /start untuk membuka menu.',
 '🚀 <b>Suntik Sosmed</b> siap bantu akunmu naik daun, dan 🛍 <b>Order Nokos</b> siap kapan saja kamu butuh OTP. Cek menu bot ini sekarang!',
 'Mau bikin akun sosmed lebih ramai? 🚀 <b>Suntik Sosmed</b>. Butuh nomor untuk verifikasi? 🛍 <b>Order Nokos</b>. Dua-duanya ada di menu bot ini.']
const AJAK_NOKOS=[
 '🛍 Butuh nomor OTP? <b>Order Nokos</b> ada di menu bot ini. Tekan /start untuk membuka menu.',
 'Perlu nomor virtual untuk verifikasi? 🛍 <b>Order Nokos</b> siap kapan saja. Cek menu bot ini!',
 '🛍 <b>Order Nokos</b> cepat dan praktis, tinggal pilih aplikasi dan negara di menu bot ini.']
const dayIdx=ms=>Math.floor((ms+7*36e5)/864e5)
const wibYMD=ms=>{const w=new Date(ms+7*36e5);return {Y:w.getUTCFullYear(),M:w.getUTCMonth(),D:w.getUTCDate()}}
const esc=t=>String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
export const BULAN=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']
export const HARI=['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu']
export async function build(slot,cfg,now=Date.now()){
 const {Y,M,D}=wibYMD(now),mg=maghrib(Y,M,D,cfg.city),di=dayIdx(now),smm=await SMM.enabled().catch(()=>false)
 const tgl=`${HARI[new Date(now+7*36e5).getUTCDay()]}, ${D} ${BULAN[M]} ${Y}`
 const ctx={magrib:mg?mg.hhmm:'-',zona:mg?mg.zona:'WIB',kota:cfg.city,tanggal:tgl}
 const sub=t=>t.replace(/\{(magrib|zona|kota|tanggal)\}/g,(_,k)=>esc(ctx[k]))
 if(slot.custom&&slot.custom.trim())return sub(slot.custom.trim()).slice(0,3800)
 const sal=SALAM[slot.id]||SALAM.pagi,off=slot.id==='magrib'?1:0
 const ajak=(smm?AJAK_SMM:AJAK_NOKOS)
 const pray=mg?`🕌 Jadwal Magrib hari ini: <b>${ctx.magrib} ${ctx.zona}</b> <i>(wilayah ${esc(cfg.city)}, daerah lain bisa selisih beberapa menit)</i>`:''
 return [sal[(di+off)%sal.length],pray,ajak[(di*3+slot.id.length)%ajak.length],`<i>${esc(tgl)}</i>`].filter(Boolean).join('\n\n')}

// ---------- penjadwalan ----------
export function targetOf(slot,cfg,now=Date.now()){
 const {Y,M,D}=wibYMD(now)
 if(slot.id==='magrib'){const m=maghrib(Y,M,D,cfg.city);return m?m.ms-(slot.offset||0)*60000:null}
 const [h,mi]=String(slot.at).split(':').map(Number)
 return Date.UTC(Y,M,D,h,mi)-7*36e5}
const LAST='dm:last',LOG='dm:log',WINDOW=90*60000
const logAdd=async e=>{try{const l=(await kv.get(LOG))||[];l.unshift({at:Date.now(),...e});await kv.set(LOG,l.slice(0,30))}catch(x){}}
// dipanggil cron tiap menit
export async function tick(now=Date.now()){
 const cfg=await getDm();if(!cfg.on)return {skipped:'off'}
 const g=await getCfg();if(g.maint&&g.maint.on)return {skipped:'maintenance'}
 const {Y,M,D}=wibYMD(now),ymd=`${Y}-${M+1}-${D}`,last=(await kv.get(LAST))||{}
 for(const s of cfg.slots){
  if(!s.on||last[s.id]===ymd)continue
  const t=targetOf(s,cfg,now);if(!t||now<t||now>t+WINDOW)continue
  try{const text=await build(s,cfg,now),job=await BCA.startAll({text,pin:false,by:0,targets:cfg.targets})
   last[s.id]=ymd;await kv.set(LAST,last);await logAdd({slot:s.id,ok:1,job:job.id,text:text.replace(/<[^>]+>/g,'').slice(0,140)});return {sent:s.id,job:job.id}}
  catch(e){
   if(/Masih ada broadcast/.test(e.message))return {waiting:s.id}          // coba lagi menit berikutnya
   last[s.id]=ymd;await kv.set(LAST,last);await logAdd({slot:s.id,ok:0,err:String(e.message).slice(0,160)});return {error:e.message}}}
 return {idle:true}}

// ---------- API admin (/api/admin/dm/*) ----------
export async function adminApi(a,b){
 b=b||{}
 if(a==='get'){
  const cfg=await getDm(),now=Date.now(),last=(await kv.get(LAST))||{},{Y,M,D}=wibYMD(now),ymd=`${Y}-${M+1}-${D}`
  const mg=maghrib(Y,M,D,cfg.city)
  const slots=await Promise.all(cfg.slots.map(async s=>({...s,when:targetOf(s,cfg,now),sentToday:last[s.id]===ymd,preview:await build(s,cfg,now)})))
  return {cfg:{...cfg,slots},cities:Object.keys(CITIES),magrib:mg,log:(await kv.get(LOG))||[],now}}
 if(a==='save'){const c=await saveDm(b);return {ok:1,cfg:c}}
 if(a==='now'){
  const cfg=await getDm(),s=cfg.slots.find(x=>x.id===b.slot);if(!s)throw Error('Slot tidak dikenal')
  const text=await build(s,cfg),job=await BCA.startAll({text,pin:false,by:0,targets:cfg.targets})
  await logAdd({slot:s.id,ok:1,job:job.id,manual:1,text:text.replace(/<[^>]+>/g,'').slice(0,140)});return {ok:1,job:job.id}}
 throw Error('Perintah tidak dikenal')}
