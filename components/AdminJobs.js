'use client'
import {useState,useEffect,useCallback,useRef} from 'react'
// Panel admin: pasang job berhadiah saldo + tinjau bukti foto dari pengguna.
const rp=n=>'Rp'+(+n||0).toLocaleString('id-ID')
const dt=t=>t?new Date(t).toLocaleString('id-ID',{timeZone:'Asia/Jakarta',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})+' WIB':'-'
const KOSONG={id:'',title:'',desc:'',logo:'',link:'',reward:'5000',max:'3',on:true}
// Logo job dikecilkan jadi kotak 180px supaya ringan disimpan.
const shrinkLogo=f=>new Promise((res,rej)=>{const r=new FileReader();r.onerror=()=>rej(Error('Gagal membaca file'))
 r.onload=()=>{const im=new Image();im.onerror=()=>rej(Error('File itu bukan gambar'))
  im.onload=()=>{const s=180,c=document.createElement('canvas');c.width=s;c.height=s
   const k=Math.max(s/im.width,s/im.height),w=im.width*k,h=im.height*k
   const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,s,s);x.drawImage(im,(s-w)/2,(s-h)/2,w,h)
   res(c.toDataURL('image/jpeg',.82))}
  im.src=r.result}
 r.readAsDataURL(f)})

export default function AdminJobs({call}){
 const [d,setD]=useState(null),[f,setF]=useState(KOSONG),[busy,setBusy]=useState(false)
 const [look,setLook]=useState(null),[why,setWhy]=useState('')
 const logo=useRef(null)
 const load=useCallback(async()=>{const r=await call('job/list');if(!r.error)setD(r)},[call])
 useEffect(()=>{load()},[load])

 const pickLogo=async e=>{const file=e.target.files&&e.target.files[0];if(!file)return
  try{setF(x=>({...x,logo:''}));setF(x=>({...x,logo:''}));const u=await shrinkLogo(file);setF(x=>({...x,logo:u}))}
  catch(err){alert(err.message)}
  e.target.value=''}
 const simpan=async()=>{setBusy(true)
  const r=await call('job/save',{job:{...f,reward:+String(f.reward).replace(/\D/g,'')||0,max:+f.max||3}})
  setBusy(false);if(r.error)return alert(r.error)
  setF(KOSONG);load()}
 const hapus=async id=>{if(!confirm('Hapus job ini? Riwayat kiriman pengguna tetap tersimpan.'))return
  const r=await call('job/del',{id});if(r.error)return alert(r.error);load()}
 const tinjau=async id=>{const r=await call('job/sub',{id});if(r.error)return alert(r.error);setLook(r);setWhy('')}
 const putus=async ok=>{if(!ok&&!why.trim())return alert('Isi alasan penolakan supaya pengguna tahu harus memperbaiki apa')
  const r=await call('job/review',{id:look.id,ok,reason:why});if(r.error)return alert(r.error)
  setLook(null);setWhy('');load()}

 if(!d)return <div className="card">Memuat job…</div>
 const st=d.stats||{}
 return <>
  <div className="card"><h3>🎁 Job & saldo gratis</h3>
   <p className="muted">Pengguna mengerjakan job, mengunggah foto bukti, lalu kamu ACC. Begitu di-ACC, hadiah langsung masuk sebagai saldo nokos dan pengguna dapat notifikasi. Tiap job dibatasi <b>3x per akun</b> (bisa diubah). Kiriman yang ditolak tidak menghabiskan jatah.</p>
   <div className="ad-kpi" style={{marginTop:4}}>
    <div><small>Job dibuat</small><b>{st.jobs||0}</b></div>
    <div><small>Job aktif</small><b>{st.aktif||0}</b></div>
    <div><small>Bukti menunggu</small><b>{st.menunggu||0}</b></div></div></div>

  <div className="card"><h3>{f.id?'✏️ Ubah job':'➕ Pasang job baru'}</h3>
   <div className="jba-form">
    <button type="button" className="jba-logo" onClick={()=>logo.current&&logo.current.click()}>
     {f.logo?<img src={f.logo} alt=""/>:<span>🖼<small>Logo job</small></span>}</button>
    <input ref={logo} type="file" accept="image/*" onChange={pickLogo} style={{display:'none'}}/>
    <div style={{flex:1,minWidth:0}}>
     <label className="blk">Judul<input value={f.title} onChange={e=>setF({...f,title:e.target.value})} placeholder="Follow Instagram @artapedia.id" maxLength={70}/></label>
     <label className="blk">Link job (opsional)<input value={f.link} onChange={e=>setF({...f,link:e.target.value})} placeholder="https://instagram.com/..."/></label></div></div>
   <label className="blk">Petunjuk untuk pengguna<textarea value={f.desc} onChange={e=>setF({...f,desc:e.target.value})} placeholder={'Contoh:\n1. Follow akun kami\n2. Screenshot halaman profil yang sudah ter-follow\n3. Kirim fotonya di sini'} maxLength={400}/></label>
   <div className="ad-g">
    <label>Hadiah saldo (Rp)<input type="number" value={f.reward} onChange={e=>setF({...f,reward:e.target.value})}/></label>
    <label>Maks. pengerjaan / akun<input type="number" min="1" max="20" value={f.max} onChange={e=>setF({...f,max:e.target.value})}/></label></div>
   <div className="tabs" style={{marginTop:10}}>
    <button className="btn blue" disabled={busy} onClick={simpan}>{busy?'Menyimpan…':f.id?'Simpan perubahan':'Pasang job'}</button>
    {f.id&&<button className="btn sil" onClick={()=>setF(KOSONG)}>Batal ubah</button>}</div></div>

  <div className="card"><h3>📋 Daftar job ({(d.jobs||[]).length})</h3>
   {(d.jobs||[]).length===0?<p className="muted">Belum ada job. Pasang yang pertama di atas.</p>
   :<div className="jba-list">{d.jobs.map(j=><div key={j.id} className={'jba-row'+(j.on?'':' off')}>
     {j.logo?<img className="jba-ic" src={j.logo} alt=""/>:<span className="jba-ic">🧩</span>}
     <div style={{minWidth:0,flex:1}}><b>{j.title}</b><small>{rp(j.reward)} · maks {j.max||3}x/akun{j.link?' · ada link':''}</small></div>
     <button className="btn sil" onClick={async()=>{await call('job/toggle',{id:j.id,on:!j.on});load()}}>{j.on?'Matikan':'Nyalakan'}</button>
     <button className="btn" onClick={()=>{setF({...j,reward:String(j.reward),max:String(j.max||3)});window.scrollTo({top:0,behavior:'smooth'})}}>Ubah</button>
     <button className="btn sil" onClick={()=>hapus(j.id)}>Hapus</button></div>)}</div>}</div>

  <div className="card"><h3>🔎 Bukti menunggu ditinjau ({(d.pending||[]).length})</h3>
   {(d.pending||[]).length===0?<p className="muted">Tidak ada bukti yang menunggu. 👍</p>
   :<div className="jba-list">{d.pending.map(s=><div key={s.id} className="jba-row">
     <div style={{minWidth:0,flex:1}}><b>{s.title}</b>
      <small>{s.user?s.user.email:'(pengguna hilang)'} · {dt(s.at)} · hadiah {rp(s.reward)}</small>
      {s.note&&<small>📝 {s.note}</small>}</div>
     <button className="btn blue" onClick={()=>tinjau(s.id)}>Lihat bukti</button></div>)}</div>}</div>

  {look&&<div className="jba-modal" onClick={e=>{if(e.target===e.currentTarget)setLook(null)}}>
   <div className="jba-box">
    <h3>{look.title}</h3>
    <small className="muted">{dt(look.at)}{look.note?' · '+look.note:''}</small>
    {look.img?<img className="jba-proof" src={look.img} alt="Bukti pengguna"/>:<p className="muted">Foto tidak tersimpan.</p>}
    <input placeholder="Alasan kalau ditolak (wajib diisi saat menolak)" value={why} onChange={e=>setWhy(e.target.value)}/>
    <div className="tabs">
     <button className="btn blue" onClick={()=>putus(true)}>✅ ACC & bayar hadiah</button>
     <button className="btn sil" onClick={()=>putus(false)}>❌ Tolak</button>
     <button className="btn sil" onClick={()=>setLook(null)}>Tutup</button></div></div></div>}
 </>}
