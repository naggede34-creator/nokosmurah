import Mascot from '../components/Mascot'
const F=[['⚡','Otomatis','Nomor & OTP masuk tanpa admin'],['💸','Murah','Beberapa server, harga terbaik'],['🔌','API Siap Pakai','Sambungkan ke web / bot kamu'],['🛡️','Refund Otomatis','Gagal / expired, saldo balik']]
export default function H(){return <>
<div className="hero"><div><h1>Artapedia ID</h1><p style={{fontSize:18}}>Nokos & OTP otomatis, murah, cepat. Deposit QRIS instan dan API untuk bot kamu.</p>
<a className="btn blue" href="/login">Mulai Sekarang</a> <a className="btn" href="#cara">Cara Beli OTP</a> <a className="btn sil" href="/docs">API Docs</a></div><Mascot/></div>
<div className="feat">{F.map(f=><div className="card" key={f[1]}><div style={{fontSize:34}}>{f[0]}</div><b>{f[1]}</b><p>{f[2]}</p></div>)}</div>
<div className="card" id="cara"><h2>Cara Membeli OTP</h2><ol><li>Daftar / masuk, lalu isi saldo lewat QRIS.</li><li>Pilih server, layanan & negara, klik harga untuk membeli.</li><li>Nomor muncul, pakai untuk daftar di aplikasi.</li><li>Kode OTP masuk otomatis. Belum masuk? Order bisa dibatalkan setelah 2 menit dan saldo kembali.</li></ol></div>
<div className="card"><h2>Syarat & Ketentuan</h2><ul><li>Saldo yang sudah masuk tidak dapat ditarik.</li><li>Nomor yang tidak menerima OTP otomatis direfund.</li><li>Dilarang dipakai untuk tindakan melanggar hukum.</li><li>Akun melanggar aturan dapat dibanned.</li></ul></div></>}
