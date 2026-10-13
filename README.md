# Artapedia ID
Situs reseller nokos/OTP. Server: Artapedia lama (warungnokos_s1, s2) dan **JasaOTP / Ditznesia (jasaotp_s1 sampai s5)**. Deposit: QRIS acak antar gateway (Artapedia, Pakasir, Ditznesia) + Virtual Account Pakasir.
1. `npm i && npm run dev`
2. Vercel: import repo, isi semua env dari .env.example (MongoDB Atlas: izinkan 0.0.0.0/0).
3. Kunci API (Artapedia, JasaOTP, Pakasir, Telegram, dll) diisi di **/admin > Integrasi**, tanpa redeploy. Env hanya cadangan. Yang tetap wajib env: `MONGODB_URI`, `ADMIN_PASSWORD`, `CRON_SECRET`.
4. Cron: pinger tiap 1 menit ke https://DOMAIN/api/cron?secret=CRON_SECRET
5. Pembatalan order butuh endpoint POST /v1/orders/cancel di Artapedia lama (tidak ada di dokumentasi).

## Fitur tambahan (update ini)
- Deposit: min Rp2.000, maks Rp10.000.000, tombol cepat 2K-50K + input manual, tombol **Batalkan deposit** (di QR dan riwayat deposit).
- Beli nokos: sheet bertahap (server -> aplikasi -> negara -> paket) + kartu Pesanan Aktif, Jaminan OTP (+10%, ganti nomor otomatis setelah 4 menit), tombol Batal bisa dipakai kapan saja selama OTP belum masuk (saldo langsung kembali).
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


## Login / daftar dengan Google & GitHub
Tombol muncul otomatis di /login dan /register begitu kuncinya diisi (admin > Integrasi, atau env).

**Google** — console.cloud.google.com > APIs & Services > Credentials > Create OAuth client ID (Web application).
Authorized redirect URI: `https://DOMAINKAMU/api/auth/google/callback`
Isi `GOOGLE_CLIENT_ID` dan `GOOGLE_CLIENT_SECRET`.

**GitHub** — github.com/settings/developers > New OAuth App.
Authorization callback URL: `https://DOMAINKAMU/api/auth/github/callback`
Isi `GITHUB_CLIENT_ID` dan `GITHUB_CLIENT_SECRET`.

Catatan: email dari Google/GitHub harus terverifikasi. Kalau email-nya sudah terdaftar, akun yang sama langsung dipakai (tidak dobel). Akun baru ikut kode ajakan (?ref=) dan notifikasi pengguna baru seperti biasa. Pastikan `SITE_URL` diisi sama dengan domain callback.

## Webhook OTP, Whitelist IP, Regenerate API key
Semua diatur pengguna di dashboard > menu API Key (hanya lewat login, tidak bisa lewat API key).
- **Webhook OTP**: URL https milik pengguna dipanggil `POST` saat OTP masuk (sekali per order, ulang 1x kalau gagal). Header `X-Artapedia-Signature: sha256=HMAC_SHA256(secret, timestamp + "." + rawBody)`. URL ke alamat internal/privat ditolak (anti-SSRF). Ada tombol tes dan secret bisa dibuat ulang.
- **Whitelist IP**: kalau diisi, API key hanya jalan dari IP itu (selain itu 403). Di Vercel IP klien dibaca dari header Vercel; di hosting lain pastikan proxy menimpa `x-forwarded-for`.
- **Buat ulang key**: hanya dari dashboard; key lama langsung mati.

## Maintenance (admin > 🛠 Maintenance)
- Seluruh situs: mode layar penuh atau banner + pesan kustom. Pesanan & deposit BARU ditolak (503); status order, batal/refund, webhook deposit tetap jalan.
- Per server: server tampil "MAINTENANCE" dan order ke server itu ditolak (503), server lain normal.
- Endpoint publik `GET /api/maintenance`.

## Backup & data pengguna (diperbaiki)
- Daftar pengguna (`idx`) sekarang ditambah secara atomik, jadi pendaftaran bersamaan tidak lagi menghilangkan pengguna dari daftar. Pengguna lama yang terlanjur hilang dipulihkan otomatis tiap backup, saat import, atau lewat tombol "🔧 Perbaiki daftar pengguna".
- Backup otomatis & manual kini juga mengirim **data semua pengguna**: `artapedia-pengguna-*.csv` (Excel) dan `artapedia-pengguna-lengkap-*.json.gz` (dengan riwayat order/deposit/mutasi). Hash password tidak ikut; file berisi API key, simpan rahasia.
- Tombol unduh manual: admin > Backup > Data semua pengguna (CSV / JSON).
- Cron: backup dijalankan paling awal; kalau proses mati/timeout, dicoba lagi 10 menit kemudian (sebelumnya menunggu satu interval penuh).
- Cron `/api/cron` wajib dipanggil tiap 1 menit oleh layanan cron eksternal (mis. cron-job.org) agar backup otomatis jalan. Owner harus sudah menekan Start di bot, dan `BACKUP_CHAT_ID` berisi chat ID pribadi.

---

## 🤖 Bot Telegram & Detail User (update 13)

### Membuat bot dari admin
1. Di Telegram buka **@BotFather** › `/newbot` › salin **token**.
2. Buka `/admin` › tab **🤖 Bot Telegram**. Tempel token dan **ID Telegram admin** (kirim `/id` ke bot atau pakai @userinfobot), tekan **Buat bot**.
3. Webhook dipasang otomatis ke `https://DOMAINKAMU/api/tg/<id-bot>`. Syarat: situs diakses lewat **HTTPS** (Vercel sudah otomatis).
4. Buka bot › `/start`. Admin bot buka panel dengan `/admin`.

Tidak perlu env baru. Maksimal 5 bot. Tombol **Segarkan** memasang ulang webhook (mis. setelah ganti domain), **Matikan** mencabut webhook.

### Fitur pengguna
- 🛒 **Beli nokos**: server → aplikasi (bisa ketik untuk mencari) → negara & harga → konfirmasi (+ Jaminan OTP) → nomor. OTP dikirim otomatis ke chat; ada tombol Cek OTP & Batalkan.
- 💰 **Isi saldo**: pilih metode (QRIS / VA yang diaktifkan admin) → nominal → QR dikirim sebagai foto. Saldo masuk otomatis dan bot memberi tahu.
- 📜 Riwayat order, 🧾 mutasi saldo, 🎁 referral (`/start ref_KODE`), 🌐 tombol menuju web.
- Akun dibuat otomatis saat `/start` (email `tg<ID>@telegram.invalid`). Dua cara memakai akun di web:
  - **🔑 Buat Password Web**: bot memberi link sekali pakai untuk membuat password, lalu login di web dengan email tersebut.
  - **🔗 Hubungkan Akun Web**: kalau sudah punya akun web, buat kode di Dashboard › API Key › *Hubungkan Telegram*, lalu kirim ke bot (`/link KODE`). Syarat: saldo akun bot Rp0.

### Fitur admin (`/admin` di bot)
Statistik · cek user · ➕ add saldo · ➖ del saldo · ⛔ ban · ♻️ unban · 📢 broadcast biasa · 📌 broadcast + pin (teks atau foto) · 💳 pilih metode pembayaran & gateway · 🛠 maintenance on/off (global, mode, pesan, per server) · 🖥 server on/off · 💰 markup · 📣 banner web · 💾 backup · 🔔 tes notif channel. Perubahan langsung berlaku di web juga (pengaturan yang sama).

Broadcast besar dikirim bertahap; kalau belum selesai dalam satu proses, **cron `/api/cron` (tiap 1 menit)** melanjutkannya dan admin dapat laporan saat selesai.

### Tombol berwarna
Bot memakai field `style` pada tombol inline (`primary` biru, `success` hijau, `danger` merah). Warna tampil di aplikasi Telegram versi terbaru (rilis setelah 9 Feb 2026); di versi lama tombol tetap berfungsi dengan warna standar.

### Notifikasi channel
Transaksi dari bot masuk ke channel yang sama dengan notifikasi web, tetapi memakai **kartu bergaris tebal bertanda 🤖 BOT** dan tombol **Buka Bot**, supaya mudah dibedakan dari transaksi web.

### Halaman detail user (admin)
Di tab Ringkasan, ketuk pengguna mana pun (ada kolom cari). Satu layar berisi: profil & saldo, statistik, **aksi cepat** (add/del saldo, ban/unban, link reset password, paksa logout, kirim pesan Telegram), **IP & login terakhir**, riwayat IP, catatan admin, serta tab **Order / Mutasi saldo / Deposit** (dengan penanda via Web atau Bot). IP & waktu login tercatat mulai login berikutnya; user lama terisi setelah mereka login lagi.

### Catatan
- Token bot disimpan di database (kv `bots`) dan ikut backup; simpan file backup dengan aman.
- Webhook ditolak (403) bila header `X-Telegram-Bot-Api-Secret-Token` tidak cocok.
- Bot hanya melayani chat pribadi.

### Menu bot & banner (update 14)
Menu utama tampil seperti toko pro: **banner di atas**, kotak nama, tabel **Information** (Nama, Status, Saldo, Order, Transaksi, Pemasukan, Runtime, Users), lalu tombol. Banner bawaan (komik 3D putih-biru-silver): `public/bot-banner.jpg`; kalau file ini diganti, naikkan `BANNER_V` di `lib/tgbot.js` agar cache lama dibuang. Ganti dari bot: `/admin` › **🖼 Banner Menu Bot**, lalu kirim foto / video / GIF (kirim `-` untuk kembali ke bawaan). Angka Transaksi & Users mengikuti isian admin di tab Beranda bila diisi manual.
Status pengguna: Reguler (0–9 order), Silver (10+), Gold (50+), Platinum (200+).

### Saldo aman saat order gagal
Urutan order sekarang: pesan nomor ke penyedia → bila berhasil baru saldo dipotong. Jika penyedia gagal / timeout / stok habis, saldo **tidak pernah terpotong**. (Sebelumnya saldo dipotong lebih dulu lalu di-refund, dan refund bisa hilang karena data user versi lama menimpa.) Pengguna yang dulu sudah terlanjur kehilangan saldo bisa dipulihkan manual lewat Add Saldo (web atau bot).
