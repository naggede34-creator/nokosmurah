'use client'
import {usePathname} from 'next/navigation'
import ResellerPromo from './ResellerPromo'
// Halaman yang tampil penuh layar (punya header/latar sendiri) tidak memakai header & .wrap bawaan.
const FULL=['/','/login','/register','/deposit']
export default function Shell({children}){
 const p=usePathname()||'/'
 if(FULL.includes(p)||p==='/pay'||p.startsWith('/pay/'))return <>{children}<ResellerPromo/></>
 return <>
  <header className="nav"><a href="/" className="brand"><span>🌍</span> Artapedia ID</a><nav><a href="/">Beranda</a><a href="/pengumuman">Pengumuman</a><a href="/leaderboard">Leaderboard</a><a href="/docs">API</a><a href="/dashboard" className="cta">Dashboard</a></nav></header>
  <div className="wrap">{children}</div><ResellerPromo/></>}
