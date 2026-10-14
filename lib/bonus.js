// Konfigurasi promo, bonus deposit, referral, dan hadiah leaderboard mingguan
import {kv} from './db'
import {save} from './auth'
import {notify,mask,rp} from './telegram'
export const DEF={markup:10,mks:{},mkRound:0,broadcast:'',off:[],buttons:[],
 ref:{on:true,referrer:1000,referee:1000,minDep:5000,maxRef:100},
 bonus:{on:true,minAmt:5000,pct:2,max:0,days:[],dayPct:0},
 weekly:{on:true,metric:'trx',prizes:[5000,3000,2000],min:1},
 monthly:{on:true,metric:'trx',prizes:[20000,10000,5000],min:1},
 site:{baseUrl:'',docsUrl:''},
 // angka beranda: '' = otomatis (angka asli), isi angka = tampil sesuai isian admin
 stats:{users:'',orders:''},

 // deposit: rute (gateway) aktif, metode yang tampil, batas nominal. Atur di /admin > Deposit.
 // Rute dipilih ACAK MERATA (tanpa bobot); field 'w' disimpan hanya demi kompatibilitas data lama.
 // engine: mesin rute yang dipakai. 'v1' = rute lama (Artapedia/Pakasir/Ditznesia), 'v2' = rute baru (hanya Pakasir + AustinPay).
 dep:{min:2000,max:10000000,engine:'v1',
  routes:{artapedia:{on:true,w:1},pakasir:{on:false,w:1},ditz:{on:false,w:1},austin:{on:false,w:1}},
  routes2:{pakasir:{on:true,w:1},austin:{on:true,w:1}},
  methods:{qris:{on:true},bri_va:{on:false},bni_va:{on:false},cimb_niaga_va:{on:false},permata_va:{on:false},maybank_va:{on:false},bnc_va:{on:false},artha_graha_va:{on:false},sampoerna_va:{on:false}}},
 // JasaOTP: daftar kode negara yang dicek per server (kosong = Indonesia + negara pertama), mis. {1:'6,7,12'}
 ditz:{countries:{},max:10},
 // nama/lencana/deskripsi server yang diubah admin: {server_id:{name,badge,description}}
 srv:{},
 backup:{on:true,hours:24},
 // Pintu rahasia: ketuk tulisan "ARTAPEDIA ID" di kaki dashboard sebanyak n kali untuk membuka /admin
 // tanpa mengetik password. emails kosong = siapa pun yang sudah login boleh; diisi = hanya email itu.
 tap:{on:true,n:20,emails:[]},
 // maintenance: on = seluruh situs; mode 'full' = layar penuh, 'soft' = banner (pesanan & deposit baru tetap diblokir); srv = per server {id:{on,msg}}
 maint:{on:false,mode:'full',msg:'',srv:{}}}
export async function getCfg(){const c=(await kv.get('cfg'))||{}
 return {...DEF,...c,ref:{...DEF.ref,...c.ref},bonus:{...DEF.bonus,...c.bonus},weekly:{...DEF.weekly,...c.weekly},monthly:{...DEF.monthly,...c.monthly},site:{...DEF.site,...c.site},stats:{...DEF.stats,...c.stats},backup:{...DEF.backup,...c.backup},tap:{...DEF.tap,...c.tap,emails:Array.isArray((c.tap||{}).emails)?c.tap.emails:[]},
  dep:{...DEF.dep,...c.dep,engine:((c.dep||{}).engine==='v2'?'v2':'v1'),
   routes:Object.fromEntries(Object.keys(DEF.dep.routes).map(k=>[k,{...DEF.dep.routes[k],...((c.dep||{}).routes||{})[k]}])),
   routes2:Object.fromEntries(Object.keys(DEF.dep.routes2).map(k=>[k,{...DEF.dep.routes2[k],...((c.dep||{}).routes2||{})[k]}])),
   methods:Object.fromEntries(Object.keys(DEF.dep.methods).map(k=>[k,{...DEF.dep.methods[k],...((c.dep||{}).methods||{})[k]}]))},
  ditz:{...DEF.ditz,...c.ditz,countries:{...(c.ditz||{}).countries}},srv:{...c.srv},maint:{...DEF.maint,...c.maint,srv:{...(c.maint||{}).srv}}}}
export const mut=(u,a,n)=>{u.balance+=a;(u.mut=u.mut||[]).unshift({amt:a,bal:u.balance,note:n,at:Date.now()});u.mut=u.mut.slice(0,500)}
// ---------- waktu WIB ----------
export const WEEK=7*864e5
export const wibDay=(t=Date.now())=>new Date(t+7*36e5).getUTCDay() // 0=Minggu
export function weekStart(t=Date.now()){ // Senin 00:00 WIB
 const d=new Date(t+7*36e5),dow=(d.getUTCDay()+6)%7
 return Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate())-dow*864e5-7*36e5}
export const monthStart=(t=Date.now())=>{const d=new Date(t+7*36e5);return Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),1)-7*36e5}
export const monthEnd=(t=Date.now())=>{const d=new Date(t+7*36e5);return Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,1)-7*36e5}
// ---------- bonus deposit ----------
export function bonusPct(cfg,t=Date.now()){const b=cfg.bonus;if(!b||!b.on)return 0
 return (b.days||[]).includes(wibDay(t))&&+b.dayPct>0?+b.dayPct:(+b.pct||0)}
export function bonusFor(cfg,amount,t=Date.now()){const b=cfg.bonus;if(!b||!b.on||amount<(+b.minAmt||0))return 0
 let x=Math.floor(amount*bonusPct(cfg,t)/100);if(+b.max>0)x=Math.min(x,+b.max);return Math.max(0,x)}
// ---------- referral ----------
const AB='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export async function ensureRef(u){
 if(u.refCode)return u.refCode
 for(let i=0;i<8;i++){let c='';for(let j=0;j<7;j++)c+=AB[Math.floor(Math.random()*AB.length)]
  if(!(await kv.get('rc:'+c))){u.refCode=c;await kv.set('rc:'+c,u.id);await save(u);return c}}
 return ''}
// Dipanggil SATU-SATUNYA saat deposit lunas: kredit saldo + bonus deposit + bonus referral (deposit pertama teman)
export async function creditDeposit(u,o){
 if(o.credited)return 0
 const cfg=await getCfg();o.credited=true
 mut(u,o.amount,'Deposit '+o.id)
 // Pelanggan bot reseller (u.rs) TIDAK ikut bonus deposit & program ajak teman platform:
 // uang promosi itu milik toko platform, bukan toko reseller.
 if(u.rs)return 0
 const bn=bonusFor(cfg,o.amount,o.at||Date.now())
 if(bn>0){o.bonus=bn;mut(u,bn,'Bonus deposit '+bonusPct(cfg,o.at||Date.now())+'% · '+o.id)}
 if(u.refBy&&!u.refPaid&&cfg.ref.on&&o.amount>=cfg.ref.minDep){
  u.refPaid=true
  try{const r=await kv.get('u:'+u.refBy)
   if(+cfg.ref.referee>0){mut(u,+cfg.ref.referee,'Bonus ajakan teman');o.refBonus=+cfg.ref.referee}
   if(r&&!r.banned&&+cfg.ref.referrer>0&&(r.refCount||0)<(+cfg.ref.maxRef||1e9)){
    mut(r,+cfg.ref.referrer,'Bonus referral · '+mask(u.email));r.refCount=(r.refCount||0)+1;r.refEarn=(r.refEarn||0)+ +cfg.ref.referrer;await save(r)
    await notify({i:'🤝',t:'Bonus referral dibagikan',st:'ok',id:['ID Deposit',o.id],rows:[['Pengajak',mask(r.email)],['Yang diajak',mask(u.email)],['Bonus pengajak',rp(cfg.ref.referrer)],['Bonus teman',rp(cfg.ref.referee)]]})}
  }catch(e){}}
 return bn}
// ---------- leaderboard mingguan ----------
export function weekRows(us,from,to,metric){
 const rows=us.filter(u=>!u.banned).map(u=>{const ok=(u.tx||[]).filter(x=>x.type==='order'&&x.status==='success'&&x.at>=from&&x.at<to)
  return {id:u.id,email:u.email,trx:ok.length,spent:ok.reduce((a,x)=>a+x.price,0)}}).filter(r=>r.trx>0)
 const k=metric==='spent'?'spent':'trx',k2=k==='trx'?'spent':'trx'
 return rows.sort((a,b)=>b[k]-a[k]||b[k2]-a[k2])}
export async function allUsers(){const ids=(await kv.get('idx'))||[];return (await Promise.all(ids.map(i=>kv.get('u:'+i)))).filter(Boolean)}
// Bagikan hadiah juara periode lalu (sekali per periode, aman dipanggil berulang oleh cron). kind: 'wk' | 'mo'
async function payPeriod(kind){
 const cfg=await getCfg(),w=kind==='wk'?cfg.weekly:cfg.monthly;if(!w.on)return null
 const cur=kind==='wk'?weekStart():monthStart(),prev=kind==='wk'?cur-WEEK:monthStart(cur-1)
 const init=await kv.get(kind+':init');if(!init){await kv.set(kind+':init',cur);return null}
 if(prev<init||await kv.get(kind+':'+prev))return null
 await kv.set(kind+':'+prev,{paying:1,at:Date.now()})
 const us=await allUsers(),rows=weekRows(us,prev,cur,w.metric),win=[],nm=kind==='wk'?'mingguan':'bulanan'
 for(let i=0;i<(w.prizes||[]).length;i++){const r=rows[i],prize=+w.prizes[i]
  if(!r)break;if((w.metric==='spent'?r.spent:r.trx)<(+w.min||1)||!(prize>0))continue
  const u=us.find(x=>x.id===r.id);mut(u,prize,'Hadiah leaderboard '+nm+' #'+(i+1));await save(u)
  win.push({rank:i+1,u:mask(u.email),prize,trx:r.trx,spent:r.spent})}
 const res={start:prev,at:Date.now(),metric:w.metric,winners:win}
 await kv.set(kind+':'+prev,res);await kv.set(kind+':last',res);globalThis.__lb=null
 if(win.length)await notify({i:'🏆',t:'Juara leaderboard '+nm,st:'ok',rows:win.map(x=>['#'+x.rank+' '+x.u,rp(x.prize)+' · '+x.trx+' trx']),note:'Hadiah sudah masuk ke saldo masing-masing. Selamat!'})
 return res}
export const payWeekly=()=>payPeriod('wk')
export const payMonthly=()=>payPeriod('mo')

// Harga jual = modal + markup (umum atau per server) + tambahan Rp per server, dibulatkan ke atas sesuai pengaturan admin.
// Rumus yang sama dengan di app/api/[...p]/route.js (dipakai bot Telegram).
export const sellPrice=(cfg,sv,x)=>{const o=(cfg.mks||{})[sv]||{},pct=o.pct==null?(+cfg.markup||0):+o.pct,st=+cfg.mkRound||0;let v=Math.ceil(x*(1+pct/100))+(+o.flat||0);if(st>1)v=Math.ceil(v/st)*st;return v}
