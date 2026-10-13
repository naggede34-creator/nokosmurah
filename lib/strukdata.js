// Bentuk data struk — SATU sumber untuk dua perender:
//   components/Struk.js  (browser, untuk tombol unduh/bagikan)
//   lib/strukimg.js      (server, untuk gambar yang ikut dikirim di notifikasi)
// Dengan begini struk yang diunduh pengguna dan struk yang nempel di notifikasi persis sama.
export const rp=n=>'Rp'+Math.round(+n||0).toLocaleString('id-ID')
export const dtWib=t=>t?new Date(t).toLocaleString('id-ID',{timeZone:'Asia/Jakarta',day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'}).replace('.',':')+' WIB':'-'
// Nomor ditampilkan separuh: struk dibuat untuk dipamerkan, jadi tidak boleh membocorkan nomor utuh.
export const maskNo=p=>{p=String(p||'');return p.length<7?p:p.slice(0,5)+'•'.repeat(Math.max(3,p.length-8))+p.slice(-3)}

const ST={success:'BERHASIL',completed:'BERHASIL',paid:'BERHASIL',pending:'MENUNGGU',processing:'DIPROSES',
 expired:'KEDALUWARSA',cancelled:'DIBATALKAN',canceled:'DIBATALKAN',failed:'GAGAL'}
export const st=v=>ST[String(v||'').toLowerCase()]||String(v||'-').toUpperCase()

// kind: 'order' · 'deposit' · 'mutasi' · 'withdraw' · 'qris'
// Hasil: {kind, title, amount, status, at, id, neg, rows:[[label,nilai]]}
export function strukData(x,kind){
 if(kind==='deposit'){const bonus=+x.bonus||0,total=+x.total_amount||+x.total||0
  const menunggu=x.status==='pending'
  return {kind,title:menunggu?'Menunggu Pembayaran':x.status==='completed'?'Deposit Berhasil':'Deposit '+st(x.status),
   amount:x.amount,status:st(x.status),at:x.createdAt?new Date(x.createdAt).getTime():x.at,id:x.order_id||x.id,
   rows:[['Nominal',rp(x.amount)],...(bonus>0?[['Bonus','+'+rp(bonus)]]:[]),['Metode',x.method_name||'QRIS'],
    ...(total&&total!==x.amount?[[menunggu?'Harus dibayar':'Dibayar',rp(total)]]:[]),
    ...(menunggu?[]:[['Total masuk',rp((+x.amount||0)+bonus)]])]}}
 if(kind==='mutasi'){const neg=(+x.amt||0)<0
  return {kind,neg,title:neg?'Saldo Keluar':'Saldo Masuk',amount:Math.abs(+x.amt||0),status:'TERCATAT',at:x.at,id:x.id||'-',
   rows:[['Keterangan',x.note||'-'],[neg?'Saldo keluar':'Saldo masuk',(neg?'-':'+')+rp(Math.abs(+x.amt||0))],
    ...(x.bal!=null?[['Saldo setelahnya',rp(x.bal)]]:[])]}}
 if(kind==='withdraw')return {kind,neg:true,title:x.status==='success'?'Penarikan Berhasil':'Penarikan '+st(x.status),
  amount:x.nominal,status:st(x.status),at:new Date(x.created_at||x.at).getTime(),id:x.transaction_id||x.id,
  rows:[['Tujuan',x.wallet||'-'],['Nomor',maskNo(x.destination)],['Nominal dikirim',rp(x.nominal)],
   ['Biaya',rp(x.fee)],['Saldo terpotong',rp(x.total)]]}
 if(kind==='qris')return {kind,title:x.status==='paid'?'Pembayaran Diterima':'QRIS '+st(x.status),
  amount:x.total_paid||x.amount,status:st(x.status),at:new Date(x.created_at||x.at).getTime(),id:x.transaction_id||x.id,
  rows:[['Nominal diminta',rp(x.amount)],['Dibayar pembeli',rp(x.total_paid)],['Biaya layanan',rp(x.fee)],['Masuk saldo',rp(x.net)],['Metode','QRIS']]}
 // order nokos — kalau OTP-nya sudah masuk, kodenya ikut ditampilkan HANYA pada struk milik pembeli
 const okO=x.status==='success'
 return {kind:'order',title:okO?(x.otp?'OTP Diterima':'Nomor Siap Dipakai'):x.status==='pending'?'Menunggu Kode OTP':'Order '+st(x.status),
  amount:x.price,status:st(x.status),at:new Date(x.createdAt||x.at).getTime(),id:x.orderId||x.id,
  rows:[['Layanan',x.serviceName||'-'],['Negara',x.countryName||'-'],['Nomor',maskNo(x.phoneNumber||x.phone)],
   ...(x.otp&&x.showOtp?[['Kode OTP',String(x.otp)]]:[]),
   ['Harga',rp(x.price)],...(x.guarantee?[['Jaminan OTP','Aktif']]:[]),
   ...(!okO&&x.refunded?[['Saldo dikembalikan','+'+rp(x.price)]]:[])]}}

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
