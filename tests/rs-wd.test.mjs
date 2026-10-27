// Penarikan reseller MANUAL: ajukan -> notif (admin, channel) -> admin sukses/tolak -> notif + struk. Jalankan: npx tsx tests/rs-wd.test.mjs
process.env.ADMIN_PASSWORD='pwx'
const {kv}=await import('../lib/db.js')
const {resetSec}=await import('../lib/settings.js')
const RS=await import('../lib/reseller.js')
const TB=await import('../lib/tgbot.js')
let pass=0,fail=0
const ok=(c,m)=>{c?pass++:fail++;console.log((c?'  ✔ ':'  ✘ ')+m)}
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
const calls=[]
globalThis.fetch=async(url,o={})=>{url=String(url);const m=url.match(/\/bot([^/]+)\/(\w+)/);const J=x=>new Response(JSON.stringify(x),{status:200,headers:{'content-type':'application/json'}})
 if(!m)return J({ok:true});let b={};try{b=typeof o.body==='string'?JSON.parse(o.body):{}}catch(e){}
 if(o.body&&typeof o.body.get==='function'){b={chat_id:o.body.get('chat_id'),caption:o.body.get('caption'),text:o.body.get('text')}}
 calls.push({token:m[1],method:m[2],b});return J({ok:true,result:{message_id:9}})}
const flush=async()=>{await sleep(80);return calls.splice(0)}
const to=(cs,chat)=>cs.filter(c=>String(c.b.chat_id)===String(chat)&&/send/.test(c.method)).map(c=>JSON.stringify(c.b)).join('\n')
await kv.set('sec',{TELEGRAM_BOT_TOKEN:'1:x',TELEGRAM_CHAT_ID:'-1',SITE_URL:'https://x.id'});resetSec()
const botMain={id:'bm',token:'111:main',username:'artabot',secret:'s',on:true,admins:['5000']}
const botRs={id:'br',token:'222:rs',username:'tokobot',secret:'s2',on:true,rs:'rs1'}
await kv.set('bots',[botMain,botRs])
const seed=async(extra={})=>kv.set('rs:rs1',{uid:'rs1',on:true,mode:'komisi',balance:100000,stok:0,earn:0,sold:0,bot:{id:'br',ownerId:'7777',username:'tokobot'},brand:'Toko Maju',ch:{id:'-100777'},wd:[],dep:[],log:[],sreq:[],...extra})
await seed()
const bal=async()=>(await RS.getRs('rs1')).balance

console.log('\n[A] Validasi')
for(const [b,re,m] of [[{wallet:'DANA',phone:'0812',holder:'Budi',nominal:50000},/5-20 digit/,'nomor terlalu pendek ditolak'],
 [{wallet:'DANA',phone:'081234567890',holder:'B',nominal:50000},/nama pemilik/,'nama tidak valid ditolak'],
 [{wallet:'DANA',phone:'081234567890',holder:'Budi',nominal:5000},/minimal/i,'di bawah minimal ditolak'],
 [{wallet:'DANA',phone:'081234567890',holder:'Budi',nominal:900000},/tidak cukup/,'saldo kurang ditolak'],
 [{wallet:'Bank',phone:'1234567',holder:'Budi',nominal:50000},/nama banknya/,'Bank tanpa nama bank ditolak'],
 [{wallet:'PAYPAL',phone:'081234567890',holder:'Budi',nominal:50000},/Pilih tujuan/,'tujuan asing ditolak']]){
 let e;try{await RS.withdraw('rs1',b)}catch(x){e=x}ok(e&&re.test(e.message),m)}
ok(await bal()===100000,'semua validasi gagal: saldo utuh')

console.log('\n[B] Ajukan → saldo ditahan, notif admin + channel')
calls.length=0
const r=await RS.withdraw('rs1',{wallet:'DANA',phone:'081234567890',holder:'Budi Santoso',nominal:50000})
let x=await flush()
ok(r.status==='processing'&&await bal()===50000,'status diproses, saldo 100.000→50.000 (ditahan)')
ok(/permintaan tarik saldo reseller/i.test(to(x,'-1'))&&/Toko Maju/.test(to(x,'-1'))&&/Budi Santoso/.test(to(x,'-1')),'channel ADMIN dapat notif proses (toko, nama, nominal)')
ok(/Penarikan diproses/.test(to(x,'-100777'))&&!/081234567890/.test(to(x,'-100777')),'channel RESELLER dapat notif proses, nomor disamarkan')
ok((await RS.wdPending()).length===1,'masuk antrean admin')

console.log('\n[C] Batas jumlah penarikan terbuka')
await RS.withdraw('rs1',{wallet:'OVO',phone:'081111111111',holder:'Budi',nominal:10000})
await RS.withdraw('rs1',{wallet:'OVO',phone:'081111111111',holder:'Budi',nominal:10000})
let e;try{await RS.withdraw('rs1',{wallet:'OVO',phone:'081111111111',holder:'Budi',nominal:10000})}catch(x2){e=x2}
ok(e&&/belum diproses/.test(e.message),'maks 3 penarikan menunggu; ke-4 ditolak')
ok(await bal()===30000,'saldo benar setelah 3 penarikan (50k+10k+10k ditahan)')

console.log('\n[D] Admin tandai SUKSES')
calls.length=0
const s=await RS.wdResolve('rs1',r.id,true)
x=await flush()
ok(s.status==='success'&&await bal()===30000,'sukses: saldo tetap (sudah ditahan)')
ok(/SUKSES/.test(to(x,'-1')),'channel ADMIN dapat notif sukses')
ok(/Penarikan berhasil/.test(to(x,'-100777')),'channel RESELLER dapat notif sukses')
ok(/Penarikan berhasil/.test(to(x,'7777')),'DM pemilik toko dapat notif sukses')
e=null;try{await RS.wdResolve('rs1',r.id,true)}catch(x3){e=x3}ok(e&&/sudah/.test(e.message),'tandai dua kali ditolak')
e=null;try{await RS.wdResolve('rs1',r.id,false)}catch(x3){e=x3}ok(e&&/sudah/.test(e.message)&&await bal()===30000,'tolak setelah sukses ditolak, saldo tidak berubah')

console.log('\n[E] Admin TOLAK → saldo kembali')
const pend=await RS.wdPending();const w2=pend[0].wd
calls.length=0
await RS.wdResolve('rs1',w2.id,false,'Nomor salah')
x=await flush()
ok(await bal()===40000,'ditolak: saldo +10.000 kembali')
ok(/DITOLAK/.test(to(x,'-1'))&&/ditolak/i.test(to(x,'-100777'))&&/Nomor salah/.test(to(x,'7777')),'notif tolak ke admin, channel, dan DM (dengan alasan)')

console.log('\n[F] Bot reseller: alur tarik')
await seed({balance:80000})
let uid=1
const msg=(bot,from,text)=>TB.handle(bot,{update_id:uid++,message:{message_id:uid,date:1,chat:{id:from,type:'private'},from:{id:from,first_name:'U'+from},text}})
const cb=(bot,from,data)=>TB.handle(bot,{update_id:uid++,callback_query:{id:'cb'+uid,from:{id:from,first_name:'U'+from},message:{message_id:5,chat:{id:from,type:'private'}},data}})
const sent=cs=>cs.filter(c=>/send|edit/.test(c.method)).map(c=>JSON.stringify(c.b)).join('\n')
await msg(botRs,7777,'/start');await flush()
await cb(botRs,7777,'a');x=await flush();ok(/"callback_data":"rwd"/.test(sent(x)),'Panel Toko punya tombol 💸 Tarik Saldo')
await cb(botRs,7777,'rwd');x=await flush();ok(/TARIK SALDO/.test(sent(x)),'menu tarik terbuka')
await cb(botRs,7777,'rwdw:0');x=await flush();ok(/NOMOR TUJUAN/.test(sent(x)),'pilih DANA → minta nomor')
await msg(botRs,7777,'081234567890');x=await flush();ok(/ATAS NAMA/.test(sent(x)),'nomor → minta atas nama')
await msg(botRs,7777,'Budi Santoso');x=await flush();ok(/NOMINAL TARIK/.test(sent(x)),'nama → minta nominal')
await msg(botRs,7777,'5000');x=await flush();ok(/Minimal/.test(sent(x)),'nominal di bawah minimal ditolak')
await msg(botRs,7777,'30rb');x=await flush();ok(/KONFIRMASI PENARIKAN/.test(sent(x)),'nominal 30rb → konfirmasi')
await cb(botRs,7777,'rwdy');x=await flush()
ok(/PENARIKAN DIAJUKAN/.test(sent(x))&&await bal()===50000,'ajukan → saldo 80.000→50.000')
ok(/permintaan tarik saldo reseller/i.test(to(x,'-1')),'admin dapat notif')
await cb(botRs,8888,'rwd');x=await flush();ok(/Khusus pemilik/.test(sent(x)),'bukan pemilik toko ditolak')

console.log('\n[G] Bot admin: proses penarikan')
await cb(botMain,5000,'a');x=await flush();ok(/"callback_data":"rwa"/.test(sent(x)),'Panel Admin punya tombol 💸 Tarik Reseller')
await cb(botMain,5000,'rwa');x=await flush();const wid=(sent(x).match(/rwo:([a-f0-9]+)/)||[])[1];ok(!!wid,'daftar menunggu muncul')
await cb(botMain,5000,'rwo:'+wid);x=await flush();ok(/Budi Santoso/.test(sent(x)),'detail menampilkan tujuan')
await cb(botMain,6666,'rwy:'+wid);x=await flush();ok(/Khusus admin/.test(sent(x)),'non-admin tidak bisa memproses')
await cb(botMain,5000,'rwy:'+wid);x=await flush()
ok((await RS.getRs('rs1')).wd[0].status==='success','admin tekan Sudah Transfer → sukses')
ok(/Penarikan berhasil/.test(to(x,'-100777')),'channel reseller dikabari sukses')
console.log(`\nHasil: ${pass} lulus, ${fail} gagal`);process.exit(fail?1:0)
