# Artapedia ID
Situs reseller di atas API v1 Artapedia lama (server warungnokos_s1 & warungnokos_s2).
1. `npm i && npm run dev`
2. Vercel: import repo, isi semua env dari .env.example (MongoDB Atlas: izinkan 0.0.0.0/0).
3. ARTA_KEY = API key akun Artapedia lama. Saldo akun itu yang terpotong tiap order; deposit pengguna masuk ke akun itu juga.
4. Cron: pinger tiap 1 menit ke https://DOMAIN/api/cron?secret=CRON_SECRET
5. Pembatalan order butuh endpoint POST /v1/orders/cancel di Artapedia lama (tidak ada di dokumentasi).
