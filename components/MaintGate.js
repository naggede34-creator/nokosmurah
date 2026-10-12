'use client'
import {useState,useEffect} from 'react'
import {usePathname} from 'next/navigation'
// Layar / banner maintenance seluruh situs (diatur admin > Maintenance). Halaman /admin tidak pernah ditutup.
export default function MaintGate(){
 const path=usePathname()||'',[m,setM]=useState(null)
 useEffect(()=>{let live=true;const f=()=>fetch('/api/maintenance',{cache:'no-store'}).then(r=>r.json()).then(d=>{if(live&&d&&!d.error)setM(d)}).catch(()=>{})
  f();const t=setInterval(f,60000);return()=>{live=false;clearInterval(t)}},[])
 if(!m||!m.on||path.startsWith('/admin'))return null
 const msg=m.msg||'Kami sedang melakukan perawatan sistem. Mohon coba lagi beberapa saat lagi.'
 if(m.mode==='soft')return <div role="status" style={{position:'fixed',top:0,left:0,right:0,zIndex:9998,background:'#f59e0b',color:'#1f1300',padding:'9px 14px',fontSize:13.5,fontWeight:800,textAlign:'center',boxShadow:'0 4px 14px rgba(0,0,0,.2)'}}>🛠 {msg} <span style={{fontWeight:600}}>(pesanan &amp; deposit baru dihentikan sementara)</span></div>
 return <div role="alert" style={{position:'fixed',inset:0,zIndex:9999,display:'grid',placeItems:'center',padding:24,background:'linear-gradient(160deg,#eef4ff,#dfe9ff)',color:'#1f2b4d',fontFamily:'inherit',overflowY:'auto'}}>
  <div style={{maxWidth:460,width:'100%',textAlign:'center',background:'#fff',border:'3px solid #1f2b4d',borderRadius:24,boxShadow:'6px 8px 0 #1f2b4d',padding:'32px 24px'}}>
   <div style={{fontSize:64,lineHeight:1}}>🛠️</div>
   <h1 style={{margin:'14px 0 8px',fontSize:26,fontWeight:900}}>Sedang Maintenance</h1>
   <p style={{margin:0,fontSize:15.5,lineHeight:1.6,whiteSpace:'pre-line'}}>{msg}</p>
   <p style={{margin:'14px 0 0',fontSize:13,opacity:.75}}>Saldo dan pesanan aktifmu aman. Order yang belum dapat kode tetap diproses dan di-refund otomatis bila gagal.</p>
   <button onClick={()=>location.reload()} style={{marginTop:20,cursor:'pointer',border:'3px solid #1f2b4d',borderRadius:14,background:'#2563eb',color:'#fff',fontWeight:900,fontSize:15,padding:'11px 22px',boxShadow:'0 4px 0 #1f2b4d'}}>Coba lagi</button>
  </div></div>}
