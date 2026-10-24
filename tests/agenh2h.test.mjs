// Tes penarikan instan DANA lewat AgenH2H (fetch dipalsukan, tanpa jaringan).
// Jalankan dari akar proyek: npx tsx tests/agenh2h.test.mjs
process.env.CRON_SECRET='cronsecret'
import crypto from 'crypto'
const {kv}=await import('../lib/db.js')
const {resetSec}=await import('../lib/settings.js')
const PAY=await import('../lib/paygw.js')
const H=await import('../lib/h2h.js')
const WH=await import('../app/api/agenh2h/callback/route.js')
let pass=0,fail=0
const ok=(c,m)=>{c?pass++:fail++;console.log((c?'  ✔ ':'  ✘ ')+m)}
const rejects=async(f,re)=>{try{await f();return false}catch(e){return re.test(e.message)}}
const KEY='agen_key_x',SEC='agen_secret_y'
await kv.set('sec',{AGEN_KEY:KEY,AGEN_SECRET:SEC,AGEN_DANA_SKUS:'10000=SKU-D10, 20.000=SKU-D20'});resetSec()
const cfg={},U='uagen1'

ok(JSON.stringify(H.parseSkus('10000=AA, 20.000:BB ,bad, 5=CC'))==='{"10000":"AA","20000":"BB"}','parseSkus: nominal=SKU, abaikan yang tidak valid')
ok((await H.instNominals()).join()==='10000,20000','nominal instan datang dari AGEN_DANA_SKUS')
ok(await H.h2hReady(),'h2hReady true kalau key+secret+SKU terisi')

// ---- fetch palsu ----
let calls=[],plan=[]
globalThis.fetch=async(url,o)=>{
 calls.push({url:String(url),o})
 const step=plan.shift();if(step instanceof Error)throw step
 return new Response(step.body,{status:step.status})}
const J=(st,o)=>({status:st,body:JSON.stringify(o)})
const trx=(status,extra={})=>({success:true,data:{ref_id:'x',status,total:10500,serial_number:status==='success'?'SN123':[],message:status==='failed'?'Transaksi gagal':'',...extra}})

await PAY.getAcc(U);await PAY.adminSaldo(U,1000000,'test')
// 1) kirim -> status waiting -> processing; header & signature benar
plan=[J(201,trx('waiting'))]
let w=await PAY.instantWithdraw(cfg,U,{account:'081234567890',account_name:'Budi',nominal:10000})
ok(w&&w.status==='processing','status waiting dari AgenH2H -> penarikan processing (tunggu webhook)')
const c0=calls[0],hd=c0.o.headers,body=c0.o.body
ok(c0.url==='https://agenh2h.com/api/v1/transaction'&&c0.o.method==='POST','POST ke /api/v1/transaction')
const exp=crypto.createHmac('sha256',SEC).update(hd['X-Timestamp']+'\nPOST\n/api/v1/transaction\n'+body).digest('hex')
ok(hd['X-API-Key']===KEY&&hd['X-Signature']===exp,'header X-API-Key & signature HMAC canonical benar')
const sent=JSON.parse(body)
ok(sent.sku==='SKU-D10'&&sent.customer_id==='081234567890'&&sent.quantity===1&&/^\d{13}$/.test(sent.ref_id),'body: sku, customer_id, quantity, ref_id=idtrx')
let acc=await PAY.getAcc(U);const rec=acc.wd[0]
ok(acc.balance===1000000-10000-PAY.instFeeOf(cfg),'saldo terpotong nominal + biaya')

// 2) webhook: tanda tangan salah ditolak, benar -> sukses
const hook=async(payload,{key=KEY,secret=SEC,ts=String(Math.floor(Date.now()/1000))}={})=>{
 const raw=JSON.stringify(payload),sig=crypto.createHmac('sha256',secret).update(ts+'\n'+raw).digest('hex')
 return WH.POST(new Request('http://x/api/agenh2h/callback',{method:'POST',body:raw,headers:{'x-panelh2h-key':key,'x-panelh2h-timestamp':ts,'x-panelh2h-signature':sig}}))}
const ev=(status,ref)=>({event:'transaction.updated',delivery_id:'d'+Math.random(),data:{ref_id:ref,status,total:10500,serial_number:'SN999',message:status==='failed'?'gagal':'Transaksi Berhasil'}})
ok((await hook(ev('success',sent.ref_id),{secret:'salah'})).status===401,'webhook: signature salah -> 401')
ok((await hook(ev('success',sent.ref_id),{key:'lain'})).status===401,'webhook: API key salah -> 401')
ok((await hook(ev('success',sent.ref_id),{ts:String(Math.floor(Date.now()/1000)-900)})).status===401,'webhook: timestamp kedaluwarsa -> 401')
ok((await PAY.peek(U)).wd[0].status==='processing','webhook tak sah tidak mengubah apa pun')
ok((await hook({event:'webhook.test',data:{}})).status===200,'webhook.test -> 200')
ok((await hook(ev('success',sent.ref_id))).status===200,'webhook sah -> 200')
acc=await PAY.peek(U)
ok(acc.wd[0].status==='success'&&acc.wd[0].sn==='SN999','webhook success -> penarikan sukses + SN')
await hook(ev('success',sent.ref_id));ok((await PAY.peek(U)).outSum===10000+PAY.instFeeOf(cfg),'webhook ulang idempoten (tidak dihitung dua kali)')
const bal=(await PAY.peek(U)).balance
await hook(ev('failed',sent.ref_id));ok((await PAY.peek(U)).wd[0].status==='success'&&(await PAY.peek(U)).balance===bal,'laporan GAGAL setelah sukses tidak mengubah apa pun (konflik)')

// 3) ditolak sebelum dibuat -> refund otomatis
plan=[J(422,{success:false,code:'INSUFFICIENT_BALANCE',message:'Saldo tidak mencukupi.'})]
const b1=(await PAY.peek(U)).balance
w=await PAY.instantWithdraw(cfg,U,{account:'081234567890',account_name:'Budi',nominal:20000})
ok(w.status==='rejected'&&(await PAY.peek(U)).balance===b1,'INSUFFICIENT_BALANCE di AgenH2H -> ditolak & saldo kembali penuh')
ok(/INSUFFICIENT_BALANCE/.test(w.h2hText||''),'alasan tersimpan untuk admin')

// 4) timeout lalu retry dengan ref_id sama -> hasil dari percobaan kedua
plan=[Object.assign(new Error('t'),{name:'TimeoutError'}),J(201,trx('success'))]
calls=[]
w=await PAY.instantWithdraw(cfg,U,{account:'081234567891',account_name:'Budi',nominal:10000})
ok(calls.length===2&&JSON.parse(calls[0].o.body).ref_id===JSON.parse(calls[1].o.body).ref_id,'timeout -> diulang SEKALI dengan ref_id yang sama (idempoten)')
ok(w.status==='success','respons sukses langsung (status success) -> penarikan sukses')

// 5) timeout dua kali -> unknown, saldo tetap terpotong (admin memastikan)
plan=[Object.assign(new Error('t'),{name:'TimeoutError'}),Object.assign(new Error('t'),{name:'TimeoutError'})]
const b2=(await PAY.peek(U)).balance
w=await PAY.instantWithdraw(cfg,U,{account:'081234567892',account_name:'Budi',nominal:10000})
ok(w.status==='processing'&&(await PAY.peek(U)).balance===b2-10000-PAY.instFeeOf(cfg),'timeout 2x -> processing, TIDAK refund otomatis')
const idt=w.h2h.idtrx

// 6) Cloudflare challenge -> pesan bersih, tetap processing
plan=[{status:403,body:'<!DOCTYPE html><title>Just a moment...</title><style>*{box-sizing:border-box}</style>'}]
w=await PAY.instantWithdraw(cfg,U,{account:'081234567893',account_name:'Budi',nominal:10000})
ok(w.status==='processing'&&/^Diblokir firewall/.test(w.h2hText)&&!/box-sizing/.test(w.h2hText),'halaman Cloudflare -> pesan bersih, tanpa HTML mentah')

// 7) polling status: sukses, NOT_FOUND = gagal (refund)
plan=[J(200,trx('success'))]
let r=await H.h2hStatus(idt);ok(r.state==='success'&&r.sn==='SN123','h2hStatus membaca status success')
plan=[J(404,{success:false,code:'TRANSACTION_NOT_FOUND',message:'x'})]
r=await H.h2hStatus(idt);ok(r.state==='failed'&&r.notFound,'h2hStatus NOT_FOUND -> failed (tidak pernah tercatat)')

// 8) nominal di luar daftar SKU ditolak
ok(await rejects(()=>PAY.instantWithdraw(cfg,U,{account:'081234567890',account_name:'Budi',nominal:15000}),/Nominal penarikan instan yang tersedia: Rp10\.000, Rp20\.000/),'nominal tanpa SKU ditolak dengan daftar yang tersedia')


// 9) Tes koneksi tanpa SKU: tampilkan saran isian dari katalog
await kv.set('sec',{AGEN_KEY:KEY,AGEN_SECRET:SEC});resetSec()
plan=[J(200,{success:true,data:{user_id:'U1',name:'Toko',level:'Reseller',balance:50000}}),
 J(200,{success:true,data:[{sku:'DANA10',name:'DANA 10.000',game:'DANA',status:'available'},{sku:'DANA20',name:'DANA 20.000',game:'DANA',status:'available'},{sku:'DANA1',name:'DANA 1.000',game:'DANA',status:'available'},{sku:'ML5',name:'ML 5 Diamond',game:'Mobile Legends',status:'available'}]})]
calls=[]
const chk=await H.h2hCheck()
ok(!chk.ok&&/10000=DANA10, 20000=DANA20/.test(chk.info)&&!/DANA1\b.*1000=/.test(chk.info)&&!/ML5/.test(chk.info),'tes koneksi tanpa SKU menyarankan isian nominal=SKU (hanya DANA, nominal >= 5.000)')
ok(calls[1].url==='https://agenh2h.com/api/v1/products?q=dana&all=1','katalog diminta dengan query yang sama dengan yang ditandatangani')
const hd2=calls[1].o.headers
ok(hd2['X-Signature']===crypto.createHmac('sha256',SEC).update(hd2['X-Timestamp']+'\nGET\n/api/v1/products?q=dana&all=1\n').digest('hex'),'signature GET memakai path + query')

console.log('\n'+pass+' lulus, '+fail+' gagal');process.exit(fail?1:0)
