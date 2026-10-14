'use client'
import {useState} from 'react'
// Tips order di halaman Beli Nokos. Dibuat ringkas: semua isi masuk akordeon,
// jadi tidak makan tempat tapi tetap mudah dibaca saat dibutuhkan.
const TIPS=[
 {k:'a',ic:'🔒',t:'Login tidak tersedia di WhatsApp',li:[
  'Hapus memory (bukan data) WhatsApp, paksa berhenti aplikasinya, pasang VPN 1.1.1.1 WARP, aktifkan, lalu beli nomor baru.',
  'Ganti jenis aplikasinya: kalau tadi WhatsApp biasa coba WhatsApp Business, atau sebaliknya.',
  'Pakai HP lain yang jarang dipakai untuk mendaftarkan nomor.']},
 {k:'b',ic:'📵',t:'Tidak menerima OTP',li:[
  'Pasang VPN 1.1.1.1, aktifkan VPN, lalu beli nomor baru dan daftarkan ulang.']}]
const NEG=[['Indonesia','🇮🇩','+62'],['Colombia','🇨🇴','+57'],['Philippines','🇵🇭','+63']]
export default function TipsOrder(){
 const [buka,setBuka]=useState('')
 return <div className="tip">
  <div className="tip-h"><span>💡</span><div><b>Sedikit tips biar sekali beli langsung jadi</b><small>Ketuk salah satu kalau kamu kena kendalanya</small></div></div>
  <div className="tip-list">{TIPS.map((x,n)=>{const on=buka===x.k
   return <div key={x.k} className={'tip-it'+(on?' on':'')}>
    <button onClick={()=>setBuka(on?'':x.k)} aria-expanded={on}>
     <i>{x.ic}</i><b>{String.fromCharCode(65+n)}. {x.t}</b><em>{on?'−':'+'}</em></button>
    {on&&<ol>{x.li.map((s,i)=><li key={i}>{s}</li>)}</ol>}</div>})}</div>
  <div className={'tip-it warn'+(buka==='w'?' on':'')}>
   <button onClick={()=>setBuka(buka==='w'?'':'w')} aria-expanded={buka==='w'}>
    <i>⚠️</i><b>Jangan dipaksa login</b><em>{buka==='w'?'−':'+'}</em></button>
   {buka==='w'&&<p>Kalau muncul <i>Login tidak tersedia</i>, harus menunggu 1 jam, atau SMS OTP tidak pernah masuk — biasanya HP-mu sudah dikenali sistem WhatsApp karena terlalu sering mendaftarkan nomor. Tunggu beberapa jam atau pakai HP lain; dipaksa terus berisiko diblokir.</p>}</div>
  <div className="tip-neg"><small>🔎 NEGARA PALING LANCAR UNTUK WHATSAPP</small>
   <div>{NEG.map(([n,f,c],i)=><span key={n}><u>{i+1}</u>{f} {n} <b>{c}</b></span>)}</div></div>
 </div>}
