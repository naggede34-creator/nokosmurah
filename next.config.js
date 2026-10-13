/** @type {import('next').NextConfig} */
// Proyek ini memakai Next 14, jadi kedua pengaturan di bawah masih berada di dalam `experimental`.
module.exports={
 experimental:{
  // @napi-rs/canvas memuat biner .node sendiri; jangan di-bundle ulang oleh webpack.
  serverComponentsExternalPackages:['@napi-rs/canvas'],
  // Font struk dibaca dari berkas saat runtime. Tanpa baris ini, berkas .ttf tidak ikut
  // terbawa ke bundel serverless (hanya berkas yang terlacak yang disertakan), sehingga
  // teks pada gambar struk tidak akan muncul di server.
  outputFileTracingIncludes:{'/api/**/*':['./assets/fonts/**']}}}
