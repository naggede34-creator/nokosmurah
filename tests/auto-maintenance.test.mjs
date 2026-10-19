process.env.CRON_SECRET='cronsecret'
const realNow=Date.now.bind(Date);let off=0;Date.now=()=>realNow()+off
globalThis.fetch=async()=>new Response('{}',{status:404})
const {kv}=await import('../lib/db.js')
const {getCfg}=await import('../lib/bonus.js')
const A=await import('../lib/autoclean.js')
const cron=await import('../app/api/cron/route.js')
let pass=0,fail=0;const ok=(c,m)=>{c?pass++:fail++;console.log((c?'  ✔ ':'  ✘ ')+m)}
const tick=async()=>(await (await cron.GET(new Request('http://x/api/cron?secret=cronsecret'))).json()).auto
const wibHM=ms=>{const w=new Date(ms+7*36e5);return String(w.getUTCHours()).padStart(2,'0')+':'+String(w.getUTCMinutes()).padStart(2,'0')}
const DAY=864e5
// ---- data uji ----
const mkU=async(id,o)=>{const u={id,email:id+'@x.com',balance:0,tx:[],mut:[],refCount:0,refEarn:0,joinedAt:new Date(realNow()-200*DAY).toISOString(),lastLogin:0,...o};await kv.set('u:'+id,u);await kv.sadd('idx',id)}
await mkU('idle1',{});await mkU('idle2',{})                         // tidak terpakai -> harus dihapus
await mkU('rich',{balance:5000});await mkU('hastx',{tx:[{type:'deposit',id:'D1',status:'completed'}]})   // harus AMAN
await mkU('banned',{banned:true});await mkU('fresh',{joinedAt:new Date().toISOString()})                  // harus AMAN
await kv.set('s:old','uid|'+(realNow()-40*DAY));await kv.set('s:new','uid|'+realNow())
await kv.set('pr:tok',{exp:realNow()-1000});await kv.set('pr:ok',{exp:realNow()+99999})
// jadwal = menit ini (WIB)
const now0=realNow();const slot=wibHM(now0)
const raw={autoc:{on:true,slots:[slot],mins:3,notifyUsers:true},maint:{on:true,mode:'soft',msg:'manual admin'}}   // admin sudah menyalakan maintenance manual sebelumnya
await kv.set('cfg',raw)
console.log('jadwal diuji =',slot,'WIB; maintenance manual (soft) sudah ON sebelum jadwal')

console.log('\n[1] Mulai otomatis')
let r=await tick();console.log('   ',JSON.stringify(r).slice(0,160))
let cfg=await getCfg()
ok(r&&r.started,'cron memulai siklus pada jam jadwal')
ok(cfg.maint.on&&cfg.maint.mode==='full'&&cfg.maint.auto,'situs masuk maintenance layar penuh (pesanan & deposit baru diblokir)')
ok(!(await kv.get('u:idle1'))&&!(await kv.get('u:idle2')),'2 pengguna tidak terpakai dibersihkan')
ok((await kv.get('u:rich'))&&(await kv.get('u:hastx'))&&(await kv.get('u:banned'))&&(await kv.get('u:fresh')),'pengguna bersaldo / bertransaksi / diblokir / baru AMAN')
ok(!(await kv.get('s:old'))&&(await kv.get('s:new')),'sesi kedaluwarsa dihapus, sesi aktif aman')
ok(!(await kv.get('pr:tok'))||(await kv.get('pr:tok'))===null,'token reset kedaluwarsa dihapus')
ok((await kv.get('pr:ok')),'token reset yang masih berlaku aman')
let st=await A.autoStatus();ok(st.active&&st.until>realNow()+off,'status admin: sedang aktif, hitung mundur jalan')

console.log('\n[2] Tengah jalan (+2 menit): tetap maintenance, tidak mulai ulang')
off=2*60000;r=await tick();cfg=await getCfg()
ok(r&&r.active&&cfg.maint.on,'masih maintenance (sisa '+(r&&r.left)+' dtk)')

console.log('\n[3] Lewat 3 menit (+3m05s): situs normal SEBELUM cron jalan, lalu cron menutup siklus')
off=3*60000+5000;cfg=await getCfg()
ok(!cfg.maint.on||cfg.maint.mode==='soft','getCfg langsung membaca maintenance selesai (tanpa menunggu cron)')
ok(cfg.maint.on&&cfg.maint.mode==='soft'&&cfg.maint.msg==='manual admin','kondisi manual admin sebelumnya (soft ON) dipulihkan persis')
r=await tick();console.log('   ',JSON.stringify(r).slice(0,200))
ok(r&&r.finished,'cron menyelesaikan siklus')
const raw2=await kv.get('cfg');ok(raw2.maint.on===true&&raw2.maint.mode==='soft'&&!raw2.maint.auto,'cfg tersimpan sudah dipulihkan, penanda auto hilang')
const last=await kv.get('tmp:auto:last');ok(last&&last.stats&&last.stats.users===2,'laporan akhir mencatat 2 pengguna dibersihkan')
ok((await kv.get('tmp:auto')).active===false,'status tidak aktif lagi')

console.log('\n[4] Tidak mengulang di slot yang sama (+4 menit, masih dalam jendela 8 menit)')
off=4*60000;r=await tick();ok(r&&r.idle,'tidak memulai ulang: '+JSON.stringify(r))

console.log('\n[5] Admin mematikan fitur')
const rr=await kv.get('cfg');rr.autoc.on=false;await kv.set('cfg',rr);off=0;r=await tick();ok(r&&r.off,'on=false -> cron tidak melakukan apa pun')

console.log('\n[6] Slot yang melewati tengah malam (23:58 WIB, cron telat sampai 00:02)')
const rz=await kv.get('cfg');rz.autoc={on:true,slots:['23:58'],mins:3};rz.maint={on:false,mode:'full',msg:'',srv:{}};await kv.set('cfg',rz);await kv.del('tmp:auto')
// geser jam virtual ke 00:02 WIB hari berikutnya dari slot
const w=new Date(realNow()+7*36e5);const target=Date.UTC(w.getUTCFullYear(),w.getUTCMonth(),w.getUTCDate()+1,0,2)-7*36e5
off=target-realNow();r=await tick();console.log('   jam virtual',wibHM(realNow()+off),'WIB ->',JSON.stringify(r))
ok(r&&r.started,'slot 23:58 yang telat sampai 00:02 tetap dijalankan')
console.log(`\nHASIL: ${pass} lulus, ${fail} gagal`);process.exit(fail?1:0)
