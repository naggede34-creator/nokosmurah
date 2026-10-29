'use client'
import {useState,useRef,useEffect} from 'react'
// Potongan chat CS untuk panel admin: putar VN, rekam VN balasan.
const mmss=s=>String(Math.floor(s/60)).padStart(2,'0')+':'+String(Math.floor(s%60)).padStart(2,'0')
const pickMime=()=>{if(typeof MediaRecorder==='undefined')return '';for(const m of ['audio/webm;codecs=opus','audio/webm','audio/mp4','audio/ogg;codecs=opus'])if(MediaRecorder.isTypeSupported(m))return m;return ''}
const b64of=blob=>new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(String(r.result).split(',')[1]||'');r.onerror=no;r.readAsDataURL(blob)})
let cur=null   // satu pemutar aktif
export function VnPlay({call,uid,m}){
 const [st,setSt]=useState('idle')   // idle | load | play
 const a=useRef(null)
 useEffect(()=>()=>{if(a.current){a.current.pause();a.current=null}},[])
 const go=async()=>{
  if(a.current){if(a.current.paused){if(cur&&cur!==a.current)cur.pause();cur=a.current;a.current.play();setSt('play')}else{a.current.pause();setSt('idle')};return}
  setSt('load');const r=await call('cs/audio',{uid,id:m.aud.id});if(r.error){setSt('idle');return alert(r.error)}
  const au=new Audio('data:'+r.mime+';base64,'+r.b64);a.current=au;au.onended=()=>setSt('idle');au.onpause=()=>setSt('idle');au.onplay=()=>setSt('play')
  if(cur&&cur!==au)cur.pause();cur=au;au.play().catch(()=>setSt('idle'))}
 return <button type="button" onClick={go} className="btn sil" style={{display:'inline-flex',alignItems:'center',gap:8,margin:'2px 0'}}>{st==='load'?'…':st==='play'?'❚❚':'▶'} 🎤 Pesan suara · {mmss(m.aud.dur||0)}</button>}
export function VnRecord({onSend,disabled}){
 const [t,setT]=useState(null),mr=useRef(null),ch=useRef([]),tm=useRef(null),t0=useRef(0),cancel=useRef(false)
 useEffect(()=>()=>{clearInterval(tm.current);try{mr.current&&mr.current.state!=='inactive'&&(cancel.current=true,mr.current.stop())}catch(e){}},[])
 const start=async()=>{
  if(!navigator.mediaDevices||typeof MediaRecorder==='undefined')return alert('Browser belum mendukung rekam suara')
  try{const s=await navigator.mediaDevices.getUserMedia({audio:true}),mime=pickMime(),r=new MediaRecorder(s,{...(mime?{mimeType:mime}:{}),audioBitsPerSecond:24000})
   ch.current=[];cancel.current=false;mr.current=r;t0.current=Date.now()
   r.ondataavailable=e=>{if(e.data&&e.data.size)ch.current.push(e.data)}
   r.onstop=async()=>{s.getTracks().forEach(x=>x.stop());clearInterval(tm.current);setT(null);if(cancel.current)return
    const dur=Math.round((Date.now()-t0.current)/1000);if(dur<1)return alert('Terlalu pendek')
    const blob=new Blob(ch.current,{type:r.mimeType||mime||'audio/webm'});if(blob.size>580*1024)return alert('Terlalu besar, rekam lebih singkat')
    onSend({b64:await b64of(blob),mime:blob.type,dur})}
   r.start(250);setT(0);tm.current=setInterval(()=>{const x=Math.floor((Date.now()-t0.current)/1000);setT(x);if(x>=60&&r.state!=='inactive')r.stop()},250)
  }catch(e){alert('Mikrofon tidak bisa dipakai / izin ditolak')}}
 const stop=k=>{cancel.current=!k;try{mr.current&&mr.current.state!=='inactive'&&mr.current.stop()}catch(e){}}
 if(t!==null)return <><span style={{color:'#e11d48',fontWeight:900}}>● {mmss(t)}</span><button type="button" className="btn blue" onClick={()=>stop(true)}>Kirim VN</button><button type="button" className="btn sil" onClick={()=>stop(false)}>✕</button></>
 return <button type="button" className="btn sil" disabled={disabled} onClick={start} aria-label="Rekam pesan suara" title="Rekam pesan suara">🎤</button>}
