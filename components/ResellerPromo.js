'use client'
import {useEffect,useState} from 'react'
import {createPortal} from 'react-dom'
import {usePathname} from 'next/navigation'
import {motion,AnimatePresence} from 'framer-motion'
// Popup ajakan ikut Bot Reseller. Muncul sekali tiap 3 hari, bisa ditutup, dan
// tidak pernah muncul di halaman yang sedang sibuk (admin, login, halaman reseller sendiri).
const KEY='arta-rs-promo'
const SKIP=['/reseller','/login','/register','/admin']
const JEDA=3*864e5
export default function ResellerPromo(){
 const p=usePathname()||'/'
 const [show,setShow]=useState(false)
 useEffect(()=>{
  if(SKIP.some(x=>p===x||p.startsWith(x+'/')))return
  let last=0;try{last=+localStorage.getItem(KEY)||0}catch(e){}
  if(Date.now()-last<JEDA)return
  const t=setTimeout(()=>setShow(true),2600)
  return ()=>clearTimeout(t)},[p])
 const tutup=()=>{try{localStorage.setItem(KEY,String(Date.now()))}catch(e){};setShow(false)}
 if(typeof document==='undefined')return null
 return createPortal(<AnimatePresence>{show&&<div className="rsp-wrap" role="dialog" aria-modal="true" aria-label="Ajakan bot reseller">
  <motion.div className="rsp-bg" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={tutup}/>
  <motion.div className="rsp-box" initial={{opacity:0,y:40,scale:.82,rotate:-3}} animate={{opacity:1,y:0,scale:1,rotate:0}}
   exit={{opacity:0,y:30,scale:.9}} transition={{type:'spring',stiffness:300,damping:22}}>
   <span className="rsp-pow">BARU!</span>
   <button className="rsp-x" onClick={tutup} aria-label="Tutup">✕</button>
   <h2>Jualan Nokos<br/><em>Tanpa Modal!</em></h2>
   <p>Punya bot Telegram sendiri? Jadikan <b>toko nokos</b> kamu. Pelanggan beli di botmu, untungnya masuk kantongmu.</p>
   <ul className="rsp-ul">
    <li><b>🏷 Set untung sendiri</b> — markup 0–100%, kamu yang tentukan</li>
    <li><b>💸 Tanpa modal</b> — uang pelanggan masuk duluan, nokos ditanggung kami</li>
    <li><b>🏧 Tarik otomatis</b> — cairkan untung ke e-wallet kapan saja</li></ul>
   <div className="rsp-row">
    <a className="rsp-go" href="/reseller" onClick={tutup}>Buat bot sekarang →</a>
    <button className="rsp-no" onClick={tutup}>Nanti saja</button></div>
  </motion.div></div>}</AnimatePresence>,document.body)}
