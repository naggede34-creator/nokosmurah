// ===========================================================================
// QRIS GATEWAY (Artapedia Pay) — produk terpisah dari toko nokos.
// Tiap pengguna bisa punya satu "akun gateway": API key sendiri, saldo sendiri,
// buat QRIS dinamis, dana masuk otomatis, lalu ditarik ke e-wallet / bank.
//
// Mesin di belakangnya AustinPay (lib/austin.js). Keuntungan pemilik situs datang dari
// biaya layanan yang dipotong tiap QRIS lunas (cfg.pay.fee % + cfg.pay.feeFlat rupiah)
// dan tambahan biaya tarik dana (cfg.pay.wdFee).
//
// Penyimpanan (terpisah dari dokumen pengguna supaya tidak mengganggu saldo nokos):
//   pay:<uid>   -> akun gateway {key,secret,ipw,hook,balance,dep[],wd[]}
//   payk:<key>  -> uid   (pencarian cepat saat request API masuk)
//   payidx      -> daftar uid yang punya akun gateway (untuk panel admin)
// ===========================================================================
import crypto from 'crypto'
import {kv} from './db'
import {checkUrl,sign} from './webhook'
import * as A from './austin'

export const PAY_DEF={on:true,name:'Artapedia Pay',fee:0.7,feeFlat:0,min:1000,max:10000000,
 wdMin:10000,wdFee:0,wdOn:true,expMin:10}
export const payCfg=c=>({...PAY_DEF,...((c||{}).pay||{})})

const KEY=u=>'pay:'+u, IDX='payidx'
export const newKey=()=>'apay_live_'+crypto.randomBytes(20).toString('hex')
export const newSec=()=>'apay_sec_'+crypto.randomBytes(24).toString('hex')
export const txid=()=>'APY-'+Date.now().toString(36).toUpperCase()+crypto.randomBytes(3).toString('hex').toUpperCase()

const blank=uid=>({uid,on:true,key:newKey(),secret:'',ipw:[],hook:{url:'',secret:'',on:false,last:null},
 balance:0,dep:[],wd:[],inSum:0,outSum:0,feeSum:0,at:Date.now()})

// Ambil akun; dibuat otomatis saat pertama dibuka.
export async function getAcc(uid){
 let a=await kv.get(KEY(uid))
 if(!a){a=blank(uid);await kv.set(KEY(uid),a);await kv.set('payk:'+a.key,uid);await kv.sadd(IDX,uid)}
 return a}
export const peek=uid=>kv.get(KEY(uid))
export async function byKey(key){
 const k=String(key||'').trim();if(!/^apay_live_[a-f0-9]{40}$/.test(k))return null
 const uid=await kv.get('payk:'+k);if(!uid)return null
 const a=await peek(uid);return a&&a.key===k?a:null}

// Perubahan saldo/record selalu lewat sini: baca ulang, ubah, simpan hanya kalau revisi belum berubah.
// fn WAJIB murni & idempoten (tanpa panggilan jaringan) karena bisa diulang saat terjadi tabrakan tulis.
async function mutate(uid,fn){
 for(let i=0;i<6;i++){
  const a=await getAcc(uid),rev=a.__rev||0
  const out=fn(a)
  if(out===false)return {a,out:false}
  a.dep=(a.dep||[]).slice(0,400);a.wd=(a.wd||[]).slice(0,400)
  if(await kv.casSet(KEY(uid),a,rev))return {a,out}
  await new Promise(r=>setTimeout(r,60+i*60))}
 throw Error('Gagal menyimpan data gateway, coba lagi')}

export async function regenKey(uid){
 const old=(await getAcc(uid)).key
 const k=newKey()
 const {a}=await mutate(uid,x=>{x.key=k;return true})
 await kv.set('payk:'+k,uid);if(old&&old!==k)await kv.del('payk:'+old)
 return a}
export async function setSecret(uid,on){
 const s=on?newSec():''
 const {a}=await mutate(uid,x=>{x.secret=s;return true});return {acc:a,secret:s}}

// ---------- biaya ----------
export const feeOf=(cfg,amount)=>{const p=payCfg(cfg)
 return Math.max(0,Math.min(amount,Math.round(amount*(+p.fee||0)/100)+(+p.feeFlat||0)))}

// ---------- QRIS masuk ----------
// amount = nominal yang diminta merchant. AustinPay menambahkan biayanya sendiri di atas itu,
// jadi `total` (yang dibayar pembeli) bisa lebih besar; `net` adalah yang masuk saldo merchant.
export async function createQris(cfg,uid,amount,via='web'){
 const p=payCfg(cfg)
 if(!p.on)throw Error('QRIS Gateway sedang dinonaktifkan admin')
 amount=Math.floor(+amount||0)
 if(!(amount>=p.min&&amount<=p.max))throw Error(`Nominal minimal Rp${(+p.min).toLocaleString('id-ID')} dan maksimal Rp${(+p.max).toLocaleString('id-ID')}`)
 const acc=await getAcc(uid)
 if(!acc.on)throw Error('Akun gateway kamu sedang dinonaktifkan admin')
 if((acc.dep||[]).filter(x=>x.status==='pending').length>=5)throw Error('Terlalu banyak QRIS yang belum dibayar. Batalkan salah satu dulu.')
 const d=(await A.depositCreate(amount)).deposit||{}
 if(!d.transaction_id)throw Error('AustinPay tidak mengembalikan ID transaksi')
 const fee=feeOf(cfg,amount)
 const rec={id:txid(),ref:String(d.transaction_id),amount,fee,net:amount-fee,
  total:Math.floor(+d.amount||amount),gwFee:Math.floor(+d.fee||0),unique:Math.floor(+d.unique_code||0),
  qr:d.qr_string||'',qrImg:d.qr_image||'',exp:d.expired_at||null,expMs:toMs(d.expired_at),
  status:'pending',credited:false,at:Date.now(),via,tok:crypto.randomBytes(6).toString('hex')}
 await mutate(uid,a=>{a.dep.unshift(rec);return true})
 await kv.set('payref:'+rec.ref,uid);await kv.set('payrcp:'+rec.id,uid)
 await kv.sadd('paypend',rec.ref+'|'+uid)
 return rec}
export const toMs=v=>{if(v==null||v==='')return 0;if(typeof v==='number')return v<1e12?v*1000:v;const t=Date.parse(v);return isNaN(t)?0:t}

const ST=s=>{s=String(s||'').toLowerCase();return s==='paid'||s==='success'||s==='completed'?'paid'
 :s==='expired'?'expired':s==='cancel'||s==='canceled'||s==='cancelled'?'canceled':'pending'}

// Cek status satu QRIS ke AustinPay dan terapkan hasilnya. Aman dipanggil berbarengan & berulang.
export async function checkQris(cfg,uid,id){
 const acc=await getAcc(uid)
 const rec=(acc.dep||[]).find(x=>x.id===id||x.ref===id)
 if(!rec)return null
 if(rec.status!=='pending')return rec
 let st='pending'
 try{st=ST((await A.depositCheck(rec.ref)).status)}catch(e){
  if(rec.expMs&&Date.now()>rec.expMs+120000)st='expired';else throw e}
 if(st==='pending'&&rec.expMs&&Date.now()>rec.expMs+120000)st='expired'
 return applyQris(cfg,uid,rec.id,st)}

// Terapkan status ke record + kredit saldo. Idempoten: `credited` dijaga di dalam satu tulis atomik.
export async function applyQris(cfg,uid,id,st){
 const {a,out}=await mutate(uid,acc=>{
  const r=(acc.dep||[]).find(x=>x.id===id);if(!r||r.status!=='pending')return false
  if(st==='paid'){
   if(!r.credited){r.credited=true;acc.balance=Math.round((+acc.balance||0)+r.net)
    acc.inSum=(+acc.inSum||0)+r.amount;acc.feeSum=(+acc.feeSum||0)+r.fee}
   r.status='paid';r.paidAt=Date.now();return 'paid'}
  if(['expired','canceled'].includes(st)){r.status=st;return st}
  return false})
 if(out===false)return (await getAcc(uid)).dep.find(x=>x.id===id)||null
 const rec=a.dep.find(x=>x.id===id)
 try{await kv.srem('paypend',rec.ref+'|'+uid)}catch(e){}
 if(out==='paid')fireHook(uid,'qris.paid',{transaction_id:rec.id,reference:rec.ref,amount:rec.amount,fee:rec.fee,net:rec.net,
  total_paid:rec.total,status:'paid',paid_at:new Date(rec.paidAt).toISOString()}).catch(()=>{})
 else fireHook(uid,'qris.'+out,{transaction_id:rec.id,reference:rec.ref,amount:rec.amount,status:rec.status}).catch(()=>{})
 return rec}

export async function cancelQris(cfg,uid,id){
 const acc=await getAcc(uid),rec=(acc.dep||[]).find(x=>x.id===id||x.ref===id)
 if(!rec)throw Error('Transaksi tidak ditemukan')
 if(rec.status!=='pending')throw Error('Transaksi ini sudah '+rec.status+', tidak bisa dibatalkan')
 // cek dulu: kalau ternyata sudah dibayar, saldo tetap dikreditkan dan pembatalan ditolak
 try{if(ST((await A.depositCheck(rec.ref)).status)==='paid'){await applyQris(cfg,uid,rec.id,'paid');throw Error('QRIS ini ternyata sudah dibayar, saldo sudah masuk')}}
 catch(e){if(/sudah dibayar/.test(e.message))throw e}
 try{await A.depositCancel(rec.ref)}catch(e){}
 return applyQris(cfg,uid,rec.id,'canceled')}

// ---------- tarik dana (otomatis lewat AustinPay instant-withdraw) ----------
export const wallets=()=>A.iwWallets()
export const products=w=>A.iwProducts(w)

export async function withdraw(cfg,uid,b){
 const p=payCfg(cfg)
 if(!p.wdOn)throw Error('Penarikan dana sedang dinonaktifkan admin')
 const wallet=String(b.wallet||'').trim(),code=String(b.product_code||'').trim(),dest=String(b.phone||'').replace(/\s|-/g,'')
 if(!wallet||!code)throw Error('Pilih dompet dan produk tujuan dulu')
 if(!/^[0-9]{5,20}$/.test(dest))throw Error('Nomor tujuan harus 5-20 digit angka')
 // harga: produk nominal tetap -> sell_price dari katalog; bebas nominal -> nominal + fee produk
 const list=(await A.iwProducts(wallet)).products||[]
 const pr=list.find(x=>String(x.code)===code)
 if(!pr)throw Error('Produk tidak ditemukan di dompet '+wallet)
 let nominal,cost
 if(pr.open_denom){
  nominal=Math.floor(+b.nominal||0)
  const lo=Math.max(1,+pr.min||1),hi=+pr.max||1e9
  if(!(nominal>=lo&&nominal<=hi))throw Error(`Nominal harus antara Rp${lo.toLocaleString('id-ID')} - Rp${hi.toLocaleString('id-ID')}`)
  cost=nominal+Math.max(0,+pr.fee||0)}
 else{nominal=Math.floor(+pr.nominal||0);cost=Math.floor(+pr.sell_price||0)
  if(!cost)throw Error('Harga produk tidak tersedia')}
 const extra=Math.max(0,Math.floor(+p.wdFee||0))      // tambahan biaya milik pemilik situs
 const total=cost+extra
 if(nominal<(+p.wdMin||0))throw Error(`Penarikan minimal Rp${(+p.wdMin).toLocaleString('id-ID')}`)
 const rec={id:txid(),wallet,product:code,productName:pr.name||code,dest,nominal,fee:total-nominal,total,
  status:'processing',at:Date.now(),ref:'',msg:''}
 // saldo dipotong DULU supaya tidak bisa ditarik dobel
 const {out}=await mutate(uid,a=>{
  if((+a.balance||0)<total)return false
  if(!a.on)return false
  a.balance=Math.round((+a.balance||0)-total);a.wd.unshift(rec);return true})
 if(out===false){const a=await getAcc(uid)
  throw Error(a.on?'Saldo gateway tidak cukup. Butuh Rp'+total.toLocaleString('id-ID'):'Akun gateway kamu sedang dinonaktifkan admin')}
 // baru kirim ke AustinPay
 let res=null,err=''
 try{res=await A.iwCreate({wallet,product_code:code,phone:dest,...(pr.open_denom?{nominal}:{})})}
 catch(e){err=e.message}
 const st=err?'failed':String((res&&res.status)||'processing').toLowerCase()
 await mutate(uid,a=>{const r=(a.wd||[]).find(x=>x.id===rec.id);if(!r)return false
  r.status=st==='success'?'success':st==='failed'?'failed':'processing'
  r.ref=String((res&&res.id)||'');r.msg=err||String((res&&res.message)||'')
  if(r.status==='failed'&&!r.refunded){r.refunded=true;a.balance=Math.round((+a.balance||0)+r.total)}
  if(r.status==='success')a.outSum=(+a.outSum||0)+r.nominal
  return true})
 const fin=(await getAcc(uid)).wd.find(x=>x.id===rec.id)
 if(fin.status==='failed')throw Error('Penarikan gagal: '+(fin.msg||'ditolak penyedia')+'. Saldo sudah dikembalikan.')
 fireHook(uid,'withdraw.'+fin.status,{transaction_id:fin.id,wallet,destination:dest,nominal,fee:fin.fee,total:fin.total,status:fin.status}).catch(()=>{})
 return fin}

// Sinkron penarikan yang masih diproses (dipanggil cron & saat membuka riwayat)
export async function syncWd(uid){
 const acc=await getAcc(uid)
 const open=(acc.wd||[]).filter(x=>x.status==='processing')
 if(!open.length)return 0
 let h=null;try{h=await A.iwHistory({limit:50})}catch(e){return 0}
 const rows=(h&&h.data)||[];let n=0
 for(const r of open){
  const m=rows.find(x=>String(x.id)===r.ref)
  if(!m)continue
  const st=String(m.status||'').toLowerCase()
  if(st!=='success'&&st!=='failed')continue
  await mutate(uid,a=>{const w=(a.wd||[]).find(x=>x.id===r.id);if(!w||w.status!=='processing')return false
   w.status=st;w.msg=m.provider_response||w.msg
   if(st==='failed'&&!w.refunded){w.refunded=true;a.balance=Math.round((+a.balance||0)+w.total)}
   if(st==='success')a.outSum=(+a.outSum||0)+w.nominal
   return true})
  n++
  fireHook(uid,'withdraw.'+st,{transaction_id:r.id,wallet:r.wallet,destination:r.dest,nominal:r.nominal,status:st}).catch(()=>{})}
 return n}

// ---------- webhook ke merchant ----------
export const setIpw=(uid,list)=>mutate(uid,x=>{x.ipw=list;return true})
export const setOn=(uid,on)=>mutate(uid,x=>{x.on=!!on;return true})
export async function setHook(uid,url,on){
 url=String(url||'').trim()
 if(!url){const {a}=await mutate(uid,x=>{x.hook={...(x.hook||{}),url:'',on:false};return true});return a.hook}
 const c=await checkUrl(url);if(!c.ok)throw Error(c.error)
 const {a}=await mutate(uid,x=>{x.hook={...(x.hook||{}),url:c.url,on:on!==false,secret:(x.hook||{}).secret||('apay_whsec_'+crypto.randomBytes(20).toString('hex'))};return true})
 return a.hook}
export async function hookSecret(uid){
 const {a}=await mutate(uid,x=>{x.hook={...(x.hook||{}),secret:'apay_whsec_'+crypto.randomBytes(20).toString('hex')};return true});return a.hook}
export async function fireHook(uid,event,data){
 const acc=await peek(uid);const h=acc&&acc.hook
 if(!h||!h.on||!h.url||!h.secret)return {ok:false}
 const body=JSON.stringify({event,data,sentAt:new Date().toISOString()})
 const ts=String(Math.floor(Date.now()/1000))
 let res={ok:false,code:0,error:''}
 for(let i=0;i<3&&!res.ok;i++){
  try{const r=await fetch(h.url,{method:'POST',redirect:'manual',signal:AbortSignal.timeout(10000),
    headers:{'Content-Type':'application/json','User-Agent':'ArtapediaPay-Webhook/1.0',
     'X-ArtapediaPay-Event':event,'X-Artapedia-Timestamp':ts,'X-ArtapediaPay-Signature':sign(h.secret,ts,body).replace('sha256=','')},body})
   res={ok:r.status>=200&&r.status<300,code:r.status,error:r.status>=200&&r.status<300?'':'Balasan HTTP '+r.status}}
  catch(e){res={ok:false,code:0,error:String(e.name==='TimeoutError'?'Timeout (10 detik)':e.message||'gagal').slice(0,120)}}
  if(!res.ok&&i<2)await new Promise(r=>setTimeout(r,1000+i*1000))}
 await mutate(uid,x=>{x.hook={...(x.hook||{}),last:{at:Date.now(),ok:res.ok,code:res.code,error:res.error,event}};return true}).catch(()=>{})
 return res}

// ---------- ringkasan ----------
export function summary(acc){
 const d=acc.dep||[],w=acc.wd||[],day=864e5,now=Date.now()
 const paid=d.filter(x=>x.status==='paid')
 const sum=(a,f)=>a.reduce((s,x)=>s+(+f(x)||0),0)
 const since=t=>paid.filter(x=>x.paidAt>=t)
 return {balance:+acc.balance||0,
  today:{count:since(now-day).length,gross:sum(since(now-day),x=>x.amount),net:sum(since(now-day),x=>x.net)},
  month:{count:since(now-30*day).length,gross:sum(since(now-30*day),x=>x.amount),net:sum(since(now-30*day),x=>x.net)},
  all:{count:paid.length,gross:sum(paid,x=>x.amount),net:sum(paid,x=>x.net),fee:sum(paid,x=>x.fee)},
  pending:d.filter(x=>x.status==='pending').length,
  // 'out', bukan 'wd': respons /me juga mengirim array transaksi bernama wd
  out:{count:w.filter(x=>x.status==='success').length,sum:sum(w.filter(x=>x.status==='success'),x=>x.nominal),
   processing:w.filter(x=>x.status==='processing').length},
  chart:[...Array(7)].map((_,i)=>{const s=now-(6-i)*day,e=s+day
   const r=paid.filter(x=>x.paidAt>=s-((new Date(s)).getHours()*0)&&x.paidAt<e)
   return {at:s,count:r.length,sum:sum(r,x=>x.amount)}})}}

// tampilan publik satu transaksi (dipakai API & struk)
// struk publik: hanya data yang aman dibagikan ke pembeli
export const receiptView=(r,merchant)=>({transaction_id:r.id,amount:r.amount,total_paid:r.total,
 status:r.status,created_at:new Date(r.at).toISOString(),paid_at:r.paidAt?new Date(r.paidAt).toISOString():null,
 expired_at:r.exp,qr_string:r.status==='pending'?r.qr:'',qr_image:r.status==='pending'?r.qrImg:'',merchant:merchant||''})
export const depView=r=>({transaction_id:r.id,reference:r.ref,receipt_token:r.tok||'',amount:r.amount,fee:r.fee,net:r.net,
 total_paid:r.total,unique_code:r.unique||0,qr_string:r.qr,qr_image:r.qrImg,status:r.status,
 expired_at:r.exp,created_at:new Date(r.at).toISOString(),paid_at:r.paidAt?new Date(r.paidAt).toISOString():null})
export const wdView=r=>({transaction_id:r.id,wallet:r.wallet,product_code:r.product,product_name:r.productName,
 destination:r.dest,nominal:r.nominal,fee:r.fee,total:r.total,status:r.status,message:r.msg||'',
 created_at:new Date(r.at).toISOString()})
