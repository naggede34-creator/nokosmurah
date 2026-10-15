// Bahasa & mata uang untuk bot reseller.
// Harga di dalam sistem SELALU rupiah. Bahasa hanya mengubah tampilan:
// teks diterjemahkan dan angka ditulis ulang memakai mata uang pilihan reseller.
export const LANGS={
 id:{name:'Indonesia',flag:'🇮🇩',cur:'IDR',sym:'Rp',rate:1,dec:0},
 ms:{name:'Malaysia',flag:'🇲🇾',cur:'MYR',sym:'RM',rate:3400,dec:2},
 en:{name:'English',flag:'🇬🇧',cur:'USD',sym:'$',rate:16000,dec:2},
 ph:{name:'Filipino',flag:'🇵🇭',cur:'PHP',sym:'₱',rate:280,dec:2},
 th:{name:'ไทย',flag:'🇹🇭',cur:'THB',sym:'฿',rate:450,dec:2},
 vi:{name:'Tiếng Việt',flag:'🇻🇳',cur:'VND',sym:'₫',rate:0.65,dec:0}}
export const LANG_KEYS=Object.keys(LANGS)
export const langOf=a=>LANGS[(a&&a.lang)||'id']||LANGS.id
// kurs bisa diubah reseller (1 satuan mata uang = berapa rupiah)
export const rateOf=a=>{const L=langOf(a),r=+((a||{}).rate)||0;return r>0?r:L.rate}
// rupiah -> teks mata uang reseller
export function money(a,idr){
 const L=langOf(a),r=rateOf(a),v=(+idr||0)/r
 if(L.cur==='IDR')return 'Rp'+Math.round(v).toLocaleString('id-ID')
 const s=v.toLocaleString(L.cur==='MYR'?'ms-MY':L.cur==='PHP'?'en-PH':L.cur==='THB'?'th-TH':L.cur==='VND'?'vi-VN':'en-US',
  {minimumFractionDigits:L.dec,maximumFractionDigits:L.dec})
 return L.sym+s}
// teks mata uang reseller -> rupiah (dipakai saat pelanggan mengetik nominal)
export const toIdr=(a,v)=>Math.round((+v||0)*rateOf(a))

// ---------- kamus ----------
// Kunci dipakai di mesin bot: T(a,'menu.buy'). Bahasa yang belum punya terjemahan
// otomatis memakai bahasa Indonesia, jadi tidak pernah kosong.
const D={
 id:{
  'menu.buy':'🛍 Order Nokos','menu.dep':'💰 Isi Saldo','menu.his':'📜 Riwayat','menu.acc':'👤 Akun',
  'menu.cs':'💬 Customer Service','menu.panel':'🏪 Panel Toko','menu.home':'🏠 Menu Utama','menu.back':'⬅️ Kembali',
  'dash.title':'Dashboard','dash.hello':'Halo','dash.intro':'Beli nomor virtual & isi saldo langsung dari chat ini — cepat, aman, dan otomatis 24 jam.',
  'sec.akun':'Ringkasan Akun','sec.toko':'Ringkasan Toko',
  'f.status':'Status','f.role':'Peran','f.saldo':'Saldo','f.aktif':'Order Aktif','f.sukses':'Order Sukses',
  'f.toko':'Toko','f.cs':'Customer Service','f.cust':'Pelanggan','f.terjual':'Nokos Terjual','f.layanan':'Layanan',
  'v.aktif':'🟢 Aktif','v.maint':'🔴 Perawatan','v.owner':'Pemilik','v.cust':'Pelanggan','v.24':'24 Jam Nonstop',
  'tip.title':'💡 Cara memakai bot',
  'tip.body':'1️⃣ Tekan <b>Isi Saldo</b>, bayar, saldo masuk.\n2️⃣ Tekan <b>Order Nokos</b> → pilih server → aplikasi → negara.\n3️⃣ Kode OTP dikirim ke chat ini begitu masuk.\n4️⃣ Kode tidak masuk? Batalkan, saldo kembali penuh.',
  'dep.title':'Isi Saldo','dep.pick':'Pilih nominal yang mau diisi.','dep.min':'Minimal','dep.max':'Maksimal',
  'dep.qris':'Scan QRIS di atas, lalu kirim <b>foto bukti transfer</b> ke chat ini.',
  'dep.wait':'Bukti kamu sudah dikirim ke pemilik toko. Tunggu dikonfirmasi ya.',
  'dep.ok':'Saldo kamu sudah ditambah','dep.no':'Bukti transfer kamu ditolak pemilik toko.',
  'dep.send':'📤 Kirim Bukti Transfer','dep.amt':'Nominal','dep.total':'Jumlah yang harus dibayar',
  'ord.habis':'⚠️ Stok toko sedang kosong. Hubungi customer service ya.',
  'ord.kurang':'⚠️ Saldo kamu tidak cukup.','ord.ok':'✅ Pesanan dibuat! Kode OTP muncul di sini otomatis.'},
 ms:{
  'menu.buy':'🛍 Beli Nombor','menu.dep':'💰 Tambah Baki','menu.his':'📜 Sejarah','menu.acc':'👤 Akaun',
  'menu.cs':'💬 Khidmat Pelanggan','menu.panel':'🏪 Panel Kedai','menu.home':'🏠 Menu Utama','menu.back':'⬅️ Kembali',
  'dash.hello':'Hai','dash.intro':'Beli nombor maya & tambah baki terus dari sembang ini — pantas, selamat, automatik 24 jam.',
  'sec.akun':'Ringkasan Akaun','sec.toko':'Ringkasan Kedai',
  'f.status':'Status','f.role':'Peranan','f.saldo':'Baki','f.aktif':'Pesanan Aktif','f.sukses':'Pesanan Berjaya',
  'f.toko':'Kedai','f.cs':'Khidmat Pelanggan','f.cust':'Pelanggan','f.terjual':'Nombor Terjual','f.layanan':'Perkhidmatan',
  'v.aktif':'🟢 Aktif','v.maint':'🔴 Penyelenggaraan','v.owner':'Pemilik','v.cust':'Pelanggan','v.24':'24 Jam',
  'tip.title':'💡 Cara guna bot',
  'tip.body':'1️⃣ Tekan <b>Tambah Baki</b>, buat bayaran, baki masuk.\n2️⃣ Tekan <b>Beli Nombor</b> → pilih pelayan → aplikasi → negara.\n3️⃣ Kod OTP dihantar ke sembang ini.\n4️⃣ Kod tak masuk? Batalkan, baki dipulangkan penuh.',
  'dep.title':'Tambah Baki','dep.pick':'Pilih jumlah yang ingin ditambah.','dep.min':'Minimum','dep.max':'Maksimum',
  'dep.qris':'Imbas QR di atas, kemudian hantar <b>gambar resit</b> ke sembang ini.',
  'dep.wait':'Resit anda telah dihantar kepada pemilik kedai. Sila tunggu pengesahan.',
  'dep.ok':'Baki anda telah ditambah','dep.no':'Resit anda ditolak oleh pemilik kedai.',
  'dep.send':'📤 Hantar Resit','dep.amt':'Jumlah','dep.total':'Jumlah untuk dibayar',
  'ord.habis':'⚠️ Stok kedai habis. Sila hubungi khidmat pelanggan.',
  'ord.kurang':'⚠️ Baki anda tidak mencukupi.','ord.ok':'✅ Pesanan dibuat! Kod OTP akan muncul di sini.'},
 en:{
  'menu.buy':'🛍 Order Number','menu.dep':'💰 Top Up','menu.his':'📜 History','menu.acc':'👤 Account',
  'menu.cs':'💬 Customer Service','menu.panel':'🏪 Store Panel','menu.home':'🏠 Main Menu','menu.back':'⬅️ Back',
  'dash.hello':'Hi','dash.intro':'Buy virtual numbers & top up right here — fast, safe and automatic 24/7.',
  'sec.akun':'Account Summary','sec.toko':'Store Summary',
  'f.status':'Status','f.role':'Role','f.saldo':'Balance','f.aktif':'Active Orders','f.sukses':'Completed',
  'f.toko':'Store','f.cs':'Customer Service','f.cust':'Customers','f.terjual':'Numbers Sold','f.layanan':'Service',
  'v.aktif':'🟢 Online','v.maint':'🔴 Maintenance','v.owner':'Owner','v.cust':'Customer','v.24':'24/7',
  'tip.title':'💡 How to use this bot',
  'tip.body':'1️⃣ Tap <b>Top Up</b>, pay, balance lands instantly.\n2️⃣ Tap <b>Order Number</b> → pick server → app → country.\n3️⃣ The OTP code is delivered right here.\n4️⃣ No code? Cancel and get a full refund.',
  'dep.title':'Top Up','dep.pick':'Choose the amount you want to add.','dep.min':'Minimum','dep.max':'Maximum',
  'dep.qris':'Scan the QR above, then send a <b>payment screenshot</b> in this chat.',
  'dep.wait':'Your receipt was sent to the store owner. Please wait for confirmation.',
  'dep.ok':'Your balance has been topped up','dep.no':'Your receipt was rejected by the store owner.',
  'dep.send':'📤 Send Receipt','dep.amt':'Amount','dep.total':'Total to pay',
  'ord.habis':'⚠️ The store is out of stock. Please contact customer service.',
  'ord.kurang':'⚠️ Your balance is not enough.','ord.ok':'✅ Order created! The OTP will show up here.'}}
D.ph=D.en;D.th=D.en;D.vi=D.en
export const T=(a,k)=>{const l=(a&&a.lang)||'id';return (D[l]&&D[l][k])||D.id[k]||k}

// ---------- kamus STRUK & notifikasi ----------
// Struk dan notifikasi toko reseller ikut bahasa tokonya. Kunci yang belum
// diterjemahkan otomatis memakai bahasa Indonesia.
const S={
 id:{'t.wait':'Menunggu Pembayaran','t.depok':'Deposit Berhasil','t.dep':'Deposit','t.otp':'OTP Diterima',
  't.ready':'Nomor Siap Dipakai','t.waitotp':'Menunggu Kode OTP','t.order':'Order','t.in':'Saldo Masuk','t.out':'Saldo Keluar',
  's.ok':'BERHASIL','s.wait':'MENUNGGU','s.proc':'DIPROSES','s.exp':'KEDALUWARSA','s.cancel':'DIBATALKAN','s.fail':'GAGAL',
  'r.nominal':'Nominal','r.bonus':'Bonus','r.method':'Metode','r.pay':'Harus dibayar','r.paid':'Dibayar',
  'r.total':'Total masuk','r.service':'Layanan','r.country':'Negara','r.number':'Nomor','r.otp':'Kode OTP',
  'r.price':'Harga','r.guar':'Jaminan OTP','r.on':'Aktif','r.refund':'Saldo dikembalikan','r.note':'Keterangan',
  'r.after':'Saldo setelahnya','r.in':'Saldo masuk','r.out':'Saldo keluar',
  'r.time':'Waktu','r.idlbl':'ID','n.deppend':'DEPOSIT MENUNGGU BAYAR','n.depok':'DEPOSIT MASUK','n.order':'PESANAN BARU','n.otp':'OTP DITERIMA',
  'n.cust':'Pelanggan','n.profit':'Untungmu','n.stock':'Potong stok','n.bal':'Saldo pelanggan','n.id':'ID',
  'n.waitacc':'Menunggu pemilik toko menyetujui bukti transfer','n.manual':'QRIS toko','n.proof':'Bukti transfer','n.acc':'Disetujui pemilik toko','n.rej':'Ditolak pemilik toko','n.waitpay':'Pelanggan belum membayar','n.added':'Saldo pelanggan sudah bertambah','n.waitotp':'Menunggu kode OTP masuk','n.done':'Transaksi selesai'},
 ms:{'t.wait':'Menunggu Pembayaran','t.depok':'Tambah Baki Berjaya','t.dep':'Deposit','t.otp':'Kod OTP Diterima',
  't.ready':'Nombor Sedia Digunakan','t.waitotp':'Menunggu Kod OTP','t.order':'Pesanan','t.in':'Baki Masuk','t.out':'Baki Keluar',
  's.ok':'BERJAYA','s.wait':'MENUNGGU','s.proc':'DIPROSES','s.exp':'LUPUT','s.cancel':'DIBATALKAN','s.fail':'GAGAL',
  'r.nominal':'Jumlah','r.bonus':'Bonus','r.method':'Kaedah','r.pay':'Perlu dibayar','r.paid':'Dibayar',
  'r.total':'Jumlah masuk','r.service':'Perkhidmatan','r.country':'Negara','r.number':'Nombor','r.otp':'Kod OTP',
  'r.price':'Harga','r.guar':'Jaminan OTP','r.on':'Aktif','r.refund':'Baki dipulangkan','r.note':'Keterangan',
  'r.after':'Baki selepasnya','r.in':'Baki masuk','r.out':'Baki keluar',
  'r.time':'Masa','r.idlbl':'ID','n.deppend':'TAMBAH BAKI MENUNGGU BAYARAN','n.depok':'BAKI MASUK','n.order':'PESANAN BARU','n.otp':'KOD OTP DITERIMA',
  'n.cust':'Pelanggan','n.profit':'Keuntunganmu','n.stock':'Potong stok','n.bal':'Baki pelanggan','n.id':'ID',
  'n.waitacc':'Menunggu pemilik kedai mengesahkan resit','n.manual':'QRIS kedai','n.proof':'Resit pemindahan','n.acc':'Disahkan pemilik kedai','n.rej':'Ditolak pemilik kedai','n.waitpay':'Pelanggan belum membayar','n.added':'Baki pelanggan telah ditambah','n.waitotp':'Menunggu kod OTP','n.done':'Transaksi selesai'},
 en:{'t.wait':'Awaiting Payment','t.depok':'Top Up Successful','t.dep':'Top Up','t.otp':'OTP Received',
  't.ready':'Number Ready','t.waitotp':'Waiting for OTP','t.order':'Order','t.in':'Balance In','t.out':'Balance Out',
  's.ok':'SUCCESS','s.wait':'PENDING','s.proc':'PROCESSING','s.exp':'EXPIRED','s.cancel':'CANCELLED','s.fail':'FAILED',
  'r.nominal':'Amount','r.bonus':'Bonus','r.method':'Method','r.pay':'To pay','r.paid':'Paid',
  'r.total':'Credited','r.service':'Service','r.country':'Country','r.number':'Number','r.otp':'OTP Code',
  'r.price':'Price','r.guar':'OTP Guarantee','r.on':'Active','r.refund':'Refunded','r.note':'Note',
  'r.after':'Balance after','r.in':'Balance in','r.out':'Balance out',
  'r.time':'Time','r.idlbl':'ID','n.deppend':'TOP UP AWAITING PAYMENT','n.depok':'TOP UP RECEIVED','n.order':'NEW ORDER','n.otp':'OTP RECEIVED',
  'n.cust':'Customer','n.profit':'Your profit','n.stock':'Stock used','n.bal':'Customer balance','n.id':'ID',
  'n.waitacc':'Waiting for the store owner to approve your receipt','n.manual':'Store QRIS','n.proof':'Payment receipt','n.acc':'Approved by the store owner','n.rej':'Rejected by the store owner','n.waitpay':'Customer has not paid yet','n.added':'Customer balance topped up','n.waitotp':'Waiting for the OTP','n.done':'Transaction complete'}}
S.ph=S.en;S.th=S.en;S.vi=S.en
// Paket bahasa untuk struk & notifikasi satu toko: label + penulis uang.
export const pack=a=>{const l=(a&&a.lang)||'id'
 return {lang:l,t:k=>(S[l]&&S[l][k])||S.id[k]||k,rp:n=>money(a,n),cur:(LANGS[l]||LANGS.id).cur}}
export const PACK_ID=pack({lang:'id'})
