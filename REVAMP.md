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
