// UPSTREAM = API v1 Artapedia yang sudah jalan (dokumentasi yang kamu kirim). Satu API key untuk semua pengguna situs ini.
const BASE=()=>process.env.ARTA_BASE||'https://artapedianokosmurahid.vercel.app/api/v1'
const up=async(path,body)=>{
 const r=await fetch(BASE()+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+process.env.ARTA_KEY,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined})
 const d=await r.json().catch(()=>({}));if(!r.ok||d.error)throw Error(d.error||('Upstream error '+r.status));return d}
export const SERVERS=[
 {server:'warungnokos_s1',name:'Server Plus',badge:'Utama',provider:'WarungNokos',description:'Jalur utama WarungNokos (H2H), stok melimpah & rate sukses tertinggi.'},
 {server:'warungnokos_s2',name:'Server Express',badge:'Global',provider:'WarungNokos S2',description:'Server2 WarungNokos, dipakai saat stok server utama kosong.'}]
const art=server=>({
 services:async()=>(await up('/services?server='+server)).items||[],
 // price = harga yang dipotong upstream dari saldo kita (sell_price upstream); markup kita ditambah di atasnya
 countries:async sid=>((await up(`/countries?server=${server}&service_id=${encodeURIComponent(sid)}`)).items||[]).map(c=>({...c,pricelist:(c.pricelist||[]).map(x=>({...x,price:+x.sell_price}))})),
 order:async b=>{const d=await up('/order',{server,serviceId:b.serviceId,countryId:b.countryId,providerId:b.providerId,operatorId:b.operatorId,serviceName:b.serviceName,countryName:b.countryName});return {id:String(d.orderId),phone:d.phoneNumber,expiredAt:d.expiredAt||Date.now()+10*60000,cost:d.price}},
 status:async id=>{const d=await up('/orders/status?order_id='+id);return {otp:d.otpCode||null,msg:d.otpMsg||null,state:d.status}},
 // CATATAN: endpoint cancel TIDAK ada di dokumentasi. Tambahkan POST /v1/orders/cancel di Artapedia lama, atau ubah baris ini.
 cancel:async id=>{await up('/orders/cancel',{order_id:id})}})
export const P={warungnokos_s1:art('warungnokos_s1'),warungnokos_s2:art('warungnokos_s2')}
// Deposit QRIS lewat upstream
export const upDep={
 methods:()=>up('/deposit/methods'),
 create:(amount,provider)=>up('/deposit',{amount,provider}),
 check:async id=>{const d=await up('/deposit?order_id='+id);return {status:d.status}}}
