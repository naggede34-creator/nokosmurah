'use client'
import Mascot from '../components/Mascot'
import {Announcements,Leaderboard,useBoard} from '../components/Boards'
const F=[['⚡','Otomatis','Nomor & kode OTP masuk tanpa nunggu admin'],['💸','Harga Murah','Beberapa server, pilih yang paling hemat'],['🛡️','Jaminan OTP','Kode telat? Nomor diganti otomatis atau saldo balik'],['🔌','API Siap Pakai','Sambungkan ke web atau bot kamu'],['💳','Deposit QRIS','Mulai dari Rp2.000, saldo masuk otomatis'],['💬','Customer Service','Chat langsung dengan admin saat jam layanan'],['🎁','Bonus Deposit','Cashback saldo otomatis tiap kamu isi saldo'],['🤝','Ajak Teman','Bagikan kode ajakan, kamu dan temanmu dapat saldo']]
const S=[['1','Daftar & masuk','Buat akun gratis pakai email.'],['2','Isi saldo','Deposit lewat QRIS, minimal Rp2.000.'],['3','Pilih nomor','Pilih server, aplikasi, negara lalu ORDER.'],['4','Terima OTP','Kode muncul otomatis di halaman Nokos.']]
export default function H(){
 const d=useBoard()
 return <>
 <section className="lp-hero"><div className="lp-glow"/><div className="lp-txt">
  <span className="lp-pill"><i/> Server aktif · pesanan diproses otomatis</span>
  <h1>Nokos &amp; OTP <em>otomatis</em>,<br/>murah dan cepat.</h1>
  <p>Beli nomor virtual untuk verifikasi WhatsApp, Telegram dan ratusan aplikasi lain. Deposit QRIS instan, refund otomatis kalau kode tidak masuk.</p>
  <div className="lp-cta"><a className="lp-btn pri" href="/login">Mulai sekarang →</a><a className="lp-btn" href="#cara">Cara beli OTP</a><a className="lp-btn ghost" href="/docs">API Docs</a></div>
  <div className="lp-stats"><div><b>{d?d.users.toLocaleString('id-ID'):'–'}</b><span>Pengguna</span></div><div><b>{d?d.orders.toLocaleString('id-ID'):'–'}</b><span>OTP sukses</span></div><div><b>24/7</b><span>Pesan otomatis</span></div></div>
 </div><div className="lp-art"><Mascot/></div></section>
 <section className="lp-sec"><h2>Kenapa Artapedia ID?</h2><div className="lp-grid">{F.map(f=><div className="lp-feat" key={f[1]}><div className="lp-ic">{f[0]}</div><b>{f[1]}</b><p>{f[2]}</p></div>)}</div></section>
 <section className="lp-sec" id="cara"><h2>Cara membeli OTP</h2><div className="lp-steps">{S.map(s=><div key={s[0]} className="lp-step"><span>{s[0]}</span><b>{s[1]}</b><p>{s[2]}</p></div>)}</div></section>
 <section className="lp-sec"><div className="lp-hd"><h2>Pengumuman terbaru</h2><a href="/pengumuman">Lihat semua →</a></div><Announcements limit={3} dense/></section>
 <section className="lp-sec"><div className="lp-hd"><h2>🏆 Leaderboard</h2><a href="/leaderboard">Selengkapnya →</a></div><Leaderboard limit={5} data={d}/></section>
 <section className="lp-sec lp-tnc"><h2>Syarat &amp; Ketentuan</h2><ul><li>Saldo yang sudah masuk tidak dapat ditarik.</li><li>Nomor yang tidak menerima OTP otomatis direfund.</li><li>Dilarang dipakai untuk tindakan melanggar hukum.</li><li>Akun melanggar aturan dapat dibanned.</li></ul></section>
 <footer className="lp-foot">© Artapedia ID · Penyedia layanan OTP berbasis nomor tanpa kartu fisik</footer></>}
