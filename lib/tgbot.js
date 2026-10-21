// Mesin bot Telegram Artapedia ID. Satu webhook per bot: app/api/tg/[id]/route.js -> handle(bot, update)
// Dirancang cepat: tombol dijawab seketika, data penyedia di-cache, database dibaca paralel, OTP dipantau langsung.
// Tampilan: satu pesan yang diedit (tanpa spam), kartu <blockquote>, tombol inline berwarna, tombol salin.
import crypto from 'crypto'
import {kv} from './db'
import {save,rid,hash} from './auth'
import {tg,getBots,esc,B,U,C,kb,pushUser,quiet} from './tgpush'
import {P,SERVERS} from './providers'
import {getCfg,mut,ensureRef,sellPrice,allUsers,refundOnce} from './bonus'
import {METHODS,ROUTES,ROUTES_V2,engineOf,switches,methodsList,createDeposit,depCheck,depCancel,applyDep,recheckDep,toMs,readiness,depPendAdd} from './deposit'
import {strukPng} from './strukimg'
import {notify,mask,rp,wibAt} from './telegram'
import {getSec} from './settings'
import {replaceIfNeeded,markCancel,cancelMsg,retryCancel,expireIfLate,cancelBlock,cancelWaitSec} from './sync'
import {banUser,unbanUser} from './ban'
import {fireOtp} from './webhook'
import {bg} from './bg'
import {runBackup} from './backup'
import * as RS from './reseller'
import {startAll as bcaStart,bcaStep,bcaInfo,normTargets,CATS as BCA_CATS} from './bcall'
import {money,T as TR,LANGS,pack,PACK_ID} from './rslang'

// ---------- util ----------
const sid=id=>crypto.createHash('md5').update(String(id)).digest('hex').slice(0,10)
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
const stOf=s=>({success:'🟢',pending:'🟡',cancelled:'⚫',expired:'🔴',completed:'🟢',canceled:'⚫',failed:'🔴'}[s]||'⚪')
const stName=s=>({success:'Berhasil',pending:'Menunggu',cancelled:'Dibatalkan',expired:'Kedaluwarsa',completed:'Berhasil',canceled:'Dibatalkan',failed:'Gagal'}[s]||s)
const getSt=async id=>(await kv.get('tmp:tg:'+id))||{}
const setSt=(id,s)=>kv.set('tmp:tg:'+id,s)
const num=x=>{x=Math.floor(+String(x).replace(/[^\d]/g,''));return Number.isFinite(x)?x:0}
// nominal bebas: 15000 · 15.000 · Rp15.000 · 15k · 15rb · 1,5jt
const parseAmt=t=>{t=String(t||'').toLowerCase().replace(/rp\.?|\s/g,'');const m=t.match(/^(\d[\d.,]*)(k|rb|ribu|jt|juta)?$/);if(!m)return 0
 const mul=m[2]?(/^(jt|juta)$/.test(m[2])?1e6:1e3):1
 const n=m[2]?parseFloat(m[1].replace(',','.').replace(/\.(?=.*\.)/g,'')):parseInt(m[1].replace(/[.,]/g,''),10)
 return Number.isFinite(n)?Math.floor(n*mul):0}
const wibDayStart=()=>{const d=new Date(Date.now()+7*36e5);return Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate())-7*36e5}
const BASE=s=>String(s||'').replace(/\/+$/,'').replace(/\/api(\/v1)?$/,'')
const jam=()=>new Date().toLocaleTimeString('id-ID',{timeZone:'Asia/Jakarta',hour:'2-digit',minute:'2-digit'}).replace('.',':')
const salam=()=>{const h=(new Date().getUTCHours()+7)%24;return h<11?'Selamat pagi':h<15?'Selamat siang':h<18?'Selamat sore':'Selamat malam'}
const sisa=ms=>{const m=Math.max(0,Math.ceil((ms-Date.now())/60000));return m<=0?'habis':m+' menit'}
// komponen tampilan
const Q=(...l)=>'<blockquote>'+l.flat().filter(Boolean).join('\n')+'</blockquote>'
const H=(ic,t,sub)=>`<b>${ic} ${t}</b>`+(sub?`\n<i>${sub}</i>`:'')
const BACK=[B('🏠 Menu Utama','m','primary')]
// cache ringan di memori instance (hemat panggilan ke penyedia & database)
const memo=(k,ttl,fn)=>{const m=globalThis.__tgm||(globalThis.__tgm={}),c=m[k];if(c&&Date.now()-c.t<ttl)return c.p
 const p=Promise.resolve().then(fn);m[k]={t:Date.now(),p};p.catch(()=>{if(m[k]&&m[k].p===p)delete m[k]});return p}
const cfgFast=async()=>{const m=globalThis.__tgc;if(m&&Date.now()-m.t<4000)return m.v;const v=await getCfg();globalThis.__tgc={t:Date.now(),v};return v}
const putCfg=async cfg=>{await kv.set('cfg',cfg);globalThis.__tgc=null}
// Data toko reseller dibaca tiap pesan masuk. Cache 3 detik per toko; PEMILIK toko selalu membaca langsung
// (supaya perubahan yang baru ia buat langsung terlihat). Penulisan tetap lewat RS.mutate yang membaca ulang.
const rsFast=async(uid,fromId)=>{const m=globalThis.__tgrs||(globalThis.__tgrs={}),e=m[uid]
 if(e&&Date.now()-e.t<3000&&String((e.v.bot||{}).ownerId)!==String(fromId))return e.v
 const v=await RS.getRs(uid);m[uid]={t:Date.now(),v};return v}
const svItems=sv=>memo('sv:'+sv,90000,async()=>(await P[sv].services()).map(x=>({c:x.service_code,n:String(x.service_name)})).sort((a,b)=>a.n.localeCompare(b.n)))
const ctRaw=(sv,sid)=>memo(`ct:${sv}:${sid}`,30000,()=>P[sv].countries(sid))
// ---------- RICH MESSAGE (Bot API 10.1+, sendRichMessage) ----------
// Telegram 2026 TIDAK memakai tag HTML untuk tampilan kaya. Pesan kaya dikirim
// lewat metode `sendRichMessage` dengan isi { rich_message: { markdown } },
// dan diubah lewat `editMessageText` + rich_message. Markdown-nya gaya GitHub:
//   ## Judul · --- garis · | tabel | · <details> untuk bagian buka-tutup
// Setiap layar dirakit SEKALI, lalu menghasilkan dua bentuk:
//   1) markdown  -> dipakai sendRichMessage (tampilan seperti contoh pemilik)
//   2) HTML klasik -> cadangan kalau server/akun belum mendukung pesan kaya
// Keduanya dipasangkan di MD supaya show()/send() tahu markdown milik teks mana.
const HR='━━━━━━━━━━━━━━━━━━━━'
const MD=new Map()
const pairMd=(html,md)=>{if(MD.size>400)MD.clear();MD.set(html,md);return html}
// Layar yang belum dirakit lewat rich() tetap bisa dikirim sebagai pesan kaya:
// HTML klasiknya diterjemahkan apa adanya ke markdown.
function htmlToMd(t){
 return String(t==null?'':t)
  .replace(/<pre>([\s\S]*?)<\/pre>/g,(m,a)=>'\n```\n'+a.replace(/<[^>]*>/g,'')+'\n```\n')
  .replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/g,(m,a)=>'\n'+a.replace(/<[^>]*>/g,x=>x).split('\n').map(l=>'> '+l).join('\n')+'\n')
  .replace(/<h3>([\s\S]*?)<\/h3>/g,(m,a)=>'\n### '+a+'\n')
  .replace(/<\/?(b|strong)>/g,'**').replace(/<\/?(i|em)>/g,'_').replace(/<\/?(u|ins)>/g,'')
  .replace(/<\/?code>/g,'`').replace(/<br\s*\/?>/g,'\n').replace(/<\/?p>/g,'\n')
  .replace(/<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g,(m,h,a)=>`[${a}](${h})`)
  .replace(/<[^>]*>/g,'')
  .replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/&quot;/g,'"')
  .replace(/\n{3,}/g,'\n\n').trim()}
export const mdOf=t=>MD.get(String(t))||htmlToMd(t)
// buang tag HTML -> teks biasa (dipakai saat merakit markdown)
const unent=t=>String(t==null?'':t).replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/&quot;/g,'"')
// tanda baca yang punya arti di markdown dilindungi supaya isi data tidak merusak tata letak
const mdEsc=t=>String(t).replace(/([\\`*\[\]])/g,'\\$1')
const toTx=t=>unent(String(t==null?'':t).replace(/<br\s*\/?>/g,'\n').replace(/<[^>]*>/g,'')).trim()
// ubah penegasan HTML jadi markdown (<b> -> **tebal**, <i> -> _miring_, <code> -> `kode`)
const toMdTx=t=>String(t==null?'':t)
 .replace(/<br\s*\/?>/g,'\n')
 .split(/(<[^>]*>)/).map(x=>x.startsWith('<')?x:mdEsc(unent(x))).join('')
 .replace(/<\/?(b|strong)>/g,'**').replace(/<\/?(i|em)>/g,'_').replace(/<\/?code>/g,'`')
 .replace(/<[^>]*>/g,'').trim()
const cellTx=(x,n)=>toTx(x).replace(/\s+/g,' ').replace(/\|/g,'/').slice(0,n||40)
// isi sel untuk markdown: dilindungi dulu supaya tabel tidak pecah
const cellMd=(x,n)=>mdEsc(cellTx(x,n))
// lebar kolom (emoji dihitung 2) untuk tabel cadangan monospasi
const wid=t=>[...String(t)].reduce((n,ch)=>n+(/[\u1100-\u115F\u2E80-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE30-\uFE6F\uFF00-\uFF60\uFFE0-\uFFE6]/.test(ch)||ch.codePointAt(0)>0xFFFF||/[\u2190-\u21FF\u2600-\u27BF\u2B00-\u2BFF]/.test(ch)?2:1),0)
const padw=(t,w)=>String(t)+' '.repeat(Math.max(0,w-wid(t)))
// tabel cadangan (HTML klasik): kotak monospasi bergaris
const tblx=(rows,head)=>{
 const r=(rows||[]).filter(Boolean).map(([k,v])=>[cellTx(k,22),cellTx(v,30)||'-'])
 if(!r.length)return ''
 const all=head?[[cellTx(head[0],22),cellTx(head[1],30)],...r]:r
 const w1=Math.max(...all.map(x=>wid(x[0]))),w2=Math.max(...all.map(x=>wid(x[1])))
 const ln=(a,b,c)=>a+'─'.repeat(w1+2)+b+'─'.repeat(w2+2)+c
 const line=(k,v)=>`│ ${padw(k,w1)} │ ${padw(v,w2)} │`
 const body=[ln('┌','┬','┐'),...(head?[line(cellTx(head[0],22),cellTx(head[1],30)),ln('├','┼','┤')]:[]),...r.map(x=>line(x[0],x[1])),ln('└','┴','┘')]
 return '<pre>'+esc(body.join('\n'))+'</pre>'}
const tbl=rows=>tblx(rows,['Field','Detail'])
// tabel markdown (yang dirender Telegram jadi tabel asli bergaris)
const mdTable=rows=>{
 const r=(rows||[]).filter(Boolean).map(([k,v])=>[cellMd(k,28),cellMd(v,40)||'-'])
 if(!r.length)return ''
 return ['|  |  |','| :--- | ---: |',...r.map(x=>`| ${x[0]} | **${x[1]}** |`)].join('\n')}
const plain=t=>String(t).replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim().length
// Rakit satu layar. blocks: [[ikon, judul, rows[]]]
function rich({title,ic='🌟',note,hello,intro,blocks=[],tip,tipTitle='💡 Cara menggunakan bot',foot,banner}){
 const bl=blocks.filter(x=>x&&(x[2]||[]).filter(Boolean).length)
 // ---- markdown (tampilan kaya) ----
 const md=[]
 if(banner)md.push(`![](${banner})`,'')   // gambar menyatu di pesan kaya
 if(note)md.push(toMdTx(note),'')
 md.push(`## ${ic} ${toTx(title)}`,'')
 if(hello)md.push(toMdTx(hello),'')
 if(intro)md.push(toMdTx(intro),'')
 for(const [bi,bt,rows] of bl){md.push('---','',`### ${bi} ${toTx(bt)}`,'',mdTable(rows),'')}
 if(foot)md.push(toMdTx(foot),'')
 if(tip)md.push(`<details><summary>${toTx(tipTitle)}</summary>`,'',toMdTx(tip),'','</details>','')
 // ---- HTML klasik (cadangan) ----
 const h=[]
 if(note)h.push(note,'')
 h.push(`<b>${ic} ${esc(toTx(title))}</b>`)
 if(hello)h.push('',hello)
 if(intro)h.push(intro)
 for(const [bi,bt,rows] of bl){h.push(HR,`${bi} <b>${esc(toTx(bt))}</b>`,tblx(rows))}
 if(foot)h.push(foot)
 let html=h.join('\n')
 if(tip&&plain(html)+plain(tip)<=980)html+=`\n<blockquote expandable><b>${esc(toTx(tipTitle))}</b>\n${tip}</blockquote>`
 return pairMd(html,md.join('\n').replace(/\n{3,}/g,'\n\n').trim())}
// true = pesan kaya boleh dicoba. Kalau pernah ditolak karena metodenya tidak ada,
// hanya istirahat sebentar lalu dicoba lagi (tidak pernah mati permanen).
const richOk=()=>!(globalThis.__tgrichOff>Date.now())
// font hias (Unicode Sans-Serif Bold) untuk label menu bot
const fx=t=>String(t).replace(/[A-Za-z0-9]/g,ch=>{const c=ch.charCodeAt(0);return String.fromCodePoint(c>=97?0x1D5EE+(c-97):c>=65?0x1D5D4+(c-65):0x1D7EC+(c-48))})
// Statistik toko di menu /start. Dulu setiap instance baru memuat SEMUA pengguna (ribuan query) hanya untuk
// menampilkan tiga angka, dan itu terjadi tepat saat pengguna menekan /start: penyebab utama bot terasa lemot.
// Sekarang angka disimpan SATU dokumen bersama ('tmp:shopstat'), dibaca murah, dan dihitung ulang paling
// sering 10 menit sekali oleh SATU proses (dijaga kunci) di latar; menu tidak pernah menunggunya.
const shopStats=async()=>{
 const m=globalThis.__shs
 if(m&&Date.now()-m.t<60000)return m.v
 let d=null;try{d=await kv.get('tmp:shopstat')}catch(e){}
 const v=d&&d.v||null
 globalThis.__shs={t:Date.now(),v}
 if(!d||Date.now()-(d.t||0)>600000){
  bg((async()=>{if(!await kv.lock('shopstat',120000))return
   try{const us=await allUsers();let ord=0,inc=0;for(const u of us)for(const x of u.tx||[])if(x.type==='order'&&x.status==='success'){ord++;inc+=x.price}
    const nv={users:us.length,ord,inc};await kv.set('tmp:shopstat',{t:Date.now(),v:nv},86400*7);globalThis.__shs={t:Date.now(),v:nv}}
   finally{await kv.unlock('shopstat')}})().catch(()=>{}))}
 return v}
const lvl=n=>n>=200?'Platinum':n>=50?'Gold':n>=10?'Silver':'Reguler'
const runtime=at=>{const m=Math.max(0,Math.floor((Date.now()-(+at||Date.now()))/60000));return `${Math.floor(m/1440)}d ${Math.floor(m%1440/60)}h ${m%60}m`}
const ov=x=>x!==''&&x!=null&&/^\d+$/.test(String(x))?+x:null
const POP=['whatsapp','telegram','facebook','instagram','tiktok','google','shopee','gojek','grab','tokopedia','twitter','discord','dana','ovo']

// ---------- MODE RESELLER ----------
// Bot reseller memakai mesin yang sama, hanya dengan cfg hasil "tempel markup".
// Markup reseller ditumpuk DI ATAS markup platform, jadi sellPrice() tidak perlu diubah
// dan semua layar harga otomatis ikut. cfg asli disimpan di c.cfg0 untuk menghitung bagi hasil.
const rsCfg=(cfg,rs)=>{
 // TANPA MODAL: markup = RUPIAH per server di atas harga web utama (bukan persen). Flat ditambahkan di sellPrice()
 // SETELAH pembulatan platform, jadi harga pelanggan = harga web + markup Rp persis (mis. 5.000 + 1.000 = 6.000).
 if(rs.mode!=='mandiri'){const mks={...(cfg.mks||{})}
  for(const sv of SERVERS)mks[sv.server]={...(cfg.mks||{})[sv.server],rsFlat:RS.flatOf(rs,sv.server)}
  return {...cfg,mks,dep:{...cfg.dep,engine:'rs'},ref:{...cfg.ref,on:false},bonus:{...cfg.bonus,on:false}}}
 const m=(+rs.markup||0)/100
 // hasilnya PERSEN (bukan pecahan), dibulatkan 3 angka di belakang koma
 const bump=p=>Math.round(((1+(+p||0)/100)*(1+m)-1)*100000)/1000
 const mks={};for(const k of Object.keys(cfg.mks||{})){const o=cfg.mks[k]||{};mks[k]={...o,pct:bump(o.pct==null?cfg.markup:o.pct)}}
 return {...cfg,markup:bump(cfg.markup),mks,
  // deposit di bot reseller DIPAKSA lewat mesin 'rs': AustinPay + SMP Payment, dipilih acak merata
  // (saklar tiap rute diatur admin di Deposit > Rute bot reseller, tersimpan di cfg.dep.routes3).
  dep:{...cfg.dep,engine:'rs'},
  // program platform (ajak teman & bonus deposit) tidak berlaku di bot reseller
  ref:{...cfg.ref,on:false},bonus:{...cfg.bonus,on:false}}}
// Harga jual yang dilihat pelanggan (sudah termasuk markup reseller bila ini bot reseller).
const price4=(c,sv,base)=>sellPrice(c.cfg,sv,base)
// Bagian reseller dari satu order = harga pelanggan - harga platform.
const rsCut=(c,sv,base)=>c.rs?Math.max(0,sellPrice(c.cfg,sv,base)-sellPrice(c.cfg0||c.cfg,sv,base)):0
const mkTxt=a=>a.mode==='mandiri'?a.markup+'%':'Rp'+Math.round(RS.flatOf(a,'*')).toLocaleString('id-ID')+(Object.keys(a.mkS||{}).length?' · per server':' / nomor')
const rsBrand=c=>String((c.rs&&c.rs.brand)||(c.bot&&c.bot.brand)||'TOKO NOKOS').slice(0,28)
const rsOwner=c=>String((c.rs&&c.rs.bot&&c.rs.bot.ownerUser)||(c.bot&&c.bot.ownerUser)||'').replace(/^@/,'')
const tgKey=c=>c.bot.rs?`tgr:${c.bot.rs}:${c.from.id}`:'tg:'+c.from.id
// Kartu untuk channel milik reseller dibuat di lib/reseller.js (RS.card / RS.samar),
// lalu dikirim bersama foto struk lewat notifOrder() supaya struknya cukup digambar sekali.
const samar=RS.samar
// Uang ditulis memakai mata uang toko kalau ini bot reseller; bot platform tetap rupiah.
// Dipakai dengan "const rp=RP(c)" di dalam fungsi, supaya seluruh rp(...) di fungsi itu ikut.
const RP=c=>(c&&c.rs?(n=>money(c.rs,n)):rp)
const rpIdr=rp   // selalu rupiah (untuk catatan pemilik toko & admin)
const Tx=(c,k)=>TR(c&&c.rs,k)

// ---------- pengiriman pesan ----------
// Pesan kaya (Bot API 10.1+): sendRichMessage / editMessageText + rich_message.
// Dipakai kalau layar ini punya pasangan markdown-nya. Gagal → kembali ke HTML klasik,
// dan kalau metodenya memang tidak ada, mode kaya dimatikan untuk sisa proses.
async function richSend(c,text,k,{mid=0}={}){
 if(!richOk())return null
 const md=mdOf(text);if(!md)return null
 const kirim=async body=>tg(c.bot.token,mid?'editMessageText':'sendRichMessage',body)
 const base=mid?{chat_id:c.chat,message_id:mid}:{chat_id:c.chat}
 const mk=k||(mid?{inline_keyboard:[]}:null)
 let r=await kirim({...base,rich_message:{markdown:md},...(mk?{reply_markup:mk}:{})})
 if(r.ok||/not modified/i.test(r.description||''))return r
 let d=String(r.description||'')
 // Isi pesan ditolak (gambar/markdown rewel) → coba sekali lagi versi sederhana.
 // Yang penting tetap pesan kaya, bukan langsung mundur ke tampilan lama.
 const polos=md.replace(/^!\[\]\([^)]*\)\n?\n?/,'').replace(/<details>[\s\S]*?<\/details>/g,'').trim()
 if(polos&&polos!==md){
  r=await kirim({...base,rich_message:{markdown:polos},...(mk?{reply_markup:mk}:{})})
  if(r.ok||/not modified/i.test(r.description||''))return r
  d=String(r.description||'')}
 // Catat alasannya (tampil di Panel Admin). TIDAK mematikan mode kaya untuk pesan lain:
 // satu layar bermasalah tidak boleh membuat seluruh bot balik ke tampilan lama.
 kv.set('tmp:richerr',{d,at:Date.now()}).catch(()=>{})
 // Hanya kalau metodenya memang tidak ada (server lama) baru istirahat 20 menit,
 // lalu dicoba lagi sendiri — bukan mati selamanya.
 if(/method not found|Not Found: method/i.test(d))globalThis.__tgrichOff=Date.now()+20*60000
 return null}
const sendHtml=(c,text,k)=>tg(c.bot.token,'sendMessage',{chat_id:c.chat,text,parse_mode:'HTML',disable_web_page_preview:true,...(k?{reply_markup:k}:{})})
const send=async(c,text,k)=>(await richSend(c,text,k))||sendHtml(c,text,k)
const typing=c=>{tg(c.bot.token,'sendChatAction',{chat_id:c.chat,action:'typing'})}
async function show(c,text,k,keepPhoto){
 if(c.mid){
  // Pesan kaya bisa diubah langsung, termasuk kalau pesan lamanya memuat gambar.
  {const rr=await richSend(c,text,k,{mid:c.mid});if(rr&&rr.ok)return rr}
  if(c.isPhoto&&!keepPhoto){tg(c.bot.token,'deleteMessage',{chat_id:c.chat,message_id:c.mid});return send(c,text,k)}
  const r=await tg(c.bot.token,c.isPhoto?'editMessageCaption':'editMessageText',{chat_id:c.chat,message_id:c.mid,...(c.isPhoto?{caption:text}:{text,disable_web_page_preview:true}),parse_mode:'HTML',reply_markup:k||{inline_keyboard:[]}})
  if(r.ok||/not modified/i.test(r.description||''))return r}
 return send(c,text,k)}
// jawab tombol: hanya sekali. Dipakai juga untuk popup teks.
const toast=(c,text,alert)=>{if(!c.cbq||c.answered)return;c.answered=true;return tg(c.bot.token,'answerCallbackQuery',{callback_query_id:c.cbq,text:String(text||'').slice(0,190),show_alert:!!alert})}

// ---------- akun ----------
async function getUser(c){
 const id=c.from.id,uid=await (c.uidP||kv.get(tgKey(c)));let u=uid&&await kv.get('u:'+uid)
 const name=[c.from.first_name,c.from.last_name].filter(Boolean).join(' ').trim()||c.from.username||('User '+id)
 if(u){let ch=false;if(u.tgBot!==c.bot.id){u.tgBot=c.bot.id;ch=true};if(u.tgBlocked){u.tgBlocked=false;ch=true};if((c.from.username||'')!==(u.tgUser||'')){u.tgUser=c.from.username||'';ch=true};if(ch)await save(u);return u}
 const cfg=await getCfg(),email=c.bot.rs?`tg${id}.r${c.bot.rs}@reseller.invalid`:`tg${id}@telegram.invalid`
 let rf=null;if(c.ref&&cfg.ref.on){const rfid=await kv.get('rc:'+c.ref);rf=rfid&&await kv.get('u:'+rfid);if(!rf||rf.banned)rf=null}
 u={id:rid(),email,name,pass:hash(rid()),balance:0,apikey:rid(),banned:false,tx:[],mut:[],joinedAt:new Date().toISOString(),refBy:rf?rf.id:null,refPaid:false,tgId:id,tgUser:c.from.username||'',tgBot:c.bot.id,via:'telegram',...(c.bot.rs?{rs:c.bot.rs}:{})}
 await save(u);await ensureRef(u);await kv.set('e:'+email,u.id);await kv.set('k:'+u.apikey,u.id);await kv.set(tgKey(c),u.id)
 await kv.sadd('idx',u.id)
 if(c.bot.rs){await kv.sadd('rsc:'+c.bot.rs,String(id));RS.addCust(c.bot.rs).catch(()=>{})
  bg(notify({src:'bot',i:'🛍',t:'Pelanggan reseller baru',st:'ok',rows:[['Toko',rsBrand(c)],['Telegram',c.from.username?'@'+c.from.username:'ID '+id]],note:'Mendaftar lewat bot reseller'}).catch(()=>{}))
  return u}
 await kv.sadd('tgidx',id)
 const total=((await kv.get('idx'))||[]).length
 bg(notify({src:'bot',i:'👤',t:'Pengguna baru',st:'ok',rows:[['Nama',String(name).slice(0,2)+'***'],['Telegram',c.from.username?'@'+c.from.username:'ID '+id],['Total pengguna',total],...(rf?[['Diajak oleh',mask(rf.email)]]:[])],note:'Mendaftar lewat bot Telegram'}).catch(()=>{}))
 return u}
const okOrders=u=>(u.tx||[]).filter(x=>x.type==='order'&&x.status==='success')
const siteOf=c=>BASE(c.cfg.site.baseUrl||c.sec.SITE_URL||c.bot.site||'')

// ---------- menu utama (banner + kotak nama + teks Information + tombol) ----------
const BANNER_V=3   // naikkan angka ini bila public/bot-banner.jpg diganti, supaya cache lama dibuang
const DEFAULT_BANNER=c=>{const w=siteOf(c);return w?w+'/bot-banner.jpg':''}
// Menu pelanggan di bot reseller: sederhana — beli, isi saldo, riwayat, CS ke owner.
async function rsMenu(c,u,note,banner){
 const rp=RP(c)
 const ok=okOrders(u),cs=rsOwner(c),m=c.cfg.maint||{}
 const aktif=(u.tx||[]).filter(x=>x.type==='order'&&x.status==='pending').length
 const a=c.rs||await RS.getRs(c.bot.rs).catch(()=>({}))
 const cust=+a.cust>0?+a.cust:((await kv.get('rsc:'+c.bot.rs))||[]).length
 const t=k2=>Tx(c,k2)
 const text=rich({ic:'🏪',note,banner,title:t('dash.title')+' '+rsBrand(c),
  hello:`${t('dash.hello')}, ${u.tgUser?'@'+esc(u.tgUser):'<b>'+esc(String(u.name).slice(0,24))+'</b>'}.`,
  intro:t('dash.intro'),
  blocks:[['📊',t('sec.akun'),[[t('f.status'),m.on?t('v.maint'):t('v.aktif')],[t('f.role'),c.own?t('v.owner'):t('v.cust')],[t('f.saldo'),rp(u.balance)],[t('f.aktif'),String(aktif)],[t('f.sukses'),ok.length+'x']]],
   ['🏪',t('sec.toko'),[[t('f.toko'),rsBrand(c)],[t('f.cs'),cs?'@'+cs:'-'],[t('f.cust'),String(cust)],[t('f.terjual'),(a.sold||0)+'x'],[t('f.layanan'),t('v.24')]]]],
  tipTitle:t('tip.title'),tip:t('tip.body')})
 const k=[[B(t('menu.buy'),'buy','primary')],
  [B(t('menu.dep'),'dep','success')],
  [B(t('menu.his'),'his:0'),B(t('menu.acc'),'acc')],
  [cs?U(t('menu.cs'),'https://t.me/'+cs,'success'):B(t('menu.cs'),'help')],
  [B('🚀 JUALAN NOKOS TANPA MODAL KLIK INI','rspromo','success')]]
 if(c.own)k.push([B(t('menu.panel'),'a','danger')])
 return [text,kb(k)]}
// Halaman promosi program bot reseller (tombol di menu SEMUA bot reseller, mode tanpa modal & mandiri).
// Beberapa halaman bertombol: utama, detail mode, simulasi untung, cara mulai. Semua berakhir di tombol daftar.
const RS_PROMO_URL='https://www.tokonokosarta.my.id/'
const PL='━━━━━━━━━━━━━━━━━━'
async function rsPromo(c,pg){
 let pct=5;try{pct=(await RS.getRegCfg()).depPct}catch(e){}
 const CTA=U('🚀 KUY BIKIN BOT JUALAN NOKOS TANPA MODAL',RS_PROMO_URL,'success')
 const home=B('⬅️ Kembali','rspromo','primary')
 let text,k
 if(pg==='1'){
  text=[`<b>🟢 MODE TANPA MODAL</b>`,`<i>Paling cocok buat pemula</i>`,PL,
   Q('💳 <b>Modal: Rp0</b>','Stok &amp; pembayaran pelanggan kami yang urus.'),'',
   '<b>Cara kamu dapat uang:</b>',
   Q('💰 <b>Markup Rupiah sendiri</b>, bisa beda tiap server (harga web + markup kamu)','✅ Komisi cair <b>saat OTP diterima</b> (order gagal/batal = tidak ada komisi)',`🎁 <b>Komisi ${pct}%</b> dari setiap deposit pelanggan botmu`,'🏧 Saldo untung bisa <b>ditarik</b> (min. Rp10.000)'),'',
   '<b>Aman buat kamu:</b>',
   Q('🛡 Order gagal / dibatalkan: tidak ada komisi, tapi juga tidak ada rugi','📦 Tidak ada stok yang numpuk, tidak ada risiko rugi modal'),'',
   PL,`<b>🔵 MODE STOK MANDIRI</b>`,`<i>Untuk yang sudah punya banyak pelanggan</i>`,PL,
   Q('📦 Isi <b>saldo stok</b> sendiri, beli nomor di harga modal','🏦 Pembayaran pelanggan masuk ke <b>QRIS milikmu</b>','📈 Kontrol penuh atas harga &amp; arus uang')].join('\n')
  k=[[B('💰 Simulasi Untung','rspromo:2','success')],[CTA],[home]]}
 else if(pg==='2'){
  text=[`<b>💰 SIMULASI UNTUNG</b>`,`<i>Contoh hitungan saja, bukan jaminan penghasilan</i>`,PL,
   '<b>Misal harga di web utama <code>Rp5.000</code></b>','',
   Q('🏷 Markup kamu    <b>Rp1.000</b>','🛒 Harga ke pelanggan    <b>Rp6.000</b>','💵 Untung per OTP masuk    <b>Rp1.000</b>'),'',
   '<b>Kalau botmu laku:</b>',
   Q('📱 10 order / hari  →  <b>±Rp10.000</b>','📱 30 order / hari  →  <b>±Rp30.000</b>','📱 100 order / hari  →  <b>±Rp100.000</b>'),'',
   `➕ Belum termasuk <b>komisi ${pct}%</b> dari deposit pelanggan.`,'',
   '<i>Markup bebas kamu atur sendiri (Rp, per server). Komisi hanya untuk order yang OTP-nya masuk. Penghasilan nyata tergantung harga yang kamu pasang dan jumlah pelanggan.</i>'].join('\n')
  k=[[CTA],[home]]}
 else if(pg==='3'){
  text=[`<b>🪜 CARA MULAI</b>`,`<i>Cuma 4 langkah, tanpa ribet</i>`,PL,
   Q('1️⃣  Buka website lewat tombol di bawah','2️⃣  Daftar &amp; pilih mode: <b>tanpa modal</b> / <b>mandiri</b>','3️⃣  Buat bot di @BotFather, tempel token-nya','4️⃣  Atur markup Rp &amp; nama toko, lalu bagikan link botmu'),'',
   '<b>Setelah itu?</b>',
   Q('📣 Promosikan botmu di grup, status, dan media sosial','🤖 Sisanya otomatis: nomor, OTP, refund, laporan'),'',
   '⏱ <i>Rata-rata selesai dalam hitungan menit.</i>'].join('\n')
  k=[[CTA],[home]]}
 else{
  text=[`<b>🚀 JUALAN NOKOS TANPA MODAL</b>`,PL,
   `<b>Punya bot nokos sendiri.</b>`,`<b>Pelanggan beli, kamu untung.</b> 💸`,'',
   Q('✅ <b>Modal Rp0</b> (mode tanpa modal)','✅ Bot Telegram &amp; <b>nama toko sendiri</b>','✅ OTP otomatis <b>24 jam</b>, refund otomatis','✅ Untung masuk di <b>setiap order sukses</b>'),'',
   '🔥 <b>KENAPA BANYAK YANG PILIH</b>',
   Q('🌍 6 bahasa &amp; mata uang  🇮🇩 🇲🇾 🇬🇧 🇵🇭 🇹🇭 🇻🇳','📱 WhatsApp, Telegram, Google &amp; banyak lagi','🖥 Banyak server, harga bersaing','📣 Channel notifikasi order &amp; OTP khusus tokomu','🛠 Kelola toko langsung dari Telegram'),'',
   PL,'👇 <b>Pilih info yang kamu mau</b>'].join('\n')
  k=[[B('🟢 Tanpa Modal vs 🔵 Mandiri','rspromo:1','primary')],[B('💰 Simulasi Untung','rspromo:2','success'),B('🪜 Cara Mulai','rspromo:3','primary')],[CTA],BACK]}
 return show(c,text,kb(k))}
async function mainMenu(c,u,note,banner){
 if(c.rs)return rsMenu(c,u,note,banner)
 const ok=okOrders(u),web=siteOf(c),m=c.cfg.maint||{}
 const st=await Promise.race([shopStats(),sleep(900).then(()=>null)]),cs=c.cfg.stats||{}
 const aktif=(u.tx||[]).filter(x=>x.type==='order'&&x.status==='pending').length
 const trx=(ov(cs.orders)??(st?st.ord:'-')),usr=ov(cs.users)??(st?st.users:'-')
 const text=rich({ic:'🌟',note,banner,title:'Dashboard Layanan Nokos',
  hello:`Halo, ${u.tgUser?'@'+esc(u.tgUser):'<b>'+esc(String(u.name).slice(0,24))+'</b>'}.`,
  intro:'Kelola layanan Anda dengan cepat, aman, dan otomatis melalui menu yang tersedia.',
  blocks:[['📊','Ringkasan Akun',[['Status',m.on?'🔴 Maintenance':'🟢 Aktif'],['Role',c.adm?'Admin':lvl(ok.length)],['Saldo',rp(u.balance)],['Order Aktif',String(aktif)],['Order Sukses',ok.length+'x']]],
   ['✅','Ringkasan Sistem',[['Total Pengguna',String(usr)],['Total Order',String(trx)],['Total Revenue',st?rp(st.inc):'-'],['Runtime',runtime(c.bot.at)]]]],
  tip:'1️⃣ Tekan <b>Isi Saldo</b> → bayar QRIS / VA → saldo masuk otomatis.\n2️⃣ Tekan <b>Order Nokos</b> → pilih server, aplikasi, lalu negara.\n3️⃣ Kode OTP dikirim ke chat ini begitu masuk.\n4️⃣ Kode tidak masuk? Batalkan, saldo kembali penuh.'})
 const k=[[B('🛍 Order Nokos','buy','primary')],
  [B('💰 Isi Saldo','dep','success')],
  [B('📜 Riwayat','his:0'),B('👤 Akun','acc')],
  [B('🎁 Ajak Teman','ref','success'),B('💬 Bantuan','help')],
  [web?U('🌐 Buka Web',web+'/dashboard'):B('🌐 Web','web')]]
 if(c.adm)k.push([B('🛠 Panel Admin','a','danger')])
 return [text,kb(k)]}
const SENDM={photo:['sendPhoto','photo'],video:['sendVideo','video'],animation:['sendAnimation','animation']}
async function menu(c,u,note){
 let bn=await kv.get('tgbn:'+c.bot.id);if(bn&&bn.auto&&bn.v!==BANNER_V)bn=null   // banner bawaan versi lama -> ganti yang baru
 if(!bn){const url=DEFAULT_BANNER(c);if(url)bn={t:'photo',f:url+'?v='+BANNER_V,auto:1}}
 // Pesan kaya hanya bisa menampilkan gambar lewat TAUTAN. Banner hasil unggahan
 // (file_id) karena itu dilayani lewat alamat situs sendiri: /api/tgbn/<botId>.
 const web=siteOf(c)
 const url=bn&&bn.t==='photo'
  ?(/^https?:\/\//.test(String(bn.f))?String(bn.f)
    :(web?web+'/api/tgbn/'+c.bot.id+'?v='+String(bn.f).slice(-10):''))
  :''
 const [text,k]=await mainMenu(c,u,note,url)
 const old=c.mid,clean=()=>{if(old)tg(c.bot.token,'deleteMessage',{chat_id:c.chat,message_id:old})}
 // 1) pesan kaya (banner ikut di dalamnya)
 {const rr=await richSend(c,text,k);if(rr&&rr.ok){clean();return rr}}
 // 2) klasik: foto + keterangan HTML
 if(bn&&SENDM[bn.t]&&plain(text)<=1010){
  const [mt,fld]=SENDM[bn.t],r=await tg(c.bot.token,mt,{chat_id:c.chat,[fld]:bn.f,caption:text,parse_mode:'HTML',reply_markup:k,...(bn.t==='video'?{supports_streaming:true}:{})})
  if(r.ok){clean()
   // simpan file_id supaya pengiriman berikutnya instan (tanpa Telegram mengunduh gambar lagi)
   if(bn.auto&&r.result&&r.result.photo){kv.set('tgbn:'+c.bot.id,{t:'photo',f:r.result.photo[r.result.photo.length-1].file_id,auto:1,v:BANNER_V})}
   return r}
  if(!bn.auto)kv.del('tgbn:'+c.bot.id)}   // banner buatan admin rusak -> kembali ke bawaan
 const r=await send(c,text,k);if(r.ok)clean();return r}

// ---------- akun / riwayat / mutasi / referral / bantuan ----------
async function accView(c,u){
 const rp=RP(c)
 const ok=okOrders(u),spent=ok.reduce((a,x)=>a+x.price,0),tgOnly=/@telegram\.invalid$/.test(u.email)
 const text=rich({ic:'👤',title:'Akun Saya',
  hello:`Halo, ${u.tgUser?'@'+esc(u.tgUser):'<b>'+esc(String(u.name).slice(0,24))+'</b>'}.`,
  blocks:[['🪪','Identitas',[['Nama',u.name],['Status',c.adm?'Admin':lvl(ok.length)],['Bergabung',wibAt(Date.parse(u.joinedAt)).replace(' WIB','')]]],
   ['📊','Ringkasan Transaksi',[['Saldo',rp(u.balance)],['Order Sukses',ok.length+'x'],['Total Belanja',rp(spent)]]]],
  foot:`📧 <code>${esc(u.email)}</code>\n<i>${tgOnly?'Akun dibuat dari Telegram. Buat password agar bisa masuk di web.':'Akun web &amp; bot memakai saldo yang sama.'}</i>`})
 return show(c,text,kb([[B('💰 Isi Saldo','dep','success'),B('📜 Riwayat','his:0')],[B('🔑 Password Web','pw','success'),B('🔗 Hubungkan Web','lnk')],BACK]))}
async function hisView(c,u,page){
 const rp=RP(c)
 const all=(u.tx||[]).filter(x=>x.type==='order'),pg=Math.max(0,+page||0),items=all.slice(pg*5,pg*5+5)
 const text=`${H('📜','RIWAYAT ORDER',all.length?`${all.length} order · hal ${pg+1}/${Math.ceil(all.length/5)}`:'')}\n\n`+(items.length?'Ketuk order untuk melihat detail 👇':'<i>Belum ada order. Yuk beli nokos pertamamu!</i>')
 const rows=items.map(o=>[B(`${stOf(o.status)} ${String(o.serviceName).slice(0,16)} · ${o.phone}`,'ord:'+sid(o.id),o.status==='success'?'success':o.status==='pending'?'primary':'danger')])
 const nav=[];if(pg>0)nav.push(B('⬅️ Baru','his:'+(pg-1)));if((pg+1)*5<all.length)nav.push(B('Lama ➡️','his:'+(pg+1)))
 return show(c,text,kb([...rows,nav,[B('🛒 Beli Lagi','buy','success'),...BACK]]))}
async function mutView(c,u,page){
 const rp=RP(c)
 const all=u.mut||[],pg=Math.max(0,+page||0),items=all.slice(pg*8,pg*8+8)
 const text=`${H('🧾','MUTASI SALDO',all.length?`hal ${pg+1}/${Math.ceil(all.length/8)}`:'')}\n\n`+(items.length?Q(items.map(m=>`${m.amt>=0?'🟢':'🔴'} <b>${m.amt>=0?'+':'-'}${rp(Math.abs(m.amt))}</b> → ${rp(m.bal)}\n<i>${esc(String(m.note||'').slice(0,34))} · ${wibAt(m.at)}</i>`).join('\n')):'<i>Belum ada mutasi.</i>')
 const nav=[];if(pg>0)nav.push(B('⬅️ Baru','mut:'+(pg-1)));if((pg+1)*8<all.length)nav.push(B('Lama ➡️','mut:'+(pg+1)))
 return show(c,text,kb([nav,[B('💰 Isi Saldo','dep','success'),...BACK]]))}
async function refView(c,u){
 await ensureRef(u);const cf=c.cfg.ref,web=siteOf(c),link=`https://t.me/${c.bot.username}?start=ref_${u.refCode||''}`
 const text=`${H('🎁','AJAK TEMAN','Dapat bonus tiap teman yang deposit')}\n\n${Q(`🔖 Kode  <code>${esc(u.refCode||'-')}</code>`,`👥 Teman  <b>${u.refCount||0}</b>`,`💎 Bonus  <b>${rp(u.refEarn||0)}</b>`)}\n${cf.on?`Kamu dapat <b>${rp(cf.referrer)}</b>, temanmu dapat <b>${rp(cf.referee)}</b> setelah deposit min. <b>${rp(cf.minDep)}</b>.`:'<i>Program ajakan sedang nonaktif.</i>'}\n\n🔗 <code>${esc(link)}</code>`
 return show(c,text,kb([[U('📤 Bagikan Link','https://t.me/share/url?url='+encodeURIComponent(link)+'&text='+encodeURIComponent('Beli nomor OTP murah & otomatis di Artapedia ID'),'success'),C('📋 Salin Link',link)],...(web?[[C('🌐 Salin Link Web',web+'/register?ref='+(u.refCode||''))]]:[]),BACK]))}
async function helpView(c){
 const web=siteOf(c),btn=(c.cfg.buttons||[]).filter(b=>b&&b.text&&/^https?:\/\//.test(b.url||'')).slice(0,4)
 const text=`${H('💬','BANTUAN')}\n\n${Q('1️⃣ <b>Isi saldo</b> via QRIS / Virtual Account','2️⃣ <b>Beli nokos</b>: server → aplikasi → negara','3️⃣ Kode <b>OTP dikirim otomatis</b> ke chat ini','4️⃣ OTP tak masuk? Batalkan, saldo kembali')}\n<i>Butuh bantuan lain? Hubungi CS di bawah.</i>`
 return show(c,text,kb([web?[U('💬 Chat CS di Web',web+'/cs','success')]:[],...btn.map(b=>[U(b.text,b.url)]),BACK]))}
async function webView(c){return show(c,'⚠️ URL situs belum diisi admin.',kb([BACK]))}

// ---------- password web / hubungkan akun ----------
async function pwView(c,u){
 const web=siteOf(c);if(!web)return show(c,'⚠️ URL situs belum diisi admin.',kb([[B('⬅️ Kembali','acc')]]))
 const tk=rid();await kv.set('pr:'+tk,{id:u.id,exp:Date.now()+30*60000})
 return show(c,`${H('🔑','PASSWORD WEB','Link berlaku 30 menit, sekali pakai')}\n\nBuat password lewat tombol di bawah, lalu masuk di web dengan email:\n<code>${esc(u.email)}</code>`,kb([[U('🔐 Buat Password',web+'/reset?token='+tk,'success'),C('📋 Salin Email',u.email)],[B('⬅️ Kembali','acc')]]))}
async function lnkView(c){
 await setSt(c.from.id,{k:'link'})
 return show(c,`${H('🔗','HUBUNGKAN AKUN WEB','Saldo &amp; riwayat jadi satu')}\n\n${Q('1️⃣ Web › Dashboard › Beranda › <b>Hubungkan Telegram</b> › pilih bot ini','2️⃣ Salin kode yang muncul','3️⃣ <b>Kirim kodenya ke chat ini</b> 👇')}\n<i>Syarat: saldo akun bot Rp0 dan tidak ada order berjalan.</i>`,kb([[B('❌ Batal','m','danger')]]))}
async function doLink(c,u,code){
 code=String(code||'').trim().toUpperCase().replace(/[^A-Z0-9]/g,'')
 const r=code&&await kv.get('tmp:tgl:'+code);await setSt(c.from.id,{})
 if(!r||r.exp<Date.now())return show(c,'❌ Kode tidak valid atau kedaluwarsa. Buat kode baru di web.',kb([[B('🔄 Coba Lagi','lnk'),B('🏠 Menu','m','danger')]]))
 if(r.bot&&r.bot!==c.bot.id){const ob=(await getBots()).find(x=>x.id===r.bot);return show(c,`❌ Kode ini dibuat untuk bot <b>@${esc(ob?ob.username:'lain')}</b>. Kirim kodenya di sana, atau buat kode baru untuk bot ini di web.`,kb([BACK]))}
 const w=await kv.get('u:'+r.uid);if(!w||w.banned)return show(c,'❌ Akun web tidak ditemukan / diblokir.',kb([BACK]))
 if(w.id===u.id)return show(c,'✅ Akun ini sudah terhubung.',kb([BACK]))
 if(w.tgId&&w.tgId!==c.from.id)return show(c,'❌ Akun web itu sudah terhubung ke Telegram lain.',kb([BACK]))
 if(u.balance>0||(u.tx||[]).some(x=>x.status==='pending'))return show(c,'❌ Akun bot punya saldo / order berjalan. Habiskan dulu, atau minta admin memindahkan.',kb([BACK]))
 w.tgId=c.from.id;w.tgUser=c.from.username||'';w.tgBot=c.bot.id;await save(w);await kv.set('tg:'+c.from.id,w.id);await kv.del('tmp:tgl:'+code)
 await kv.del('u:'+u.id);await kv.del('e:'+u.email);await kv.del('k:'+u.apikey)
 await kv.set('idx',((await kv.get('idx'))||[]).filter(x=>x!==u.id))
 await notify({src:'bot',i:'🔗',t:'Akun web terhubung',st:'ok',rows:[['Pengguna',mask(w.email)],['Telegram',c.from.username?'@'+c.from.username:'ID '+c.from.id]]})
 return show(c,`${H('✅','TERHUBUNG')}\n\n${Q(`📧 <code>${esc(mask(w.email))}</code>`,`👛 Saldo  <b>${rp(w.balance)}</b>`)}`,kb([[B('🏠 Menu Utama','m','success')]]))}

// ---------- BELI NOKOS ----------
const maintBlock=c=>{const m=c.cfg.maint||{};return m.on?(m.msg||'Situs sedang maintenance, pesanan & deposit baru dihentikan sementara.'):''}
const maintView=(c,mb)=>show(c,`${H('🛠','MAINTENANCE')}\n\n${Q(esc(mb))}`,kb([BACK]))
function svList(c){return SERVERS.map(s=>({...s,...((c.cfg.srv||{})[s.server]||{})})).filter(s=>!c.cfg.off.includes(s.server)&&(!s.needs||c.sec[s.needs]))}
// Tips order (dibaca sebelum order). Sama di bot platform & SEMUA bot reseller.
const tipsText=()=>[
 H('💡','TIPS ORDER','Baca dulu sebelum order'),'',
 'Beli nomor dengan harga yang lebih terjangkau, stok melimpah, dan server lebih cepat 😋','',
 Q('Untuk pembelian di web berbeda dengan pembelian di bot.'),'',
 '<b>💡 Sedikit Tips:</b>','',
 '<b>A. Login tidak tersedia di WhatsApp</b>',
 Q('1. Hapus memory (bukan data), paksa berhenti aplikasi, lalu download aplikasi VPN <b>1.1.1.1 WARP</b>, aktifkan VPN, dan beli ulang nomor.','2. Gunakan aplikasi WhatsApp lain: jika memakai WhatsApp biasa coba WhatsApp Bisnis, atau sebaliknya.','3. Gunakan HP lain yang jarang digunakan untuk mendaftarkan nomor WhatsApp.'),'',
 '<b>B. Tidak menerima OTP</b>',
 Q('1. Download VPN <b>1.1.1.1</b> dan aktifkan VPN, lalu beli ulang nomor dan daftarkan.'),'',
 '<b>ℹ️ WARNING:</b>',
 Q('Jika muncul <i>Login tidak tersedia</i>, harus menunggu 1 jam, atau OTP SMS tidak terkirim, kemungkinan HP kamu telah terdeteksi oleh sistem WhatsApp karena terlalu sering mendaftarkan nomor WhatsApp.','','<b>Jangan paksa login</b> karena berisiko diblokir. Tunggu beberapa jam atau gunakan HP lain yang jarang digunakan untuk mendaftar WhatsApp.'),'',
 '<b>🔎 Rekomendasi Negara untuk WhatsApp</b>',
 Q('1. Indonesia 🇮🇩 (+62)','2. Colombia 🇨🇴 (+57)','3. Philippine 🇵🇭 (+63)'),'',
 '<b>🤚 INFORMASI UNTUK RESELLER</b>',
 Q('Bagi kalian penjual nomor WhatsApp, perlu diingat bahwa WhatsApp memiliki sistem keamanan yang dapat mendeteksi aktivitas pendaftaran nomor secara berulang. Jadi, jangan asal mendaftarkan banyak nomor tanpa memahami risikonya.','','Beberapa seller sering menyalahkan nomor yang dijual, padahal nomor kami berfungsi dengan baik. Masalah pendaftaran tidak selalu berasal dari nomor, tetapi bisa disebabkan oleh sistem keamanan WhatsApp.')].join('\n')
const tipsView=c=>show(c,tipsText(),kb([[B('✅ Sudah Baca, Lanjut Order','buy','success')],BACK]))
async function buyStart(c,u){
 const mb=maintBlock(c);if(mb)return maintView(c,mb)
 const sv=svList(c);if(!sv.length)return show(c,'⚠️ Belum ada server nokos yang aktif.',kb([BACK]))
 const m=(c.cfg.maint||{}).srv||{}
 const rows=sv.map(s=>{const i=SERVERS.findIndex(x=>x.server===s.server),mm=m[s.server]&&m[s.server].on;return [B(`${mm?'🛠':'🖥'} ${s.name}${s.badge?' · '+s.badge:''}`,'bs:'+i,mm?'danger':'success')]})
 const text=rich({ic:'🛒',title:'Order Nokos',hello:'Langkah <b>1 dari 3</b> — pilih server.',
  blocks:[['👛','Ringkasan Akun',[['Saldo',rp(u.balance)],['Server Aktif',sv.length+' server'],['Layanan','24 Jam Nonstop']]],
   ['🖥','Daftar Server',sv.slice(0,7).map(s=>[s.name,(m[s.server]&&m[s.server].on)?'🛠 Maintenance':(s.badge||'Siap')])]],
  tipTitle:'💡 Keterangan server',tip:sv.slice(0,7).map(s=>`• <b>${esc(s.name)}</b> — ${esc(String(s.description||'').slice(0,70))}`).join('\n')})
 return show(c,text,kb([[B('💡 TIPS ORDER · Baca dulu sebelum order','tips','primary')],...rows,BACK]))}
async function pickServer(c,u,i){
 const s=SERVERS[+i];if(!s||!P[s.server])return show(c,'⚠️ Server tidak dikenal.',kb([[B('⬅️ Server','buy')]]))
 const mm=((c.cfg.maint||{}).srv||{})[s.server];if(mm&&mm.on)return show(c,`${H('🛠','SERVER MAINTENANCE')}\n\n${Q(esc(mm.msg||'Server ini sedang maintenance, coba server lain.'))}`,kb([[B('⬅️ Pilih Server','buy')]]))
 typing(c);let items;try{items=await svItems(s.server)}catch(e){return show(c,'⚠️ Gagal memuat aplikasi: '+esc(e.message),kb([[B('🔄 Coba Lagi','bs:'+i),B('⬅️ Server','buy','danger')]]))}
 await setSt(c.from.id,{k:'buy',sv:s.server,q:''});return svPage(c,0)}
async function svPage(c,page){
 const st=await getSt(c.from.id);if(st.k!=='buy'||!st.sv)return show(c,'Sesi habis. Mulai lagi.',kb([[B('🛒 Beli Nokos','buy','success')]]))
 let all;try{all=await svItems(st.sv)}catch(e){return show(c,'⚠️ Gagal memuat aplikasi: '+esc(e.message),kb([[B('🔄 Coba Lagi','bl:0'),...BACK]]))}
 const q=(st.q||'').toLowerCase(),idx=x=>all.indexOf(x)
 const pop=!q?POP.map(p=>all.find(x=>x.n.toLowerCase().includes(p))).filter((x,i,a)=>x&&a.indexOf(x)===i).slice(0,6):[]
 const list=(q?all.filter(x=>x.n.toLowerCase().includes(q)):all.filter(x=>!pop.includes(x))),PER=10
 const tp=Math.max(1,Math.ceil(list.length/PER)),pg=Math.min(Math.max(0,+page||0),tp-1),cur=list.slice(pg*PER,pg*PER+PER)
 const sn=(SERVERS.find(x=>x.server===st.sv)||{}).name
 const text=`${H('📱','PILIH APLIKASI','Langkah 2 dari 3')}\n\n${Q(`🖥 Server  <b>${esc(sn)}</b>`,q?`🔍 Cari  <b>${esc(st.q)}</b>`:'',`📚 ${q?list.length+' hasil dari '+all.length+' aplikasi':all.length+' aplikasi'}`)}\n<i>💡 Ketik nama aplikasi untuk mencari (mis. whatsapp)</i>${(!cur.length&&!pop.length)?'\n\n⚠️ Tidak ada hasil.':''}`
 const rows=[]
 if(pg===0)for(let i=0;i<pop.length;i+=3)rows.push(pop.slice(i,i+3).map(x=>B('⭐ '+x.n.slice(0,14),'bp:'+idx(x),'success')))
 for(let i=0;i<cur.length;i+=2)rows.push(cur.slice(i,i+2).map(x=>B(x.n.slice(0,22),'bp:'+idx(x))))
 const nav=[];if(pg>0)nav.push(B('⬅️','bl:'+(pg-1)));nav.push(B(`${pg+1}/${tp}`,'bl:'+pg));if(pg<tp-1)nav.push(B('➡️','bl:'+(pg+1)))
 const tools=[B('🔍 Cari','bq','success')];if(q)tools.push(B('✖️ Hapus','bx','danger'))
 return show(c,text,kb([...rows,nav,tools,[B('⬅️ Server','buy'),B('🏠 Menu','m','danger')]]))}
async function pickService(c,u,i){
 const st=await getSt(c.from.id);if(st.k!=='buy')return show(c,'Sesi habis.',kb([[B('🛒 Beli Nokos','buy','success')]]))
 let s;try{s=(await svItems(st.sv))[+i]}catch(e){}
 if(!s)return show(c,'⚠️ Aplikasi tidak ditemukan. Muat ulang daftar.',kb([[B('🔄 Muat Ulang','bl:0')]]))
 typing(c);let cs;try{cs=await ctRaw(st.sv,s.c)}catch(e){return show(c,'⚠️ Gagal memuat harga: '+esc(e.message),kb([[B('🔄 Coba Lagi','bp:'+i),B('⬅️ Kembali','bl:0')]]))}
 const opts=[];for(const ct of cs)for(const x of ct.pricelist||[])opts.push({cn:ct.name,fl:ct.flag||'',cid:x.country_id,pid:x.provider_id,pn:x.provider_name||'',price:sellPrice(c.cfg,st.sv,x.price),stock:x.stock})
 opts.sort((a,b)=>a.price-b.price)
 await setSt(c.from.id,{k:'buy',sv:st.sv,sid:s.c,sname:s.n,opts:opts.slice(0,60),g:0});return optPage(c,u,0)}
async function optPage(c,u,page){
 const rp=RP(c)
 const st=await getSt(c.from.id);if(st.k!=='buy'||!st.opts)return show(c,'Sesi habis.',kb([[B('🛒 Beli Nokos','buy','success')]]))
 const PER=8,tp=Math.max(1,Math.ceil(st.opts.length/PER)),pg=Math.min(Math.max(0,+page||0),tp-1),cur=st.opts.slice(pg*PER,pg*PER+PER)
 const text=`${H('🌍','NEGARA &amp; HARGA','Langkah 3 dari 3')}\n\n${Q(`📲 <b>${esc(st.sname)}</b>`,`👛 Saldo  <b>${rp(u.balance)}</b>`,`📚 ${st.opts.length} pilihan`)}\n${st.opts.length?'<i>🟢 saldo cukup · 🔴 saldo kurang · angka = stok</i>':'⚠️ Stok kosong untuk aplikasi ini. Coba server lain.'}`
 const rows=cur.map((o,j)=>[B(`${o.fl||'🌐'} ${o.cn.slice(0,14)}${o.pn?' · '+o.pn.slice(0,10):''} · ${rp(o.price)}${o.stock!=null?' · '+o.stock:''}`,'bo:'+(pg*PER+j),u.balance>=o.price?'success':'danger')])
 const nav=[];if(pg>0)nav.push(B('⬅️','bt:'+(pg-1)));nav.push(B(`${pg+1}/${tp}`,'bt:'+pg));if(pg<tp-1)nav.push(B('➡️','bt:'+(pg+1)))
 return show(c,text,kb([...rows,nav,[B('⬅️ Aplikasi','bl:0'),B('🏠 Menu','m','danger')]]))}
async function confirmView(c,u,i,g){
 const rp=RP(c)
 const st=await getSt(c.from.id),o=st.k==='buy'&&st.opts&&st.opts[+i];if(!o)return show(c,'Sesi habis.',kb([[B('🛒 Beli Nokos','buy','success')]]))
 if(g!=null){st.g=0;await setSt(c.from.id,st)}
 const fee=0,total=o.price+fee,cukup=u.balance>=total
 const text=`${H('🧾','KONFIRMASI PESANAN')}\n\n${Q(`📲 <b>${esc(st.sname)}</b>`,`🌍 ${esc(o.cn)}${o.pn?' · '+esc(o.pn):''}`,`🏷 Harga  <b>${rp(o.price)}</b>`)}\n${Q(`💳 Total  <b>${rp(total)}</b>`,`👛 Saldo  <b>${rp(u.balance)}</b>${cukup?'':'  ⚠️ kurang '+rp(total-u.balance)}`)}`
 return show(c,text,kb([
  cukup?[B('✅ Beli Sekarang','bgo:'+i,'success')]:[B('💰 Isi Saldo','dep','success')],[B('⬅️ Pilihan Lain','bt:0'),B('❌ Batal','m','danger')]]))}
// Notifikasi order ke channel admin, lengkap dengan FOTO STRUK.
// Kalau struk gagal digambar, notifikasi tetap terkirim sebagai teks biasa.
// Notifikasi ke channel ADMIN. Kalau pelakunya pelanggan bot reseller (u.rs),
// judulnya diberi tanda (reseller) dan barisnya ditambahi Toko/Bot/Markup/Saldo reseller.
const notifAdm=async(u,n)=>{
 try{const extra=u&&u.rs?await RS.rows(u.rs):[]
  await notify(extra.length?{...n,t:n.t+' (reseller)',rows:[...(n.rows||[]),...extra]}:n)}
 catch(e){try{await notify(n)}catch(_){}}}
const notifOrder=async(o,n)=>{let pg=null
 try{pg=await strukPng({...o,orderId:o.id,phoneNumber:o.phone,createdAt:new Date(o.at).toISOString()},'order','artapedia.id',PACK_ID)}catch(e){}
 // struk Indonesia dipakai channel admin; channel reseller memakai bahasa tokonya sendiri
 // (kartu + struk dibangun di lib/reseller.js, digambar ulang hanya kalau bahasanya beda)
 if(n.rsUid&&n.rsKind)(n.rsKind==='otp'?RS.chOtp(n.rsUid,o,pg):RS.chOrder(n.rsUid,o,pg,n.rsBuyer)).catch(()=>{})
 try{const extra=n.rsUid?await RS.rows(n.rsUid):[]
  const {rsUid,rsKind,rsBuyer,...rest}=n
  await notify(extra.length?{...rest,t:rest.t.includes('reseller')?rest.t:rest.t+' (reseller)',rows:[...(rest.rows||[]),...extra],photo:pg,photoName:'struk-'+o.id+'.png'}
   :{...rest,photo:pg,photoName:'struk-'+o.id+'.png'})}catch(e){}}
async function placeOrder(c,u0,i){
 const rp=RP(c)
 const st=await getSt(c.from.id),o=st.k==='buy'&&st.opts&&st.opts[+i];if(!o)return show(c,'Sesi habis.',kb([[B('🛒 Beli Nokos','buy','success')]]))
 const mb=maintBlock(c);if(mb)return maintView(c,mb)
 // kunci anti klik ganda (dua ketukan cepat tidak boleh membeli dua kali)
 if(await kv.incr(`rl:ord:${c.from.id}:${Math.floor(Date.now()/4000)}`)>1)return
 typing(c)
 const [u,raw]=await Promise.all([kv.get('u:'+u0.id),ctRaw(st.sv,st.sid).catch(()=>null)])
 if(u.banned)return show(c,'⛔ Akun ditangguhkan.')
 let base=null;if(raw)for(const ct of raw)for(const x of ct.pricelist)if(x.provider_id==o.pid&&x.country_id==o.cid)base=x.price
 if(base==null)return show(c,'⚠️ Stok / harga berubah. Pilih ulang.',kb([[B('🔄 Pilih Ulang','bt:0')]]))
 const sell=sellPrice(c.cfg,st.sv,base);if(sell!==o.price)return show(c,`⚠️ Harga berubah menjadi <b>${rp(sell)}</b>. Pilih ulang untuk melanjutkan.`,kb([[B('🔄 Pilih Ulang','bt:0')]]))
 const g=false,fee=0,price=sell
 if(u.balance<price)return show(c,'⚠️ '+Tx(c,'ord.kurang'),kb([[B(Tx(c,'menu.dep'),'dep','success'),...BACK]]))
 // Mode mandiri: nokos dibeli memakai SALDO STOK reseller. Dicek dulu supaya
 // pelanggan tidak terlanjur dipotong saat stok tokonya habis.
 let modal=0
 if(MANDIRI(c)){
  const sell0=sellPrice(c.cfg0||c.cfg,st.sv,base)
  modal=sell0+(g?Math.ceil(sell0*0.1):0)
  const fresh=await RS.getRs(c.rs.uid)
  if((+fresh.stok||0)<modal){
   const own=(c.rs.bot&&c.rs.bot.ownerId)||''
   if(own)tg(c.bot.token,'sendMessage',{chat_id:own,parse_mode:'HTML',
    text:`${H('📦','SALDO STOK HABIS')}\n\n${Q(`Pelanggan gagal memesan karena saldo stok tokomu kurang.`,`Butuh <b>${rpIdr(modal)}</b>, tersisa <b>${rpIdr(fresh.stok)}</b>.`)}\n<i>Isi saldo stok lewat menu Panel Toko › Isi Saldo Stok (QRIS, masuk otomatis).</i>`}).catch(()=>{})
   return show(c,Tx(c,'ord.habis'),kb([[rsOwner(c)?U(Tx(c,'menu.cs'),'https://t.me/'+rsOwner(c),'success'):B(Tx(c,'menu.cs'),'help')],BACK]))}}
 // URUTAN AMAN: pesan nomor DULU, saldo dipotong setelah berhasil. Gagal/timeout = saldo tidak pernah terpotong.
 // Order gagal TIDAK dikirim ke channel Telegram (atas permintaan admin): pembeli cukup melihat pesan errornya.
 let r;try{r=await P[st.sv].order({serviceId:st.sid,countryId:o.cid,providerId:o.pid,serviceName:st.sname,countryName:o.cn,server:st.sv})}
 catch(e){return show(c,`${H('❌','ORDER GAGAL')}\n\n${Q(esc(String(e.message).slice(0,200)))}\n<i>Saldo kamu tidak terpotong.</i>`,kb([[B('🔄 Coba Lagi','bt:0'),B('🏠 Menu','m','danger')]]))}
 const f=(await kv.get('u:'+u.id))||u   // data terbaru tepat sebelum memotong
 if(f.balance<price){try{await P[st.sv].cancel(r.id)}catch(_){};return show(c,'⚠️ '+Tx(c,'ord.kurang'),kb([[B(Tx(c,'menu.dep'),'dep','success'),...BACK]]))}
 if(MANDIRI(c)&&modal>0){
  const ok=await RS.stokUse(c.rs.uid,modal,st.sname+' · '+o.cn).catch(()=>false)
  if(!ok){try{await P[st.sv].cancel(r.id)}catch(_){}
   return show(c,Tx(c,'ord.habis'),kb([[rsOwner(c)?U(Tx(c,'menu.cs'),'https://t.me/'+rsOwner(c),'success'):B(Tx(c,'menu.cs'),'help')],BACK]))}}
 mut(f,-price,'Order nokos (bot)')
 const cut0=(c.rs&&!MANDIRI(c))?rsCut(c,st.sv,base):0   // jatah komisi: BARU cair saat OTP diterima (webhook.rsPayCut)
 const rec={...(cut0>0?{rsPend:cut0}:{}),type:'order',id:r.id,server:st.sv,serviceId:st.sid,serviceName:st.sname,countryName:o.cn,countryId:o.cid,providerId:o.pid,phone:r.phone,price,fee,guarantee:g,status:'pending',otp:null,msg:null,cost:r.cost,expiredAt:r.expiredAt,refunded:false,at:Date.now(),via:'telegram'}
 f.tx.unshift(rec)
 try{await Promise.all([kv.set('o:'+r.id,f.id),save(f),setSt(c.from.id,{})])}catch(e){try{await P[st.sv].cancel(r.id)}catch(_){};return show(c,'⚠️ Gagal menyimpan pesanan. Saldo tidak terpotong, coba lagi.',kb([[B('🔄 Coba Lagi','bt:0')]]))}
 // Bot reseller: selisih markup langsung masuk dompet reseller dan bisa ditarik.
 // Stok mandiri: harga platform dipotong dari saldo stok reseller (bukan dari kas platform).
 if(c.rs&&MANDIRI(c))rec.rsStok=modal
 
 notifOrder(rec,{rsUid:c.rs&&c.rs.uid,rsKind:'order',rsBuyer:samar(f.name||f.email),src:'bot',i:'📱',t:'Pembelian nokos',st:'pending',id:['ID Order',r.id],rows:[['Pengguna',mask(f.email)],...(c.rs&&!MANDIRI(c)?[['Untung reseller (cair saat OTP masuk)',rp(rsCut(c,st.sv,base))]]:[]),['Layanan',st.sname+' · '+o.cn],['Nomor',r.phone],['Harga',rp(price)],['Jaminan OTP',g?'Aktif (+'+rp(fee)+')':'Tidak'],['Server',st.sv],['Batas tunggu OTP',wibAt(r.expiredAt)],['Saldo sekarang',rp(f.balance)]],note:'Menunggu kode OTP masuk'})
 const res=await orderView(c,f,rec,'✅ <b>Pesanan dibuat!</b> Kode OTP muncul di sini otomatis.')
 // pantau OTP langsung beberapa detik (tanpa menunggu cron 1 menit)
 const mid=(res&&res.result&&res.result.message_id)||c.mid
 if(mid)await watchOrder(c,f.id,r.id,mid)
 return res}
function orderCard(c,o,note){
 const rp=RP(c)
 const s=sid(o.id),pend=o.status==='pending'
 const text=rich({ic:'📱',note,title:'Detail Order',
  hello:`Status: ${stOf(o.status)} <b>${stName(o.status)}</b>`,
  blocks:[['📦','Ringkasan Order',[['Layanan',o.serviceName],['Negara',o.countryName||'-'],['Nomor',o.phone],['Harga',rp(o.price)],['Jaminan OTP',o.guarantee?'🛡 Aktif':'Tidak'],pend?['Sisa Waktu',sisa(o.expiredAt)]:null,o.otp?['Kode OTP',o.otp]:null]]],
  foot:`🆔 <code>${esc(o.id)}</code>`
   +(pend&&o.cancelReq?`\n<i>⏳ ${esc(cancelMsg())}</i>`
     :pend?'\n<i>Kode OTP otomatis dikirim ke chat ini begitu masuk.</i>':'')})
 const rows=[]
 if(pend)rows.push(o.cancelReq?[B('🔄 Cek OTP','oc:'+s,'success'),B('⏳ Batal Diantre','ord:'+s,'danger')]
  :[B('🔄 Cek OTP','oc:'+s,'success'),cancelWaitSec(o)>0?B('⏳ Batal '+Math.floor(cancelWaitSec(o)/60)+':'+String(cancelWaitSec(o)%60).padStart(2,'0'),'ox:'+s,'primary'):B('❌ Batalkan','ox:'+s,'danger')])
 const cp=[C('📋 Salin Nomor',o.phone)];if(o.otp)cp.push(C('📋 Salin OTP',o.otp,'success'));rows.push(cp)
 rows.push([B('🛒 Beli Lagi','buy','success'),...BACK])
 return [text,kb(rows)]}
function orderView(c,u,o,note){const [t,k]=orderCard(c,o,note);return show(c,t,k)}
const findOrder=(u,s)=>(u.tx||[]).find(x=>x.type==='order'&&sid(x.id)===s)
async function pollOrder(u,o,dm){
 if(o.status!=='pending')return
 // Penyedia gagal ditanya (server mereka mati / ordernya sudah dihapus): order yang sudah
 // lewat batas tetap dikedaluwarsakan supaya saldonya kembali, bukan menggantung selamanya.
 let s=null
 try{s=await P[o.server].status(o.id)}
 catch(e){if(await expireIfLate(u,o,e.message))return;throw e}
 if(s.otp){o.status='success';o.otp=s.otp;o.msg=s.msg;if(!dm)o.tgSent=true;await fireOtp(u,o)
  notifOrder(o,{rsUid:u.rs,rsKind:'otp',src:'bot',i:'🔑',t:'OTP diterima',st:'ok',id:['ID Order',o.id],rows:[['Pengguna',mask(u.email)],['Layanan',o.serviceName+(o.countryName?' · '+o.countryName:'')],['Nomor',o.phone],['Kode',o.otp],['Harga',rp(o.price)],['Server',o.server]],note:o.guarantee?'Order memakai Jaminan OTP':'Transaksi selesai (done)'})}
 else if(['expired','cancelled','canceled'].includes(s.state)||Date.now()>o.expiredAt){o.status='expired'
  // kalau order dari bot reseller: markup ditarik kembali (mode komisi) atau
  // saldo stok dikembalikan (mode mandiri) — hanya saat refund benar-benar terjadi
  if(await refundOnce(u,o)&&u.rs){
   if(o.rsCut)RS.addEarn(u.rs,-o.rsCut,'Refund '+o.id).catch(()=>{})
   if(o.rsStok)RS.stokAdd(u.rs,o.rsStok,'Refund '+o.id).catch(()=>{})}
  notifAdm(u,{src:'bot',i:'⌛',t:'Order expired + refund',st:'warn',id:['ID Order',o.id],rows:[['Pengguna',mask(u.email)],['Layanan',o.serviceName],['Refund',rp(o.price)],['Saldo sekarang',rp(u.balance)]]})}
 // permintaan batal yang tertunda dicoba lagi di sini juga, dan nomornya tidak diganti
 else if(o.cancelReq)await retryCancel(u,o)
 else if(await expireIfLate(u,o,'batas tunggu lewat'))return
 else await replaceIfNeeded(u,o)}
// Pantau order ±25 detik setelah dibeli: begitu OTP masuk, layar diedit dan user dapat notifikasi baru.
async function watchOrder(c,uid,oid,mid){
 const end=Date.now()+25000
 while(Date.now()<end){
  await sleep(2500)
  const u=await kv.get('u:'+uid),o=u&&(u.tx||[]).find(x=>x.id===oid);if(!o||o.status!=='pending')return
  const was=o.status+o.phone
  try{await pollOrder(u,o,true)}catch(e){continue}
  if(o.status+o.phone!==was){await save(u)
   const [t,k]=orderCard(c,o,o.status==='success'?'🎉 <b>OTP masuk!</b>':o.status==='expired'?'⌛ <b>Order kedaluwarsa.</b> Saldo dikembalikan.':'🔁 <b>Nomor diganti otomatis</b> (Jaminan OTP).')
   await tg(c.bot.token,'editMessageText',{chat_id:c.chat,message_id:mid,text:t,parse_mode:'HTML',disable_web_page_preview:true,reply_markup:k})
   if(o.status!=='pending')return}}}
async function ordCheck(c,u0,s){
 const u=await kv.get('u:'+u0.id),o=findOrder(u,s);if(!o)return show(c,'Order tidak ditemukan.',kb([BACK]))
 const was=o.status+o.phone;typing(c)
 try{await pollOrder(u,o,false)}catch(e){return orderView(c,u,o,'⚠️ Gagal cek: '+esc(String(e.message).slice(0,100)))}
 await save(u)
 return orderView(c,u,o,o.status==='success'?'🎉 <b>OTP masuk!</b>':o.status==='expired'?'⌛ <b>Order kedaluwarsa.</b> Saldo dikembalikan.':was!==o.status+o.phone?'🔁 <b>Nomor diganti otomatis</b> (Jaminan OTP).':`⏳ <i>Belum ada OTP · dicek ${jam()} WIB</i>`)}
async function ordCancelAsk(c,u,s){
 const o=findOrder(u,s);if(!o)return show(c,'Order tidak ditemukan.',kb([BACK]))
 {const why=cancelBlock(o);if(why)return orderView(c,u,o,'⚠️ '+esc(why))}
 return show(c,`${H('❌','BATALKAN ORDER?')}\n\n${Q(`☎️ <code>${esc(o.phone)}</code>`,`💸 Refund  <b>${rp(o.price)}</b> ke saldo`)}\n<i>Jika OTP ternyata sudah masuk, order tidak dibatalkan.</i>`,kb([[B('✅ Ya, Batalkan','oxy:'+s,'danger'),B('↩️ Tidak','ord:'+s,'success')]]))}
async function ordCancel(c,u0,s){
 const u=await kv.get('u:'+u0.id),o=findOrder(u,s);if(!o)return show(c,'Order tidak ditemukan.',kb([BACK]))
 {const why=cancelBlock(o);if(why)return orderView(c,u,o,'⚠️ '+esc(why))}
 let s0=null;try{s0=await P[o.server].status(o.id)}
 catch(e){if(await expireIfLate(u,o,e.message))return orderView(c,u,o,'⌛ <b>Batas tunggu sudah lewat.</b> Saldomu sudah dikembalikan penuh.')}
 if(s0&&s0.otp){o.status='success';o.otp=s0.otp;o.msg=s0.msg;o.tgSent=true;await fireOtp(u,o);await save(u);return orderView(c,u,o,'ℹ️ Kode OTP ternyata sudah masuk, order selesai.')}
 // Ditolak penyedia? Permintaannya tidak dibuang: disimpan lalu dicoba ulang otomatis.
 try{await P[o.server].cancel(o.id)}
 catch(e){markCancel(o,e);await save(u)
  return orderView(c,u,o,`⏳ <b>Pembatalan sedang diantre.</b>\n<i>${esc(cancelMsg())}</i>`)}
 o.status='cancelled'
 if(await refundOnce(u,o)&&c.rs){
  if(o.rsCut)RS.addEarn(c.rs.uid,-o.rsCut,'Refund '+o.id).catch(()=>{})
  if(o.rsStok)RS.stokAdd(c.rs.uid,o.rsStok,'Refund '+o.id).catch(()=>{})}
 await save(u)
 notifAdm(u,{src:'bot',i:'❌',t:'Order dibatalkan',st:'warn',id:['ID Order',o.id],rows:[['Pengguna',mask(u.email)],['Layanan',o.serviceName],['Nomor',o.phone],['Refund',rp(o.price)],['Saldo sekarang',rp(u.balance)]],note:'Dibatalkan pengguna, saldo sudah kembali'})
 return orderView(c,u,o,'✅ <b>Order dibatalkan.</b> Saldo sudah kembali.')}

// ---------- ISI SALDO ----------
// ---------- deposit manual: pelanggan bayar ke QRIS milik reseller ----------
const MANDIRI=c=>!!(c.rs&&RS.isMandiri(c.rs))
const AMTS_M=[2000,5000,10000,20000,50000,100000,200000,500000,1000000]
const {DEP_MIN,DEP_MAX}=RS   // batas deposit QRIS manual: Rp2.000 - Rp10.000.000
async function mdepStart(c,u){
 const rp=RP(c),q=(c.rs&&c.rs.qris)||{}
 if(!q.img)return show(c,rich({ic:'💰',title:Tx(c,'dep.title'),
  hello:'⚠️ Pemilik toko belum memasang QRIS pembayaran.',
  intro:'Hubungi customer service untuk mengisi saldo.'}),
  kb([[rsOwner(c)?U(Tx(c,'menu.cs'),'https://t.me/'+rsOwner(c),'success'):B(Tx(c,'menu.cs'),'help')],BACK]))
 const rows=[];for(let i=0;i<AMTS_M.length;i+=3)rows.push(AMTS_M.slice(i,i+3).map(a=>B(rp(a),'md:'+a,'success')))
 await setSt(c.from.id,{k:'mamt'})
 const text=rich({ic:'💰',title:Tx(c,'dep.title'),hello:Tx(c,'dep.pick'),
  blocks:[['👛',Tx(c,'sec.akun'),[[Tx(c,'f.saldo'),rp(u.balance)],[Tx(c,'dep.min'),rp(DEP_MIN)],[Tx(c,'dep.max'),rp(DEP_MAX)],['QRIS',q.name||rsBrand(c)]]]],
  tipTitle:'💡 '+Tx(c,'dep.title'),tip:Tx(c,'dep.qris')})
 return show(c,text,kb([...rows,[B('✏️ '+Tx(c,'dep.amt'),'mdc','primary')],[B(Tx(c,'menu.home'),'m','danger')]]))}
// tampilkan QRIS + nominal, lalu tunggu foto bukti
async function mdepShow(c,u,amt){
 const rp=RP(c),q=(c.rs&&c.rs.qris)||{}
 const n=Math.floor(+amt||0)
 if(!(n>=DEP_MIN&&n<=DEP_MAX))return show(c,`⚠️ ${Tx(c,'dep.min')} <b>${rp(DEP_MIN)}</b> · ${Tx(c,'dep.max')} <b>${rp(DEP_MAX)}</b>`,kb([[B(Tx(c,'menu.back'),'dep')]]))
 const d=await RS.depNew(c.rs.uid,{cust:u.id,tgId:c.from.id,nama:u.name,amount:n})
 await setSt(c.from.id,{k:'mproof',id:d.id})
 const cap=rich({ic:'💳',title:Tx(c,'dep.title'),
  hello:`${Tx(c,'dep.total')}: <b>${rp(n)}</b>`,
  blocks:[['🧾',Tx(c,'sec.akun'),[[Tx(c,'dep.amt'),rp(n)],['QRIS',q.name||rsBrand(c)],['ID',d.id]]]],
  foot:'<i>'+Tx(c,'dep.qris')+'</i>'})
 const k=kb([[B(Tx(c,'dep.send'),'mdp:'+d.id,'success')],[B('❌ '+Tx(c,'menu.back'),'dep','danger')]])
 // QRIS tersimpan sebagai data URL -> dikirim sebagai foto (multipart)
 try{const {tgSend}=await import('./telegram')
  const buf=Buffer.from(String(q.img).split(',')[1]||'','base64')
  if(buf.length){const r=await tgSend(c.bot.token,c.chat,cap,k,buf,'qris.png');if(r&&r.ok)return r}}catch(e){}
 return show(c,cap,k)}
async function depStart(c,u){
 const rp=RP(c)
 if(MANDIRI(c))return mdepStart(c,u)
 const mb=maintBlock(c);if(mb)return maintView(c,mb)
 const ml=await methodsList(c.cfg)
 if(!ml.length)return show(c,'⚠️ Belum ada metode pembayaran aktif. Hubungi admin.',kb([BACK]))
 const b=c.cfg.bonus
 const text=rich({ic:'💰',title:'Isi Saldo',hello:'Langkah <b>1 dari 2</b> — pilih metode pembayaran.',
  blocks:[['👛','Ringkasan Akun',[['Saldo Sekarang',rp(u.balance)],['Metode Tersedia',ml.length+' metode'],b.on?['Bonus Deposit',b.pct+'% · min '+rp(b.minAmt)]:null]]],
  tipTitle:'💡 Catatan deposit',tip:'Saldo masuk <b>otomatis</b> setelah pembayaranmu terbaca. Kalau sudah transfer tapi belum masuk, tekan tombol <b>Saya Sudah Bayar</b> di tagihan.'})
 const rows=[],btn=ml.map(m=>B((m.type==='va'?'🏦 ':'📲 ')+m.name,'dm:'+m.provider,m.type==='va'?'primary':'success'))
 for(let i=0;i<btn.length;i+=2)rows.push(btn.slice(i,i+2))
 return show(c,text,kb([...rows,[B('📜 Tagihan Saya','dl'),B('🏠 Menu','m','danger')]]))}
const AMTS=[5000,10000,20000,50000,100000,200000]
async function depAmount(c,u,m){
 const rp=RP(c)
 const ml=await methodsList(c.cfg),x=ml.find(y=>y.provider===m);if(!x)return show(c,'⚠️ Metode tidak tersedia.',kb([[B('⬅️ Metode','dep')]]))
 const ok=AMTS.filter(a=>a>=x.min&&a<=x.max),rows=[];for(let i=0;i<ok.length;i+=3)rows.push(ok.slice(i,i+3).map(a=>B(rp(a),'da:'+m+':'+a,'success')))
 await setSt(c.from.id,{k:'amt',m})   // user juga boleh langsung mengetik angka
 return show(c,rich({ic:'💵',title:'Pilih Nominal',hello:`Langkah <b>2 dari 2</b> — metode <b>${esc(x.name)}</b>.`,
  blocks:[['📐','Batas Nominal',[['Minimal',rp(x.min)],['Maksimal',rp(x.max)],['Saldo Sekarang',rp(u.balance)]]]],
  intro:'Ketuk salah satu tombol nominal di bawah, atau <b>ketik langsung angkanya</b> di chat.',
  tipTitle:'💡 Format angka yang diterima',tip:'15000 · 15.000 · Rp15.000 · 15k · 15rb · 1,5jt'}),
  kb([...rows,[B('✏️ Nominal Sendiri','dc:'+m,'primary')],[B('⬅️ Metode','dep'),B('🏠 Menu','m','danger')]]))}
async function depCustom(c,u,m){
 const rp=RP(c)
 const ml=await methodsList(c.cfg),x=ml.find(y=>y.provider===m);if(!x)return show(c,'⚠️ Metode tidak tersedia.',kb([[B('⬅️ Metode','dep')]]))
 await setSt(c.from.id,{k:'amt',m})
 return show(c,`${H('✏️','NOMINAL SENDIRI',esc(x.name))}\n\n${Q(`📉 Minimal  <b>${rp(x.min)}</b>`,`📈 Maksimal  <b>${rp(x.max)}</b>`)}\nKetik <b>nominal</b> yang kamu mau di chat 👇\n<i>Contoh: 15000 · 15.000 · 15k · 1,5jt</i>`,kb([[B('⬅️ Pakai Tombol Nominal','dm:'+m),B('❌ Batal','m','danger')]]))}
async function depConfirm(c,u,m,amt){
 const rp=RP(c)
 const ml=await methodsList(c.cfg),x=ml.find(y=>y.provider===m);if(!x)return show(c,'⚠️ Metode tidak tersedia.',kb([[B('⬅️ Metode','dep')]]))
 if(!(amt>=x.min&&amt<=x.max)){await setSt(c.from.id,{k:'amt',m});return show(c,`⚠️ <b>${amt>0?'Nominal '+rp(amt)+' di luar batas.':'Nominal tidak terbaca.'}</b>\n${Q(`📉 Minimal  <b>${rp(x.min)}</b>`,`📈 Maksimal  <b>${rp(x.max)}</b>`)}\nKetik angka lagi atau pilih tombol 👇`,kb([[B('✏️ Ketik Lagi','dc:'+m,'primary'),B('💵 Tombol Nominal','dm:'+m,'success')],[B('❌ Batal','m','danger')]]))}
 const b=c.cfg.bonus,bn=b.on&&amt>=b.minAmt?Math.floor(amt*b.pct/100):0
 return show(c,rich({ic:'🧾',title:'Konfirmasi Deposit',hello:'Periksa dulu sebelum tagihan dibuat.',
  blocks:[['💳','Rincian',[['Metode',x.name],['Nominal',rp(amt)],bn?['Bonus','~'+rp(b.max?Math.min(bn,b.max):bn)]:null,['Masuk ke Saldo',rp(amt+(b.max?Math.min(bn,b.max):bn))]]]],
  foot:'<i>Biaya layanan (jika ada) tampil di tagihan.</i>'}),kb([[B('✅ Buat Tagihan','dgo:'+m+':'+amt,'success')],[B('⬅️ Ubah Nominal','dm:'+m),B('❌ Batal','m','danger')]]))}
const qrUrl=q=>'https://api.qrserver.com/v1/create-qr-code/?size=600x600&margin=12&data='+encodeURIComponent(q)
// noImg = gambar QR gagal dikirim; kode QRIS-nya ikut ditulis supaya tetap bisa dipakai
// (disalin lalu ditempel di menu "bayar dengan kode QRIS" aplikasi e-wallet).
function depCaption(c,o,note,noImg){
 const rp=RP(c)
 o=o||{}
 const m=(METHODS[o.method]||METHODS.qris).name,pend=o.status==='pending'
 const qris=pend&&noImg&&o.qr&&!o.va
 return rich({ic:'💳',note,title:'Tagihan Deposit',
  hello:`Status: ${stOf(o.status)} <b>${stName(o.status)}</b>`,
  blocks:[['🧾','Rincian Pembayaran',[['Metode',m],['Nominal',rp(o.amount)],o.fee>0?['Biaya',rp(o.fee)]:null,['Total Bayar',rp(o.total)],o.va?['Nomor VA',o.va]:null,o.expMs&&pend?['Batas Bayar',wibAt(o.expMs).replace(' WIB','').replace(',','')+' · '+sisa(o.expMs).replace(' menit',' mnt')]:null]]],
  foot:`🆔 <code>${esc(o.id)}</code>`
   +(qris?`\n\n<b>Kode QRIS</b> (ketuk untuk menyalin):\n<code>${esc(o.qr)}</code>\n<i>Gambar QR sedang tidak bisa ditampilkan. Salin kode di atas, lalu di aplikasi e-wallet pilih bayar memakai kode / tempel QRIS.</i>`:'')
   +(pend&&!qris?`\n<i>${o.va?'Transfer sesuai total ke nomor VA di atas.':'Scan QR dengan e-wallet / m-banking apa saja.'} Saldo masuk otomatis.</i>`:'')})}
// Kirim tagihan BESERTA gambar QR, dengan beberapa jalur cadangan. Urutannya:
// gambar dari gateway (URL) -> gambar data URL diunggah sebagai berkas -> QR dibuat
// dari qr_string -> terakhir teks biasa yang memuat kode QRIS-nya.
// Apa pun yang gagal, pengguna TETAP menerima tagihannya.
// Ambil gambar QR sebagai BERKAS. Mengunduhnya sendiri jauh lebih andal daripada
// menyuruh Telegram menjemput URL-nya: Telegram sering gagal/menolak menjemput URL
// pihak ketiga, dan kegagalannya tidak kelihatan sebagai pesan error yang jelas.
async function qrBuf(rec){
 const img=String(rec.qrImg||'')
 if(/^data:image\//i.test(img)){
  try{const b=Buffer.from(img.split(',')[1]||'','base64');if(b.length>100)return b}catch(e){}}
 for(const url of [/^https?:\/\//.test(img)?img:'',rec.qr?qrUrl(rec.qr):''].filter(Boolean)){
  try{const r=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(9000)})
   if(!r.ok)continue
   const t=String(r.headers.get('content-type')||'')
   if(!/^image\//i.test(t))continue
   const b=Buffer.from(await r.arrayBuffer())
   if(b.length>100&&b.length<5e6)return b}catch(e){}}
 return null}
// Kirim tagihan BESERTA gambar QR, berlapis-lapis supaya tidak pernah gagal diam-diam:
// unduh sendiri lalu unggah -> suruh Telegram menjemput URL-nya -> teks yang memuat
// kode QRIS. Apa pun yang terjadi, pengguna TETAP menerima tagihannya.
async function depSend(c,rec,note){
 const img=String(rec.qrImg||'')
 const cap=depCaption(c,rec,note),k=depKb(rec)
 let err=''
 const buf=await qrBuf(rec)
 if(buf){
  try{const {tgSend}=await import('./telegram')
   const r=await tgSend(c.bot.token,c.chat,cap,k,buf,'qris-'+rec.id+'.png')
   if(r&&r.ok)return r;err=(r&&r.error)||'unggah ditolak'}catch(e){err=e.message}}
 for(const url of [/^https?:\/\//.test(img)?img:'',rec.qr?qrUrl(rec.qr):''].filter(Boolean)){
  try{const r=await tg(c.bot.token,'sendPhoto',{chat_id:c.chat,photo:url,caption:cap,parse_mode:'HTML',reply_markup:k})
   if(r&&r.ok)return r;err=r&&r.description||err}catch(e){err=e.message}}
 // tidak ada gambar yang bisa dikirim: tagihannya tetap dikirim, lengkap dengan kode QRIS
 try{await kv.set('tmp:qrerr',{at:Date.now(),id:rec.id,err:String(err).slice(0,160)},86400)}catch(e){}
 return send(c,depCaption(c,rec,note,true),k)}
const depKb=o=>kb(o.status==='pending'
 ?[[B('✅ Saya Sudah Bayar','dk:'+sid(o.id),'success')],[B('❌ Batalkan','dx:'+sid(o.id),'danger')],o.va?[C('📋 Salin No. VA',o.va),C('📋 Salin Total',o.total)]:[C('📋 Salin Total',o.total)],BACK]
 // tagihan kedaluwarsa/gagal masih bisa dicek ulang: pembayaran bisa saja masuk telat
 :['expired','failed'].includes(o.status)
 ?[[B('✅ Saya Sudah Bayar','dk:'+sid(o.id),'success')],[B('💰 Isi Lagi','dep','success'),B('🛒 Beli Nokos','buy','success')],BACK]
 :[[B('💰 Isi Lagi','dep','success'),B('🛒 Beli Nokos','buy','success')],BACK])
const findDep=(u,s)=>(u.tx||[]).find(x=>x.type==='deposit'&&sid(x.id)===s)
async function depCreate(c,u0,m,amt){
 const mb=maintBlock(c);if(mb)return maintView(c,mb)
 if(await kv.incr(`rl:dep:${c.from.id}:${Math.floor(Date.now()/4000)}`)>1)return
 typing(c)
 const [u,ml]=await Promise.all([kv.get('u:'+u0.id),methodsList(c.cfg)]),x=ml.find(y=>y.provider===m)
 if(!x||!(amt>=x.min&&amt<=x.max))return show(c,'⚠️ Metode / nominal tidak valid.',kb([[B('⬅️ Metode','dep')]]))
 if(u.tx.filter(y=>y.type==='deposit'&&y.status==='pending').length>=3)return show(c,'⚠️ Terlalu banyak tagihan belum dibayar. Batalkan salah satu dulu.',kb([[B('📜 Tagihan Saya','dl'),B('🏠 Menu','m','danger')]]))
 let d;try{d=await createDeposit(c.cfg,m,amt)}catch(e){return show(c,`${H('❌','GAGAL MEMBUAT TAGIHAN')}\n\n${Q(esc(e.message))}`,kb([[B('🔄 Coba Lagi','dm:'+m),B('🏠 Menu','m','danger')]]))}
 const rec={type:'deposit',id:d.id,amount:amt,total:d.total,fee:d.fee,qr:d.qr,qrImg:d.qrImg,va:d.va||'',method:m,gw:d.gw,exp:d.exp,expMs:toMs(d.exp),status:'pending',credited:false,at:Date.now(),via:'telegram'}
 u.tx.unshift(rec);await Promise.all([kv.set('d:'+rec.id,u.id),depPendAdd(rec.id,u.id),save(u),setSt(c.from.id,{})])
 // struk tagihan digambar sekali, dipakai channel reseller (bahasa toko) & channel admin
 bg((async()=>{let pg=null
  try{pg=await strukPng({order_id:rec.id,amount:rec.amount,total_amount:rec.total,bonus:0,
   method_name:(METHODS[rec.method]||METHODS.qris).name,status:'pending',createdAt:new Date(rec.at).toISOString()},'deposit','artapedia.id',PACK_ID)}catch(e){}
  if(c.rs)RS.chDep(c.rs.uid,rec,'pending',null,pg).catch(()=>{})
  notifAdm(u,{src:'bot',i:'💰',t:'Deposit menunggu bayar',st:'pending',id:['ID Deposit',rec.id],photo:pg,photoName:'struk-'+rec.id+'.png',rows:[['Pengguna',mask(u.email)],['Metode',x.name],['Rute',ROUTES[d.gw]],['Nominal',rp(amt)],['Biaya layanan',d.fee>0?rp(d.fee):''],['Total bayar',rp(d.total)],['Batas bayar',rec.expMs?wibAt(rec.expMs):''],['Saldo sekarang',rp(u.balance)]],note:'Pengguna belum membayar'})})().catch(()=>{}))
 if(c.mid)tg(c.bot.token,'deleteMessage',{chat_id:c.chat,message_id:c.mid})
 try{return await depSend(c,rec)}
 catch(e){
  // benteng terakhir: tagihannya sudah tersimpan, jadi pengguna tidak boleh ditinggal
  // di layar konfirmasi tanpa kabar apa pun.
  try{return await send(c,depCaption(c,rec,null,true),depKb(rec))}
  catch(_){return send(c,`${H('💳','TAGIHAN DIBUAT')}\n\n${Q(`💵 Total bayar  <b>${rp(rec.total)}</b>`,`🆔 ${esc(rec.id)}`)}\n<i>Buka «Tagihan Saya» untuk melihat QR-nya.</i>`,kb([[B('📜 Tagihan Saya','dl','success')],BACK]))}}}
async function depCheckBtn(c,u0,s){
 const u=await kv.get('u:'+u0.id),o=findDep(u,s);if(!o)return show(c,'Tagihan tidak ditemukan.',kb([BACK]))
 if(['pending','expired','failed'].includes(o.status)){quiet.add(o.id)
  try{const r=await recheckDep(u,o);if(r.changed)await save(u)}
  catch(e){quiet.delete(o.id);return show(c,depCaption(c,o,'⚠️ Gagal cek: '+esc(String(e.message).slice(0,100))),depKb(o),true)}
  quiet.delete(o.id)}
 if(o.status==='expired')return show(c,depCaption(c,o,'⌛ <i>Pembayaran belum terlihat dan tagihan sudah lewat batas. Kalau sudah transfer, hubungi CS dengan bukti transfernya.</i>'),depKb(o),true)
 // Tagihan yang masih berjalan DIKIRIM ULANG lengkap dengan gambar QR-nya: membuka
 // "Tagihan Saya" lalu hanya melihat teks tanpa QR membuat pembeli bingung mau bayar ke mana.
 if(o.status==='pending'){
  const note=`⏳ <i>Pembayaran belum terlihat · dicek ${jam()} WIB. Biasanya butuh 1-3 menit setelah transfer.</i>`
  if(o.qr||o.qrImg){
   if(c.mid)await tg(c.bot.token,'deleteMessage',{chat_id:c.chat,message_id:c.mid}).catch(()=>{})
   c.mid=0
   try{return await depSend(c,o,note)}catch(e){}}
  return show(c,depCaption(c,o,note),depKb(o),true)}
 return show(c,depCaption(c,o,o.status==='completed'?'🎉 <b>Pembayaran diterima!</b>'+(o.bonus?` Bonus ${rp(o.bonus)}.`:''):''),depKb(o),true)}
async function depCancelAsk(c,u,s){
 const o=findDep(u,s);if(!o||o.status!=='pending')return show(c,'Tagihan sudah tidak aktif.',kb([BACK]))
 return show(c,`${H('❌','BATALKAN TAGIHAN?')}\n\n${Q(`💵 ${rp(o.amount)} · ${esc((METHODS[o.method]||METHODS.qris).name)}`)}\n<i>Kalau sudah terlanjur dibayar, saldo tetap masuk.</i>`,kb([[B('✅ Ya, Batalkan','dxy:'+s,'danger'),B('↩️ Tidak','dk:'+s,'success')]]),true)}
async function depCancelDo(c,u0,s){
 const u=await kv.get('u:'+u0.id),o=findDep(u,s);if(!o||o.status!=='pending')return show(c,'Tagihan sudah tidak aktif.',kb([BACK]))
 try{if(await depCheck(o)==='completed'){quiet.add(o.id);await applyDep(u,o,'completed');quiet.delete(o.id);await save(u);return show(c,depCaption(c,o,'ℹ️ Ternyata sudah dibayar, saldo masuk.'),depKb(o),true)}}catch(e){quiet.delete(o.id)}
 await depCancel(o);o.status='canceled';await save(u)
 notifAdm(u,{src:'bot',i:'🚫',t:'Deposit dibatalkan',st:'warn',id:['ID Deposit',o.id],rows:[['Pengguna',mask(u.email)],['Nominal',rp(o.amount)],['Metode',(METHODS[o.method]||METHODS.qris).name+' · '+(ROUTES[o.gw]||'-')],['Dibuat',wibAt(o.at)]]})
 return show(c,depCaption(c,o,'🚫 <b>Tagihan dibatalkan.</b>'),depKb(o),true)}
async function depList(c,u){
 const rp=RP(c)
 const items=(u.tx||[]).filter(x=>x.type==='deposit').slice(0,6)
 const rows=items.map(o=>[B(`${stOf(o.status)} ${rp(o.amount)} · ${(METHODS[o.method]||METHODS.qris).name}`,'dk:'+sid(o.id),o.status==='pending'?'primary':o.status==='completed'?'success':'danger')])
 return show(c,`${H('📜','TAGIHAN DEPOSIT')}\n\n`+(items.length?'Ketuk untuk detail / cek status 👇':'<i>Belum ada deposit.</i>'),kb([...rows,[B('💰 Isi Saldo','dep','success'),...BACK]]))}

// ---------- ADMIN ----------
const findUser=async q=>{q=String(q||'').trim().replace(/^@/,'')
 let id=null
 if(/^[a-f0-9]{32}$/i.test(q))id=q.toLowerCase();else if(q.includes('@'))id=await kv.get('e:'+q.toLowerCase());else if(/^\d{5,}$/.test(q))id=await kv.get('tg:'+q)
 return id&&await kv.get('u:'+id)}
const ADM=c=>c.from.username?'@'+c.from.username:'ID '+c.from.id
const AB=[B('⬅️ Panel','a')]
// Panel toko untuk pemilik bot reseller (BUKAN panel admin platform).
// Ganti banner (foto/video/GIF di atas menu). Dipakai admin platform DAN pemilik bot reseller.
async function bannerAsk(c){
 await setSt(c.from.id,{k:'banner'})
 const bn=await kv.get('tgbn:'+c.bot.id)
 return show(c,rich({ic:'🖼',title:'Banner Menu Bot',
  hello:bn&&!bn.auto?'Status: <b>banner kustom aktif</b>':'Status: <b>memakai banner bawaan</b>',
  intro:'Kirim <b>foto</b>, <b>video</b>, atau <b>GIF</b> sekarang — itu yang tampil di atas menu saat pelanggan menekan /start.',
  blocks:[['📐','Ketentuan',[['Ukuran Ideal','1280 x 720'],['Format','JPG · PNG · MP4 · GIF'],['Maks. Ukuran','10 MB'],['Hapus Banner','ketik tanda -']]]],
  tipTitle:'💡 Tips banner',tip:'Pakai gambar terang dengan nama tokomu di tengah. Hindari tulisan kecil — di HP banner tampil kecil.'}),
  kb([[B('❌ Batal','a','danger')]]))}
// Daftar bukti transfer yang menunggu keputusan pemilik toko (mode mandiri).
async function mdepPanel(c,id,note){
 const rp=RP(c)
 const list=await RS.depPending(c.rs.uid)
 if(id){const d=await RS.depGet(c.rs.uid,id)
  if(!d)return mdepPanel(c,'','⚠️ Data tidak ditemukan.')
  const cap=rich({ic:'🧾',note,title:'Bukti Transfer',
   hello:`Dari <b>${esc(d.nama||d.tgId)}</b>`,
   blocks:[['💵','Rincian',[['Nominal',rp(d.amount)],['Telegram',String(d.tgId)],['Waktu',wibAt(d.at).replace(' WIB','')],['Status',d.status]]]],
   foot:'<i>Cek mutasi QRIS-mu dulu, baru tekan Terima.</i>'})
  const k=kb([[B('✅ Terima','mok:'+d.id,'success'),B('❌ Tolak','mno:'+d.id,'danger')],[B('⬅️ Daftar','mv'),B('🏪 Panel Toko','a')]])
  if(d.proof){const r=await tg(c.bot.token,'sendPhoto',{chat_id:c.chat,photo:d.proof,caption:cap,parse_mode:'HTML',reply_markup:k})
   if(r.ok){if(c.mid)tg(c.bot.token,'deleteMessage',{chat_id:c.chat,message_id:c.mid});return r}}
  return show(c,cap,k)}
 const text=rich({ic:'📥',note,title:'Deposit Masuk',
  hello:list.length?`<b>${list.length}</b> bukti menunggu keputusanmu.`:'Belum ada bukti transfer yang menunggu.',
  blocks:[['🧾','Menunggu',list.slice(0,8).map(d=>[String(d.nama||d.tgId).slice(0,16),rp(d.amount)])]],
  tipTitle:'💡 Cara kerjanya',tip:'Pelanggan bayar ke QRIS-mu lalu kirim bukti. Cek mutasi, tekan <b>Terima</b>, saldo pelanggan langsung bertambah dan nokos dipotong dari saldo stokmu.'})
 return show(c,text,kb([...list.slice(0,8).map(d=>[B(`${d.proof?'🖼':'⏳'} ${String(d.nama||d.tgId).slice(0,14)} · ${rp(d.amount)}`,'mv:'+d.id)]),[B('🔄 Segarkan','mv'),B('🏪 Panel Toko','a')]]))}
async function rsPanel(c,note){
 const a=await RS.getRs(c.bot.rs),cust=((await kv.get('rsc:'+c.bot.rs))||[]).length
 const bn=await kv.get('tgbn:'+c.bot.id)
 const md=RS.isMandiri(a),L=LANGS[a.lang||'id']||LANGS.id
 const wait=(a.dep||[]).filter(x=>x.status==='menunggu').length
 const text=rich({ic:'🏪',note,title:'Panel Toko',
  hello:`Toko <b>${esc(rsBrand(c))}</b> · ${jam()} WIB`,
  intro:md?'Semua pengaturan tokomu ada di sini: deposit, saldo stok, dan pelangganmu.':'Semua pengaturan tokomu ada di sini. Untung berjalan bisa ditarik otomatis lewat web.',
  blocks:[md
   ?['📦','Saldo Stok',[['Saldo Stok',rp(a.stok||0)],['Deposit Menunggu',String(wait)],['QRIS',(a.qris&&a.qris.img)?'🟢 Terpasang':'⚪ Belum diisi'],['Markup',mkTxt(a)]]]
   :['💼','Ringkasan Dompet',[['Bisa Ditarik',rp(a.balance)],['Total Untung',rp(a.earn)],['Markup',mkTxt(a)]]],
   ['📈','Ringkasan Toko',[['Mode',md?'Stok Mandiri':'Tanpa Modal'],['Bahasa',L.flag+' '+L.name],['Nokos Terjual',(a.sold||0)+'x'],['Pelanggan',String(cust)],['Banner',bn&&!bn.auto?'🟢 Kustom':'⚪ Bawaan'],['Channel Notif',(a.ch&&a.ch.id)?'🟢 Aktif':'⚪ Belum diisi']]]],
  tipTitle:'💡 Panduan singkat',
  tip:md
   ?'• Pelanggan bayar ke <b>QRIS-mu</b>, kamu yang meng-ACC buktinya.\n• Tiap pesanan memotong <b>Saldo Stok</b>; isi lewat <b>Isi Saldo Stok</b> (QRIS SMP, masuk otomatis).\n• <b>Add/Del Saldo</b> mengubah saldo pelanggan, <b>Ban/Unban</b> memblokir atau memulihkan akunnya.\n• <b>Banner Bot</b> mengganti foto di atas menu pelanggan.'
   :'• <b>Set Markup</b> mengubah untungmu per penjualan.\n• <b>Banner Bot</b> mengganti foto di atas menu pelanggan.\n• <b>Broadcast</b> mengirim promo ke semua pelanggan botmu.\n• Tarik untung di web: Dashboard › Bot Reseller › Tarik Dana.'})
 return show(c,text,kb([
  md?[B(`📥 Deposit Masuk${wait?' ('+wait+')':''}`,'mv','success'),B('📦 Isi Saldo Stok','a:stk','success')]:[B('👛 Lihat Saldo','a:sal','success')],
  ...(md?[[B('➕ Add Saldo','a:add','success'),B('➖ Del Saldo','a:del','danger')],
   [B('⛔ Ban','a:ban','danger'),B('♻️ Unban','a:unban','success')],
   [B('👤 Cek Pelanggan','a:us')]]:[]),
  [B('💹 Set Markup','a:mk'),B('🖼 Banner Bot','a:bn','success')],
  [B('📢 Broadcast','a:bc0'),B('📌 Broadcast + Pin','a:bc1','success')],
  [B('🏠 Menu Pelanggan','m','danger')]]))}
async function rsSaldo(c){
 const a=await RS.getRs(c.bot.rs),cust=((await kv.get('rsc:'+c.bot.rs))||[]).length
 // Toko stok mandiri tidak punya dompet komisi & tidak punya menu tarik saldo.
 if(RS.isMandiri(a))return rsPanel(c,'ℹ️ Mode <b>Stok Mandiri</b> tidak punya dompet komisi: untungmu langsung masuk ke QRIS-mu sendiri.')
 const wd=(a.wd||[]).slice(0,4)
 const text=rich({ic:'👛',title:'Saldo Toko',hello:`Toko <b>${esc(rsBrand(c))}</b>`,
  intro:'Untung dari tiap penjualan langsung masuk ke sini dan bisa dicairkan ke e-wallet.',
  blocks:[['💼','Dompet',[['Bisa Ditarik',rp(a.balance)],['Total Untung',rp(a.earn)],['Minimal Tarik',rp(10000)]]],
   ['📦','Penjualan',[['Nokos Terjual',(a.sold||0)+'x'],['Pelanggan',String(cust)],['Markup',mkTxt(a)]]],
   ...(wd.length?[['🏧','Penarikan Terakhir',wd.map(w=>[(w.status==='success'?'🟢 ':w.status==='failed'?'🔴 ':'🟡 ')+String(w.wallet).toUpperCase(),rp(w.nominal)])]]:[])],
  tipTitle:'💡 Cara menarik untung',tip:'Penarikan dijalankan dari web: Dashboard › Bot Reseller › Tarik Dana. Dana masuk otomatis ke DANA/OVO/GoPay/ShopeePay tanpa menunggu admin.'})
 return show(c,text,kb([[B('💹 Set Markup','a:mk'),B('🖼 Banner Bot','a:bn','success')],[B('⬅️ Panel Toko','a')]]))}
const rpMk=n=>'Rp'+Math.round(+n||0).toLocaleString('id-ID')
// Mode tanpa modal: markup Rp per server. Mode stok mandiri: tetap persen (menu lama di bawah).
async function rsMarkAsk(c,note){
 const a=await RS.getRs(c.bot.rs)
 if(a.mode!=='mandiri'){
  const sv=svList(c)
  const lines=sv.map(x=>`🖥 ${esc(x.name)}  →  <b>+${rpMk(RS.flatOf(a,x.server))}</b>`)
  return show(c,`${note?note+'\n\n':''}${H('💹','MARKUP TOKO (Rp)')}\n\n${Q('Harga pelanggan = <b>harga web utama + markup Rp kamu</b>','Contoh: web Rp5.000 + markup Rp1.000 = <b>Rp6.000</b>')}\n${lines.length?Q(...lines):'<i>Belum ada server aktif.</i>'}\n\n<i>💰 Untung cair HANYA saat OTP diterima. Order gagal / dibatalkan tidak mendapat komisi.</i>\n<i>Ketuk server untuk mengatur markup-nya.</i>`,
   kb([...sv.map(x=>{const i=SERVERS.findIndex(y=>y.server===x.server);return [B(`✏️ ${String(x.name).slice(0,22)} · +${rpMk(RS.flatOf(a,x.server))}`,'a:mks:'+i,'primary')]}),[B('⚙️ Atur Semua Server Sekaligus','a:mks:x','success')],[B('⬅️ Panel Toko','a')]]))}
 return show(c,`${note?note+'\n\n':''}${H('💹','MARKUP TOKO')}\n\n${Q(`📈 Markup sekarang  <b>${a.markup}%</b>`)}\n<i>Markup ditambahkan di atas harga platform. Makin besar, makin besar untungmu — tapi harga ke pelanggan juga naik.</i>`,
  kb([[3,5,8,10].map(p=>B(p+'%','a:mk:'+p,a.markup===p?'success':'primary')),[15,20,25,30].map(p=>B(p+'%','a:mk:'+p,a.markup===p?'success':'primary')),[B('✏️ Ketik Persen','a:mkc')],[B('⬅️ Panel Toko','a')]]))}
async function rsMarkSv(c,i,note){
 const a=await RS.getRs(c.bot.rs),all=i==='x',sv=all?null:SERVERS[+i]
 if(!all&&!sv)return rsMarkAsk(c)
 const cur=all?RS.flatOf(a,'*'):RS.flatOf(a,sv.server),q=[500,1000,1500,2000,3000,5000,7500,10000]
 return show(c,`${note?note+'\n\n':''}${H('💹',all?'MARKUP SEMUA SERVER':'MARKUP '+String(sv.name).toUpperCase())}\n\n${Q(`📈 Sekarang  <b>+${rpMk(cur)}</b> / nomor`,'Contoh: web Rp5.000 + '+rpMk(cur)+' = <b>'+rpMk(5000+cur)+'</b>')}\n<i>${all?'Menimpa markup semua server.':'Hanya untuk server ini.'} Pilih angka atau ketik sendiri (0–${RS.MK_RP_MAX.toLocaleString('id-ID')}).</i>`,
  kb([[q[0],q[1],q[2],q[3]].map(v=>B(rpMk(v),'a:mkv:'+i+'_'+v,cur===v?'success':'primary')),[q[4],q[5],q[6],q[7]].map(v=>B(rpMk(v),'a:mkv:'+i+'_'+v,cur===v?'success':'primary')),[B('✏️ Ketik Rupiah','a:mkr:'+i)],[B('⬅️ Daftar Server','a:mk')]]))}
// ---------- TOKO STOK MANDIRI: kelola pelanggan + isi saldo stok ----------
// Semua fungsi di blok ini HANYA untuk pemilik toko bermode mandiri (c.own && isMd(c)).
// Ban/unban dan saldo di sini hanya menyentuh pelanggan TOKO ini: tidak ada blokir IP
// maupun rambatan ke akun lain, supaya toko lain dan akun web tidak ikut terdampak.
const isMd=c=>!!(c.rs&&RS.isMandiri(c.rs))
const STK_MIN=RS.STK_MIN,STK_MAX=RS.STK_MAX   // sama dengan batas RS.stokSmpNew
const MD_OP={add:'➕ ADD SALDO',del:'➖ DEL SALDO',ban:'⛔ BAN PELANGGAN',unban:'♻️ UNBAN PELANGGAN',view:'👤 CEK PELANGGAN'}
// cari pelanggan toko ini lewat @username, ID Telegram, atau ID user. Pelanggan toko lain tidak pernah ketemu.
async function rsFindCust(c,q){
 q=String(q||'').trim().replace(/^@/,'');if(!q)return null
 const rs=c.bot.rs;let u=null
 if(/^[a-f0-9]{32}$/i.test(q))u=await kv.get('u:'+q.toLowerCase())
 else if(/^\d{5,}$/.test(q)){const id=await kv.get(`tgr:${rs}:${q}`);u=id&&await kv.get('u:'+id)}
 else if(/^[A-Za-z0-9_]{4,32}$/.test(q)){
  const ids=((await kv.get('rsc:'+rs))||[]).map(String).slice(0,600),want=q.toLowerCase()
  for(let i=0;i<ids.length&&!u;i+=25){
   const rows=await Promise.all(ids.slice(i,i+25).map(async t=>{const id=await kv.get(`tgr:${rs}:${t}`);return id&&await kv.get('u:'+id)}))
   u=rows.find(x=>x&&String(x.tgUser||'').toLowerCase()===want)||null}}
 return u&&u.rs===rs?u:null}
async function rsAskUser(c,op){
 await setSt(c.from.id,{k:'rsfind',op})
 return show(c,`<b>${MD_OP[op]}</b>\n\nKirim <b>@username</b>, <b>ID Telegram</b>, atau <b>ID user</b> pelangganmu:`,kb([[B('❌ Batal','a','danger')]]))}
async function rsCustCard(c,u,note){
 const ok=okOrders(u),spent=ok.reduce((a,x)=>a+x.price,0),dep=(u.tx||[]).filter(x=>x.type==='deposit'&&x.status==='completed').reduce((a,x)=>a+x.amount,0)
 const text=rich({ic:'👤',note,title:'Detail Pelanggan',
  hello:`Status: ${u.banned?'⛔ <b>BANNED</b>':'🟢 <b>Aktif</b>'}`,
  blocks:[['🪪','Identitas',[['Nama',u.name],['Telegram',u.tgUser?'@'+u.tgUser:String(u.tgId||'-')],['Gabung',wibAt(Date.parse(u.joinedAt)).replace(' WIB','')]]],
   ['💼','Ringkasan Transaksi',[['Saldo',rp(u.balance)],['Order Sukses',ok.length+'x'],['Total Belanja',rp(spent)],['Total Deposit',rp(dep)]]]],
  foot:`🆔 <code>${esc(u.id)}</code>`})
 return show(c,text,kb([[B('➕ Saldo','ua:add:'+u.id,'success'),B('➖ Saldo','ua:del:'+u.id,'danger')],
  [u.banned?B('♻️ Unban','ua:unban:'+u.id,'success'):B('⛔ Ban','ua:ban:'+u.id,'danger'),B('🔄 Refresh','ua:ref:'+u.id)],
  [B('🏪 Panel Toko','a')]]))}
async function rsAskAmount(c,op,u){
 await setSt(c.from.id,{k:'rsamount',op,uid:u.id})
 return show(c,`${H(op==='add'?'➕':'➖',MD_OP[op].slice(2))}\n\n${Q(`👤 ${esc(u.name||u.tgUser||u.tgId)}`,`👛 Saldo  <b>${rp(u.balance)}</b>`)}\nKetik <b>nominal Rupiah</b> (mis. <code>10000</code> atau <code>10k</code>):`,kb([[B('❌ Batal','a','danger')]]))}
// Kembalian: {f:<akun terbaru>, err:<pesan gagal atau ''>}
async function rsAct(c,op,u,amount){
 const f=await kv.get('u:'+u.id)
 if(!f||f.rs!==c.bot.rs)return {f:null,err:'Pelanggan tidak ditemukan di tokomu.'}
 const who=f.tgUser?'@'+f.tgUser:'ID '+f.tgId,rows0=[['Toko',rsBrand(c)],['Pelanggan',who]]
 if(op==='add'||op==='del'){
  const n=Math.floor(Math.abs(+amount||0))
  if(!(n>0&&n<=1e9))return {f,err:'Nominal tidak valid.'}
  if(op==='del'&&(+f.balance||0)<n)return {f,err:'Saldo pelanggan hanya '+rp(f.balance)+', tidak bisa dikurangi '+rp(n)+'.'}
  // penjaga tekan dua kali: permintaan yang sama ditolak selama 5 detik
  if(!await kv.lock('once:rssaldo:'+f.id+':'+op+n,5000))return {f,err:'Permintaan yang sama baru saja diproses.'}
  mut(f,op==='add'?n:-n,op==='add'?'Pemilik toko tambah saldo':'Pemilik toko kurangi saldo');await save(f)
  notify({src:'bot',i:'🛠',t:op==='add'?'Pemilik toko tambah saldo pelanggan':'Pemilik toko kurangi saldo pelanggan',st:'admin',
   rows:[...rows0,['Nominal',(op==='add'?'+':'-')+rp(n)],['Saldo sekarang',rp(f.balance)]]}).catch(()=>{})
  pushUser(f,`${H(op==='add'?'💰':'💸',Tx(c,op==='add'?'dep.ok':'sal.del'))}\n\n${Q(`${op==='add'?'➕':'➖'} <b>${RP(c)(n)}</b>`,`👛 ${Tx(c,'f.saldo')}  <b>${RP(c)(f.balance)}</b>`)}`).catch(()=>{})
  return {f,err:'',n}}
 if(op==='ban'){
  if(f.banned)return {f,err:'Pelanggan ini sudah dibanned.'}
  f.banned=true;f.banAt=Date.now();f.banBy='rs:'+c.bot.rs;f.banReason='Dibanned pemilik toko';f.banIp=false;await save(f)
  notify({src:'bot',i:'⛔',t:'Pemilik toko ban pelanggan',st:'admin',rows:rows0}).catch(()=>{})
  return {f,err:''}}
 if(op==='unban'){
  if(!f.banned)return {f,err:'Pelanggan ini tidak sedang dibanned.'}
  // blokir dari admin platform (atau toko lain) tidak boleh dibuka dari sini
  if(f.banBy!=='rs:'+c.bot.rs)return {f,err:'Akun ini diblokir oleh admin platform, jadi tidak bisa dibuka dari tokomu.'}
  f.banned=false;f.banBy='';f.banReason='';f.banIp=false;await save(f)
  notify({src:'bot',i:'♻️',t:'Pemilik toko unban pelanggan',st:'admin',rows:rows0}).catch(()=>{})
  pushUser(f,`${H('♻️',Tx(c,'acc.back'))}`).catch(()=>{})
  return {f,err:''}}
 return {f,err:''}}
// ----- isi saldo stok lewat SMP Payment: QRIS dinamis, saldo masuk OTOMATIS (tanpa bukti, tanpa ACC admin) -----
const STK_ST={menunggu:'🟡 menunggu bayar',diterima:'🟢 masuk',batal:'⚫ dibatalkan',kedaluwarsa:'🔴 kedaluwarsa',ditolak:'🔴 ditolak'}
async function rsStokView(c,note){
 const a=await RS.getRs(c.bot.rs),sr=(a.sreq||[]).slice(0,5)
 const text=rich({ic:'📦',note,title:'Isi Saldo Stok',
  hello:'Pilih nominal, bayar lewat QRIS, saldo stok masuk <b>otomatis</b>.',
  blocks:[['📦','Saldo Stok',[['Saldo Stok',rp(a.stok||0)],['Minimal',rp(STK_MIN)],['Maksimal',rp(STK_MAX)]]],
   ...(sr.length?[['🧾','Tagihan Terakhir',sr.map(x=>[rp(x.amount),STK_ST[x.status]||x.status])]]:[])],
  tipTitle:'💡 Cara kerjanya',tip:'Bayar <b>tepat sesuai total</b> di tagihan (sudah termasuk kode unik). Tidak perlu kirim bukti dan tidak perlu menunggu admin: saldo stok bertambah sendiri begitu pembayaran terbaca.'})
 const amts=[10000,20000,50000,100000,200000,500000],rows=[];for(let i=0;i<amts.length;i+=3)rows.push(amts.slice(i,i+3).map(v=>B(rp(v),'a:stk:'+v,'success')))
 return show(c,text,kb([...rows,[B('✏️ Nominal Sendiri','a:stkc','primary')],[B('🏪 Panel Toko','a')]]))}
const stkKb=r=>kb(r.status==='menunggu'
 ?[[B('✅ Saya Sudah Bayar','a:stkk:'+r.id,'success')],[B('❌ Batalkan','a:stkx:'+r.id,'danger')],[C('📋 Salin Total',r.total)],[B('🏪 Panel Toko','a')]]
 :[[B('📦 Isi Saldo Stok','a:stk','success'),B('🏪 Panel Toko','a')]])
function rsStokCap(r,note,noImg){
 const pend=r.status==='menunggu'
 return rich({ic:'💳',note,title:'Bayar Saldo Stok',
  hello:`Status: <b>${STK_ST[r.status]||r.status}</b>`,
  blocks:[['🧾','Rincian Pembayaran',[['Nominal',rp(r.amount)],r.fee>0?['Kode unik',rp(r.fee)]:null,['Total Bayar',rp(r.total)],
   r.expMs&&pend?['Batas Bayar',wibAt(r.expMs).replace(' WIB','').replace(',','')+' · '+sisa(r.expMs).replace(' menit',' mnt')]:null]]],
  foot:`🆔 <code>${esc(r.id)}</code>`
   +(pend&&noImg&&r.qr?`\n\n<b>Kode QRIS</b> (ketuk untuk menyalin):\n<code>${esc(r.qr)}</code>\n<i>Gambar QR sedang tidak bisa ditampilkan. Salin kode di atas lalu tempel di menu bayar pakai kode QRIS di e-wallet.</i>`:'')
   +(pend&&!noImg?'\n<i>Scan QR dengan e-wallet / m-banking apa saja. Bayar PERSIS sesuai total. Saldo stok masuk otomatis.</i>':'')})}
// kirim tagihan + gambar QR (unduh sendiri lalu unggah; cadangan: URL; terakhir teks berisi kode QRIS)
async function rsStokSend(c,r,note){
 const cap=rsStokCap(r,note),k=stkKb(r)
 try{const buf=await qrBuf(r)
  if(buf){const {tgSend}=await import('./telegram'),x=await tgSend(c.bot.token,c.chat,cap,k,buf,'qris-'+r.id+'.png');if(x&&x.ok)return x}
  for(const url of [/^https?:\/\//.test(String(r.qrImg||''))?r.qrImg:'',r.qr?qrUrl(r.qr):''].filter(Boolean)){
   const x=await tg(c.bot.token,'sendPhoto',{chat_id:c.chat,photo:url,caption:cap,parse_mode:'HTML',reply_markup:k});if(x&&x.ok)return x}}catch(e){}
 return send(c,rsStokCap(r,note,true),k)}
async function rsStokShow(c,n){
 if(!(n>=STK_MIN&&n<=STK_MAX))return rsStokView(c,`⚠️ Nominal harus Rp${STK_MIN.toLocaleString('id-ID')} - Rp${STK_MAX.toLocaleString('id-ID')}.`)
 if(await kv.incr(`rl:stk:${c.from.id}:${Math.floor(Date.now()/4000)}`)>1)return
 typing(c)
 let r;try{r=await RS.stokSmpNew(c.bot.rs,n)}catch(e){return rsStokView(c,'⚠️ '+esc(e.message))}
 await setSt(c.from.id,{})
 if(c.mid)tg(c.bot.token,'deleteMessage',{chat_id:c.chat,message_id:c.mid})
 return rsStokSend(c,r)}
async function rsStokCheck(c,id){
 let r;try{r=await RS.stokSmpCheck(c.bot.rs,id)}catch(e){return rsStokView(c,'⚠️ '+esc(e.message))}
 if(r.status==='diterima'){const a=await RS.getRs(c.bot.rs)
  return show(c,`${H('✅','SALDO STOK MASUK')}\n\n${Q(`💵 Nominal  <b>${rp(r.amount)}</b>`,`📦 Saldo stok sekarang  <b>${rp(a.stok||0)}</b>`)}`,kb([[B('📦 Isi Lagi','a:stk','success'),B('🏪 Panel Toko','a')]]))}
 if(r.status==='menunggu'){
  if(c.mid)await tg(c.bot.token,'deleteMessage',{chat_id:c.chat,message_id:c.mid}).catch(()=>{});c.mid=0
  return rsStokSend(c,r,`⏳ <i>Pembayaran belum terlihat · dicek ${jam()} WIB. Biasanya butuh 1-3 menit setelah transfer.</i>`)}
 return show(c,rsStokCap(r,r.status==='kedaluwarsa'?'⌛ <i>Tagihan sudah lewat batas. Kalau sudah terlanjur transfer, hubungi admin dengan bukti transfernya.</i>':null),stkKb(r))}
async function rsStokCancel(c,id){
 let r;try{r=await RS.stokSmpCancel(c.bot.rs,id)}catch(e){return rsStokView(c,'⚠️ '+esc(e.message))}
 if(r.status==='diterima')return rsStokCheck(c,id)
 return show(c,rsStokCap(r,'🚫 <b>Tagihan dibatalkan.</b>'),stkKb(r))}
// ambil foto bukti dari Telegram -> data URL (batas data URL stokReqNew ±300KB)
async function tgPhotoDataUrl(c,photos,limit=285000){
 const sorted=[...photos].sort((x,y)=>(x.file_size||0)-(y.file_size||0))
 const pick=[...sorted].reverse().find(p=>(p.file_size||0)>0&&p.file_size<=limit)||sorted[0]
 const r=await tg(c.bot.token,'getFile',{file_id:pick.file_id})
 if(!r.ok||!r.result||!r.result.file_path)throw Error('Foto tidak bisa diambil dari Telegram, coba kirim ulang.')
 const res=await fetch(`${process.env.TG_API||'https://api.telegram.org'}/file/bot${c.bot.token}/${r.result.file_path}`,{signal:AbortSignal.timeout(20000)})
 if(!res.ok)throw Error('Foto tidak bisa diunduh dari Telegram, coba kirim ulang.')
 return 'data:image/jpeg;base64,'+Buffer.from(await res.arrayBuffer()).toString('base64')}
async function adminMenu(c,note){
 if(c.rs)return rsPanel(c,note)
 const [bots,tgN]=await Promise.all([getBots(),kv.get('tgidx')]),m=c.cfg.maint||{}
 const bn=await kv.get('tgbn:'+c.bot.id),re=await kv.get('tmp:richerr')
 // jejak error terakhir supaya admin tidak perlu membuka log server
 const be=await kv.get('tmp:boterr'),qe=await kv.get('tmp:qrerr')
 const text=rich({ic:'🛠',note,title:'Panel Admin',hello:`Halo, <b>Admin</b> · ${jam()} WIB`,
  intro:'Kendali penuh toko: pengguna, saldo, pembayaran, server, dan tampilan bot.',
  blocks:[['🤖','Ringkasan Bot',[['Bot Aktif',String(bots.filter(b=>b.on!==false).length)],['User Bot',String((tgN||[]).length)],['Banner',bn&&!bn.auto?'🟢 Kustom':'⚪ Bawaan'],['Pesan Kaya',richOk()?'🟢 Aktif':'⚪ '+String((re||{}).d||'tidak didukung').slice(0,24)],['Runtime',runtime(c.bot.at)],
    be?['Error Terakhir',String(be.err||'').slice(0,40)+' · '+wibAt(be.at)]:null,
    qe?['QR Gagal Kirim',String(qe.err||'').slice(0,34)+' · '+wibAt(qe.at)]:null]],
   ['⚙️','Ringkasan Sistem',[['Maintenance',m.on?'🔴 ON':'🟢 OFF'],['Metode Aktif',String(Object.values(c.cfg.dep.methods).filter(x=>x.on).length)],['Markup Umum',(c.cfg.markup||0)+'%'],['Mesin Deposit',engineOf(c.cfg).toUpperCase()]]]],
  tipTitle:'💡 Catatan',tip:'Tekan tombol di bawah untuk mengelola. Semua perubahan langsung berlaku di web dan bot.'})
 return show(c,text,kb([
  [B('📊 Statistik','a:st'),B('👤 Cek User','a:us')],
  [B('➕ Add Saldo','a:add','success'),B('➖ Del Saldo','a:del','danger')],
  [B('⛔ Ban','a:ban','danger'),B('♻️ Unban','a:unban','success')],
  [B('📢 Broadcast','a:bc0'),B('📌 Broadcast + Pin','a:bc1','success')],
  [B('📡 Broadcast Semua Bot','a:bca','success')],
  [B('💳 Pembayaran','a:pay'),B(m.on?'🛠 Maintenance ON':'🛠 Maintenance OFF','a:mt',m.on?'danger':'success')],
  [B('🖥 Server','a:sv'),B('💰 Markup','a:mk')],
  [B('🖼 Banner Menu Bot','a:bn','success'),B('📣 Banner Web','a:bw')],
  [B('💾 Backup','a:bk','success'),B('🔔 Tes Notif','a:tn')],
  [B('🏠 Menu User','m','danger')]]))}
async function adminStats(c){
 const us=await allUsers(),t0=wibDayStart();let bal=0,ban=0,ordT=0,ordAll=0,depT=0,pend=0,tgN=0,sales=0
 for(const u of us){bal+=+u.balance||0;if(u.banned)ban++;if(u.tgId)tgN++
  for(const x of u.tx||[]){if(x.type==='order'){if(x.status==='success'){ordAll++;sales+=x.price;if(x.at>=t0)ordT++}if(x.status==='pending')pend++}
   if(x.type==='deposit'&&x.status==='completed'&&x.at>=t0)depT+=x.amount}}
 return show(c,rich({ic:'📊',title:'Statistik',hello:`Diperbarui <b>${jam()} WIB</b>`,
  blocks:[['👥','Ringkasan Pengguna',[['Total Pengguna',String(us.length)],['Dari Telegram',String(tgN)],['Dibanned',String(ban)],['Total Saldo',rp(bal)]]],
   ['📦','Ringkasan Transaksi',[['Order Hari Ini',String(ordT)],['Order Total',String(ordAll)],['Order Berjalan',String(pend)],['Deposit Hari Ini',rp(depT)],['Total Penjualan',rp(sales)]]]]}),
  kb([[B('🔄 Refresh','a:st','success'),...AB]]))}
async function userCard(c,u,note){
 const ok=okOrders(u),spent=ok.reduce((a,x)=>a+x.price,0),dep=(u.tx||[]).filter(x=>x.type==='deposit'&&x.status==='completed').reduce((a,x)=>a+x.amount,0)
 const text=rich({ic:'👤',note,title:'Detail User',
  hello:`Status: ${u.banned?'⛔ <b>BANNED</b>':'🟢 <b>Aktif</b>'}`,
  blocks:[['🪪','Identitas',[['Nama',u.name],['Telegram',u.tgUser?'@'+u.tgUser:(u.tgId?String(u.tgId):'-')],['Gabung',wibAt(Date.parse(u.joinedAt)).replace(' WIB','')],['Login Terakhir',u.lastLogin?wibAt(u.lastLogin).replace(' WIB',''):'-']]],
   ['💼','Ringkasan Transaksi',[['Saldo',rp(u.balance)],['Order Sukses',ok.length+'x'],['Total Belanja',rp(spent)],['Total Deposit',rp(dep)]]]],
  foot:`📧 <code>${esc(u.email)}</code>\n🆔 <code>${esc(u.id)}</code>\n🌐 <code>${esc(u.lastIp||'-')}</code>`})
 return show(c,text,kb([[B('➕ Saldo','ua:add:'+u.id,'success'),B('➖ Saldo','ua:del:'+u.id,'danger')],
  [u.banned?B('♻️ Unban','ua:unban:'+u.id,'success'):B('⛔ Ban','ua:ban:'+u.id,'danger'),B('🔑 Link Reset','ua:rst:'+u.id)],
  [u.tgId?B('✉️ Kirim Pesan','ua:msg:'+u.id):B('✉️ Belum terhubung','a:us'),B('🔄 Refresh','ua:ref:'+u.id)],AB]))}
async function adminAct(c,op,u,amount){
 if(op==='add'||op==='del'){
  const n=Math.floor(Math.abs(+amount||0));if(!(n>0))return null
  const f=await kv.get('u:'+u.id)
  if(op==='del'&&(+f.balance||0)<n)return f   // saldo tidak boleh jadi minus
  // penjaga tekan dua kali: permintaan yang sama ditolak selama 5 detik
  if(!await kv.lock('once:botsaldo:'+u.id+':'+op+n,5000))return f
  amount=n;mut(f,op==='add'?amount:-amount,op==='add'?'Admin tambah (bot)':'Admin kurangi (bot)');await save(f)
  notify({src:'bot',i:'🛠',t:op==='add'?'Admin tambah saldo':'Admin kurangi saldo',st:'admin',rows:[['Pengguna',mask(f.email)],['Nominal',(op==='add'?'+':'-')+rp(amount)],['Saldo sekarang',rp(f.balance)],['Admin',ADM(c)]]})
  pushUser(f,`${H(op==='add'?'💰':'💸',op==='add'?'SALDO BERTAMBAH':'SALDO DIKURANGI')}\n\n${Q(`${op==='add'?'➕':'➖'} <b>${rp(amount)}</b>`,`👛 Saldo sekarang  <b>${rp(f.balance)}</b>`)}`)
  return f}
 // Ban dari bot memakai jalur yang sama dengan panel web: IP akun ikut diblokir dan
 // akun lain yang nyambung (IP / Telegram sama) ikut kena; unban memulihkan semuanya.
 if(op==='ban'||op==='unban'){const f=await kv.get('u:'+u.id)
  const r=op==='ban'?await banUser(f,{ip:true}):await unbanUser(f)
  notify({src:'bot',i:op==='ban'?'⛔':'♻️',t:'Admin '+op+' akun',st:'admin',
   rows:[['Pengguna',mask(f.email)],['IP ikut '+(op==='ban'?'diblokir':'dibuka'),(r.ips||[]).join(', ')||'-'],
    ['Akun terkait',(r.akun||[]).length?(r.akun||[]).map(x=>mask(x.email)).join(', '):'-'],['Admin',ADM(c)]]})
  if(op==='unban')pushUser(f,`${H('♻️','AKUN DIPULIHKAN')}\n\nAkunmu sudah aktif kembali.`)
  return f}
 return u}
async function askAmount(c,op,u){
 await setSt(c.from.id,{k:'amount',op,uid:u.id})
 return show(c,`${H(op==='add'?'➕':'➖',op==='add'?'ADD SALDO':'DEL SALDO')}\n\n${Q(`👤 <code>${esc(u.email)}</code>`,`👛 Saldo  <b>${rp(u.balance)}</b>`)}\nKetik <b>nominal</b> (angka saja, mis. <code>10000</code>):`,kb([[B('❌ Batal','a','danger')]]))}
async function askUser(c,op){
 await setSt(c.from.id,{k:'finduser',op})
 const T={add:'➕ ADD SALDO',del:'➖ DEL SALDO',ban:'⛔ BAN USER',unban:'♻️ UNBAN USER',view:'👤 CEK USER'}
 return show(c,`<b>${T[op]}</b>\n\nKirim <b>email</b>, <b>ID Telegram</b>, atau <b>ID user</b>:`,kb([[B('❌ Batal','a','danger')]]))}
async function payView(c,note){
 const cfg=await getCfg(),rd=await readiness(cfg).catch(()=>({}))
 const eng=engineOf(cfg),sw=switches(cfg),list=eng==='v2'?ROUTES_V2:Object.keys(ROUTES)
 const text=`${note?note+'\n\n':''}${H('💳','METODE PEMBAYARAN','Ketuk untuk nyala / mati')}\n\n<b>Mesin rute</b>\n${Q(`${eng==='v2'?'🆕 V2 · Pakasir + AustinPay':'🧩 V1 · WarungNokos + Pakasir + AustinPay + SMP'}`)}\n<b>Gateway</b>\n${Q(list.map(r=>`${sw[r]&&sw[r].on?'🟢':'⚪'} ${ROUTES[r]} ${rd[r]?'· siap':'· <i>kredensial belum diisi</i>'}`))}\n<b>Metode untuk pengguna</b>\n${Q(Object.keys(METHODS).map(k=>`${cfg.dep.methods[k].on?'🟢':'⚪'} ${METHODS[k].name}`))}`
 const rr=list.map(r=>B((sw[r]&&sw[r].on?'🟢 ':'⚪ ')+ROUTES[r],'a:pr:'+r,sw[r]&&sw[r].on?'success':'danger'))
 const eb=[B(eng==='v2'?'🔁 Pakai rute V1':'🔁 Pakai rute V2','a:pe','primary')]
 const mm=Object.keys(METHODS),rows=[];for(let i=0;i<mm.length;i+=2)rows.push(mm.slice(i,i+2).map(k=>B((cfg.dep.methods[k].on?'🟢 ':'⚪ ')+METHODS[k].name,'a:pm:'+k,cfg.dep.methods[k].on?'success':'danger')))
 return show(c,text,kb([eb,rr,...rows,AB]))}
async function mtView(c,note){
 const cfg=await getCfg(),m=cfg.maint||{},nm=s=>((cfg.srv||{})[s.server]||{}).name||s.name
 const text=`${note?note+'\n\n':''}${H('🛠','MAINTENANCE')}\n\n${Q(`🌐 Seluruh situs  <b>${m.on?'🔴 AKTIF':'🟢 Normal'}</b>`,`🎛 Mode  <b>${m.mode==='soft'?'Banner (order &amp; deposit diblokir)':'Layar penuh'}</b>`,`💬 Pesan  <i>${esc(m.msg||'(bawaan)')}</i>`)}\n<b>Per server</b>\n${Q(SERVERS.map(s=>`${((m.srv||{})[s.server]||{}).on?'🔴':'🟢'} ${esc(nm(s))}`))}`
 const srv=SERVERS.map((s,i)=>B((((m.srv||{})[s.server]||{}).on?'🔴 ':'🟢 ')+nm(s),'a:mts:'+i,((m.srv||{})[s.server]||{}).on?'danger':'success')),rows=[];for(let i=0;i<srv.length;i+=2)rows.push(srv.slice(i,i+2))
 return show(c,text,kb([[m.on?B('🟢 Matikan Maintenance','a:mt:0','success'):B('🔴 Hidupkan Maintenance','a:mt:1','danger')],
  [B(m.mode==='soft'?'🖼 Mode: Layar Penuh':'🏷 Mode: Banner','a:mtm'),B('💬 Ubah Pesan','a:mtt')],...rows,AB]))}
async function setMaint(c,fn){
 const cfg=await getCfg(),was=cfg.maint||{},o={on:!!was.on,mode:was.mode==='soft'?'soft':'full',msg:was.msg||'',srv:{...(was.srv||{})}};fn(o)
 cfg.maint=o;await putCfg(cfg)
 const nOn=Object.values(o.srv).filter(x=>x.on).length
 if(!!was.on!==o.on||nOn!==Object.values(was.srv||{}).filter(x=>x.on).length)notify({src:'bot',i:'🛠',t:o.on?'Maintenance AKTIF':'Maintenance dinonaktifkan',st:'admin',rows:[['Seluruh situs',o.on?'Aktif ('+(o.mode==='soft'?'banner':'layar penuh')+')':'Mati'],['Server maintenance',nOn],['Admin',ADM(c)]],note:o.msg||''})}
async function svAdmin(c,note){
 const cfg=await getCfg(),nm=s=>((cfg.srv||{})[s.server]||{}).name||s.name
 const b=SERVERS.map((s,i)=>B((cfg.off.includes(s.server)?'⚪ ':'🟢 ')+nm(s),'a:svt:'+i,cfg.off.includes(s.server)?'danger':'success')),rows=[];for(let i=0;i<b.length;i+=2)rows.push(b.slice(i,i+2))
 return show(c,`${note?note+'\n\n':''}${H('🖥','SERVER NOKOS','Server mati tidak tampil untuk pengguna')}\n\n${Q(SERVERS.map(s=>`${cfg.off.includes(s.server)?'⚪ Mati':'🟢 Aktif'} · ${esc(nm(s))}`))}`,kb([...rows,AB]))}
async function mkView(c,note){
 const cfg=await getCfg()
 return show(c,`${note?note+'\n\n':''}${H('💰','MARKUP HARGA')}\n\n${Q(`📈 Markup umum  <b>${cfg.markup}%</b>`,`🔢 Pembulatan  <b>${cfg.mkRound?'Rp'+cfg.mkRound:'tidak ada'}</b>`)}\n<i>Pilih persen atau ketik angka. Markup per server diatur di web › 💰 Markup.</i>`,kb([[5,10,15,20].map(p=>B(p+'%','a:mk:'+p,cfg.markup===p?'success':'primary')),[25,30,40,50].map(p=>B(p+'%','a:mk:'+p,cfg.markup===p?'success':'primary')),[B('✏️ Ketik Persen','a:mkc')],AB]))}

// ---------- BROADCAST ----------
// ids: daftar chat sasaran. Kosong = semua pengguna bot platform.
// Pekerjaan diantre (bisa lebih dari satu reseller broadcast bersamaan).
export async function startBroadcast({text,photo,pin,by,botId,ids}){
 const list=(ids||((await kv.get('tgidx'))||[])).map(String)
 const job={id:rid().slice(0,10),text,photo:photo||'',pin:!!pin,ids:list,i:0,ok:0,fail:0,by:by||0,bot:botId||'',at:Date.now(),done:false}
 await kv.set('tmp:bc:'+job.id,job);await kv.sadd('bcq',job.id);return job}
export async function bcStep(job,ms=40000){
 const bots=await getBots(),bot=bots.find(b=>b.id===job.bot&&b.on!==false)||bots.find(b=>b.on!==false);if(!bot){job.done=true;job.err='Tidak ada bot aktif';await kv.set('tmp:bc:'+job.id,job);return job}
 const end=Date.now()+ms
 while(job.i<job.ids.length&&Date.now()<end){
  const t0=Date.now(),batch=job.ids.slice(job.i,job.i+25)
  const rs=await Promise.all(batch.map(async id=>{
   const r=job.photo?await tg(bot.token,'sendPhoto',{chat_id:id,photo:job.photo,caption:job.text.slice(0,1000),parse_mode:'HTML'}):await tg(bot.token,'sendMessage',{chat_id:id,text:job.text,parse_mode:'HTML',disable_web_page_preview:true})
   if(r.ok&&job.pin)tg(bot.token,'pinChatMessage',{chat_id:id,message_id:r.result.message_id,disable_notification:true})
   if(!r.ok&&/blocked|deactivated|chat not found|kicked/i.test(r.description||'')){const uid=await kv.get(bot.rs?`tgr:${bot.rs}:${id}`:'tg:'+id),u=uid&&await kv.get('u:'+uid);if(u){u.tgBlocked=true;await save(u)}}
   return r.ok}))
  job.ok+=rs.filter(Boolean).length;job.fail+=rs.filter(x=>!x).length;job.i+=batch.length
  await kv.set('tmp:bc:'+job.id,job);const dt=Date.now()-t0;if(dt<1000)await sleep(1000-dt)}
 if(job.i>=job.ids.length&&!job.done){job.done=true;await kv.set('tmp:bc:'+job.id,job);await kv.srem('bcq',job.id)
  notify({src:'bot',i:'📢',t:job.pin?'Broadcast + Pin selesai':'Broadcast selesai',st:'admin',rows:[['Sasaran',job.ids.length],['Terkirim',job.ok],['Gagal',job.fail]],note:job.text.replace(/<[^>]+>/g,'').slice(0,200)})
  if(job.by)await tg(bot.token,'sendMessage',{chat_id:job.by,text:`${H('📢','BROADCAST SELESAI')}\n\n${Q(`🎯 Sasaran  <b>${job.ids.length}</b>`,`📬 Terkirim  <b>${job.ok}</b>`,`🚫 Gagal  <b>${job.fail}</b>`,job.pin?'📌 Pesan disematkan':'')}`,parse_mode:'HTML'})}
 return job}
export async function tgTick(){
 const q=(await kv.get('bcq'))||[];if(!q.length)return null
 for(const id of q.slice(0,3)){const job=await kv.get('tmp:bc:'+id)
  if(!job||job.done){await kv.srem('bcq',id);continue}
  return bcStep(job,45000)}
 return null}
async function bcAsk(c,pin){
 await setSt(c.from.id,{k:'bc',pin:pin?1:0})
 const n=((await kv.get('tgidx'))||[]).length
 return show(c,`${H(pin?'📌':'📢',pin?'BROADCAST + PIN':'BROADCAST')}\n\n${Q(`🎯 Sasaran  <b>${n}</b> pengguna bot`,pin?'📌 Otomatis disematkan di chat pengguna':'')}\nKirim <b>teks</b> pesan (boleh HTML: <code>&lt;b&gt;tebal&lt;/b&gt;</code>) atau <b>foto + caption</b>.`,kb([[B('❌ Batal','a','danger')]]))}

// ---------- BROADCAST SEMUA BOT (khusus admin platform) ----------
// Kirim satu pesan ke pengguna SEMUA bot: bot utama + bot tambahan, reseller tanpa modal, reseller stok mandiri.
const bcaSt=async c=>{const st=await getSt(c.from.id);return st.k&&String(st.k).startsWith('bca')?{...st,t:normTargets(st.t)}:{k:'bcam',t:normTargets(),pin:0}}
async function bcaMenu(c,x,y){
 let st=await bcaSt(c)
 if(x==='bcat'&&BCA_CATS[y])st.t[y]=!st.t[y]
 if(x==='bcap')st.pin=st.pin?0:1
 st={...st,k:'bcam'};await setSt(c.from.id,st)
 const info=await bcaInfo(),tt=info.totals,bots=info.bots.filter(b=>b.on)
 const sel=Object.keys(BCA_CATS).filter(k=>st.t[k]),n=sel.reduce((a,k)=>a+(tt[k]||0),0)
 const tg_=k=>B((st.t[k]?'✅ ':'⬜ ')+BCA_CATS[k]+' ('+(tt[k]||0)+')','a:bcat:'+k,st.t[k]?'success':'primary')
 return show(c,`${H('📡','BROADCAST SEMUA BOT','Satu pesan untuk semua bot')}\n\n${Q(`🤖 Bot aktif  <b>${bots.length}</b>`,`🎯 Perkiraan penerima  <b>${n}</b>`,st.pin?'📌 Pesan disematkan di chat penerima':'📌 Tanpa pin')}\n<i>Pilih kelompok penerima, lalu tekan Tulis Pesan. Pemilik tiap bot reseller ikut dapat.</i>`,
  kb([[tg_('main')],[tg_('komisi')],[tg_('mandiri')],[B(st.pin?'📌 Pin: ON':'📌 Pin: OFF','a:bcap',st.pin?'success':'primary'),B('✍️ Tulis Pesan','a:bcaw','success')],AB]))}
async function bcaWrite(c){
 const st=await bcaSt(c);await setSt(c.from.id,{...st,k:'bca'})
 return show(c,`${H('✍️','TULIS BROADCAST')}\n\nKirim <b>teks</b> pesan (boleh HTML: <code>&lt;b&gt;tebal&lt;/b&gt;</code>) atau <b>foto + caption</b>.`,kb([[B('⬅️ Kembali','a:bca'),B('❌ Batal','a','danger')]]))}
async function bcaPreview(c,text,m,st){
 let photo=''
 if(m.photo)try{photo=await tgPhotoDataUrl(c,m.photo,1000000)}catch(e){return send(c,'⚠️ '+esc(e.message))}
 const body=String(text||'').trim();if(!body&&!photo)return send(c,'Kirim teks atau foto + caption.')
 const info=await bcaInfo(),n=Object.keys(BCA_CATS).filter(k=>st.t[k]).reduce((a,k)=>a+(info.totals[k]||0),0)
 await setSt(c.from.id,{k:'bcaok',t:st.t,pin:st.pin,text:body,photo})
 return send(c,`${H('👁','PRATINJAU',st.pin?'dengan pin':'')}\n\n${Q((photo?'🖼 <i>(foto terlampir)</i>\n':'')+body.slice(0,900))}\nKirim ke kira-kira <b>${n}</b> penerima di <b>${info.bots.filter(b=>b.on).length}</b> bot?`,kb([[B('✅ Kirim ke Semua Bot','a:bcago','success'),B('❌ Batal','a','danger')]]))}
async function bcaGo(c){
 const st=await getSt(c.from.id);if(st.k!=='bcaok')return show(c,'Sesi habis.',kb([AB]))
 await setSt(c.from.id,{});toast(c,'Mengirim...')
 let job;try{job=await bcaStart({text:st.text,photo:st.photo,pin:st.pin,by:c.chat,botId:c.bot.id,targets:st.t})}
 catch(e){return show(c,'⚠️ '+esc(e.message),kb([AB]))}
 await show(c,`${H('📡','BROADCAST BERJALAN')}\n\n${Q('🤖 Ke semua bot aktif')}\n<i>Laporan dikirim setelah selesai. Kalau penerimanya banyak, sisanya dilanjutkan otomatis tiap menit.</i>`,kb([AB]))
 return bcaStep(job,40000)}

// ---------- router ----------
async function onText(c,u,text,m){
 const st=await getSt(c.from.id),n0={...c,mid:0}
 if(/^\/(cancel|batal)/i.test(text)){await setSt(c.from.id,{});return menu(n0,u)}
 // deposit manual: pelanggan mengetik nominal sendiri
 if(c.rs&&st.k==='mamt'&&!m.photo){const v=parseAmt(text)
  if(!v)return send(c,'Ketik angka nominalnya, contoh 50000.')
  return mdepShow(n0,u,c.rs&&c.rs.lang&&c.rs.lang!=='id'?Math.round(v*((+c.rs.rate||0)||(LANGS[c.rs.lang]||{}).rate||1)):v)}
 // deposit manual: pelanggan mengirim foto bukti transfer
 if(c.rs&&st.k==='mproof'&&m.photo){
  const fid=m.photo[m.photo.length-1].file_id
  const d=await RS.depProof(c.rs.uid,st.id,fid).catch(()=>null)
  await setSt(c.from.id,{})
  if(!d)return send(c,'⚠️ Tagihan tidak ditemukan, ulangi dari menu Isi Saldo.')
  // deposit PENDING: channel toko (bahasa toko) + channel admin, dua-duanya pakai struk
  RS.chDepMan(c.rs.uid,d,'pending',null).catch(()=>{})
  // kabari pemilik toko supaya bisa langsung ACC
  const own=(c.rs.bot&&c.rs.bot.ownerId)||''
  if(own)tg(c.bot.token,'sendPhoto',{chat_id:own,photo:fid,parse_mode:'HTML',
   caption:`${H('🧾','BUKTI TRANSFER MASUK')}\n\n${Q(`👤 ${esc(d.nama||String(d.tgId))}`,`💵 <b>${RP(c)(d.amount)}</b>`,`🆔 ${d.id}`)}`,
   reply_markup:kb([[B('✅ Terima','mok:'+d.id,'success'),B('❌ Tolak','mno:'+d.id,'danger')]])}).catch(()=>{})
  return send(c,`${H('⏳',Tx(c,'dep.wait'))}\n\n${Q(`💵 ${RP(c)(d.amount)}`,`🆔 ${d.id}`)}`,kb([[B(Tx(c,'menu.home'),'m','success')]]))}
 if((c.adm||c.own)&&st.k==='banner'){
  if(text==='-'){await kv.del('tgbn:'+c.bot.id);await setSt(c.from.id,{});return adminMenu(n0,'✅ Banner kembali ke bawaan.')}
  const md=m.photo?{t:'photo',f:m.photo[m.photo.length-1].file_id}:m.animation?{t:'animation',f:m.animation.file_id}:m.video?{t:'video',f:m.video.file_id}:null
  if(!md)return send(c,'Kirim foto, video, atau GIF (atau <code>-</code> untuk reset).')
  await kv.set('tgbn:'+c.bot.id,md);await setSt(c.from.id,{});return adminMenu(n0,'✅ Banner menu diganti. Ketik /start untuk melihat hasilnya.')}
 if((c.adm||c.own)&&st.k==='rsmkrp'){
  const v=parseAmt(text);if(!(v>=0)||(v===0&&!/^\s*0+\s*$/.test(String(text))))return send(c,'Ketik angka Rupiah, mis. 1000 atau 1,5rb')
  const i=String(st.i||'x');await setSt(c.from.id,{})
  try{await RS.setMarkupRp(c.bot.rs,i==='x'?'all':(SERVERS[+i]||{}).server,v)}catch(e){return send(c,'⚠️ '+esc(e.message))}
  return rsMarkSv(n0,i,`✅ Markup disimpan: <b>+${rpMk(v)}</b>`)}
 if((c.adm||c.own)&&st.k==='rsmk'){
  const v=parseFloat(String(text).replace(',','.'));if(!(v>=0&&v<=100))return send(c,'Ketik angka 0-100, mis. 12 atau 7.5')
  await setSt(c.from.id,{});const r=await RS.setMarkup(c.bot.rs,v);c.rs=r;return rsPanel(n0,`✅ Markup jadi <b>${r.markup}%</b>.`)}
 // ---- toko stok mandiri: cari pelanggan, ubah saldo, ban/unban, isi saldo stok ----
 if(c.own&&isMd(c)&&st.k==='rsfind'){
  const t=await rsFindCust(c,text)
  if(!t)return send(c,'❌ Pelanggan tidak ditemukan di tokomu. Kirim @username, ID Telegram, atau ID user. Atau /cancel.')
  if(st.op==='view'){await setSt(c.from.id,{});return rsCustCard(n0,t)}
  if(st.op==='add'||st.op==='del')return rsAskAmount(n0,st.op,t)
  await setSt(c.from.id,{});const r=await rsAct(c,st.op,t)
  return r.f?rsCustCard(n0,r.f,r.err?'⚠️ '+esc(r.err):(st.op==='ban'?'⛔ <b>Pelanggan dibanned.</b>':'♻️ <b>Pelanggan di-unban.</b>')):send(c,'⚠️ '+esc(r.err))}
 if(c.own&&isMd(c)&&st.k==='rsamount'){
  const n=parseAmt(text);if(!(n>0&&n<=1e9))return send(c,'❌ Nominal tidak valid. Ketik angka Rupiah, mis. <code>10000</code> atau <code>10k</code>.')
  const t=await kv.get('u:'+st.uid);await setSt(c.from.id,{})
  if(!t||t.rs!==c.bot.rs)return send(c,'⚠️ Pelanggan tidak ditemukan di tokomu.')
  const r=await rsAct(c,st.op,t,n)
  return r.f?rsCustCard(n0,r.f,r.err?'⚠️ '+esc(r.err):`✅ <b>Saldo ${st.op==='add'?'ditambah':'dikurangi'} ${rp(n)}.</b>`):send(c,'⚠️ '+esc(r.err))}
 if(c.own&&isMd(c)&&st.k==='rsstkamt'){
  const n=parseAmt(text);if(!n)return send(c,'Ketik angka nominalnya, contoh 50000 atau 50k.')
  return rsStokShow(n0,n)}
 if(c.adm&&!c.rs&&st.k==='bca')return bcaPreview(c,m.caption||m.text||text,m,{t:normTargets(st.t),pin:st.pin?1:0})
 if((c.adm||c.own)&&st.k==='bc'){
  const photo=m.photo?m.photo[m.photo.length-1].file_id:'',body=(m.caption||m.text||'').trim();if(!body&&!photo)return send(c,'Kirim teks atau foto + caption.')
  await setSt(c.from.id,{k:'bcok',pin:st.pin,text:body,photo})
  return send(c,`${H('👁','PRATINJAU',st.pin?'dengan pin':'')}\n\n${Q((photo?'🖼 <i>(foto terlampir)</i>\n':'')+body.slice(0,900))}\nKirim ke <b>${((await kv.get(c.bot.rs?'rsc:'+c.bot.rs:'tgidx'))||[]).length}</b> ${c.bot.rs?'pelanggan':'pengguna'}?`,kb([[B('✅ Kirim Sekarang','a:bcgo','success'),B('❌ Batal','a','danger')]]))}
 if(c.adm&&st.k==='finduser'){
  const t=await findUser(text);if(!t)return send(c,'❌ User tidak ditemukan. Coba lagi atau /cancel.')
  if(st.op==='view'){await setSt(c.from.id,{});return userCard(n0,t)}
  if(st.op==='add'||st.op==='del')return askAmount(n0,st.op,t)
  await setSt(c.from.id,{});const f=await adminAct(c,st.op,t);return userCard(n0,f,st.op==='ban'?'⛔ <b>User dibanned.</b>':'♻️ <b>User di-unban.</b>')}
 if(c.adm&&st.k==='amount'){
  const n=num(text);if(n<=0||n>1e9)return send(c,'❌ Nominal tidak valid. Ketik angka, mis. <code>10000</code>.')
  const t=await kv.get('u:'+st.uid);await setSt(c.from.id,{});if(!t)return send(c,'User tidak ditemukan.')
  const f=await adminAct(c,st.op,t,n);return userCard(n0,f,`✅ <b>Saldo ${st.op==='add'?'ditambah':'dikurangi'} ${rp(n)}.</b>`)}
 if(c.adm&&st.k==='usermsg'){
  const t=await kv.get('u:'+st.uid);await setSt(c.from.id,{});const ok=t&&await pushUser(t,`${H('📩','PESAN DARI ADMIN')}\n\n${Q(esc(text))}`)
  return send(c,ok?'✅ Pesan terkirim.':'❌ Gagal kirim (user belum terhubung / memblokir bot).',kb([AB]))}
 if(c.adm&&st.k==='mtmsg'){await setSt(c.from.id,{});await setMaint(c,o=>{o.msg=text.slice(0,300)});return mtView(n0,'✅ Pesan maintenance disimpan.')}
 if(c.adm&&st.k==='bw'){await setSt(c.from.id,{});const cfg=await getCfg();cfg.broadcast=text==='-'?'':text.slice(0,500);await putCfg(cfg)
  notify({src:'bot',i:'📣',t:'Banner web diubah',st:'admin',note:cfg.broadcast||'(dihapus)'});return adminMenu(n0,'✅ Banner di beranda dashboard web diperbarui.')}
 if(c.adm&&st.k==='mkc'){const p=+String(text).replace(',','.');if(!(p>=0&&p<=500))return send(c,'❌ Isi angka 0–500.');await setSt(c.from.id,{});const cfg=await getCfg();cfg.markup=p;await putCfg(cfg);return mkView(n0,'✅ Markup umum diubah.')}
 if(st.k==='link')return doLink(n0,u,text)
 if(st.k==='buy'&&!st.opts&&st.sv){st.q=text.slice(0,40);await setSt(c.from.id,st);return svPage(n0,0)}
 if(st.k==='amt'){return depConfirm(n0,u,st.m,parseAmt(text))}
 return menu(n0,u)}

async function onCallback(c,u,d){
 const [a,x,y]=d.split(':')
 if(a==='m'){await setSt(c.from.id,{});return menu(c,u)}
 if(a==='rspromo')return rsPromo(c,x)
 if(a==='tips')return tipsView(c)
 if(a==='acc')return accView(c,u)
 if(a==='his')return hisView(c,u,x)
 if(a==='mut')return mutView(c,u,x)
 if(a==='ref')return refView(c,u)
 if(a==='help')return helpView(c)
 if(a==='web')return webView(c)
 if(a==='pw')return pwView(c,u)
 if(a==='lnk')return lnkView(c)
 if(a==='buy')return buyStart(c,u)
 if(a==='bs')return pickServer(c,u,x)
 if(a==='bl')return svPage(c,x)
 if(a==='bq')return toast(c,'Ketik nama aplikasi di chat, mis. whatsapp')
 if(a==='bx'){const st=await getSt(c.from.id);st.q='';await setSt(c.from.id,st);return svPage(c,0)}
 if(a==='bp')return pickService(c,u,x)
 if(a==='bt')return optPage(c,u,x)
 if(a==='bo')return confirmView(c,u,x,null)
 if(a==='bg')return confirmView(c,u,x,y)
 if(a==='bgo')return placeOrder(c,u,x)
 if(a==='ord'){const o=findOrder(u,x);return o?orderView(c,u,o):show(c,'Order tidak ditemukan.',kb([BACK]))}
 if(a==='oc')return ordCheck(c,u,x)
 if(a==='ox')return ordCancelAsk(c,u,x)
 if(a==='oxy')return ordCancel(c,u,x)
 if(a==='dep')return depStart(c,u)
 // --- deposit manual (mode mandiri) ---
 if(a==='md')return mdepShow(c,u,num(x))
 if(a==='mdc'){await setSt(c.from.id,{k:'mamt'});return show(c,rich({ic:'✏️',title:Tx(c,'dep.amt'),
  hello:'Ketik nominal yang mau diisi di chat ini.',blocks:[['📐','',[[Tx(c,'dep.min'),RP(c)(DEP_MIN)],[Tx(c,'dep.max'),RP(c)(DEP_MAX)]]]]}),
  kb([[B('❌ '+Tx(c,'menu.back'),'dep','danger')]]))}
 if(a==='mdp'){await setSt(c.from.id,{k:'mproof',id:x})
  return show(c,rich({ic:'📤',title:Tx(c,'dep.send'),hello:Tx(c,'dep.qris'),
   blocks:[['🧾','',[['ID',String(x)]]]]}),kb([[B('❌ '+Tx(c,'menu.back'),'dep','danger')]]))}
 if(a==='mv'){   // pemilik toko: lihat & putuskan bukti transfer
  if(!c.own)return show(c,'⛔',kb([BACK]))
  return mdepPanel(c,x)}
 if(a==='mok'||a==='mno'){
  if(!c.own)return show(c,'⛔',kb([BACK]))
  try{const r=await RS.depReview(c.rs.uid,String(x),a==='mok')
   if(r&&r.status==='diterima'){const cu=await kv.get('u:'+r.cust)
    if(cu){mut(cu,r.amount,'Deposit QRIS toko');await save(cu)
     // deposit SUKSES: channel toko (bahasa toko) + channel admin, dua-duanya pakai struk
     RS.chDepMan(c.rs.uid,r,'lunas',cu.balance).catch(()=>{})
     pushUser(cu,`${H('✅',Tx(c,'dep.ok'))}\n\n${Q(`💵 <b>${RP(c)(r.amount)}</b>`,`👛 ${Tx(c,'f.saldo')}  <b>${RP(c)(cu.balance)}</b>`)}`).catch(()=>{})}}
   if(r&&r.status==='ditolak'){const cu=await kv.get('u:'+r.cust)
    if(cu)pushUser(cu,`${H('❌',Tx(c,'dep.no'))}\n\n${Q(`💵 ${RP(c)(r.amount)}`,`🆔 ${r.id}`)}`).catch(()=>{})}
   return mdepPanel(c,'',a==='mok'?'✅ Deposit diterima, saldo pelanggan sudah ditambah.':'❌ Deposit ditolak.')}
  catch(e){return mdepPanel(c,'','⚠️ '+esc(e.message))}}
 if(a==='dm')return depAmount(c,u,x)
 if(a==='dc')return depCustom(c,u,x)
 if(a==='da')return depConfirm(c,u,x,num(y))
 if(a==='dgo')return depCreate(c,u,x,num(y))
 if(a==='dk')return depCheckBtn(c,u,x)
 if(a==='dx')return depCancelAsk(c,u,x)
 if(a==='dxy')return depCancelDo(c,u,x)
 if(a==='dl')return depList(c,u)
 if(a==='a'||a==='ua'){
  if(c.rs){   // bot reseller: hanya pemilik toko, dan hanya menu toko
   if(!c.own)return show(c,'⛔ Khusus pemilik toko.',kb([BACK]))
   // toko stok mandiri: kelola pelanggan (saldo, ban/unban) + isi saldo stok
   if(isMd(c)){
    if(a==='ua'){const t=await kv.get('u:'+y);if(!t||t.rs!==c.bot.rs)return rsPanel(c,'⚠️ Pelanggan tidak ditemukan di tokomu.')
     if(x==='ref')return rsCustCard(c,t)
     if(x==='add'||x==='del')return rsAskAmount(c,x,t)
     if(x==='ban'||x==='unban'){const r=await rsAct(c,x,t);return rsCustCard(c,r.f||t,r.err?'⚠️ '+esc(r.err):(x==='ban'?'⛔ <b>Pelanggan dibanned.</b>':'♻️ <b>Pelanggan di-unban.</b>'))}
     return rsPanel(c)}
    if(!x){await setSt(c.from.id,{});return rsPanel(c)}
    if(['add','del','ban','unban'].includes(x))return rsAskUser(c,x)
    if(x==='us')return rsAskUser(c,'view')
    if(x==='stk'&&y==null){await setSt(c.from.id,{});return rsStokView(c)}
    if(x==='stkk')return rsStokCheck(c,String(y||''))
    if(x==='stkx')return rsStokCancel(c,String(y||''))
    if(x==='stk')return rsStokShow(c,num(y))
    if(x==='stkc'){await setSt(c.from.id,{k:'rsstkamt'});return show(c,`${H('✏️','NOMINAL SALDO STOK')}\n\n${Q(`📉 Minimal  <b>${rp(STK_MIN)}</b>`,`📈 Maksimal  <b>${rp(STK_MAX)}</b>`)}\nKetik <b>nominal</b> di chat 👇\n<i>Contoh: 50000 · 50k · 1jt</i>`,kb([[B('❌ Batal','a:stk','danger')]]))}}
   if(a==='ua')return rsPanel(c)
   if(!x)return rsPanel(c)
   if(x==='sal')return rsSaldo(c)
   if(x==='mk'&&y==null)return rsMarkAsk(c)
   if(x==='mks')return rsMarkSv(c,String(y||''))
   if(x==='mkv'){const [i,v]=String(y||'').split('_');const sv=i==='x'?'all':(SERVERS[+i]||{}).server
    try{await RS.setMarkupRp(c.bot.rs,sv,v)}catch(e){return rsMarkSv(c,i,'⚠️ '+esc(e.message))}
    return rsMarkSv(c,i,`✅ Markup disimpan: <b>+${rpMk(v)}</b>`)}
   if(x==='mkr'){await setSt(c.from.id,{k:'rsmkrp',i:String(y||'x')});return show(c,`${H('✏️','KETIK MARKUP (Rp)')}\n\nKirim angka Rupiah, mis. <code>1000</code> atau <code>1,5rb</code> (0–${RS.MK_RP_MAX.toLocaleString('id-ID')}).`,kb([[B('❌ Batal','a:mk','danger')]]))}
   if(x==='mk'&&y!=null){const r=await RS.setMarkup(c.bot.rs,y);c.rs=r;return rsPanel(c,`✅ Markup jadi <b>${r.markup}%</b>.`)}
   if(x==='mkc'){await setSt(c.from.id,{k:'rsmk'});return show(c,`${H('✏️','KETIK MARKUP')}\n\nKirim angka persen, mis. <code>12</code> atau <code>7.5</code> (0-100).`,kb([[B('❌ Batal','a','danger')]]))}
   if(x==='bn')return bannerAsk(c)
   if(x==='bc0')return bcAsk(c,false)
   if(x==='bc1')return bcAsk(c,true)
   if(x==='bcgo'){const st=await getSt(c.from.id);if(st.k!=='bcok')return show(c,'Sesi habis.',kb([[B('🏪 Panel Toko','a')]]))
    await setSt(c.from.id,{});toast(c,'Mengirim...')
    const ids=((await kv.get('rsc:'+c.bot.rs))||[]).map(String)
    const job=await startBroadcast({text:st.text,photo:st.photo,pin:st.pin,by:c.chat,botId:c.bot.id,ids})
    await show(c,`${H('📡','BROADCAST BERJALAN')}\n\n${Q(`🎯 Pelanggan  <b>${job.ids.length}</b>`)}\n<i>Laporan dikirim setelah selesai.</i>`,kb([[B('🏪 Panel Toko','a')]]))
    return bcStep(job,40000)}
   return rsPanel(c)}
  if(!c.adm)return show(c,'⛔ Khusus admin.',kb([BACK]))
  if(a==='ua'){const t=await kv.get('u:'+y);if(!t)return show(c,'User tidak ditemukan.',kb([AB]))
   if(x==='ref')return userCard(c,t)
   if(x==='add'||x==='del')return askAmount(c,x,t)
   if(x==='ban'||x==='unban'){const f=await adminAct(c,x,t);return userCard(c,f,x==='ban'?'⛔ <b>User dibanned.</b>':'♻️ <b>User di-unban.</b>')}
   if(x==='rst'){const tk=rid();await kv.set('pr:'+tk,{id:t.id,exp:Date.now()+30*60000});const link=siteOf(c)+'/reset?token='+tk;return show(c,`${H('🔑','LINK RESET','Berlaku 30 menit, sekali pakai')}\n\n${Q(`👤 <code>${esc(t.email)}</code>`)}\n<code>${esc(link)}</code>`,kb([[C('📋 Salin Link',link)],[B('⬅️ Kembali','ua:ref:'+t.id)]]))}
   if(x==='msg'){await setSt(c.from.id,{k:'usermsg',uid:t.id});return show(c,`${H('✉️','KIRIM PESAN')}\n\nKe <code>${esc(t.email)}</code>\nKetik pesannya:`,kb([[B('❌ Batal','a','danger')]]))}
   return}
  if(!x){await setSt(c.from.id,{});return adminMenu(c)}
  if(x==='st')return adminStats(c)
  if(x==='us')return askUser(c,'view')
  if(['add','del','ban','unban'].includes(x))return askUser(c,x)
  if(x==='bca'||x==='bcat'||x==='bcap')return bcaMenu(c,x,y)
  if(x==='bcaw')return bcaWrite(c)
  if(x==='bcago')return bcaGo(c)
  if(x==='bc0')return bcAsk(c,false)
  if(x==='bc1')return bcAsk(c,true)
  if(x==='bcgo'){const st=await getSt(c.from.id);if(st.k!=='bcok')return show(c,'Sesi habis.',kb([AB]))
   await setSt(c.from.id,{});toast(c,'Mengirim...');const job=await startBroadcast({text:st.text,photo:st.photo,pin:st.pin,by:c.chat,botId:c.bot.id})
   await show(c,`${H('📡','BROADCAST BERJALAN')}\n\n${Q(`🎯 Sasaran  <b>${job.ids.length}</b>`)}\n<i>Laporan dikirim setelah selesai.</i>`,kb([AB]))
   return bcStep(job,40000)}
  if(x==='pay')return payView(c)
  if(x==='pe'){const cfg=await getCfg();cfg.dep.engine=engineOf(cfg)==='v2'?'v1':'v2';await putCfg(cfg);return payView(c)}
  if(x==='pr'){const cfg=await getCfg();if(!ROUTES[y])return
   const key=engineOf(cfg)==='v2'?'routes2':'routes';if(!cfg.dep[key][y])return
   cfg.dep[key][y].on=!cfg.dep[key][y].on;await putCfg(cfg);return payView(c)}
  if(x==='pm'){const cfg=await getCfg();if(!METHODS[y])return;cfg.dep.methods[y].on=!cfg.dep.methods[y].on;await putCfg(cfg);return payView(c)}
  if(x==='mt'&&y!=null){await setMaint(c,o=>{o.on=y==='1'});return mtView(c)}
  if(x==='mt')return mtView(c)
  if(x==='mtm'){await setMaint(c,o=>{o.mode=o.mode==='soft'?'full':'soft'});return mtView(c)}
  if(x==='mtt'){await setSt(c.from.id,{k:'mtmsg'});return show(c,`${H('💬','PESAN MAINTENANCE')}\n\nKetik pesan yang tampil ke pengguna:`,kb([[B('❌ Batal','a:mt','danger')]]))}
  if(x==='mts'){const s=SERVERS[+y];if(s)await setMaint(c,o=>{const e=o.srv[s.server]||{on:false,msg:''};o.srv[s.server]={on:!e.on,msg:e.msg||''}});return mtView(c)}
  if(x==='sv')return svAdmin(c)
  if(x==='svt'){const s=SERVERS[+y];if(s){const cfg=await getCfg();cfg.off=cfg.off.includes(s.server)?cfg.off.filter(k=>k!==s.server):[...new Set([...cfg.off,s.server])];await putCfg(cfg)};return svAdmin(c)}
  if(x==='mk'&&y){const p=+y;if(p>=0&&p<=500){const cfg=await getCfg();cfg.markup=p;await putCfg(cfg)};return mkView(c,'✅ Markup diubah ke '+y+'%.')}
  if(x==='mk')return mkView(c)
  if(x==='mkc'){await setSt(c.from.id,{k:'mkc'});return show(c,`${H('✏️','MARKUP')}\n\nKetik persen baru (0–500), mis. <code>12.5</code>:`,kb([[B('❌ Batal','a:mk','danger')]]))}
  if(x==='bn')return bannerAsk(c)
  if(x==='bw'){await setSt(c.from.id,{k:'bw'});return show(c,`${H('📣','BANNER WEB','Tampil di beranda dashboard pengguna')}\n\nKetik teks baru (atau <code>-</code> untuk menghapus):`,kb([[B('❌ Batal','a','danger')]]))}
  if(x==='bk'){toast(c,'Membuat backup...');let r;try{r=await runBackup('manual')}catch(e){r={ok:false,error:e.message}};return adminMenu(c,r.ok?'✅ Backup terkirim ke chat owner.':'❌ Backup gagal: '+esc(r.error||'-'))}
  if(x==='tn'){const r=await notify({src:'bot',i:'✅',t:'Tes notifikasi bot',st:'ok',rows:[['Status','Terhubung'],['Admin',ADM(c)]],note:'Kalau pesan ini masuk ke channel, notifikasi bot sudah siap.'});return adminMenu(c,r.ok?'✅ Notifikasi tes terkirim ke channel.':'❌ '+esc(r.error||'gagal'))}}
}

export async function handle(bot,upd){
 // chat yang sedang dilayani dicatat di luar try: kalau terjadi error, pengguna tetap bisa dikabari
 let chatId=0
 try{
  if(upd.my_chat_member){const m=upd.my_chat_member;if(m.chat.type==='private'){const uid=await kv.get('tg:'+m.from.id),u=uid&&await kv.get('u:'+uid);if(u){u.tgBlocked=m.new_chat_member.status==='kicked';await save(u)}}return}
  const cb=upd.callback_query,m=upd.message
  const from=(cb||m||{}).from;if(!from||from.is_bot)return
  const msg=cb?cb.message:m;if(!msg||msg.chat.type!=='private')return
  chatId=msg.chat.id
  const c={bot,chat:msg.chat.id,from,mid:cb?msg.message_id:0,isPhoto:!!(cb&&(msg.photo||msg.video||msg.animation)),cbq:cb&&cb.id,adm:(bot.admins||[]).map(String).includes(String(from.id))}
  // tombol dijawab SEKETIKA (spinner hilang), tanpa menunggu proses selesai. Hanya 'bq' yang menjawab dengan popup teks.
  if(cb&&cb.data!=='bq'){c.answered=true;c.ackP=tg(bot.token,'answerCallbackQuery',{callback_query_id:cb.id})}
  // SEMUA bacaan awal dimulai SEKARANG, berbarengan (dulu berurutan: tiap bacaan menunggu yang sebelumnya selesai,
  // jadi satu tombol bisa menghabiskan 5-6 round-trip database sebelum bot mulai membalas).
  const dupP=upd.update_id!=null?kv.incr(`rl:tgu:${bot.id}:${upd.update_id}`):Promise.resolve(1)   // buang update ganda (Telegram mengirim ulang kalau balasan lambat)
  c.uidP=kv.get(tgKey(c))
  const rsP=bot.rs?rsFast(bot.rs,from.id):null
  const baseP=Promise.all([cfgFast(),getSec(),kv.incr(`rl:tg:${from.id}:${Math.floor(Date.now()/60000)}`)])
  ;[c.uidP,rsP,baseP].forEach(x=>x&&x.catch(()=>{}))
  if(await dupP>1)return
  const text=cb?'':(m.text||m.caption||'').trim()
  const sm=text.match(/^\/start(?:@\w+)?(?:\s+(\S+))?/i);if(sm&&sm[1]&&/^ref_/i.test(sm[1]))c.ref=sm[1].slice(4).toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,12)
  // baca semua yang dibutuhkan sekaligus (paralel)
  const [cfg,sec,rl]=await baseP
  c.cfg=cfg;c.sec=sec
  // Bot reseller: markup & aturan deposit miliknya sendiri. Pemiliknya BUKAN admin platform.
  if(bot.rs){const rs=await rsP
   if(!rs.on||!rs.bot||rs.bot.id!==bot.id)return
   c.rs=rs;c.cfg0=cfg;c.cfg=rsCfg(cfg,rs)
   c.own=String(rs.bot.ownerId)===String(from.id);c.adm=false}
  const u=await getUser(c)
  if(rl>90){if(cb)await toast(c,'Terlalu cepat, tunggu sebentar');return}
  if(u.banned)return send(c,`${H('⛔','AKUN DITANGGUHKAN')}\n\nAkunmu diblokir. Hubungi admin bila ada kesalahan.`)
  if(cb){try{return await onCallback(c,u,cb.data||'')}finally{await c.ackP;if(!c.answered)await tg(bot.token,'answerCallbackQuery',{callback_query_id:cb.id})}}
  if(sm&&sm[1]&&/^link_/i.test(sm[1]))return doLink(c,u,sm[1].slice(5))   // tombol 'Hubungkan' di web membuka bot dan langsung menghubungkan
  if(/^\/start/i.test(text)||/^\/(menu|home)/i.test(text)){await setSt(from.id,{});return menu(c,u)}
  if(/^\/id/i.test(text))return send(c,`🆔 ID Telegram kamu: <code>${from.id}</code>`)
  if(/^\/(admin|toko)/i.test(text)){if(!(c.adm||c.own))return send(c,'⛔ Kamu bukan admin bot ini. ID kamu: <code>'+from.id+'</code>');await setSt(from.id,{});return adminMenu({...c,mid:0})}
  const lk=text.match(/^\/link\s+(\S+)/i);if(lk)return doLink(c,u,lk[1])
  if(text||m.photo||m.video||m.animation)return await onText(c,u,text,m)
 }catch(e){
  // Dulu error di sini HANYA dicatat di log server: pengguna tidak dapat kabar apa pun
  // dan layarnya seperti "nyangkut". Sekarang selalu ada balasan + jejak untuk admin.
  console.error('tgbot',e)
  try{await kv.set('tmp:boterr',{at:Date.now(),bot:bot&&bot.id,err:String((e&&e.message)||e).slice(0,200)},86400)}catch(_){}
  if(chatId)try{await tg(bot.token,'sendMessage',{chat_id:chatId,parse_mode:'HTML',
   text:`${H('⚠️','GAGAL DIPROSES')}\n\n${Q('Permintaanmu tidak selesai diproses. Saldomu tidak terpotong.')}\n<i>Coba lagi lewat tombol di bawah. Kalau tagihan deposit terlanjur terbuat, buka «Tagihan Saya» — gambar QR-nya dikirim ulang di sana.</i>`,
   reply_markup:kb([[B('📜 Tagihan Saya','dl','success'),B('🏠 Menu','m','primary')]])})}catch(_){}}}
