// Aksi panel admin untuk Admin Gateway. Dipanggil dari app/api/[...p]/route.js SETELAH
// pemeriksaan admin (password / token pintu rahasia) lolos — jadi file ini tidak mengurus auth.
// Kunci API dan secret tampil utuh di sini karena yang melihatnya hanya admin.
import * as G from './agw'
import {docsMd} from './agwdocs'
import {notify} from './telegram'

const ok=(o={})=>({status:200,body:{ok:1,...o}})
const bad=(m,s=400)=>({status:s,body:{error:m}})
const strip=k=>({id:k.id,name:k.name,key:k.key,secret:k.secret||'',on:k.on,ipw:k.ipw||[],at:k.at,
 hook:{url:(k.hook||{}).url||'',on:!!(k.hook||{}).on,secret:(k.hook||{}).secret||''}})

export async function handle(a,b,ctx){
 try{
  if(a==='data')return {status:200,body:await G.overview(ctx.site)}
  if(a==='cfg'){const c=await G.cfgSave(b.cfg||{});return ok({cfg:c})}
  if(a==='docs')return ok({md:docsMd(ctx.site+'/api/agw')})

  // ----- API key -----
  if(a==='key/new'){const k=await G.createKey(b.name)
   await notify({i:'🔑',t:'API key Gateway SMP dibuat',st:'admin',rows:[['Aplikasi',k.name]]}).catch(()=>{})
   return ok({key:strip(k)})}
  const id=String(b.id||'')
  if(a==='key/rename')return ok({key:strip(await G.renameKey(id,b.name))})
  if(a==='key/on')return ok({key:strip(await G.setKeyOn(id,!!b.on))})
  if(a==='key/regen'){const k=await G.regenKey(id)
   await notify({i:'🔑',t:'API key Gateway SMP diganti',st:'admin',rows:[['Aplikasi',k.name]],note:'Key lama langsung tidak berlaku.'}).catch(()=>{})
   return ok({key:strip(k)})}
  if(a==='key/secret')return ok({key:strip(await G.setSecretOn(id,!!b.on))})
  if(a==='key/ipw')return ok({key:strip(await G.setIpw(id,b.ipw))})
  if(a==='key/hook')return ok({key:strip(await G.setHook(id,b.url,!!b.on))})
  if(a==='key/hooksecret')return ok({key:strip(await G.regenHookSecret(id))})
  if(a==='key/hooktest'){const k=await G.keyById(id);if(!k)return bad('Key tidak ditemukan',404);return ok({result:await G.testHook(k)})}
  if(a==='key/del'){await G.delKey(id);return ok()}

  // ----- tagihan -----
  if(a==='inv')return {status:200,body:await G.listInvoices({status:b.status,q:b.q,keyId:b.keyId,page:b.page,limit:b.limit})}
  if(a==='inv/new'){                       // tagihan uji / tagihan manual atas nama key tertentu
   const k=await G.keyById(id);if(!k)return bad('Pilih API key dulu',404)
   const r=await G.createInvoice(k,{amount:b.amount,order_id:b.order_id||'',description:b.description||'Tagihan uji dari admin'})
   return ok({invoice:G.view(r.inv),existing:r.existing})}
  if(a==='inv/check'){const inv=await G.checkInvoice(id);return inv?ok({invoice:G.view(inv),hook:await G.hookState(id)}):bad('Tagihan tidak ditemukan',404)}
  if(a==='inv/cancel')return ok({invoice:G.view(await G.cancelInvoice(id))})
  if(a==='inv/paid'){const inv=await G.manualPaid(id,b.note)
   await notify({i:'🛠',t:'Admin tandai tagihan Gateway SMP lunas',st:'admin',id:['Invoice',inv.id],rows:[['Aplikasi',inv.keyName],['Nominal',String(inv.total)]]}).catch(()=>{})
   return ok({invoice:G.view(inv)})}
  if(a==='inv/resend'){const r=await G.resend(id);return ok({result:r})}
  if(a==='orphan/attach'){const inv=await G.attachOrphan(String(b.rrn||''),id);return ok({invoice:G.view(inv)})}
  return bad('Aksi tidak dikenal: '+a,404)}
 catch(e){
  if(e instanceof G.AErr)return bad(e.message,e.status>=500?500:e.status===404?404:400)
  return bad('Gagal: '+(e&&e.message||'error'),500)}}
