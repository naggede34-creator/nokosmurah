import './ketentuan.css'
export const metadata={title:'Ketentuan Web - Artapedia ID',description:'Ketentuan penggunaan Artapedia ID: saldo, deposit, order nokos, suntik sosmed, produk digital, reseller, refund, larangan, dan sanksi.'}
// Halaman publik (bisa dibaca sebelum daftar). Perubahan isi: cukup edit daftar BAGIAN / FAQ di bawah.
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
 ['🚀','Suntik Sosmed (followers, likes, views)',false,[
  'Layanan dikerjakan oleh <b>penyedia pihak ketiga</b>. Kecepatan, jumlah, dan kualitas mengikuti keterangan tiap layanan. Hasil <b>tidak dijamin permanen</b>: akun bisa turun jumlahnya (drop) karena kebijakan platform.',
  'Pastikan <b>link / username benar</b> dan akun target <b>tidak digembok / private</b>. Jangan membuat dua pesanan di link yang sama sebelum yang pertama selesai. Kesalahan link dari pembeli <b>tidak dapat direfund</b>.',
  'Pesanan yang <b>hanya terkirim sebagian</b> otomatis di-refund ke saldo web sebesar sisanya. Pesanan yang <b>dibatalkan penyedia</b> dikembalikan penuh ke saldo web.',
  'Tombol <b>Batal</b> hanya tersedia untuk layanan yang mendukungnya dan <b>tergantung persetujuan penyedia</b>. Pesanan yang sudah berjalan bisa ditolak untuk dibatalkan.',
  '<b>Refill</b> hanya untuk layanan bertanda ♻️ dan pesanan yang sudah selesai, mengikuti aturan garansi layanan itu. Penyedia dapat menolak refill yang tidak memenuhi syarat.',
  'Dilarang memesan untuk akun yang melanggar hukum atau untuk tujuan penipuan. Kami tidak bertanggung jawab atas sanksi platform (suspend / banned) terhadap akun yang kamu suntik.']],
 ['🛒','Produk Lainnya (produk digital)',false,[
  'Produk digital (akun, voucher, file, foto, link, teks) <b>dikirim otomatis begitu pembayaran berhasil</b> dan bisa dibuka lagi di <b>Pembelian Saya</b>.',
  'Karena datanya langsung diterima, produk digital <b>tidak dapat dikembalikan / dibatalkan</b> setelah terkirim. Baca deskripsi produk dengan teliti sebelum membeli.',
  'Jika data yang diterima <b>terbukti tidak bisa dipakai</b> sejak awal, hubungi CS <b>maksimal 24 jam</b> beserta bukti. Penyelesaiannya berupa produk pengganti atau <b>kredit saldo web</b>, bukan uang tunai.',
  'Simpan datamu dengan aman. Produk <b>tidak boleh disebarluaskan atau dijual ulang</b> kecuali deskripsinya mengizinkan.']],
 ['🔢','Beli banyak nomor sekaligus (bulk)',false,[
  'Kamu bisa membeli <b>sampai 10 nomor</b> dalam satu kali order. Nomor dipesan satu per satu dan harganya dihitung per nomor.',
  'Kalau di tengah jalan stok habis atau saldo kurang, <b>nomor yang sudah berhasil tetap menjadi milikmu</b> dan sisanya tidak dipesan. Saldo hanya terpotong untuk nomor yang berhasil.',
  'Setiap nomor diperlakukan sebagai <b>order terpisah</b>: aturan OTP, batas waktu, pembatalan, dan refund otomatis berlaku sendiri-sendiri.']],
 ['🏪','Reseller dan penarikan keuntungan',false,[
  'Pemilik bot reseller bertanggung jawab atas toko, harga jual, dan pelanggannya sendiri. Keuntungan reseller cair <b>setelah pesanan sukses</b>.',
  'Penarikan saldo reseller diproses <b>manual oleh admin</b>. Saat kamu mengajukan, saldo <b>langsung ditahan</b>. Penarikan <b>sukses</b> berarti dana sudah ditransfer ke tujuan yang kamu isi; <b>ditolak</b> berarti saldo kembali utuh ke dompet toko.',
  '<b>Periksa nomor dan nama pemilik</b> sebelum mengajukan. Transfer yang sudah terkirim ke data yang kamu isi <b>tidak dapat ditarik kembali</b> bila datanya salah.',
  'Setiap tahap penarikan (diproses, sukses, ditolak) dikabarkan lewat notifikasi dan struk. Batas minimum dan jumlah penarikan yang boleh menunggu dapat berubah sewaktu-waktu.']],
 ['💬','Customer Service dan pesan suara',false,[
  'Chat CS bisa berupa teks, foto, dan <b>pesan suara (VN)</b>. Hubungi CS di jam layanan; di luar jam, pesanmu tetap tersimpan dan dibalas saat CS buka.',
  'Kamu dapat <b>menghapus pesanmu sendiri</b> kapan saja. Pesan yang dihapus hilang dari percakapan, tetapi <b>salinan yang sudah diteruskan ke admin lewat notifikasi tidak dapat ditarik</b>.',
  'Dilarang mengirim konten <b>kasar, ancaman, pornografi, atau spam</b> lewat chat dan VN. Pelanggaran dapat berujung pembatasan akun.',
  'Jangan membagikan <b>password, kode OTP, atau PIN</b> lewat chat. Admin tidak pernah memintanya.']],
 ['🔔','Notifikasi dan pesan otomatis',false,[
  'Kami mengirim <b>notifikasi transaksi</b> (order, OTP, deposit, penarikan, struk) lewat web, HP, dan Telegram. Notifikasi ini bagian dari layanan.',
  'Bot Telegram dapat mengirim <b>pesan sapaan harian</b> (pagi, siang, menjelang Magrib, malam) berisi semangat, jadwal Magrib, dan info layanan. Kamu bisa berhenti menerimanya dengan <b>memblokir / menghentikan bot</b>.',
  'Jadwal Magrib dihitung otomatis untuk wilayah acuan dan bisa berbeda beberapa menit di daerahmu. Gunakan sebagai pengingat, bukan rujukan resmi ibadah.']],
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

const RINGKAS=[['💰','Saldo itu final','Hanya untuk beli di web. Tidak bisa ditarik / di-refund ke e-wallet atau bank.'],['📱','OTP tak masuk? Aman','Nomor tanpa OTP sampai batas waktu dikembalikan otomatis ke saldo web.'],['🧾','Digital = langsung kirim','Produk digital dan suntik sosmed diproses otomatis. Cek data sebelum order.'],['⛔','Sanksi tegas','Memaksa refund atau pengaduan palsu: akun diblokir permanen, saldo hangus.']]
const FAQ=[['Saya salah deposit, bisa dikembalikan ke e-wallet?','Tidak. Deposit menjadi saldo web yang bersifat final. Kalau pembayaranmu sudah masuk tapi saldo belum bertambah, hubungi CS maksimal 24 jam dengan bukti bayar, nanti dikreditkan ke saldo.'],['Nomor tidak menerima OTP, uang saya bagaimana?','Kalau sampai batas waktu OTP tidak masuk, saldo dikembalikan otomatis ke saldo web. Kamu tidak perlu mengajukan apa pun.'],['Followers yang saya beli berkurang, apa bisa refill?','Bisa untuk layanan bertanda ♻️ sesuai garansinya. Buka halaman Suntik Sosmed, pilih pesanan yang sudah selesai, lalu tekan Refill.'],['Produk digital sudah dikirim tapi saya berubah pikiran.','Produk digital tidak bisa dikembalikan setelah datanya terkirim. Karena itu baca deskripsi produk dulu sebelum membeli.'],['Berapa lama penarikan reseller diproses?','Diproses manual oleh admin. Kamu mendapat notifikasi dan struk saat statusnya berubah menjadi sukses atau ditolak.'],['Bagaimana berhenti menerima pesan sapaan harian dari bot?','Hentikan atau blokir bot di Telegram. Notifikasi transaksi lewat web tetap berjalan.']]
export default function Ketentuan(){return <div className="kt-wrap">
 <a className="kt-back" href="/dashboard">‹ Kembali</a>
 <header className="kt-hero"><span className="kt-chip">📜 WAJIB DIBACA</span><h1>KETENTUAN<br/><em>WEB</em></h1><p>Aturan memakai Artapedia ID: saldo, deposit, order nokos, suntik sosmed, produk digital, reseller, dan sanksi. Singkat di atas, lengkap di bawah.</p>
  <div className="kt-ver"><b>Versi 2</b><span>Berlaku sejak 28 Oktober 2026</span></div></header>
 <section className="kt-sum" aria-label="Ringkasan cepat">{RINGKAS.map(([ic,t,d])=><div key={t} className="kt-card"><i>{ic}</i><b>{t}</b><p>{d}</p></div>)}</section>
 <nav className="kt-toc" aria-label="Daftar bagian">{BAGIAN.map(([ic,t],i)=><a key={t} href={'#b'+(i+1)}><i>{i+1}</i>{t.replace(/ \(.*\)/,'')}</a>)}<a href="#faq"><i>?</i>Tanya jawab</a></nav>
 {BAGIAN.map(([ic,t,keras,li],i)=><details key={t} id={'b'+(i+1)} className={'kt-sec'+(keras?' kt-hard':'')} open={i<2}>
  <summary><i className="kt-no">{i+1}</i><span className="kt-ic">{ic}</span><h2>{t}</h2><span className="kt-chev" aria-hidden>▾</span></summary>
  <ul>{li.map((x,j)=><li key={j} dangerouslySetInnerHTML={{__html:x}}/>)}</ul></details>)}
 <section id="faq" className="kt-faq"><h2>❓ Tanya jawab singkat</h2>{FAQ.map(([q,a])=><details key={q}><summary>{q}</summary><p>{a}</p></details>)}</section>
 <div className="kt-agree"><b>Dengan mendaftar, deposit, atau memakai layanan,</b> kamu dianggap sudah membaca dan menyetujui seluruh ketentuan ini. Ketentuan bisa diperbarui sewaktu-waktu; versi terbaru selalu ada di halaman ini.</div>
 <div className="kt-cta"><a href="/cs">💬 Hubungi Customer Service</a><a href="/dashboard">🏠 Dashboard</a><a href="/docs">📘 Dokumentasi API</a></div>
 <p className="kt-meta">Artapedia ID · Ketentuan Web v2 · diperbarui 28 Oktober 2026</p></div>}
