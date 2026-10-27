// Pesan otomatis harian. Jalankan: npx tsx tests/dailymsg.test.mjs
process.env.ADMIN_PASSWORD='pwx'
const {kv}=await import('../lib/db.js')
const {resetSec}=await import('../lib/settings.js')
const DM=await import('../lib/dailymsg.js')
const {maghrib}=await import('../lib/prayer.js')
let pass=0,fail=0;const ok=(c,m)=>{c?pass++:fail++;console.log((c?'  ✔ ':'  ✘ ')+m)}
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
const sent=[]
globalThis.fetch=async(url,o={})=>{url=String(url);const m=url.match(/\/bot([^/]+)\/(\w+)/),J=x=>new Response(JSON.stringify(x),{status:200,headers:{'content-type':'application/json'}})
 if(m){let b={};try{b=JSON.parse(o.body)}catch(e){};if(/sendMessage/.test(m[2])&&b.text)sent.push({token:m[1],chat:String(b.chat_id),text:b.text})}return J({ok:true,result:{message_id:1}})}
await kv.set('sec',{TELEGRAM_BOT_TOKEN:'1:x',TELEGRAM_CHAT_ID:'-1'});resetSec()
const BM={id:'bm',token:'111:main',username:'m',secret:'s',on:true,admins:[]},BR={id:'br',token:'222:rs',username:'r',secret:'s2',on:true,rs:'rs1'}
await kv.set('bots',[BM,BR])
await kv.set('rs:rs1',{uid:'rs1',on:true,mode:'komisi',balance:0,stok:0,bot:{id:'br',ownerId:'7777'},brand:'T',wd:[],dep:[],log:[],sreq:[]})
const mk=async(id,tg,bot,extra={})=>{await kv.set('u:'+id,{id,email:id+'@x.com',name:id,balance:0,tx:[],mut:[],tgId:tg,tgBot:bot,joinedAt:new Date().toISOString(),...extra});await kv.sadd('idx',id)}
await mk('u1','1001','bm');await mk('u2','2002','br',{rs:'rs1'})
const WIB=(Y,M,D,h,m)=>Date.UTC(Y,M,D,h,m)-7*36e5

console.log('\n[A] Jadwal Magrib (kalibrasi ke Kemenag Jakarta)')
for(const [Y,M,D,h] of [[2026,9,27,'17:49'],[2026,11,27,'18:11'],[2026,4,27,'17:47']]){const r=maghrib(Y,M,D,'Jakarta');const d=Math.abs((+r.hhmm.slice(0,2)*60+ +r.hhmm.slice(3))-(+h.slice(0,2)*60+ +h.slice(3)));ok(d<=1,`${Y}-${M+1}-${D}: hitung ${r.hhmm} vs resmi ${h}`)}
ok(maghrib(2026,9,27,'Makassar').zona==='WITA'&&maghrib(2026,9,27,'Jayapura').zona==='WIT','zona WITA / WIT benar')

console.log('\n[B] Isi pesan')
let cfg=await DM.saveDm({on:true,city:'Jakarta'})
const day=WIB(2026,9,27,6,30)
const t1=await DM.build(cfg.slots[0],cfg,day),t2=await DM.build(cfg.slots[0],cfg,day+864e5)
ok(/Selamat pagi|Pagi|Good morning/.test(t1),'slot pagi: sapaan pagi')
ok(/Jadwal Magrib hari ini: <b>17:4\d WIB/.test(t1),'memuat jadwal Magrib hari ini')
ok(/Order Nokos/.test(t1)&&!/Suntik Sosmed/.test(t1),'SMM belum aktif → ajakan hanya Order Nokos')
await kv.set('sec',{TELEGRAM_BOT_TOKEN:'1:x',TELEGRAM_CHAT_ID:'-1',SMM_KEY:'k'});resetSec()
const t3=await DM.build(cfg.slots[0],cfg,day);ok(/Suntik Sosmed/.test(t3)&&/Order Nokos/.test(t3),'SMM aktif → ajak Order Nokos + Suntik Sosmed')
ok(t1!==t2,'teks bergilir tiap hari (tidak monoton)')
ok(/malam|beristirahat/i.test(await DM.build(cfg.slots[3],cfg,day)),'slot malam: sapaan malam')
const tc=await DM.build({...cfg.slots[1],custom:'Hai! Magrib {magrib} {zona} di {kota}'},cfg,day);ok(/Magrib 17:\d\d WIB di Jakarta/.test(tc),'teks kustom + placeholder')

console.log('\n[C] Penjadwalan (cron)')
cfg=await DM.saveDm({on:true,city:'Jakarta'})
ok((await DM.tick(WIB(2026,9,27,6,10))).idle===true&&!sent.length,'sebelum jam 06:30: belum kirim')
let r=await DM.tick(WIB(2026,9,27,6,31));ok(r.sent==='pagi','06:31: kirim slot pagi')
for(let i=0;i<6;i++){const B=await import('../lib/bcall.js');await B.bcaTick(20000);await sleep(30)}
const to=sent.map(x=>x.chat+'@'+x.token.split(':')[0]);ok(to.includes('1001@111')&&to.includes('2002@222'),'terkirim ke pengguna bot utama DAN bot reseller (lewat bot masing-masing)')
ok(/Selamat pagi|Pagi|Good morning/.test(sent[0].text),'isi pesan pagi sampai ke pengguna')
r=await DM.tick(WIB(2026,9,27,6,32));ok(r.idle===true,'menit berikutnya: tidak kirim dobel')
r=await DM.tick(WIB(2026,9,27,12,5));ok(r.sent==='siang'||r.waiting==='siang','12:05: slot siang')
const mg=maghrib(2026,9,27,'Jakarta');r=await DM.tick(mg.ms-10*60000);ok(r.idle===true||r.waiting||r.sent==='magrib','mendekati Magrib dicek')
ok((await DM.tick(WIB(2026,9,27,9,0))).idle===true,'di luar jendela: tidak kirim pesan basi')
await DM.saveDm({on:false});ok((await DM.tick(WIB(2026,9,28,6,31))).skipped==='off','saklar mati: tidak kirim apa pun')
console.log(`\nHasil: ${pass} lulus, ${fail} gagal`);process.exit(fail?1:0)
