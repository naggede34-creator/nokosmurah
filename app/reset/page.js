'use client'
import {useState,useEffect} from 'react'
export default function R(){
 const [tk,setTk]=useState(''),[p1,setP1]=useState(''),[p2,setP2]=useState(''),[err,setErr]=useState(''),[done,setDone]=useState(false),[busy,setBusy]=useState(false)
 useEffect(()=>{setTk(new URLSearchParams(location.search).get('token')||'')},[])
 const go=async()=>{setErr('')
  if(p1.length<6)return setErr('Password minimal 6 karakter')
  if(p1!==p2)return setErr('Konfirmasi password tidak sama')
  setBusy(true);const d=await fetch('/api/auth/reset',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:tk,password:p1})}).then(r=>r.json()).catch(()=>({error:'Gagal terhubung ke server'}));setBusy(false)
  d.error?setErr(d.error):setDone(true)}
 if(done)return <div className="card" style={{maxWidth:420,margin:'40px auto'}}><h2>Password berhasil diganti ✅</h2><p>Semua sesi lama otomatis keluar. Silakan masuk dengan password baru.</p><a className="btn blue" href="/login">Masuk sekarang</a></div>
 return <div className="card" style={{maxWidth:420,margin:'40px auto'}}><h2>Buat password baru</h2>
  {!tk&&<p style={{color:'#c0392b'}}><b>Link tidak lengkap.</b> Minta link baru lewat <a href="/login"><u>halaman masuk</u></a>.</p>}
  <input type="password" placeholder="Password baru (min 6 karakter)" value={p1} onChange={e=>setP1(e.target.value)}/>
  <input type="password" placeholder="Ulangi password baru" value={p2} onChange={e=>setP2(e.target.value)} onKeyDown={e=>e.key==='Enter'&&go()}/>
  {err&&<p style={{color:'#c0392b'}}><b>{err}</b></p>}
  <button className="btn blue" disabled={busy||!tk} onClick={go}>{busy?'Memproses...':'Simpan password'}</button></div>}
