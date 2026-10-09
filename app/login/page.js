'use client'
import {useState,useEffect} from 'react'
const api=(p,b)=>fetch('/api/'+p,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)}).then(r=>r.json())
export default function L(){
 const [m,setM]=useState('login'),[f,setF]=useState({}),[err,setErr]=useState(''),[busy,setBusy]=useState(false)
 useEffect(()=>{fetch('/api/v1/me').then(r=>r.json()).then(d=>{if(!d.error)location.href='/dashboard'}).catch(()=>{})},[])
 const set=k=>e=>setF({...f,[k]:e.target.value})
 const go=async()=>{setBusy(true);setErr('');const d=await api('auth/'+m,f).catch(()=>({error:'Gagal terhubung ke server'}));setBusy(false);d.error?setErr(d.error):location.href='/dashboard'}
 return <div className="card" style={{maxWidth:420,margin:'40px auto'}}>
  <h2>{m==='login'?'Masuk ke Artapedia ID':'Daftar Akun Baru'}</h2>
  <p>Kamu harus masuk dulu untuk memakai layanan.</p>
  {m==='register'&&<input placeholder="Nama" onChange={set('name')}/>}
  <input type="email" placeholder="Email" onChange={set('email')}/>
  <input type="password" placeholder="Password (min 6 karakter)" onChange={set('password')} onKeyDown={e=>e.key==='Enter'&&go()}/>
  {err&&<p style={{color:'#c0392b'}}><b>{err}</b></p>}
  <button className="btn blue" disabled={busy} onClick={go}>{busy?'Memproses...':m==='login'?'Masuk':'Daftar'}</button>{' '}
  <button className="btn sil" onClick={()=>{setM(m==='login'?'register':'login');setErr('')}}>{m==='login'?'Belum punya akun? Daftar':'Sudah punya akun? Masuk'}</button></div>}
