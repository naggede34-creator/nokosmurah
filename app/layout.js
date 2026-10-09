import './globals.css'
import CsFab from '../components/CsFab'
export const metadata={title:'Artapedia ID - Nokos & OTP Otomatis',description:'Beli nomor OTP murah, cepat, otomatis'}
export default function L({children}){return <html lang="id"><body>
<header className="nav"><a href="/" className="brand"><span>🌍</span> Artapedia ID</a><nav><a href="/">Beranda</a><a href="/pengumuman">Pengumuman</a><a href="/leaderboard">Leaderboard</a><a href="/docs">API</a><a href="/dashboard" className="cta">Dashboard</a></nav></header>
<div className="wrap">{children}</div><CsFab/></body></html>}
