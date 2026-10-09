'use client'
import {useState,useEffect,useRef} from 'react'
import Mascot from '../../components/Mascot'
import {ting,unlock} from '../../components/sound'
const api=(p,b)=>fetch('/api/'+p,{method:b?'POST':'GET',headers:{'Content-Type':'application/json'},body:b?JSON.stringify(b):undefined}).then(r=>r.json())
// kecilkan foto di browser supaya muat (maks ~200KB)
const shrink=f=>new Promise((res,rej)=>{const r=new FileReader();r.onerror=rej;r.onload=()=>{const im=new Image();im.onerror=rej;im.onload=()=>{for(const [m,q] of [[900,.72],[700,.6],[520,.5]]){const k=Math.min(1,m/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=im.width*k;c.height=im.height*k;c.getContext('2d').drawImage(im,0,0,c.width,c.height);const o=c.toDataURL('image/jpeg',q);if(o.length<=280000)return res(o)}rej(new Error('big'))};im.src=r.result};r.readAsDataURL(f)})
export default function CS(){
 const [d,setD]=useState(null),[txt,setTxt]=useState(''),[img,setImg]=useState(''),[box,setBox]=useState(''),[err,setErr]=useState(''),[busy,setBusy]=useState(false)
 const ref=useRef(null),adm=useRef(null),file=useRef(null)
 useEffect(()=>{const u=()=>unlock();document.addEventListener('pointerdown',u);return()=>document.removeEventListener('pointerdown',u)},[])
 useEffect(()=>{let on=true;const f=async()=>{try{const r=await api('v1/cs');if(!on)return;if(r.error){if(/login|API key/i.test(r.error))location.href='/login';return}
   const c=r.msgs.filter(m=>m.from==='admin').length;if(adm.current!==null&&c>adm.current)ting();adm.current=c;setD(r)}catch(e){}}
  f();const t=setInterval(f,3000);return()=>{on=false;clearInterval(t)}},[])
 useEffect(()=>{if(ref.current)ref.current.scrollTop=ref.current.scrollHeight},[d&&d.msgs.length])
 useEffect(()=>{if(!err)return;const t=setTimeout(()=>setErr(''),4000);return()=>clearTimeout(t)},[err])
 const pick=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;try{setImg(await shrink(f))}catch(x){setErr('Foto tidak bisa dipakai / terlalu besar')}}
 const send=async()=>{if(busy||(!txt.trim()&&!img))return;setBusy(true);const r=await api('v1/cs',{text:txt,img}).catch(()=>({error:'Gagal terhubung'}));setBusy(false);if(r.error)return setErr(r.error);setTxt('');setImg('');adm.current=r.msgs.filter(m=>m.from==='admin').length;setD(r)}
 const open=!d||d.open
 return <div className="cx">
  <div className="cx-h"><a href="/dashboard" className="cx-bk">‹</a><div className="cxm"><Mascot/></div><div className="cx-t"><b>Customer Service</b><span className={open?'on':'off'}>{open?'● ONLINE':'● TUTUP'}</span></div></div>
  <div className="cx-c" ref={ref}>
   <div className={'cx-st '+(open?'o':'c')}>{open?'💥 CS buka! Kirim pesan atau foto kamu.':'😴 CS lagi istirahat. Kamu belum bisa kirim pesan.'}<small>Jam layanan: {d?d.hours:'09.00 - 17.00 dan 18.00 - 22.00 WIB'}</small></div>
   {d&&d.msgs.length===0&&<p className="cx-em">Belum ada obrolan. Ayo sapa admin! 👋</p>}
   {d&&d.msgs.map((m,i)=><div key={i} className={'cx-m '+m.from} style={{'--r':((i%3)-1)*.6+'deg'}}>
    {m.from==='admin'&&<em>ADMIN</em>}{m.img&&<img src={m.img} alt="foto" onClick={()=>setBox(m.img)}/>}{m.text&&<p>{m.text}</p>}<time>{new Date(m.at).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})}</time></div>)}
  </div>
  {err&&<div className="cx-er">{err}</div>}
  {img&&<div className="cx-pv"><img src={img} alt=""/><button onClick={()=>setImg('')}>✕</button></div>}
  <div className="cx-f"><input type="file" accept="image/*" hidden ref={file} onChange={pick}/>
   <button className="cx-b cam" disabled={!open} onClick={()=>file.current.click()} aria-label="Kirim foto">📷</button>
   <input disabled={!open} value={txt} onChange={e=>setTxt(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()} placeholder={open?'Tulis pesan...':'CS sedang tutup'} maxLength={1000}/>
   <button className="cx-b go" disabled={!open||busy||(!txt.trim()&&!img)} onClick={send} aria-label="Kirim">➤</button></div>
  {box&&<div className="cx-lb" onClick={()=>setBox('')}><img src={box} alt=""/></div>}
 </div>}
