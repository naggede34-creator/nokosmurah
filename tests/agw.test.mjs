// Tes Admin Gateway (SMP Payment) + perintah saldo di bot Customer Service.
// Jalankan dari akar proyek (tanpa MONGODB_URI, memakai database memori): npx tsx tests/agw.test.mjs
process.env.CRON_SECRET='cronsecret'
const {kv}=await import('../lib/db.js')
const {resetSec}=await import('../lib/settings.js')
const G=await import('../lib/agw.js')
const {sign}=await import('../lib/webhook.js')
const CB=await import('../app/api/callbackqris/[key]/route.js')
const API=await import('../app/api/agw/[...p]/route.js')
const BOT=await import('../lib/csbot.js')
const crypto=(await import('crypto')).default
let pass=0,fail=0
const ok=(c,m)=>{c?pass++:fail++;console.log((c?'  ✔ ':'  ✘ ')+m)}

// ---- QRIS statis valid ----
const crc=s=>{let c=0xFFFF;for(let i=0;i<s.length;i++){c^=s.charCodeAt(i)<<8;for(let j=0;j<8;j++)c=(c&0x8000)?((c<<1)^0x1021):(c<<1);c&=0xFFFF}return c.toString(16).toUpperCase().padStart(4,'0')}
let q='00020101021126260012ID.CO.EXAMPLE.WWW01101234567895204541153033605802ID5909TOKO TEST6007JAKARTA6304'
const QRIS=q+crc(q)
const setSec=async o=>{await kv.set('sec',o);resetSec()}
await setSec({SMP_SECRET:'sekret123',SMP_QRIS:QRIS,SMP_USERNAME:'jhon',CSBOT_TOKEN:'111:AAA',CSBOT_CHAT_ID:'111'})

// ---- mock fetch (webhook + Telegram) ----
const sent=[];let hookStatus=200
globalThis.fetch=async(url,opt={})=>{
 url=String(url);const J=(o,s=200)=>new Response(JSON.stringify(o),{status:s,headers:{'content-type':'application/json'}})
 if(url.includes('api.telegram.org')){sent.push({m:url.split('/').pop(),b:opt.body?JSON.parse(opt.body):{}});return J({ok:true,result:{message_id:1}})}
 if(url.startsWith('https://93.184.216.34/')){sent.push({m:'webhook',h:opt.headers,raw:opt.body});return new Response('',{status:hookStatus})}
 return J({ok:false},404)}
const wait=ms=>new Promise(r=>setTimeout(r,ms))
const smpCb=(total,rrn,extra={})=>CB.POST(new Request('http://x/api/callbackqris/sekret123',{method:'POST',body:JSON.stringify({rrn,amount:{value:String(total)+'.00'},us_username:'jhon',PayerName:'BUDI',issuer:'DANA',timestamp:'2026-10-19',...extra})}),{params:{key:'sekret123'}})
const api=async(method,path,{key,body,headers={}}={})=>{
 const raw=body?JSON.stringify(body):''
 const h={...(key?{'x-api-key':key}:{}),...headers}
 const r=await (method==='POST'?API.POST:API.GET)(new Request('http://x/api/agw/'+path,{method,headers:h,body:raw||undefined}),{params:{p:path.split('?')[0].split('/')}})
 return {s:r.status,j:await r.json()}}

console.log('\n[A] Key & pengaturan')
const k1=await G.createKey('Toko Budi'),k2=await G.createKey('Aplikasi Lain')
ok(/^agw_live_[a-f0-9]{40}$/.test(k1.key),'format API key benar')
ok((await G.byKey(k1.key)).id===k1.id,'byKey menemukan key')
ok(await G.byKey('agw_live_'+'0'.repeat(40))===null,'key palsu ditolak')
await G.cfgSave({on:true,min:1000,max:5000000,expMin:15})
let e1;try{await G.createInvoice(k1,{amount:500})}catch(e){e1=e}
ok(e1&&e1.code==='invalid_amount','nominal di bawah minimum ditolak')
let e2;try{await G.createInvoice(k1,{amount:1000,order_id:'bad id!'})}catch(e){e2=e}
ok(e2&&e2.code==='invalid_order_id','order_id berisi karakter terlarang ditolak')

console.log('\n[B] Buat tagihan + idempotensi')
const a=await G.createInvoice(k1,{amount:25000,order_id:'INV-1',description:'Top up',metadata:{uid:7}})
ok(a.inv.total>25000&&a.inv.total<=25999,'total = nominal + kode unik (1-999): '+a.inv.total)
ok(a.inv.qr.startsWith('000201')&&a.inv.qr.includes('54'+String(String(a.inv.total).length).padStart(2,'0')+a.inv.total),'QRIS dinamis memuat total')
ok(a.inv.status==='pending'&&!a.existing,'status pending')
const a2=await G.createInvoice(k1,{amount:25000,order_id:'INV-1'})
ok(a2.existing&&a2.inv.id===a.inv.id,'order_id sama -> tagihan yang sama (idempoten)')
let e3;try{await G.createInvoice(k1,{amount:30000,order_id:'INV-1'})}catch(e){e3=e}
ok(e3&&e3.code==='order_conflict','order_id sama nominal beda -> konflik')
const b2=await G.createInvoice(k2,{amount:25000,order_id:'INV-1'})
ok(b2.inv.id!==a.inv.id&&b2.inv.total!==a.inv.total,'key lain: order_id boleh sama, total tidak bentrok')

console.log('\n[C] Callback SMP melunasi tagihan gateway')
let r=await smpCb(a.inv.total,'RRN-1');let j=await r.json()
ok(r.status===200&&j.responseCode==='2005200','callback sukses dibalas OK')
let inv=await G.getInvoice(a.inv.id)
ok(inv.status==='paid'&&inv.rrn==='RRN-1'&&inv.payer==='BUDI','tagihan lunas, RRN & pembayar tercatat')
r=await smpCb(a.inv.total,'RRN-1');j=await r.json()
ok(j.responseCode==='2005201','RRN yang sama dibalas duplikat')
const st=await G.stats()
ok(st.all.n===1&&st.all.sum===25000&&st.today.n===1,'statistik dihitung SEKALI (no double count)')
r=await smpCb(a.inv.total,'RRN-2');j=await r.json()
ok(j.responseCode==='2005200'&&(await G.getInvoice(a.inv.id)).rrn==='RRN-1','pembayaran lain dgn total sama tidak menimpa tagihan lunas')
ok(((await kv.get('smp:orphan'))||[]).some(x=>x.rrn==='RRN-2'),'... dan dicatat sebagai pembayaran tanpa tagihan')
r=await smpCb(b2.inv.total+1,'RRN-3');await r.json()
ok((await G.getInvoice(b2.inv.id)).status==='pending','nominal tidak cocok tidak melunasi tagihan')
r=await CB.POST(new Request('http://x/x',{method:'POST',body:'{}'}),{params:{key:'salah'}})
ok(r.status===401,'key callback salah -> 401')

console.log('\n[D] Status API, batal, kedaluwarsa')
ok((await G.checkInvoice(b2.inv.id)).status==='pending','status pending sebelum batas waktu')
const c=await G.createInvoice(k1,{amount:5000,order_id:'INV-C'})
const cancel=await G.cancelInvoice(c.inv.id,k1.id)
ok(cancel.status==='canceled','tagihan bisa dibatalkan')
r=await smpCb(c.inv.total,'RRN-C');await r.json()
ok((await G.getInvoice(c.inv.id)).status==='canceled','pembayaran untuk tagihan batal tidak melunasinya (kode unik sudah dilepas)')
let e4;try{await G.cancelInvoice(a.inv.id,k1.id)}catch(e){e4=e}
ok(e4&&e4.code==='already_paid','tagihan lunas tidak bisa dibatalkan')
let e5;try{await G.cancelInvoice(b2.inv.id,k1.id)}catch(e){e5=e}
ok(e5&&e5.code==='not_found','key lain tidak bisa membatalkan tagihan milik key ini')
const x=await G.createInvoice(k1,{amount:7000,order_id:'INV-X'})
const raw=await G.getInvoice(x.inv.id);raw.expMs=Date.now()-1000;await kv.set('agwi:'+x.inv.id,raw)
ok((await G.checkInvoice(x.inv.id)).status==='expired','lewat batas waktu -> expired')
r=await smpCb(x.inv.total,'RRN-X');await r.json()
inv=await G.getInvoice(x.inv.id)
ok(inv.status==='paid'&&inv.late===true,'bayar telat (masa tenggang) tetap diterima, ditandai telat')
let e6;try{await G.createInvoice(k1,{amount:7000,order_id:'INV-X'})}catch(e){e6=e}
ok(e6&&e6.code==='order_paid','order_id yang sudah dibayar tidak bisa dibuat ulang')

console.log('\n[E] Webhook bertanda tangan + ulang otomatis')
let hs=await G.setHook(k1.id,'https://93.184.216.34/hook',true)
ok(hs.hook.on&&/^whsec_/.test(hs.hook.secret),'webhook disimpan, secret dibuat')
let e7;try{await G.setHook(k1.id,'http://93.184.216.34/hook',true)}catch(e){e7=e}
ok(!!e7,'webhook non-https ditolak')
let e8;try{await G.setHook(k1.id,'https://10.0.0.5/hook',true)}catch(e){e8=e}
ok(!!e8,'webhook ke IP privat ditolak (anti-SSRF)')
sent.length=0;hookStatus=200
const w=await G.createInvoice(k1,{amount:12000,order_id:'INV-W'})
r=await smpCb(w.inv.total,'RRN-W');await r.json();await wait(80)
let wh=sent.find(z=>z.m==='webhook')
ok(!!wh,'webhook dikirim saat lunas')
if(wh){const ts=wh.h['X-AGW-Timestamp'],body=JSON.parse(wh.raw)
 ok(wh.h['X-AGW-Signature']===sign(hs.hook.secret,ts,wh.raw),'tanda tangan webhook benar (HMAC ts.body)')
 ok(body.event==='invoice.paid'&&body.order_id==='INV-W'&&body.total_pay===w.inv.total&&body.status==='paid','isi webhook benar')}
ok((await G.hookState(w.inv.id)).ok===true,'status pengiriman tercatat ok')
hookStatus=500;sent.length=0
const w2=await G.createInvoice(k1,{amount:13000,order_id:'INV-W2'})
r=await smpCb(w2.inv.total,'RRN-W2');await r.json();await wait(80)
let hst=await G.hookState(w2.inv.id)
ok(hst&&!hst.ok&&hst.n===1&&hst.next>Date.now(),'webhook gagal dijadwalkan ulang (n=1)')
let sw=await G.sweep(Date.now()+5000)
ok(sw.retried===0,'sweep belum mengulang sebelum jadwal')
hst.next=Date.now()-1;await kv.set('agwh:'+w2.inv.id,hst);hookStatus=200;sent.length=0
sw=await G.sweep(Date.now()+5000)
ok(sw.retried===1&&(await G.hookState(w2.inv.id)).ok===true,'sweep mengulang & berhasil')
const kk=await G.keyById(k1.id)
const tst=await G.testHook(kk);ok(tst.ok&&tst.code===200,'tes webhook dari admin berhasil')

console.log('\n[F] API developer (header, IP, HMAC, isolasi key)')
let t=await api('GET','ping');ok(t.s===401&&t.j.code==='missing_api_key','tanpa key -> 401')
t=await api('GET','ping',{key:'agw_live_'+'1'.repeat(40)});ok(t.s===401&&t.j.code==='invalid_api_key','key salah -> 401')
t=await api('GET','ping',{key:k1.key});ok(t.s===200&&t.j.success&&t.j.app.name==='Toko Budi','ping OK')
t=await api('POST','qris/create',{key:k1.key,body:{amount:20000,order_id:'API-1',description:'via api',customer_name:'Ani'}})
ok(t.s===201&&t.j.invoice.total_pay>20000&&t.j.invoice.qr_image.includes('qrserver')&&t.j.invoice.status==='pending','create via API -> 201')
const apiInv=t.j.invoice
t=await api('POST','qris/create',{key:k1.key,body:{amount:20000,order_id:'API-1'}})
ok(t.s===200&&t.j.idempotent===true&&t.j.invoice.invoice_id===apiInv.invoice_id,'retry order_id sama -> idempotent')
t=await api('POST','qris/create',{key:k1.key,body:{amount:'abc'}});ok(t.s===422&&t.j.code==='invalid_amount','amount tidak valid -> 422')
t=await api('GET','qris/status/'+apiInv.invoice_id,{key:k1.key});ok(t.s===200&&t.j.status==='pending','status by invoice_id')
t=await api('GET','qris/status?order_id=API-1',{key:k1.key});ok(t.s===200&&t.j.invoice.invoice_id===apiInv.invoice_id,'status by order_id')
t=await api('GET','qris/status/'+apiInv.invoice_id,{key:k2.key});ok(t.s===404,'key lain tidak bisa melihat tagihan ini')
t=await api('GET','qris/list?status=paid',{key:k1.key});ok(t.s===200&&t.j.data.length>=3&&t.j.data.every(d=>d.status==='paid'),'list status=paid hanya milik key ini ('+t.j.data.length+')')
ok(t.j.data.every(d=>d.order_id!==null),'list tidak membocorkan field internal')
r=await smpCb(apiInv.total_pay,'RRN-API');await r.json()
t=await api('GET','qris/status/'+apiInv.invoice_id,{key:k1.key});ok(t.j.status==='paid'&&t.j.invoice.payer_name==='BUDI','status paid setelah callback')
t=await api('POST','qris/cancel/'+apiInv.invoice_id,{key:k1.key});ok(t.s===409&&t.j.code==='already_paid','cancel via API tagihan lunas -> 409')
t=await api('GET','nope',{key:k1.key});ok(t.s===404,'endpoint tak dikenal -> 404')
t=await api('POST','webhook/test',{key:k1.key,body:{}});ok(t.s===200&&t.j.delivered===true,'webhook/test via API')
// whitelist IP
await G.setIpw(k1.id,'1.2.3.4')
t=await api('GET','ping',{key:k1.key,headers:{'x-real-ip':'9.9.9.9'}});ok(t.s===403&&t.j.code==='ip_not_allowed','IP di luar whitelist -> 403')
t=await api('GET','ping',{key:k1.key,headers:{'x-real-ip':'1.2.3.4'}});ok(t.s===200,'IP whitelist diterima')
await G.setIpw(k1.id,'')
// HMAC
const kS=await G.setSecretOn(k1.id,true)
const sig=(m,path,rawb,ts,sec=kS.secret)=>crypto.createHmac('sha256',sec).update(`${m}\n/api/agw/${path}\n${rawb}\n${ts}`).digest('hex')
t=await api('GET','ping',{key:k1.key});ok(t.s===401&&t.j.code==='signature_required','secret aktif tanpa signature -> 401')
let ts=String(Math.floor(Date.now()/1000))
t=await api('GET','ping',{key:k1.key,headers:{'x-timestamp':ts,'x-signature':sig('GET','ping','',ts)}});ok(t.s===200,'GET bertanda tangan benar -> 200')
const bd={amount:9000,order_id:'SIG-1'},rawb=JSON.stringify(bd)
t=await api('POST','qris/create',{key:k1.key,body:bd,headers:{'x-timestamp':ts,'x-signature':sig('POST','qris/create',rawb,ts)}});ok(t.s===201,'POST bertanda tangan benar -> 201')
t=await api('POST','qris/create',{key:k1.key,body:{amount:9001,order_id:'SIG-2'},headers:{'x-timestamp':ts,'x-signature':sig('POST','qris/create',rawb,ts)}});ok(t.s===401&&t.j.code==='signature_invalid','body diubah setelah ditandatangani -> 401')
const old=String(Math.floor(Date.now()/1000)-900)
t=await api('GET','ping',{key:k1.key,headers:{'x-timestamp':old,'x-signature':sig('GET','ping','',old)}});ok(t.s===401&&t.j.code==='timestamp_expired','timestamp basi -> 401')
t=await api('GET','ping',{key:k1.key,headers:{'x-timestamp':ts,'x-signature':sig('GET','ping','',ts,'agw_sec_salah')}});ok(t.s===401,'secret salah -> 401')
await G.setSecretOn(k1.id,false)
// key nonaktif / dihapus / diganti
await G.setKeyOn(k1.id,false);t=await api('GET','ping',{key:k1.key});ok(t.s===403&&t.j.code==='key_disabled','key nonaktif -> 403')
await G.setKeyOn(k1.id,true)
const oldKey=k1.key;const kn=await G.regenKey(k1.id)
t=await api('GET','ping',{key:oldKey});ok(t.s===401,'key lama mati setelah diganti')
t=await api('GET','ping',{key:kn.key});ok(t.s===200,'key baru langsung berlaku')
// gateway dimatikan
await G.cfgSave({on:false,min:1000,max:5000000,expMin:15})
t=await api('POST','qris/create',{key:kn.key,body:{amount:5000}});ok(t.s===503&&t.j.code==='gateway_off','gateway dimatikan admin -> 503')
await G.cfgSave({on:true,min:1000,max:5000000,expMin:15})

console.log('\n[G] Admin: tandai lunas manual & kaitkan pembayaran tanpa tagihan')
const m=await G.createInvoice(kn,{amount:4000,order_id:'MAN-1'})
const mp=await G.manualPaid(m.inv.id,'cek mutasi');ok(mp.status==='paid','tandai lunas manual')
let e9;try{await G.manualPaid(m.inv.id)}catch(e){e9=e}ok(!!e9,'tidak bisa ditandai dua kali')
const o=await G.createInvoice(kn,{amount:4100,order_id:'ORF-1'})
await kv.set('smp:orphan',[{rrn:'ORF-RRN',nominal:o.inv.total,issuer:'OVO',payer:'SITI',at:Date.now()},...((await kv.get('smp:orphan'))||[])])
const at=await G.attachOrphan('ORF-RRN',o.inv.id);ok(at.status==='paid'&&at.rrn==='ORF-RRN','pembayaran tanpa tagihan dikaitkan -> lunas')
ok(!((await kv.get('smp:orphan'))||[]).some(z=>z.rrn==='ORF-RRN'),'... dan dihapus dari daftar orphan')
const o2=await G.createInvoice(kn,{amount:4200,order_id:'ORF-2'})
await kv.set('smp:orphan',[{rrn:'ORF-BAD',nominal:o2.inv.total+5,at:Date.now()}])
let e10;try{await G.attachOrphan('ORF-BAD',o2.inv.id)}catch(e){e10=e}ok(!!e10,'nominal tidak cocok -> tidak bisa dikaitkan')
const ov=await G.overview('https://situs.id')
ok(ov.base==='https://situs.id/api/agw'&&ov.smp.ready&&ov.keys.length===2,'overview admin: base URL, SMP siap, 2 key')
const lst=await G.listInvoices({status:'paid',limit:5});ok(lst.items.length>0&&lst.items.every(z=>z.status==='paid'),'daftar transaksi admin dengan filter')
const AD=await import('../lib/agwadmin.js')
const dr=await AD.handle('docs',{}, {site:'https://situs.id'});ok(dr.body.md.includes('https://situs.id/api/agw/qris/create')&&dr.body.md.includes('X-AGW-Signature'),'dokumentasi memuat base URL & webhook')
const dk=await AD.handle('inv/new',{id:kn.id,amount:3000},{site:'x'});ok(dk.status===200&&dk.body.invoice.total_pay>3000,'admin bisa buat tagihan uji')

console.log('\n[H] Bot CS: nominal & saldo')
ok(BOT.nominal('10000')===10000&&BOT.nominal('10.000')===10000&&BOT.nominal('10,000')===10000,'nominal 10000 / 10.000 / 10,000')
ok(BOT.nominal('10rb')===10000&&BOT.nominal('10k')===10000&&BOT.nominal('1,5jt')===1500000&&BOT.nominal('2jt')===2000000,'nominal 10rb / 10k / 1,5jt / 2jt')
ok(BOT.nominal('abc')===0&&BOT.nominal('-5')===0&&BOT.nominal('')===0&&BOT.nominal('0')===0,'nominal tidak valid -> 0')
const uid='u'+crypto.randomBytes(4).toString('hex')
await kv.set('u:'+uid,{id:uid,email:'budi@mail.com',name:'Budi',balance:5000,mut:[],tx:[]});await kv.set('e:budi@mail.com',uid)
const bal=async()=>(await kv.get('u:'+uid)).balance
const say=async(text,extra={})=>{sent.length=0;await BOT.csbotHandle({message:{chat:{id:111},from:{id:111},text,message_id:5,...extra}});return sent.filter(z=>z.m==='sendMessage').map(z=>z.b)}
const press=async data=>{sent.length=0;await BOT.csbotHandle({callback_query:{id:'cb',from:{id:111},data,message:{chat:{id:111}}}});return sent.filter(z=>z.m==='sendMessage').map(z=>z.b)}
const tokOf=ms=>{for(const x of ms){const b=((x.reply_markup||{}).inline_keyboard||[]).flat().find(z=>String(z.callback_data).startsWith('sy:'));if(b)return b.callback_data}return ''}

let ms=await say('/saldo budi@mail.com')
ok(ms.length===1&&ms[0].text.includes('Rp5.000'),'/saldo menampilkan saldo')
ms=await say('/addsaldo budi@mail.com 10rb bonus event')
ok(ms.length===1&&ms[0].text.includes('TAMBAH SALDO')&&ms[0].text.includes('Rp15.000'),'/addsaldo minta konfirmasi dulu (saldo setelahnya Rp15.000)')
ok(await bal()===5000,'saldo BELUM berubah sebelum konfirmasi')
const tok=tokOf(ms);ok(tok.startsWith('sy:'),'ada tombol konfirmasi')
ms=await press(tok)
ok(await bal()===15000&&ms[0].text.includes('Saldo ditambah'),'konfirmasi -> saldo +10.000')
const u1=await kv.get('u:'+uid);ok(u1.mut[0].amt===10000&&u1.mut[0].note==='Admin tambah','tercatat di mutasi pengguna')
ms=await press(tok);ok(await bal()===15000,'tombol ditekan dua kali tidak menambah dua kali')
ms=await say('/delsaldo budi@mail.com 999999')
ok(ms[0].text.includes('tidak cukup')&&!tokOf(ms),'/delsaldo melebihi saldo ditolak, tanpa konfirmasi')
ms=await say('/delsaldo budi@mail.com 4rb koreksi');await press(tokOf(ms))
ok(await bal()===11000,'/delsaldo 4rb -> saldo 11.000')
ms=await say('/addsaldo budi@mail.com 99jt');ok(ms[0].text.includes('terlalu besar'),'nominal di atas batas ditolak')
ms=await say('/addsaldo nobody@x.com 1000');ok(ms[0].text.includes('tidak ditemukan'),'pengguna tidak ada -> pesan jelas')
ms=await say('/addsaldo budi@mail.com abc');ok(ms[0].text.includes('Nominal tidak valid'),'nominal tidak valid -> pesan jelas')
ms=await say('/addsaldo');ok(ms[0].text.includes('Pakai'),'tanpa argumen -> bantuan')
// target dari Reply ke notifikasi chat
ms=await say('/addsaldo 2500',{reply_to_message:{text:'💬 CHAT CS BARU\n🆔 ID Pengguna: '+uid}})
ok(ms[0].text.includes('Rp13.500'),'tanpa email: pakai pengguna dari pesan yang di-Reply')
await press(tokOf(ms));ok(await bal()===13500,'saldo +2.500 via Reply')
// tombol ➕ lalu ketik nominal
ms=await press('sa:'+uid);ok(ms[0].text.includes('Ketik'),'tombol ➕ meminta nominal')
ms=await say('1jt hadiah');ok(ms[0].text.includes('TAMBAH SALDO')&&ms[0].text.includes('1.000.000'),'nominal diketik -> minta konfirmasi')
await press('sn:'+tokOf(ms).slice(3));ok(await bal()===13500,'tombol Batal -> saldo tidak berubah')
ms=await press('sd:'+uid);ms=await say('500');await press(tokOf(ms));ok(await bal()===13000,'tombol ➖ + ketik 500 -> saldo -500')
// pesan biasa setelah tombol -> tetap balasan chat biasa
await press('sa:'+uid);sent.length=0
await BOT.csbotHandle({message:{chat:{id:111},from:{id:111},text:'halo, sudah kami cek ya',message_id:9,reply_to_message:{text:'ID Pengguna: '+uid}}})
ok(await bal()===13000&&(await kv.get('cs:'+uid)).msgs.some(z=>z.text.includes('sudah kami cek')),'teks biasa tetap jadi balasan CS, bukan nominal')
// keamanan: chat yang tidak terdaftar
sent.length=0
await BOT.csbotHandle({message:{chat:{id:999},from:{id:999},text:'/addsaldo budi@mail.com 50000',message_id:1}})
ok(await bal()===13000&&sent.length===0,'ID Telegram tak terdaftar diabaikan total')
await BOT.csbotHandle({callback_query:{id:'x',from:{id:999},data:tok,message:{chat:{id:999}}}})
ok(await bal()===13000,'ID tak terdaftar tidak bisa menekan tombol konfirmasi')
// konfirmasi milik chat lain
ms=await say('/addsaldo budi@mail.com 1000');const t2=tokOf(ms)
const opk=await kv.get('tmp:csbot:op:'+t2.slice(3));opk.chat='222';await kv.set('tmp:csbot:op:'+t2.slice(3),opk)
await press(t2);ok(await bal()===13000,'token konfirmasi milik chat lain ditolak')
// kedaluwarsa
ms=await say('/addsaldo budi@mail.com 1000');const t3=tokOf(ms)
const op3=await kv.get('tmp:csbot:op:'+t3.slice(3));op3.exp=Date.now()-1;await kv.set('tmp:csbot:op:'+t3.slice(3),op3)
ms=await press(t3);ok(await bal()===13000&&ms[0].text.includes('kedaluwarsa'),'konfirmasi lewat 5 menit ditolak')

console.log(`\n${pass} lulus, ${fail} gagal`)
process.exit(fail?1:0)
