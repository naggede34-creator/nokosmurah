'use client'
import {useRef,useState,useCallback,useEffect} from 'react'
// Pintu rahasia: ketuk tulisan "Artapedia ID" berkali-kali untuk membuka panel admin.
// Dipakai di dua tempat: tulisan kecil di header dan tulisan besar di kaki dashboard.
//
// Catatan rancangan:
//  - memakai pointerdown, bukan click: di HP lebih cepat & tidak tertelan "double-tap to zoom".
//  - jeda antar ketukan boleh sampai 5 detik, jadi tidak perlu mengetuk secepat kilat.
//  - server dipanggil SEKALI setelah ketukan berhenti (bukan tiap ketukan), jadi tidak
//    membanjiri server dan tidak kena batas percobaan.
//  - kalau dipasang di sebuah tautan, ketukan tunggal tetap membuka tautannya (ditunda sesaat
//    untuk memastikan itu memang ketukan tunggal, bukan awal rentetan).
export const TAP_RESET=5000      // jeda yang mengulang hitungan dari nol
export const TAP_WAIT=320        // jeda sebelum laporan ke server dikirim

// onSingle: dipanggil kalau ternyata itu cuma ketukan tunggal (dipakai di header, untuk
//   tetap membuka beranda). wait: jeda penentu; di tautan harus LEBIH LAMA dari jarak
//   ketukan santai manusia (±400 ms), supaya ketukan pelan tidak keburu dianggap tunggal.
export function useTapDoor(onSingle,wait){
 const WAIT=wait||(onSingle?750:TAP_WAIT)
 const [n,setN]=useState(0),[msg,setMsg]=useState('')
 const last=useRef(0),cnt=useRef(0),timer=useRef(0),single=useRef(onSingle)
 single.current=onSingle
 useEffect(()=>()=>clearTimeout(timer.current),[])
 const tap=useCallback(e=>{
  if(e&&e.preventDefault)e.preventDefault()
  const now=Date.now()
  const c=now-last.current>TAP_RESET?1:cnt.current+1
  last.current=now;cnt.current=c;setN(c)
  clearTimeout(timer.current)
  timer.current=setTimeout(async()=>{
   const total=cnt.current
   // Ketukan tunggal: hanya berarti di tautan (header) — buka tautannya.
   // Di tulisan biasa (kaki dashboard) hitungan DIBIARKAN, supaya ketukan santai
   // tetap menumpuk sampai batas ulang 5 detik tercapai.
   if(total<=1){if(single.current){cnt.current=0;setN(0);single.current()};return}
   if(total<3)return
   try{
    const r=await fetch('/api/v1/tap',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({n:total})})
    const d=await r.json()
    if(d&&d.token){cnt.current=0;setN(0);try{localStorage.setItem('adm_tok',JSON.stringify({t:d.token,at:Date.now()}))}catch(e){}location.href='/admin?t='+d.token;return}
    // 'kurang' = ketukan belum cukup: DIAMKAN dan biarkan hitungan jalan terus.
    // (Dulu ini ikut menghapus hitungan, sehingga ketukan yang santai tidak pernah sampai tujuan.)
    if(d&&d.code&&d.code!=='kurang'){cnt.current=0;setN(0);setMsg(d.error||'Ditolak');setTimeout(()=>setMsg(''),4500)}
   }catch(err){}
  },WAIT)
 },[WAIT])
 return {n,msg,tap}}
