/** @type {import('next').NextConfig} */
// Proyek ini memakai Next 14, jadi pengaturan di bawah masih berada di dalam `experimental`.
const ASET='/:path*\\.(png|jpg|jpeg|webp|svg|ico|wav|woff2|ttf)'
module.exports={
 poweredByHeader:false,
 compress:true,
 reactStrictMode:false,
 experimental:{
  // @napi-rs/canvas memuat biner .node sendiri; jangan di-bundle ulang oleh webpack.
  serverComponentsExternalPackages:['@napi-rs/canvas'],
  // lucide-react & framer-motion besar: hanya ikon/fungsi yang dipakai yang ikut ke browser (halaman lebih ringan & cepat terbuka).
  optimizePackageImports:['lucide-react','framer-motion'],
  // Font struk dibaca dari berkas saat runtime. Tanpa baris ini, berkas .ttf tidak ikut
  // terbawa ke bundel serverless (hanya berkas yang terlacak yang disertakan), sehingga
  // teks pada gambar struk tidak akan muncul di server.
  outputFileTracingIncludes:{'/api/**/*':['./assets/fonts/**']}},
 // Gambar/maskot/nada di /public tidak berubah-ubah: simpan di browser & CDN supaya kunjungan berikutnya
 // tidak mengunduh ulang ratusan KB. stale-while-revalidate: kalau berkas diganti, versi baru tetap terambil sendiri.
 async headers(){return [
  {source:ASET,headers:[{key:'Cache-Control',value:'public, max-age=86400, stale-while-revalidate=604800'}]},
  {source:'/_next/static/:path*',headers:[{key:'Cache-Control',value:'public, max-age=31536000, immutable'}]}]}}
