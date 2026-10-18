'use client'
import {useState,useEffect} from 'react'
import {createPortal} from 'react-dom'
// Tombol "Tips Order" + jendela berisi tips lengkap. Dipasang di menu Beli Nokos (dan di lembar pesan),
// supaya pembeli membacanya SEBELUM order. Teks yang sama dipakai di semua bot (lib/tgbot.js, tipsText()).
const NEG=[['Indonesia','🇮🇩','+62'],['Colombia','🇨🇴','+57'],['Philippine','🇵🇭','+63']]
export default function TipsOrder({kecil}){
 const [on,setOn]=useState(false)
 useEffect(()=>{if(!on)return;const k=e=>e.key==='Escape'&&setOn(false);document.addEventListener('keydown',k);const o=document.body.style.overflow;document.body.style.overflow='hidden'
  return()=>{document.removeEventListener('keydown',k);document.body.style.overflow=o}},[on])
 return <>
  <button type="button" className={'tpm-btn'+(kecil?' sm':'')} onClick={()=>setOn(true)}>
   <span className="tpm-ic">💡</span><span className="tpm-tx"><b>TIPS ORDER</b><small>Baca dulu sebelum order</small></span><em>›</em></button>
  {on&&createPortal(<div className="tpm-bk" onClick={e=>e.target===e.currentTarget&&setOn(false)}>
   <div className="tpm-box" role="dialog" aria-modal="true" aria-label="Tips order">
    <div className="tpm-hd"><div><b>💡 Tips Order</b><small>Baca dulu sebelum order</small></div><button type="button" onClick={()=>setOn(false)} aria-label="Tutup">✕</button></div>
    <div className="tpm-bd">
     <p className="tpm-lead">Beli nomor dengan harga yang lebih terjangkau, stok melimpah, dan server lebih cepat 😋</p>
     <div className="tpm-note">Untuk pembelian di web berbeda dengan pembelian di bot.</div>
     <h4>💡 Sedikit Tips</h4>
     <div className="tpm-card"><b>A. Login tidak tersedia di WhatsApp</b>
      <ol><li>Hapus memory (bukan data), paksa berhenti aplikasi, lalu download aplikasi VPN <b>1.1.1.1 WARP</b>, aktifkan VPN, dan beli ulang nomor.</li>
       <li>Gunakan aplikasi WhatsApp lain: jika memakai WhatsApp biasa coba WhatsApp Bisnis, atau sebaliknya.</li>
       <li>Gunakan HP lain yang jarang digunakan untuk mendaftarkan nomor WhatsApp.</li></ol></div>
     <div className="tpm-card"><b>B. Tidak menerima OTP</b>
      <ol><li>Download VPN <b>1.1.1.1</b> dan aktifkan VPN, lalu beli ulang nomor dan daftarkan.</li></ol></div>
     <div className="tpm-warn"><b>ℹ️ WARNING</b>
      <p>Jika muncul <i>Login tidak tersedia</i>, harus menunggu 1 jam, atau OTP SMS tidak terkirim, kemungkinan HP kamu telah terdeteksi oleh sistem WhatsApp karena terlalu sering mendaftarkan nomor WhatsApp.</p>
      <p><b>Jangan paksa login</b> karena berisiko diblokir. Tunggu beberapa jam atau gunakan HP lain yang jarang digunakan untuk mendaftar WhatsApp.</p></div>
     <h4>🔎 Rekomendasi Negara untuk WhatsApp</h4>
     <div className="tpm-neg">{NEG.map(([n,f,c],i)=><span key={n}><u>{i+1}</u>{f} {n} <b>{c}</b></span>)}</div>
     <h4>🤚 Informasi untuk Reseller</h4>
     <div className="tpm-card"><p>Bagi kalian penjual nomor WhatsApp, perlu diingat bahwa WhatsApp memiliki sistem keamanan yang dapat mendeteksi aktivitas pendaftaran nomor secara berulang. Jadi, jangan asal mendaftarkan banyak nomor tanpa memahami risikonya.</p>
      <p>Beberapa seller sering menyalahkan nomor yang dijual, padahal nomor kami berfungsi dengan baik. Masalah pendaftaran tidak selalu berasal dari nomor, tetapi bisa disebabkan oleh sistem keamanan WhatsApp.</p></div>
    </div>
    <div className="tpm-ft"><button type="button" onClick={()=>setOn(false)}>SAYA SUDAH BACA, LANJUT ORDER</button></div>
   </div></div>,document.body)}
 </>}
