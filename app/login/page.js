'use client'
import {useState,useEffect} from 'react'
const api=(p,b)=>fetch('/api/'+p,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)}).then(r=>r.json())
const TG=process.env.NEXT_PUBLIC_TG_URL||'#'
export default function L(){
 const [m,setM]=useState('login'),[f,setF]=useState({}),[err,setErr]=useState(''),[ok,setOk]=useState(''),[busy,setBusy]=useState(false)
 useEffect(()=>{
  const q=new URLSearchParams(location.search),r=(q.get('ref')||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,12)
  if(r){setM('register');setF(x=>({...x,ref:r}))}
  fetch('/api/v1/me').then(r=>r.json()).then(d=>{if(!d.error)location.href='/dashboard'}).catch(()=>{})},[])
 const set=k=>e=>setF({...f,[k]:e.target.value})
 const go=async()=>{setBusy(true);setErr('');setOk('')
  const d=await api(m==='forgot'?'auth/forgot':'auth/'+m,f).catch(()=>({error:'Gagal terhubung ke server'}));setBusy(false)
  if(d.error)setErr(d.error);else if(m==='forgot')setOk(d.msg||'Link reset dikirim.');else location.href='/dashboard'}
 const sw=x=>{setM(x);setErr('');setOk('')}
 return <div className="card" style={{maxWidth:420,margin:'40px auto'}}>
  <h2>{m==='login'?'Masuk ke Artapedia ID':m==='register'?'Daftar Akun Baru':'Lupa Password'}</h2>
  <p>{m==='forgot'?'Masukkan email akunmu, kami kirim link untuk membuat password baru.':'Kamu harus masuk dulu untuk memakai layanan.'}</p>
  {m==='register'&&<input placeholder="Nama" onChange={set('name')}/>}
  <input type="email" placeholder="Email" onChange={set('email')} onKeyDown={e=>m==='forgot'&&e.key==='Enter'&&go()}/>
  {m!=='forgot'&&<input type="password" placeholder="Password (min 6 karakter)" onChange={set('password')} onKeyDown={e=>e.key==='Enter'&&go()}/>}
  {m==='register'&&<input placeholder="Kode ajakan teman (opsional)" value={f.ref||''} onChange={e=>setF({...f,ref:e.target.value.toUpperCase()})}/>}
  {err&&<p style={{color:'#c0392b'}}><b>{err}</b></p>}
  {ok&&<p style={{color:'#1a9b55'}}><b>{ok}</b><br/><small style={{color:'#64748b'}}>Email tidak masuk? <a href={TG}><u>Hubungi admin</u></a> untuk minta link reset manual.</small></p>}
  <button className="btn blue" disabled={busy} onClick={go}>{busy?'Memproses...':m==='login'?'Masuk':m==='register'?'Daftar':'Kirim link reset'}</button>{' '}
  <button className="btn sil" onClick={()=>sw(m==='register'?'login':m==='login'?'register':'login')}>{m==='login'?'Belum punya akun? Daftar':m==='register'?'Sudah punya akun? Masuk':'Kembali masuk'}</button>
  {m==='login'&&<p style={{marginTop:14}}><a href="#" onClick={e=>{e.preventDefault();sw('forgot')}}><u>Lupa password?</u></a></p>}</div>}
