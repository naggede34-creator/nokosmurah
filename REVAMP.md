# Daftar file revamp UI

## Baru
- tailwind.config.js, postcss.config.js, app/tailwind.css, app/fx.css
- components/ui/AnimatedCard.js, GlassButton.js, AnimatedText.js, Backdrop.js, Confetti.js, Skeleton.js
- components/Mascot3D.js, AuthForm.js, SocialButtons.js, Drawer.js, Shell.js
- app/register/page.js, app/deposit/page.js
- app/api/site-buttons/route.js
- app/admin/settings/buttons/page.js

## Diubah
- package.json (framer-motion, lucide-react, tailwindcss, postcss, autoprefixer)
- middleware.js (+ /deposit)
- app/layout.js (header lama pindah ke Shell, import css baru)
- app/login/page.js, app/page.js (landing)
- app/dashboard/page.js (hapus 3 kartu promo, drawer, tombol sosial dinamis, deposit -> /deposit)
- components/Mascot.js (ditulis ulang pakai framer-motion), components/Promo.js (+CashbackPage), components/CsFab.js
- app/admin/page.js (tombol menuju /admin/settings/buttons), README.md

## Tidak diubah
API bisnis (app/api/[...p]/route.js), lib/*, cron, backup, CSS lama (app/globals.css).
