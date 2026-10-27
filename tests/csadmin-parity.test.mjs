// Panel admin bot CS = SEMUA fitur panel admin web: tiap formulir terpandu memanggil kode admin web ASLI.
// Jalankan dari akar proyek: npx tsx tests/csadmin-parity.test.mjs
process.env.CSBOT_TEST='1'
import http from 'http'
import zlib from 'zlib'
import fs from 'fs'
let pass=0,fail=0
const ok=(c,m)=>{c?pass++:fail++;console.log((c?'  ✔ ':'  ✘ ')+m)}
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
const sent=[],gone=[];let fileBody=Buffer.from('')
const srv=http.createServer(async(req,res)=>{
 const ch=[];for await(const c of req)ch.push(c);const buf=Buffer.concat(ch),raw=buf.toString('latin1');const method=req.url.split('/').pop()
 if(req.url.includes('/file/bot')){res.setHeader('content-type','application/octet-stream');return res.end(fileBody)}
 let p={};try{p=JSON.parse(buf.toString('utf8'))}catch(e){}
 const out=r=>{res.setHeader('content-type','application/json');res.end(JSON.stringify({ok:true,result:r}))}
 if(method==='sendMessage'||method==='editMessageText'){sent.push({m:method,chat:String(p.chat_id),text:p.text,kb:(p.reply_markup&&p.reply_markup.inline_keyboard)||[]});return out({message_id:sent.length+500})}
 if(method==='sendDocument'||method==='sendPhoto'){sent.push({m:method,chat:'doc',text:raw.slice(0,300)});return out({message_id:1})}
 if(method==='deleteMessage'){gone.push(p.message_id);return out(true)}
 if(method==='getFile')return out({file_path:'docs/backup.json'})
 if(method==='getMe')return res.end(JSON.stringify({ok:false,description:'Unauthorized'}))
 return out(true)})
await new Promise(r=>srv.listen(0,r));process.env.TG_API='http://127.0.0.1:'+srv.address().port
process.env.ADMIN_PASSWORD='x'
const {kv}=await import('../lib/db.js')
const {resetSec}=await import('../lib/settings.js')
const CS=await import('../lib/csbot.js')
const AD=await import('../lib/csadmin.js')
await kv.set('sec',{CSBOT_TOKEN:'111:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',CSBOT_CHAT_ID:'7001'});resetSec()
const ADM='7001'
let mid=1
const msg=(text,extra={})=>CS.csbotHandle({message:{message_id:++mid,from:{id:+ADM},chat:{id:+ADM},text,...extra}})
const cb=data=>CS.csbotHandle({callback_query:{id:'q',from:{id:+ADM},message:{message_id:9,chat:{id:+ADM}},data}})
const last=()=>[...sent].reverse().find(s=>s.chat===ADM)
const btn=(s,re)=>(s&&s.kb||[]).flat().find(b=>re.test(b.text))
// jalankan satu formulir: pilih menu, jawab satu per satu, tekan Jalankan
async function flow(key,answers,{confirm=true}={}){
 await cb('AA:'+key)
 for(const a of answers){await msg(a)}
 await sleep(20)
 if(confirm){const b=btn(last(),/Jalankan/);if(!b)return last();await cb(b.callback_data);await sleep(80)}
 return last()}
await kv.set('cfg',{})
const mk=async(id,email,balance=0)=>{await kv.set('u:'+id,{id,email,name:'N'+id,balance,tx:[],mut:[],apikey:'k'+id,pass:'x'});await kv.set('e:'+email,id);await kv.sadd('idx',id)}
await mk('u1','satu@x.com',0);await mk('u2','dua@x.com',0);await mk('u3','tiga@x.com',500)

// ---- 1. cakupan
const real=k=>(AD.ACT[k]&&AD.ACT[k].call)||k
const inMenu=new Set(AD.CATS.flatMap(c=>c[1]).map(real))
const PSEUDO_OK=new Set(['kelola/clean','data','maint/save','server','backup/import'])   // lewat layar khusus (~clean, ~info, ~maint, ~srv, ~import)
const BROWSER=new Set(['push/key','push/subscribe','push/unsubscribe','backup/page'])    // khusus peramban / unduhan web
const gap=AD.ALL.filter(a=>!inMenu.has(a)&&!PSEUDO_OK.has(a)&&!BROWSER.has(a))
ok(gap.length===0,'SEMUA aksi admin web punya tombol di menu bot CS'+(gap.length?' — belum: '+gap.join(', '):''))
ok(AD.CATS.flatMap(c=>c[1]).every(k=>k.startsWith('~')||AD.ACT[k]),'setiap tombol menu punya formulir')
await cb('AM');ok(btn(last(),/Promo/)&&btn(last(),/Konten/)&&btn(last(),/Integrasi/)&&btn(last(),/Pemeliharaan/),'menu utama memuat kategori baru')

// ---- 2. promo
let r=await flow('promo/welcome',['ya','5000']);let c=await kv.get('cfg')
ok(c.welcome.on===true&&c.welcome.amt===5000,'promo/welcome: bonus pendaftar tersimpan')
await flow('promo/ref',['ya','1000','500','5000','50']);c=await kv.get('cfg')
ok(c.ref.on&&c.ref.referrer===1000&&c.ref.referee===500&&c.ref.minDep===5000&&c.ref.maxRef===50,'promo/ref: referral tersimpan')
ok(c.welcome.amt===5000,'… dan bonus pendaftar TIDAK ikut tertimpa (hanya bagian itu yang berubah)')
await flow('promo/bonus',['ya','10000','5','20000','0, 6','10']);c=await kv.get('cfg')
ok(c.bonus.on&&c.bonus.pct===5&&c.bonus.max===20000&&JSON.stringify(c.bonus.days)==='[0,6]'&&c.bonus.dayPct===10,'promo/bonus: bonus deposit + hari ekstra')
await flow('promo/weekly',['ya','spent','50000,30000,20000','10000']);c=await kv.get('cfg')
ok(c.weekly.on&&c.weekly.metric==='spent'&&JSON.stringify(c.weekly.prizes)==='[50000,30000,20000]'&&c.ref.on,'promo/weekly: hadiah mingguan; referral tetap utuh')
await cb('AA:promo/show');ok(/Bonus pendaftar/.test(last().text)&&/50\.000/.test(last().text),'promo/show: ringkasan tampil')

// ---- 3. popup (bawaan situs sudah punya popup contoh; yang baru ditambah di belakangnya, sama seperti di web)
const {getCfg}=await import('../lib/bonus.js')
const base=((await getCfg()).pops||[]).length,N=base+1
await flow('pop/add',['Promo Akhir Tahun','Diskon besar','PROMO','Belanja','https://x.id','jeda','3']);c=await kv.get('cfg')
ok(c.pops.length===N&&c.pops[base].title==='Promo Akhir Tahun'&&c.pops[base].btns[0].href==='https://x.id','pop/add: popup baru tersimpan di belakang yang lama')
await cb('AA:pop/show');ok(new RegExp(N+'\\. .*Promo Akhir Tahun').test(last().text),'pop/show: terdaftar dengan nomornya')
await flow('pop/toggle',[String(N),'tidak']);c=await kv.get('cfg');ok(c.pops[base].on===false&&c.pops.length===N,'pop/toggle: dimatikan')
r=await flow('pop/toggle',['99','ya']);ok(new RegExp('Nomor harus 1–'+N).test(r.text),'nomor popup di luar daftar ditolak dengan pesan jelas')
await flow('pop/del',[String(N)]);c=await kv.get('cfg');ok(c.pops.length===base,'pop/del: dihapus')

// ---- 4. leaderboard & live
await flow('lb/add',['sari@x.com','5000','10','20000','8','15000']);let lb=await kv.get('lb_manual')
ok(lb.length===1&&lb[0].name==='sari@x.com'&&lb[0].trx===10,'lb/add: data manual ditambah')
await flow('lb/edit',[lb[0].id,'sari@x.com','7000','12','20000','9','16000']);lb=await kv.get('lb_manual');ok(lb[0].trx===12&&lb[0].balance===7000,'lb/edit: diubah')
await flow('lb/del',[lb[0].id]);ok((await kv.get('lb_manual')).length===0,'lb/del: dihapus')
await flow('live/add',['Budi','WhatsApp','Indonesia','4500','sukses']);let lv=await kv.get('live_manual')
ok(lv.length===1&&lv[0].service==='WhatsApp'&&lv[0].price===4500,'live/add: data live ditambah')
await flow('live/del',[lv[0].id]);ok((await kv.get('live_manual')).length===0,'live/del: dihapus')

// ---- 5. konten lain
await flow('apk/save',['ya','https://x.id/app.apk','1.2','18 MB','-']);c=await kv.get('cfg');ok(c.apk.on&&c.apk.url==='https://x.id/app.apk'&&c.apk.ver==='1.2','apk/save: APK tersimpan')
await flow('buttons',['Website | https://artapedia.id\nChannel | https://t.me/x']);c=await kv.get('cfg');ok(c.buttons.length===2&&c.buttons[1].url==='https://t.me/x','buttons: 2 tombol notif channel')
await flow('tap/save',['ya','15','a@x.com, b@x.com']);c=await kv.get('cfg');ok(c.tap.on&&c.tap.n===15&&c.tap.emails.length===2,'tap/save tersimpan')

// ---- 6. notifikasi pengguna baru
await flow('nf',['tidak','ya','tidak']);c=await kv.get('cfg')
ok(c.nf.web===false&&c.nf.bot===true&&c.nf.rs===false,'nf: saklar notifikasi pengguna baru (web off, bot on, reseller off)')
await cb('AA:nf/show');ok(/Web: ⚪ OFF/.test(last().text)&&/Bot utama: 🟢 ON/.test(last().text),'nf/show menampilkan status')

// ---- 7. integrasi (rahasia dihapus dari chat)
await cb('AA:sec/set');await msg('BUKAN_KUNCI');ok(/tidak dikenal/.test(last().text),'sec/set: nama kunci salah ditolak')
await msg('telegram_chat_id');const secMsgId=mid+1;await msg('-100777888')
ok(/••••/.test(last().text)&&!/100777888/.test(last().text),'sec/set: ringkasan konfirmasi menyembunyikan nilai rahasia')
ok(gone.includes(secMsgId),'sec/set: pesan berisi nilai rahasia DIHAPUS dari chat')
await cb(btn(last(),/Jalankan/).callback_data);await sleep(80)
ok((await kv.get('sec')).TELEGRAM_CHAT_ID==='-100777888','sec/set: kunci tersimpan lewat kode admin web')
await cb('AA:sec/get');await sleep(50);ok(!/AAAAAAAAAAAA/.test(JSON.stringify(sent.slice(-3))),'sec/get: token tidak bocor')

// ---- 8. deposit, server, gateway
await flow('dep/limits',['3000','5000000']);c=await kv.get('cfg');ok(c.dep.min===3000&&c.dep.max===5000000,'dep/limits: batas deposit')
await flow('dep/engine',['v2']);c=await kv.get('cfg');ok(c.dep.engine==='v2'&&c.dep.min===3000,'dep/engine: mesin v2, batas tetap')
await cb('AA:dep/show');ok(/Deposit/.test(last().text),'dep/show tampil')
const SV=(await import('../lib/providers.js')).SERVERS[0].server
await flow('srv/edit',[SV,'Server Super','HOT','.']);c=await kv.get('cfg')
ok(c.srv&&c.srv[SV]&&c.srv[SV].name==='Server Super'&&c.srv[SV].badge==='HOT','srv/edit: nama & lencana server')
await flow('pay/switch',['ya','ya','tidak']);c=await kv.get('cfg');ok(c.pay.on&&c.pay.wdOn&&c.pay.instOn===false,'pay/switch: saklar gateway')
await flow('pay/fee',['Artapedia Pay','3','500','2000','5000000']);c=await kv.get('cfg');ok(c.pay.fee===3&&c.pay.feeFlat===500&&c.pay.min===2000&&c.pay.on,'pay/fee: fee & batas (saklar tetap)')
await flow('pay/wdset',['10000','8000000','2','1000','3000']);c=await kv.get('cfg');ok(c.pay.wdMin===10000&&c.pay.wdMax===8000000&&c.pay.wdPct===2&&c.pay.fee===3,'pay/wdset: aturan tarik dana')
await flow('qris/save',['Toko Saya','ID123','-']);c=await kv.get('cfg');ok(c.qris.name==='Toko Saya'&&c.qris.nmid==='ID123','qris/save tersimpan')

// ---- 9. pengguna, reseller, bot
await flow('user/kick',['satu@x.com']);ok((await kv.get('u:u1')).pwAt>0,'user/kick: sesi login dicabut')
r=await flow('user/bulkdel',['u2 u3','tidak']);await sleep(50)
ok(!(await kv.get('u:u2'))&&!!(await kv.get('u:u3')),'user/bulkdel: akun kosong terhapus, akun bersaldo dilewati')
await flow('rs/reg/save',['ya','50','tidak','10','7']);const rg=await kv.get('rscfg')
ok(rg&&rg.komisi.slots===50&&rg.mandiri.open===false&&rg.depPct===7,'rs/reg/save: pendaftaran reseller diatur')
r=await flow('bots/add',['123456789:AAHxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx','-']);ok(/Gagal/.test(r.text),'bots/add: token ditolak Telegram -> pesan gagal jelas')

// ---- 10. CS & AI
await flow('cs/ai/save',['Nona','Ramah dan singkat','Jam buka 24 jam']);c=await kv.get('cfg');ok(c.cs.name==='Nona'&&c.cs.style==='Ramah dan singkat','cs/ai/save: nama & gaya AI')
await flow('cs/ai/train/add',['Cara deposit?','Buka menu Deposit lalu pilih QRIS.']);c=await kv.get('cfg')
ok(c.cs.train.length===1&&c.cs.train[0].q==='Cara deposit?','cs/ai/train/add: latihan baru')
await flow('cs/ai/save',['Nona','-','-']);c=await kv.get('cfg');ok(c.cs.train.length===1&&c.cs.style==='Ramah dan singkat','ubah nama AI: latihan & gaya tidak hilang')
await cb('AA:cs/ai/show');ok(/Cara deposit\?/.test(last().text),'cs/ai/show: daftar latihan')
await flow('cs/ai/train/del',['1']);c=await kv.get('cfg');ok(c.cs.train.length===0,'cs/ai/train/del')

// ---- 11. job, backup, maintenance otomatis
await flow('job/save',['-','Follow channel','Ikuti channel kami','https://t.me/x','500','2','ya']);await cb('AA:job/list');await sleep(50)
ok(/Follow channel/.test(JSON.stringify(sent.slice(-3))),'job/save + job/list: job baru tampil')
await flow('backup/cfg',['ya','12']);c=await kv.get('cfg');ok(c.backup.on&&c.backup.hours===12,'backup/cfg: jadwal backup')
await flow('auto/save',['ya','4','ya','45','ya','10','tidak']);c=await kv.get('cfg');ok(c.autoc.mins===4&&c.autoc.userDays===45&&c.autoc.notifyUsers===false,'auto/save: maintenance otomatis')
r=await flow('backup/wipe',['salah']);ok(/Gagal|Konfirmasi salah/.test(r.text)&&!!(await kv.get('u:u3')),'backup/wipe: konfirmasi salah -> data aman')

// ---- 12. impor backup lewat file
const entries=[{k:'u:imp1',v:{id:'imp1',email:'imp@x.com',name:'Imp',balance:99,tx:[],mut:[],pass:'x'}},{k:'e:imp@x.com',v:'imp1'}]
fileBody=zlib.gzipSync(Buffer.from(JSON.stringify({app:'artapedia-id',entries})))
await cb('AA:~import');ok(btn(last(),/Gabungkan/)&&btn(last(),/Ganti total/),'~import: pilihan gabung / ganti total')
await cb('AI:g');ok(/Kirim <b>file backup/.test(last().text),'~import: minta file')
await msg('',{document:{file_id:'f1',file_size:300}});await sleep(150)
ok(/Impor selesai/.test(last().text)&&(await kv.get('u:imp1'))&&(await kv.get('u:imp1')).balance===99,'~import: file .json.gz dibaca & data dipulihkan')
fileBody=Buffer.from('{"bukan":"backup"}');await cb('AI:g');await msg('',{document:{file_id:'f2',file_size:20}});await sleep(100)
ok(/bukan file backup/i.test(last().text),'~import: file salah ditolak')

// ---- 13. keamanan: hanya ID admin
const sc=sent.length
await CS.csbotHandle({callback_query:{id:'q',from:{id:999},message:{message_id:9,chat:{id:999}},data:'AA:sec/set'}});await sleep(30)
ok(!sent.slice(sc).some(s=>/Nama kunci/.test(s.text||'')),'bukan admin: formulir integrasi tidak terbuka')

console.log(`\n${pass} lulus, ${fail} gagal`);srv.close();process.exit(fail?1:0)
