// Daftar SKU DANA di AgenH2H (untuk diisi ke admin > Integrasi > AgenH2H > AGEN_DANA_SKUS).
// Jalankan di komputermu (bukan di server):  AGEN_KEY=... AGEN_SECRET=... node scripts/agen-sku.mjs [kata kunci, default: dana]
import crypto from 'crypto'
const key=process.env.AGEN_KEY,secret=process.env.AGEN_SECRET,q=process.argv[2]||'dana'
if(!key||!secret){console.error('Isi AGEN_KEY dan AGEN_SECRET lewat environment');process.exit(1)}
const uri='/api/v1/products?q='+encodeURIComponent(q)+'&all=1',ts=String(Math.floor(Date.now()/1000))
const sig=crypto.createHmac('sha256',secret).update(ts+'\nGET\n'+uri+'\n').digest('hex')
const r=await fetch('https://agenh2h.com'+uri,{headers:{Accept:'application/json','X-API-Key':key,'X-Timestamp':ts,'X-Signature':sig}})
const j=await r.json().catch(()=>null)
if(!j||!j.success){console.error('Gagal:',r.status,JSON.stringify(j));process.exit(1)}
for(const p of j.data)console.log([p.sku,p.name,'| nominal:',p.nominal,'| harga modal:',p.price,'|',p.status,p.requires_user_id?'(butuh customer_id)':'',p.requires_server_id?'(butuh server_id)':''].join(' '))
console.log('\nContoh isian AGEN_DANA_SKUS: 10000=SKU_10K, 20000=SKU_20K')
