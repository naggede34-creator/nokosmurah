'use client'
import {useEffect,useState} from 'react'
import './apk.css'
// Halaman khusus unduh aplikasi (APK) + cara pasang versi web (PWA) kalau APK belum tersedia.
// Tautan, versi, ukuran, dan catatan rilis diisi admin di /admin › Isi situs › Aplikasi (APK).
const CARA=[
 ['android','🤖','Android (Chrome)',['Buka artapedia di Chrome.','Ketuk menu ⋮ di kanan atas.','Pilih “Tambahkan ke layar utama” / “Install app”.','Ikon Artapedia muncul di layar HP, bisa dibuka seperti aplikasi.']],
 ['ios','🍎','iPhone / iPad (Safari)',['Buka artapedia di Safari.','Ketuk tombol Bagikan (kotak dengan panah ke atas).','Pilih “Add to Home Screen”.','Ketuk “Add”. Ikon langsung muncul di layar utama.']]]
export default function Apk(){
 const [d,setD]=useState(null),[tab,setTab]=useState('android')
 useEffect(()=>{fetch('/api/v1/promo').then(r=>r.json()).then(x=>setD(x.error?{}:x)).catch(()=>setD({}))},[])
 const a=(d&&d.apk)||{}
 const siap=!!(a.on&&a.url)
 return <div className="apk">
  <div className="apk-h"><a className="apk-bk" href="/dashboard">‹</a><div><b>Aplikasi Artapedia ID</b><small>Pasang di HP, buka tanpa browser</small></div><span className="apk-ic">📱</span></div>

  <div className={'apk-main'+(siap?'':' kosong')}>
   <div className="apk-logo"><img src="/maskot.webp" alt="" width="84" height="84"/></div>
   <h2>ARTAPEDIA ID</h2>
   <p>Beli nokos & QRIS gateway langsung dari aplikasi. Notifikasi OTP masuk ke HP, tidak perlu buka browser.</p>
   {!d&&<div className="apk-sk"/>}
   {d&&siap&&<>
    <div className="apk-chips">
     {a.ver?<span className="apk-chip">Versi {a.ver}</span>:null}
     {a.size?<span className="apk-chip">{a.size}</span>:null}
     <span className="apk-chip">Android</span>
     {a.updated?<span className="apk-chip">{new Date(a.updated).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'})}</span>:null}</div>
    <a className="apk-go" href={a.url} target="_blank" rel="noopener">⬇️ DOWNLOAD APK</a>
    <small className="apk-note">Kalau muncul peringatan “file berbahaya”, itu karena APK di luar Play Store. Pilih <b>tetap unduh</b>, lalu izinkan <b>Install aplikasi tidak dikenal</b> saat memasang.</small></>}
   {d&&!siap&&<div className="apk-soon"><b>APK belum tersedia</b><p>Sementara ini pasang <b>versi web</b> saja — hasilnya sama: ada ikon di layar utama, layar penuh, dan bisa menerima notifikasi.</p></div>}
  </div>

  {a.note?<div className="apk-rel"><b>📝 Catatan rilis</b>{String(a.note).split('\n').filter(x=>x.trim()).map((x,i)=><p key={i}>{x}</p>)}</div>:null}

  <div className="apk-card">
   <div className="apk-ttl"><b>Pasang versi web (tanpa APK)</b><small>Cara paling aman, langsung dari browser</small></div>
   <div className="apk-tabs">{CARA.map(([k,ic,t])=><button key={k} className={tab===k?'on':''} onClick={()=>setTab(k)}>{ic} {t.split(' ')[0]}</button>)}</div>
   {CARA.filter(x=>x[0]===tab).map(([k,ic,t,steps])=><div key={k} className="apk-steps">
    <em>{ic} {t}</em><ol>{steps.map((s,i)=><li key={i}>{s}</li>)}</ol></div>)}</div>

  <div className="apk-foot"><a href="/dashboard">← Kembali ke dashboard</a><a href="/cs">💬 Tanya CS</a></div>
 </div>}
