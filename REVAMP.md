# Daftar file revamp UI

## Baru
- tailwind.config.js, postcss.config.js, app/tailwind.css, app/fx.css
- components/ui/AnimatedCard.js, GlassButton.js, AnimatedText.js, Backdrop.js, Confetti.js, Skeleton.js
- components/Mascot3D.js, AuthForm.js, SocialButtons.js, Drawer.js, Shell.js
- app/register/page.js, app/deposit/page.js
- app/api/site-buttons/route.js
- app/admin/settings/buttons/page.js

## Baru (update 7)
- app/comic.css (tema 3D komik), components/ui/Toast.js (notifikasi pop-up)

## Diubah
- package.json (framer-motion, lucide-react, tailwindcss, postcss, autoprefixer)
- middleware.js (+ /deposit)
- app/layout.js (header lama pindah ke Shell, import css baru)
- app/login/page.js, app/page.js (landing)
- app/dashboard/page.js (hapus 3 kartu promo, drawer, tombol sosial dinamis, deposit -> /deposit)
- components/Mascot.js (ditulis ulang pakai framer-motion), components/Promo.js (+CashbackPage), components/CsFab.js
- app/admin/page.js (tombol menuju /admin/settings/buttons), README.md

## Diubah (update 9)
- app/admin/page.js (tab 💰 Markup), app/api/[...p]/route.js (handler markup + rumus harga per server), lib/bonus.js (default mks, mkRound)

## Diubah (update 8)
- app/page.js (beranda), components/AuthForm.js (login/daftar), app/docs/page.js (dokumentasi API), app/comic.css (+gaya .cxl & .dc)

## Diubah (update 7)
- lib/telegram.js (format notif baru + ID), lib/deposit.js, lib/sync.js, lib/bonus.js (isi notif), app/api/[...p]/route.js (isi notif, notif chat CS dihapus)
- app/dashboard/page.js, app/deposit/page.js, app/layout.js (Toast, aksi cepat, banner, ID deposit, font)

## Tidak diubah
API bisnis (app/api/[...p]/route.js), lib/*, cron, backup, CSS lama (app/globals.css).

## Diubah (update 11)
- Tombol Batal order nokos langsung aktif (tanpa tunggu 3 menit, ada konfirmasi + cek OTP dulu): lib/sync.js, app/api/[...p]/route.js, app/dashboard/page.js, app/docs/page.js
- Login/daftar Google & GitHub: app/api/[...p]/route.js (auth/google, auth/github, callback, providers), lib/settings.js (+4 kunci OAuth), app/admin/page.js (+2 grup Integrasi), components/AuthForm.js (tombol), .env.example, README.md

## Diubah (update 12)
- Webhook OTP: lib/webhook.js (baru), lib/sync.js, app/api/[...p]/route.js, components/ApiPanel.js
- Whitelist IP + buat ulang key (sesi saja): lib/auth.js, app/api/[...p]/route.js, components/ApiPanel.js
- Maintenance global/per server: lib/bonus.js, app/api/[...p]/route.js, components/MaintGate.js (baru), app/layout.js, app/dashboard/page.js, app/admin/page.js, app/docs/page.js
- Backup/ekspor/impor + data semua pengguna: lib/db.js (sadd, scanPrefix), lib/backup.js, lib/userexport.js (baru), lib/telegram.js, app/api/cron/route.js, app/admin/page.js

## Baru (update 13): Bot Telegram + Detail User
- lib/tgpush.js (API Telegram, tombol berwarna, DM otomatis), lib/tgbot.js (mesin bot: menu user, beli nokos, isi saldo, panel admin, broadcast)
- app/api/tg/[id]/route.js (webhook per bot, dilindungi secret_token)
- components/AdminUser.js (halaman detail user lengkap), components/AdminBots.js (tab Bot Telegram di admin)

## Diubah (update 13)
- app/api/[...p]/route.js: catat IP & login terakhir (session), endpoint admin user/detail, user/kick, user/note, user/tgmsg, bots/*, endpoint user v1/tglink
- app/admin/page.js (daftar user bisa diklik + cari, tab 🤖 Bot Telegram), app/admin/admin.css
- components/ApiPanel.js (kartu Hubungkan Telegram)
- lib/telegram.js (notifikasi channel gaya kartu "BOT" + tombol Buka Bot), lib/bonus.js (+sellPrice)
- lib/webhook.js, lib/deposit.js, lib/sync.js (DM OTP / deposit / refund ke Telegram user, notif channel gaya bot)
- app/api/cron/route.js (lanjutkan broadcast yang belum selesai)

## Update 14: perbaikan saldo order + menu bot rich
- FIX order gagal tapi saldo terpotong: app/api/[...p]/route.js & lib/tgbot.js. Nomor dipesan ke penyedia DULU, saldo dipotong setelah nomor didapat (data user dibaca ulang tepat sebelum memotong). Gagal/timeout = saldo tidak pernah terpotong.
- Menu bot: banner + kotak nama + tabel Information + tombol (lib/tgbot.js), public/bot-banner.jpg (banner bawaan ARTA PEDIA ID)
- Bot lebih cepat: tombol dijawab seketika, cache data penyedia/config/bot, query database paralel, update ganda dibuang, OTP dipantau langsung ±25 detik setelah order, tombol salin (nomor/OTP/VA)

## Update 15: deposit nominal sendiri di bot
- lib/tgbot.js: layar nominal punya tombol preset + tombol "✏️ Nominal Sendiri"; nominal bisa diketik bebas (15000, 15.000, Rp15.000, 15k, 15rb, 1,5jt); nominal di luar batas/tidak terbaca dibalas pesan + tombol coba lagi

## Update 16: SMP Payment untuk bot reseller + percepatan
- Deposit pelanggan BOT RESELLER (mode tanpa modal) sekarang HANYA lewat SMP Payment: lib/deposit.js (ROUTES_RS=['smp']), lib/tgbot.js (rsCfg routes3).
- ISI SALDO STOK reseller mandiri lewat SMP Payment (otomatis, tanpa upload bukti / ACC admin):
  lib/smp.js (smpCreate menerima meta), lib/reseller.js (stokSmpNew/Paid/Check/Cancel), app/api/callbackqris/[key]/route.js (cabang kind:'stok'),
  app/api/[...p]/route.js (v1/reseller/stok/req|check|cancel), lib/tgbot.js (layar Isi Saldo Stok + tombol Saya Sudah Bayar/Batalkan), app/reseller/page.js (modal QR + cek otomatis).
  Permintaan manual lama yang masih "menunggu" tetap bisa di-ACC admin.
- Kecepatan: lib/db.js (opsi pool/timeout, koneksi gagal tidak lagi tersimpan permanen, kv.mget satu query untuk banyak kunci, sadd 1 round-trip),
  lib/bg.js (waitUntil aman serverless), lib/tgbot.js (bacaan awal paralel, cache toko 3 dtk, shopStats tidak lagi memuat semua user, notifikasi di latar),
  lib/bonus.js allUsers pakai mget, leaderboard stale-while-revalidate (route.js), lib/reseller.js view() tidak menunggu Telegram,
  components/Intro.js (10 dtk -> 2,5 dtk), next.config.js (cache aset, optimizePackageImports).
