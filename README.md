# Artapedia ID
Situs reseller nokos/OTP. Server: WarungNokos, SMSCode, dan Dibanana. Deposit: QRIS acak antar gateway (Artapedia, Pakasir, Ditznesia) + Virtual Account Pakasir.
1. `npm i && npm run dev`
2. Vercel: import repo, isi semua env dari .env.example (MongoDB Atlas: izinkan 0.0.0.0/0).
3. Kunci API (WarungNokos, SMSCode, Dibanana, Pakasir, Telegram, dll) diisi di **/admin > Integrasi**, tanpa redeploy. Env hanya cadangan. Yang tetap wajib env: `MONGODB_URI`, `ADMIN_PASSWORD`, `CRON_SECRET`.
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
  - **🔗 Hubungkan Akun Web**: kalau sudah punya akun web, buat kode di Dashboard › Beranda › *Hubungkan Telegram*, lalu kirim ke bot (`/link KODE`). Syarat: saldo akun bot Rp0.

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
Menu utama tampil seperti toko pro: **banner di atas**, kotak nama, teks **Information** berfont hias (Nama, Status, Saldo, Order, Transaksi, Runtime, Users; tanpa Pemasukan), lalu tombol. Banner bawaan (komik 3D putih-biru-silver): `public/bot-banner.jpg`; kalau file ini diganti, naikkan `BANNER_V` di `lib/tgbot.js` agar cache lama dibuang. Ganti dari bot: `/admin` › **🖼 Banner Menu Bot**, lalu kirim foto / video / GIF (kirim `-` untuk kembali ke bawaan). Angka Transaksi & Users mengikuti isian admin di tab Beranda bila diisi manual.
Status pengguna: Reguler (0–9 order), Silver (10+), Gold (50+), Platinum (200+).

### Saldo aman saat order gagal
Urutan order sekarang: pesan nomor ke penyedia → bila berhasil baru saldo dipotong. Jika penyedia gagal / timeout / stok habis, saldo **tidak pernah terpotong**. (Sebelumnya saldo dipotong lebih dulu lalu di-refund, dan refund bisa hilang karena data user versi lama menimpa.) Pengguna yang dulu sudah terlanjur kehilangan saldo bisa dipulihkan manual lewat Add Saldo (web atau bot).

---

## Update 15: deposit anti-hilang, notifikasi HP, halaman Profil, admin tertata

### 1. Deposit "kadang masuk kadang tidak" — diperbaiki
Penyebabnya ada tiga, ketiganya sudah ditutup:

1. **Tulis bertabrakan (penyebab utama).** Web, bot Telegram, webhook gateway, dan cron bisa membaca data pengguna yang sama lalu saling menimpa, sehingga saldo yang sudah dikreditkan hilang lagi. Sekarang setiap dokumen pengguna punya **nomor revisi**; `save()` hanya diterima kalau revisi belum berubah. Kalau berubah, perubahan kita (selisih saldo, mutasi baru, status transaksi yang kita ubah) **digabungkan** ke data terbaru lalu disimpan ulang — tidak ada yang hilang, termasuk kalau deposit dan refund order terjadi bersamaan.
2. **Kunci anti-dobel tidak pernah dilepas.** Dulu memakai penghitung ber-TTL 2 menit: kalau proses yang memegangnya gagal di tengah jalan (mis. Telegram lambat), deposit itu tidak bisa dikreditkan siapa pun selama 2 menit. Sekarang kunci dilepas di blok `finally`, dan **saldo disimpan lebih dulu, notifikasi dikirim belakangan** — notifikasi gagal tidak lagi membatalkan saldo yang sudah masuk. Semua panggilan Telegram juga diberi batas waktu.
3. **Cron kehabisan waktu.** Dulu cron memindai seluruh pengguna satu per satu; begitu pengguna banyak, batas 60 detik habis dan deposit pengguna di urutan belakang tidak pernah dicek. Sekarang ada daftar `dpend` berisi deposit yang belum selesai, disapu **paling dulu** dan paralel 8 sekaligus, baru sisanya. Sinkron order memakai kursor berputar, jadi tidak ada pengguna yang terus terlewat. Deposit lama otomatis dimasukkan ke daftar sekali jalan.

### 2. Notifikasi "beli nokos gagal" tidak dikirim ke channel
Order yang gagal di penyedia tidak lagi mengirim kartu ke channel Telegram (web maupun bot). Pembeli tetap melihat pesan errornya, dan saldo memang tidak pernah terpotong.

### 3. Notifikasi HP (Web Push) — berbunyi walau Chrome ditutup
Tanpa library tambahan: VAPID (RFC 8292) + enkripsi `aes128gcm` (RFC 8291) di `lib/push.js`, service worker di `public/sw.js`. **Kunci VAPID dibuat otomatis** saat pertama dipakai dan disimpan di database — tidak ada env baru yang perlu diisi.

- **Admin:** `/admin` › Pengguna › **Customer Service** › *Aktifkan notifikasi HP*. Setiap pengguna chat CS, HP berbunyi, bergetar panjang, notifikasi diulang 3x dan **tidak hilang sendiri** sampai diketuk.
- **Pengguna:** kartu **Notifikasi HP** di dashboard dan halaman Profil — dikabari saat deposit masuk dan saat CS membalas.
- Situs sekarang juga **PWA** (`manifest.json` + ikon): pasang ke layar utama lewat menu browser › *Install app*.

Batasnya jujur: **nada notifikasi web ditentukan sistem**, bukan situs. Supaya sekeras nada telepon, setel di HP: Android › Setelan › Notifikasi › Chrome (atau Artapedia kalau sudah di-install) › pilih **Mendesak/Urgent** + nada nyaring, dan jangan masukkan aplikasinya ke penghemat baterai. Kalau tab Artapedia masih terbuka, nada panggilan `public/ring.wav` diputar berulang. Di iPhone, situs harus dipasang ke Layar Utama lewat Safari dulu.

### 4. Halaman Profil pengguna (`/profil`)
Satu halaman berisi: kartu identitas + saldo, statistik (pesanan, deposit, bonus cashback, ajakan teman), **ubah nama**, **ganti password** (sesi perangkat lain otomatis keluar), kode & link ajakan, kartu Notifikasi HP, hubungkan Telegram, dan pintasan. Bisa dibuka dari menu garis tiga, tab Lainnya, atau tombol **Profil saya** di beranda dashboard.

### 5. Tombol API Key & Docs developer di dashboard
Dulu tersembunyi di menu; sekarang ada tombol besar **API Key & Docs developer** langsung di beranda dashboard pengguna (bersama tombol Profil). Bisa juga dibuka lewat `/dashboard?tab=api`.

### 6. Tampilan API Key & Docs tidak "ngezoom" lagi
Penyebabnya: kolom isian di panel API ber-font 14px — di iPhone, Safari **otomatis memperbesar seluruh halaman** begitu kolom di bawah 16px disentuh. Semua kolom dinaikkan ke 16px (plus aturan pengaman global di layar ≤820px). Selain itu halaman `/docs` diperkecil proporsional di HP (judul 44px → 26px, kartu statistik jadi 3 kolom rapat, tabel & blok kode mengecil) dan header situs digeser mendatar, jadi tidak ada lagi geseran horizontal. Zoom manual pengguna **tidak** dikunci (demi aksesibilitas).

### 7. Dashboard admin ditata ulang & dikelompokkan
15 tombol sederet diganti menu berkelompok: **⚡ Operasional** (Ringkasan, Deposit, Server nokos, Harga & markup) · **👥 Pengguna** (Customer Service, Bot Telegram, Notifikasi channel) · **🎨 Isi situs** (Beranda & angka, Pengumuman, Promo & hadiah, Tombol sosial) · **🛠 Sistem** (Integrasi & kunci, Maintenance, Link API, Backup & restore). Di layar lebar jadi sidebar menetap, di HP jadi baris geser dengan label kelompok. Header menampilkan jejak posisi (`Operasional › 📊 Ringkasan`) plus lencana **Maintenance aktif** dan **jumlah chat belum dibaca**.

### Update 16: tombol "Download dokumentasi lengkap"

Di `/docs` (atas, di bawah daftar isi, dan sekali lagi di paling bawah) dan di Dashboard › **API Key & Docs developer** ada tombol **⬇️ Download dokumentasi lengkap**. Sekali klik, seluruh dokumentasi jadi satu berkas — pengguna tidak perlu membuka tiap bagian satu-satu. Tiga format:

| Format | Isi | Untuk |
|---|---|---|
| `.html` | Semua bagian + gaya, satu berkas mandiri | Dibaca offline; Ctrl/Cmd + P › Simpan sebagai PDF |
| `.md` | Markdown lengkap dengan tabel & blok kode | README, Notion, dibaca AI / editor kode |
| `.json` | OpenAPI 3.1 | Impor ke Postman / Insomnia, generator SDK |

Isinya: 17 endpoint (URL, parameter, contoh respon), 7 server nokos, 9 metode & rute deposit, dua contoh kode alur penuh, status order & deposit, batas pemakaian, kode error, dan catatan Jaminan OTP / maintenance / webhook / keamanan key.

Semua isi diambil dari **`lib/apidocs.js`** — sumber yang sama dengan yang dirender halaman `/docs`, jadi isi web dan isi unduhan tidak pernah berbeda. Berkas dirakit di browser (tanpa endpoint server), nama berkas `artapedia-api-docs-YYYY-MM-DD.<ext>`. Contoh kode memakai penanda `API_KEY`, bukan key asli, jadi berkas aman dibagikan.

### Perbaikan tampilan menyertai update ini
Dua kelas CSS bertabrakan dan membuat panel API Key melebar sampai **889px di layar 390px** (inilah "ngezoom" yang terasa di halaman API Key):
- `.ap-btn.big` ikut terkena aturan `.app .big` milik angka saldo besar (font hias 64px) → modifiernya diganti jadi `.ap-btn.wide`.
- `.ap-wrap` (grid) ikut melebar mengikuti baris terpanjang di blok kode karena `min-width:auto` bawaan grid → diberi `minmax(0,1fr)` + `min-width:0`.
Grid dua kolom `.two` di beranda dashboard juga diperbaiki dengan cara yang sama. Sekarang seluruh halaman (beranda, docs, profil, dashboard & tiap tabnya, deposit, cs, pengumuman, leaderboard) pas di layar 390px tanpa geseran ke samping.

### Update 17: notifikasi chat CS admin tidak bunyi — diperbaiki

Tiga hal yang membuat nadanya tidak terdengar saat diuji:

1. **Panel admin hanya memeriksa chat baru saat tab Customer Service dibuka.** Kalau admin sedang di tab Ringkasan (atau tab mana pun), chat masuk tidak terdeteksi sama sekali, jadi tidak ada yang berbunyi. Sekarang pemeriksaan jalan di **semua tab** panel admin (5 detik di tab CS, 12 detik di tab lain); begitu ada chat baru, nada berbunyi, notifikasi sistem muncul, dan lencana jumlah chat ikut bertambah. Ini **jalur bunyi kedua** yang tidak bergantung pada Web Push sama sekali.
2. **Browser memblokir suara sebelum halaman pernah disentuh.** Nada panggilan diputar lewat `Audio.play()` yang otomatis ditolak browser kalau belum ada interaksi, dan kegagalannya ditelan diam-diam. Sekarang suara "dibuka kuncinya" pada sentuhan pertama (termasuk saat menekan tombol Masuk di panel admin), dan ada nada "ting-tung" WebAudio sebagai cadangan kalau berkas `ring.wav` gagal dimuat, plus getaran.
3. **Kegagalan Web Push tidak kelihatan sama sekali.** Kalau push service menolak, tidak ada pesan apa pun. Sekarang jawaban push service disimpan per perangkat dan ditampilkan.

**Diagnosa di kartu Notifikasi HP** (admin & pengguna): daftar **perangkat terdaftar** — merek push service, nama perangkat, kapan didaftarkan, hasil kiriman terakhir, dan pesan error yang jelas kalau gagal (misal `403` = HP terdaftar dengan kunci lama, tekan Aktifkan sekali lagi; `410` = langganan dicabut HP). Ada peringatan tegas bahwa tombolnya mendaftarkan **perangkat yang sedang dipakai saat itu** — mengaktifkan di laptop tidak membuat HP berbunyi (ini penyebab paling sering). Tombol **🔁 Daftar ulang** untuk memperbarui langganan yang basi.

**Perbaikan lain di balik layar:** pembuatan kunci VAPID sekarang dikunci. Sebelumnya dua proses serverless yang jalan bersamaan bisa membuat pasangan kunci berbeda lalu saling menimpa — HP yang terlanjur mendaftar dengan kunci lama akan ditolak push service (403) selamanya tanpa pesan error. Langganan yang ditolak 403 kini ikut dibuang otomatis supaya admin tahu harus mendaftar ulang.

### Update 18: kartu Notifikasi HP dipindah ke menu
Kartu **Notifikasi HP** tidak lagi tampil di beranda dashboard pengguna (beranda jadi lebih ringkas). Sekarang dibuka lewat:
- tab **Lainnya** di menu bawah › **🔔 Notifikasi HP**, atau
- tombol **garis tiga** di pojok kanan atas › **Notifikasi HP**, atau
- tautan langsung `/dashboard?tab=notif`.

Di halaman **Profil** kartunya tetap ada (bagian Notifikasi), karena halaman itu memang tempat pengaturan akun.

---

## Update 19: QRIS Gateway (Artapedia Pay) + rute deposit acak murni

### Rute deposit sekarang acak merata
Pemilihan rute tidak lagi memakai bobot. Tiap deposit mengacak urutan rute aktif dengan Fisher-Yates, jadi peluang Pakasir / Artapedia / Ditznesia sama besar — diuji 3.000 kali, hasilnya 34% / 33% / 33%. Kolom Bobot dihapus dari `/admin > Deposit`; field `w` di konfigurasi dibiarkan hanya demi data lama.

### QRIS Gateway — produk baru di `/pay`
Pengguna bisa menerima pembayaran QRIS atas nama sendiri, dananya masuk ke **saldo gateway** terpisah dari saldo nokos, lalu ditarik ke e-wallet / Virtual Account. Mesin di belakangnya **AustinPay** (`lib/austin.js`); kredensialnya diisi di `/admin > Integrasi > AustinPay` (`AUSTIN_KEY`, `AUSTIN_SECRET` opsional, `AUSTIN_BASE`).

**Keuntungan pemilik situs** datang dari biaya layanan yang dipotong tiap QRIS lunas: `cfg.pay.fee` persen + `cfg.pay.feeFlat` rupiah, diatur di tab **⚡ QRIS Gateway**. Contoh bawaan 0,7%: merchant terima QRIS Rp50.000 → saldonya bertambah Rp49.650, Rp350 jadi milik pemilik situs. Ada juga tambahan biaya tarik dana (`wdFee`).

**Halaman** (tema gelap berlapis, terpisah dari tema komik toko nokos):

| Halaman | Isi |
|---|---|
| `/pay` | Saldo, pemasukan hari ini/30 hari, grafik 7 hari, transaksi terbaru |
| `/pay/qris` | Tombol nominal cepat 2K–50K + isi sendiri, QR besar, hitung mundur, polling otomatis, layar lunas |
| `/pay/withdraw` | Pilih e-wallet/bank → produk → nominal → kirim. Otomatis, tanpa persetujuan manual |
| `/pay/riwayat` | QRIS masuk & penarikan, filter + pencarian + ekspor CSV |
| `/pay/profil` | API key, whitelist IP, API secret (HMAC), webhook + tes kirim |
| `/pay/docs` | Dokumentasi lengkap + tombol unduh `.md` |
| `/struk/<id>?t=<token>` | Struk publik yang bisa dibagikan & **diunduh sebagai gambar PNG** |

**Public API** (`/api/pay/*`, balasan `{success, ...}`): `account`, `transactions`, `deposit/create|check|cancel|history`, `withdraw/wallets|products|create|history`. Autentikasi API key (`X-API-Key` / `Bearer` / `?apikey=`) + whitelist IP + HMAC-SHA256 opsional (`METHOD\nPATH\nBODY\nTIMESTAMP`, toleransi 5 menit). Rate limit 5/menit untuk membuat QRIS, 300/menit untuk sisanya.

**Webhook** ke merchant: `qris.paid`, `qris.expired`, `qris.canceled`, `withdraw.success`, `withdraw.failed`. Ditandatangani HMAC, diulang sampai 3 kali kalau gagal.

**Pengaman uang:** saldo dipotong lebih dulu sebelum perintah kirim ke penyedia, dan dikembalikan otomatis kalau penyedia menolak. Kredit QRIS dijaga idempoten (flag `credited` di dalam satu tulis atomik), jadi aman walau polling, webhook, dan cron berjalan bersamaan. Cron menyapu QRIS yang belum dibayar dan penarikan yang masih diproses.

**Yang diuji** dengan server AustinPay tiruan: QRIS terbit → lunas → saldo bertambah tepat (50.000 − 350 = 49.650); struk publik butuh token (tanpa token ditolak); tarik Rp10.000 memotong Rp10.550; penarikan gagal mengembalikan saldo utuh; tarik melebihi saldo ditolak; API key salah 401; whitelist IP 403; rate limit QRIS 429 di permintaan ke-5; HMAC valid lolos, signature salah & timestamp kedaluwarsa ditolak; tanda tangan webhook cocok dengan contoh kode di dokumentasi; URL webhook http/privat ditolak (anti-SSRF).

**Catatan jujur:** integrasi AustinPay diuji memakai server tiruan yang meniru dokumentasi mereka, **belum terhadap API aslinya**. Setelah `AUSTIN_KEY` asli diisi, tekan **Tes koneksi AustinPay** di tab admin, dan daftarkan IP server ini ke whitelist AustinPay.

## Update 20: ringkasan uang admin, struk bisa dibagikan, skeleton loading

### B20 — Ringkasan uang di halaman depan admin
Tab **Ringkasan** sekarang dibuka dengan kartu uang, bukan langsung form: **omzet**, **laba kotor** (jual − modal penyedia, lengkap dengan margin %), **deposit masuk** (plus bonus yang dibagikan), dan **order gagal** (plus total refund). Ada pemilih periode **Hari ini / 7 hari / 30 hari / Semua**, baris tambahan berisi saldo pengguna yang mengendap, order yang masih menunggu OTP, jumlah pengguna (+ pendaftar hari ini), dan laba QRIS Gateway.

Grafiknya **laba kotor 7 hari**, satu seri. Versi pertama memakai batang bertumpuk omzet (modal + laba), tapi laba hanya ~9% dari omzet sehingga batangnya jadi sesobek garis dan trennya tidak terbaca — jadi diganti satu seri laba, dengan omzet & modal tetap tersedia di tooltip dan di tabel yang bisa dibuka di bawah grafik. Satu seri berarti tidak perlu legenda, dan nilai hanya dilabeli pada hari tertinggi, bukan di semua batang. Batangnya bisa disorot dan juga bisa difokus dengan keyboard.

Angka dihitung dengan memindai seluruh pengguna, di-cache 60 detik (ada tombol segarkan). Hari dihitung menurut WIB. Diuji dengan data buatan: omzet, laba, modal, order gagal, refund, deposit, dan isi grafik 7 hari semuanya cocok dengan nilai yang diharapkan.

### B11 — Struk transaksi bisa dibagikan sebagai gambar
Tombol **🧾 Struk** muncul di riwayat order yang sukses, di pesanan aktif yang kodenya sudah masuk, di layar deposit berhasil, dan di riwayat deposit yang lunas. Struknya digambar di canvas lalu bisa **diunduh sebagai PNG** atau dibagikan langsung lewat menu berbagi HP (`navigator.share`, otomatis jatuh ke unduh kalau browsernya belum mendukung).

Isinya sengaja dibatasi supaya aman dipamerkan: **kode OTP tidak dicantumkan** dan nomor ditampilkan separuh (`62812•••••890`). Tinggi struk mengikuti jumlah baris, jadi tidak ada ruang kosong menganga.

### B7 — Skeleton loading
`components/ui/Skeleton.js` sekarang benar-benar dipakai, dan bentuknya meniru isi yang akan muncul (bukan satu kotak abu-abu): dashboard pengguna (bar atas, kartu saldo, tiga tombol cepat, dua kartu), halaman Profil, daftar aplikasi & negara di lembar beli nokos, gelembung chat di halaman CS, kartu pengumuman, dan kartu ringkasan uang di admin.

## Update 21: ubah saldo dari ruang chat CS + struk untuk semua transaksi

### Add / del saldo langsung saat melayani chat
Di `/admin > Pengguna > Customer Service`, begitu satu percakapan dibuka muncul kartu pengguna di atas kotak chat: email, **saldo sekarang**, jumlah order sukses, total belanja, status banned/Telegram, dan tombol ke halaman detail lengkap.

Di kartu yang sama ada tombol nominal cepat (5rb / 10rb / 25rb / 50rb / 100rb), kolom nominal bebas, kolom keterangan, lalu **+ Tambah saldo** dan **− Kurangi**. Admin tidak perlu pindah tab, menyalin email, atau meninggalkan percakapan.

Centang **kabari di chat** (aktif secara bawaan) membuat sistem langsung mengirim pesan ke pengguna di percakapan itu juga, mis. *"✅ Saldo kamu sudah ditambah Rp25.000 (ganti deposit nyangkut). Saldo sekarang Rp25.000."* Setiap perubahan tetap tercatat di mutasi saldo pengguna dan dikirim ke channel Telegram.

Pengaman: nominal wajib lebih dari 0, maksimal Rp50.000.000, dan pengurangan ditolak kalau melebihi saldo pengguna (pesannya menyebut saldo yang ada). Semua lewat endpoint `admin/cs/saldo` — perubahan saldo dan pesan chat terjadi dalam satu permintaan.

### Struk untuk SEMUA transaksi
Sebelumnya struk hanya ada untuk order sukses dan deposit lunas. Sekarang semua jenis transaksi punya struk yang bisa **diunduh PNG atau dibagikan langsung** lewat menu berbagi HP:

| Di mana | Jenis |
|---|---|
| Riwayat order | semua status — sukses, kedaluwarsa, dibatalkan (struk gagal ikut menampilkan saldo yang dikembalikan) |
| Mutasi saldo | tiap baris: deposit, bonus, refund, referral, dan penyesuaian admin |
| Halaman deposit | semua status, termasuk QRIS yang masih menunggu dibayar |
| QRIS Gateway | QRIS masuk (nominal, biaya layanan, masuk saldo) dan penarikan dana |

Lencana dan warnanya menyesuaikan status: hijau untuk berhasil, kuning untuk menunggu/diproses, merah untuk gagal. Transaksi keluar ditandai minus. Tinggi struk mengikuti jumlah baris. Yang tidak berubah: **kode OTP tidak pernah dicantumkan** dan nomor selalu ditampilkan separuh.

---

## Update 22: struk ikut terkirim di notifikasi (teks + foto)

Empat kejadian penting sekarang mengirim **notifikasi berisi teks DAN foto struk**, bukan teks saja:

| Kejadian | Isi notifikasi |
|---|---|
| Deposit menunggu pembayaran | teks + struk status *menunggu* |
| Deposit sukses | teks + struk status *berhasil* (nominal, bonus, total masuk) |
| Pembelian nokos | teks + struk status *menunggu OTP* |
| OTP diterima | teks + struk status *berhasil* |

Struk digambar **di server** (`lib/strukimg.js`) memakai `@napi-rs/canvas`, bukan di browser, supaya bisa ikut dikirim ke Telegram dan notifikasi HP tanpa perlu ada orang yang membuka halaman.

- **Sumber data satu pintu.** `lib/strukdata.js` dipakai bersama oleh penggambar server dan penggambar browser (`components/Struk.js`), jadi struk yang diunduh pengguna dan struk yang ikut notifikasi selalu sama isinya. Tanda ✓ / ✕ / ↗ / jam digambar sebagai **garis (path)**, bukan huruf, karena font bawaan tidak punya lambang itu (kalau dipaksa, hasilnya kotak-kotak "tofu").
- **Font ikut dibundel.** `assets/fonts/` berisi Liberation Sans & Liberation Mono (lisensi SIL OFL 1.1) karena server tanpa font sistem akan menggambar teks kosong. `next.config.js` menandai `@napi-rs/canvas` sebagai paket eksternal dan ikut menyalin folder font ke hasil build (`experimental.serverComponentsExternalPackages` + `experimental.outputFileTracingIncludes` — bentuk konfigurasi Next 14).
- **Telegram.** `tgSend()` memakai `sendPhoto` dengan teks sebagai *caption* kalau teksnya ≤1000 karakter; kalau lebih panjang, fotonya dikirim dulu lalu teks lengkapnya menyusul sebagai pesan terpisah (batas caption Telegram 1024 karakter). Kalau pengiriman foto gagal karena apa pun, otomatis jatuh kembali ke pesan teks biasa — notifikasi tidak pernah hilang hanya gara-gara struk gagal digambar.
- **Notifikasi HP (Web Push).** Notifikasi HP memuat gambar lewat URL, jadi strukny disajikan di `GET /api/struk/img`. Tautannya **ditandatangani HMAC-SHA256** dengan kunci rahasia server (`?s=…`), berlaku untuk satu struk saja, dan tanpa tanda tangan yang cocok jawabannya **403**.

**Yang diuji** (server tiruan Pakasir, penyedia nokos, Telegram, dan penerima Web Push ber-TLS): deposit pending → log Telegram menerima `sendPhoto struk-<id>.png` berisi caption "DEPOSIT MENUNGGU PEMBAYARAN"; deposit lunas → `sendPhoto` "DEPOSIT SUKSES"; beli nokos → `sendPhoto` "PEMBELIAN NOKOS BARU"; OTP masuk → `sendPhoto` "OTP DITERIMA"; isi Web Push didekripsi dan memuat `img`; tautan itu menjawab `200 image/png 700×942`; tanda tangan dipalsukan menjawab `403`.

---

## Update 23: rute deposit V2, Job saldo gratis, Bot Reseller, animasi pembuka

### AustinPay jadi rute deposit + mesin rute V2
Deposit sekarang punya **dua mesin rute** yang bisa dipilih di `/admin › Deposit`:

| Mesin | Rute di dalamnya |
|---|---|
| **V1** (lama) | Artapedia · Pakasir · Ditznesia |
| **V2** (baru) | **hanya Pakasir & AustinPay** |

Saklar tiap mesin disimpan **terpisah** (`cfg.dep.routes` vs `cfg.dep.routes2`), jadi mengatur V2 tidak merusak pengaturan V1 dan sebaliknya. Pemilihan rute tetap **acak murni Fisher-Yates tanpa bobot** — peluang tiap rute aktif sama besar, dan kalau satu rute gagal otomatis pindah ke rute lain. AustinPay memakai klien yang sama dengan QRIS Gateway; selisih antara `deposit.amount` dan nominal dicatat sebagai biaya layanan supaya tagihan pengguna persis sama dengan QR-nya.

### 🎁 Job / saldo gratis
Admin memasang job (dengan logo, petunjuk, link, dan hadiah), pengguna mengerjakannya lalu **mengunggah foto bukti**, admin meninjau, dan begitu di-ACC hadiahnya langsung masuk sebagai **saldo nokos**.

Aturan dijaga di server (`lib/jobs.js`), bukan di tampilan:
- maksimum **3x per akun** per job (bisa diubah per job),
- hanya boleh ada **1 kiriman menunggu** per job, jadi tidak bisa dibanjiri,
- kiriman yang **ditolak tidak menghabiskan jatah** — pengguna boleh memperbaiki buktinya,
- hadiah hanya dibayar **sekali** per kiriman (dijaga field `paid`),
- foto wajib data URL JPEG/PNG/WebP dan dikecilkan dulu di browser.

Pengguna dikabari lewat Telegram + notifikasi HP saat di-ACC atau ditolak.

### 🏪 Bot Reseller — "jualan nokos tanpa modal"
Pengguna mendaftarkan **bot Telegram miliknya sendiri** di `/reseller` (token, ID owner, username bot, username Telegram owner, markup, nama toko). Satu akun satu bot, dan syarat & ketentuan harus disetujui dulu.

Bot reseller **memakai mesin bot yang sama** (`lib/tgbot.js`) lewat bendera `bot.rs`, jadi tidak ada mesin bot kedua yang harus dirawat:
- markup reseller **ditumpuk di atas markup platform** lewat cfg turunan, sehingga semua layar harga ikut tanpa mengubah `sellPrice()`;
- deposit di bot reseller **dipaksa lewat Pakasir** saja;
- pelanggan reseller punya **namespace akun sendiri** (`tgr:<uid>:<tgId>`) — saldonya terpisah dari akun web dan dari reseller lain;
- pemilik bot **bukan admin platform**: `/admin` di bot reseller membuka **Panel Toko** (lihat saldo, set markup, broadcast, broadcast + pin);
- pelanggan reseller tidak ikut bonus deposit, ajak teman, dan papan peringkat platform.

Keuntungan reseller (selisih markup) masuk dompetnya tiap ada pesanan berhasil, ditarik kembali kalau pesanan itu di-refund, dan bisa **ditarik otomatis lewat AustinPay** ke e-wallet/bank dengan pengembalian saldo bila penarikan gagal.

Di web juga ada **popup ajakan** "jualan nokos tanpa modal" yang muncul sekali tiap 3 hari.

### 🎬 Animasi pembuka + sapuan 3D komik
Membuka situs kini disambut animasi **komik 3D 14 detik**: hitungan 1→100, maskot globe, logo **ARTA PEDIA ID**, lalu papan *Beli Nokos Murah* dan *QRIS Gateway*. Selalu ada tombol **LEWATI**, hanya muncul **sekali per kunjungan** (sessionStorage) supaya tidak mengganggu saat pindah halaman, dan otomatis dilewati kalau pengguna memilih "kurangi gerakan" di HP-nya.

Halaman yang dulu bergaya lembut (pengumuman, leaderboard, docs, profil) ikut disapu gaya komik: garis tebal navy, bayangan keras, judul font Bangers, dan header yang menu-nya turun ke baris kedua & bisa digeser di layar kecil.

### Perbaikan yang ditemukan saat pengujian
- `lib/tgbot.js`: helper `notifOrder()` hilang sejak update struk, sehingga **setiap pembelian lewat bot Telegram melempar ReferenceError**. Dipulihkan.
- Perhitungan markup gabungan reseller salah satuan (0,21% alih-alih 21%), membuat harga reseller hampir sama dengan harga platform.
- Balasan penarikan reseller memakai kunci `wd` yang bentrok dengan daftar riwayat `wd`.
- Pelanggan bot reseller sempat ikut mendapat bonus deposit platform.

**Yang diuji** (Telegram, Pakasir, AustinPay, dan penyedia nokos tiruan): 30 deposit pada mesin V2 terbagi 18 Pakasir / 12 AustinPay sementara Artapedia & Ditznesia tidak pernah dipakai; deposit AustinPay lunas → saldo masuk + struk terkirim; job dikirim dari browser HP lalu di-ACC (saldo Rp0 → Rp3.000), ACC kedua kali ditolak, kiriman ke-4 ditolak karena jatah habis; bot reseller menolak pendaftaran sebelum S&K disetujui, menu pelanggan tampil dengan nama toko, deposit hanya menawarkan QRIS Pakasir, saldo masuk Rp50.000 **tanpa** bonus platform, harga pelanggan Rp1.815 (platform Rp1.651) dengan untung reseller Rp164, panel toko hanya terbuka untuk pemilik, penarikan Rp10.000 memotong Rp11.500 dan berstatus berhasil sementara penarikan melebihi saldo / di bawah minimal / nomor tujuan salah semuanya ditolak; animasi pembuka berjalan 1→100 dalam 30 detik, tombol LEWATI menutupnya, dan tidak muncul lagi saat pindah halaman; seluruh halaman tidak melebar di layar 390px.

---

## Update 24: admin ubah saldo reseller & gateway, channel notifikasi reseller

### Admin bisa menambah / mengurangi saldo
Dua dompet yang sebelumnya hanya bisa diisi oleh sistem kini bisa dikoreksi admin:

| Tempat | Dompet |
|---|---|
| `/admin › 🏪 Reseller` | dompet keuntungan reseller (yang bisa mereka tarik lewat AustinPay) |
| `/admin › ⚡ QRIS Gateway › Merchant › Saldo` | saldo gateway merchant |

Tab **Reseller** juga menampilkan daftar semua reseller: nama toko, username bot, markup, saldo, total untung, jumlah terjual, dan jumlah pelanggan — lengkap dengan pencarian.

Penjagaan yang dipasang di server (bukan di tampilan):
- nominal 0 ditolak,
- pengurangan yang membuat saldo **minus** ditolak,
- uid yang **belum punya catatan** reseller/gateway ditolak — tanpa ini, salah ketik uid akan diam-diam membuat rekening baru dan saldonya hilang entah ke mana,
- tiap perubahan dicatat di mutasi pemiliknya (`adm+` / `adm-`) dan dikirim ke channel admin.

### Channel notifikasi milik reseller
Saat mendaftarkan bot, reseller sekarang juga mengisi **ID channel** dan **username channel** Telegram miliknya (boleh dikosongkan, dan bisa diubah kapan saja dari halaman `/reseller`). Empat kejadian dikabarkan ke channel itu memakai **bot reseller itu sendiri**:

| Kejadian | Isi |
|---|---|
| Pesanan baru | layanan, nomor (disamarkan), harga, **untungmu**, pembeli (disamarkan), ID order |
| OTP diterima | layanan, nomor (disamarkan), harga, untungmu, ID order |
| Deposit menunggu bayar | nominal, total bayar, metode, ID |
| Deposit masuk | nominal, metode, saldo pelanggan, ID |

Nomor dan nama pembeli **selalu disamarkan** (`6281•••••890`) karena channel biasanya publik — pemilik toko tetap tahu ada transaksi apa tanpa membocorkan data pelanggannya. Notifikasi OTP dan deposit dipasang di jalur bersama (`pollOrder`, `lib/sync.js`, `depNotify`), jadi tetap terkirim baik dari tombol di bot, dari cron, maupun dari webhook. Kegagalan kirim ke channel tidak pernah menggagalkan transaksi; halaman `/reseller` menyediakan tombol **Tes kirim** yang menjelaskan apa adanya kalau botnya belum dijadikan admin di channel.

**Yang diuji:** ID channel bukan angka ditolak; username channel tanpa ID ditolak; tes kirim masuk ke channel; deposit pending, deposit lunas, pesanan baru, dan OTP diterima keempatnya masuk ke channel dengan nomor tersamarkan; admin menambah Rp50.000 lalu mengurangi Rp20.000 saldo reseller (sisa Rp30.000) dan menambah Rp75.000 lalu mengurangi Rp25.000 saldo gateway (sisa Rp50.000); pengurangan berlebihan, nominal 0, dan uid ngawur semuanya ditolak.

---

## Update 25: maskot & logo asli dipakai di seluruh situs

Maskot dan logo milik pemilik situs kini dipakai sungguhan, bukan gambar buatan CSS lagi.

- **`public/maskot.webp`** — maskot elang berbaju zirah. Berkas aslinya JPEG, jadi "latar transparan"-nya sebenarnya papan catur yang ikut tergambar; papan itu dibuang dengan *flood fill* dari pinggir, sisa bercak dibersihkan dengan hanya menyimpan gumpalan terbesar, lalu pinggiran kosongnya dipotong supaya maskot memenuhi bingkainya. Hasilnya 53 KB (WebP), dengan `maskot.png` sebagai cadangan.
- **`components/Mascot.js`** sekarang menampilkan gambar itu — tetap mengambang, sedikit miring mengikuti kursor, dan punya bayangan jatuh supaya terasa 3D. Karena semua halaman memanggil komponen yang sama, maskot baru langsung muncul di beranda, halaman masuk/daftar, dashboard, dan header.
- **Animasi pembuka** memakai maskot asli (terbang masuk, lalu mengecil) dan **banner logo asli** (`public/banner-arta.jpg`) yang muncul sebagai papan komik berbingkai tebal, sebelum dua papan layanan. Latarnya **putih → biru → silver**: sorot putih di tengah, biru di badan layar, tepi silver, ditambah kilau logam miring yang bergerak pelan, titik halftone biru, dan sinar komik putih-silver yang berputar.
- **Ikon aplikasi & favicon** (`icon-192.png`, `icon-512.png`) digambar ulang dari maskot di atas kotak biru membulat.
- **Banner menu bot Telegram** diganti dengan banner yang sama (`BANNER_V` dinaikkan supaya cache `file_id` lama dibuang).

Sekalian dirapikan: blok gambar di beranda tadinya melebar 420px di layar 390px sehingga lencana "POW!" dan tombol DAFTAR terpotong — sekarang dibatasi `width:100%;min-width:0`, chip yang mengorbit ditarik 7% ke dalam, dan nama situs di header beranda disembunyikan di bawah 430px (cukup maskotnya).

---

## Update 26: semua kegiatan bot reseller ikut masuk channel admin

Dulu transaksi dari bot reseller memang sudah dikirim ke channel admin, tapi bentuknya sama persis dengan transaksi toko sendiri — pemilik situs tidak bisa membedakan yang mana milik reseller. Sekarang **setiap kejadian dari bot reseller diberi tanda `(RESELLER)` pada judulnya** dan ditambahi empat baris: **Toko**, **Bot**, **Markup**, dan **Saldo reseller**.

Yang ikut ditandai: pendaftaran bot baru, pelanggan baru, pesanan nokos, OTP diterima, order dibatalkan, order kedaluwarsa + refund, deposit menunggu bayar, deposit sukses, deposit dibatalkan, dan penarikan dana reseller. Penandaannya dipasang di jalur bersama (`notifAdm`/`notifOrder` di `lib/tgbot.js`, `depNotify` di `lib/deposit.js`, dan `lib/sync.js`), jadi berlaku baik kejadiannya datang dari tombol di bot, dari cron, maupun dari webhook.

Notifikasi **"Bot reseller baru"** juga diperlengkap: bot, nama toko, markup, owner + ID-nya, channel reseller (atau "belum diatur"), dan ID akun web-nya — supaya pemilik situs bisa langsung menelusurinya di `/admin › Reseller`.

Data toko dibaca lewat `RS.rows(uid)` yang menyimpan hasilnya 15 detik di memori, jadi penandaan ini tidak menambah pembacaan database tiap transaksi.

**Yang diuji** dengan Telegram tiruan: pendaftaran bot baru masuk ke channel admin lengkap dengan channel resellernya; deposit menunggu bayar, deposit sukses, pembelian nokos, dan OTP diterima keempatnya masuk dengan judul berakhiran `(RESELLER)` beserta baris Toko/Bot/Markup/Saldo reseller.

---

## Update 27: struk di channel reseller, tombol Job, intro 10 detik, dan isi backup

### Notifikasi channel reseller ikut membawa struk
Empat kejadian di bot reseller (**pesanan baru, OTP diterima, deposit menunggu bayar, deposit masuk**) kini dikirim ke channel reseller sebagai **foto struk dengan teksnya jadi keterangan**, bukan teks polos. Struknya digambar **sekali** lalu dipakai bersama oleh channel admin dan channel reseller, jadi tidak ada pekerjaan ganda. Kalau pengiriman foto gagal karena apa pun, pesannya otomatis jatuh kembali ke teks biasa.

### Tombol Job di dashboard
Pintasan di halaman dashboard sekarang berurutan: **QRIS Gateway → Bot Reseller → Job · Saldo gratis → Profil saya → API Key & Docs**.

### Animasi pembuka 10 detik
Durasi intro dipendekkan dari 14 detik menjadi **10 detik** (babaknya ikut memendek).

### Backup: sudah mencakup semuanya, dan sekarang kelihatan
Backup memakai sapuan **seluruh database**, jadi data reseller, bot Telegram, job, dan QRIS Gateway sebenarnya sudah ikut sejak awal — hanya saja tidak kelihatan dari panel admin. Sekarang tab **Backup & restore** menampilkan **ringkasan isi database**: jumlah pengguna, reseller, pelanggan reseller, bot, akun gateway, job, bukti job, percakapan CS, dan pengaturan. Teks keterangannya juga diperbaiki supaya menyebut semuanya.

Satu bug ikut ketemu: ringkasan itu di-cache 60 detik tapi tidak dibersihkan saat **hapus total** atau **import**, sehingga angkanya tetap menunjukkan data lama setelah pemulihan. Cache sekarang dikosongkan di kedua jalur.

**Yang diuji:** unduh backup → hapus total (ringkasan jadi 0) → pulihkan dari file → isi database **sama persis** dengan sebelum dihapus, dan data reseller kembali lengkap (nama toko, markup 10%, saldo Rp25.000, username bot, ID channel), begitu pula daftar bot dan job. Keempat notifikasi channel reseller terkirim sebagai foto, intro menutup sendiri pada detik ke-10, dan tombol Job membuka `/job`.

---

## Update 28: pintu rahasia ke panel admin + lapisan tampilan elegan

### 🔓 Pintu rahasia (ketuk logo n kali)
Ketuk tulisan **ARTAPEDIA ID** di kaki halaman dashboard pengguna sebanyak **20 kali** (bisa diubah 3–100), dan panel admin terbuka **tanpa mengetik password**. Diatur di `/admin › Sistem › 🔓 Pintu rahasia`.

Yang penting soal keamanannya:
- **Keputusannya di server, bukan di browser.** Browser cuma melapor sudah mengetuk berapa kali; server yang memeriksa jumlahnya, daftar email yang boleh, dan apakah pintunya menyala. Mengubah angka lewat devtools tidak ada gunanya.
- Pengetuk **harus sudah login**. Tanpa sesi yang sah, laporannya ditolak.
- Yang dipegang browser **bukan password aslinya**, melainkan token acak sekali-jalan yang disimpan di server dan **berlaku 8 jam**. Token itu juga langsung dihapus dari alamat (`?t=`) supaya tidak ikut tersalin kalau tautannya dibagikan.
- Ketukan dibatasi **5 percobaan per menit per akun**.
- Setiap kali ada yang masuk lewat pintu ini, **notifikasi dikirim ke channel admin** berisi email dan IP-nya.
- Daftar email kosong = **siapa pun yang sudah login bisa masuk**. Panel admin memperingatkan ini saat disimpan, dan sebaiknya email pemilik langsung diisi.

### ✨ Lapisan tampilan "elegan"
Satu lapisan CSS terakhir yang membuat seluruh situs terasa lebih 3D tanpa menggeser tata letak sedikit pun — isinya hanya bayangan, gradasi, kilau, dan transisi:
- **Resep 3D**: satu bayangan keras navy (garis komik) + satu bayangan lembut di bawahnya (kedalaman) + kilau tipis di tepi atas (cahaya dari atas).
- Kartu diberi gradasi putih → silver; kartu berwarna seperti **saldo** dan **hero** dikecualikan supaya warnanya tidak tertimpa.
- Tombol timbul dengan kilau dan "tenggelam" saat ditekan; kolom isian justru dibuat **cekung** supaya kebalikannya terasa.
- Lencana dan chip timbul tipis, judul bagian diberi garis bawah kuning yang memudar.
- Panel admin dibuat lebih tenang: sudut lebih lembut, bayangan halus, KPI bergradasi.
- Kartu muncul dengan gerakan naik singkat, dan semua gerakan dimatikan kalau pengguna memilih "kurangi gerakan" di HP-nya.

Pintunya ada di **dua tempat**: tulisan besar **ARTAPEDIA ID** di kaki dashboard, dan tulisan kecil **Artapedia ID** di header. Yang di header tetap berfungsi sebagai tautan beranda untuk ketukan tunggal; ketukan beruntun di sana menghitung ke pintu rahasia.

Tiga perbaikan setelah pintu ini diuji seperti pemakaian sungguhan di HP:
- Ketukan dibaca dari **pointerdown**, bukan click, dan diberi `touch-action:manipulation` — di HP, ketukan cepat berulang pada teks sering tertelan oleh "double-tap to zoom" sehingga separuh ketukan tidak terhitung.
- Jeda yang mengulang hitungan dinaikkan dari 2 detik jadi **5 detik**, dan server dipanggil **sekali setelah ketukan berhenti**, bukan tiap ketukan.
- Dua bug yang membuat ketukan santai tidak pernah sampai tujuan: balasan "ketukan belum cukup" ikut **menghapus hitungan**, dan ketukan tunggal pada tulisan biasa (bukan tautan) juga **mereset hitungan ke nol**. Sekarang server mengirim kode alasan, dan hitungan hanya dihapus kalau penolakannya memang sungguhan (pintu mati / email tidak diizinkan).

**Yang diuji:** 19 ketukan tidak membuka apa-apa, ketukan ke-20 langsung masuk panel admin dengan alamat yang sudah bersih dari token; setelah dibatasi ke email tertentu, akun lain dengan 50 ketukan ditolak; ketukan kurang dari batas ditolak; token palsu ditolak; tanpa login ditolak; pintu dimatikan ditolak; dan dashboard, job, deposit, profil, pengumuman semuanya tetap tidak melebar di layar 390px. Setelah perbaikan: 20 ketukan santai (1,4 detik sekali) di kaki dashboard masuk panel admin **tanpa kotak password**, 20 ketukan di header juga masuk, ketukan tunggal di header tetap membuka beranda, dan 10 ketukan + jeda 6 detik + 10 ketukan tidak membuka apa pun karena hitungannya sudah diulang.

---

## Update 29: daftar pelanggan semua bot reseller + ubah saldo mereka

Di `/admin › 🏪 Reseller` kini ada bagian **"Pelanggan semua bot reseller"**: seluruh pelanggan dari semua toko dalam satu daftar, lengkap dengan **nama, username Telegram, toko asal, saldo, total deposit, jumlah order, dan total belanja**. Bisa **disaring per toko** dan **dicari** berdasarkan nama / username / ID.

Tiap baris punya tombol **Saldo** untuk **menambah atau mengurangi saldo pelanggan itu** langsung dari panel. Penjagaannya:
- nominal 0 ditolak;
- pengurangan yang membuat saldo **minus** ditolak;
- id yang bukan pelanggan bot reseller ditolak (tidak bisa menyentuh akun web biasa lewat jalur ini);
- perubahan dicatat di mutasi pelanggan, dikirim ke **channel admin**, dan juga ke **channel resellernya** supaya pemilik toko tahu saldo pelanggannya diubah.

Catatan penting yang ditulis langsung di panel: menambah saldo pelanggan reseller sama dengan memberi saldo nokos gratis — **biayanya ditanggung pemilik situs, bukan resellernya**.

Daftarnya dibatasi 300 baris sekali tampil (bisa sampai 500) dan menampilkan keterangan "menampilkan X dari Y" kalau terpotong, jadi panel tidak berat walau pelanggannya sudah ribuan.

**Yang diuji** dengan dua toko tiruan berisi tiga pelanggan: daftar menampilkan ketiganya beserta toko asalnya; saringan "Toko Budi" menyisakan satu pelanggan; pencarian "citra" menemukan pelanggan yang tepat; tambah Rp25.000 lalu kurangi Rp10.000 menyisakan Rp15.000; pengurangan berlebihan dan id ngawur ditolak; dan notifikasi masuk ke channel admin maupun channel resellernya.

---

## Update 30: perbaikan deposit "sudah transfer tapi saldo tidak masuk"

Dua bug nyata ditemukan, dan **keduanya membuat deposit yang SUDAH DIBAYAR tidak pernah dikreditkan**. Keduanya direproduksi dulu dengan upstream tiruan sebelum diperbaiki.

### Bug 1 — status dari gateway tidak diterjemahkan
Rute **Artapedia** (rute bawaan) mengembalikan status mentah dari upstream, lalu dibandingkan dengan kata `completed` persis. Begitu upstream menjawab `success`, `paid`, `berhasil`, `settlement`, atau `SUKSES`, deposit yang sudah dibayar **selamanya terbaca "menunggu"**.

Sekarang semua rute memakai **satu penerjemah status** (`normSt`) dengan daftar kata yang sama, dan `upDep.check` meneruskan status apa adanya (termasuk kalau upstream menaruhnya di `state` / `payment_status` / `transaction_status`).

*Bukti:* dengan upstream yang menjawab `success`, kode lama → saldo tetap **Rp0**; kode baru → saldo **Rp51.000** masuk lewat cron.

### Bug 2 — Next.js menyimpan jawaban gateway di cache
`fetch` ke Artapedia dan AustinPay tidak memakai `cache:'no-store'`. Di App Router, jawaban GET **disimpan di Data Cache**, jadi pengecekan status terus-menerus membaca jawaban LAMA — deposit yang baru dibayar tetap terbaca "menunggu", dan **status order (OTP) lewat server Artapedia juga ikut basi**. Sekarang kedua klien memakai `cache:'no-store'` (Pakasir & JasaOTP memang sudah).

### Pembayaran telat tidak lagi hilang
- Tenggang sebelum situs sendiri mencap "kedaluwarsa" dinaikkan dari 2 menit jadi **15 menit** (QRIS sering masih bisa dibayar lewat batas waktunya).
- Deposit yang kedaluwarsa/gagal **tidak dibuang**, tapi masuk daftar **cek susulan** dan masih ditanyakan ulang ke gateway selama **24 jam**. Pembayaran yang masuk telat tetap dikreditkan otomatis.

### ✅ Tombol "Saya sudah bayar"
Ada di **layar pembayaran** dan di **riwayat deposit** (termasuk untuk tagihan yang sudah kedaluwarsa), serta di **bot Telegram**. Menekannya menanyakan ulang ke gateway dan langsung mengkreditkan kalau memang sudah lunas. Jawabannya jujur: kalau belum terlihat, dikatakan "biasanya butuh 1–3 menit setelah transfer"; kalau sudah lewat batas, diarahkan menghubungi CS dengan bukti transfer. Dibatasi 3 tekanan per 20 detik, dan menekan berkali-kali tidak pernah mengkreditkan dua kali.

### 🛟 Admin: selamatkan deposit yang terlanjur tertahan
`/admin › Deposit` punya tombol **"Periksa & kreditkan sekarang"**: menyapu semua pengguna, menanyakan ulang setiap deposit yang masih menunggu/kedaluwarsa (rentang hari bisa diatur), lalu mengkreditkan yang ternyata sudah dibayar — lengkap dengan daftar siapa saja yang diselamatkan dan notifikasi ke channel admin. **Pakai ini untuk memulihkan pengguna yang sudah transfer sebelum perbaikan ini dipasang.**

**Yang diuji:** deposit lewat ketiga rute (Artapedia, Pakasir, AustinPay) masing-masing masuk Rp10.200 dari nominal Rp10.000; tombol "Saya sudah bayar" sebelum pembayaran terbaca memberi pesan jujur dan tidak mengubah apa pun, sesudahnya saldo masuk, dan ditekan lagi tidak menambah saldo; deposit yang dicap kedaluwarsa lalu dibayar telat masuk otomatis lewat sapuan susulan cron; tombol admin menyelamatkan 2 deposit tertahan milik 2 pengguna (masing-masing Rp25.500 dengan bonus) dan ditekan ulang tidak mengkreditkan dua kali.


## Update 10: maintenance otomatis harian + broadcast semua bot
### Maintenance otomatis (12:00 siang & 03:00 dini hari WIB, 3 menit)
- Dijalankan oleh `/api/cron` (pinger tiap 1 menit yang sama untuk sinkron deposit). Kode: `lib/autoclean.js`.
- Saat jadwal tiba, situs masuk maintenance **layar penuh** selama **3 menit** (pesanan & deposit baru berhenti, status order/refund/cek deposit tetap jalan), pembersihan jalan, lalu situs kembali normal **tepat di menit ke-3** (batas waktu dibaca langsung oleh `getCfg`, tidak menunggu cron). Layar maintenance menampilkan hitung mundur dan terbuka sendiri.
- Kalau admin sudah menyalakan maintenance manual sebelum jadwal, kondisi itu dipulihkan persis setelah siklus selesai.
- Notifikasi channel: "Maintenance otomatis dimulai" dan "Maintenance otomatis selesai" (lengkap dengan hasil pembersihan).
- Yang dibersihkan: sesi login > 32 hari, token reset/hubung-Telegram/pintu rahasia yang kedaluwarsa, antrean broadcast lama, status bot yang kosong, ID hantu di indeks pengguna;
  **pengguna tidak terpakai** (saldo 0, tanpa transaksi/mutasi, tanpa referral, tidak diblokir, tanpa catatan admin/akun reseller/gateway/chat CS, tidak login selama N hari, bawaan 90);
  **bot reseller tidak terpakai** (umur > N hari, bawaan 14, belum pernah menjual, pelanggan <= 2, tanpa saldo/stok/penarikan/tagihan; pemilik dikabari lewat bot, akun reseller tetap ada) dan **bot yatim**.
  Pengguna yang punya saldo, transaksi, referral, atau diblokir TIDAK pernah dihapus. Bot admin (utama/tambahan) tidak pernah dihapus.
- Atur di **/admin > Maintenance** (kartu "Maintenance otomatis harian"): on/off, jam (bisa tambah), durasi 1-10 menit, pesan, batas hari, tombol **Simulasi** (hitung tanpa menghapus) dan **Jalankan sekarang**.
- Data besar dipindai bertahap dengan kursor, jadi tidak kena batas 60 detik; sisa pekerjaan dilanjutkan di menit berikutnya / siklus berikutnya.

### Broadcast khusus admin ke semua bot
- **/admin > Pengguna > Broadcast semua bot** dan di bot Telegram: **/admin > 📡 Broadcast Semua Bot**. Kode: `lib/bcall.js`.
- Satu pesan (teks HTML atau foto + caption, opsi pin) dikirim ke pengguna bot utama, bot tambahan admin, bot reseller **tanpa modal**, dan bot reseller **stok mandiri**. Kelompok penerima bisa dipilih. Tiap pengguna dikirimi lewat bot tempat dia terdaftar; pemilik tiap bot ikut dapat.
- Akun diblokir dan pengguna yang memblokir bot dilewati (yang memblokir ditandai otomatis). HTML yang salah tulis otomatis dikirim sebagai teks biasa.
- Berjalan bertahap 25 pesan/detik dan dilanjutkan cron tiap menit; laporan akhir (per kelompok & jumlah bot) masuk ke channel notifikasi dan ke admin yang memulai.
- Broadcast lama ("Broadcast" / "Broadcast + Pin" di bot, dan di tab Bot Telegram) tetap ada dan hanya mengirim ke bot yang sedang dipakai.

## Update 8: server Dibanana + Bot Customer Service
- **Server Dibanana** (`dibanana_s1..s4`, API `https://dibanana.id/api/v1`): satu API key (`bn_live_...`) untuk 4 server: **ekonomi**, **premium** (bisa pilih operator), **khusus**, **wa_luar**. Isi key di /admin > Integrasi > Dibanana (tombol Tes koneksi memanggil `/balance`). Markup, Jaminan OTP, batal otomatis, refund, dan notifikasi sama seperti server lain.
  - API tidak punya daftar negara: negara yang tampil diatur di /admin > Server > Dibanana (kode ISO-2, bawaan `id`; WA Luar bawaan `my, sg, us, uk`).
  - `id` produk dari `/prices` bersifat opaque dan bisa kedaluwarsa. Situs menyimpannya sebagai `<harga>~<id>[~<operator>]`; bila id basi saat order, produk berharga sama dicari ulang otomatis sekali.
  - ID order situs diberi awalan `dbn` (mis. `dbn84213`) agar tidak bentrok dengan ID penyedia lain.
  - Batal baru diterima Dibanana 120 detik setelah order; penolakannya masuk antrean pembatalan otomatis yang sudah ada (lib/sync.js).
  - **Webhook OTP (opsional)**: tempel `https://DOMAINKAMU/api/hook/dibanana` di dibanana.id > Profile > Webhook, lalu salin Webhook Secret ke Integrasi > Dibanana. Isi webhook tidak dipercaya; status selalu ditanya ulang. Tanpa webhook, OTP tetap masuk lewat polling/cron.
- **Bot Customer Service** (`lib/csbot.js`, webhook `/api/hook/csbot`): tiap pengguna mengirim chat di /cs, bot mengirim pesan (dan foto) ke Telegram admin CS. Admin membalas dari Telegram: **Reply** pesan notifikasi, atau ketuk 💬 Balas lalu ketik; teks maupun foto (maks ±200KB). Perintah: `/start` (lihat ID Telegram), `/daftar` (chat belum dibalas), `/selesai`.
  - Setup: buat bot BARU di @BotFather, isi **Token** + **ID Telegram admin** (boleh banyak, pisahkan koma) di /admin > Integrasi > Bot Customer Service, Simpan, lalu **Pasang webhook** dan **Tes koneksi**. Setiap admin harus menekan START di bot sekali.
  - Hanya ID yang terdaftar yang bisa membalas; webhook dilindungi secret_token. Token tidak boleh sama dengan bot jualan / bot notifikasi (ditolak otomatis agar webhook bot lain tidak tertimpa).
  - Catatan: ini menggantikan keputusan Update 7 (notif CS ke Telegram dihapus) — notif CS kini hanya ke bot CS ini, bukan ke channel notifikasi.
- **Tombol promo di semua bot reseller** (mode tanpa modal & mandiri): menu utama bot reseller kini punya tombol **🚀 JUALAN NOKOS TANPA MODAL KLIK INI** → halaman promosi lengkap (cara kerja, mode tanpa modal vs mandiri, fitur, cara mulai; persen komisi deposit diambil otomatis dari pengaturan admin) + tombol **KUY BIKIN BOT JUALAN NOKOS TANPA MODAL** ke https://www.tokonokosarta.my.id/. Kode: `rsPromo()` di `lib/tgbot.js` (ubah link di konstanta `RS_PROMO_URL`).
- **Tips Order (web + semua bot)**: di web, menu Beli Nokos punya tombol kuning **💡 TIPS ORDER · Baca dulu sebelum order** (juga di lembar pesan) yang membuka jendela tips lengkap (`components/TipsOrder.js`). Di bot platform dan SEMUA bot reseller, menu Order Nokos punya tombol **💡 TIPS ORDER** (`tipsText()` di `lib/tgbot.js`) dengan tombol lanjut order. Ubah teks di dua file itu.
- **Dibanana: negara diperbanyak**: bawaan kini memindai ±70 negara (id, my, sg, us, uk, ph, th, vn, in, co, br, dst.), dalam kelompok 10 per permintaan dan di-cache 60 detik; negara tanpa stok otomatis tidak tampil. Daftar bisa diganti per server di admin > Server > Dibanana.
- **Halaman Beli Nokos dirapikan (3D bersih)**: kartu langkah gradasi biru, indikator langkah 1·2·3 di lembar pesan, kartu server/negara/paket dengan tepi tebal + bayangan lembut, tombol yang "turun" saat ditekan. Gaya ada di bagian akhir `app/comic.css` (blok "HALAMAN BELI NOKOS").
- **Reseller TANPA MODAL: markup Rupiah per server + komisi hanya saat OTP masuk**
  - Harga pelanggan = **harga web utama + markup Rp reseller** (mis. web Rp5.000 + Rp1.000 = Rp6.000, persis, tidak terpengaruh pembulatan platform). Bisa diatur **per server** (bot: Panel Toko › Set Markup › pilih server; web: Dashboard › Bot Reseller › Markup per server). Bawaan Rp1.000; maks Rp50.000 per server. Mode **stok mandiri tetap persen**.
  - Komisi **hanya cair saat status OTP diterima** (`rsPayCut()` di `lib/webhook.js`, dipanggil dari `fireOtp`). Order gagal, dibatalkan, atau kedaluwarsa **tidak mendapat komisi** (order mencatat jatah `rsPend`, dompet baru bertambah saat OTP masuk). Satu ID order hanya dibayar sekali (penanda `pk` di dompet reseller).
  - Implementasi harga: `sellPrice()` di `lib/bonus.js` menambah `rsFlat` setelah pembulatan; `rsCfg()` di `lib/tgbot.js` mengisi `rsFlat` per server dari `flatOf()` (`lib/reseller.js`).
  - Catatan migrasi: reseller tanpa modal lama yang belum punya pengaturan Rp otomatis memakai Rp1.000 per server (sebelumnya persen). Pesanan lama yang sudah terlanjur dikreditkan tetap diperlakukan seperti dulu (ditarik kembali bila refund).


## Update: hapus RuangOTP & Ditznesia, batal 3 menit, menu Kelola
- **Dihapus total**: server **SERVER NEBULA NEW (RuangOTP)** dan **JasaOTP 1-5 (Ditznesia)**, rute deposit Nebula & Ditznesia, kredensialnya di Integrasi, pengaturan negaranya di Server nokos, dan semua teks di beranda/docs/bot. Order lama yang masih "menunggu" di server itu otomatis dikedaluwarsakan + direfund setelah lewat batas tunggu.
- **Pembatalan nokos**: baru bisa dibatalkan **setelah 3 menit** sejak order (`CANCEL_WAIT` di `lib/sync.js`), dan hanya selama kode OTP belum masuk. **Pembelian sukses tidak bisa dibatalkan.** Berlaku di web, API `/v1/orders/cancel`, dan bot Telegram (tombol menampilkan hitung mundur). Pembatalan oleh admin dari panel tidak terkena aturan ini.
- **Admin > Sistem > Kelola** (`components/AdminKelola.js`, `lib/kelola.js`):
  - **Bot reseller**: daftar semua bot (pembuat, pelanggan, pesanan, dompet, umur). Filter *Semua* / *Penggunaan terbanyak* / *Tidak ada penggunaan sama sekali*, pilih & **hapus massal**, serta tombol **hapus semua yang tanpa penggunaan** (hanya yang tanpa pelanggan, pesanan, saldo, dan tarikan tertunda). Menghapus bot mencabut webhook; dompet reseller tidak hilang.
  - **Backup / impor / pulihkan**: tombol **Unduh backup** menghasilkan satu file berisi email + saldo semua pengguna, data bot reseller (pembuat, bot, toko, dompet, pelanggan tiap bot) dan seluruh isi database untuk dipulihkan (mode gabung atau ganti total). Ada juga CSV email + saldo.
  - **Clean**: pratinjau dulu, lalu hapus transaksi gagal / batal / kedaluwarsa / macet dan sampah web. Saldo, mutasi, order sukses, dan deposit sukses tidak disentuh.
