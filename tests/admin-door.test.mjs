// Token pintu rahasia admin (ketuk ARTAPEDIA ID) dipakai tanpa password di /api/site-buttons, dengan masa berlaku & perpanjangan.
// Jalankan dari akar proyek: npx tsx tests/admin-door.test.mjs
process.env.ADMIN_PASSWORD='pw-rahasia'
const {kv}=await import('../lib/db.js')
const R=await import('../app/api/site-buttons/route.js')
let pass=0,fail=0
const ok=(c,m)=>{c?pass++:fail++;console.log((c?'  ✔ ':'  ✘ ')+m)}
const get=key=>R.GET(new Request('http://x/api/site-buttons?all=1',{headers:key?{'x-admin':key}:{}}))
const T1='a'.repeat(32),T2='b'.repeat(32),T3='c'.repeat(32)
await kv.set('tmp:adm:'+T1,{uid:'u1',email:'a@b.c',exp:Date.now()+8*36e5})
await kv.set('tmp:adm:'+T2,{uid:'u1',email:'a@b.c',exp:Date.now()-1000})
await kv.set('tmp:adm:'+T3,{uid:'u1',email:'a@b.c',exp:Date.now()+1*36e5})

ok((await get('pw-rahasia')).status===200,'password env tetap bisa masuk')
ok((await get(T1)).status===200,'token pintu rahasia yang sah masuk TANPA password')
ok((await get(T2)).status===401&&(await kv.get('tmp:adm:'+T2))==null,'token kedaluwarsa ditolak dan dihapus')
ok((await get('d'.repeat(32))).status===401&&(await get('salah')).status===401&&(await get('')).status===401,'token asing / password salah / tanpa kunci ditolak')
const sebelum=(await kv.get('tmp:adm:'+T3)).exp
ok((await get(T3)).status===200&&(await kv.get('tmp:adm:'+T3)).exp>sebelum+6*36e5,'token yang hampir habis diperpanjang saat dipakai (sesi aktif tidak putus)')
const t1=(await kv.get('tmp:adm:'+T1)).exp;await get(T1);ok((await kv.get('tmp:adm:'+T1)).exp===t1,'token yang masih lama tidak ditulis ulang tiap pakai')
const pub=await R.GET(new Request('http://x/api/site-buttons'));ok(pub.status===200,'daftar tombol publik tetap terbuka tanpa kunci')
console.log('\n'+pass+' lulus, '+fail+' gagal');process.exit(fail?1:0)
