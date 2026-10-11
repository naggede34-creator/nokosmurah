# Artapedia ID
Situs reseller nokos/OTP. Server: Artapedia lama (warungnokos_s1, s2) dan **JasaOTP / Ditznesia (jasaotp_s1 sampai s5)**. Deposit: QRIS acak antar gateway (Artapedia, Pakasir, Ditznesia) + Virtual Account Pakasir.
1. `npm i && npm run dev`
2. Vercel: import repo, isi semua env dari .env.example (MongoDB Atlas: izinkan 0.0.0.0/0).
3. Kunci API (Artapedia, JasaOTP, Pakasir, Telegram, dll) diisi di **/admin > Integrasi**, tanpa redeploy. Env hanya cadangan. Yang tetap wajib env: `MONGODB_URI`, `ADMIN_PASSWORD`, `CRON_SECRET`.
4. Cron: pinger tiap 1 menit ke https://DOMAIN/api/cron?secret=CRON_SECRET
5. Pembatalan order butuh endpoint POST /v1/orders/cancel di Artapedia lama (tidak ada di dokumentasi).

## Fitur tambahan (update ini)
- Deposit: min Rp2.000, maks Rp10.000.000, tombol cepat 2K-50K + input manual, tombol **Batalkan deposit** (di QR dan riwayat deposit).
- Beli nokos: sheet bertahap (server -> aplikasi -> negara -> paket) + kartu Pesanan Aktif, Jaminan OTP (+10%, ganti nomor otomatis setelah 4 menit), batal setelah 3 menit.
- Customer Service: chat pengguna <-> admin. Pengguna hanya bisa kirim 09.00-17.00 dan 18.00-22.00 WIB; admin balas kapan saja di /admin > CS.
- Pengumuman: admin upload (judul, isi, gambar) di /admin > Pengumuman; tampil di /pengumuman, beranda web, dashboard.
- Notifikasi Telegram: format detail, email disensor (ab***c@gmail.com), tombol link diatur di /admin > Notifikasi channel.
- Leaderboard: saldo terbanyak & transaksi terbanyak di /leaderboard, beranda, dan dashboard.
- Catatan: endpoint cancel deposit upstream (`POST /v1/deposit/cancel`) tidak ada di dokumentasi; dicoba best-effort, pembatalan tetap berlaku di situs ini.

## Fitur baru (update 2)
- **Referral / ajak teman**: tiap pengguna punya kode & link `/login?ref=KODE` (menu Lainnya > Ajak teman). Bonus untuk pengajak dan yang diajak dibayar otomatis saat teman menyelesaikan deposit pertama (minimal nominal diatur admin). Atur di /admin > Promo.
- **Bonus deposit**: cashback % otomatis tiap deposit lunas (default 2% min Rp5.000), bisa beda persen di hari tertentu (mis. Jumat), batas maksimal bonus opsional. Atur di /admin > Promo.
- **Hadiah leaderboard mingguan**: tab "Mingguan" di leaderboard + banner hadiah. Juara minggu lalu (transaksi sukses terbanyak atau total belanja) otomatis dapat saldo tiap Senin 00.00 WIB lewat cron. Hadiah per peringkat diatur di /admin > Promo.
- **Lupa password**: tombol "Lupa password?" di halaman masuk -> link reset 30 menit sekali pakai (email via Resend bila `RESEND_API_KEY` diisi). Tanpa email: /admin > Ringkasan > isi email pengguna > **Link Reset Password**, kirim link ke pengguna. Setelah reset, semua sesi lama keluar.
- **Auto backup**: semua data dikirim sebagai file `.json.gz` ke Telegram pribadi owner (`BACKUP_CHAT_ID`) lewat bot, otomatis sesuai jadwal (default 1 hari) oleh cron `/api/cron`. Di /admin > Backup: kirim sekarang, unduh, dan **Import** (gabungkan / ganti total) dari file backup, termasuk file bagian-bagian dari Telegram.

## Fitur baru (update 3)
- **Leaderboard bulanan**: tab "Bulanan" + hadiah per peringkat, dibagikan otomatis tiap tanggal 1 00.00 WIB oleh cron. Atur di /admin > Promo.
- **Link API / Base URL**: /admin > Link API. Isi domain API dan link dokumentasi; tampil di halaman /docs dan menu API Key pengguna. Kosong = domain situs otomatis.

## Revamp UI (update 4)
- **Stack UI baru**: Tailwind 3 (preflight dimatikan, CSS lama tidak berubah), framer-motion, lucide-react. Jalankan `npm i` lagi setelah update ini.
- **/login, /register**: glassmorphism + blob/partikel animasi, maskot 3D (`<Mascot3D/>`). Satu komponen `components/AuthForm.js` untuk login, daftar, dan lupa password (endpoint tidak berubah).
- **Landing (/)**: hero 3D, teks muncul per kata, kartu fitur tilt 3D, parallax, scroll reveal.
- **Dashboard**: 3 kartu promo (Cashback, Pembeli terbanyak, Ajak teman) dihapus dari beranda dan pindah ke **drawer** (ikon garis 3 di pojok kanan atas): menu Cashback, Leaderboard, Referral. Tombol "Isi saldo", "Lihat", "Ajak" tetap berfungsi.
- **/deposit**: halaman sendiri (dulu tab di dashboard): kartu metode bayar, chip nominal, kartu total bayar sticky, skeleton, confetti saat sukses. Logika deposit sama.
- **Tombol sosial dinamis**: data di MongoDB kunci `site_buttons` (`[{id,label,icon_url,url,is_active,order}]`, ikut backup). API publik `GET /api/site-buttons`. Admin: **/admin/settings/buttons** (tambah, ubah nama/link/logo, aktif/nonaktif, hapus, geser urutan). Sebelum admin menyimpan, isi awal diambil dari `NEXT_PUBLIC_TG_URL` / `NEXT_PUBLIC_WA_URL`.
- Komponen reusable: `components/ui/AnimatedCard.js`, `components/ui/GlassButton.js`, `components/Mascot.js`, `components/Mascot3D.js`, plus `Backdrop`, `AnimatedText` (+`CountUp`), `Confetti`, `Skeleton`.

## Tema putih-biru-silver + mode gelap (update 5)
- **Beranda, /login, /register** dirombak ke palet putih, biru, silver, abu-abu. Token warna di `app/fx.css` (`--fx-*`); semua komponen (kartu kaca, tombol, input, latar, maskot) ikut token itu.
- **Mode gelap pilihan pengguna**: tombol matahari/bulan (`components/ThemeToggle.js`) di navbar, footer beranda, dan pojok kanan atas halaman masuk/daftar. Pilihan tersimpan di browser (`localStorage` kunci `arta-theme`), bawaan terang. Skrip kecil di `app/layout.js` memasang tema sebelum halaman tampil, jadi tidak berkedip. Dashboard, deposit, dan admin tetap terang.
- **Admin > 🏠 Beranda**:
  - *Angka di beranda web*: isi bebas angka **Pengguna** dan **OTP sukses** yang tampil di beranda. Kosong = angka asli dari database (angka asli ditampilkan di placeholder). Disimpan di `cfg.stats`.
  - *Leaderboard manual*: tambah / ubah / hapus baris berdasarkan email atau nama + saldo, transaksi sukses, total belanja. Email otomatis disensor. Tampil di tab Saldo terbanyak & Transaksi terbanyak (beranda, /leaderboard, dashboard), tidak ikut hadiah mingguan/bulanan. Disimpan di kv `lb_manual` (ikut backup). API: `POST /api/admin/stats`, `lb/add`, `lb/edit`, `lb/del`.
- **Dashboard:** banner "Pengumuman terbaru" di atas saldo dihapus. Pengumuman kini muncul lewat ikon lonceng di bilah atas (titik merah = ada yang belum dibaca; klik untuk lihat 3 terbaru, atau "Lihat semua").

## Update 6: JasaOTP, deposit multi-gateway, admin Integrasi, UI
- **Server JasaOTP / Ditznesia** (`jasaotp_s1..s5`, API `https://www.ditznesia.com/api/dev`): satu API key untuk 5 server. Server 1 bisa pilih operator (acak / Telkomsel / dst), server 2/4/5 punya varian harga (`provider`), server 3 satu harga. Markup, Jaminan OTP, batal 3 menit, refund otomatis, dan notifikasi Telegram sama seperti server lama. Daftar negara per server diatur di /admin > Server (bawaan: Indonesia + beberapa negara pertama).
- **Deposit multi-gateway**: pengguna hanya memilih metode (**QRIS** atau **Virtual Account** bank). Untuk QRIS, tiap deposit dikirim ke salah satu **rute aktif secara acak berbobot** (Artapedia / Pakasir / Ditznesia); kalau satu rute gagal otomatis pindah ke rute lain. Admin menyalakan/mematikan tiap rute, mengatur bobot, menyalakan/mematikan tiap metode (QRIS, VA BRI/BNI/CIMB/Permata/Maybank/BNC/Artha Graha/Sampoerna), dan batas nominal di **/admin > Deposit**. VA hanya lewat Pakasir.
- **Webhook deposit** (opsional): `POST /api/hook/deposit` untuk Pakasir dan Ditznesia. Isi body tidak dipercaya; status dicek ulang ke gateway. Tanpa webhook, saldo tetap masuk lewat polling halaman deposit + cron tiap menit. Ada perlindungan double-credit antar polling/cron/webhook.
- **/admin > Integrasi**: semua yang dulu env (ARTA_KEY, DITZ_KEY, PAKASIR_*, TELEGRAM_*, BACKUP_CHAT_ID, SITE_URL, RESEND_API_KEY, MAIL_FROM, dst) bisa diisi dari dashboard dengan tombol Tes koneksi. Kunci rahasia tidak pernah dikirim utuh ke browser. Data tersimpan di kv `sec` (ikut backup).
- **/admin > Server**: saklar on/off, ubah nama/lencana/deskripsi tiap server.
- **UI**: kulit modern untuk admin, docs, CS, leaderboard, pengumuman dan navigasi (`app/ui2.css`, `app/admin/admin.css`); halaman deposit mendukung VA dan batas nominal dinamis.
- Catatan: deposit via Pakasir masuk ke saldo Pakasir milikmu, bukan otomatis ke saldo upstream (Artapedia/JasaOTP). Pastikan saldo upstream cukup untuk order. Endpoint status/cancel Pakasir yang dipakai: `GET /api/transactiondetail` dan `POST /api/transactioncancel` (format v1; halaman status v2 belum ada di dokumen yang dikirim), cek ulang kalau berbeda.

## Update 7: notifikasi lengkap, ID deposit, tampilan 3D komik
- **Notifikasi Telegram dirombak** (`lib/telegram.js`): judul kapital, lencana status (🟡 Menunggu, 🟢 Berhasil, 🔴 Gagal, 🟠 Perhatian, 🔵 Info, 🛠 Admin), kotak **ID** khusus, baris bergaris pohon (┣ ┗) dengan ikon otomatis per label, catatan, jam WIB, dan tombol link tetap dari /admin > Notifikasi channel. Format pemanggil: `notify({i,t,st,id:['ID Deposit',kode],rows:[[label,nilai]],note})`; baris dengan nilai kosong otomatis dilewati.
- **ID deposit** kini ada di semua notif deposit (menunggu pembayaran, sukses, dibatalkan, bonus referral) sebagai `ID Deposit`. Notif order memakai `ID Order`. Detail tambahan: rute, biaya layanan, batas bayar, total masuk (nominal + bonus), saldo sekarang, server, batas tunggu OTP, refund.
- **Notif chat Customer Service dihapus**: pengguna kirim pesan CS tidak lagi mengirim notif ke Telegram. Chat CS tetap jalan; admin membalas di /admin > CS. (Titik merah pesan belum dibaca di web tidak berubah.)
- **Notifikasi di web**: pop-up baru `components/ui/Toast.js` (gaya komik, ikon & warna otomatis merah/hijau/biru, bar waktu, tap untuk tutup) dipakai dashboard dan /deposit. Lonceng pengumuman: ikon per item, label BARU, waktu relatif ("5 menit lalu").
- **/deposit**: ID Deposit tampil di halaman bayar (tombol salin), di riwayat deposit, dan di kartu "Deposit berhasil".
- **Tampilan 3D komik** (`app/comic.css`, dimuat paling akhir; hanya gaya, logika tidak berubah): beranda dashboard (kartu saldo koin 3D + stiker POW!, 3 tombol aksi cepat Isi saldo / Beli nokos / Riwayat, kartu bergaris tebal), beli nokos (banner 4 langkah, lembar server/aplikasi/negara, kartu pesanan aktif, tombol ORDER 3D), dan halaman deposit. Font Bangers + Nunito dari Google Fonts, otomatis pakai font sistem kalau gagal dimuat.

## Update 8: beranda, login/daftar, dan docs 3D komik
- **Beranda (/)**: hero judul bergaris komik + maskot 3D dengan balon ucapan & stiker ledakan, pita aplikasi berjalan, panel fitur bernomor (garis atas warna-warni), bagian baru **7 Server nokos** (Server Plus, Express, JasaOTP 1-5 + Jaminan OTP) dan **Isi saldo** (QRIS + 8 Virtual Account), langkah beli berbentuk panel, dan banner ajakan daftar. Mode terang/gelap tetap jalan.
- **/login & /register**: kartu bertepi tebal berbayangan keras, stiker "MASUK!/GRATIS!/OOPS!", maskot dengan balon yang berubah sesuai mode, input & tombol 3D. Logika, endpoint, lupa password, dan kode ajakan tidak berubah.
- **/docs** (dokumentasi API) ditulis ulang: daftar isi lengket, tabel **semua 7 server nokos** (ID, penyedia, cara memakai `providerId`), tabel **semua metode deposit** (QRIS + 8 VA, rute gateway QRIS Artapedia/Pakasir/Ditznesia acak berbobot dengan failover, batas min/maks), alur & contoh kode JavaScript untuk beli OTP dan deposit, endpoint `/mutasi` dan `/apikey`, penjelasan Jaminan OTP, bonus cashback & ID deposit, status order/deposit, rate limit (60/mnt, order 20/mnt, deposit 6/mnt), dan daftar kode error.
- Gaya ada di `app/comic.css` (kelas `.cxl` untuk beranda/auth, `.dc` untuk docs).

## Update 9: markup harga diatur owner dari dashboard admin
- **/admin > 💰 Markup** (tab baru): atur **markup umum (%)**, **markup per server** (persen sendiri, kosong = ikut umum) dan **tambahan Rp per nomor** per server, serta **pembulatan ke atas** (Rp50 / 100 / 500 / 1.000). Ada kartu **Simulasi harga**: isi harga modal, langsung terlihat harga jual dan untung tiap server.
- Rumus harga jual: `modal x (1 + persen/100) + tambahan Rp`, lalu dibulatkan ke atas. Jaminan OTP (+10%) dihitung dari harga jual ini. Berlaku untuk harga baru di web dan API; order yang sudah dibuat tidak berubah.
- Data disimpan di `cfg.markup`, `cfg.mks` (`{server:{pct,flat}}`), `cfg.mkRound` (ikut backup). Endpoint admin `POST /api/admin/markup` menerima `{percent, servers, round}` (persen 0-500, tambahan 0-1.000.000; server tak dikenal diabaikan). Tombol lama "Set Markup %" di Ringkasan tetap jalan dan hanya mengubah markup umum.
