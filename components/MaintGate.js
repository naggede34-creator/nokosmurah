'use client'
import {useState,useEffect} from 'react'
import {usePathname} from 'next/navigation'
// Layar / banner maintenance seluruh situs (diatur admin > Maintenance).
// Halaman /admin tidak pernah ditutup supaya pemilik situs tetap bisa mematikannya.
// Tampilannya 3D komik, gayanya sama dengan layar akun diblokir (app/gate.css).
const jam=t=>{const d=new Date(+t||Date.now());return d.toLocaleString('id-ID',{timeZone:'Asia/Jakarta',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).replace('.',':')+' WIB'}
export default function MaintGate(){
 const path=usePathname()||'',[m,setM]=useState(null),[t,setT]=useState(Date.now())
 useEffect(()=>{if(path.startsWith('/admin'))return
  let live=true;const f=()=>fetch('/api/maintenance',{cache:'no-store'}).then(r=>r.json()).then(d=>{if(live&&d&&!d.error){setM(d);setT(Date.now())}}).catch(()=>{})
  f();const i=setInterval(f,60000);return()=>{live=false;clearInterval(i)}},[path])
 if(!m||!m.on||path.startsWith('/admin'))return null
 const msg=m.msg||'Kami sedang merapikan sistem sebentar. Sebentar lagi semuanya normal kembali.'
 // Mode banner: situs tetap bisa dibuka, hanya order & deposit baru yang dihentikan.
 if(m.mode==='soft')return <div className="gt-bar" role="status">
  <span>🛠 {msg}</span><em>(pesanan &amp; deposit baru dihentikan sementara)</em></div>
 const mati=Object.keys(m.srv||{}).length
 return <div className="gt warn" role="alert">
  <div className="gt-rays"/>
  <div className="gt-card">
   <div className="gt-ic">🛠️</div>
   <h1>Lagi Dirapikan</h1>
   <span className="gt-sub">🚧 Maintenance berjalan</span>
   <div className="gt-bub">{msg}</div>
   <div className="gt-list">
    <div><small>Saldo kamu</small><b>🔒 Aman, tidak berubah</b></div>
    <div><small>Pesanan yang sudah jalan</small><b>Tetap diproses</b></div>
    <div><small>Kode OTP tidak masuk</small><b>Saldo kembali penuh</b></div>
    {mati>0&&<div><small>Server nokos ditutup</small><b>{mati} server</b></div>}
    <div><small>Dicek terakhir</small><b>{jam(t)}</b></div></div>
   <p className="gt-note">Pesanan baru dan deposit dihentikan sementara supaya tidak ada transaksi yang menggantung. Halaman ini memeriksa sendiri tiap menit — begitu selesai, situs terbuka otomatis.</p>
   <div className="gt-btns">
    <button className="gt-b go" onClick={()=>location.reload()}>🔄 Coba lagi sekarang</button></div>
  </div></div>}
