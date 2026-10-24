// ===========================================================================
// QRIS GATEWAY (Artapedia Pay) — produk terpisah dari toko nokos.
// Tiap pengguna bisa punya satu "akun gateway": API key sendiri, saldo sendiri,
// buat QRIS dinamis, dana masuk otomatis, lalu ditarik MANUAL (disetujui admin).
//
// Mesin QRIS = SMP Payment (lib/smp.js): QRIS statis admin -> QRIS dinamis + kode unik,
// pelunasan lewat callback /api/callbackqris/<SMP_SECRET> (tagihan ditandai meta {kind:'pay',uid}).
// Keuntungan pemilik situs: fee QRIS (cfg.pay.fee %, default 2) yang dipotong tiap QRIS lunas,
// plus biaya tarik dana (cfg.pay.wdPct %, default 3) dan kode unik SMP.
//
// Tarik dana INSTAN (DANA, biaya tetap instFee): dikirim otomatis lewat H2H AgenH2H (lib/h2h.js), tanpa menunggu admin.
//   Saldo dipotong (nominal + biaya) -> provider dipanggil -> BERHASIL: sukses | GAGAL jelas: saldo kembali otomatis |
//   belum pasti (timeout/pending): status 'processing' menunggu admin memastikan (ACC atau tolak). Tidak pernah refund otomatis kalau hasilnya tidak pasti.
//
// Tarik dana MANUAL: user mengajukan -> status 'pending' (saldo langsung dipotong) ->
// admin ACC (status 'success') atau TOLAK (status 'rejected', saldo dikembalikan).
//
// Penyimpanan (terpisah dari dokumen pengguna supaya tidak mengganggu saldo nokos):
//   pay:<uid>   -> akun gateway {key,secret,ipw,hook,balance,dep[],wd[]}
//   payk:<key>  -> uid   (pencarian cepat saat request API masuk)
//   payidx      -> daftar uid yang punya akun gateway (untuk panel admin)
//   paywd:<id>  -> uid   (pencarian cepat saat admin acc/tolak WD)
//   paywdq      -> antrean WD pending "id|uid" (untuk panel admin)
// ===========================================================================
import crypto from 'crypto'
import {kv} from './db'
import {checkUrl,sign} from './webhook'
import {smpCreate,smpCancel,smpReady,PAID,EXP_MIN} from './smp'
import {payNotify} from './paynotif'
import {instProducts,instNominals,normDana,h2hReady,h2hSend,h2hStatus} from './h2h'
export {instNominals}

// Daftar tujuan tarik dana. Admin bisa mematikan/menyalakan tiap metode (cfg.pay.wdMethods = {KODE:bool}).
export const WD_METHODS=[
 {code:'DANA',name:'DANA',type:'ewallet'},{code:'OVO',name:'OVO',type:'ewallet'},{code:'GOPAY',name:'GoPay',type:'ewallet'},
 {code:'SHOPEEPAY',name:'ShopeePay',type:'ewallet'},{code:'LINKAJA',name:'LinkAja',type:'ewallet'},
 {code:'BCA',name:'Bank BCA',type:'bank'},{code:'BRI',name:'Bank BRI',type:'bank'},{code:'BNI',name:'Bank BNI',type:'bank'},
 {code:'MANDIRI',name:'Bank Mandiri',type:'bank'},{code:'BSI',name:'Bank BSI',type:'bank'},{code:'SEABANK',name:'SeaBank',type:'bank'},
 {code:'JAGO',name:'Bank Jago',type:'bank'}]

export const PAY_DEF={on:true,name:'Artapedia Pay',fee:2,feeFlat:0,min:1000,max:10000000,
 wdOn:true,wdMin:5000,wdMax:10000000,wdPct:3,wdFee:0,wdMethods:{},instOn:true,instFee:2000,expMin:EXP_MIN,v2:true}
// Konfigurasi lama (AustinPay: fee 0.7%, tarik minimal 10rb, tanpa persen) otomatis memakai standar baru
// sampai admin menyimpan pengaturan sekali (penyimpanan menandai v2).
export const payCfg=c=>{const o=(c&&c.pay)||{},r={...PAY_DEF,...o}
 if(!o.v2){r.fee=PAY_DEF.fee;r.wdMin=PAY_DEF.wdMin;r.wdFee=0;r.wdPct=PAY_DEF.wdPct;r.wdMax=PAY_DEF.wdMax;r.min=Math.min(+o.min||PAY_DEF.min,PAY_DEF.min)||PAY_DEF.min}
 r.wdMethods=(o.wdMethods&&typeof o.wdMethods==='object')?o.wdMethods:{}
 r.expMin=EXP_MIN
 return r}
export const wdMethodList=cfg=>{const p=payCfg(cfg)
 return WD_METHODS.map(m=>({...m,on:p.wdMethods[m.code]!==false}))}

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
// amount = nominal yang diminta merchant. Pembeli membayar `total` = amount + kode unik SMP (1-999).
// `net` (amount - fee layanan) yang masuk saldo merchant. Kode unik jadi pendapatan pemilik situs.
export const GRACE_MS=20*60000                         // pembayaran telat sampai 20 menit setelah kedaluwarsa tetap diterima
const QRIMG=q=>'https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=10&data='+encodeURIComponent(q)
export async function createQris(cfg,uid,amount,via='web'){
 const p=payCfg(cfg)
 if(!p.on)throw Error('QRIS Gateway sedang dinonaktifkan admin')
 amount=Math.floor(+amount||0)
 if(!(amount>=p.min&&amount<=p.max))throw Error(`Nominal minimal Rp${(+p.min).toLocaleString('id-ID')} dan maksimal Rp${(+p.max).toLocaleString('id-ID')}`)
 if(!await smpReady())throw Error('SMP Payment belum dikonfigurasi admin (admin > Integrasi > SMP Payment)')
 const acc=await getAcc(uid)
 if(!acc.on)throw Error('Akun gateway kamu sedang dinonaktifkan admin')
 if((acc.dep||[]).filter(x=>x.status==='pending').length>=5)throw Error('Terlalu banyak QRIS yang belum dibayar. Batalkan salah satu dulu.')
 const fee=feeOf(cfg,amount)
 if(amount-fee<=0)throw Error('Nominal terlalu kecil setelah biaya layanan')
 const d=await smpCreate(amount,{kind:'pay',uid})
 const rec={id:txid(),ref:String(d.id),amount,fee,net:amount-fee,
  total:Math.floor(+d.total||amount),gwFee:0,unique:Math.floor(+d.fee||0),
  qr:d.qr||'',qrImg:d.qrImg||(d.qr?QRIMG(d.qr):''),exp:d.exp||null,expMs:toMs(d.exp),
  status:'pending',credited:false,at:Date.now(),via,tok:crypto.randomBytes(6).toString('hex')}
 await mutate(uid,a=>{a.dep.unshift(rec);return true})
 await kv.set('payref:'+rec.ref,uid);await kv.set('payrcp:'+rec.id,uid)
 await kv.sadd('paypend',rec.ref+'|'+uid)
 payNotify('dep.pending',uid,rec)
 return rec}
export const toMs=v=>{if(v==null||v==='')return 0;if(typeof v==='number')return v<1e12?v*1000:v;const t=Date.parse(v);return isNaN(t)?0:t}

// Cek status satu QRIS (penanda lunas dari callback SMP) dan terapkan hasilnya. Aman dipanggil berbarengan & berulang.
export async function checkQris(cfg,uid,id){
 const acc=await getAcc(uid)
 const rec=(acc.dep||[]).find(x=>x.id===id||x.ref===id)
 if(!rec)return null
 if(rec.status!=='pending')return rec
 let st='pending'
 if(await kv.get(PAID(rec.ref)))st='paid'
 else if(rec.expMs&&Date.now()>rec.expMs+GRACE_MS)st='expired'
 const out=await applyQris(cfg,uid,rec.id,st)
 if(st==='expired'){try{await smpCancel({id:rec.ref,total:rec.total})}catch(e){}}
 return out}

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
 if(out==='paid')payNotify('dep.paid',uid,rec)
 if(out==='paid')fireHook(uid,'qris.paid',{transaction_id:rec.id,reference:rec.ref,amount:rec.amount,fee:rec.fee,net:rec.net,
  total_paid:rec.total,status:'paid',paid_at:new Date(rec.paidAt).toISOString()}).catch(()=>{})
 else fireHook(uid,'qris.'+out,{transaction_id:rec.id,reference:rec.ref,amount:rec.amount,status:rec.status}).catch(()=>{})
 return rec}

// Dipanggil callback SMP saat pembayaran masuk. Nominal HARUS sama persis dengan total tagihan.
// Pembayaran telat (tagihan sudah kedaluwarsa) tetap dikreditkan selama belum dibatalkan pengguna.
export async function paidBySmp(uid,ref,nominal,info){
 const acc=await peek(uid);const rec=acc&&(acc.dep||[]).find(x=>x.ref===ref)
 if(!rec||rec.total!==nominal)return {ok:false}
 if(rec.status==='canceled')return {ok:false}
 await kv.set(PAID(ref),info)                           // tandai LUNAS dulu: cron/sapuan ikut bisa mengkreditkan
 try{
  const {a,out}=await mutate(uid,x=>{
   const r=(x.dep||[]).find(y=>y.ref===ref);if(!r)return false
   if(r.status==='paid')return 'dup'
   if(!r.credited){r.credited=true;x.balance=Math.round((+x.balance||0)+r.net)
    x.inSum=(+x.inSum||0)+r.amount;x.feeSum=(+x.feeSum||0)+r.fee}
   r.status='paid';r.paidAt=Date.now();r.rrn=String(info&&info.rrn||'').slice(0,80);return 'paid'})
  if(out==='paid'){
   const r=a.dep.find(y=>y.ref===ref)
   try{await kv.srem('paypend',ref+'|'+uid)}catch(e){}
   payNotify('dep.paid',uid,r)
   fireHook(uid,'qris.paid',{transaction_id:r.id,reference:r.ref,amount:r.amount,fee:r.fee,net:r.net,
    total_paid:r.total,status:'paid',paid_at:new Date(r.paidAt).toISOString()}).catch(()=>{})}
  return {ok:true}}
 catch(e){return {ok:true,busy:false,late:true}}}       // PAID sudah tersimpan; sapuan cron mengkreditkan

export async function cancelQris(cfg,uid,id){
 const acc=await getAcc(uid),rec=(acc.dep||[]).find(x=>x.id===id||x.ref===id)
 if(!rec)throw Error('Transaksi tidak ditemukan')
 if(rec.status!=='pending')throw Error('Transaksi ini sudah '+rec.status+', tidak bisa dibatalkan')
 // cek dulu: kalau ternyata sudah dibayar, saldo tetap dikreditkan dan pembatalan ditolak
 if(await kv.get(PAID(rec.ref))){await applyQris(cfg,uid,rec.id,'paid');throw Error('QRIS ini ternyata sudah dibayar, saldo sudah masuk')}
 try{await smpCancel({id:rec.ref,total:rec.total})}catch(e){}
 return applyQris(cfg,uid,rec.id,'canceled')}

// ---------- tarik dana MANUAL (diajukan user, diproses admin) ----------
// Saldo dipotong sebesar `nominal` saat diajukan. Yang diterima = nominal - biaya (persen + tetap).
export const wdFeeOf=(cfg,nominal)=>{const p=payCfg(cfg)
 return Math.max(0,Math.min(nominal,Math.round(nominal*(+p.wdPct||0)/100)+Math.max(0,Math.floor(+p.wdFee||0))))}
export const WD_NOTE='WD kamu sedang diproses. Dana masuk antara 10 menit sampai 2 jam, tergantung admin sedang sibuk atau tidak. Setelah masuk ke status pending, statusnya akan berubah menjadi sukses. Terima kasih, mohon pengertiannya 🙏'

export async function withdraw(cfg,uid,b){
 if(b&&(b.instant===true||b.instant===1||/^(true|1|yes|ya)$/i.test(String(b.instant||''))||String(b.mode||'').toLowerCase()==='instant'))return instantWithdraw(cfg,uid,b)
 const p=payCfg(cfg)
 if(!p.wdOn)throw Error('Penarikan dana sedang dinonaktifkan admin')
 const code=String(b.method||b.wallet||'').trim().toUpperCase()
 const m=wdMethodList(cfg).find(x=>x.code===code)
 if(!m)throw Error('Metode tujuan tidak dikenal')
 if(!m.on)throw Error('Penarikan ke '+m.name+' sedang dinonaktifkan admin')
 const dest=String(b.account||b.phone||'').replace(/\s|-/g,'')
 if(!/^[0-9]{5,20}$/.test(dest))throw Error('Nomor tujuan harus 5-20 digit angka')
 const nm=String(b.account_name||b.name||'').replace(/[\u0000-\u001f<>]/g,' ').trim().slice(0,60)
 if(nm.length<2)throw Error('Isi nama pemilik rekening / akun tujuan')
 const nominal=Math.floor(+b.nominal||0)
 if(!(nominal>=p.wdMin&&nominal<=p.wdMax))throw Error(`Nominal tarik minimal Rp${(+p.wdMin).toLocaleString('id-ID')} dan maksimal Rp${(+p.wdMax).toLocaleString('id-ID')}`)
 const fee=wdFeeOf(cfg,nominal)
 if(nominal-fee<=0)throw Error('Nominal terlalu kecil setelah biaya tarik')
 const rec={id:txid(),method:m.code,methodName:m.name,type:m.type,dest,destName:nm,nominal,fee,net:nominal-fee,total:nominal,
  status:'pending',at:Date.now(),msg:'',note:WD_NOTE}
 // saldo dipotong DULU supaya tidak bisa ditarik dobel; satu tulis atomik
 const {out}=await mutate(uid,a=>{
  if(!a.on)return 'off'
  if((a.wd||[]).filter(x=>x.status==='pending'||x.status==='processing').length>=5)return 'many'
  if((+a.balance||0)<nominal)return false
  a.balance=Math.round((+a.balance||0)-nominal);a.wd.unshift(rec);return true})
 if(out==='off')throw Error('Akun gateway kamu sedang dinonaktifkan admin')
 if(out==='many')throw Error('Masih ada 5 penarikan yang menunggu diproses. Tunggu salah satu selesai dulu.')
 if(out===false)throw Error('Saldo gateway tidak cukup. Saldo kamu Rp'+(+(await getAcc(uid)).balance||0).toLocaleString('id-ID'))
 await kv.set('paywd:'+rec.id,uid);await kv.sadd('paywdq',rec.id+'|'+uid)
 payNotify('wd.pending',uid,rec)
 fireHook(uid,'withdraw.pending',{transaction_id:rec.id,method:rec.method,destination:dest,nominal,fee,net:rec.net,status:'pending'}).catch(()=>{})
 return rec}

// ---------- tarik dana INSTAN (DANA via H2H AgenH2H) ----------
export const INST_NOTE={
 success:'Penarikan instan berhasil. Dana sudah dikirim ke DANA kamu.',
 rejected:'Penarikan instan gagal dikirim. Saldo kamu sudah dikembalikan.',
 processing:'Penarikan instan sedang dipastikan. Saldo sudah terpotong. Kalau gagal, saldo dikembalikan. Mohon tunggu dan jangan ajukan ulang.'}
export const wdMsg=r=>r.instant?(INST_NOTE[r.status]||INST_NOTE.processing):WD_NOTE
export const instFeeOf=cfg=>Math.max(0,Math.floor(+payCfg(cfg).instFee||0))

export async function instantWithdraw(cfg,uid,b){
 const p=payCfg(cfg)
 if(!p.wdOn)throw Error('Penarikan dana sedang dinonaktifkan admin')
 if(p.instOn===false)throw Error('Penarikan instan sedang dinonaktifkan admin')
 if(!await h2hReady())throw Error('Penarikan instan belum siap. Hubungi admin atau pakai penarikan biasa.')
 const dm=wdMethodList(cfg).find(x=>x.code==='DANA');if(dm&&!dm.on)throw Error('Penarikan ke DANA sedang dinonaktifkan admin')
 const dest=normDana(b.account||b.phone)
 if(!dest)throw Error('Nomor DANA tidak valid. Contoh: 081234567890')
 const nominal=Math.floor(+b.nominal||0),prods=await instProducts(),kode=prods[nominal]
 if(!kode)throw Error('Nominal penarikan instan yang tersedia: Rp'+(await instNominals()).map(n=>n.toLocaleString('id-ID')).join(', Rp'))
 const nm=String(b.account_name||b.name||'').replace(/[\u0000-\u001f<>]/g,' ').trim().slice(0,60)||'Penerima DANA'
 const fee=instFeeOf(cfg),total=nominal+fee
 // idtrx unik & numerik (detik + urutan): provider menolak idtrx kembar, jadi satu catatan tidak bisa terkirim dua kali
 const idtrx=String(Math.floor(Date.now()/1000))+String((+await kv.incr('h2h:seq')||0)%1000).padStart(3,'0')
 const rec={id:txid(),method:'DANA',methodName:'DANA (Instan)',type:'ewallet',dest,destName:nm,nominal,fee,net:nominal,total,
  status:'processing',instant:true,h2h:{kode,idtrx},at:Date.now(),msg:'',note:INST_NOTE.processing}
 // saldo dipotong DULU (nominal + biaya) dalam satu tulis atomik, baru provider dipanggil
 const {out}=await mutate(uid,a=>{
  if(!a.on)return 'off'
  if((a.wd||[]).filter(x=>x.status==='pending'||x.status==='processing').length>=5)return 'many'
  if((+a.balance||0)<total)return false
  a.balance=Math.round((+a.balance||0)-total);a.wd.unshift(rec);return true})
 if(out==='off')throw Error('Akun gateway kamu sedang dinonaktifkan admin')
 if(out==='many')throw Error('Masih ada 5 penarikan yang menunggu diproses. Tunggu salah satu selesai dulu.')
 if(out===false)throw Error('Saldo gateway tidak cukup. Dibutuhkan Rp'+total.toLocaleString('id-ID')+' (nominal + biaya instan). Saldo kamu Rp'+(+(await getAcc(uid)).balance||0).toLocaleString('id-ID'))
 await kv.set('paywd:'+rec.id,uid);await kv.sadd('paywdq',rec.id+'|'+uid)
 await kv.set('h2hid:'+idtrx,uid+'|'+rec.id)          // supaya laporan provider (Report URL) bisa dicocokkan ke catatan ini
 const r=await h2hSend({kode,tujuan:dest,idtrx})
 return settleInstant(uid,rec.id,r)}

// Terapkan hasil provider ke catatan. Idempoten: hanya catatan berstatus 'processing' yang bisa berubah.
async function settleInstant(uid,id,r){
 const hv=(w,ev,x)=>fireHook(uid,ev,{transaction_id:w.id,method:'DANA',instant:true,destination:w.dest,nominal:w.nominal,fee:w.fee,net:w.net,total:w.total,status:x,sn:w.sn||'',message:w.msg||''}).catch(()=>{})
 if(r.state==='unknown'){
  const {a,out}=await mutate(uid,x=>{const w=(x.wd||[]).find(y=>y.id===id);if(!w||w.status!=='processing')return false
   w.h2hText=String(r.text||'').slice(0,200);w.checkAt=Date.now();return true})
  const w=a.wd.find(y=>y.id===id)
  if(out&&w){payNotify('wd.pending',uid,w);hv(w,'withdraw.processing','processing')}
  return w||null}
 const ok=r.state==='success'
 const {a,out}=await mutate(uid,x=>{
  const w=(x.wd||[]).find(y=>y.id===id);if(!w)return 'none'
  if(w.status!=='processing')return 'done'
  w.doneAt=Date.now();w.h2hText=String(r.text||'').slice(0,200);w.note=ok?INST_NOTE.success:INST_NOTE.rejected
  if(ok){w.status='success';w.sn=r.sn||'';w.cost=+r.cost||0;w.msg='';x.outSum=(+x.outSum||0)+w.total;return 'success'}
  w.status='rejected';w.msg='Gagal dikirim ke DANA. Saldo dikembalikan.'
  if(!w.refunded){w.refunded=true;x.balance=Math.round((+x.balance||0)+w.total)}
  return 'rejected'})
 const w=a.wd.find(y=>y.id===id)
 if(out==='none'||out==='done')return w||null
 try{await kv.srem('paywdq',id+'|'+uid)}catch(e){}
 payNotify(out==='success'?'wd.success':'wd.rejected',uid,w);hv(w,'withdraw.'+out,out)
 return w}

// Laporan status akhir dari provider (Report URL). Hanya laporan JELAS (success / failed) yang mengubah catatan 'processing'.
// Idempoten. Kalau catatan sudah selesai dan laporannya BERTENTANGAN (mis. kita sudah refund tapi provider bilang berhasil),
// tidak ada yang diubah: hanya ditandai conflict supaya admin memeriksa manual.
export async function applyH2hReport(idtrx,r){
 const ref=await kv.get('h2hid:'+idtrx);if(!ref)return {matched:false}
 const [uid,id]=String(ref).split('|'),acc=await peek(uid),w=acc&&(acc.wd||[]).find(x=>x.id===id)
 if(!w)return {matched:false}
 if(r.state==='unknown')return {matched:true,applied:false,status:w.status}
 if(w.status==='processing'){const out=await settleInstant(uid,id,r);return {matched:true,applied:true,status:out&&out.status,w:out}}
 const sama=(r.state==='success'&&w.status==='success')||(r.state==='failed'&&w.status==='rejected')
 return {matched:true,applied:false,status:w.status,conflict:!sama,w}}

// Daftar WD untuk panel admin: semua pending + 40 yang sudah selesai terbaru.
export async function adminWdList(){
 const ids=(await kv.get('payidx'))||[]
 const accs=(await Promise.all(ids.map(i=>peek(i)))).filter(Boolean)
 const rows=[]
 for(const a of accs)for(const w of (a.wd||[]))rows.push({...wdView(w),uid:a.uid,balance:+a.balance||0,at:w.at,doneAt:w.doneAt||0,h2h_text:w.h2hText||'',cost:+w.cost||0})
 const pend=rows.filter(x=>x.status==='pending'||x.status==='processing').sort((x,y)=>x.at-y.at)
 const done=rows.filter(x=>x.status!=='pending').sort((x,y)=>(y.doneAt||y.at)-(x.doneAt||x.at)).slice(0,40)
 return {pending:pend,done}}

// Admin menyetujui (ok) atau menolak (no) satu WD. Idempoten: hanya WD berstatus pending yang bisa diproses.
export async function adminWdAct(id,act,note){
 const uid=await kv.get('paywd:'+id);if(!uid)throw Error('Penarikan tidak ditemukan')
 const {a,out}=await mutate(uid,x=>{
  const w=(x.wd||[]).find(y=>y.id===id);if(!w)return 'none'
  if(w.status!=='pending'&&w.status!=='processing')return 'done'
  // penarikan instan yang baru diajukan masih dalam proses ke provider: beri waktu supaya tidak tabrakan
  if(w.instant&&Date.now()-(w.at||0)<120000)return 'wait'
  w.doneAt=Date.now();w.msg=String(note||'').slice(0,120)
  if(w.instant)w.note=act==='ok'?INST_NOTE.success:INST_NOTE.rejected
  if(act==='ok'){w.status='success';x.outSum=(+x.outSum||0)+(+w.total||+w.nominal||0);return 'success'}
  w.status='rejected'
  if(!w.refunded){w.refunded=true;x.balance=Math.round((+x.balance||0)+w.total)}
  return 'rejected'})
 if(out==='none')throw Error('Penarikan tidak ditemukan')
 if(out==='done')throw Error('Penarikan ini sudah diproses sebelumnya')
 if(out==='wait')throw Error('Penarikan instan ini baru saja diajukan dan sistem masih menghubungi provider. Coba lagi 2 menit lagi.')
 try{await kv.srem('paywdq',id+'|'+uid)}catch(e){}
 const w=a.wd.find(y=>y.id===id)
 payNotify(out==='success'?'wd.success':'wd.rejected',uid,w)
 fireHook(uid,'withdraw.'+out,{transaction_id:w.id,method:w.method,instant:!!w.instant,destination:w.dest,nominal:w.nominal,fee:w.fee,net:w.net,status:out,message:w.msg||''}).catch(()=>{})
 return {uid,w,balance:+a.balance||0}}

// ---------- webhook ke merchant ----------
export const setIpw=(uid,list)=>mutate(uid,x=>{x.ipw=list;return true})
export const setOn=(uid,on)=>mutate(uid,x=>{x.on=!!on;return true})
// Admin menambah / mengurangi saldo gateway sebuah merchant.
// delta negatif tidak boleh membuat saldo minus — permintaan seperti itu ditolak,
// supaya tidak ada merchant yang bisa menarik dana yang tidak pernah ada.
export async function adminSaldo(uid,delta,note){
 const n=Math.round(+delta||0);if(!n)throw Error('Nominal harus lebih dari 0')
 // uid WAJIB sudah punya akun gateway, supaya salah ketik tidak membuat akun baru diam-diam
 const ada=await peek(uid);if(!ada)throw Error('Akun gateway tidak ditemukan')
 const {a,out}=await mutate(uid,x=>{
  const bal=Math.round((+x.balance||0)+n)
  if(bal<0)return false
  x.balance=bal
  x.adm=[{amt:n,bal,note:String(note||'').slice(0,80),at:Date.now()},...(x.adm||[])].slice(0,200)
  return true})
 if(out===false)throw Error('Saldo merchant tidak cukup untuk dikurangi sebanyak itu')
 return a}
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
   processing:w.filter(x=>x.status==='pending'||x.status==='processing').length},
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
export const wdView=r=>({transaction_id:r.id,method:r.method||r.wallet||'',method_name:r.methodName||r.wallet||'',
 destination:r.dest,account_name:r.destName||'',nominal:r.nominal,fee:r.fee,net:r.net!=null?r.net:Math.max(0,(r.nominal||0)-(r.fee||0)),
 total:r.total,status:r.status,message:r.msg||'',instant:!!r.instant,sn:r.sn||'',
 created_at:new Date(r.at).toISOString(),processed_at:r.doneAt?new Date(r.doneAt).toISOString():null})

// Susulan untuk webhook yang tidak datang: tanya status penarikan instan yang masih 'processing' > 3 menit ke AgenH2H.
// Hanya hasil JELAS (berhasil / gagal / ref_id tidak tercatat) yang mengubah catatan; selain itu dibiarkan untuk admin.
export async function sweepInstant(deadline){
 const list=((await kv.get('paywdq'))||[]).map(e=>String(e).split('|')).filter(x=>x[0]&&x[1])
 let checked=0,settled=0
 for(const [id,uid] of list){
  if(Date.now()>deadline)break
  try{
   const acc=await peek(uid),w=acc&&(acc.wd||[]).find(x=>x.id===id)
   if(!w||!w.instant||w.status!=='processing'||!w.h2h||!w.h2h.idtrx||Date.now()-(w.at||0)<180000)continue
   checked++
   const r=await h2hStatus(w.h2h.idtrx)
   if(r.state==='unknown'){await mutate(uid,x=>{const y=(x.wd||[]).find(z=>z.id===id);if(!y||y.status!=='processing')return false;y.h2hText=String(r.text||'').slice(0,200);y.checkAt=Date.now();return true});continue}
   const o=await settleInstant(uid,id,r);if(o&&o.status!=='processing')settled++
  }catch(e){}}
 return {checked,settled}}
