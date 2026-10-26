// Force join bot utama & bot reseller: pasang channel lewat bot, gerbang join, cek ulang, pengecualian admin, fail-open.
// Jalankan dari akar proyek: npx tsx tests/forcejoin.test.mjs
process.env.ADMIN_PASSWORD='pwx'
const {kv}=await import('../lib/db.js')
const {resetSec}=await import('../lib/settings.js')
const FJ=await import('../lib/forcejoin.js')
const TB=await import('../lib/tgbot.js')
let pass=0,fail=0
const ok=(c,m)=>{c?pass++:fail++;console.log((c?'  ✔ ':'  ✘ ')+m)}
const sleep=ms=>new Promise(r=>setTimeout(r,ms))

// ---- Telegram palsu ----
const calls=[];const members={};let apiDown=false
const chats={'@kanalku':{id:-1001,type:'channel',title:'Kanal Ku',username:'kanalku'},'@privat':{id:-1002,type:'supergroup',title:'Grup Privat'},'@bukanadmin':{id:-1003,type:'channel',title:'Tanpa Admin',username:'bukanadmin'}}
const byId=Object.fromEntries(Object.values(chats).map(c=>[String(c.id),c]))
globalThis.fetch=async(url,o={})=>{
 url=String(url);const m=url.match(/\/bot([^/]+)\/(\w+)/);const J=x=>new Response(JSON.stringify(x),{status:200,headers:{'content-type':'application/json'}})
 if(!m)return J({ok:true})
 const method=m[2];let b={};try{b=typeof o.body==='string'?JSON.parse(o.body):{}}catch(e){}
 calls.push({method,b,token:m[1]})
 if(method==='getChat'){const c=chats[b.chat_id]||byId[String(b.chat_id)];return c?J({ok:true,result:c}):J({ok:false,description:'chat not found'})}
 if(method==='getChatMember'){
  if(apiDown)return J({ok:false,description:'Bad Request: internal'})
  const bot=+m[1].split(':')[0]
  if(b.user_id===bot)return J({ok:true,result:{status:String(b.chat_id)==='-1003'?'member':'administrator'}})
  const st=members[b.chat_id+':'+b.user_id]||'left';return J({ok:true,result:{status:st}})}
 if(method==='exportChatInviteLink')return J({ok:true,result:'https://t.me/+invitePrivat'})
 return J({ok:true,result:{message_id:99}})}
const flush=async()=>{await sleep(40);return calls.splice(0)}
const texts=cs=>cs.filter(c=>/send(Rich)?Message|editMessage|sendPhoto/.test(c.method)).map(c=>JSON.stringify(c.b)).join('\n')

await kv.set('sec',{TELEGRAM_BOT_TOKEN:'1:x',TELEGRAM_CHAT_ID:'-1'});resetSec()
const ADMIN=5000,botMain={id:'bm',token:'111:main',username:'artabot',secret:'s',on:true,admins:[String(ADMIN)]}
const botRs={id:'br',token:'222:rs',username:'tokobot',secret:'s2',on:true,rs:'rs1'}
await kv.set('bots',[botMain,botRs])
await kv.set('rs:rs1',{uid:'owner1',on:true,mode:'komisi',balance:0,stok:0,earn:0,sold:0,bot:{id:'br',ownerId:'7777'},brand:'Toko Maju',wd:[],dep:[],sreq:[]})
let uid=1
const msg=(bot,from,text)=>TB.handle(bot,{update_id:uid++,message:{message_id:uid,date:1,chat:{id:from,type:'private'},from:{id:from,first_name:'U'+from,username:'u'+from},text}})
const cb=(bot,from,data)=>TB.handle(bot,{update_id:uid++,callback_query:{id:'cb'+uid,from:{id:from,first_name:'U'+from},message:{message_id:5,chat:{id:from,type:'private'}},data}})

// ---- util ----
ok(FJ.fjParse('https://t.me/kanalku').chat==='@kanalku'&&FJ.fjParse('@kanalku').chat==='@kanalku'&&FJ.fjParse('1001234567').chat==='-1001001234567'&&FJ.fjParse('-1001234567').chat==='-1001234567','fjParse: link, @username, ID angka')
ok(!!FJ.fjParse('https://t.me/+abcdef').error&&!!FJ.fjParse('??').error,'fjParse: undangan privat & format salah ditolak')

// ---- bot utama: admin memasang channel ----
await msg(botMain,ADMIN,'/start');await flush()
await cb(botMain,ADMIN,'a');let x=await flush()
ok(/Force Join/.test(texts(x)),'Panel Admin punya tombol 🔒 Force Join')
await cb(botMain,ADMIN,'a:fjt');x=await flush()
ok(/Tambahkan minimal satu channel/.test(texts(x)),'menyalakan tanpa channel ditolak')
await cb(botMain,ADMIN,'a:fja');await flush()
await msg(botMain,ADMIN,'@bukanadmin');x=await flush()
ok(/belum jadi/.test(texts(x))&&/admin/.test(texts(x)),'bot bukan admin di channel -> ditolak dengan petunjuk')
await msg(botMain,ADMIN,'@tidakada');x=await flush()
ok(/tidak ditemukan/.test(texts(x)),'channel tidak ada -> ditolak')
await msg(botMain,ADMIN,'@kanalku');x=await flush()
ok(/Kanal Ku/.test(texts(x))&&/ditambahkan/.test(texts(x)),'channel valid ditambahkan')
await cb(botMain,ADMIN,'a:fja');await flush();await msg(botMain,ADMIN,'@privat');await flush()
let cfg=await kv.get('cfg');ok(cfg.fj&&cfg.fj.chats.length===2&&cfg.fj.chats[1].link==='https://t.me/+invitePrivat','2 channel tersimpan; channel privat memakai tautan undangan')
await cb(botMain,ADMIN,'a:fjt');x=await flush();cfg=await kv.get('cfg')
ok(cfg.fj.on===true&&/AKTIF/.test(texts(x)),'Force Join dinyalakan')

// ---- pengguna biasa di bot utama ----
const U1=9001
await msg(botMain,U1,'/start');x=await flush()
let t=texts(x)
ok(/Wajib Join Dulu/.test(t)&&/Kanal Ku/.test(t)&&/Belum join/.test(t),'pengguna belum join: layar "Wajib Join Dulu" (pesan kaya)')
ok(x.some(c=>c.method==='sendRichMessage'),'dikirim sebagai pesan KAYA (sendRichMessage)')
ok(/Saya Sudah Join/.test(t)&&/https:\/\/t\.me\/kanalku/.test(t)&&/invitePrivat/.test(t),'tombol Join tiap channel + tombol "Saya Sudah Join"')
ok(!/Menu Utama|Beli Nokos/.test(t),'menu bot TIDAK terbuka')
await cb(botMain,U1,'buy');x=await flush()
ok(/Wajib Join Dulu/.test(texts(x))&&!/Pilih Server/i.test(texts(x)),'tombol lain (Beli Nokos) juga diblokir selagi belum join')
await cb(botMain,U1,'fjc');x=await flush()
ok(x.some(c=>c.method==='answerCallbackQuery'&&/belum join/i.test(c.b.text)&&c.b.show_alert),'cek ulang saat belum join: popup peringatan')
members['-1001:'+U1]='member'                       // join kanal 1 saja
await cb(botMain,U1,'fjc');x=await flush();t=texts(x)
ok(/Wajib Join Dulu/.test(t)&&/Sudah join/.test(t)&&/Belum join/.test(t),'join sebagian: masih tertahan, status per channel ter-update')
members['-1002:'+U1]='member'
await cb(botMain,U1,'fjc');x=await flush();t=texts(x)
ok(x.some(c=>c.method==='answerCallbackQuery'&&/Terima kasih/.test(c.b.text))&&!/Wajib Join Dulu/.test(t),'semua sudah join: menu terbuka')
await msg(botMain,U1,'/start');x=await flush()
ok(!/Wajib Join Dulu/.test(texts(x)),'setelah join: /start langsung lolos')
await msg(botMain,ADMIN,'/start');x=await flush()
ok(!/Wajib Join Dulu/.test(texts(x)),'admin bot tidak perlu join')

// fail-open
const U2=9002;apiDown=true
await msg(botMain,U2,'/start');x=await flush()
ok(!/Wajib Join Dulu/.test(texts(x)),'Telegram error saat cek keanggotaan: pengguna TIDAK dikunci (fail-open)')
apiDown=false

// ---- hapus channel ----
await cb(botMain,ADMIN,'a:fjd:0');await cb(botMain,ADMIN,'a:fjd:0');await flush();cfg=await kv.get('cfg')
ok(cfg.fj.chats.length===0&&cfg.fj.on===false,'hapus semua channel: Force Join otomatis mati')
const U3=9003;await msg(botMain,U3,'/start');x=await flush()
ok(!/Wajib Join Dulu/.test(texts(x)),'Force Join mati: semua pengguna lolos')

// ---- bot reseller: pemilik toko ----
const OWN=7777,C1=9101
await cb(botRs,OWN,'a');x=await flush()
ok(/Force Join/.test(texts(x)),'Panel Toko reseller punya tombol 🔒 Force Join')
await cb(botRs,OWN,'a:fja');await flush();await msg(botRs,OWN,'@kanalku');x=await flush()
ok(/Kanal Ku/.test(texts(x)),'pemilik toko menambah channel')
await cb(botRs,OWN,'a:fjt');await flush()
const rs=await kv.get('rs:rs1');ok(rs.fj&&rs.fj.on&&rs.fj.chats.length===1,'pengaturan tersimpan di data toko (rs:rs1.fj)')
await msg(botRs,C1,'/start');x=await flush()
ok(/Wajib Join Dulu/.test(texts(x))&&/Kanal Ku/.test(texts(x)),'pelanggan toko belum join: layar wajib join')
const cfgNow=await kv.get('cfg');ok(!cfgNow.fj||!cfgNow.fj.on,'setelan toko TIDAK mengubah bot utama')
await msg(botMain,C1,'/start');x=await flush()
ok(!/Wajib Join Dulu/.test(texts(x)),'bot utama tidak ikut terkunci oleh setelan toko')
members['-1001:'+C1]='administrator'
await cb(botRs,C1,'fjc');x=await flush()
ok(x.some(c=>c.method==='answerCallbackQuery'&&/Terima kasih/.test(c.b.text)),'pelanggan toko join -> lanjut')
await msg(botRs,OWN,'/start');x=await flush()
ok(!/Wajib Join Dulu/.test(texts(x)),'pemilik toko bebas dari force join')
// pelanggan biasa (bukan pemilik) tidak bisa membuka menu Force Join
await cb(botRs,C1,'a:fja');x=await flush()
ok(/Khusus pemilik/.test(texts(x)),'pelanggan tidak bisa membuka pengaturan Force Join')

console.log(`\n${pass} lulus, ${fail} gagal`);process.exit(fail?1:0)
