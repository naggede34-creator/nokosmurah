// Dua mode Clean: "web" (sampah website) dan "db" (sampah MongoDB), plus ketahanan terhadap gangguan koneksi sementara.
// Jalankan dari akar proyek: npx tsx tests/kelola-clean.test.mjs
const {kv}=await import('../lib/db.js')
const KEL=await import('../lib/kelola.js')
let pass=0,fail=0
const ok=(c,m)=>{c?pass++:fail++;console.log((c?'  ✔ ':'  ✘ ')+m)}
const DAY=86400000,OLD=Date.now()-30*DAY
const run=async(mode,dry,opts={})=>{let state=null,r;for(let i=0;i<400;i++){r=await KEL.cleanStep(state,dry,Date.now()+15000,{mode,...opts});state=r.state;if(r.done)return r}throw Error('tidak selesai')}
const mkUser=(id,o={})=>kv.set('u:'+id,{id,email:id+'@x.com',balance:0,joinedAt:new Date(OLD).toISOString(),lastLogin:OLD,tx:[],mut:[],...o})
const T=new Error('connection 14 to 159.143.63.89:27017 timed out');T.name='MongoNetworkTimeoutError'
ok(KEL.transient(T)&&!KEL.transient(new Error('nominal salah')),'transient(): kenali gangguan koneksi, bukan galat biasa')

// ---------- data uji ----------
await kv.set('idx',['junk1','junk2','junk3','buyer','rich','newbie','ref','pend','failonly','botowner'])
await mkUser('junk1')                                                     // kosong total
await mkUser('junk2',{tx:[{type:'order',id:'o2',status:'failed',at:OLD,refunded:true}],mut:[{amt:-3000,note:'Order o2',at:OLD},{amt:3000,note:'Refund order gagal',at:OLD}]})
await kv.set('o:o2','junk2')
await mkUser('junk3',{tx:[{type:'deposit',id:'d3',status:'expired',at:OLD}]});await kv.set('d:d3','junk3')
await mkUser('buyer',{tx:[{type:'order',id:'ob',status:'success',at:OLD,price:5000}],mut:[{amt:10000,note:'Deposit',at:OLD},{amt:-5000,note:'Order ob',at:OLD}]})
await mkUser('rich',{balance:7000})
await mkUser('newbie',{joinedAt:new Date().toISOString(),lastLogin:Date.now()})
await mkUser('ref',{refCount:2})
await mkUser('pend',{tx:[{type:'order',id:'op',status:'pending',at:Date.now()}]})
await mkUser('failonly',{tx:[{type:'order',id:'of',status:'failed',at:OLD,refunded:true}],mut:[{amt:-9000,note:'Order of',at:OLD}]}) // dipotong tapi tidak ada refund tercatat -> JANGAN dihapus
await mkUser('botowner')
await kv.set('rs:botowner',{uid:'botowner',balance:0,stok:0,earn:0,sold:0,bot:{id:'b1'},wd:[],dep:[],sreq:[]})
await kv.set('bots',[{id:'b1',rs:'botowner',token:'t',at:OLD,username:'bot1'},{id:'b2',rs:'rsrich',token:'t',at:OLD,username:'bot2'},{id:'b3',rs:'rsnew',token:'t',at:Date.now(),username:'bot3'}])
await kv.set('rs:rsrich',{uid:'rsrich',balance:5000,stok:0,earn:0,sold:0,bot:{id:'b2'},wd:[],dep:[],sreq:[]})
await kv.set('rs:rsnew',{uid:'rsnew',balance:0,stok:0,earn:0,sold:0,bot:{id:'b3'},wd:[],dep:[],sreq:[]})
await kv.set('s:dead','x|'+(Date.now()-90*DAY))

ok(KEL.userJunk(await kv.get('u:junk1'),7)&&KEL.userJunk(await kv.get('u:junk2'),7)&&KEL.userJunk(await kv.get('u:junk3'),7),'userJunk: kosong / hanya gagal+refund / hanya deposit kedaluwarsa = sampah')
ok(!KEL.userJunk(await kv.get('u:buyer'),7)&&!KEL.userJunk(await kv.get('u:rich'),7)&&!KEL.userJunk(await kv.get('u:newbie'),7)&&!KEL.userJunk(await kv.get('u:ref'),7)&&!KEL.userJunk(await kv.get('u:pend'),7)&&!KEL.userJunk(await kv.get('u:failonly'),7),'userJunk: pembeli, saldo>0, baru daftar, punya referral, order menunggu, pengeluaran tanpa refund = DILINDUNGI')

// ---------- Clean 1 (web): uji dulu lalu hapus ----------
const dry=await run('web',true)
ok(!!(await kv.get('u:junk1'))&&!!(await kv.get('o:o2')),'mode uji TIDAK menghapus apa pun')
ok(dry.stats.users===4&&dry.stats.botsZero===1&&dry.stats.botsDitahan===1,'hitungan uji: 4 pengguna (termasuk pemilik bot untung 0), 1 bot untung 0 (1 bot dengan saldo dompet ditahan)')
const real=await run('web',false)
ok(real.stats.users===4&&real.stats.botsZero===1,'hapus sungguhan sama persis dengan hitungan uji')
for(const id of ['junk1','junk2','junk3','botowner'])ok((await kv.get('u:'+id))==null,'pengguna sampah '+id+' terhapus PERMANEN')
for(const id of ['buyer','rich','newbie','ref','pend','failonly'])ok(!!(await kv.get('u:'+id)),'pengguna '+id+' tetap ada')
ok((await kv.get('e:junk1@x.com'))==null&&!((await kv.get('idx'))||[]).includes('junk1'),'indeks & peta email ikut bersih')
ok((await kv.get('o:o2'))==null&&(await kv.get('d:d3'))==null,'penunjuk order/deposit milik pengguna terhapus tidak tersisa (data yatim)')
const bots=await kv.get('bots')
ok(!bots.some(b=>b.id==='b1')&&bots.some(b=>b.id==='b2')&&bots.some(b=>b.id==='b3'),'bot untung 0 terhapus; bot berdompet & bot baru (<7 hari) aman')
ok((await kv.get('rs:botowner'))==null&&!!(await kv.get('rs:rsrich')),'akun reseller kosong ikut terhapus permanen, yang berisi aman')
ok((await kv.get('s:dead'))==null,'sesi lama terhapus')
const again=await run('web',false)
ok(!(again.stats.users||again.stats.botsZero),'dijalankan lagi: tidak ada yang tersisa (idempoten)')

// ---------- Clean V2 (db) ----------
await kv.set('sec',{WN_KEY:'k1',WN_BASE:'b',SMSCODE_KEY:'k2',SMSCODE_HOOK_SECRET:'s',ARTA_KEY:'a',DIBANANA_KEY:'keep'})
await kv.set('cfg',{wn:{countries:'1'},srv:{warungnokos_s1:{on:1},dibanana_s1:{on:1}},off:['smscode_s1','dibanana_s2'],mks:{warungnokos_s2:{x:1},dibanana_s1:{x:1}},
 maint:{on:false,srv:{smscode_s1:{on:true},dibanana_s1:{on:true}}},dep:{routes:{warungnokos:{on:true},pakasir:{on:true}},routes4:{warungnokos:{on:true}}}})
await kv.set('rs:rsrich',{uid:'rsrich',balance:5000,stok:0,earn:0,sold:0,bot:{id:'b2'},wd:[],dep:[],sreq:[],mkS:{warungnokos_s1:{a:1},dibanana_s1:{a:2}}})
await kv.set('kosong:1',null);await kv.set('kosong:2',null)
await kv.set('mysteri:abc',{x:1});await kv.set('mysteri:def',{x:2});await kv.set('lainnya',{x:3})
const dry2=await run('db',true)
ok(!!(await kv.get('sec')).WN_KEY&&(await kv.get('cfg')).wn!==undefined,'V2 mode uji tidak mengubah pengaturan')
ok(dry2.stats.legacy===13&&dry2.stats.dbKosong===2,'V2 uji: menghitung sisa penyedia lama & dokumen kosong')
const r2=await run('db',false)
const sec=await kv.get('sec'),cfg=await kv.get('cfg'),rs=await kv.get('rs:rsrich')
ok(sec.WN_KEY===undefined&&sec.SMSCODE_KEY===undefined&&sec.SMSCODE_HOOK_SECRET===undefined&&sec.ARTA_KEY===undefined&&sec.WN_BASE===undefined,'kredensial WarungNokos/SMSCode terhapus dari pengaturan')
ok(sec.DIBANANA_KEY==='keep','kredensial Dibanana tidak tersentuh')
ok(cfg.wn===undefined&&!cfg.srv.warungnokos_s1&&!!cfg.srv.dibanana_s1&&!cfg.off.includes('smscode_s1')&&cfg.off.includes('dibanana_s2')&&!cfg.mks.warungnokos_s2&&!!cfg.mks.dibanana_s1,'konfigurasi server lama terhapus, Dibanana utuh')
ok(!cfg.maint.srv.smscode_s1&&!!cfg.maint.srv.dibanana_s1&&cfg.dep.routes.warungnokos===undefined&&cfg.dep.routes4.warungnokos===undefined&&cfg.dep.routes.pakasir.on===true,'maintenance & rute deposit lama terhapus, rute lain utuh')
ok(!rs.mkS.warungnokos_s1&&!!rs.mkS.dibanana_s1&&rs.balance===5000,'markup reseller server lama terhapus, saldo reseller utuh')
ok((await kv.get('kosong:1'))==null&&r2.stats.dbKosong===2,'dokumen kosong terhapus')
ok(!!(await kv.get('mysteri:abc'))&&r2.unknown['mysteri:']===2&&r2.unknown['lainnya']===1,'awalan tak dikenal HANYA dilaporkan, tidak dihapus')
ok(!!(await kv.get('u:buyer'))&&!!(await kv.get('u:rich')),'V2 tidak menyentuh data pengguna')

// ---------- ketahanan: gangguan sementara ----------
const asli=kv.scanPrefix.bind(kv);let gagal=0
kv.scanPrefix=async(...a)=>{if(gagal<3){gagal++;throw T}return asli(...a)}
let thrown=null,rr;try{rr=await run('web',true)}catch(e){thrown=e}
ok(!thrown&&rr.done,'gangguan sementara TIDAK melempar error & Clean tetap selesai')
kv.scanPrefix=async()=>{throw T}
thrown=null;try{await run('web',true)}catch(e){thrown=e}
ok(thrown&&/MongoDB Atlas/.test(thrown.message),'gangguan terus-menerus -> berhenti dengan pesan yang menunjuk ke Atlas')
kv.scanPrefix=async()=>{throw new Error('bug lain')}
thrown=null;try{await KEL.cleanStep(null,true,Date.now()+5000,{mode:'web'})}catch(e){thrown=e}
ok(thrown&&thrown.message==='bug lain','galat non-koneksi tidak ditelan')
console.log('\n'+pass+' lulus, '+fail+' gagal');process.exit(fail?1:0)
