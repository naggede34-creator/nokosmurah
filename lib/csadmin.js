// ===========================================================================
// PANEL ADMIN DI BOT CS (Telegram): kelola seluruh web dari bot.
//
//  - /admin (atau /menu, /panel)  -> menu tombol per kategori, formulir terpandu langkah demi langkah.
//  - /aksi                        -> daftar SEMUA aksi admin web (115 aksi).
//  - /aksi <nama> [json]          -> jalankan aksi apa pun secara langsung, contoh:
//                                    /aksi markup {"percent":12}
//  Semua aksi memanggil kode admin web yang SAMA (route /api/admin/*), jadi hasil, catatan mutasi, dan
//  notifikasi channel persis seperti dari panel web. Tidak ada logika ganda yang bisa menyimpang.
//
// Keamanan:
//  - Hanya ID Telegram PRIBADI yang terdaftar di CSBOT_CHAT_ID (anggota grup tidak ikut berhak).
//  - Aksi yang mengubah data selalu minta konfirmasi (token sekali pakai, terikat ke chat, berlaku 5 menit).
//  - Bot membuat token admin sementara (5 menit) untuk satu panggilan lalu menghapusnya; password admin
//    tidak pernah dipakai / ditampilkan di Telegram.
// ===========================================================================
import crypto from 'crypto'
import {kv} from './db'
import {getSec} from './settings'
import {SERVERS} from './providers'
import {SEC} from './settings'
import {ACT2,CATS2,ALL2} from './csadmin2'
import zlib from 'zlib'

const API=process.env.TG_API||'https://api.telegram.org'
const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
const rupiah=n=>'Rp'+Math.round(+n||0).toLocaleString('id-ID')
const OP_TTL=5*60000,FORM_TTL=10*60000
const NOW=()=>Date.now()

// ---------------------------------------------------------------- Telegram kecil
async function tg(t,method,body,ms=12000){
 try{const r=await fetch(`${API}/bot${t}/${method}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body||{}),signal:AbortSignal.timeout(ms)})
  return (await r.json().catch(()=>null))||{ok:false,description:'HTTP '+r.status}}
 catch(e){return {ok:false,description:e.message}}}
const say=(t,chat,text,kb)=>tg(t,'sendMessage',{chat_id:chat,text:String(text).slice(0,4000),parse_mode:'HTML',disable_web_page_preview:true,...(kb?{reply_markup:{inline_keyboard:kb}}:{})})
// edit pesan menu kalau bisa (navigasi mulus), kalau gagal kirim pesan baru
async function show(t,chat,mid,text,kb){
 if(mid){const r=await tg(t,'editMessageText',{chat_id:chat,message_id:mid,text:String(text).slice(0,4000),parse_mode:'HTML',disable_web_page_preview:true,...(kb?{reply_markup:{inline_keyboard:kb}}:{})})
  if(r.ok||/not modified/i.test(r.description||''))return r}
 return say(t,chat,text,kb)}
async function sendPhotoData(t,chat,dataUrl,caption){
 try{const m=/^data:image\/(\w+);base64,(.+)$/s.exec(String(dataUrl||''));if(!m)return null
  const f=new FormData();f.append('chat_id',String(chat));f.append('photo',new Blob([Buffer.from(m[2],'base64')],{type:'image/'+m[1]}),'bukti.'+m[1])
  if(caption){f.append('caption',String(caption).slice(0,900));f.append('parse_mode','HTML')}
  const r=await fetch(`${API}/bot${t}/sendPhoto`,{method:'POST',body:f,signal:AbortSignal.timeout(20000)});return await r.json().catch(()=>null)}
 catch(e){return null}}
async function sendDoc(t,chat,name,text,caption){
 try{const f=new FormData();f.append('chat_id',String(chat));f.append('document',new Blob([String(text)],{type:'text/plain'}),name)
  if(caption){f.append('caption',String(caption).slice(0,900));f.append('parse_mode','HTML')}
  const r=await fetch(`${API}/bot${t}/sendDocument`,{method:'POST',body:f,signal:AbortSignal.timeout(20000)});return await r.json().catch(()=>null)}
 catch(e){return null}}
const BACK=[{text:'🛠 Menu Admin',callback_data:'AM'}]

// ---------------------------------------------------------------- panggilan admin web (kode yang sama dengan panel)
export async function adminCall(action,body){
 const sec=await getSec().catch(()=>({}))
 const tok=crypto.randomBytes(16).toString('hex')
 await kv.set('tmp:adm:'+tok,{uid:'csbot',email:'csbot',exp:NOW()+OP_TTL})
 try{
  const mod=await import('../app/api/[...p]/route.js')
  const host=String(sec.SITE_URL||process.env.SITE_URL||'').replace(/^https?:\/\//,'').replace(/\/.*$/,'')||process.env.VERCEL_PROJECT_PRODUCTION_URL||process.env.VERCEL_URL||'localhost:3000'
  const req=new Request('https://'+host+'/api/admin/'+action,{method:'POST',headers:{'content-type':'application/json','x-admin':tok,'x-forwarded-host':host,'x-forwarded-proto':'https','user-agent':'csbot-admin'},body:JSON.stringify(body||{})})
  const res=await mod.POST(req,{params:{p:['admin',...action.split('/')]}})
  const txt=await res.text();let j;try{j=JSON.parse(txt)}catch(e){j={error:'Balasan bukan JSON (HTTP '+res.status+'): '+txt.replace(/<[^>]+>/g,' ').trim().slice(0,120)}}
  if(!res.ok&&j&&!j.error)j.error='HTTP '+res.status
  return j}
 catch(e){return {error:'Gagal memanggil admin: '+(e&&e.message||e)}}
 finally{await kv.del('tmp:adm:'+tok).catch(()=>{})}}

// ---------------------------------------------------------------- semua aksi admin web (untuk /aksi)
export const ALL=('kelola/bots kelola/saldo kelola/bots/del kelola/clean data testnotif addsaldo delsaldo ban unban ban/preview ban/ips ban/ip/open markup broadcast user/detail user/bulkdel user/kick user/note user/tgmsg bots/list bots/add bots/save bots/refresh bots/del bots/test auto/get auto/save auto/dry auto/run bcall/info bcall/start bcall/status bcall/cancel bots/broadcast sec/get sec/set sec/test dep/rescue dep/save srv/save maint/save pop/save intro/save apk/save cs/mode cs/ai/save cs/ai/test server buttons stats lb/add lb/edit lb/del live/add live/edit live/del live/num ann/add ann/del cs/list cs/thread cs/saldo cs/reply promo weekly/pay monthly/pay site weekly/last resetlink tap/save backup/status backup/users backup/reindex backup/now backup/cfg backup/page backup/wipe backup/import uang pay/data pay/save pay/wd pay/toggle pay/saldo pay/test csbot/hook orders orders/check orders/sweep orders/cancel rs/reg rs/reg/save rs/list rs/cust rs/cust/saldo qris/save rs/stokreq rs/stokreq/img rs/stokreq/ok rs/stok rs/saldo job/list job/save job/del job/toggle job/sub job/review push/key push/status push/subscribe push/unsubscribe push/test').split(' ')
// aksi yang hanya MEMBACA (tidak perlu konfirmasi)
const RO=new Set('kelola/bots kelola/saldo data testnotif ban/preview ban/ips user/detail bots/list bots/test auto/get auto/dry bcall/info bcall/status sec/get sec/test cs/list cs/thread weekly/last backup/status backup/users backup/page uang pay/data pay/test orders orders/check rs/reg rs/list rs/cust rs/stokreq rs/stokreq/img job/list push/key push/status'.split(' '))
// aksi yang tidak bisa lewat bot karena membawa berkas/gambar besar atau konfigurasi kompleks: tetap bisa lewat /aksi dengan JSON
const GRUP=[['👤 Pengguna','user/ ban unban addsaldo delsaldo resetlink'],['📦 Order & deposit','orders dep/ uang'],['💳 QRIS Gateway','pay/ qris/'],['🤖 Bot','bots/ bcall/ rs/ kelola/bots'],['📢 Siaran & konten','broadcast ann/ pop/ intro/ apk/ buttons lb/ live/ promo weekly/ monthly/ job/ push/ cs/'],['⚙️ Pengaturan','markup server srv/ maint/ dep/ site tap/ sec/ stats auto/'],['🧹 Pemeliharaan','kelola/ backup/ testnotif data csbot/ ban/']]

// ---------------------------------------------------------------- tipe isian formulir
const num=s=>{s=String(s||'').toLowerCase().replace(/rp/g,'').trim();const m=/^(\d+(?:[.,]\d+)*)(k|rb|ribu|jt|juta)?$/.exec(s);if(!m)return NaN
 let v=m[1];const mul=({k:1e3,rb:1e3,ribu:1e3,jt:1e6,juta:1e6})[m[2]]||1;v=/^\d{1,3}([.,]\d{3})+$/.test(v)?v.replace(/[.,]/g,''):v.replace(',','.');const n=Math.round(parseFloat(v)*mul);return isFinite(n)?n:NaN}
async function cariUser(q){
 q=String(q||'').trim();if(!q)return null
 if(q.includes('@')){const id=await kv.get('e:'+q.toLowerCase());return id?await kv.get('u:'+id):null}
 if(!/^[A-Za-z0-9_-]{4,64}$/.test(q))return null
 return await kv.get('u:'+q)}
const BOOL_Y=/^(1|y|ya|yes|on|aktif|true|ok|iya)$/i,BOOL_N=/^(0|n|no|tidak|off|mati|false)$/i

// parse satu isian -> {ok,val,err,show}
async function parseField(f,txt){
 txt=String(txt||'').trim()
 if(txt==='-'&&f.opt)return {ok:true,val:undefined,show:'(dilewati)'}
 switch(f.t){
  case 'user':{const u=await cariUser(txt);if(!u)return {ok:false,err:'Pengguna tidak ditemukan. Kirim email lengkap atau ID pengguna.'};return {ok:true,val:{id:u.id,email:u.email,name:u.name},show:`${u.name||u.email} (${u.email||u.id})`}}
  case 'rp':{const n=num(txt);if(!(n>0))return {ok:false,err:'Nominal tidak valid. Contoh: 10000, 10rb, 1,5jt'};return {ok:true,val:n,show:rupiah(n)}}
  case 'int':{const n=Math.floor(+String(txt).replace(/[.,]/g,''));if(!isFinite(n)||n<0)return {ok:false,err:'Isi angka bulat 0 atau lebih.'};return {ok:true,val:n,show:String(n)}}
  case 'pct':{const n=+String(txt).replace(',','.');if(!isFinite(n)||n<0||n>500)return {ok:false,err:'Isi angka 0–500.'};return {ok:true,val:n,show:n+'%'}}
  case 'bool':{if(BOOL_Y.test(txt))return {ok:true,val:true,show:'Ya'};if(BOOL_N.test(txt))return {ok:true,val:false,show:'Tidak'};return {ok:false,err:'Jawab ya atau tidak.'}}
  case 'choice':{const o=(f.opts||[]).find(x=>x[0].toLowerCase()===txt.toLowerCase()||x[1].toLowerCase()===txt.toLowerCase());if(!o)return {ok:false,err:'Pilih salah satu: '+(f.opts||[]).map(x=>x[0]).join(' / ')};return {ok:true,val:o[0],show:o[1]}}
  case 'seckey':{const k=(SEC||[]).find(x=>x.k.toLowerCase()===txt.toLowerCase());if(!k)return {ok:false,err:'Nama kunci tidak dikenal. Lihat daftar di 🔑 Daftar kunci integrasi (contoh: DIBANANA_KEY).'};return {ok:true,val:k.k,show:k.k}}
  case 'json':{try{const v=JSON.parse(txt);return {ok:true,val:v,show:txt.slice(0,80)}}catch(e){return {ok:false,err:'Format JSON tidak valid.'}}}
  default:{if(!txt)return {ok:false,err:'Isian tidak boleh kosong.'};if(f.max&&txt.length>f.max)return {ok:false,err:'Terlalu panjang (maks '+f.max+' karakter).'};return {ok:true,val:txt,show:txt.length>60?txt.slice(0,57)+'…':txt}}}}

// ---------------------------------------------------------------- daftar aksi terpandu
const U1={n:'user',l:'Pengguna (email lengkap atau ID)',t:'user'}
const AMT={n:'amount',l:'Nominal (contoh 10000, 10rb, 1,5jt)',t:'rp'}
const NOTE={n:'note',l:'Catatan (atau - untuk lewati)',t:'text',opt:1,max:100}
const KIND={n:'kind',l:'Tambah atau kurangi?',t:'choice',opts:[['add','➕ Tambah'],['del','➖ Kurangi']]}
const ONOFF=l=>({n:'on',l,t:'bool'})
export const ACT={
 // --- dashboard & uang
 'uang':{t:'💰 Ringkasan uang',ro:1,f:[]},
 'kelola/saldo':{t:'🏦 Saldo penyedia (modal)',ro:1,f:[]},
 'backup/status':{t:'💾 Status backup',ro:1,f:[]},
 // --- pengguna
 'user/detail':{t:'🔎 Detail pengguna',ro:1,f:[U1],map:v=>({id:v.user.id}),fmt:'user'},
 'addsaldo':{t:'➕ Tambah saldo web',f:[U1,AMT],map:v=>({email:v.user.email,amount:v.amount})},
 'delsaldo':{t:'➖ Kurangi saldo web',f:[U1,AMT],map:v=>({email:v.user.email,amount:v.amount})},
 'ban':{t:'⛔ Blokir akun',f:[U1,{n:'reason',l:'Alasan (atau - untuk lewati)',t:'text',opt:1,max:200}],map:v=>({email:v.user.email,reason:v.reason}),danger:1},
 'unban':{t:'♻️ Buka blokir akun',f:[U1],map:v=>({email:v.user.email})},
 'user/note':{t:'📝 Catatan pengguna',f:[U1,{n:'note',l:'Isi catatan',t:'text',max:500}],map:v=>({id:v.user.id,note:v.note})},
 'user/tgmsg':{t:'📩 Kirim pesan ke Telegram pengguna',f:[U1,{n:'text',l:'Isi pesan',t:'text',max:1000}],map:v=>({id:v.user.id,text:v.text})},
 'resetlink':{t:'🔑 Link reset password',f:[U1],map:v=>({email:v.user.email})},
 'ban/ips':{t:'🌐 Daftar IP diblokir',ro:1,f:[]},
 'ban/ip/open':{t:'🔓 Buka blokir IP',f:[{n:'ip',l:'Alamat IP',t:'text',max:60}]},
 // --- order & deposit
 'orders':{t:'📦 Daftar order',ro:1,f:[{n:'status',l:'Status: all, pending, success, expired, cancelled, failed (atau -)',t:'text',opt:1,max:20},{n:'q',l:'Cari email / nomor / ID order (atau -)',t:'text',opt:1,max:80},{n:'limit',l:'Jumlah baris maks 15 (atau -)',t:'int',opt:1}],map:v=>({status:v.status||'all',q:v.q||'',limit:Math.min(15,v.limit||10)}),fmt:'orders'},
 'orders/check':{t:'🔄 Cek ulang order (OTP)',ro:1,f:[U1,{n:'id',l:'ID order',t:'text',max:80}],map:v=>({uid:v.user.id,id:v.id})},
 'orders/cancel':{t:'❌ Batalkan order',f:[U1,{n:'id',l:'ID order',t:'text',max:80}],map:v=>({uid:v.user.id,id:v.id}),danger:1},
 'orders/sweep':{t:'🧹 Sapu order macet',f:[],danger:1},
 'dep/rescue':{t:'🛟 Selamatkan deposit tertunda',f:[{n:'days',l:'Periksa berapa hari ke belakang (1–60, atau -)',t:'int',opt:1}],map:v=>({days:v.days||7}),danger:1},
 // --- siaran & konten
 'broadcast':{t:'📢 Banner pengumuman situs',f:[{n:'text',l:'Teks banner (kirim . untuk mengosongkan)',t:'text',max:500}],map:v=>({text:v.text==='.'?'':v.text})},
 'ann/add':{t:'📰 Tambah pengumuman',f:[{n:'title',l:'Judul',t:'text',max:120},{n:'body',l:'Isi pengumuman',t:'text',max:3000}]},
 'ann/del':{t:'🗑 Hapus pengumuman',f:[{n:'id',l:'ID pengumuman',t:'text',max:30}],danger:1},
 'bcall/start':{t:'📣 Siaran ke SEMUA bot',f:[{n:'text',l:'Isi pesan (HTML boleh)',t:'text',max:3500},{n:'pin',l:'Sematkan pesan? (ya/tidak)',t:'bool'}],danger:1},
 'bcall/status':{t:'📊 Status siaran bot',ro:1,f:[{n:'id',l:'ID siaran (atau - untuk terbaru)',t:'text',opt:1,max:40}],map:v=>v.id?{id:v.id}:{}},
 'bcall/cancel':{t:'⏹ Hentikan siaran bot',f:[],danger:1},
 'cs/list':{t:'💬 Daftar chat CS',ro:1,f:[]},
 'cs/thread':{t:'🗂 Riwayat chat satu pengguna',ro:1,f:[U1],map:v=>({uid:v.user.id})},
 'cs/reply':{t:'↩️ Balas chat CS',f:[U1,{n:'text',l:'Isi balasan',t:'text',max:1000}],map:v=>({uid:v.user.id,text:v.text})},
 'live/num':{t:'📈 Angka Live transaksi',f:[{n:'trx',l:'Jumlah transaksi (atau -)',t:'int',opt:1},{n:'proses',l:'Sedang proses (atau -)',t:'int',opt:1},{n:'sukses',l:'Sukses (atau -)',t:'int',opt:1}],map:v=>({trx:v.trx??'',proses:v.proses??'',sukses:v.sukses??''})},
 'stats':{t:'🔢 Angka statistik beranda',f:[{n:'users',l:'Jumlah pengguna tampilan (atau - pakai asli)',t:'int',opt:1},{n:'orders',l:'Jumlah order tampilan (atau - pakai asli)',t:'int',opt:1}],map:v=>({users:v.users??'',orders:v.orders??''})},
 // --- pengaturan
 'markup':{t:'💹 Markup harga umum (%)',f:[{n:'percent',l:'Persen markup 0–500',t:'pct'}],map:v=>({percent:v.percent})},
 'site':{t:'🌐 Alamat situs & dokumentasi',f:[{n:'baseUrl',l:'Alamat situs (https://...)',t:'text',max:200},{n:'docsUrl',l:'Alamat dokumentasi (atau -)',t:'text',opt:1,max:200}],map:v=>({baseUrl:v.baseUrl,docsUrl:v.docsUrl||'/docs'})},
 'intro/save':{t:'🎬 Intro layar pembuka',f:[ONOFF('Aktifkan intro? (ya/tidak)')]},
 'cs/mode':{t:'🛎 Mode CS (buka/tutup)',f:[ONOFF('CS buka? (ya = buka, tidak = tutup)'),{n:'msg',l:'Pesan saat tutup (atau -)',t:'text',opt:1,max:300}],map:v=>({on:v.on,msg:v.msg||''})},
 // --- gateway
 'pay/data':{t:'🏧 QRIS Gateway & penarikan',ro:1,f:[],fmt:'pay'},
 'pay/wd':{t:'💸 Proses penarikan gateway',f:[{n:'act',l:'ACC atau tolak?',t:'choice',opts:[['ok','✅ ACC'],['no','❌ Tolak']]},{n:'id',l:'ID penarikan',t:'text',max:60},{n:'note',l:'Catatan (atau -)',t:'text',opt:1,max:100}],map:v=>({act:v.act,id:v.id,note:v.note||''}),danger:1},
 'pay/toggle':{t:'🔌 Aktif/nonaktifkan merchant gateway',f:[U1,ONOFF('Aktifkan? (ya/tidak)')],map:v=>({uid:v.user.id,on:v.on}),danger:1},
 'pay/saldo':{t:'💳 Ubah saldo gateway merchant',f:[U1,KIND,AMT,NOTE],map:v=>({uid:v.user.id,kind:v.kind,amount:v.amount,note:v.note||''}),danger:1},
 // --- bot reseller & bot
 'rs/list':{t:'🤖 Daftar bot reseller',ro:1,f:[],fmt:'rs'},
 'rs/cust':{t:'🧑‍🤝‍🧑 Pelanggan bot reseller',ro:1,f:[{n:'q',l:'Cari (nama/ID, atau -)',t:'text',opt:1,max:60}],map:v=>({q:v.q||'',limit:15})},
 'rs/saldo':{t:'💰 Ubah saldo dompet reseller',f:[U1,KIND,AMT,NOTE],map:v=>({uid:v.user.id,kind:v.kind,amount:v.amount,note:v.note||''}),danger:1},
 'rs/stok':{t:'📦 Ubah saldo stok reseller',f:[U1,KIND,AMT,NOTE],map:v=>({uid:v.user.id,kind:v.kind,amount:v.amount,note:v.note||''}),danger:1},
 'rs/stokreq':{t:'📥 Permintaan isi stok',ro:1,f:[]},
 'rs/stokreq/ok':{t:'✅ Setujui/tolak isi stok',f:[U1,{n:'id',l:'ID permintaan',t:'text',max:60},{n:'ok',l:'Setujui? (ya/tidak)',t:'bool'}],map:v=>({uid:v.user.id,id:v.id,ok:v.ok}),danger:1},
 'bots/list':{t:'🤖 Bot Telegram tambahan',ro:1,f:[]},
 'bots/test':{t:'🧪 Tes bot',ro:1,f:[{n:'id',l:'ID bot',t:'text',max:40}]},
 'bots/refresh':{t:'🔄 Segarkan bot',f:[{n:'id',l:'ID bot',t:'text',max:40}]},
 'bots/broadcast':{t:'📣 Siaran ke bot tambahan',f:[{n:'text',l:'Isi pesan',t:'text',max:3500},{n:'pin',l:'Sematkan? (ya/tidak)',t:'bool'}],danger:1},
 // --- pemeliharaan
 'backup/now':{t:'💾 Backup sekarang',f:[]},
 'auto/dry':{t:'🕑 Uji maintenance otomatis',ro:1,f:[]},
 'auto/run':{t:'▶️ Jalankan maintenance otomatis',f:[],danger:1},
 'kelola/bots/del':{t:'🗑 Hapus bot reseller massal',f:[{n:'mode',l:'Hapus bot apa?',t:'choice',opts:[['zero','Untung Rp0'],['unused','Tidak terpakai']]}],map:v=>({[v.mode]:true,minDays:7}),danger:1},
 'job/list':{t:'🧾 Daftar job/tugas',ro:1,f:[]},
 'job/toggle':{t:'🔘 Aktif/nonaktif job',f:[{n:'id',l:'ID job',t:'text',max:40},ONOFF('Aktifkan? (ya/tidak)')]},
 'job/del':{t:'🗑 Hapus job',f:[{n:'id',l:'ID job',t:'text',max:40}],danger:1},
 'job/review':{t:'🔍 Tinjau pengajuan job',f:[{n:'id',l:'ID pengajuan',t:'text',max:60},{n:'ok',l:'Setujui? (ya/tidak)',t:'bool'},{n:'reason',l:'Alasan jika ditolak (atau -)',t:'text',opt:1,max:200}],map:v=>({id:v.id,ok:v.ok,reason:v.reason||''}),danger:1}
}
// kategori menu: [judul, [kunci aksi / pseudo "~..."]]
export const CATS=[
 ['📊 Dashboard',['~info','uang','kelola/saldo','pay/data','backup/status']],
 ['👤 Pengguna',['user/detail','addsaldo','delsaldo','ban','unban','user/note','user/tgmsg','resetlink','ban/ips','ban/ip/open']],
 ['📦 Order & deposit',['orders','orders/check','orders/cancel','orders/sweep','dep/rescue']],
 ['📢 Siaran & konten',['broadcast','ann/add','ann/del','bcall/start','bcall/status','bcall/cancel','bots/broadcast','live/num','stats']],
 ['⚙️ Pengaturan',['~maint','~srv','markup','site','intro/save','cs/mode']],
 ['💳 QRIS Gateway',['pay/data','pay/wd','pay/toggle','pay/saldo']],
 ['🤖 Bot reseller & bot',['rs/list','rs/cust','rs/saldo','rs/stok','rs/stokreq','rs/stokreq/ok','bots/list','bots/test','bots/refresh']],
 ['🧹 Pemeliharaan',['~clean1','~clean2','backup/now','auto/dry','auto/run','kelola/bots/del','job/list','job/toggle','job/del','job/review']],
 ['💬 Customer Service',['cs/list','cs/thread','cs/reply']]]
const PSEUDO={'~import':'📥 Impor backup (kirim file)','~info':'ℹ️ Ringkasan cepat','~maint':'🛠 Maintenance situs','~srv':'🖥 Server nokos on/off','~clean1':'🧹 Clean 1 (sampah website)','~clean2':'🗄 Clean V2 (sampah MongoDB)'}
Object.assign(ACT,ACT2)
for(const a of ALL2)if(!ALL.includes(a))ALL.push(a)
CATS.length=0;CATS.push(...CATS2)
const titleOf=k=>PSEUDO[k]||(ACT[k]&&ACT[k].t)||k

// ---------------------------------------------------------------- pemformat hasil
const SKIP=new Set(['pass','tx','mut','img','photo','apikey','secret','token','password','sub','methods','cfg','html'])
const MONEY=/(balance|saldo|omzet|modal|laba|gross|fee|price|nominal|cost|untung|amount|sum|keluar|masuk|refund|bonus|^net$|^total$)/i
const wib=ms=>{const d=new Date(ms+7*36e5),p=n=>String(n).padStart(2,'0');return `${p(d.getUTCDate())}/${p(d.getUTCMonth()+1)} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`}
const scal=(k,v)=>{
 if(typeof v==='number'){if(/(At|^at|^exp)$/.test(k)&&v>1e12)return wib(v);return MONEY.test(k)?rupiah(v):String(v)}
 if(typeof v==='boolean')return v?'ya':'tidak'
 if(v==null||v==='')return '-'
 const s=String(v);return s.length>120?s.slice(0,117)+'…':s}
const compact=o=>{if(o==null||typeof o!=='object')return esc(scal('',o));const e=Object.entries(o).filter(([k,v])=>!SKIP.has(k)&&(v==null||typeof v!=='object')).slice(0,6)
 return e.map(([k,v])=>`${esc(k)}=${esc(scal(k,v)).slice(0,34)}`).join(' · ')}
function lines(o,depth=0,out=[]){
 const pad='  '.repeat(depth)
 if(Array.isArray(o)){out.push(`${pad}[${o.length} item]`);o.slice(0,8).forEach(x=>out.push(`${pad}• ${compact(x)}`));if(o.length>8)out.push(`${pad}… +${o.length-8} lagi`);return out}
 for(const [k,v] of Object.entries(o||{})){
  if(SKIP.has(k))continue
  if(Array.isArray(v)){if(!v.length)continue;out.push(`${pad}<b>${esc(k)}</b>: ${v.length} item`);v.slice(0,6).forEach(x=>out.push(`${pad}  • ${compact(x)}`));if(v.length>6)out.push(`${pad}  … +${v.length-6} lagi`)}
  else if(v&&typeof v==='object'){if(depth>=2){out.push(`${pad}<b>${esc(k)}</b>: ${compact(v)}`);continue}out.push(`${pad}<b>${esc(k)}</b>:`);lines(v,depth+1,out)}
  else out.push(`${pad}<b>${esc(k)}</b>: ${esc(scal(k,v))}`)}
 return out}
const FMT={
 user(r){const u=r.user||{},s=r.stats||{};return [`👤 <b>${esc(u.name||u.email)}</b>`,`📧 ${esc(u.email||'-')} · 🆔 <code>${esc(u.id)}</code>`,`💰 Saldo: <b>${rupiah(u.balance)}</b>${u.banned?' · ⛔ DIBLOKIR':''}`,`📝 Catatan: ${esc(u.note||'-')}`,'',...lines(s)].join('\n')},
 orders(r){const st=r.stat||{};const h=`📦 <b>${(r.cocok||0).toLocaleString('id-ID')}</b> order cocok · menunggu ${st.pending||0} · sukses ${st.success||0} · gagal ${(st.failed||0)+(st.expired||0)+(st.cancelled||0)}\n💵 omzet ${rupiah(st.omzet)} · modal ${rupiah(st.modal)}`
  return h+'\n\n'+((r.items||[]).map(o=>`• <code>${esc(o.id)}</code> ${esc(o.status)} · ${esc(o.serviceName)} ${esc(o.countryName)} · ${esc(o.phone)} · ${rupiah(o.price)}\n  ${esc(o.email||o.name||o.uid)}${o.otp?' · OTP '+esc(o.otp):''}${o.late?' · ⚠️ telat':''} · ${wib(o.at)}`).join('\n')||'Tidak ada order.')},
 pay(r){const t=r.total||{},p=(r.wd&&r.wd.pending)||[]
  return [`🏧 <b>QRIS Gateway</b>`,`Saldo merchant total: <b>${rupiah(t.saldo)}</b> · masuk ${rupiah(t.masuk)} · laba fee ${rupiah(t.laba)} · keluar ${rupiah(t.keluar)} · ${t.trx||0} trx`,`SMP: ${r.smp&&r.smp.ok?'✅':'—'} · H2H AgenH2H: ${r.h2h&&r.h2h.ok?'✅':'—'}`,'',`<b>Penarikan menunggu: ${p.length}</b>`,...p.slice(0,8).map(w=>`• <code>${esc(w.id)}</code> ${rupiah(w.nominal)} → ${esc(w.methodName||w.method||'')} ${esc(w.dest||'')}${w.instant?' ⚡':''}${w.h2h_text?'\n  ⚠️ '+esc(String(w.h2h_text).slice(0,120)):''}`),'',`<b>Merchant teratas</b>`,...(r.merchants||[]).slice(0,5).map(m=>`• ${esc(m.name||m.email)} · saldo ${rupiah(m.balance)} · ${m.on?'aktif':'nonaktif'}`)].join('\n')},
 rs(r){const t=r.total||{};return [`🤖 <b>Bot reseller</b>: ${(r.items||[]).length} bot`,`Saldo dompet ${rupiah(t.saldo)} · untung ${rupiah(t.untung)} · terjual ${t.terjual||0} · pelanggan ${t.pelanggan||0}`,'',...(r.items||[]).slice(0,12).map(x=>`• ${esc(x.brand||x.name||x.uid)} (${esc(x.email||'')}) · saldo ${rupiah(x.balance)} · untung ${rupiah(x.earn)} · ${x.cust||0} pelanggan`)].join('\n')}
}
function render(a,r){
 if(r&&r.error)return '⚠️ <b>Gagal:</b> '+esc(r.error)
 if(r&&typeof r.html==='string')return r.html
 const f=ACT[a]&&ACT[a].fmt;if(f&&FMT[f]){try{return FMT[f](r)}catch(e){}}
 const l=lines(r&&typeof r==='object'?r:{hasil:r});return l.length?l.join('\n'):'✅ Selesai.'}
async function kirimHasil(t,chat,mid,a,r,kb){
 const text=render(a,r)
 if(text.length<=3800)return show(t,chat,mid,text,kb||[BACK])
 await show(t,chat,mid,text.slice(0,1800).replace(/<[^>]*$/,'')+'\n\n… <i>(hasil lengkap di berkas terlampir)</i>',[BACK])
 await sendDoc(t,chat,(a.replace(/\W+/g,'-'))+'.json',JSON.stringify(r,null,1),'📎 Hasil lengkap <code>'+esc(a)+'</code>')}


// ---------------------------------------------------------------- impor backup lewat file
const impKey=chat=>'tmp:csbot:imp:'+chat
async function importMenu(t,chat,mid){
 return show(t,chat,mid,`📥 <b>Impor backup</b>\n\nPulihkan data dari file backup (.json / .json.gz) yang pernah dikirim bot ini.\n\n• <b>Gabungkan</b>: isi file ditimpa ke data sekarang\n• <b>Ganti total</b>: data sekarang dihapus dulu, diganti isi file`,[[{text:'➕ Gabungkan',callback_data:'AI:g'},{text:'♻️ Ganti total',callback_data:'AI:r'}],BACK])}
async function importFile(t,chat,doc,st){
 await kv.del(impKey(chat))
 if(+doc.file_size>20*1024*1024)return say(t,chat,'⚠️ File lebih dari 20 MB, tidak bisa diambil lewat bot. Impor lewat panel web.',[BACK])
 const w=await say(t,chat,'⏳ Mengunduh & membaca file…')
 try{
  const g=await tg(t,'getFile',{file_id:doc.file_id});if(!g.ok)throw Error('Telegram menolak mengambil file: '+(g.description||''))
  const r=await fetch(`${API}/file/bot${t}/${g.result.file_path}`,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('Gagal mengunduh file (HTTP '+r.status+')')
  let u8=new Uint8Array(await r.arrayBuffer());if(u8[0]===0x1f&&u8[1]===0x8b)u8=zlib.gunzipSync(Buffer.from(u8))
  const dd=JSON.parse(Buffer.from(u8).toString('utf8'))
  if(dd.app!=='artapedia-id'||!Array.isArray(dd.entries))throw Error('Ini bukan file backup Artapedia ID.')
  if(st.mode==='r'){const x=await adminCall('backup/wipe',{confirm:'HAPUS'});if(x.error)throw Error(x.error)}
  const LIM=900000,t0=NOW();let batch=[],sz=0,done=0
  const flush=async()=>{if(!batch.length)return;const x=await adminCall('backup/import',{items:batch});if(x.error)throw Error(x.error);done+=batch.length;batch=[];sz=0}
  for(const en of dd.entries){
   if(NOW()-t0>40000)throw Error(`Waktu habis di ${done}/${dd.entries.length} data (file terlalu besar untuk bot). Ulangi dengan mode Gabungkan atau pakai panel web.`)
   const j=JSON.stringify(en.v)
   if(j.length>LIM){await flush();for(let o=0;o<j.length;o+=LIM){const x=await adminCall('backup/import',{items:[{k:en.k,part:{o,total:j.length,s:j.slice(o,o+LIM)}}]});if(x.error)throw Error(x.error)}done++;continue}
   if(sz+j.length>LIM)await flush()
   batch.push({k:en.k,v:en.v});sz+=j.length+en.k.length+12}
  await flush();await adminCall('backup/reindex',{})
  if(w&&w.result)await tg(t,'deleteMessage',{chat_id:chat,message_id:w.result.message_id})
  return say(t,chat,`✅ <b>Impor selesai</b>\n${done} data dipulihkan (${st.mode==='r'?'ganti total':'digabung'}). Indeks pengguna sudah dirapikan.`,[BACK])}
 catch(e){return say(t,chat,'⚠️ <b>Impor gagal:</b> '+esc(e&&e.message||e),[BACK])}}

// ---------------------------------------------------------------- menu
export async function panel(t,chat,mid){
 const [idx,cfg]=await Promise.all([kv.get('idx'),kv.get('cfg')])
 const m=(cfg&&cfg.maint)||{}
 const rows=[];for(let i=0;i<CATS.length;i+=2)rows.push(CATS.slice(i,i+2).map((c,j)=>({text:c[0],callback_data:'AC:'+(i+j)})))
 rows.push([{text:'🧰 Semua aksi (/aksi)',callback_data:'AL:0'},{text:'ℹ️ Bantuan',callback_data:'AH'}])
 return show(t,chat,mid,`🛠 <b>Panel Admin Web</b>\n\n👥 Pengguna: <b>${(Array.isArray(idx)?idx.length:0).toLocaleString('id-ID')}</b>\n${m.on?'🔴 Maintenance situs: <b>AKTIF</b>':'🟢 Situs: normal'}\n\nPilih kategori, atau ketik <code>/aksi</code> untuk semua ${ALL.length} aksi admin.`,rows)}
async function kategori(t,chat,mid,i){
 const c=CATS[i];if(!c)return panel(t,chat,mid)
 const rows=c[1].map(k=>[{text:titleOf(k),callback_data:'AA:'+k}])
 rows.push(BACK);return show(t,chat,mid,`<b>${esc(c[0])}</b>\nPilih fitur:`,rows)}
const BANTUAN=`ℹ️ <b>Cara pakai panel admin</b>\n\n• <code>/admin</code> — menu tombol per kategori\n• Pilih fitur → bot menanyakan isiannya satu per satu → ringkasan → <b>✅ Jalankan</b>\n• <code>-</code> melewati isian opsional · <code>/batal</code> membatalkan formulir\n• <code>/aksi</code> — daftar semua ${ALL.length} aksi admin web\n• <code>/aksi nama {"kunci":"nilai"}</code> — jalankan aksi apa pun langsung, mis. <code>/aksi markup {"percent":12}</code>\n• Pengguna boleh ditulis dengan <b>email lengkap</b> atau <b>ID pengguna</b>\n\n🔒 Hanya ID Telegram pribadi di daftar admin CS yang bisa memakai panel ini. Semua perubahan memakai kode admin web yang sama (tercatat & dinotifikasi seperti biasa).`
async function katalog(t,chat,mid,page){
 const per=[];for(const [nama,keys] of GRUP){const ks=keys.split(' ');per.push([nama,ALL.filter(a=>ks.some(k=>k.endsWith('/')?a.startsWith(k):a===k||a.startsWith(k+'/')))])}
 const taken=new Set(per.flatMap(x=>x[1]));const lain=ALL.filter(a=>!taken.has(a));if(lain.length)per.push(['🔧 Lainnya',lain])
 const p=Math.max(0,Math.min(page,per.length-1)),[nama,ls]=per[p]
 const rows=[[]];if(p>0)rows[0].push({text:'⬅️',callback_data:'AL:'+(p-1)});rows[0].push({text:`${p+1}/${per.length}`,callback_data:'AL:'+p});if(p<per.length-1)rows[0].push({text:'➡️',callback_data:'AL:'+(p+1)})
 rows.push(BACK)
 return show(t,chat,mid,`🧰 <b>${esc(nama)}</b>\n\n${ls.map(a=>`<code>${esc(a)}</code>${RO.has(a)?' 👁':''}${ACT[a]?' ✨':''}`).join('\n')}\n\n👁 hanya baca · ✨ ada formulir terpandu\nJalankan: <code>/aksi nama {"json":"isian"}</code>`,rows)}

// ---------------------------------------------------------------- formulir terpandu
const formKey=chat=>'tmp:csbot:af:'+chat
async function tanya(t,chat,st){
 const f=ACT[st.a].f[st.i],n=st.i+1,tot=ACT[st.a].f.length
 const head=`<b>${esc(titleOf(st.a))}</b> · langkah ${n}/${tot}\n\n${esc(f.l)}`
 let kb=null
 if(f.t==='bool')kb=[[{text:'✅ Ya',callback_data:'AV:y'},{text:'❌ Tidak',callback_data:'AV:n'}]]
 else if(f.t==='choice')kb=[(f.opts||[]).map(o=>({text:o[1],callback_data:'AV:'+o[0]}))]
 else if(f.opt)kb=[[{text:'⏭ Lewati',callback_data:'AV:-'}]]
 if(kb)kb.push([{text:'✖️ Batal',callback_data:'AX'}]);else kb=[[{text:'✖️ Batal',callback_data:'AX'}]]
 return say(t,chat,head+(kb?'':''),kb)}
async function mulai(t,chat,mid,a){
 const sp=ACT[a];if(!sp)return say(t,chat,'⚠️ Aksi tidak dikenal.')
 if(!sp.f.length)return konfirmasiAtauJalan(t,chat,mid,a,{})
 const st={a,i:0,v:{},show:{},exp:NOW()+FORM_TTL}
 await kv.set(formKey(chat),st);return tanya(t,chat,st)}
async function isi(t,chat,txt,mid){
 const st=await kv.get(formKey(chat));if(!st)return false
 if(NOW()>st.exp){await kv.del(formKey(chat));return false}
 const f=ACT[st.a].f[st.i],p=await parseField(f,txt)
 if(!p.ok){await say(t,chat,'⚠️ '+esc(p.err)+'\nCoba lagi, atau /batal.');return true}
 st.v[f.n]=p.val;st.show[f.n]=f.secret?'••••••••':p.show;st.i++
 if(f.secret&&mid)tg(t,'deleteMessage',{chat_id:chat,message_id:mid}).catch(()=>{})   // buang pesan berisi rahasia dari riwayat chat
 if(st.i>=ACT[st.a].f.length){await kv.del(formKey(chat));await konfirmasiAtauJalan(t,chat,null,st.a,st.v,st.show);return true}
 await kv.set(formKey(chat),st);await tanya(t,chat,st);return true}
async function bodyOf(a,v){const sp=ACT[a];const cur=sp&&sp.cur?await sp.cur():null;const raw=sp&&sp.map?sp.map(v,cur):v;const o={};for(const [k,x] of Object.entries(raw||{}))if(x!==undefined)o[k]=x;return o}
async function konfirmasiAtauJalan(t,chat,mid,a,v,show){
 const sp=ACT[a]
 let body;try{body=await bodyOf(a,v)}catch(e){return say(t,chat,'⚠️ '+esc(e&&e.message||e)+'\nUlangi dari menu.',[BACK])}
 if(sp&&sp.ro)return jalan(t,chat,mid,a,body)
 const tok=crypto.randomBytes(6).toString('hex')
 await kv.set('tmp:csbot:ay:'+tok,{chat,a,body,exp:NOW()+OP_TTL})
 const ringkas=sp&&sp.f.length?sp.f.map(f=>`• ${esc(f.l.replace(/\s*\(.*$/,''))}: <b>${esc((show&&show[f.n])??'-')}</b>`).join('\n'):'<i>(tanpa isian)</i>'
 return say(t,chat,`${sp&&sp.danger?'⚠️':'❓'} <b>Konfirmasi: ${esc(titleOf(a))}</b>\n━━━━━━━━━━━━━━━━━━\n${ringkas}\n━━━━━━━━━━━━━━━━━━\n${sp&&sp.danger?'Aksi ini berdampak langsung dan sulit dibatalkan. ':''}Jalankan sekarang?`,[[{text:'✅ Jalankan',callback_data:'AY:'+tok},{text:'❌ Batal',callback_data:'AN:'+tok}]])}
async function eksekusi(t,chat,mid,tok){
 const key='tmp:csbot:ay:'+tok
 if(!await kv.lock('csbot:ay:'+tok,60000))return say(t,chat,'⏳ Sedang diproses, jangan tekan dua kali.')
 try{
  const op=await kv.get(key)
  if(!op)return say(t,chat,'ℹ️ Permintaan ini sudah diproses atau dibatalkan.')
  if(op.chat!==chat)return say(t,chat,'⛔ Permintaan ini dibuat di chat lain.')
  await kv.del(key)                         // sekali pakai
  if(NOW()>op.exp)return say(t,chat,'⌛ Permintaan kedaluwarsa (lebih dari 5 menit). Ulangi.')
  return jalan(t,chat,null,op.a,op.body)}
 finally{await kv.unlock('csbot:ay:'+tok)}}
async function jalan(t,chat,mid,a,body){
 const wait=await say(t,chat,'⏳ Memproses…');const w=wait&&wait.result&&wait.result.message_id
 const sp=ACT[a];let r
 try{r=sp&&sp.view?await sp.view():await adminCall((sp&&sp.call)||a,body)}catch(e){r={error:String(e&&e.message||e)}}
 if(w)await tg(t,'deleteMessage',{chat_id:chat,message_id:w})
 if(r&&typeof r.img==='string'&&r.img.startsWith('data:image')){const ok=await sendPhotoData(t,chat,r.img,'🖼 <b>'+esc(titleOf(a))+'</b>'+(r.amount?'\n💵 '+rupiah(r.amount):'')+(r.status?' · '+esc(r.status):'')+(r.note?'\n📝 '+esc(r.note):''));if(!(ok&&ok.ok))r={...r,img:undefined,error:'Gambar tidak bisa dikirim ke chat ini.'}
  else r={ok:'gambar terkirim di atas'}}
 let kb=[BACK]
 if(a==='pay/data'&&r&&r.wd&&Array.isArray(r.wd.pending)&&r.wd.pending.length)kb=[...r.wd.pending.slice(0,5).map(x=>[{text:`✅ ACC ${x.id.slice(-6)}`,callback_data:'AW:ok:'+x.id},{text:`❌ Tolak ${x.id.slice(-6)}`,callback_data:'AW:no:'+x.id}]),BACK]
 return kirimHasil(t,chat,null,a,r,kb)}

// ---------------------------------------------------------------- aksi khusus (pseudo)
async function infoCepat(t,chat,mid){
 const [idx,cfg]=await Promise.all([kv.get('idx'),kv.get('cfg')]),m=(cfg&&cfg.maint)||{},off=(cfg&&cfg.off)||[]
 const pay=await kv.get('payidx')
 return show(t,chat,mid,`ℹ️ <b>Ringkasan cepat</b>\n\n👥 Pengguna: <b>${(Array.isArray(idx)?idx.length:0).toLocaleString('id-ID')}</b>\n💳 Merchant gateway: <b>${Array.isArray(pay)?pay.length:0}</b>\n${m.on?'🔴 Maintenance: AKTIF ('+(m.mode==='soft'?'lunak':'penuh')+')':'🟢 Maintenance: mati'}\n🖥 Server nonaktif: ${off.length?off.map(esc).join(', '):'tidak ada'}\n🔢 Markup umum: ${cfg&&cfg.markup!=null?cfg.markup+'%':'-'}\n📢 Banner: ${esc((cfg&&cfg.broadcast)||'-').slice(0,100)}`,[[{text:'🔄 Segarkan',callback_data:'AA:~info'}],BACK])}
async function maintMenu(t,chat,mid){
 const cfg=(await kv.get('cfg'))||{},m=cfg.maint||{}
 return show(t,chat,mid,`🛠 <b>Maintenance situs</b>\n\nStatus: ${m.on?'🔴 <b>AKTIF</b> ('+(m.mode==='soft'?'lunak: lihat saja':'penuh: situs ditutup')+')':'🟢 mati'}\nPesan: ${esc(m.msg||'-')}`,
  [[{text:'🔴 Aktifkan penuh',callback_data:'AQ:m:full'},{text:'🟠 Aktifkan lunak',callback_data:'AQ:m:soft'}],[{text:'🟢 Matikan',callback_data:'AQ:m:off'}],BACK])}
async function maintSet(t,chat,mid,mode){
 const cfg=(await kv.get('cfg'))||{},cur=cfg.maint||{}
 const maint={...cur,on:mode!=='off',mode:mode==='soft'?'soft':(cur.mode||'full'),msg:cur.msg||'',srv:cur.srv||{}}
 const r=await adminCall('maint/save',{maint});if(r&&r.error)return show(t,chat,mid,'⚠️ Gagal: '+esc(r.error),[BACK])
 return maintMenu(t,chat,mid)}
async function srvMenu(t,chat,mid){
 const off=((await kv.get('cfg'))||{}).off||[]
 return show(t,chat,mid,`🖥 <b>Server nokos</b>\nKetuk untuk aktif/nonaktifkan (berlaku langsung di web & API).\n\n${SERVERS.map(s=>`${off.includes(s.server)?'🔴':'🟢'} ${esc(s.name||s.server)} <code>${esc(s.server)}</code>`).join('\n')}`,
  [...SERVERS.map(s=>[{text:`${off.includes(s.server)?'🔴 Nyalakan':'🟢 Matikan'} ${String(s.name||s.server).slice(0,24)}`,callback_data:'AQ:s:'+s.server}]),BACK])}
async function srvToggle(t,chat,mid,id){
 const off=((await kv.get('cfg'))||{}).off||[]
 const r=await adminCall('server',{server:id,on:off.includes(id)});if(r&&r.error)return show(t,chat,mid,'⚠️ Gagal: '+esc(r.error),[BACK])
 return srvMenu(t,chat,mid)}

// Clean 1 / Clean V2 dengan jeda: setiap tekan menjalankan langkah selama ±18 detik lalu bisa dilanjutkan
const STAGE={tx:'riwayat transaksi',bots:'bot reseller untung Rp0',users:'pengguna saldo Rp0',junk:'sampah web',orphan:'data yatim',idx:'indeks',legacy:'sisa data lama',dbscan:'pindai MongoDB',done:'selesai'}
const LBL={orderBatal:'Order dibatalkan',orderKadaluarsa:'Order kedaluwarsa',orderGagal:'Order gagal',pendingMacet:'Order macet (direfund)',depositGagal:'Deposit gagal',depositBatal:'Deposit batal',depositKadaluarsa:'Deposit kedaluwarsa',users:'Pengguna saldo Rp0 tak pernah beli',botsZero:'Bot reseller untung Rp0',sessions:'Sesi lama',tokens:'Token kedaluwarsa',jobs:'Antrean lama',states:'Status bot kosong',counters:'Penghitung lama',orphans:'Data yatim',idx:'Indeks rusak',dbKosong:'Dokumen kosong/kedaluwarsa',legacy:'Sisa penyedia lama'}
const cleanKey=chat=>'tmp:csbot:clean:'+chat
async function cleanMenu(t,chat,mid,mode){
 const nama=mode==='db'?'Clean V2 (sampah MongoDB)':'Clean 1 (sampah website)'
 return show(t,chat,mid,`🧹 <b>${nama}</b>\n\nBerjalan dua tahap: <b>uji dulu</b> (tidak menghapus apa pun, hanya menghitung), lalu kamu putuskan menghapus. Hapus bersifat <b>PERMANEN</b>.\n${mode==='db'?'Data pengguna, saldo, dan transaksi tidak disentuh.':'Saldo di atas Rp0, order/deposit sukses, dan yang masih menunggu tidak disentuh.'}`,[[{text:'🔍 Mulai uji',callback_data:'AK:'+mode+':d'}],BACK])}
async function cleanRun(t,chat,mid,mode,dry,fresh){
 const key=cleanKey(chat);let s=fresh?null:await kv.get(key)
 if(!s||s.mode!==mode||s.dry!==dry)s={mode,dry,state:null,exp:NOW()+30*60000}
 const t0=NOW();let r=null,n=0
 while(NOW()-t0<17000){
  r=await adminCall('kelola/clean',{state:s.state,dry,mode,budget:5000})
  n++
  if(r&&r.error){if(r.net&&n<6){await new Promise(x=>setTimeout(x,900));continue}await kv.set(key,s);return show(t,chat,mid,'⚠️ '+esc(r.error)+'\n\nKemajuan tersimpan, bisa dilanjutkan.',[[{text:'▶️ Lanjutkan',callback_data:'AK:'+mode+':'+(dry?'c':'C')}],BACK])}
  s.state=r.state
  if(r.done)break}
 if(!r||!r.done){await kv.set(key,s);return show(t,chat,mid,`${dry?'🔍 Menguji':'🧹 Membersihkan'}… ${(+(s.state&&s.state.scanned)||0).toLocaleString('id-ID')} data dipindai · tahap ${STAGE[s.state&&s.state.stage]||'-'}`,[[{text:'▶️ Lanjutkan',callback_data:'AK:'+mode+':'+(dry?'c':'C')}],BACK])}
 await kv.del(key)
 const st=r.stats||{},ls=Object.entries(LBL).filter(([k])=>st[k]>0).map(([k,l])=>`• ${l}: <b>${(+st[k]).toLocaleString('id-ID')}</b>`)
 const unk=r.unknown&&Object.keys(r.unknown).length?`\n\n<b>Awalan tak dikenal (hanya dilaporkan)</b>\n${Object.entries(r.unknown).slice(0,10).map(([k,v])=>`• ${esc(k)}: ${v}`).join('\n')}`:''
 if(dry)return show(t,chat,mid,`🔍 <b>Hasil uji</b> — ${ls.length?'yang akan dihapus PERMANEN:':'sudah bersih, tidak ada yang perlu dihapus.'}\n\n${ls.join('\n')}${unk}`,ls.length?[[{text:'🗑 Hapus sekarang (permanen)',callback_data:'AK:'+mode+':q'}],BACK]:[BACK])
 return show(t,chat,mid,`✅ <b>Selesai dibersihkan</b>\n\n${ls.join('\n')||'Tidak ada yang dihapus.'}${unk}`,[BACK])}

// saran nama aksi yang mirip (mengandung kata itu, atau selisih huruf kecil)
const jarak=(a,b)=>{const d=[...Array(b.length+1).keys()];for(let i=1;i<=a.length;i++){let p=d[0];d[0]=i;for(let j=1;j<=b.length;j++){const t=d[j];d[j]=Math.min(d[j]+1,d[j-1]+1,p+(a[i-1]===b[j-1]?0:1));p=t}}return d[b.length]}
const mirip=n=>{n=String(n).toLowerCase();return ALL.map(a=>[a,a.includes(n)||n.includes(a)?0:jarak(n,a)]).filter(x=>x[1]<=Math.max(2,Math.floor(n.length/3))).sort((x,y)=>x[1]-y[1]).slice(0,6).map(x=>x[0])}
// ---------------------------------------------------------------- pintu masuk
// perintah teks (return true bila sudah ditangani)
export async function adminCmd(t,chat,txt,m){
 const x=/^\/(admin|menu|panel|aksi|batal)(?:@\w+)?(?:\s+([\s\S]*))?$/i.exec(txt);if(!x)return false
 const c=x[1].toLowerCase(),arg=String(x[2]||'').trim()
 if(c==='batal'){await kv.del(formKey(chat));await kv.del(cleanKey(chat));return false}   // biarkan perintah /batal lama ikut berjalan
 if(c!=='aksi'){await panel(t,chat,null);return true}
 if(!arg){await katalog(t,chat,null,0);return true}
 const sp=arg.indexOf(' '),nama=(sp<0?arg:arg.slice(0,sp)).trim(),js=sp<0?'':arg.slice(sp+1).trim()
 if(!ALL.includes(nama)){const dekat=mirip(nama);await say(t,chat,`⚠️ Aksi <code>${esc(nama)}</code> tidak dikenal.${dekat.length?'\nMaksud kamu: '+dekat.map(a=>`<code>${esc(a)}</code>`).join(', ')+'?':''}\nLihat daftar lengkap: /aksi`);return true}
 let body={};if(js){try{body=JSON.parse(js)}catch(e){await say(t,chat,'⚠️ JSON tidak valid. Contoh: <code>/aksi markup {"percent":12}</code>');return true}}
 if(nama==='kelola/clean'){await say(t,chat,'ℹ️ Pakai menu 🧹 Clean di /admin supaya bisa berjalan bertahap & aman.');return true}
 if(RO.has(nama)){await jalan(t,chat,null,nama,body);return true}
 const tok=crypto.randomBytes(6).toString('hex')
 await kv.set('tmp:csbot:ay:'+tok,{chat,a:nama,body,exp:NOW()+OP_TTL})
 await say(t,chat,`⚠️ <b>Konfirmasi aksi</b> <code>${esc(nama)}</code>\n<pre>${esc(JSON.stringify(body).slice(0,700))}</pre>\nJalankan sekarang?`,[[{text:'✅ Jalankan',callback_data:'AY:'+tok},{text:'❌ Batal',callback_data:'AN:'+tok}]])
 return true}
// teks biasa: dipakai kalau sedang mengisi formulir
export async function adminText(t,chat,txt,m){
 if(m&&m.document){const st=await kv.get(impKey(chat));if(st&&NOW()<st.exp)return await importFile(t,chat,m.document,st)}
 return await isi(t,chat,txt,m&&m.message_id)}
// tombol (callback_data diawali "A")
export async function adminCb(t,chat,mid,d){
 const [k,a,b]=d.split(':')
 if(d==='AM')return void await panel(t,chat,mid)
 if(d==='AH')return void await show(t,chat,mid,BANTUAN,[BACK])
 if(k==='AC')return void await kategori(t,chat,mid,+a)
 if(k==='AL')return void await katalog(t,chat,mid,+a||0)
 if(k==='AA'){const key=d.slice(3)
  if(key==='~info')return void await infoCepat(t,chat,mid)
  if(key==='~maint')return void await maintMenu(t,chat,mid)
  if(key==='~srv')return void await srvMenu(t,chat,mid)
  if(key==='~import')return void await importMenu(t,chat,mid)
  // sekali tekan langsung bersih-bersih permanen (tanpa tahap uji / konfirmasi)
  if(key==='~clean1')return void await cleanRun(t,chat,mid,'web',false,true)
  if(key==='~clean2')return void await cleanRun(t,chat,mid,'db',false,true)
  return void await mulai(t,chat,mid,key)}
 if(k==='AI'){if(a==='x'){await kv.del(impKey(chat));return void await panel(t,chat,mid)}
  await kv.set(impKey(chat),{mode:a==='r'?'r':'g',exp:NOW()+FORM_TTL});return void await show(t,chat,mid,`📥 <b>Impor backup — ${a==='r'?'♻️ GANTI TOTAL':'➕ GABUNGKAN'}</b>\n\nKirim <b>file backup</b> (.json atau .json.gz hasil 💾 Backup) ke chat ini sekarang.\n${a==='r'?'⚠️ Seluruh data sekarang DIHAPUS dulu (backup pengaman dibuat otomatis), lalu diganti isi file.':'Data di file ditimpa ke data yang ada; data lain tidak disentuh.'}\n\n<i>Maks 20 MB (batas Telegram). Untuk backup lebih besar pakai panel web.</i>`,[[{text:'✖️ Batal',callback_data:'AI:x'}]])}
 if(k==='AQ'){if(a==='m')return void await maintSet(t,chat,mid,b);if(a==='s')return void await srvToggle(t,chat,mid,d.slice(5))}
 if(k==='AK'){
  if(b==='d')return void await cleanRun(t,chat,mid,a,true,true)
  if(b==='c')return void await cleanRun(t,chat,mid,a,true,false)
  if(b==='q')return void await show(t,chat,mid,`🗑 <b>Hapus permanen sekarang?</b>\nYang tadi diuji akan <b>dihapus selamanya</b> dan tidak bisa dikembalikan.`,[[{text:'✅ Ya, hapus',callback_data:'AK:'+a+':r'},{text:'❌ Batal',callback_data:'AM'}]])
  if(b==='r')return void await cleanRun(t,chat,mid,a,false,true)
  if(b==='C')return void await cleanRun(t,chat,mid,a,false,false)}
 if(k==='AY')return void await eksekusi(t,chat,mid,a)
 if(k==='AN'){await kv.del('tmp:csbot:ay:'+a);return void await show(t,chat,mid,'❌ Dibatalkan. Tidak ada yang diubah.',[BACK])}
 if(d==='AX'){await kv.del(formKey(chat));return void await show(t,chat,mid,'❌ Formulir dibatalkan.',[BACK])}
 if(k==='AW'){const id=d.split(':').slice(2).join(':');const tok=crypto.randomBytes(6).toString('hex')
  await kv.set('tmp:csbot:ay:'+tok,{chat,a:'pay/wd',body:{act:a,id,note:''},exp:NOW()+OP_TTL})
  return void await say(t,chat,`⚠️ <b>${a==='ok'?'ACC':'Tolak'} penarikan</b> <code>${esc(id)}</code>?${a==='no'?'\nSaldo merchant dikembalikan.':'\nPenarikan dianggap sudah dikirim.'}`,[[{text:'✅ Ya',callback_data:'AY:'+tok},{text:'❌ Batal',callback_data:'AN:'+tok}]])}
 if(k==='AV'){   // jawaban lewat tombol (ya/tidak, pilihan, lewati)
  const st=await kv.get(formKey(chat));if(!st)return void await say(t,chat,'ℹ️ Formulir sudah berakhir. Mulai lagi lewat /admin.')
  const f=ACT[st.a].f[st.i],val=d.slice(3)
  const txt=f.t==='bool'?(val==='y'?'ya':'tidak'):val
  return void await isi(t,chat,txt)}}
