// Panel admin di bot CS: semua aksi admin web lewat Telegram (Telegram palsu, kode admin web ASLI dipanggil lewat adminCall).
// Jalankan dari akar proyek: npx tsx tests/csadmin.test.mjs
process.env.CSBOT_TEST='1'
import http from 'http'
let pass=0,fail=0
const ok=(c,m)=>{c?pass++:fail++;console.log((c?'  ✔ ':'  ✘ ')+m)}
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
const sent=[],gone=[]
const srv=http.createServer(async(req,res)=>{
 const ch=[];for await(const c of req)ch.push(c);const buf=Buffer.concat(ch),raw=buf.toString('latin1');const method=req.url.split('/').pop()
 let p={};try{p=JSON.parse(buf.toString('utf8'))}catch(e){}
 const out=r=>{res.setHeader('content-type','application/json');res.end(JSON.stringify({ok:true,result:r}))}
 if(method==='sendMessage'||method==='editMessageText'){sent.push({m:method,chat:String(p.chat_id),text:p.text,kb:(p.reply_markup&&p.reply_markup.inline_keyboard)||[]});return out({message_id:sent.length+500})}
 if(method==='sendDocument'){sent.push({m:method,chat:'doc',text:raw.slice(0,200)});return out({message_id:1})}
 if(method==='deleteMessage'){gone.push(p.message_id);return out(true)}
 return out(true)})
await new Promise(r=>srv.listen(0,r));process.env.TG_API='http://127.0.0.1:'+srv.address().port
process.env.ADMIN_PASSWORD='x'
const {kv}=await import('../lib/db.js')
const {resetSec}=await import('../lib/settings.js')
const CS=await import('../lib/csbot.js')
const AD=await import('../lib/csadmin.js')
await kv.set('sec',{CSBOT_TOKEN:'111:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',CSBOT_CHAT_ID:'7001,-100555'});resetSec()
const ADM='7001',GRP='-100555'
const msg=(from,chat,text)=>CS.csbotHandle({message:{message_id:1,from:{id:Number(from)},chat:{id:Number(chat)},text}})
const cb=(from,chat,data)=>CS.csbotHandle({callback_query:{id:'q',from:{id:Number(from)},message:{message_id:9,chat:{id:Number(chat)}},data}})
const last=chat=>[...sent].reverse().find(s=>s.chat===String(chat))
const btn=(s,re)=>(s&&s.kb||[]).flat().find(b=>re.test(b.text))
const mkUser=async(id,email,balance=0)=>{await kv.set('u:'+id,{id,email,name:'Nama '+id,balance,tx:[],mut:[],apikey:'k'+id,pass:'x'});await kv.set('e:'+email,id);await kv.set('k:k'+id,id);await kv.sadd('idx',id)}
await mkUser('u1001','budi@x.com',5000);await mkUser('u1002','sari@x.com',0)
await kv.set('cfg',{})

ok(AD.ALL.length===115&&new Set(AD.ALL).size===115,'katalog /aksi memuat 115 aksi admin web yang unik (113 lama + nf, nftest)')
ok(Object.entries(AD.ACT).every(([k,sp])=>AD.ALL.includes(k)||AD.ALL.includes(sp.call)||sp.view),'semua aksi terpandu menuju aksi web asli (langsung, lewat call, atau tampilan baca-saja)')
ok(AD.CATS.every(c=>c[1].every(k=>k[0]==='~'||AD.ACT[k])),'semua tombol menu menunjuk aksi yang ada')

// ---- keamanan
await msg(1234,1234,'/admin');ok(!sent.length,'orang asing tidak dibalas sama sekali')
await msg(7002,GRP,'/admin');ok(!sent.length,'anggota grup admin CS tidak bisa membuka panel (hanya ID pribadi)')
await msg(7002,GRP,'/aksi markup {"percent":99}');ok(!sent.length&&!(await kv.get('cfg')).markup,'anggota grup tidak bisa menjalankan aksi')
await cb(7002,GRP,'AM');ok(/hanya untuk ID Telegram pribadi/.test((last(GRP)||{}).text||''),'tombol panel dari anggota grup ditolak')

// ---- menu
await msg(ADM,ADM,'/admin');let s=last(ADM)
ok(s&&/Panel Admin Web/.test(s.text)&&/Pengguna: <b>2/.test(s.text)&&AD.CATS.every(c=>(s.kb.flat().some(b=>b.text===c[0]))),'/admin: menu semua kategori + jumlah pengguna')
await cb(ADM,ADM,'AC:1');s=last(ADM);ok(btn(s,/Tambah saldo web/)&&btn(s,/Blokir akun/),'kategori Pengguna menampilkan fiturnya')

// ---- formulir tambah saldo (memanggil kode admin web asli)
await cb(ADM,ADM,'AA:addsaldo');ok(/langkah 1\/2/.test(last(ADM).text),'formulir tambah saldo: pertanyaan pertama')
await msg(ADM,ADM,'tidak@ada.com');ok(/tidak ditemukan/.test(last(ADM).text),'pengguna salah → ditolak, diminta ulang')
await msg(ADM,ADM,'budi@x.com');ok(/langkah 2\/2/.test(last(ADM).text),'pengguna ditemukan lewat email → lanjut')
await msg(ADM,ADM,'abc');ok(/Nominal tidak valid/.test(last(ADM).text),'nominal salah ditolak')
await msg(ADM,ADM,'10rb');s=last(ADM)
ok(/Konfirmasi/.test(s.text)&&/Rp10\.000/.test(s.text)&&/budi@x\.com|Nama u1001/.test(s.text)&&btn(s,/Jalankan/),'ringkasan konfirmasi sebelum menjalankan')
ok((await kv.get('u:u1001')).balance===5000,'sebelum konfirmasi saldo belum berubah')
const yes=btn(s,/Jalankan/).callback_data
await cb(ADM,ADM,yes);await sleep(50)
const bu=await kv.get('u:u1001');ok(bu.balance===15000&&bu.mut[0].amt===10000,'dikonfirmasi → saldo web +Rp10.000 lewat kode admin web (mutasi tercatat)')
await cb(ADM,ADM,yes);ok((await kv.get('u:u1001')).balance===15000&&/sudah diproses/.test(last(ADM).text),'tombol konfirmasi tidak bisa dipakai dua kali')

// ---- kurangi saldo lebih dari saldo → ditolak web
await cb(ADM,ADM,'AA:delsaldo');await msg(ADM,ADM,'sari@x.com');await msg(ADM,ADM,'5000');await cb(ADM,ADM,btn(last(ADM),/Jalankan/).callback_data);await sleep(50)
ok(/Gagal/.test(last(ADM).text)&&(await kv.get('u:u1002')).balance===0,'kurangi saldo melebihi saldo → ditolak aturan web, saldo tetap')

// ---- baca-saja langsung jalan, tanpa konfirmasi
await cb(ADM,ADM,'AA:user/detail');await msg(ADM,ADM,'u1001');await sleep(50)
ok(/Nama u1001/.test(last(ADM).text)&&/Rp15\.000/.test(last(ADM).text)&&!/Konfirmasi/.test(last(ADM).text),'detail pengguna (hanya baca) langsung tampil tanpa konfirmasi')

// ---- ban / unban
await cb(ADM,ADM,'AA:ban');await msg(ADM,ADM,'sari@x.com');await msg(ADM,ADM,'spam');await cb(ADM,ADM,btn(last(ADM),/Jalankan/).callback_data);await sleep(80)
ok((await kv.get('u:u1002')).banned===true,'ban lewat bot memblokir akun')
await cb(ADM,ADM,'AA:unban');await msg(ADM,ADM,'sari@x.com');await cb(ADM,ADM,btn(last(ADM),/Jalankan/).callback_data);await sleep(80)
ok(!(await kv.get('u:u1002')).banned,'unban lewat bot membuka blokir')

// ---- maintenance & server (aksi khusus)
await cb(ADM,ADM,'AA:~maint');ok(/Maintenance situs/.test(last(ADM).text)&&/mati/.test(last(ADM).text),'menu maintenance menampilkan status')
await cb(ADM,ADM,'AQ:m:full');await sleep(50);ok(((await kv.get('cfg')).maint||{}).on===true&&/AKTIF/.test(last(ADM).text),'maintenance diaktifkan dari bot')
await cb(ADM,ADM,'AQ:m:off');await sleep(50);ok(((await kv.get('cfg')).maint||{}).on===false,'maintenance dimatikan dari bot')
await cb(ADM,ADM,'AA:~srv');const sv=last(ADM);ok(/Server nokos/.test(sv.text)&&(sv.kb.flat().length>=2),'menu server nokos')
const first=sv.kb.flat().find(b=>/^AQ:s:/.test(b.callback_data));await cb(ADM,ADM,first.callback_data);await sleep(50)
ok(((await kv.get('cfg')).off||[]).includes(first.callback_data.slice(5)),'server dinonaktifkan dari bot')
await cb(ADM,ADM,first.callback_data);await sleep(50);ok(!((await kv.get('cfg')).off||[]).includes(first.callback_data.slice(5)),'server dinyalakan lagi dari bot')

// ---- /aksi mentah
await msg(ADM,ADM,'/aksi');ok(/Pengguna/.test(last(ADM).text)&&/addsaldo/.test(last(ADM).text),'/aksi menampilkan katalog')
await msg(ADM,ADM,'/aksi markpu');ok(/tidak dikenal/.test(last(ADM).text)&&/markup/.test(last(ADM).text),'nama aksi salah → disarankan yang mirip')
await msg(ADM,ADM,'/aksi markup {"percent":12}');s=last(ADM);ok(/Konfirmasi aksi/.test(s.text)&&(await kv.get('cfg')).markup!==12,'/aksi mengubah data → minta konfirmasi dulu')
await cb(ADM,ADM,btn(s,/Jalankan/).callback_data);await sleep(60);ok((await kv.get('cfg')).markup===12,'/aksi markup dijalankan setelah konfirmasi')
await msg(ADM,ADM,'/aksi markup {rusak');ok(/JSON tidak valid/.test(last(ADM).text),'JSON rusak ditolak')
await msg(ADM,ADM,'/aksi uang');await sleep(60);ok(/Gagal|omzet|hari|minggu/i.test(last(ADM).text)&&!/Konfirmasi/.test(last(ADM).text),'/aksi aksi-baca langsung jalan tanpa konfirmasi')

// ---- broadcast banner & batal formulir
await cb(ADM,ADM,'AA:broadcast');await msg(ADM,ADM,'Promo akhir pekan!');await cb(ADM,ADM,btn(last(ADM),/Jalankan/).callback_data);await sleep(60)
ok((await kv.get('cfg')).broadcast==='Promo akhir pekan!','banner pengumuman situs diubah dari bot')
await cb(ADM,ADM,'AA:addsaldo');await msg(ADM,ADM,'/batal');const n=sent.length;await msg(ADM,ADM,'budi@x.com');ok(!/langkah 2\/2/.test((last(ADM)||{}).text||''),'/batal menutup formulir')

// ---- Clean 1 & V2 dari bot
await kv.set('u:uJunk',{id:'uJunk',email:'j@x.com',name:'J',balance:0,tx:[],mut:[],joinedAt:new Date(Date.now()-30*864e5).toISOString()});await kv.set('e:j@x.com','uJunk');await kv.sadd('idx','uJunk')
await cb(ADM,ADM,'AA:~clean1');ok(/Clean 1/.test(last(ADM).text)&&btn(last(ADM),/Mulai uji/),'menu Clean 1')
await cb(ADM,ADM,'AK:web:d');await sleep(100);s=last(ADM)
ok(/Hasil uji/.test(s.text)&&/Pengguna saldo Rp0/.test(s.text)&&!!(await kv.get('u:uJunk')),'uji Clean 1 menghitung sampah tapi TIDAK menghapus')
await cb(ADM,ADM,'AK:web:q');ok(/PERMANEN|selamanya/.test(last(ADM).text),'hapus permanen minta konfirmasi lagi')
await cb(ADM,ADM,'AK:web:r');await sleep(100)
ok(/Selesai dibersihkan/.test(last(ADM).text)&&!(await kv.get('u:uJunk'))&&!!(await kv.get('u:u1001')),'Clean 1 menghapus sampah, pengguna bersaldo tetap ada')

// ---- tetap kompatibel dengan fitur CS lama
await msg(ADM,ADM,'/start');ok(/\/admin/.test(last(ADM).text),'/start menyebut /admin')
await msg(ADM,ADM,'/saldo budi@x.com');ok(/Saldo/.test(last(ADM).text),'perintah /saldo lama tetap jalan')
console.log('\n'+pass+' lulus, '+fail+' gagal');process.exit(fail?1:0)
