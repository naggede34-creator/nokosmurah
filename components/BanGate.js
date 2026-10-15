'use client'
import {useState,useEffect} from 'react'
import {usePathname} from 'next/navigation'
// Layar penuh untuk akun / jaringan yang diblokir admin.
// Muncul untuk DUA keadaan: akun yang sedang login kena banned, atau alamat IP
// pengunjung ada di daftar blokir (ikut terbanned bersama akun sumbernya).
// Halaman /admin dilewati supaya pemilik situs tetap bisa membuka blokirnya.
const jam=t=>{if(!t)return '-';const d=new Date(+t)
 return d.toLocaleString('id-ID',{timeZone:'Asia/Jakarta',day:'2-digit',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'}).replace('.',':')+' WIB'}
export default function BanGate(){
 const path=usePathname()||'',[b,setB]=useState(null)
 useEffect(()=>{if(path.startsWith('/admin'))return   // panel admin tidak pernah ditutup, jadi tidak perlu menanyakannya
  let live=true
  const f=()=>fetch('/api/ban',{cache:'no-store'}).then(r=>r.json()).then(d=>{if(live&&d&&!d.error)setB(d&&d.banned?d:null)}).catch(()=>{})
  f();const i=setInterval(f,60000);return()=>{live=false;clearInterval(i)}},[path])
 if(!b||path.startsWith('/admin'))return null
 const btn=Array.isArray(b.btn)?b.btn:[]
 // Hanya jaringannya yang kena (pengunjung belum/ bukan pemilik akun yang dibanned)
 const jaringanSaja=!!b.ipBan&&!b.email
 return <div className="gt bad" role="alert">
  <div className="gt-rays"/>
  <div className="gt-card">
   <div className="gt-ic">⛔</div>
   <h1>Akses Ditutup</h1>
   <span className="gt-sub">🚫 {jaringanSaja?'Jaringan diblokir admin':'Akun diblokir admin'}</span>
   <div className="gt-bub">{b.reason
    ? b.reason
    : jaringanSaja
      ? 'Jaringan yang kamu pakai sedang diblokir karena terhubung dengan akun yang melanggar aturan.'
      : 'Akun ini diblokir karena melanggar Syarat & Ketentuan layanan.'}</div>
   <div className="gt-list">
    {b.email?<div><small>Akun</small><b>{b.email}</b></div>:null}
    <div><small>Diblokir sejak</small><b>{jam(b.at)}</b></div>
    <div><small>Alamat IP kamu</small><b className="mono">{b.ip||'tidak terdeteksi'}</b></div>
    <div><small>Jaringan ikut diblokir</small><b>{b.ipBan?'Ya':'Tidak'}</b></div>
    <div><small>Saldo &amp; riwayat</small><b>Tersimpan, tidak dihapus</b></div></div>
   <p className="gt-note">{jaringanSaja
    ? 'Blokir ini menutup seluruh jaringan, jadi semua akun yang dibuka dari koneksi ini ikut tertutup. Kalau kamu memakai WiFi bersama atau kuota seluler, sebutkan alamat IP di atas ke admin supaya cepat dicek.'
    : 'Blokir berlaku untuk semua akun yang terhubung ke akun ini — baik lewat alamat IP yang sama maupun akun Telegram yang sama. Kalau menurutmu ini keliru, hubungi admin dengan menyebut alamat IP di atas supaya cepat dicek.'}</p>
   <div className="gt-btns">
    {btn.map((x,i)=><a key={i} className="gt-b cs" href={x.url} target="_blank" rel="noopener noreferrer">💬 {x.label}</a>)}
    <button className="gt-b" onClick={()=>location.reload()}>🔄 Cek lagi</button></div>
  </div></div>}
