// Tombol sosial (Telegram, WhatsApp, dst.) di footer. Disimpan di MongoDB (koleksi "kv", kunci "site_buttons")
// sebagai array: [{id,label,icon_url,url,is_active,order}]. Ikut ter-backup otomatis karena bukan kunci sementara.
//   GET    /api/site-buttons          publik  -> tombol aktif, urut
//   GET    /api/site-buttons?all=1    admin   -> semua tombol (header x-admin)
//   POST   /api/site-buttons          admin   -> tambah {label,url,icon_url?,is_active?}
//   PUT    /api/site-buttons          admin   -> ubah {id,...field} atau urutkan {order:[id,id,...]}
//   DELETE /api/site-buttons?id=ID    admin   -> hapus
// Selama admin belum pernah menyimpan, GET publik memakai NEXT_PUBLIC_TG_URL / NEXT_PUBLIC_WA_URL sebagai isi awal.
import {kv} from '../../../lib/db'
import {rid} from '../../../lib/auth'
export const dynamic='force-dynamic'
const KEY='site_buttons',MAX=12
const J=(d,s=200)=>Response.json(d,{status:s,headers:{'Cache-Control':'no-store'}})
const E=(m,s=400)=>J({error:m},s)
// Admin: password env, ATAU token pintu rahasia (hasil ketuk ARTAPEDIA ID, disimpan server, berlaku 8 jam & diperpanjang selama dipakai)
const adm=async req=>{
 const key=req.headers.get('x-admin')||''
 if(process.env.ADMIN_PASSWORD&&key===process.env.ADMIN_PASSWORD)return true
 if(!/^[a-f0-9]{32}$/.test(key))return false
 const t=await kv.get('tmp:adm:'+key)
 if(t&&t.exp>Date.now()){if(t.exp-Date.now()<6*36e5){t.exp=Date.now()+8*36e5;await kv.set('tmp:adm:'+key,t)}return true}
 if(t)await kv.del('tmp:adm:'+key)
 return false}
const urlOk=u=>/^https?:\/\/[^\s]+$/i.test(u)
const iconOk=i=>i===''||urlOk(i)||(/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(i)&&i.length<=120000)
const defaults=()=>[['Telegram',process.env.NEXT_PUBLIC_TG_URL],['WhatsApp',process.env.NEXT_PUBLIC_WA_URL]].filter(([,u])=>u&&urlOk(u)).map(([label,url],i)=>({id:'default-'+i,label,icon_url:'',url,is_active:true,order:i}))
const read=async()=>{const v=await kv.get(KEY);return Array.isArray(v)?v:null}
const norm=a=>[...a].sort((x,y)=>x.order-y.order).map((x,i)=>({...x,order:i}))
function clean(b,partial){
 const o={}
 if(!partial||b.label!==undefined){const l=String(b.label||'').trim().slice(0,40);if(!l)return {error:'Nama tombol wajib diisi'};o.label=l}
 if(!partial||b.url!==undefined){const u=String(b.url||'').trim();if(!urlOk(u)||u.length>500)return {error:'Link harus diawali http:// atau https://'};o.url=u}
 if(b.icon_url!==undefined){const i=String(b.icon_url||'').trim();if(!iconOk(i))return {error:'Logo harus link gambar atau file PNG/JPG/WEBP/GIF (maks ~90KB)'};o.icon_url=i}
 else if(!partial)o.icon_url=''
 if(b.is_active!==undefined)o.is_active=!!b.is_active
 return {data:o}}

export async function GET(req){
 const q=new URL(req.url).searchParams
 const st=await read(),list=norm(st??defaults())
 if(q.get('all')){if(!await adm(req))return E('unauthorized',401);return J({items:list,stored:st!==null})}
 return J({items:list.filter(x=>x.is_active).map(({id,label,icon_url,url,order})=>({id,label,icon_url,url,order}))})}

export async function POST(req){
 if(!await adm(req))return E('unauthorized',401)
 const b=await req.json().catch(()=>({})),v=clean(b,false);if(v.error)return E(v.error)
 const list=norm((await read())??defaults());if(list.length>=MAX)return E('Maksimal '+MAX+' tombol')
 const next=[...list,{id:rid().slice(0,10),...v.data,is_active:b.is_active!==false,order:list.length}]
 await kv.set(KEY,next);return J({items:next})}

export async function PUT(req){
 if(!await adm(req))return E('unauthorized',401)
 const b=await req.json().catch(()=>({})),list=norm((await read())??defaults())
 if(Array.isArray(b.order)){
  const ix=new Map(b.order.map((id,i)=>[String(id),i])),next=norm(list.map(x=>({...x,order:ix.has(x.id)?ix.get(x.id):1000+x.order})))
  await kv.set(KEY,next);return J({items:next})}
 const i=list.findIndex(x=>x.id===b.id);if(i<0)return E('Tombol tidak ditemukan',404)
 const v=clean(b,true);if(v.error)return E(v.error)
 list[i]={...list[i],...v.data};await kv.set(KEY,list);return J({items:list})}

export async function DELETE(req){
 if(!await adm(req))return E('unauthorized',401)
 const id=new URL(req.url).searchParams.get('id'),list=norm((await read())??defaults())
 if(!list.some(x=>x.id===id))return E('Tombol tidak ditemukan',404)
 const next=norm(list.filter(x=>x.id!==id));await kv.set(KEY,next);return J({items:next})}
