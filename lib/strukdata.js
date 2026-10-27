// Bentuk data struk — SATU sumber untuk dua perender:
//   components/Struk.js  (browser, untuk tombol unduh/bagikan)
//   lib/strukimg.js      (server, untuk gambar yang ikut dikirim di notifikasi)
// Dengan begini struk yang diunduh pengguna dan struk yang nempel di notifikasi persis sama.
export const rp=n=>'Rp'+Math.round(+n||0).toLocaleString('id-ID')
export const dtWib=t=>t?new Date(t).toLocaleString('id-ID',{timeZone:'Asia/Jakarta',day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'}).replace('.',':')+' WIB':'-'
// Nomor ditampilkan separuh: struk dibuat untuk dipamerkan, jadi tidak boleh membocorkan nomor utuh.
export const maskNo=p=>{p=String(p||'');return p.length<7?p:p.slice(0,5)+'•'.repeat(Math.max(3,p.length-8))+p.slice(-3)}

const SK={success:'s.ok',completed:'s.ok',paid:'s.ok',pending:'s.wait',processing:'s.proc',
 expired:'s.exp',cancelled:'s.cancel',canceled:'s.cancel',failed:'s.fail',rejected:'s.rej'}
// Paket bahasa bawaan: Indonesia + rupiah. Toko reseller mengirim paketnya sendiri
// (lihat lib/rslang.js → pack(a)), jadi struk & notifikasinya ikut bahasa toko.
export const ID={lang:'id',t:k=>({'t.wait':'Menunggu Pembayaran','t.depok':'Deposit Berhasil','t.dep':'Deposit','t.otp':'OTP Diterima',
 't.ready':'Nomor Siap Dipakai','t.waitotp':'Menunggu Kode OTP','t.order':'Order','t.in':'Saldo Masuk','t.out':'Saldo Keluar',
 's.ok':'BERHASIL','s.wait':'MENUNGGU','s.proc':'DIPROSES','s.exp':'KEDALUWARSA','s.cancel':'DIBATALKAN','s.fail':'GAGAL','s.rej':'DITOLAK',
 'r.nominal':'Nominal','r.bonus':'Bonus','r.method':'Metode','r.pay':'Harus dibayar','r.paid':'Dibayar','r.total':'Total masuk',
 'r.service':'Layanan','r.country':'Negara','r.number':'Nomor','r.otp':'Kode OTP','r.price':'Harga','r.guar':'Jaminan OTP',
 'r.on':'Aktif','r.refund':'Saldo dikembalikan','r.note':'Keterangan','r.after':'Saldo setelahnya','r.in':'Saldo masuk','r.out':'Saldo keluar','r.time':'Waktu','r.idlbl':'ID'})[k]||k,
 rp:n=>rp(n)}
export const st=(v,L)=>{const P=L||ID,k=SK[String(v||'').toLowerCase()];return k?P.t(k):String(v||'-').toUpperCase()}

// kind: 'order' · 'deposit' · 'mutasi' · 'withdraw' · 'qris'
// Hasil: {kind, title, amount, status, at, id, neg, rows:[[label,nilai]]}
export function strukData(x,kind,L){
 const P=L||ID,T=k=>P.t(k),rpx=n=>P.rp(n)
 if(kind==='deposit'){const bonus=+x.bonus||0,total=+x.total_amount||+x.total||0
  const menunggu=x.status==='pending'
  return {kind,title:menunggu?T('t.wait'):x.status==='completed'?T('t.depok'):T('t.dep')+' '+st(x.status,P),
   amount:x.amount,status:st(x.status,P),at:x.createdAt?new Date(x.createdAt).getTime():x.at,id:x.order_id||x.id,
   rows:[[T('r.nominal'),rpx(x.amount)],...(bonus>0?[[T('r.bonus'),'+'+rpx(bonus)]]:[]),[T('r.method'),x.method_name||'QRIS'],
    ...(total&&total!==x.amount?[[menunggu?T('r.pay'):T('r.paid'),rpx(total)]]:[]),
    ...(menunggu?[]:[[T('r.total'),rpx((+x.amount||0)+bonus)]])]}}
 if(kind==='mutasi'){const neg=(+x.amt||0)<0
  return {kind,neg,title:neg?T('t.out'):T('t.in'),amount:Math.abs(+x.amt||0),status:st('success',P),at:x.at,id:x.id||'-',
   rows:[[T('r.note'),x.note||'-'],[neg?T('r.out'):T('r.in'),(neg?'-':'+')+rpx(Math.abs(+x.amt||0))],
    ...(x.bal!=null?[[T('r.after'),rpx(x.bal)]]:[])]}}
 if(kind==='withdraw')return {kind,neg:true,title:x.status==='success'?'Penarikan Berhasil':x.status==='pending'?'Penarikan Diproses':x.status==='rejected'?'Penarikan Ditolak':'Penarikan '+st(x.status,P),
  amount:x.nominal,status:st(x.status,P),at:new Date(x.created_at||x.at).getTime(),id:x.transaction_id||x.id,
  rows:[['Tujuan',x.method_name||x.wallet||'-'],['Nomor',maskNo(x.destination)],...(x.account_name?[['Atas nama',x.account_name]]:[]),['Nominal tarik',rp(x.nominal)],
   ['Biaya',rp(x.fee)],['Diterima',rp(x.net!=null?x.net:(x.nominal-x.fee))],['Saldo terpotong',rp(x.total)]]}
 if(kind==='rswd')return {kind,neg:true,title:x.status==='success'?'Penarikan Berhasil':x.status==='failed'?'Penarikan Ditolak':'Penarikan Diproses',
  amount:x.nominal,status:{processing:'DIPROSES',success:'BERHASIL',failed:'DITOLAK'}[x.status]||'DIPROSES',at:new Date(x.at).getTime(),id:x.id,
  rows:[['Tujuan',x.wallet||'-'],['Nomor',maskNo(x.phone)],...(x.holder?[['Atas nama',x.holder]]:[]),['Nominal',rpx(x.nominal)],['Saldo terpotong',rpx(x.total)],
   ...(x.status==='failed'?[['Saldo kembali','+'+rpx(x.total)]]:[]),...(x.msg?[['Catatan',x.msg]]:[])]}
 if(kind==='qris')return {kind,title:x.status==='paid'?'Pembayaran Diterima':x.status==='pending'?'Menunggu Pembayaran':'QRIS '+st(x.status,P),
  amount:x.total_paid||x.amount,status:st(x.status,P),at:new Date(x.created_at||x.at).getTime(),id:x.transaction_id||x.id,
  rows:[['Nominal diminta',rp(x.amount)],[x.status==='paid'?'Dibayar pembeli':'Harus dibayar',rp(x.total_paid)],['Biaya layanan',rp(x.fee)],['Masuk saldo',rp(x.net)],['Metode','QRIS']]}
 // suntik sosmed (SMM). Menerima catatan mentah (lib/smm.js) maupun hasil view() dari API.
 if(kind==='smm'){
  const ev=x.ev||'',qty=+x.qty||+x.quantity||0,start=x.start!=null?x.start:x.startCount,rem=+x.remains||0,ref=+x.refAmt||(typeof x.refunded==='number'?x.refunded:0)
  const S={pending:'MENUNGGU',processing:'DIPROSES',success:'BERHASIL',partial:'SEBAGIAN',cancelled:'DIBATALKAN'}
  const T2={pending:'Order Suntik Masuk',processing:'Suntik Sedang Diproses',success:'Suntik Berhasil',partial:'Suntik Selesai Sebagian',cancelled:'Suntik Dibatalkan'}
  const RF={refill:['Refill Diminta','DIMINTA'],refill_done:['Refill Selesai','BERHASIL'],refill_rejected:['Refill Ditolak','DITOLAK']}[ev]
  const lnk=String(x.link||'-').replace(/^https?:\/\/(www\.)?/i,''),n=v=>(+v||0).toLocaleString('id-ID')
  return {kind,title:RF?RF[0]:(T2[x.status]||'Order Suntik'),amount:x.price,status:RF?RF[1]:(S[x.status]||String(x.status||'-').toUpperCase()),
   at:new Date(x.createdAt||x.at).getTime(),id:x.orderId||x.id,
   rows:[['Layanan',x.serviceName||'-'],['Target',lnk.length>34?lnk.slice(0,33)+'…':lnk],['Jumlah',n(qty)],
    ...(start!=null&&['success','partial'].includes(x.status)?[['Jumlah awal',n(start)]]:[]),
    ...(x.status==='partial'?[['Terkirim',n(Math.max(0,qty-rem))],['Sisa',n(rem)]]:[]),
    ['Harga',rpx(x.price)],...(ref>0?[['Saldo dikembalikan','+'+rpx(ref)]]:[])]}}
// order nokos — kalau OTP-nya sudah masuk, kodenya ikut ditampilkan HANYA pada struk milik pembeli
 const okO=x.status==='success'
 return {kind:'order',title:okO?(x.otp?T('t.otp'):T('t.ready')):x.status==='pending'?T('t.waitotp'):T('t.order')+' '+st(x.status,P),
  amount:x.price,status:st(x.status,P),at:new Date(x.createdAt||x.at).getTime(),id:x.orderId||x.id,
  rows:[[T('r.service'),x.serviceName||'-'],[T('r.country'),x.countryName||'-'],[T('r.number'),maskNo(x.phoneNumber||x.phone)],
   ...(x.otp&&x.showOtp?[[T('r.otp'),String(x.otp)]]:[]),
   [T('r.price'),rpx(x.price)],...(x.guarantee?[[T('r.guar'),T('r.on')]]:[]),
   ...(!okO&&x.refunded?[[T('r.refund'),'+'+rpx(x.price)]]:[])]}}

// Tanda status digambar sebagai GARIS, bukan huruf: glyph ✓ / ✕ / ↗ tidak ada di
// semua font (Liberation Sans tidak punya), dan huruf yang hilang muncul sebagai kotak kosong.
// Dipakai perender browser maupun server supaya bentuknya sama persis.
export function drawMark(x,cx,cy,r,type){
 x.save();x.strokeStyle='#fff';x.lineWidth=Math.max(3,r*.16);x.lineCap='round';x.lineJoin='round'
 x.beginPath()
 if(type==='ok'){const s=r*.52
  x.moveTo(cx-s,cy+r*.04);x.lineTo(cx-s*.18,cy+s*.62);x.lineTo(cx+s,cy-s*.54)}
 else if(type==='out'){const s=r*.44           // panah keluar (penarikan / saldo keluar)
  x.moveTo(cx-s,cy+s);x.lineTo(cx+s,cy-s)
  x.moveTo(cx+s*.1,cy-s);x.lineTo(cx+s,cy-s);x.lineTo(cx+s,cy-s*.1)}
 else if(type==='wait'){const s=r*.5           // jam: lingkaran + dua jarum
  x.arc(cx,cy,s,0,Math.PI*2);x.moveTo(cx,cy-s*.52);x.lineTo(cx,cy);x.lineTo(cx+s*.42,cy+s*.2)}
 else{const s=r*.46                            // silang (gagal)
  x.moveTo(cx-s,cy-s);x.lineTo(cx+s,cy+s);x.moveTo(cx+s,cy-s);x.lineTo(cx-s,cy+s)}
 x.stroke();x.restore()}
