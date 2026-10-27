// Alur Suntik Sosmed di bot utama & bot reseller (Telegram + penyedia dipalsukan). Jalankan: npx tsx tests/smm-bot.test.mjs
process.env.ADMIN_PASSWORD='pwx'
const {kv}=await import('../lib/db.js')
const {resetSec}=await import('../lib/settings.js')
const TB=await import('../lib/tgbot.js')
let pass=0,fail=0
const ok=(c,m)=>{c?pass++:fail++;console.log((c?'  ✔ ':'  ✘ ')+m)}
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
const calls=[]
const SV=[{service:1,name:'IG Followers Real',type:'Default',category:'Instagram Followers',rate:'20000',min:'50',max:'10000',refill:true,cancel:true},
 {service:2,name:'IG Likes',type:'Default',category:'Instagram Likes',rate:'8000',min:'20',max:'5000',refill:false,cancel:false},
 {service:3,name:'TikTok Views',type:'Default',category:'TikTok Views',rate:'1000',min:'100',max:'100000',refill:false,cancel:false}]
const prov={orders:{},next:500,svcCalls:0}
for(let i=10;i<3010;i++)SV.push({service:i,name:'IG Followers Paket '+i+' <HQ> & Fast',type:'Default',category:'Instagram Followers '+(i%9),rate:String(1000+i),min:'10',max:'50000',refill:i%2===0,cancel:true})
globalThis.fetch=async(url,o={})=>{
 url=String(url);const J=x=>new Response(JSON.stringify(x),{status:200,headers:{'content-type':'application/json'}})
 const m=url.match(/\/bot([^/]+)\/(\w+)/)
 if(m){let b={};try{b=typeof o.body==='string'?JSON.parse(o.body):{}}catch(e){};calls.push({method:m[2],b});return J({ok:true,result:{message_id:99}})}
 if(/micypedia/.test(url)){const b=Object.fromEntries(new URLSearchParams(String(o.body)).entries())
  if(b.action==='services'){prov.svcCalls++;return J(SV)}
  if(b.action==='add'){const id=prov.next++;prov.orders[id]={status:'Pending',remains:b.quantity,start_count:'0',charge:'1'};return J({order:id})}
  if(b.action==='status')return J(b.orders?Object.fromEntries(b.orders.split(',').map(i=>[i,prov.orders[i]])):prov.orders[b.order])
  return J({error:'x'})}
 return J({ok:true})}
const flush=async()=>{await sleep(60);return calls.splice(0)}
const texts=cs=>cs.filter(c=>/send(Rich)?Message|editMessage|sendPhoto/.test(c.method)).map(c=>JSON.stringify(c.b)).join('\n')
await kv.set('sec',{TELEGRAM_BOT_TOKEN:'1:x',TELEGRAM_CHAT_ID:'-1',SMM_KEY:'k'});resetSec()
const botMain={id:'bm',token:'111:main',username:'artabot',secret:'s',on:true,admins:['5000']}
const botRs={id:'br',token:'222:rs',username:'tokobot',secret:'s2',on:true,rs:'rs1'}
await kv.set('bots',[botMain,botRs])
await kv.set('rs:rs1',{uid:'owner1',on:true,mode:'komisi',balance:0,stok:0,earn:0,sold:0,bot:{id:'br',ownerId:'7777'},brand:'Toko Maju',wd:[],dep:[],sreq:[]})
let uid=1
const msg=(bot,from,text)=>TB.handle(bot,{update_id:uid++,message:{message_id:uid,date:1,chat:{id:from,type:'private'},from:{id:from,first_name:'U'+from,username:'u'+from},text}})
const cb=(bot,from,data)=>TB.handle(bot,{update_id:uid++,callback_query:{id:'cb'+uid,from:{id:from,first_name:'U'+from},message:{message_id:5,chat:{id:from,type:'private'}},data}})
const cbs=cs=>cs.filter(c=>c.b.reply_markup).flatMap(c=>JSON.stringify(c.b.reply_markup).match(/"callback_data":"[^"]+"/g)||[])

for(const [nm,bot,from] of [['bot utama',botMain,1001],['bot reseller',botRs,2002]]){
 console.log('\n['+nm+']')
 await msg(bot,from,'/start');let x=await flush()
 ok(/"callback_data":"sm"/.test(JSON.stringify(x.map(c=>c.b.reply_markup))),'menu punya tombol Suntik Sosmed')
 await cb(bot,from,'sm');x=await flush()
 ok(/SUNTIK SOSMED/.test(texts(x))&&cbs(x).some(c=>/smp:0/.test(c)),'tombol Suntik membuka daftar platform')
 await cb(bot,from,'smp:0');x=await flush()
 ok(/PILIH LAYANAN/.test(texts(x)),'pilih platform → halaman pilih layanan')
 const sv=cbs(x).find(c=>/sms:\d+/.test(c));ok(!!sv,'ada tombol layanan: '+sv)
 const id=sv&&sv.match(/sms:(\d+)/)[1]
 await cb(bot,from,'sms:'+id);x=await flush()
 ok(/KIRIM LINK TARGET/.test(texts(x)),'pilih layanan → halaman kirim link (tidak stuck)')
 await cb(bot,from,'smg:0');x=await flush()
 ok(/PILIH LAYANAN/.test(texts(x)),'tombol ⬅️ Layanan kembali ke daftar layanan (bukan ke platform)')
 await cb(bot,from,'sms:'+id);await flush()
 await msg(bot,from,'https://instagram.com/akunku');x=await flush()
 ok(/KIRIM JUMLAH/.test(texts(x)),'link diterima → minta jumlah')
 await msg(bot,from,'100');x=await flush()
 ok(/KONFIRMASI PESANAN/.test(texts(x)),'jumlah diterima → konfirmasi')
}
ok(prov.svcCalls<=1,'daftar 3000 layanan diunduh dari penyedia hanya '+prov.svcCalls+'x untuk semua klik')
console.log(`\nHasil: ${pass} lulus, ${fail} gagal`);process.exit(fail?1:0)
