// Tes QRIS Gateway pengguna: mesin SMP Payment + tarik dana manual (acc/tolak admin).
// Jalankan dari akar proyek (tanpa MONGODB_URI, memakai database memori): npx tsx tests/paygw.test.mjs
process.env.CRON_SECRET='cronsecret'
const {kv}=await import('../lib/db.js')
const {resetSec}=await import('../lib/settings.js')
const PAY=await import('../lib/paygw.js')
const CB=await import('../app/api/callbackqris/[key]/route.js')
let pass=0,fail=0
const ok=(c,m)=>{c?pass++:fail++;console.log((c?'  ✔ ':'  ✘ ')+m)}
const rejects=async(f,re)=>{try{await f();return false}catch(e){return re.test(e.message)}}

const crc=s=>{let c=0xFFFF;for(let i=0;i<s.length;i++){c^=s.charCodeAt(i)<<8;for(let j=0;j<8;j++)c=(c&0x8000)?((c<<1)^0x1021):(c<<1);c&=0xFFFF}return c.toString(16).toUpperCase().padStart(4,'0')}
const q0='00020101021126260012ID.CO.EXAMPLE.WWW01101234567895204541153033605802ID5909TOKO TEST6007JAKARTA6304'
const QRIS=q0+crc(q0)
const setSec=async o=>{await kv.set('sec',o);resetSec()}
await setSec({SMP_SECRET:'sekret123',SMP_QRIS:QRIS,SMP_USERNAME:'jhon'})
globalThis.fetch=async()=>new Response(JSON.stringify({ok:true}),{status:200})
const smpCb=(total,rrn)=>CB.POST(new Request('http://x/api/callbackqris/sekret123',{method:'POST',body:JSON.stringify({rrn,amount:{value:String(total)+'.00'},us_username:'jhon',PayerName:'BUDI',issuer:'DANA',timestamp:'2026-10-22'})}),{params:{key:'sekret123'}})
const cfg={}
const U='u1'

console.log('\n[A] Pengaturan bawaan')
const p=PAY.payCfg(cfg)
ok(p.fee===2,'fee QRIS bawaan 2%')
ok(p.wdMin===5000&&p.wdMax===10000000,'WD minimal 5.000, maksimal 10.000.000')
ok(p.wdPct===3,'biaya WD bawaan 3%')
ok(PAY.payCfg({pay:{fee:0.7,wdMin:10000,wdFee:500}}).fee===2,'config lama (Austin) otomatis pakai standar baru')
ok(PAY.payCfg({pay:{v2:true,fee:5}}).fee===5,'config baru yang disimpan admin dihormati')
ok(PAY.feeOf(cfg,50000)===1000,'fee QRIS 2% dari 50.000 = 1.000')
ok(PAY.wdFeeOf(cfg,100000)===3000,'biaya WD 3% dari 100.000 = 3.000')

console.log('\n[B] QRIS lewat SMP Payment')
const r=await PAY.createQris(cfg,U,50000,'api')
ok(r.amount===50000&&r.fee===1000&&r.net===49000,'nominal 50.000 → fee 1.000 → masuk 49.000')
ok(r.total>50000&&r.total<=50999&&r.total-50000===r.unique,'total bayar = nominal + kode unik 1-999')
ok(r.qr.startsWith('000201')&&r.qr.includes('010212')&&r.qr.includes('54'+String(String(r.total).length).padStart(2,'0')+r.total),'QR string QRIS dinamis berisi nominal total')
ok(r.qrImg.startsWith('https://api.qrserver.com/'),'gambar QR tersedia')
ok(r.status==='pending'&&!!r.exp,'status pending + waktu kedaluwarsa')
ok((await PAY.checkQris(cfg,U,r.id)).status==='pending','sebelum dibayar tetap pending')
const res1=await smpCb(r.total,'RRN-1')
ok((await res1.json()).responseCode==='2005200','callback SMP dibalas sukses')
let acc=await PAY.getAcc(U)
ok(acc.balance===49000,'saldo gateway bertambah 49.000 (net)')
ok(acc.dep[0].status==='paid'&&acc.dep[0].credited,'QRIS ditandai paid')
const res2=await smpCb(r.total,'RRN-1')
ok((await res2.json()).responseCode==='2005201','rrn sama dibalas duplikat')
acc=await PAY.getAcc(U);ok(acc.balance===49000,'rrn dobel TIDAK mengkredit dua kali')
ok((await PAY.checkQris(cfg,U,r.id)).status==='paid','checkQris membaca status paid')
const orphanBefore=((await kv.get('smp:orphan'))||[]).length
await smpCb(777777,'RRN-X')
ok(((await kv.get('smp:orphan'))||[]).length===orphanBefore+1,'pembayaran tanpa tagihan dicatat orphan, saldo tidak berubah')
ok((await PAY.getAcc(U)).balance===49000,'saldo tetap setelah orphan')

console.log('\n[C] Batalkan & batas')
const r2=await PAY.createQris(cfg,U,20000)
const c=await PAY.cancelQris(cfg,U,r2.id)
ok(c.status==='canceled','QRIS bisa dibatalkan')
const late=await smpCb(r2.total,'RRN-LATE');ok((await PAY.getAcc(U)).balance===49000,'bayar QRIS yang sudah dibatalkan tidak mengkredit')
ok(await rejects(()=>PAY.createQris(cfg,U,500),/minimal/),'nominal di bawah minimal ditolak')
ok(await rejects(()=>PAY.createQris({pay:{on:false,v2:true}},U,5000),/dinonaktifkan/),'gateway dimatikan admin → ditolak')

console.log('\n[D] Tarik dana manual')
await PAY.adminSaldo(U,1000000,'modal tes')
ok((await PAY.getAcc(U)).balance===1049000,'admin tambah saldo')
ok(await rejects(()=>PAY.withdraw(cfg,U,{method:'DANA',account:'081234567890',account_name:'Budi',nominal:4999}),/minimal Rp5\.000/),'WD di bawah 5.000 ditolak')
ok(await rejects(()=>PAY.withdraw(cfg,U,{method:'DANA',account:'081234567890',account_name:'Budi',nominal:10000001}),/maksimal Rp10\.000\.000/),'WD di atas 10jt ditolak')
ok(await rejects(()=>PAY.withdraw(cfg,U,{method:'XXX',account:'081234567890',account_name:'Budi',nominal:10000}),/tidak dikenal/),'metode tidak dikenal ditolak')
ok(await rejects(()=>PAY.withdraw(cfg,U,{method:'DANA',account:'abc',account_name:'Budi',nominal:10000}),/digit/),'nomor tujuan harus angka')
ok(await rejects(()=>PAY.withdraw(cfg,U,{method:'DANA',account:'081234567890',account_name:'',nominal:10000}),/nama/i),'nama pemilik wajib')
ok(await rejects(()=>PAY.withdraw({pay:{v2:true,wdOn:false}},U,{method:'DANA',account:'081234567890',account_name:'Budi',nominal:10000}),/dinonaktifkan/),'fitur WD dimatikan admin → ditolak')
const off={pay:{v2:true,wdMethods:{OVO:false}}}
ok(await rejects(()=>PAY.withdraw(off,U,{method:'OVO',account:'081234567890',account_name:'Budi',nominal:10000}),/OVO sedang dinonaktifkan/),'metode OVO dimatikan admin → ditolak')
ok(!PAY.wdMethodList(off).find(m=>m.code==='OVO').on&&PAY.wdMethodList(off).find(m=>m.code==='DANA').on,'daftar metode: OVO mati, DANA hidup')
const w=await PAY.withdraw(cfg,U,{method:'dana',account:'0812 3456-7890',account_name:'Budi Santoso',nominal:100000})
ok(w.status==='pending'&&w.nominal===100000&&w.fee===3000&&w.net===97000,'WD 100.000 → status pending, biaya 3.000, diterima 97.000')
ok(w.dest==='081234567890'&&w.destName==='Budi Santoso','tujuan & nama tersimpan rapi')
ok((await PAY.getAcc(U)).balance===949000,'saldo langsung terpotong 100.000')
ok(/10 menit sampai 2 jam/.test(w.note)&&/sukses/.test(w.note),'keterangan WD berisi estimasi 10 menit–2 jam & status jadi sukses')
const L=await PAY.adminWdList()
ok(L.pending.length===1&&L.pending[0].transaction_id===w.id,'WD muncul di antrean admin')
const okr=await PAY.adminWdAct(w.id,'ok','')
ok(okr.w.status==='success','admin ACC → status sukses')
ok((await PAY.getAcc(U)).balance===949000,'saldo tidak berubah saat ACC')
ok(await rejects(()=>PAY.adminWdAct(w.id,'ok',''),/sudah diproses/),'ACC dua kali ditolak')
ok(await rejects(()=>PAY.adminWdAct(w.id,'no',''),/sudah diproses/),'tolak setelah ACC ditolak')
const w2=await PAY.withdraw(cfg,U,{method:'BCA',account:'1234567890',account_name:'Budi',nominal:200000})
ok((await PAY.getAcc(U)).balance===749000,'WD kedua memotong saldo')
const rej=await PAY.adminWdAct(w2.id,'no','nomor salah')
ok(rej.w.status==='rejected'&&(await PAY.getAcc(U)).balance===949000,'admin tolak → saldo dikembalikan')
ok(await rejects(()=>PAY.adminWdAct(w2.id,'no',''),/sudah diproses/),'tolak dua kali tidak mengembalikan saldo dobel')
ok((await PAY.getAcc(U)).balance===949000,'saldo tetap 949.000')
ok(await rejects(()=>PAY.withdraw(cfg,U,{method:'DANA',account:'081234567890',account_name:'Budi',nominal:2000000}),/tidak cukup/),'saldo kurang → ditolak')
ok(PAY.summary(await PAY.getAcc(U)).out.sum===100000,'ringkasan: total ditarik hanya yang sukses')
const v=PAY.wdView(w);ok(v.method==='DANA'&&v.net===97000&&v.method_name==='DANA'&&v.account_name==='Budi Santoso','wdView memuat metode, nama & net')

console.log(`\nHasil: ${pass} lulus, ${fail} gagal`)
process.exit(fail?1:0)
