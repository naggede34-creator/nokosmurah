'use client'
import {useState,useEffect,useCallback,useRef} from 'react'
import './job.css'
import Toast from '../../components/ui/Toast'
import Skeleton from '../../components/ui/Skeleton'
const api=async(p,b,m)=>{const r=await fetch('/api/'+p,{method:m||(b?'POST':'GET'),headers:{'Content-Type':'application/json'},body:b?JSON.stringify(b):undefined});return r.json()}
const rp=n=>'Rp'+(+n||0).toLocaleString('id-ID')
const dt=t=>t?new Date(t).toLocaleString('id-ID',{timeZone:'Asia/Jakarta',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})+' WIB':'-'
const ST={menunggu:['wait','⏳ Ditinjau admin'],acc:['ok','✅ Diterima'],tolak:['no','❌ Ditolak']}
// Kecilkan foto bukti di browser: maks 1200px, turunkan mutu sampai muat di bawah 380KB.
const shrink=f=>new Promise((res,rej)=>{const r=new FileReader();r.onerror=()=>rej(Error('Gagal membaca file'))
 r.onload=()=>{const im=new Image();im.onerror=()=>rej(Error('File itu bukan gambar'))
  im.onload=()=>{for(const [m,q] of [[1200,.82],[1000,.72],[800,.6],[600,.5]]){
    const k=Math.min(1,m/Math.max(im.width,im.height)),c=document.createElement('canvas')
    c.width=Math.max(1,Math.round(im.width*k));c.height=Math.max(1,Math.round(im.height*k))
    c.getContext('2d').drawImage(im,0,0,c.width,c.height)
    const o=c.toDataURL('image/jpeg',q);if(o.length<=380000)return res(o)}
   rej(Error('Foto terlalu besar, coba foto lain'))}
  im.src=r.result}
 r.readAsDataURL(f)})

export default function Job(){
 const [d,setD]=useState(),[msg,setMsg]=useState(''),[open,setOpen]=useState(null)
 const [foto,setFoto]=useState(''),[note,setNote]=useState(''),[busy,setBusy]=useState(false)
 const file=useRef(null)
 const load=useCallback(async()=>{const r=await api('v1/job');if(r.error){setD(null);return}setD(r)},[])
 useEffect(()=>{load()},[load])

 if(d===undefined)return <div className="jb"><Skeleton style={{height:190,borderRadius:26}}/>
  <div className="jb-grid" style={{marginTop:24}}>{[0,1,2].map(i=><Skeleton key={i} style={{height:230,borderRadius:22}}/>)}</div></div>
 if(!d){if(typeof window!=='undefined')location.href='/login';return <div className="jb"><p>Mengalihkan ke halaman masuk…</p></div>}

 const pick=async e=>{const f=e.target.files&&e.target.files[0];if(!f)return
  try{setFoto(await shrink(f))}catch(err){setMsg(err.message)}
  e.target.value=''}
 const kirim=async()=>{
  if(!foto)return setMsg('Unggah foto bukti dulu')
  setBusy(true);const r=await api('v1/job/submit',{jobId:open.id,photo:foto,note});setBusy(false)
  if(r.error)return setMsg(r.error)
  setOpen(null);setFoto('');setNote('');setMsg('Bukti terkirim! Tunggu admin meninjau, hadiah masuk otomatis setelah di-ACC.');load()}

 const jobs=d.jobs||[],subs=d.subs||[]
 return <div className="jb">
  <Toast msg={msg} onClose={()=>setMsg('')}/>
  <div className="jb-top"><a href="/dashboard">‹ Dashboard</a><a href="/deposit">Isi saldo</a></div>

  <section className="jb-hero">
   <h1>Job · Saldo Gratis 🎁</h1>
   <p>Kerjakan job di bawah, unggah foto buktinya, lalu tunggu admin meng-ACC. Hadiahnya langsung masuk jadi <b>saldo nokos</b> — bisa dipakai beli nomor tanpa deposit.</p>
   <div className="jb-kpi">
    <div><small>Sudah kamu dapat</small><b>{rp(d.earned||0)}</b></div>
    <div><small>Job tersedia</small><b>{jobs.length}</b></div>
    <div><small>Menunggu ditinjau</small><b>{subs.filter(s=>s.status==='menunggu').length}</b></div>
   </div></section>

  <div className="jb-sec"><h2>Job tersedia</h2><span/></div>
  {jobs.length===0
   ? <div className="jb-empty">Belum ada job yang dibuka. Cek lagi nanti ya — job baru dipasang admin secara berkala.</div>
   : <div className="jb-grid">{jobs.map(j=>{const sisa=Math.max(0,(j.max||3)-(j.used||0)),habis=sisa===0
     return <article key={j.id} className={'jb-card'+(habis?' habis':'')}>
      <span className="jb-rw">+{rp(j.reward)}</span>
      <div className="jb-hd">
       {j.logo?<img className="jb-logo" src={j.logo} alt=""/>:<span className="jb-logo">🧩</span>}
       <span style={{minWidth:0}}><b>{j.title}</b><small>Boleh dikerjakan {j.max||3}x per akun</small></span></div>
      {j.desc&&<p className="jb-desc">{j.desc}</p>}
      <div className="jb-bar"><i style={{width:Math.round(((j.used||0)/(j.max||3))*100)+'%'}}/></div>
      <div className="jb-meta"><span>Terpakai {j.used||0}/{j.max||3}</span><span>{habis?'Jatah habis':`Sisa ${sisa}x`}</span></div>
      <div className="jb-act">
       {j.link&&<a className="btn sil" href={j.link} target="_blank" rel="noopener noreferrer">Buka job</a>}
       <button className="btn blue" disabled={habis||j.waiting} onClick={()=>{setOpen(j);setFoto('');setNote('')}}>
        {j.waiting?'Sedang ditinjau':habis?'Jatah habis':'Kirim bukti'}</button></div>
     </article>})}</div>}

  <div className="jb-sec"><h2>Riwayat kirimanmu</h2><span/></div>
  {subs.length===0
   ? <div className="jb-empty">Belum ada kiriman. Mulai dari job pertama di atas 👆</div>
   : <div className="jb-list">{subs.map(s=>{const [c,l]=ST[s.status]||['wait',s.status]
     return <div key={s.id} className="jb-row">
      <span style={{minWidth:0,flex:1}}><b>{s.title}</b><small>{dt(s.at)}{s.reason?' · '+s.reason:''}</small></span>
      <span style={{fontWeight:900}}>{s.status==='acc'?'+'+rp(s.reward):rp(s.reward)}</span>
      <span className={'jb-pill '+c}>{l}</span></div>})}</div>}

  {open&&<div className="jb-sheet" onClick={e=>{if(e.target===e.currentTarget)setOpen(null)}}>
   <div className="jb-box">
    <h3>{open.title}</h3>
    <p className="jb-desc" style={{marginBottom:10}}>Hadiah <b>{rp(open.reward)}</b> · pengerjaan ke-{(open.used||0)+1} dari {open.max||3}</p>
    <ol className="jb-steps">
     <li>Kerjakan job sesuai petunjuk di atas{open.link?' (tombol “Buka job”)':''}.</li>
     <li>Tangkap layar / foto hasilnya sebagai bukti.</li>
     <li>Unggah fotonya di bawah, lalu kirim.</li>
     <li>Admin meninjau. Kalau diterima, saldo langsung masuk dan kamu dapat notifikasi.</li></ol>
    <div className="jb-drop" style={{marginTop:12}} onClick={()=>file.current&&file.current.click()}>
     {foto?<img src={foto} alt="Pratinjau bukti"/>:<><span style={{fontSize:34}}>📸</span><span>Ketuk untuk pilih foto bukti</span><small>JPG / PNG, otomatis dikecilkan</small></>}</div>
    <input ref={file} type="file" accept="image/*" onChange={pick} style={{display:'none'}}/>
    {foto&&<button className="btn sil" style={{marginTop:8}} onClick={()=>setFoto('')}>Ganti foto</button>}
    <textarea placeholder="Catatan untuk admin (opsional): username kamu, nama akun, dll." value={note} onChange={e=>setNote(e.target.value)} maxLength={200}/>
    <div className="jb-act" style={{marginTop:6}}>
     <button className="btn sil" onClick={()=>setOpen(null)}>Batal</button>
     <button className="btn blue" disabled={busy||!foto} onClick={kirim}>{busy?'Mengirim…':'Kirim bukti'}</button></div>
   </div></div>}
 </div>}
