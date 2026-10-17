// ===========================================================================
// SMP Payment — deposit QRIS H2H.
//
// SMP Payment TIDAK punya endpoint "buat tagihan": QRIS-nya statis milik admin, dan
// setiap pembayaran yang masuk dikabarkan lewat CALLBACK (POST JSON) ke server kita.
// Karena callback tidak membawa order id, pembayaran dicocokkan lewat NOMINAL:
//   total yang harus dibayar = nominal deposit + KODE UNIK (1-999)
// Kode unik dijaga supaya tidak ada dua tagihan SMP aktif dengan total yang sama.
//
// Alur:
//  1) smpCreate()  -> QRIS statis diubah jadi QRIS dinamis (nominal terisi) + kode unik.
//  2) Pelanggan membayar total persis.
//  3) SMP memanggil /api/callbackqris/<SMP_SECRET> (app/api/callbackqris/[key]/route.js),
//     yang menandai tagihan lunas lewat smpPaid() dan mengkreditkan saldonya.
//  4) smpCheck() hanya membaca penanda lunas itu, jadi tombol "Saya sudah bayar",
//     cron, dan sapuan susulan memakai jalur kredit yang sama dengan gateway lain.
// ===========================================================================
import crypto from 'crypto'
import {kv} from './db'
import {getSec} from './settings'

export const EXP_MIN=30                              // batas bayar tagihan (menit)
const HOLD_MS=(EXP_MIN+15+5)*60000                   // kode unik ditahan sampai tenggang bayar lewat
const AMT=t=>'tmp:smp:amt:'+t                        // total -> {id,amount,at}
const LOCK=t=>'smp:amt:'+t
export const PAID=id=>'smp:paid:'+id                 // id tagihan -> {rrn,...}
export const RRN=r=>'smp:rrn:'+r                     // rrn yang sudah diproses
export const ORPHAN='smp:orphan'                     // pembayaran masuk tanpa tagihan (perlu dicek admin)

// CRC16-CCITT (poly 0x1021, init 0xFFFF) — yang dipakai standar QRIS/EMV
const crc16=s=>{let c=0xFFFF
 for(let i=0;i<s.length;i++){c^=s.charCodeAt(i)<<8;for(let j=0;j<8;j++)c=(c&0x8000)?((c<<1)^0x1021):(c<<1);c&=0xFFFF}
 return c.toString(16).toUpperCase().padStart(4,'0')}

// QRIS statis -> QRIS dinamis dengan nominal terisi. '' kalau teksnya bukan QRIS yang valid.
export function qrisDinamis(statis,nominal){
 let s=String(statis||'').trim()
 if(!/^000201/.test(s)||!/6304[0-9A-Fa-f]{4}$/.test(s))return ''
 const n=Math.floor(+nominal||0);if(n<=0)return ''
 s=s.slice(0,-8)                                     // buang "6304" + CRC lama
 s=s.replace('010211','010212')                      // 11 = statis, 12 = dinamis
 const i=s.indexOf('5802ID');if(i<0)return ''
 const v=String(n)
 s=s.slice(0,i)+'54'+String(v.length).padStart(2,'0')+v+s.slice(i)
 s+='6304'
 return s+crc16(s)}

const bacaQris=async()=>String((await getSec()).SMP_QRIS||'').trim()

export async function smpReady(){
 const s=await getSec(),q=String(s.SMP_QRIS||'').trim()
 if(!s.SMP_SECRET||!q)return false
 return /^000201/.test(q)||/^https?:\/\//.test(q)}

export async function smpCreate(amount){
 const q=await bacaQris()
 const dinamis=/^000201/.test(q)
 if(!dinamis&&!/^https?:\/\//.test(q))throw Error('QRIS SMP Payment belum diisi dengan benar')
 const id='SMP'+Date.now().toString(36).toUpperCase()+crypto.randomBytes(3).toString('hex').toUpperCase()
 for(let i=0;i<40;i++){
  const kode=1+crypto.randomInt(999)
  const total=Math.floor(amount)+kode
  if(!await kv.lock(LOCK(total),HOLD_MS))continue    // total ini sedang dipakai tagihan lain
  const qr=dinamis?qrisDinamis(q,total):''
  if(dinamis&&!qr){await kv.unlock(LOCK(total));throw Error('String QRIS SMP Payment tidak valid (harus diawali 000201 dan diakhiri CRC)')}
  await kv.set(AMT(total),{id,amount:Math.floor(amount),at:Date.now()})
  return {id,total,fee:kode,qr,qrImg:dinamis?'':q,va:'',exp:new Date(Date.now()+EXP_MIN*60000).toISOString()}}
 throw Error('Kode unik SMP Payment sedang penuh, coba lagi sebentar')}

export async function smpCheck(o){
 return (await kv.get(PAID(o.id)))?'completed':'pending'}

export async function smpCancel(o){
 try{const m=await kv.get(AMT(o.total))
  if(m&&m.id===o.id){await kv.del(AMT(o.total));await kv.unlock(LOCK(o.total))}}catch(e){}}

// Cari tagihan yang cocok dengan total pembayaran yang masuk.
export const smpFind=total=>kv.get(AMT(total))
