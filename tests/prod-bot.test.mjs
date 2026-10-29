// Produk Lainnya di bot (utama + reseller): menu, detail, jumlah, beli, pengiriman teks/link/foto/file. Jalankan: npx tsx tests/prod-bot.test.mjs
process.env.ADMIN_PASSWORD='pwx'
const {kv}=await import('../lib/db.js')
const {resetSec}=await import('../lib/settings.js')
const {save}=await import('../lib/auth.js')
const P=await import('../lib/products.js')
const TB=await import('../lib/tgbot.js')
let pass=0,fail=0;const ok=(c,m)=>{c?pass++:fail++;console.log((c?'  ✔ ':'  ✘ ')+m)}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));const calls=[]
globalThis.fetch=async(url,o={})=>{url=String(url);const m=url.match(/\/bot([^/]+)\/(\w+)/),J=x=>new Response(JSON.stringify(x),{status:200,headers:{'content-type':'application/json'}})
 if(!m)return J({ok:true});let b={};try{b=typeof o.body==='string'?JSON.parse(o.body):{}}catch(e){}
 if(o.body&&typeof o.body.get==='function')b={chat_id:o.body.get('chat_id'),caption:o.body.get('caption'),file:o.body.get('document')||o.body.get('photo')}
 calls.push({token:m[1],method:m[2],b});return J({ok:true,result:{message_id:9}})}
const flush=async()=>{await sleep(80);return calls.splice(0)}
const sent=cs=>cs.map(c=>JSON.stringify(c.b)).join('\n')
await kv.set('sec',{TELEGRAM_BOT_TOKEN:'1:x',TELEGRAM_CHAT_ID:'-1'});resetSec()
const BM={id:'bm',token:'111:main',username:'m',secret:'s',on:true,admins:[]},BR={id:'br',token:'222:rs',username:'r',secret:'s2',on:true,rs:'rs1'}
await kv.set('bots',[BM,BR]);await kv.set('rs:rs1',{uid:'rs1',on:true,mode:'komisi',balance:0,stok:0,bot:{id:'br',ownerId:'7777'},brand:'T',wd:[],dep:[],log:[],sreq:[]})
const txt=await P.adminSave({name:'Akun Premium',price:15000,desc:'Siap pakai',emoji:'🎟',type:'text',unique:true,items:'AKUN-1\nAKUN-2\nAKUN-3'})
const fil=await P.adminSave({name:'Ebook',price:9000,type:'file',file:{name:'ebook.pdf',mime:'application/pdf',b64:Buffer.from('%PDF-x').toString('base64')},stock:5})
let uid=1
const msg=(bot,from,text)=>TB.handle(bot,{update_id:uid++,message:{message_id:uid,date:1,chat:{id:from,type:'private'},from:{id:from,first_name:'U'+from},text}})
const cb=(bot,from,data)=>TB.handle(bot,{update_id:uid++,callback_query:{id:'cb'+uid,from:{id:from,first_name:'U'+from},message:{message_id:5,chat:{id:from,type:'private'}},data}})
for(const [nm,bot,from] of [['bot utama',BM,1001],['bot reseller',BR,2002]]){
 console.log('\n['+nm+']')
 await P.adminRestock(txt.id,{add:'AKUN-X\nAKUN-Y\nAKUN-Z'})
 await msg(bot,from,'/start');let x=await flush();ok(/"callback_data":"pr"/.test(sent(x)),'menu punya tombol 🛒 Produk Lainnya')
 // beri saldo ke pengguna bot ini
 let gv=0;for(let after='';;){const r=await kv.scanPrefix('u:',after,200);const ks=(r.items||r.keys||r||[]);if(!ks.length)break;for(const it of ks){const q=it&&it.v?it.v:await kv.get(it.k||it);if(q&&q.id&&String(q.tgId)===String(from)){q.balance=100000;await save(q);gv++}}after=r.next||r.after||'';if(!after)break}
 ok(gv>0,'pengguna Telegram ditemukan & diberi saldo')
 await cb(bot,from,'pr');x=await flush();ok(/PRODUK LAINNYA/.test(sent(x))&&/prp:/.test(sent(x)),'daftar produk tampil')
 await cb(bot,from,'prp:'+txt.id);x=await flush();ok(/AKUN PREMIUM/.test(sent(x))&&/prb:/.test(sent(x)),'detail produk + tombol beli')
 await cb(bot,from,`prq:${txt.id}:2`);x=await flush();ok(/Jumlah[^\\n]*2/.test(sent(x))&&new RegExp('prb:'+txt.id+':2').test(sent(x)),'ubah jumlah → 2')
 await cb(bot,from,`prb:${txt.id}:2`);x=await flush()
 ok(/PEMBELIAN BERHASIL/.test(sent(x))&&(sent(x).match(/AKUN-\w/g)||[]).length>=2,'beli 2 → dua data teks berbeda dikirim')
 for(const k of [0,1,2])await kv.del(`rl:prb:${from}:${Math.floor(Date.now()/4000)-k+1}`).catch(()=>{});await kv.del(`rl:prb:${from}:${Math.floor(Date.now()/4000)}`)
 await cb(bot,from,`prb:${fil.id}:1`);x=await flush()
 ok(x.some(c=>c.method==='sendDocument'),'produk file → dikirim sebagai dokumen Telegram')
 await cb(bot,from,'prh');x=await flush();ok(/PEMBELIAN SAYA/.test(sent(x))&&/pro:/.test(sent(x)),'riwayat pembelian tampil')
}
console.log(`\nHasil: ${pass} lulus, ${fail} gagal`);process.exit(fail?1:0)
