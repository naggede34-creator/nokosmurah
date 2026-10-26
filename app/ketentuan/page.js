import './ketentuan.css'
export const metadata={title:'Ketentuan Web - Artapedia ID',description:'Ketentuan penggunaan Artapedia ID: saldo, deposit, order nokos, refund, larangan, dan sanksi.'}
// Halaman publik (bisa dibaca sebelum daftar). Perubahan isi: cukup edit daftar BAGIAN di bawah.
const BAGIAN=[
 ['💰','Saldo web (PENTING)',true,[
  'Saldo di web ini <b>hanya untuk membeli nokos</b> dan layanan yang tersedia di web. Saldo <b>bukan uang elektronik / rekening</b>.',
  'Saldo <b>TIDAK bisa di-refund / di-reff / ditarik / dikembalikan ke e-wallet, bank, atau QRIS</b> dalam kondisi apa pun. Deposit yang sudah masuk menjadi saldo web dan bersifat final.',
  'Jangan meminta pengembalian dana ke e-wallet / bank. Permintaan seperti itu <b>tidak akan diproses</b>, sebaiknya jangan deposit lebih dari yang kamu butuhkan.',
  'Saldo tidak dapat dipindahkan, dijual, atau dipinjamkan ke akun lain di luar fitur resmi web.']],
 ['⚠️','Sanksi pelanggaran',true,[
  'Memaksa / mengancam / mengganggu admin untuk refund saldo ke e-wallet, atau melakukan <b>chargeback / pengaduan palsu</b> ke e-wallet, bank, atau pihak lain, berakibat <b>akun diblokir permanen dan sisa saldo hangus</b>.',
  'Kasus penipuan, pemerasan, atau penyalahgunaan dapat <b>diumumkan sebagai peringatan kepada pengguna lain</b> (identitas disamarkan) dan dilaporkan ke pihak berwenang bila perlu.',
  'Akun ganda, penyalahgunaan bonus (referral, cashback, voucher, job), dan manipulasi sistem membatalkan bonusnya dan dapat membuat akun diblokir.']],
 ['📱','Order nomor (nokos)',false,[
  'Nomor yang <b>tidak menerima OTP</b> sampai batas waktu akan <b>direfund otomatis ke saldo web</b> (bukan ke e-wallet / bank).',
  'Order yang sudah <b>sukses (kode OTP / kode login masuk) tidak bisa dibatalkan</b> dan tidak ada pengembalian saldo.',
  'Order baru bisa dibatalkan <b>setelah 3 menit</b> sejak dibuat dan selama OTP belum masuk.',
  'Server <b>Telegram Siap Pakai</b>: nomor langsung menjadi milikmu setelah dibeli sehingga <b>tidak bisa dibatalkan</b>. Saldo hanya kembali otomatis bila kode login tidak pernah bisa diambil sampai batas waktu atau session sudah mati sebelum ada kode.',
  'Harga, stok, dan ketersediaan negara / server bisa berubah sewaktu-waktu mengikuti penyedia. Harga yang berlaku adalah harga saat order dibuat.']],
 ['🧾','Deposit',false,[
  'Deposit lewat QRIS: bayar <b>sesuai total yang tertera</b> sebelum batas waktu. Saldo masuk otomatis setelah pembayaran terdeteksi.',
  'Sudah membayar tapi saldo belum masuk? Hubungi Customer Service <b>maksimal 24 jam</b> dengan bukti bayar. Kesalahan yang terbukti diselesaikan dengan <b>mengkreditkan saldo</b>, bukan mengembalikan uang.',
  'Pembayaran setelah QRIS kedaluwarsa atau dengan nominal yang salah bisa tertunda dan butuh pengecekan manual.',
  'Biaya QRIS / penyedia pembayaran sudah termasuk dalam total bayar dan tidak dikembalikan.']],
 ['🚫','Larangan',false,[
  'Dilarang memakai nomor / layanan untuk <b>penipuan, phishing, judi online, spam, pornografi anak, pencucian uang, atau kegiatan melanggar hukum</b> lainnya.',
  'Dilarang menyerang, membebani (flood / scraping berlebihan), atau mencoba menembus sistem web, API, dan bot.',
  'Dilarang membagikan atau menjual ulang API key dan akses akunmu. Semua aktivitas di akunmu menjadi tanggung jawabmu.']],
 ['🤝','Tanggung jawab layanan',false,[
  'Nomor berasal dari penyedia pihak ketiga. Kami <b>tidak menjamin</b> aplikasi tujuan menerima nomor tertentu atau tidak memblokir akun yang dibuat dengannya.',
  'Pemblokiran akun di aplikasi tujuan, kehilangan akses nomor setelah OTP diterima, atau kerugian akibat penyalahgunaan di luar kendali kami bukan tanggung jawab kami.',
  'Layanan bisa maintenance atau terganggu sewaktu-waktu. Kami berusaha menjaga ketersediaan tetapi tidak menjamin layanan selalu aktif tanpa gangguan.']],
 ['🔑','Akun, API, dan bot',false,[
  'Jaga kerahasiaan password, API key, dan token bot. Jika bocor, segera ganti. Kerugian akibat akun yang bocor tidak dapat diganti.',
  'Pemakaian API dan bot reseller tunduk pada batas penggunaan (rate limit) dan aturan yang sama dengan ketentuan ini.',
  'Admin dapat menonaktifkan akses API / bot yang disalahgunakan tanpa pemberitahuan.']],
 ['🔒','Privasi',false,[
  'Data akun, riwayat transaksi, dan alamat IP dicatat untuk operasional dan keamanan. Data tidak dijual ke pihak lain.',
  'Data dapat diberikan kepada pihak berwenang bila diwajibkan oleh hukum.']],
 ['📝','Perubahan & persetujuan',false,[
  'Ketentuan dapat diperbarui sewaktu-waktu. Versi terbaru selalu ada di halaman ini.',
  'Dengan mendaftar, deposit, atau memakai layanan, kamu dianggap <b>telah membaca dan menyetujui</b> seluruh ketentuan ini.',
  'Ada pertanyaan atau kendala? Hubungi Customer Service lebih dulu, kami usahakan diselesaikan secara baik-baik.']]]
export default function Ketentuan(){return <div className="kt-wrap">
 <a className="kt-back" href="/dashboard">‹ Kembali</a>
 <div className="pg-head"><span className="bd-chip">📜 Wajib dibaca</span><h1>Ketentuan Web</h1><p>Aturan memakai Artapedia ID: saldo, deposit, order, dan sanksi. Berlaku sejak 26 Oktober 2026.</p></div>
 <div className="kt-warn">🔔 <b>Ringkasnya:</b> saldo hanya untuk membeli nokos. <b>Tidak bisa di-refund / ditarik ke e-wallet atau bank.</b> Yang ngotot meminta refund atau melakukan pengaduan palsu: <b>akun diblokir permanen dan kasusnya bisa dijadikan peringatan publik.</b> Baca sebelum deposit ya.</div>
 {BAGIAN.map(([ic,t,keras,li],i)=><section key={t} className={'kt-sec'+(keras&&i===1?' kt-no':'')}><h2><i>{i+1}</i>{ic} {t}</h2><ul>{li.map((x,j)=><li key={j} dangerouslySetInnerHTML={{__html:x}}/>)}</ul></section>)}
 <div className="kt-cta"><a href="/cs">💬 Hubungi Customer Service</a><a href="/dashboard">🏠 Dashboard</a><a href="/docs">📘 Dokumentasi API</a></div>
 <p className="kt-meta">Artapedia ID · Ketentuan Web v1 · diperbarui 26 Oktober 2026</p></div>}
