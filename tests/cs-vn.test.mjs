// CS: pesan suara (VN) + hapus pesan sendiri (pengguna & admin). Jalankan: npx tsx tests/cs-vn.test.mjs
process.env.ADMIN_PASSWORD='pwx'
const {kv}=await import('../lib/db.js')
const {save}=await import('../lib/auth.js')
const {resetSec}=await import('../lib/settings.js')
let pass=0,fail=0;const ok=(c,m)=>{c?pass++:fail++;console.log((c?'  ✔ ':'  ✘ ')+m)}
globalThis.fetch=async()=>new Response(JSON.stringify({ok:true,result:{message_id:1}}),{status:200})
await kv.set('sec',{TELEGRAM_BOT_TOKEN:'1:x',TELEGRAM_CHAT_ID:'-1'});resetSec()
const route=await import('../app/api/[...p]/route.js')
const call=async(p,b,{key,adm,raw}={})=>{const h={'content-type':'application/json',...(adm?{'x-admin':'pwx'}:{}),...(key?{authorization:'Bearer '+key}:{})}
 const res=await (b?route.POST:route.GET)(new Request('https://x.test/api/'+p,{method:b?'POST':'GET',headers:h,body:b?JSON.stringify(b):undefined}),{params:{p:p.split('?')[0].split('/')}})
 return raw?res:{s:res.status,j:await res.json().catch(()=>({}))}}
const mk=async n=>{const id='u'+n+Math.random().toString(36).slice(2,6),u={id,email:id+'@x.com',name:id,pass:'',balance:0,apikey:'key'+id,banned:false,tx:[],mut:[],joinedAt:new Date().toISOString()};await save(u);await kv.set('k:'+u.apikey,u.id);return u}
const A=await mk('a'),B=await mk('b')
const AUD={b64:Buffer.from('OggS-fake-opus-data-1234567890').toString('base64'),mime:'audio/webm;codecs=opus',dur:7}

console.log('\n[A] Pengguna kirim VN')
let r=await call('v1/cs',{aud:AUD},{key:A.apikey})
const m=(r.j.msgs||[]).find(x=>x.aud)
ok(r.s===200&&m&&m.from==='user'&&m.aud.dur===7&&m.id,'VN tersimpan: ada id, durasi, audio di pesan')
ok(!JSON.stringify(r.j).includes(AUD.b64),'data audio TIDAK ikut di daftar pesan (ringan)')
let a=await call('v1/cs/audio?id='+m.aud.id,null,{key:A.apikey,raw:true})
ok(a.status===200&&/audio\/webm/.test(a.headers.get('content-type'))&&Buffer.from(await a.arrayBuffer()).toString().startsWith('OggS'),'pemilik bisa memutar audionya')
a=await call('v1/cs/audio?id='+m.aud.id,null,{key:B.apikey,raw:true});ok(a.status===404,'pengguna lain TIDAK bisa memutar audio ini')
r=await call('v1/cs',{aud:{...AUD,mime:'text/html'}},{key:A.apikey});ok(r.s===400&&/Format/.test(r.j.error),'format selain audio ditolak')
r=await call('v1/cs',{aud:{...AUD,b64:Buffer.alloc(700*1024).toString('base64')}},{key:A.apikey});ok(r.s===400&&/terlalu besar/.test(r.j.error),'VN > 600 KB ditolak')
r=await call('v1/cs',{aud:{...AUD,b64:'<script>'}},{key:A.apikey});ok(r.s===400,'data bukan base64 ditolak')

console.log('\n[B] Admin dengar & balas VN')
let t=await call('admin/cs/thread',{uid:A.id},{adm:1});ok(t.j.msgs.some(x=>x.aud),'admin melihat VN pengguna')
let au=await call('admin/cs/audio',{uid:A.id,id:m.aud.id},{adm:1});ok(au.s===200&&au.j.mime==='audio/webm'&&Buffer.from(au.j.b64,'base64').toString().startsWith('OggS'),'admin bisa memutar VN pengguna')
r=await call('admin/cs/reply',{uid:A.id,text:'',aud:AUD},{adm:1});const am=(r.j.msgs||[]).filter(x=>x.from==='admin'&&x.aud).pop();ok(am&&am.id,'admin membalas dengan VN')
a=await call('v1/cs/audio?id='+am.aud.id,null,{key:A.apikey,raw:true});ok(a.status===200,'pengguna bisa memutar VN dari admin')

console.log('\n[C] Hapus pesan sendiri')
r=await call('v1/cs',{text:'pesan salah kirim'},{key:A.apikey});const tm=r.j.msgs.find(x=>x.text==='pesan salah kirim')
r=await call('v1/cs',{del:tm.id},{key:A.apikey});ok(r.s===200&&!r.j.msgs.some(x=>x.text==='pesan salah kirim'),'pengguna menghapus pesannya sendiri')
r=await call('v1/cs',{del:am.id},{key:A.apikey});ok(r.s===404,'pengguna TIDAK bisa menghapus balasan admin')
r=await call('v1/cs',{del:m.id},{key:B.apikey});ok(r.s===404,'pengguna lain TIDAK bisa menghapus pesan orang lain')
r=await call('v1/cs',{del:m.id},{key:A.apikey});ok(r.s===200&&!r.j.msgs.some(x=>x.aud&&x.from==='user'),'hapus VN sendiri')
a=await call('v1/cs/audio?id='+m.aud.id,null,{key:A.apikey,raw:true});ok(a.status===404&&!(await kv.get('csa:'+m.aud.id)),'file audio ikut terhapus')
t=await call('admin/cs/thread',{uid:A.id},{adm:1});const um=t.j.msgs.find(x=>x.from==='user');
await call('v1/cs',{text:'halo admin'},{key:A.apikey});t=await call('admin/cs/thread',{uid:A.id},{adm:1});const um2=t.j.msgs.find(x=>x.text==='halo admin')
r=await call('admin/cs/delmsg',{uid:A.id,id:um2.id},{adm:1});ok(r.s===404,'admin TIDAK bisa menghapus pesan pengguna')
r=await call('admin/cs/delmsg',{uid:A.id,id:am.id},{adm:1});ok(r.s===200&&!r.j.msgs.some(x=>x.id===am.id),'admin menghapus balasannya sendiri')
ok(!(await kv.get('csa:'+am.aud.id)),'audio balasan admin ikut terhapus')
r=await call('admin/cs/delmsg',{uid:A.id,id:am.id},{adm:1});ok(r.s===404,'hapus ulang → tidak ditemukan')
console.log(`\nHasil: ${pass} lulus, ${fail} gagal`);process.exit(fail?1:0)
