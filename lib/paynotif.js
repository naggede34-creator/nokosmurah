// ===========================================================================
// Notifikasi QRIS Gateway (Artapedia Pay): tagihan QRIS dibuat (pending), QRIS lunas, tarik dana
// diajukan (pending), tarik dana berhasil / ditolak.
//   1) Channel Telegram admin  -> kartu notifikasi + FOTO STRUK. Data penting DISENSOR.
//   2) HP pemilik akun gateway (Web Push) -> ringkasan singkat.
// Tidak pernah melempar & tidak menahan transaksi: dipanggil lewat bg() (latar belakang).
// ===========================================================================
import {kv} from './db'
import {notify,mask,rp} from './telegram'
import {strukPng} from './strukimg'
import {push as pushSend,keyUser} from './push'
import {bg} from './bg'

const FOOT='Artapedia Pay · QRIS Gateway'
// Sensor: nomor tujuan -> 0812••••789, nama -> Bu*** Sa***, ID panjang tetap utuh (bukan rahasia, dipakai admin untuk ACC)
export const maskNum=s=>{s=String(s||'').replace(/\s/g,'');return s.length<=6?s.slice(0,2)+'••••':s.slice(0,4)+'•'.repeat(Math.max(3,s.length-7))+s.slice(-3)}
export const maskName=s=>String(s||'').trim().split(/\s+/).filter(Boolean).slice(0,3).map(w=>w.length<=2?w[0]+'*':w.slice(0,2)+'***').join(' ')||'-'
const wibS=ms=>ms?new Date(ms).toLocaleString('id-ID',{timeZone:'Asia/Jakarta',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).replace('.',':')+' WIB':'-'

async function who(uid){
 try{const u=await kv.get('u:'+uid);return {email:u&&u.email?mask(u.email):'-',name:u&&u.name?maskName(u.name):''}}catch(e){return {email:'-',name:''}}}

// event: dep.pending | dep.paid | wd.pending | wd.success | wd.rejected
export async function payNotifyNow(event,uid,r,host='artapedia.id'){
 try{
  const w=await who(uid),isDep=event.startsWith('dep.')
  let n,pt,pb,img=null
  if(isDep){
   const paid=event==='dep.paid'
   const item={transaction_id:r.id,amount:r.amount,total_paid:r.total,fee:r.fee,net:r.net,status:paid?'paid':'pending',created_at:r.at}
   img=await strukPng(item,'qris',host)
   n={i:paid?'💎':'🧾',t:paid?'QRIS Gateway · Pembayaran diterima':'QRIS Gateway · Tagihan baru',st:paid?'ok':'pending',id:['ID Transaksi',r.id],
    rows:[['Merchant',w.email],['Nominal tagihan',rp(r.amount)],[paid?'Dibayar pembeli':'Harus dibayar',rp(r.total)],['Biaya layanan',rp(r.fee)],['Masuk saldo',rp(r.net)],
     ['Metode','QRIS'],['Dibuat via',r.via==='api'?'API':'Web'],...(paid?[['Dibayar',wibS(r.paidAt)]]:[['Kedaluwarsa',wibS(r.expMs)]])],
    note:paid?'Saldo gateway merchant sudah bertambah otomatis.':'Menunggu pembeli membayar. Saldo masuk otomatis setelah lunas.'}
   pt=paid?'💎 QRIS lunas · '+rp(r.net):'🧾 Tagihan QRIS dibuat · '+rp(r.amount)
   pb=paid?`Dibayar ${rp(r.total)} · masuk saldo ${rp(r.net)}`:`Harus dibayar ${rp(r.total)}`
  }else{
   const st=event==='wd.success'?'success':event==='wd.rejected'?'rejected':'pending'
   const item={transaction_id:r.id,method_name:r.methodName||r.method,destination:r.dest,account_name:maskName(r.destName),nominal:r.nominal,fee:r.fee,net:r.net,total:r.total,status:st,created_at:r.at}
   img=await strukPng(item,'withdraw',host)
   n={i:st==='success'?'✅':st==='rejected'?'🚫':'🏧',t:st==='success'?'Gateway · Dana berhasil ditarik':st==='rejected'?'Gateway · Tarik dana ditolak':'Gateway · Permintaan tarik dana',
    st:st==='success'?'ok':st==='rejected'?'fail':'pending',id:['ID Penarikan',r.id],
    rows:[['Merchant',w.email],['Tujuan',r.methodName||r.method],['Nomor tujuan',maskNum(r.dest)],['Atas nama',maskName(r.destName)],
     ['Nominal tarik',rp(r.nominal)],['Biaya tarik',rp(r.fee)],['Diterima',rp(r.net)],...(r.msg?[['Catatan',String(r.msg).slice(0,80)]]:[])],
    note:st==='success'?'Dana sudah dikirim ke tujuan.':st==='rejected'?'Saldo gateway dikembalikan otomatis ke merchant.':'Saldo sudah dipotong. Buka /admin > Gateway untuk ACC atau tolak.'}
   pt=st==='success'?'✅ Tarik dana berhasil · '+rp(r.net):st==='rejected'?'🚫 Tarik dana ditolak · saldo kembali':'🏧 Tarik dana diproses · '+rp(r.nominal)
   pb=st==='success'?`Dikirim ke ${r.methodName||r.method} ${maskNum(r.dest)}`:st==='rejected'?(r.msg?String(r.msg).slice(0,100):'Saldo gateway sudah dikembalikan'):`Ke ${r.methodName||r.method} ${maskNum(r.dest)} · menunggu admin`}
  await notify({...n,photo:img||undefined,photoName:'struk-'+r.id+'.png',foot:FOOT}).catch(()=>{})
  await pushSend(keyUser(uid),{t:pt,b:pb,u:'/pay/riwayat',tag:'pay-'+r.id,ring:1}).catch(()=>{})
 }catch(e){}}
export const payNotify=(event,uid,r,host)=>{try{bg(payNotifyNow(event,uid,r,host))}catch(e){}}
