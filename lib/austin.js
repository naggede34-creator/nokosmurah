// ===========================================================================
// Klien AustinPay — penyedia di belakang layar untuk QRIS Gateway Artapedia.
// Dipakai untuk: membuat QRIS, cek status, batal, dan menarik dana (withdraw instan).
// Kredensial diisi di /admin > Integrasi: AUSTIN_KEY, AUSTIN_SECRET (opsional), AUSTIN_BASE.
//
// Dua cara autentikasi (mengikuti dokumentasi AustinPay):
//  - tanpa secret : API key dikirim lewat ?apikey=
//  - dengan secret: API key lewat header X-API-Key + tanda tangan HMAC-SHA256
//                   payload = METHOD \n PATH(tanpa query) \n BODY \n TIMESTAMP(ms)
//                   dikirim di header X-Signature & X-Timestamp (ditolak kalau selisih > 5 menit)
// Server AustinPay WAJIB mendaftarkan IP server kita di whitelist mereka.
// ===========================================================================
import crypto from 'crypto'
import {getSec} from './settings'

export const AUSTIN_BASE='https://austinstore.id'
const cfg=async()=>{const s=await getSec()
 return {base:(s.AUSTIN_BASE||AUSTIN_BASE).replace(/\/+$/,''),key:s.AUSTIN_KEY||'',secret:s.AUSTIN_SECRET||''}}
export const ready=async()=>!!(await cfg()).key

// Panggil satu endpoint AustinPay. Selalu melempar Error dengan pesan yang bisa dibaca admin.
export async function call(path,{method='GET',body=null,timeout=25000}={}){
 const c=await cfg()
 if(!c.key)throw Error('API key AustinPay belum diisi (admin > Integrasi > AustinPay)')
 const raw=body==null?'':JSON.stringify(body)
 const h={Accept:'application/json'}
 if(raw)h['Content-Type']='application/json'
 let url=c.base+path
 if(c.secret){
  // HMAC aktif: key WAJIB lewat header supaya path yang ditandatangani sama persis dengan yang diverifikasi
  const ts=Date.now().toString()
  h['X-API-Key']=c.key;h['X-Timestamp']=ts
  h['X-Signature']=crypto.createHmac('sha256',c.secret).update(`${method}\n${path.split('?')[0]}\n${raw}\n${ts}`).digest('hex')}
 else url+=(path.includes('?')?'&':'?')+'apikey='+encodeURIComponent(c.key)
 let r,d
 // cache:'no-store' WAJIB (lihat catatan yang sama di lib/providers.js): jawaban GET yang
 // ter-cache membuat status deposit/penarikan terbaca basi.
 try{r=await fetch(url,{method,cache:'no-store',headers:h,body:raw||undefined,signal:AbortSignal.timeout(timeout)})}
 catch(e){throw Error('AustinPay tidak bisa dihubungi: '+e.message)}
 const txt=await r.text().catch(()=>'')
 try{d=txt?JSON.parse(txt):{}}catch(e){throw Error('AustinPay membalas bukan JSON (HTTP '+r.status+')')}
 if(d&&d.success===false)throw Error(d.message||('AustinPay menolak permintaan (HTTP '+r.status+')'))
 if(!r.ok)throw Error((d&&d.message)||msgFor(r.status))
 return d}
const msgFor=s=>s===401?'API key AustinPay tidak valid atau belum aktif'
 :s===403?'IP server ini belum terdaftar di whitelist AustinPay'
 :s===429?'Terlalu banyak permintaan ke AustinPay, coba lagi sebentar'
 :s>=500?'AustinPay sedang gangguan (HTTP '+s+')':'AustinPay menolak permintaan (HTTP '+s+')'

// ---------- akun & mutasi ----------
export const account=()=>call('/api/account')
export const transactions=q=>call('/api/transactions'+qs(q))
export const mutasi=q=>call('/api/mutasi'+qs(q))
export const mutasiLatest=q=>call('/api/mutasi/latest'+qs(q))
export const mutasiAccounts=()=>call('/api/mutasi/accounts')

// ---------- deposit QRIS ----------
// amount = nominal sebelum biaya AustinPay. Respons mereka: deposit.amount SUDAH termasuk biaya + kode unik,
// jadi nilai itulah yang harus dibayar pembeli persis.
export const depositCreate=amount=>call('/api/deposit/create',{method:'POST',body:{amount:Math.floor(+amount||0)}})
export const depositCheck=id=>call('/api/deposit/check/'+encodeURIComponent(id))
export const depositCancel=id=>call('/api/deposit/cancel/'+encodeURIComponent(id),{method:'POST'})
export const depositHistory=q=>call('/api/deposit/history'+qs(q))

// ---------- withdraw instan (otomatis, tanpa persetujuan manual) ----------
export const iwWallets=()=>call('/api/instant-withdraw/wallets')
export const iwProducts=wallet=>call('/api/instant-withdraw/products?wallet='+encodeURIComponent(wallet))
export const iwCreate=b=>call('/api/instant-withdraw/create',{method:'POST',body:b,timeout:45000})
export const iwHistory=q=>call('/api/instant-withdraw/history'+qs(q))
// ---------- withdraw manual (lewat persetujuan admin AustinPay) ----------
export const wdMethods=()=>call('/api/withdraw/methods')
export const wdCreate=b=>call('/api/withdraw/create',{method:'POST',body:b})
export const wdHistory=q=>call('/api/withdraw/history'+qs(q))

const qs=o=>{const e=Object.entries(o||{}).filter(([,v])=>v!=null&&v!=='');return e.length?'?'+new URLSearchParams(Object.fromEntries(e)):''}

// Ringkasan status koneksi untuk panel admin
export async function status(){
 const c=await cfg()
 if(!c.key)return {ok:false,error:'API key AustinPay belum diisi'}
 try{const a=await account()
  return {ok:true,hmac:!!c.secret,base:c.base,user:a&&a.user?{username:a.user.username,status:a.user.status,balance:(a.user.wallet||{}).balance||0}:null}}
 catch(e){return {ok:false,hmac:!!c.secret,base:c.base,error:e.message}}}
