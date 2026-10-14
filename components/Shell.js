'use client'
import {usePathname} from 'next/navigation'
import {useTapDoor} from './tapdoor'
import Popup from './Popup'
import Intro from './Intro'
// Halaman yang tampil penuh layar (punya header/latar sendiri) tidak memakai header & .wrap bawaan.
const FULL=['/','/login','/register','/deposit']
// Tulisan kecil "Artapedia ID" di header: ketukan tunggal tetap membuka beranda,
// ketukan beruntun menghitung menuju pintu rahasia panel admin.
function Brand(){
 const door=useTapDoor(()=>{location.href='/'})
 return <a href="/" className={'brand'+(door.n>1?' tapping':'')} onPointerDown={door.tap}>
  <img src="/maskot.webp" alt="" width="34" height="34"/> Artapedia ID{door.n>1&&<em className="brand-n">{door.n}</em>}</a>}
export default function Shell({children}){
 const p=usePathname()||'/'
 if(FULL.includes(p)||p==='/pay'||p.startsWith('/pay/'))return <><Intro/>{children}<Popup/></>
 return <>
  <Intro/>
  <header className="nav"><Brand/><nav><a href="/">Beranda</a><a href="/pengumuman">Pengumuman</a><a href="/leaderboard">Leaderboard</a><a href="/docs">API</a><a href="/dashboard" className="cta">Dashboard</a></nav></header>
  <div className="wrap">{children}</div><Popup/></>}
