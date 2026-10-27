// ===========================================================================
// PANEL ADMIN BOT CS — tambahan formulir terpandu supaya SEMUA fitur panel admin web ada juga di bot CS.
// Dipakai lib/csadmin.js (digabung ke ACT / CATS / ALL). Setiap formulir memanggil aksi admin web yang SAMA
// (adminCall), jadi validasi, catatan mutasi, dan notifikasi channel persis seperti dari web.
//
// Konvensi spesifikasi (lihat csadmin.js):
//   f:[...]            isian yang ditanyakan satu per satu
//   call:'aksi/web'    nama aksi web sebenarnya kalau berbeda dari kunci menu
//   cur:()=>obj        data saat ini (dibaca saat konfirmasi) supaya formulir hanya mengubah SEBAGIAN pengaturan
//   map:(v,cur)=>body  menyusun isi permintaan; boleh melempar Error('pesan') bila isian tidak masuk akal
//   view:()=>{html}    tampilan baca-saja yang dibuat langsung dari data (tanpa panggilan admin)
// ===========================================================================
import {kv} from './db'
import {getCfg} from './bonus'
import {SERVERS} from './providers'
import {payCfg,WD_METHODS} from './paygw'

const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
const rp=n=>'Rp'+Math.round(+n||0).toLocaleString('id-ID')
const yn=x=>x?'🟢 ON':'⚪ OFF'
const cfgNow=()=>getCfg()

// ---- pembuat isian ----
const ON=(l,n='on')=>({n,l,t:'bool'})
const I=(n,l,opt)=>({n,l,t:'int',...(opt?{opt:1}:{})})
const T=(n,l,max=200,opt)=>({n,l,t:'text',max,...(opt?{opt:1}:{})})
const CH=(n,l,opts)=>({n,l,t:'choice',opts})
const U1={n:'user',l:'Pengguna (email lengkap atau ID)',t:'user'}
const KIND={n:'kind',l:'Tambah atau kurangi?',t:'choice',opts:[['add','➕ Tambah'],['del','➖ Kurangi']]}
const AMT={n:'amount',l:'Nominal (contoh 10000, 10rb, 1,5jt)',t:'rp'}
const NOTE={n:'note',l:'Catatan (atau - untuk lewati)',t:'text',opt:1,max:100}
const view=(t,fn)=>({t,ro:1,f:[],view:fn})
const list=(title,rows,empty='Belum ada data.')=>({html:`<b>${title}</b>\n\n${rows.length?rows.join('\n'):'<i>'+empty+'</i>'}`})
const noIdx=(n,len)=>{n=Math.floor(+n);if(!(n>=1&&n<=len))throw Error(len?`Nomor harus 1–${len}.`:'Daftar masih kosong.');return n-1}
const keep=(x,old)=>x===undefined?old:x==='.'?'':x     // '-' = biarkan · '.' = kosongkan

const promoBody=c=>({welcome:c.welcome,ref:c.ref,bonus:c.bonus,weekly:c.weekly,monthly:c.monthly})
const lbBody=v=>({name:v.name,balance:v.balance,trx:v.trx,dep:v.dep,ok:v.ok,spent:v.spent})
const LB=[T('name','Email atau nama yang ditampilkan',60),I('balance','Saldo (Rp)'),I('trx','Jumlah transaksi'),I('dep','Total deposit (Rp)'),I('ok','OTP sukses'),I('spent','Total belanja (Rp)')]
const LIVE=[T('name','Nama pembeli',60),T('service','Layanan (mis. WhatsApp)',40),T('country','Negara (atau -)',30,1),I('price','Harga (Rp)'),CH('st','Status',[['proses','⏳ Proses'],['sukses','✅ Sukses'],['batal','❌ Batal']])]
const payChange=(c,o)=>({pay:{...payCfg(c),...o}})
const sv=(c,id)=>((c.srv||{})[id])||{}

export const ACT2={
 // ---------------------------------------------------------------- promo & bonus
 'promo/welcome':{t:'🎉 Bonus saldo pendaftar baru',call:'promo',cur:cfgNow,f:[ON('Aktifkan bonus pendaftar baru? (ya/tidak)'),I('amt','Nominal bonus Rp (maks 100000)')],
  map:(v,c)=>({...promoBody(c),welcome:{on:v.on,amt:v.amt}})},
 'promo/ref':{t:'🤝 Program referral',call:'promo',cur:cfgNow,f:[ON('Aktifkan referral? (ya/tidak)'),I('referrer','Hadiah untuk pengajak (Rp)'),I('referee','Hadiah untuk yang diajak (Rp)'),I('minDep','Deposit pertama minimal agar hadiah cair (Rp, min 2000)'),I('maxRef','Maks orang yang bisa diajak per pengguna (0 = 100)')],
  map:(v,c)=>({...promoBody(c),ref:{on:v.on,referrer:v.referrer,referee:v.referee,minDep:v.minDep,maxRef:v.maxRef}})},
 'promo/bonus':{t:'🎁 Bonus deposit',call:'promo',cur:cfgNow,f:[ON('Aktifkan bonus deposit? (ya/tidak)'),I('minAmt','Deposit minimal agar dapat bonus (Rp, min 2000)'),{n:'pct',l:'Persen bonus (0–50)',t:'pct'},I('max','Batas bonus per deposit (Rp, 0 = tanpa batas)'),T('days','Hari bonus ekstra: angka 0–6 (0=Minggu) pisah koma, atau -',40,1),{n:'dayPct',l:'Persen bonus ekstra di hari itu (0–50)',t:'pct'}],
  map:(v,c)=>({...promoBody(c),bonus:{on:v.on,minAmt:v.minAmt,pct:v.pct,max:v.max,days:String(v.days||'').split(/[\s,]+/).filter(Boolean).map(Number),dayPct:v.dayPct}})},
 'promo/weekly':{t:'🏆 Hadiah juara mingguan',call:'promo',cur:cfgNow,f:[ON('Aktifkan hadiah mingguan? (ya/tidak)'),CH('metric','Dihitung dari apa?',[['trx','Jumlah transaksi'],['spent','Total belanja']]),T('prizes','Hadiah juara 1,2,3… dalam Rp, pisah koma (maks 10). Contoh: 50000,30000,20000',100),I('min','Syarat minimal (jumlah trx atau Rp belanja)')],
  map:(v,c)=>({...promoBody(c),weekly:{on:v.on,metric:v.metric,prizes:v.prizes,min:v.min}})},
 'promo/monthly':{t:'🏅 Hadiah juara bulanan',call:'promo',cur:cfgNow,f:[ON('Aktifkan hadiah bulanan? (ya/tidak)'),CH('metric','Dihitung dari apa?',[['trx','Jumlah transaksi'],['spent','Total belanja']]),T('prizes','Hadiah juara 1,2,3… dalam Rp, pisah koma (maks 10)',100),I('min','Syarat minimal (jumlah trx atau Rp belanja)')],
  map:(v,c)=>({...promoBody(c),monthly:{on:v.on,metric:v.metric,prizes:v.prizes,min:v.min}})},
 'promo/show':view('📋 Ringkasan promo & bonus',async()=>{const c=await cfgNow(),w=c.weekly||{},m=c.monthly||{},b=c.bonus||{},r=c.ref||{},wl=c.welcome||{}
  return list('📋 Promo & bonus',[`🎉 Bonus pendaftar: ${yn(wl.on)} · ${rp(wl.amt)}`,`🤝 Referral: ${yn(r.on)} · pengajak ${rp(r.referrer)} · diajak ${rp(r.referee)} · min deposit ${rp(r.minDep)}`,`🎁 Bonus deposit: ${yn(b.on)} · ${b.pct||0}% · min ${rp(b.minAmt)}${b.max?' · maks '+rp(b.max):''}${(b.days||[]).length?' · hari ekstra '+b.days.join(',')+' (+'+(b.dayPct||0)+'%)':''}`,`🏆 Mingguan: ${yn(w.on)} · ${w.metric==='spent'?'belanja':'trx'} · hadiah ${(w.prizes||[]).map(rp).join(', ')||'-'}`,`🏅 Bulanan: ${yn(m.on)} · ${m.metric==='spent'?'belanja':'trx'} · hadiah ${(m.prizes||[]).map(rp).join(', ')||'-'}`])}),
 'weekly/pay':{t:'💸 Bayar hadiah mingguan sekarang',f:[],danger:1},
 'monthly/pay':{t:'💸 Bayar hadiah bulanan sekarang',f:[],danger:1},
 'weekly/last':{t:'🗒 Hasil pembayaran mingguan terakhir',ro:1,f:[]},

 // ---------------------------------------------------------------- konten situs
 'apk/save':{t:'📱 Aplikasi APK',f:[ON('Tampilkan unduhan APK di situs? (ya/tidak)'),T('url','Tautan APK (https://…)',400),T('ver','Versi (atau -)',20,1),T('size','Ukuran, mis. 18 MB (atau -)',20,1),T('note','Catatan rilis (atau -)',600,1)]},
 'buttons':{t:'🔗 Tombol di bawah notifikasi channel',f:[T('lines','Satu tombol per baris, format:  Teks | https://link  (maks 6). Kirim . untuk menghapus semua.',900)],
  map:v=>({buttons:v.lines==='.'?[]:String(v.lines).split('\n').map(l=>{const i=l.indexOf('|');return i<0?null:{text:l.slice(0,i).trim(),url:l.slice(i+1).trim()}}).filter(x=>x&&x.text&&x.url)})},
 'tap/save':{t:'⚡ Pemicu notifikasi transaksi ramai',f:[ON('Aktifkan? (ya/tidak)'),I('n','Jumlah transaksi pemicu (3–100)'),T('emails','Email penerima, pisah koma (atau -)',400,1)],map:v=>({tap:{on:v.on,n:v.n,emails:v.emails||''}})},
 'pop/show':view('🪧 Daftar popup promosi',async()=>{const c=await cfgNow();return list('🪧 Popup promosi',(c.pops||[]).map((p,i)=>`${i+1}. ${p.on===false?'⚪':'🟢'} <b>${esc(p.title)}</b>${p.badge?' · '+esc(p.badge):''} · ${esc(p.mode||'jeda')}${(p.btns||[]).length?' · '+p.btns.length+' tombol':''}${p.img?' · 🖼':''}`),'Belum ada popup.')}),
 'pop/add':{t:'➕ Tambah popup promosi',call:'pop/save',cur:cfgNow,f:[T('title','Judul popup',70),T('body','Isi popup (atau -)',900,1),T('badge','Lencana kecil, mis. PROMO (atau -)',16,1),T('btn','Teks tombol (atau -)',30,1),T('href','Link tombol (atau -)',300,1),CH('mode','Kapan muncul?',[['jeda','Berjeda'],['buka','Tiap buka situs'],['selalu','Selalu']]),I('days','Jeda hari sebelum muncul lagi (0–90)')],
  map:(v,c)=>{const p=Array.isArray(c.pops)?c.pops:[];if(p.length>=12)throw Error('Maksimal 12 popup. Hapus yang lama dulu.')
   return {pops:[...p,{title:v.title,body:v.body||'',badge:v.badge||'',mode:v.mode,days:v.days,on:true,btns:v.btn&&v.href?[{t:v.btn,href:v.href,kind:'go'}]:[]}]}}},
 'pop/toggle':{t:'🔘 Aktif/nonaktif popup',call:'pop/save',cur:cfgNow,f:[I('no','Nomor popup (lihat 🪧 Daftar popup)'),ON('Aktifkan? (ya/tidak)')],
  map:(v,c)=>{const p=Array.isArray(c.pops)?c.pops:[],i=noIdx(v.no,p.length);return {pops:p.map((x,j)=>j===i?{...x,on:v.on}:x)}}},
 'pop/del':{t:'🗑 Hapus popup',call:'pop/save',cur:cfgNow,danger:1,f:[I('no','Nomor popup (lihat 🪧 Daftar popup)')],
  map:(v,c)=>{const p=Array.isArray(c.pops)?c.pops:[],i=noIdx(v.no,p.length);return {pops:p.filter((x,j)=>j!==i)}}},
 'lb/show':view('🥇 Data manual leaderboard',async()=>list('🥇 Leaderboard manual',((await kv.get('lb_manual'))||[]).map(x=>`• <code>${esc(x.id)}</code> ${esc(x.name)} · trx ${x.trx} · ok ${x.ok} · belanja ${rp(x.spent)}`))),
 'lb/add':{t:'➕ Tambah data leaderboard',f:LB,map:lbBody},
 'lb/edit':{t:'✏️ Ubah data leaderboard',f:[T('id','ID data (lihat 🥇 Data manual)',20),...LB],map:v=>({id:v.id,...lbBody(v)})},
 'lb/del':{t:'🗑 Hapus data leaderboard',danger:1,f:[T('id','ID data (lihat 🥇 Data manual)',20)]},
 'live/show':view('📡 Data manual Live transaksi',async()=>list('📡 Live transaksi manual',((await kv.get('live_manual'))||[]).map(x=>`• <code>${esc(x.id)}</code> ${esc(x.name)} · ${esc(x.service)}${x.country?' '+esc(x.country):''} · ${rp(x.price)} · ${esc(x.st)}`))),
 'live/add':{t:'➕ Tambah data Live',f:LIVE,map:v=>({name:v.name,service:v.service,country:v.country||'',price:v.price,st:v.st})},
 'live/edit':{t:'✏️ Ubah data Live',f:[T('id','ID data (lihat 📡 Data manual)',20),...LIVE],map:v=>({id:v.id,name:v.name,service:v.service,country:v.country||'',price:v.price,st:v.st})},
 'live/del':{t:'🗑 Hapus data Live',danger:1,f:[T('id','ID data (lihat 📡 Data manual)',20)]},

 // ---------------------------------------------------------------- notifikasi & integrasi
 'nf/show':view('🔔 Saklar notifikasi pengguna baru',async()=>{const n=((await cfgNow()).nf)||{};return list('🔔 Notifikasi pengguna baru',[`🌐 Web: ${yn(n.web!==false)}`,`🤖 Bot utama: ${yn(n.bot!==false)}`,`🏪 Bot reseller: ${yn(n.rs!==false)}`])}),
 'nf':{t:'🔔 Atur notifikasi pengguna baru',cur:cfgNow,f:[{n:'web',l:'Notifikasi pengguna baru lewat WEB? (ya/tidak)',t:'bool'},{n:'bot',l:'Notifikasi pengguna baru lewat BOT UTAMA? (ya/tidak)',t:'bool'},{n:'rs',l:'Notifikasi pelanggan baru di BOT RESELLER? (ya/tidak)',t:'bool'}],map:v=>({nf:{web:v.web,bot:v.bot,rs:v.rs}})},
 'nftest':{t:'🧪 Tes foto notifikasi pengguna baru',f:[CH('kind','Contoh yang mana?',[['web','🌐 Web'],['bot','🤖 Bot utama'],['rs','🏪 Reseller']])]},
 'testnotif':{t:'🔔 Tes notifikasi channel',ro:1,f:[]},
 'push/status':{t:'📲 Perangkat notifikasi HP admin',ro:1,f:[]},
 'push/test':{t:'🔔 Tes notifikasi HP admin',ro:1,f:[]},
 'csbot/hook':{t:'🪝 Webhook Bot CS',f:[CH('act','Pilih tindakan',[['status','🔍 Cek status'],['on','🟢 Pasang'],['off','🔴 Lepas']])]},
 'sec/get':{t:'🔑 Daftar kunci integrasi (tersensor)',ro:1,f:[]},
 'sec/set':{t:'🔐 Isi / ubah kunci integrasi',danger:1,f:[{n:'key',l:'Nama kunci, mis. DIBANANA_KEY, TELEGRAM_CHAT_ID (lihat 🔑 Daftar kunci)',t:'seckey'},{n:'value',l:'Isi nilai barunya. Kirim . untuk mengosongkan. Pesanmu akan DIHAPUS otomatis demi keamanan.',t:'text',secret:1,max:3000}],
  map:v=>({values:{[v.key]:v.value==='.'?'':v.value}})},
 'sec/test':{t:'🧪 Tes koneksi integrasi',ro:1,f:[CH('target','Tes yang mana?',[['dibanana','Dibanana'],['csbot','Bot CS'],['telegram','Telegram'],['pakasir','Pakasir'],['agenh2h','AgenH2H']])]},

 // ---------------------------------------------------------------- customer service
 'cs/saldo':{t:'💳 Ubah saldo dari ruang chat CS',f:[U1,KIND,AMT,NOTE],map:v=>({uid:v.user.id,kind:v.kind,amount:v.amount,note:v.note||''}),danger:1},
 'cs/ai/show':view('🧠 Latihan AI customer service',async()=>{const s=(await cfgNow()).cs||{}
  return {html:`<b>🧠 AI customer service</b>\n\nNama: <b>${esc(s.name||'-')}</b> · Mode AI: ${yn(s.ai)} · CS: ${yn(s.on!==false)}\nGaya: ${esc(s.style||'-')}\nCatatan: ${esc((s.notes||'-').slice(0,300))}\n\n<b>Latihan (${(s.train||[]).length})</b>\n${(s.train||[]).slice(0,25).map((x,i)=>`${i+1}. ❓ ${esc(String(x.q).slice(0,70))}\n   💬 ${esc(String(x.a).slice(0,90))}`).join('\n')||'<i>Belum ada.</i>'}`}}),
 'cs/ai/save':{t:'🧠 Nama, gaya & catatan AI',cur:cfgNow,f:[T('name','Nama CS (mis. Nona)',30),T('style','Gaya bicara (atau - biarkan)',200,1),T('notes','Catatan pengetahuan untuk AI (atau - biarkan)',2000,1)],
  map:(v,c)=>{const s=c.cs||{};return {name:v.name,style:keep(v.style,s.style||''),notes:keep(v.notes,s.notes||''),train:s.train||[]}}},
 'cs/ai/train/add':{t:'➕ Tambah latihan AI',call:'cs/ai/save',cur:cfgNow,f:[T('q','Kalau pelanggan bertanya…',150),T('a','…AI menjawab',800)],
  map:(v,c)=>{const s=c.cs||{};return {name:s.name||'Nona',style:s.style||'',notes:s.notes||'',train:[...(s.train||[]),{q:v.q,a:v.a}]}}},
 'cs/ai/train/del':{t:'🗑 Hapus latihan AI',call:'cs/ai/save',cur:cfgNow,danger:1,f:[I('no','Nomor latihan (lihat 🧠 Latihan AI)')],
  map:(v,c)=>{const s=c.cs||{},t=s.train||[],i=noIdx(v.no,t.length);return {name:s.name||'Nona',style:s.style||'',notes:s.notes||'',train:t.filter((x,j)=>j!==i)}}},
 'cs/ai/test':{t:'🧪 Tes jawaban AI',ro:1,f:[T('text','Pertanyaan contoh untuk AI',300)]},

 // ---------------------------------------------------------------- deposit & server
 'dep/show':view('💰 Pengaturan deposit',async()=>{const d=(await cfgNow()).dep||{}
  const rr=(g,t)=>Object.entries(d[g]||{}).map(([k,x])=>`  ${x.on?'🟢':'⚪'} <code>${esc(k)}</code>${x.w>1?' ×'+x.w:''}`).join('\n')
  return {html:`<b>💰 Deposit</b>\n\nMinimal ${rp(d.min)} · maksimal ${rp(d.max)} · mesin <b>${esc(d.engine||'v1')}</b>\n\n<b>Rute v1 (routes)</b>\n${rr('routes')||'-'}\n\n<b>Rute v2 (routes2)</b>\n${rr('routes2')||'-'}\n\n<b>Rute reseller (routes3)</b>\n${rr('routes3')||'-'}`}}),
 'dep/limits':{t:'💰 Batas deposit',call:'dep/save',cur:cfgNow,f:[I('min','Deposit minimal (Rp, 500–10.000.000)'),I('max','Deposit maksimal (Rp)')],map:(v,c)=>({dep:{...(c.dep||{}),min:v.min,max:v.max}})},
 'dep/engine':{t:'⚙️ Mesin deposit',call:'dep/save',cur:cfgNow,f:[CH('engine','Pakai mesin deposit yang mana?',[['v1','v1 (lama)'],['v2','v2 (baru)']])],map:(v,c)=>({dep:{...(c.dep||{}),engine:v.engine}})},
 'dep/route':{t:'🔀 Nyala/mati rute deposit',call:'dep/save',cur:cfgNow,f:[CH('grp','Kelompok rute (lihat 💰 Pengaturan deposit)',[['routes','v1'],['routes2','v2'],['routes3','Reseller']]),T('key','Nama rute (persis seperti di daftar)',40),ON('Aktifkan rute ini? (ya/tidak)')],
  map:(v,c)=>{const d=c.dep||{},g=d[v.grp]||{};if(!g[v.key])throw Error('Rute "'+v.key+'" tidak ada di kelompok itu. Lihat daftar di 💰 Pengaturan deposit.');return {dep:{...d,[v.grp]:{...g,[v.key]:{...g[v.key],on:v.on}}}}}},
 'srv/edit':{t:'🖥 Nama, lencana & deskripsi server',call:'srv/save',cur:cfgNow,f:[CH('id','Server mana?',SERVERS.map(s=>[s.server,String(s.name||s.server).slice(0,24)])),T('name','Nama tampil (- biarkan · . kosongkan)',40,1),T('badge','Lencana (- biarkan · . kosongkan)',24,1),T('description','Deskripsi (- biarkan · . kosongkan)',160,1)],
  map:(v,c)=>{const o=sv(c,v.id);return {srv:{...(c.srv||{}),[v.id]:{...o,name:keep(v.name,o.name||''),badge:keep(v.badge,o.badge||''),description:keep(v.description,o.description||'')}},dbn:{countries:((c.dbn||{}).countries)||{}}}}},

 // ---------------------------------------------------------------- QRIS gateway
 'pay/show':view('🏧 Pengaturan QRIS Gateway',async()=>{const p=payCfg(await cfgNow())
  return {html:`<b>🏧 QRIS Gateway</b>\n\nGateway: ${yn(p.on)} · Tarik dana: ${yn(p.wdOn)} · Instan: ${yn(p.instOn)}\nNama: <b>${esc(p.name)}</b>\nFee: <b>${p.fee}%</b> + ${rp(p.feeFlat)} · transaksi ${rp(p.min)}–${rp(p.max)}\nTarik dana: ${rp(p.wdMin)}–${rp(p.wdMax)} · fee ${p.wdPct}% + ${rp(p.wdFee)} · instan +${rp(p.instFee)}\n\n<b>Metode tarik</b>\n${Object.entries(p.wdMethods||{}).map(([k,v])=>`${v?'🟢':'⚪'} <code>${esc(k)}</code>`).join('  ')}`}}),
 'pay/switch':{t:'🔌 Saklar gateway & tarik dana',call:'pay/save',cur:cfgNow,f:[ON('Gateway aktif? (ya/tidak)','on'),ON('Penarikan dana aktif? (ya/tidak)','wdOn'),ON('Penarikan instan aktif? (ya/tidak)','instOn')],map:(v,c)=>payChange(c,{on:v.on,wdOn:v.wdOn,instOn:v.instOn})},
 'pay/fee':{t:'💹 Fee & batas transaksi gateway',call:'pay/save',cur:cfgNow,f:[T('name','Nama gateway (mis. Artapedia Pay)',40),{n:'fee',l:'Fee persen (0–50)',t:'pct'},I('feeFlat','Fee tetap (Rp, 0–100000)'),I('min','Transaksi minimal (Rp)'),I('max','Transaksi maksimal (Rp)')],map:(v,c)=>payChange(c,{name:v.name,fee:v.fee,feeFlat:v.feeFlat,min:v.min,max:v.max})},
 'pay/wdset':{t:'🏧 Aturan tarik dana gateway',call:'pay/save',cur:cfgNow,f:[I('wdMin','Tarik minimal (Rp)'),I('wdMax','Tarik maksimal (Rp)'),{n:'wdPct',l:'Fee tarik persen (0–50)',t:'pct'},I('wdFee','Fee tarik tetap (Rp)'),I('instFee','Biaya tambahan tarik instan (Rp)')],map:(v,c)=>payChange(c,{wdMin:v.wdMin,wdMax:v.wdMax,wdPct:v.wdPct,wdFee:v.wdFee,instFee:v.instFee})},
 'pay/wdm':{t:'🔘 Nyala/mati metode tarik',call:'pay/save',cur:cfgNow,f:[CH('code','Metode',(WD_METHODS||[]).map(m=>[m.code,String(m.name||m.code).slice(0,20)])),ON('Aktifkan? (ya/tidak)')],map:(v,c)=>{const p=payCfg(c);return payChange(c,{wdMethods:{...(p.wdMethods||{}),[v.code]:v.on}})}},
 'pay/test':{t:'🧪 Tes SMP Payment',ro:1,f:[]},
 'qris/save':{t:'🧾 Data QRIS admin (reseller mandiri)',cur:cfgNow,f:[T('name','Nama merchant (atau -)',40,1),T('nmid','NMID (atau -)',30,1),T('note','Catatan (atau -)',200,1)],
  map:(v,c)=>{const q=c.qris||{};return {img:q.img||'',name:keep(v.name,q.name||''),nmid:keep(v.nmid,q.nmid||''),note:keep(v.note,q.note||'')}}},

 // ---------------------------------------------------------------- pengguna lanjutan
 'user/kick':{t:'🚪 Keluarkan dari semua perangkat',f:[U1],map:v=>({email:v.user.email})},
 'ban/preview':{t:'👁 Pratinjau dampak blokir',ro:1,f:[U1],map:v=>({email:v.user.email})},
 'user/bulkdel':{t:'🗑 Hapus banyak pengguna',danger:1,f:[T('ids','ID pengguna, pisah spasi/koma (maks 500). Akun bersaldo, punya order berjalan, reseller & admin dilewati.',4000),ON('Paksa hapus walau masih bersaldo? (ya/tidak)','force')],
  map:v=>({ids:String(v.ids).split(/[\s,;]+/).filter(Boolean).slice(0,500),force:v.force})},

 // ---------------------------------------------------------------- reseller & bot
 'rs/reg':{t:'📝 Status pendaftaran reseller',ro:1,f:[]},
 'rs/reg/save':{t:'📝 Atur pendaftaran reseller',f:[ON('Pendaftaran reseller TANPA MODAL dibuka? (ya/tidak)','kOpen'),I('kSlots','Slot bot tanpa modal'),ON('Pendaftaran reseller STOK MANDIRI dibuka? (ya/tidak)','mOpen'),I('mSlots','Slot bot stok mandiri'),{n:'depPct',l:'Komisi deposit untuk reseller tanpa modal (%, 0–50)',t:'pct'}],
  map:v=>({cfg:{komisi:{open:v.kOpen,slots:v.kSlots},mandiri:{open:v.mOpen,slots:v.mSlots},depPct:v.depPct}})},
 'rs/cust/saldo':{t:'💰 Ubah saldo pelanggan bot reseller',f:[T('id','ID pelanggan (lihat 🧑‍🤝‍🧑 Pelanggan bot reseller)',40),KIND,AMT,NOTE],map:v=>({id:v.id,kind:v.kind,amount:v.amount,note:v.note||''}),danger:1},
 'bots/add':{t:'➕ Tambah bot Telegram',f:[{n:'token',l:'Token bot dari @BotFather. Pesanmu akan DIHAPUS otomatis.',t:'text',secret:1,max:120},T('admins','ID Telegram admin bot, pisah koma (atau -)',200,1)],map:v=>({token:v.token,admins:v.admins||''})},
 'bots/save':{t:'✏️ Ubah bot tambahan',f:[T('id','ID bot (lihat 🤖 Bot Telegram tambahan)',30),T('admins','ID admin baru, pisah koma (atau - biarkan)',200,1),ON('Bot aktif? (ya/tidak)')]},
 'bots/del':{t:'🗑 Hapus bot tambahan',danger:1,f:[T('id','ID bot',30)]},
 'bcall/info':{t:'📣 Info target siaran semua bot',ro:1,f:[]},
 'kelola/bots':{t:'🧮 Daftar bot reseller (kelola)',ro:1,f:[]},

 'rs/stokreq/img':{t:'🖼 Lihat bukti isi stok reseller',ro:1,f:[U1,T('id','ID permintaan (lihat 📥 Permintaan isi stok)',60)],map:v=>({uid:v.user.id,id:v.id})},

 // ---------------------------------------------------------------- job
 'job/sub':{t:'🖼 Lihat bukti kiriman job',ro:1,f:[T('id','ID kiriman/pengajuan',60)]},
 'job/save':{t:'➕ Tambah / ubah job',f:[T('id','ID job untuk MENGUBAH (atau - untuk job baru)',32,1),T('title','Judul job',70),T('desc','Deskripsi (atau -)',400,1),T('link','Link tugas (atau -)',300,1),I('reward','Hadiah saldo (Rp)'),I('max','Maks pengerjaan per orang (1–20)'),ON('Job aktif? (ya/tidak)')],
  map:v=>({job:{id:v.id||'',title:v.title,desc:v.desc||'',link:v.link||'',reward:v.reward,max:v.max,on:v.on}})},

 // ---------------------------------------------------------------- pemeliharaan
 'backup/cfg':{t:'⏰ Jadwal backup otomatis',f:[ON('Backup otomatis aktif? (ya/tidak)'),I('hours','Sekali tiap berapa jam (1–720)')]},
 'backup/reindex':{t:'🔧 Pulihkan indeks pengguna',f:[]},
 'backup/users':{t:'👥 Halaman data pengguna (backup)',ro:1,f:[T('after','Lanjut setelah kunci (atau - dari awal)',100,1)],map:v=>v.after?{after:v.after}:{}},
 'backup/wipe':{t:'💣 HAPUS SEMUA DATA',danger:1,f:[T('confirm','Ketik persis HAPUS (huruf besar) untuk menghapus SELURUH data. Backup pengaman dibuat dulu.',10)],map:v=>({confirm:v.confirm})},
 'auto/get':{t:'🕑 Status maintenance otomatis',ro:1,f:[]},
 'auto/save':{t:'🕑 Atur maintenance otomatis',cur:cfgNow,f:[ON('Maintenance otomatis aktif? (ya/tidak)'),I('mins','Lama maintenance tiap sesi (menit, 1–10)'),ON('Hapus akun kosong lama? (ya/tidak)','delUsers'),I('userDays','Akun dianggap lama setelah (hari)'),ON('Hapus bot reseller tak terpakai? (ya/tidak)','delBots'),I('botDays','Bot dianggap tak terpakai setelah (hari)'),ON('Umumkan ke pengguna saat maintenance? (ya/tidak)','notifyUsers')],
  map:(v,c)=>({cfg:{...(c.autoc||{}),on:v.on,mins:v.mins,delUsers:v.delUsers,userDays:v.userDays,delBots:v.delBots,botDays:v.botDays,notifyUsers:v.notifyUsers}})}
}

// Menu: kategori -> daftar aksi. '~...' = layar khusus di csadmin.js
export const CATS2=[
 ['📊 Dashboard',['~info','uang','kelola/saldo','pay/data','backup/status']],
 ['👤 Pengguna',['user/detail','addsaldo','delsaldo','ban','unban','ban/preview','user/note','user/tgmsg','resetlink','user/kick','user/bulkdel','ban/ips','ban/ip/open']],
 ['📦 Order & deposit',['orders','orders/check','orders/cancel','orders/sweep','dep/rescue','dep/show','dep/limits','dep/engine','dep/route']],
 ['📢 Siaran & pengumuman',['broadcast','ann/add','ann/del','bcall/start','bcall/status','bcall/cancel','bcall/info','bots/broadcast','live/num','stats']],
 ['🎁 Promo & bonus',['promo/show','promo/welcome','promo/ref','promo/bonus','promo/weekly','promo/monthly','weekly/pay','monthly/pay','weekly/last']],
 ['🖼 Konten situs',['pop/show','pop/add','pop/toggle','pop/del','apk/save','intro/save','lb/show','lb/add','lb/edit','lb/del','live/show','live/add','live/edit','live/del','tap/save','buttons']],
 ['⚙️ Pengaturan',['~maint','~srv','srv/edit','markup','site','cs/mode']],
 ['💳 QRIS Gateway',['pay/data','pay/show','pay/switch','pay/fee','pay/wdset','pay/wdm','pay/wd','pay/toggle','pay/saldo','pay/test','qris/save']],
 ['🤖 Bot reseller & bot',['rs/list','rs/cust','rs/cust/saldo','rs/saldo','rs/stok','rs/stokreq','rs/stokreq/img','rs/stokreq/ok','rs/reg','rs/reg/save','bots/list','bots/add','bots/save','bots/test','bots/refresh','bots/del','kelola/bots']],
 ['🔑 Integrasi & notifikasi',['sec/get','sec/set','sec/test','csbot/hook','nf/show','nf','nftest','testnotif','push/status','push/test']],
 ['💬 Customer Service',['cs/list','cs/thread','cs/reply','cs/saldo','cs/mode','cs/ai/show','cs/ai/save','cs/ai/train/add','cs/ai/train/del','cs/ai/test']],
 ['🧾 Job & tugas',['job/list','job/sub','job/save','job/toggle','job/del','job/review']],
 ['🧹 Pemeliharaan',['~clean1','~clean2','backup/now','backup/cfg','~import','backup/users','backup/reindex','auto/get','auto/save','auto/dry','auto/run','kelola/bots/del','backup/wipe']]]

// aksi web yang baru (belum ada di daftar ALL lama)
export const ALL2=['nf','nftest']
