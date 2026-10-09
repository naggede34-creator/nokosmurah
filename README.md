# Artapedia ID
Situs reseller di atas API v1 Artapedia lama (server warungnokos_s1 & warungnokos_s2).
1. `npm i && npm run dev`
2. Vercel: import repo, isi semua env dari .env.example (MongoDB Atlas: izinkan 0.0.0.0/0).
3. ARTA_KEY = API key akun Artapedia lama. Saldo akun itu yang terpotong tiap order; deposit pengguna masuk ke akun itu juga.
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
