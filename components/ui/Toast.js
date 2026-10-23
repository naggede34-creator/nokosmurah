'use client'
import {useEffect,useRef} from 'react'
import {AnimatePresence,motion} from 'framer-motion'
import {CheckCircle2,AlertTriangle,Info,Package,X} from 'lucide-react'

// Notifikasi pop-up gaya komik (dipakai dashboard & deposit). Nada otomatis dari isi pesan:
// merah = gagal/ditolak, hijau = berhasil/disalin, biru = info. Hilang sendiri setelah `ms` (bar waktu di bawah).
const TONE={
 err:{I:AlertTriangle,t:'WADUH!',c:'#ff5c8a'},
 ok:{I:CheckCircle2,t:'MANTAP!',c:'#34d399'},
 info:{I:Info,t:'INFO!',c:'#ffd23f'},
 stok:{I:Package,t:'LAGI RESTOK!',c:'#ffd23f'}}
export const toneOf=m=>/restok/i.test(m)?'stok':/gagal|tidak|ditolak|error|terlalu|kurang|belum|tunggu|salah|tutup|habis|dimatikan|kedaluwarsa/i.test(m)?'err':/disalin|berhasil|dibatalkan|kembali|nomor:|sukses|masuk/i.test(m)?'ok':'info'
export default function Toast({msg,onClose,ms=4200,tone}){
 const cb=useRef(onClose);cb.current=onClose
 useEffect(()=>{if(!msg)return;const t=setTimeout(()=>cb.current&&cb.current(),ms);return()=>clearTimeout(t)},[msg,ms])
 const k=tone||toneOf(String(msg||'')),T=TONE[k]
 return <AnimatePresence>{msg&&<motion.div key={msg} role="status" aria-live="polite" onClick={onClose}
  initial={{opacity:0,y:-50,scale:.7,rotate:-4}} animate={{opacity:1,y:0,scale:1,rotate:0}} exit={{opacity:0,y:-30,scale:.85}}
  transition={{type:'spring',stiffness:420,damping:20}} className={'cxt cxt-'+k}>
  <span className="cxt-ic" style={{background:T.c}}><T.I size={22} strokeWidth={2.6}/></span>
  <span className="cxt-tx"><b>{T.t}</b><span>{msg}</span></span>
  <button type="button" aria-label="Tutup notifikasi" className="cxt-x"><X size={16} strokeWidth={3}/></button>
  <i className="cxt-bar" style={{animationDuration:ms+'ms',background:T.c}}/>
 </motion.div>}</AnimatePresence>}
