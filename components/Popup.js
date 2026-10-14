'use client'
import {useEffect,useState} from 'react'
import {createPortal} from 'react-dom'
import {usePathname} from 'next/navigation'
import {motion,AnimatePresence} from 'framer-motion'
// Popup promosi yang isinya diatur admin (/admin › Isi situs › Popup promosi):
// judul, teks, gambar, tema warna, tombol-tombol, jeda tampil, dan halaman yang dilewati.
// Satu popup = satu penanda di localStorage, jadi "jeda x hari" dihitung per popup.
const KEY=p=>'arta-pop-'+p
const list=s=>String(s||'').split(',').map(x=>x.trim()).filter(Boolean)
const cocok=(pola,path)=>pola.some(x=>x==='*'||path===x||path.startsWith(x.replace(/\/+$/,'')+'/'))
export default function Popup(){
 const path=usePathname()||'/'
 const [pops,setPops]=useState([])
 const [cur,setCur]=useState(null)
 useEffect(()=>{let on=true
  fetch('/api/v1/promo').then(r=>r.json()).then(d=>{if(on&&!d.error)setPops(Array.isArray(d.pops)?d.pops:[])}).catch(()=>{})
  return()=>{on=false}},[])
 useEffect(()=>{
  if(!pops.length){setCur(null);return}
  const siap=pops.filter(p=>{
   const only=list(p.only),skip=list(p.skip)
   if(only.length&&!cocok(only,path))return false
   if(skip.length&&cocok(skip,path))return false
   if(+p.days>0){let last=0;try{last=+localStorage.getItem(KEY(p.id))||0}catch(e){}
    if(Date.now()-last<+p.days*864e5)return false}
   return true})
  if(!siap.length){setCur(null);return}
  const p=siap[0]
  const t=setTimeout(()=>setCur(p),Math.max(0,(+p.delay||0)*1000))
  return()=>clearTimeout(t)},[pops,path])
 const tutup=()=>{if(cur){try{localStorage.setItem(KEY(cur.id),String(Date.now()))}catch(e){}}
  setPops(x=>x.filter(y=>y.id!==(cur||{}).id));setCur(null)}
 if(typeof document==='undefined'||!cur)return null
 const baris=String(cur.body||'').split('\n').map(x=>x.trim()).filter(Boolean)
 return createPortal(<AnimatePresence>
  <div className="rsp-wrap" role="dialog" aria-modal="true" aria-label={cur.title}>
   <motion.div className="rsp-bg" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={tutup}/>
   <motion.div className={'rsp-box th-'+(cur.theme||'pink')} initial={{opacity:0,y:40,scale:.82,rotate:-3}} animate={{opacity:1,y:0,scale:1,rotate:0}}
    exit={{opacity:0,y:30,scale:.9}} transition={{type:'spring',stiffness:300,damping:22}}>
    {cur.badge?<span className="rsp-pow">{cur.badge}</span>:null}
    <button className="rsp-x" onClick={tutup} aria-label="Tutup">✕</button>
    {cur.img?<img className="rsp-img" src={cur.img} alt=""/>:null}
    <h2>{cur.title}</h2>
    {baris.length>0&&<div className="rsp-tx">
     {baris.filter(x=>!/^[•\-*]/.test(x)).map((x,i)=><p key={'p'+i}>{x}</p>)}
     {baris.some(x=>/^[•\-*]/.test(x))&&<ul className="rsp-ul">
      {baris.filter(x=>/^[•\-*]/.test(x)).map((x,i)=><li key={'l'+i}>{x.replace(/^[•\-*]\s*/,'')}</li>)}</ul>}</div>}
    {(cur.btns||[]).length>0&&<div className="rsp-row">
     {cur.btns.map((b,i)=>b.kind==='no'||!b.href
      ?<button key={i} className="rsp-no" onClick={tutup}>{b.t}</button>
      :<a key={i} className="rsp-go" href={b.href} onClick={tutup}>{b.t}</a>)}</div>}
   </motion.div></div></AnimatePresence>,document.body)}
