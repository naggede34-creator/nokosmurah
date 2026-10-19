'use client'
import {useState,useEffect,useRef} from 'react'
import './admin.css'
import {toCsv} from '../../lib/userexport'
import AdminUser from '../../components/AdminUser'
import AdminBots from '../../components/AdminBots'
import AdminAuto from '../../components/AdminAuto'
import AdminBroadcast from '../../components/AdminBroadcast'
import PushCard from '../../components/PushCard'
import AdminMoney from '../../components/AdminMoney'
import AdminJobs from '../../components/AdminJobs'
import AdminReseller from '../../components/AdminReseller'
import AdminKelola from '../../components/AdminKelola'
import AdminPopups from '../../components/AdminPopups'
import AdminOrders from '../../components/AdminOrders'
import {onPush,ringtone,localNotify,primeAudio} from '../../components/push'
const rp=n=>'Rp'+(+n||0).toLocaleString('id-ID')
// kecilkan gambar di browser supaya ringan (maks 1000px, JPEG)
const shrinkS=f=>new Promise((res,rej)=>{const r=new FileReader();r.onerror=rej;r.onload=()=>{const im=new Image();im.onerror=rej;im.onload=()=>{for(const [m,q] of [[900,.72],[700,.6],[520,.5]]){const k=Math.min(1,m/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=im.width*k;c.height=im.height*k;c.getContext('2d').drawImage(im,0,0,c.width,c.height);const o=c.toDataURL('image/jpeg',q);if(o.length<=280000)return res(o)}rej(new Error('big'))};im.src=r.result};r.readAsDataURL(f)})
const shrink=f=>new Promise((res,rej)=>{const r=new FileReader();r.onerror=rej;r.onload=()=>{const im=new Image();im.onerror=rej;im.onload=()=>{const k=Math.min(1,1000/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=im.width*k;c.height=im.height*k;c.getContext('2d').drawImage(im,0,0,c.width,c.height);res(c.toDataURL('image/jpeg',.8))};im.src=r.result};r.readAsDataURL(f)})
const ROUTE_INFO={warungnokos:['WarungNokos','QRIS lewat akun WarungNokos resmi — saldo masuk ke akun yang sama dengan server nokos WarungNokos','WN_KEY'],pakasir:['Pakasir','QRIS + Virtual Account (API v2)','PAKASIR_SLUG + PAKASIR_KEY'],austin:['AustinPay','QRIS lewat AustinPay — mesin yang sama dengan QRIS Gateway','AUSTIN_KEY'],smp:['SMP Payment','QRIS statis + kode unik, saldo masuk lewat callback SMP Payment (/api/callbackqris/KEY)','SMP_QRIS + SMP_SECRET']}
const ENGINES={v1:['V1','Semua rute','WarungNokos · Pakasir · AustinPay · SMP Payment','warungnokos,pakasir,austin,smp'],v2:['V2','Rute baru','Hanya Pakasir & AustinPay','pakasir,austin']}
const METH_NAME={qris:'QRIS',bri_va:'VA BRI',bni_va:'VA BNI',cimb_niaga_va:'VA CIMB Niaga',permata_va:'VA Permata',maybank_va:'VA Maybank',bnc_va:'VA Bank Neo Commerce',artha_graha_va:'VA Artha Graha',sampoerna_va:'VA Sahabat Sampoerna'}
const GROUPS=[['warungnokos','WarungNokos','Server nokos WarungNokos S1/S2/S2-lama + deposit QRIS WarungNokos','wn'],['smscode','SMSCode','Server nokos SERVER FAST OTP V 1 (api.smscode.gg)','smscode'],['dibanana','Dibanana','Server nokos Dibanana (ekonomi, premium, khusus, wa luar) · dibanana.id. Webhook OTP (opsional): isi alamat https://DOMAINKAMU/api/hook/dibanana di Profile > Webhook Dibanana, lalu salin Webhook Secret ke kolom di bawah.','dibanana'],['csbot','Bot Customer Service','Chat CS dari web masuk ke Telegram admin, dan bisa dibalas dari Telegram. Buat bot BARU di @BotFather, isi token + ID Telegram admin (kirim /start ke bot untuk melihat ID), simpan, lalu tekan Pasang webhook.','csbot'],['pakasir','Pakasir','Deposit QRIS & Virtual Account','pakasir'],['austin','AustinPay','Mesin QRIS Gateway: buat QRIS & tarik dana otomatis','austin'],['smp','SMP Payment','Deposit QRIS H2H. URL callback yang ditempel di SMP Payment: https://DOMAINKAMU/api/callbackqris/ISI_SMP_SECRET',null],['telegram','Telegram','Notifikasi channel & backup otomatis','telegram'],['situs','Situs','Dipakai untuk link reset password',null],['email','Email (Resend)','Kirim email reset password otomatis',null],['google','Login Google','Callback: https://DOMAINKAMU/api/auth/google/callback',null],['github','Login GitHub','Callback: https://DOMAINKAMU/api/auth/github/callback',null]]
const Sw=({on,set,label})=><button type="button" role="switch" aria-checked={!!on} aria-label={label} className={'sw'+(on?' on':'')} onClick={()=>set(!on)}><i/></button>
const Chip=({c,children})=><span className={'chip2 '+(c||'')}>{children}</span>
// Menu admin dikelompokkan per urusan, bukan satu deretan panjang 15 tombol.
const NAV=[
 ['Operasional','⚡',[['main','Ringkasan','📊'],['ord','Transaksi nokos','🧾'],['dep','Deposit','💳'],['srv','Server nokos','🖥'],['mk','Harga & markup','💰'],['gw','QRIS Gateway','⚡']]],
 ['Pengguna','👥',[['cs','Customer Service','💬'],['job','Job & saldo gratis','🎁'],['rs','Reseller','🏪'],['bot','Bot Telegram','🤖'],['bca','Broadcast semua bot','📡'],['notif','Notifikasi channel','🔔']]],
 ['Isi situs','🎨',[['home','Beranda & angka','🏠'],['ann','Pengumuman','📣'],['pop','Popup promosi','🪧'],['apk','Aplikasi (APK)','📱'],['promo','Promo & hadiah','🎁'],['btn','Tombol sosial','🧩']]],
 ['Sistem','🛠',[['kl','Kelola','🧰'],['int','Integrasi & kunci','🔌'],['tap','Pintu rahasia','🔓'],['mt','Maintenance','🚧'],['site','Link API','🔗'],['bk','Backup & restore','💾']]]]
const TAB_NAME=Object.fromEntries(NAV.flatMap(g=>g[2].map(t=>[t[0],[t[1],t[2],g[0]]])))
function AdHead({d,tab,unread}){const us=d.users||[],tot=us.reduce((a,u)=>a+(+u.balance||0),0),t=TAB_NAME[tab]||['Ringkasan','📊','Operasional']
 const mOn=d.cfg.maint&&d.cfg.maint.on
 return <div className="ad-head"><div className="ad-ttl"><h1>Admin Panel</h1>
   <small>Artapedia ID · <b>{t[2]}</b> › {t[1]} {t[0]}</small>
   <div className="ad-flags">{mOn&&<Chip c="warn">🚧 Maintenance aktif</Chip>}{unread>0&&<Chip c="blue">💬 {unread} chat belum dibaca</Chip>}</div></div>
  <div className="ad-kpi"><div><small>Pengguna</small><b>{us.length}</b></div><div><small>Total saldo user</small><b>{rp(tot)}</b></div><div><small>Dibanned</small><b>{us.filter(u=>u.banned).length}</b></div><div><small>Markup</small><b>{d.cfg.markup}%</b></div></div></div>}
// Navigasi: daftar berkelompok (sidebar di layar lebar, geser mendatar di HP)
function AdNav({tab,setTab,unread}){
 return <nav className="ad-nav" aria-label="Menu admin">{NAV.map(([g,gi,items])=><div key={g} className="ad-grp">
  <div className="ad-glbl"><span>{gi}</span>{g}</div>
  <div className="ad-gitems">{items.map(([k,l,i])=><button key={k} className={tab===k?'on':''} onClick={()=>setTab(k)}>
   <span className="adi">{i}</span><span className="adl">{l}</span>{k==='cs'&&unread>0&&<em>{unread}</em>}</button>)}</div></div>)}</nav>}
export default function A(){
 const [pw,setPw]=useState(''),[d,setD]=useState(null),[em,setEm]=useState(''),[n,setN]=useState(0),[t,setT]=useState(''),[tab,setTab]=useState('main')
 const [btn,setBtn]=useState([]),[an,setAn]=useState({title:'',body:'',img:''}),[th,setTh]=useState([]),[cur,setCur]=useState(null),[ms,setMs]=useState([]),[rt,setRt]=useState(''),[rimg,setRimg]=useState('')
 const box=useRef(null),curR=useRef(null);curR.current=cur
 const [pr,setPr]=useState(null),[bk,setBk]=useState(null),[bs,setBs]=useState(''),[imode,setImode]=useState('merge'),[bb,setBb]=useState(false),[bh,setBh]=useState({on:true,hours:24}),[st,setSt]=useState(null),[sn,setSn]=useState(null)
 const [wh,setWh]=useState(null),[whB,setWhB]=useState(''),[cb,setCb]=useState(null),[cbB,setCbB]=useState('')
 const [bip,setBip]=useState(null)
 const [mkS,setMkS]=useState(null),[mkB,setMkB]=useState('10000'),[mkSv,setMkSv]=useState(false),[ig,setIg]=useState(null),[se,setSe]=useState({}),[tr,setTr]=useState({}),[dp,setDp]=useState(null),[sr,setSr]=useState(null),[sb,setSb]=useState(false)
 const [ud,setUd]=useState(null),[uq,setUq]=useState('')
 const [gw,setGw]=useState(null),[gc,setGc]=useState(null),[gt,setGt]=useState(null)
 const [po,setPo]=useState(null),[poBusy,setPoBusy]=useState(false),[poSel,setPoSel]=useState(0)
 const [ap,setAp]=useState(null),[apBusy,setApBusy]=useState(false)
 const [csm,setCsm]=useState(null),[csBusy,setCsBusy]=useState(false)
 const [tp,setTp]=useState(null),[rsDays,setRsDays]=useState('7'),[rsBusy,setRsBusy]=useState(false),[rsOut,setRsOut]=useState(null)
 const [gwSel,setGwSel]=useState(null),[gwAmt,setGwAmt]=useState(''),[gwNote,setGwNote]=useState(''),[gwBusy,setGwBusy]=useState('')
 // panel saldo di dalam ruang chat CS
 const [cu,setCu]=useState(null),[sAmt,setSAmt]=useState(''),[sNote,setSNote]=useState(''),[sTell,setSTell]=useState(true),[sBusy,setSBusy]=useState('')
 const EMPTY={id:'',name:'',balance:'',trx:'',dep:'',ok:'',spent:''},[lf,setLf]=useState(EMPTY)
 // Pemanggil API admin. Balasan server yang BUKAN JSON (Vercel membalas teks "An error occurred..." saat fungsi kehabisan waktu / terlalu besar)
 // dulu langsung meledak jadi "Unexpected token 'A' ... is not valid JSON". Sekarang diubah jadi {error} yang jelas;
 // timeout:true / net:true dipakai menu Kelola untuk mengulang otomatis dengan beban lebih kecil.
 const call=async(a,b)=>{
  let r,t
  try{r=await fetch('/api/admin/'+a,{method:'POST',headers:{'Content-Type':'application/json','x-admin':pw},body:JSON.stringify(b||{})});t=await r.text()}
  catch(e){return {error:'Koneksi ke server terputus ('+((e&&e.message)||'jaringan')+'). Coba lagi.',net:true}}
  try{return JSON.parse(t)}catch(e){
   const to=[500,502,503,504].includes(r.status)||/timeout|an error o|FUNCTION_/i.test(t)
   return {error:r.status===413?'Data terlalu besar untuk satu kiriman (HTTP 413).':to?'Server kehabisan waktu atau sedang sibuk (HTTP '+r.status+'). Coba lagi sebentar.':'Server membalas bukan JSON (HTTP '+r.status+'): '+t.replace(/<[^>]+>/g,' ').trim().slice(0,100),timeout:to,status:r.status}}}
 // sama seperti call, tapi diulang otomatis (maks. 4x) kalau server kehabisan waktu / koneksi putus. Untuk langkah yang aman diulang (backup/page, backup/import).
 const callR=async(a,b)=>{let r;for(let i=0;i<4;i++){r=await call(a,b);if(!r||!(r.timeout||r.net))return r;await new Promise(x=>setTimeout(x,800*(i+1)))}return r}
 const pushApi=(a,b)=>call(a,b||{})
 // chat masuk saat panel admin terbuka: bunyikan nada panggilan (service worker tidak bisa memutar suara sendiri)
 useEffect(()=>onPush(()=>ringtone(12)),[])
 // Token dari pintu rahasia (?t=...) dipakai seperti password, lalu dibuang dari alamat
 // supaya tidak ikut tersalin kalau pengguna membagikan tautannya.
 useEffect(()=>{try{const u=new URL(location.href),t=u.searchParams.get('t')
  if(t&&/^[a-f0-9]{32}$/.test(t)){setPw(t);u.searchParams.delete('t');history.replaceState(null,'',u.pathname+u.search)}}catch(e){}},[])
 useEffect(()=>{if(pw&&!d)load()},[pw])
 const load=async()=>{primeAudio();const r=await call('data');setD(r);if(r.cfg){setBtn(r.cfg.buttons||[]);setPr(p=>p||{ref:{...r.cfg.ref},bonus:{...r.cfg.bonus},weekly:{...r.cfg.weekly,prizes:(r.cfg.weekly.prizes||[]).join(', ')},monthly:{...r.cfg.monthly,prizes:(r.cfg.monthly.prizes||[]).join(', ')}});setSt(x=>x||{...r.cfg.site});setDp(x=>x||JSON.parse(JSON.stringify(r.cfg.dep)));setSr(x=>x||{srv:JSON.parse(JSON.stringify(r.cfg.srv||{})),wnc:String((r.cfg.wn||{}).countries||''),wnm:String((r.cfg.wn||{}).max||10),dbc:{...((r.cfg.dbn||{}).countries||{})}});setSn(x=>x||{users:String((r.cfg.stats||{}).users??''),orders:String((r.cfg.stats||{}).orders??'')});setTp(x=>x||{on:!!(r.cfg.tap||{}).on,n:String((r.cfg.tap||{}).n||20),emails:((r.cfg.tap||{}).emails||[]).join(', ')})
  setPo(x=>x||JSON.parse(JSON.stringify(r.cfg.pops||[])));setAp(x=>x||{...(r.cfg.apk||{})});setCsm(x=>x||{on:(r.cfg.cs||{}).on!==false,msg:(r.cfg.cs||{}).msg||''})}}
 const savePop=async()=>{setPoBusy(true);const r=await call('pop/save',{pops:po});setPoBusy(false)
  if(r.error)return alert(r.error);setPo(r.pops);alert('Popup disimpan. Pengguna akan melihatnya saat membuka situs.');load()}
 const saveApk=async()=>{setApBusy(true);const r=await call('apk/save',ap);setApBusy(false)
  if(r.error)return alert(r.error);setAp(r.apk);alert(r.apk.on?'Halaman /apk aktif dengan tautan unduhan.':'Disimpan. Halaman /apk menampilkan cara pasang versi web.');load()}
 const saveCs=async()=>{setCsBusy(true);const r=await call('cs/mode',csm);setCsBusy(false)
  if(r.error)return alert(r.error);setCsm(r.cs);alert(r.cs.on?'Customer service DIBUKA (mengikuti jam layanan).':'Customer service DIMATIKAN. Pengguna melihat alasanmu.');load()}
 const act=async(a,b)=>{const r=await call(a,b);if(r.error)alert(r.error);load();return r}
 const [mt,setMt]=useState(null),[mtSv,setMtSv]=useState(false)
 useEffect(()=>{if(d&&d.cfg&&!mt)setMt(JSON.parse(JSON.stringify(d.cfg.maint||{on:false,mode:'full',msg:'',srv:{}})))},[d])
 const saveMt=async()=>{setMtSv(true);const r=await call('maint/save',{maint:mt});setMtSv(false);if(r.error)return alert(r.error);alert(mt.on?'Maintenance seluruh situs AKTIF.':'Disimpan. Seluruh situs normal.');load()}
 const dlUsers=async fmt=>{setBb(true);try{const all=[];let after=''
   for(;;){const r=await call('backup/users',{after});if(r.error)throw Error(r.error);all.push(...r.items);setBs('Mengunduh data pengguna... '+all.length);if(!r.next)break;after=r.next}
   const stamp=new Date().toISOString().slice(0,16).replace(/[T:]/g,'-')
   let blob,name
   if(fmt==='csv'){blob=new Blob([toCsv(all)],{type:'text/csv;charset=utf-8'});name='artapedia-pengguna-'+stamp+'.csv'}
   else{blob=new Blob([JSON.stringify({app:'artapedia-id',type:'users',at:Date.now(),total:all.length,users:all},null,1)],{type:'application/json'});name='artapedia-pengguna-lengkap-'+stamp+'.json'}
   const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setBs('Selesai: '+all.length+' pengguna diunduh')
  }catch(e){alert('Gagal: '+e.message);setBs('')}setBb(false)}
 const reidx=async()=>{setBb(true);const r=await call('backup/reindex');setBb(false);if(r.error)return alert(r.error);alert('Selesai. '+r.users+' pengguna di database, '+r.added+' dikembalikan ke daftar, '+r.maps+' pemetaan email/key diperbaiki.');loadBk();load()}
 useEffect(()=>{if(d&&d.cfg&&!mkS)setMkS({pct:String(d.cfg.markup),round:d.cfg.mkRound||0,srv:JSON.parse(JSON.stringify(d.cfg.mks||{}))})},[d])
 const saveMk=async()=>{setMkSv(true);const r=await call('markup',{percent:mkS.pct,round:mkS.round,servers:mkS.srv});setMkSv(false);if(r.error)alert(r.error);else{alert('Markup disimpan. Harga baru langsung berlaku.');load()}}
 const calcMk=(base,sid)=>{const o=mkS.srv[sid]||{},pct=o.pct===''||o.pct==null?(+mkS.pct||0):(+o.pct||0),st=+mkS.round;let v=Math.ceil(base*(1+pct/100))+(+o.flat||0);if(st>1)v=Math.ceil(v/st)*st;return v}
 const tes=async()=>{const r=await call('testnotif');alert(r.ok?'Notifikasi terkirim ke Telegram':'Gagal: '+r.error)}
 // Jumlah chat belum dibaca pada pengecekan sebelumnya. null = baru pertama kali (jangan bunyi).
 const unreadRef=useRef(null)
 const loadTh=async(quiet)=>{
  const r=await call('cs/list').catch(()=>null);if(!r||!r.items)return
  setTh(r.items)
  // JALUR BUNYI KEDUA: selama panel admin terbuka (tab mana pun), chat baru langsung
  // membunyikan nada + memunculkan notifikasi, tanpa bergantung pada Web Push.
  const tot=r.items.reduce((a,x)=>a+(x.unread||0),0)
  if(!quiet&&unreadRef.current!==null&&tot>unreadRef.current){
   const w=r.items.find(x=>x.unread>0)
   localNotify('💬 Chat CS baru'+(w?' · '+w.email:''),(w&&w.last)||'Ada pesan baru dari pengguna','/admin')}
  unreadRef.current=tot
  if(curR.current){const x=await call('cs/thread',{uid:curR.current});setMs(x.msgs||[])}}
 // Pengecekan berjalan di SEMUA tab admin (lebih cepat saat tab CS dibuka), bukan hanya saat tab CS aktif.
 useEffect(()=>{if(!d||d.error)return
  let on=true;const tick=()=>{if(on)loadTh()}
  loadTh(true);const i=setInterval(tick,tab==='cs'?5000:12000)
  return()=>{on=false;clearInterval(i)}},[d&&!d.error,tab,cur])
 useEffect(()=>{if(box.current)box.current.scrollTop=box.current.scrollHeight},[ms.length])
 const open=async uid=>{setCur(uid);setSAmt('');setSNote('');const x=await call('cs/thread',{uid});setMs(x.msgs||[]);setCu(x.user||null);loadTh()}
 // tambah / kurangi saldo tanpa meninggalkan ruang chat
 const csSaldo=async kind=>{
  const n=Math.floor(+String(sAmt).replace(/\D/g,'')||0)
  if(!(n>0))return alert('Isi nominal dulu')
  if(!confirm((kind==='add'?'Tambah':'Kurangi')+' saldo '+rp(n)+' untuk '+(cu?cu.email:'pengguna ini')+'?'+(sTell?'\nPengguna akan diberi tahu di chat ini.':'')))return
  setSBusy(kind);const r=await call('cs/saldo',{uid:cur,amount:n,kind,note:sNote,tell:sTell});setSBusy('')
  if(r.error)return alert(r.error)
  setMs(r.msgs||ms);setCu(c=>c?{...c,balance:r.balance}:c);setSAmt('');setSNote('');loadTh();load()}  // load() menyegarkan KPI saldo di header
 const reply=async()=>{if((!rt.trim()&&!rimg)||!cur)return;const x=await call('cs/reply',{uid:cur,text:rt,img:rimg});if(x.error)return alert(x.error);setRt('');setRimg('');setMs(x.msgs||[]);loadTh()}
 const loadSec=async()=>{const r=await call('sec/get');setIg(r.items||[])}
 useEffect(()=>{if(d&&!d.error&&tab==='int'){loadSec();if((d.secSet||{}).SMSCODE_KEY)call('smscode/hook',{act:'status'}).then(r=>{if(!r.error)setWh(r)}).catch(()=>{});if((d.secSet||{}).CSBOT_TOKEN)call('csbot/hook',{act:'status'}).then(r=>{if(!r.error)setCb(r)}).catch(()=>{})}},[d&&!d.error,tab])
 const saveSec=async()=>{setSb(true);const r=await call('sec/set',{values:se});setSb(false);if(r.error)return alert(r.error);setIg(r.items);setSe({});alert('Integrasi disimpan. Berlaku dalam hitungan detik, tanpa redeploy.');load()}
 const resetSec=async k=>{if(!confirm('Hapus isian dashboard untuk '+k+'? Akan kembali memakai env (kalau ada).'))return;const r=await call('sec/set',{values:{[k]:''}});if(r.error)return alert(r.error);setIg(r.items);setSe(({[k]:_,...o})=>o)}
 const testSec=async t=>{setTr(x=>({...x,[t]:{busy:1}}));const r=await call('sec/test',{target:t});setTr(x=>({...x,[t]:r}))}
 // Webhook bot Customer Service (Telegram): dipasang ke bot milik admin, secret dibuat otomatis.
 const csHook=async act=>{setCbB(act);const r=await call('csbot/hook',{act});setCbB('')
  if(r.error)return alert(r.error)
  setCb(r);if(act==='on'){alert('Webhook dipasang untuk @'+(r.username||'bot')+'. Buka bot itu di Telegram, tekan START, lalu tes dengan tombol Tes koneksi.');loadSec()}}
 // Webhook SMSCode: alamat kita didaftarkan ke mereka, secret-nya tersimpan otomatis.
 const hookDo=async act=>{setWhB(act);const r=await call('smscode/hook',{act});setWhB('')
  if(r.error)return alert(r.error)
  if(act==='test')return alert('Kiriman uji dibalas server kita dengan HTTP '+r.status+(String(r.status).startsWith('2')?' — webhook sudah jalan.':' — cek alamat & domainnya.'))
  setWh(r);if(act==='on')alert('Webhook dipasang. Kode OTP dari server ini akan masuk seketika, tanpa menunggu sapuan tiap menit.')
  if(act==='off')alert('Webhook dimatikan. OTP kembali mengandalkan sapuan berkala.')
  loadSec()}
 const depRescue=async()=>{setRsBusy(true);setRsOut(null)
  const r=await call('dep/rescue',{days:rsDays});setRsBusy(false)
  if(r.error)return alert(r.error);setRsOut(r)
  alert(r.masuk?`${r.masuk} deposit yang sudah dibayar berhasil dikreditkan.`:'Tidak ada deposit tertahan yang ternyata sudah dibayar.')}
 const saveTap=async()=>{setSb(true);const r=await call('tap/save',{tap:tp});setSb(false);if(r.error)return alert(r.error)
  alert('Pintu rahasia disimpan. '+((r.tap.emails||[]).length?'Hanya '+r.tap.emails.join(', ')+' yang bisa memakainya.':'PERINGATAN: daftar email masih kosong, siapa pun yang login bisa masuk.'));load()}
 const saveDep=async()=>{setSb(true);const r=await call('dep/save',{dep:dp});setSb(false);if(r.error)return alert(r.error);alert('Pengaturan deposit disimpan. Langsung berlaku.');load()}
 // admin menambah/mengurangi saldo QRIS Gateway merchant
 const gwSaldo=async kind=>{
  const n=Math.floor(+String(gwAmt).replace(/\D/g,'')||0)
  if(!n)return alert('Isi nominalnya dulu')
  if(kind==='del'&&!confirm(`Kurangi saldo ${gwSel.email} sebanyak ${rp(n)}?`))return
  setGwBusy(kind);const r=await call('pay/saldo',{uid:gwSel.uid,amount:n,kind,note:gwNote});setGwBusy('')
  if(r.error)return alert(r.error)
  setGwAmt('');setGwNote('');alert('Saldo sekarang '+rp(r.balance));setGwSel(null);loadGw()}
 const rtSet=(k,f,v)=>setDp(x=>{const key=(x.engine||'v1')==='v2'?'routes2':'routes'
  return {...x,[key]:{...x[key],[k]:{...(x[key]||{})[k],[f]:v}}}})
 const saveSrv=async()=>{setSb(true);const r=await call('srv/save',{srv:sr.srv,wn:{countries:sr.wnc,max:sr.wnm},dbn:{countries:sr.dbc||{}}});setSb(false);if(r.error)return alert(r.error);alert('Pengaturan server disimpan');load()}
 const loadBk=async()=>{const r=await call('backup/status');setBk(r);if(r.cfg)setBh(r.cfg)}
 useEffect(()=>{if(d&&!d.error&&tab==='bk')loadBk()},[d&&!d.error,tab])
 const loadGw=async()=>{const r=await call('pay/data');if(r.error)return alert(r.error);setGw(r);setGc(x=>x||{...r.cfg})}
 useEffect(()=>{if(d&&!d.error&&tab==='gw')loadGw()},[d&&!d.error,tab])
 const saveGw=async()=>{setSb(true);const r=await call('pay/save',{pay:gc});setSb(false);if(r.error)return alert(r.error);alert('Pengaturan QRIS Gateway disimpan');loadGw()}
 const testGw=async()=>{setGt({busy:1});setGt(await call('pay/test'))}
 const gwToggle=async(m)=>{if(!confirm((m.on?'Bekukan':'Aktifkan')+' akun gateway '+m.email+'?'))return
  const r=await call('pay/toggle',{uid:m.uid,on:!m.on});if(r.error)return alert(r.error);loadGw()}
 const sec=(k,f)=>e=>setPr({...pr,[k]:{...pr[k],[f]:e.target.type==='checkbox'?e.target.checked:e.target.value}})
 const day=i=>{const a=pr.bonus.days||[];setPr({...pr,bonus:{...pr.bonus,days:a.includes(i)?a.filter(x=>x!==i):[...a,i]}})}
 const savePromo=async()=>{const r=await call('promo',{ref:pr.ref,bonus:pr.bonus,weekly:pr.weekly,monthly:pr.monthly});if(r.error)return alert(r.error);alert('Pengaturan promo disimpan');load()}
 const payWk=async()=>{if(!confirm('Bagikan hadiah juara minggu lalu sekarang? (hanya jika belum dibagikan otomatis)'))return;const r=await call('weekly/pay');alert(r.error||(r.done?'Hadiah dibagikan ke juara minggu lalu':'Tidak ada yang dibagikan (sudah dibagikan, belum ada juara, atau fitur belum aktif lewat minggu penuh)'))}
 const payMo=async()=>{if(!confirm('Bagikan hadiah juara bulan lalu sekarang? (hanya jika belum dibagikan otomatis)'))return;const r=await call('monthly/pay');alert(r.error||(r.done?'Hadiah dibagikan ke juara bulan lalu':'Tidak ada yang dibagikan (sudah dibagikan, belum ada juara, atau belum lewat satu bulan penuh sejak diaktifkan)'))}
 const saveSite=async()=>{const r=await call('site',st);alert(r.error||'Link disimpan');load()}
 const bkNow=async()=>{setBb(true);const r=await call('backup/now');setBb(false);alert(r.ok?`Backup terkirim ke Telegram (${r.entries} data, ${r.parts} file)`:'Gagal: '+(r.error||'tidak diketahui'));loadBk()}
 const bkSave=async()=>{const r=await call('backup/cfg',bh);alert(r.error||'Jadwal backup disimpan');loadBk()}
 const bkDl=async()=>{setBb(true);try{
  const ent=new Map(),part=new Map();let cur2=null
  for(;;){const r=await callR('backup/page',{cursor:cur2});if(r.error)throw Error(r.error)
   for(const it of r.items){if(it.part){const a=(part.get(it.k)||'')+it.part.s;part.set(it.k,a);if(it.part.o+it.part.s.length>=it.part.total){ent.set(it.k,JSON.parse(a));part.delete(it.k)}}else ent.set(it.k,it.v)}
   setBs('Mengunduh... '+ent.size+' data');if(!r.next)break;cur2=r.next}
  const json=JSON.stringify({app:'artapedia-id',version:1,at:Date.now(),entries:[...ent].map(([k,v])=>({k,v}))})
  let blob=new Blob([json],{type:'application/json'}),ext='json'
  if(typeof CompressionStream!=='undefined'){blob=await new Response(blob.stream().pipeThrough(new CompressionStream('gzip'))).blob();ext='json.gz'}
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='artapedia-backup-'+new Date().toISOString().slice(0,16).replace(/[T:]/g,'-')+'.'+ext;a.click();setBs('Selesai: '+ent.size+' data diunduh')
 }catch(e){alert('Gagal: '+e.message);setBs('')}setBb(false)}
 const bkImp=async e=>{const files=[...e.target.files];e.target.value='';if(!files.length)return
  if(imode==='replace'){if(prompt('MODE GANTI TOTAL: semua data sekarang dihapus lalu diganti isi file. Backup pengaman dikirim ke Telegram dulu. Ketik HAPUS untuk lanjut:')!=='HAPUS')return}
  else if(!confirm('Gabungkan data dari file ke database? Data dengan kunci yang sama akan ditimpa, data baru yang tidak ada di file tetap aman.'))return
  setBb(true)
  try{let all=[]
   for(const f of files){const buf=await f.arrayBuffer(),u8=new Uint8Array(buf);let txt
    if(u8[0]===0x1f&&u8[1]===0x8b){if(typeof DecompressionStream==='undefined')throw Error('Browser ini belum mendukung .gz, ekstrak dulu lalu pilih file .json');txt=await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).text()}else txt=new TextDecoder().decode(u8)
    const dd=JSON.parse(txt);if(dd.app!=='artapedia-id'||!Array.isArray(dd.entries))throw Error('Bukan file backup Artapedia ID: '+f.name);all=all.concat(dd.entries)}
   if(imode==='replace'){const w=await call('backup/wipe',{confirm:'HAPUS'});if(w.error)throw Error(w.error)}
   let batch=[],sz=0,done=0;const LIM=900000
   const flush=async()=>{if(!batch.length)return;const r=await callR('backup/import',{items:batch});if(r.error)throw Error(r.error);done+=batch.length;batch=[];sz=0;setBs('Mengimpor... '+done+'/'+all.length)}
   for(const en of all){const s=JSON.stringify(en.v)
    if(s.length>LIM){await flush();for(let o=0;o<s.length;o+=LIM){const r=await callR('backup/import',{items:[{k:en.k,part:{o,total:s.length,s:s.slice(o,o+LIM)}}]});if(r.error)throw Error(r.error)}done++;continue}
    if(sz+s.length>LIM)await flush();batch.push({k:en.k,v:en.v});sz+=s.length+en.k.length+12}
   await flush();setBs('Merapikan daftar pengguna...');const ri=await call('backup/reindex');setBs('Import selesai: '+all.length+' data dipulihkan'+(ri&&!ri.error?' · '+ri.users+' pengguna':''));alert('Import selesai ('+all.length+' data).');setPr(null);load()
  }catch(x){alert('Import gagal: '+x.message);setBs('')}
  setBb(false)}
// saklar animasi pembuka (langsung berlaku, tanpa tombol simpan terpisah)
 // daftar IP yang diblokir (diambil saat diminta, bukan tiap buka panel)
 const loadBip=async()=>{const r=await call('ban/ips');if(!r.error)setBip(r.items||[])}
 const saveIntro=async on=>{const r=await call('intro/save',{on});if(r.error)return alert(r.error);load()}
 const saveStats=async()=>{const r=await call('stats',sn);if(r.error)return alert(r.error);alert('Angka beranda disimpan. Beranda memperbarui angka dalam hitungan detik.');load()}
 const lbSave=async()=>{const r=await call(lf.id?'lb/edit':'lb/add',lf);if(r.error)return alert(r.error);setLf(EMPTY);load()}
 const lbEdit=x=>{setLf({id:x.id,name:x.name,balance:String(x.balance??''),trx:String(x.trx??''),dep:String(x.dep??''),ok:String(x.ok??''),spent:String(x.spent??'')});window.scrollTo({top:0,behavior:'smooth'})}
 const lbDel=async x=>{if(!confirm('Hapus "'+x.name+'" dari leaderboard?'))return;const r=await call('lb/del',{id:x.id});if(r.error)return alert(r.error);if(lf.id===x.id)setLf(EMPTY);load()}
 const pickImg=async e=>{const f=e.target.files[0];if(!f)return;try{setAn({...an,img:await shrink(f)})}catch(x){alert('Gambar tidak bisa dibaca')}}
 const post=async()=>{const r=await act('ann/add',an);if(!r.error)setAn({title:'',body:'',img:''})}
 if(!d||d.error)return <div className="card"><h2>Admin Login</h2><input type="password" placeholder="Password" onChange={e=>setPw(e.target.value)} onKeyDown={e=>e.key==='Enter'&&load()}/><button className="btn blue" onClick={load}>Masuk</button></div>
 const unread=th.reduce((a,x)=>a+x.unread,0)
 if(ud)return <div className="adm"><AdminUser call={call} id={ud} onClose={()=>{setUd(null);load()}} onChanged={load}/></div>
 const goTab=k=>{if(k==='btn'){location.href='/admin/settings/buttons';return}setTab(k);window.scrollTo({top:0,behavior:'smooth'})}
 return <div className="adm"><AdHead d={d} tab={tab} unread={unread}/>
 <div className="ad-body"><AdNav tab={tab} setTab={goTab} unread={unread}/><div className="ad-main">
 {tab==='main'&&<><AdminMoney call={call}/>
 <div className="card"><h3>Kelola pengguna & harga</h3><p className="muted">Isi email pengguna dan nominal (atau persen untuk markup). Markup bisa diatur per server di tab 💰 Markup; tombol Set Markup % di bawah mengubah markup umum saja.</p>
 <input value={em} onChange={e=>setEm(e.target.value)} placeholder="Email user"/><input type="number" value={n} onChange={e=>setN(e.target.value)} placeholder="Nominal / persen"/>
 <div className="tabs"><button className="btn" onClick={()=>act('addsaldo',{email:em,amount:n})}>Add Saldo</button><button className="btn" onClick={()=>act('delsaldo',{email:em,amount:n})}>Del Saldo</button><button className="btn sil" onClick={async()=>{if(!em)return alert('Isi email pengguna dulu')
  const pv=await call('ban/preview',{email:em});if(pv.error)return alert(pv.error)
  if(!confirm('Ban '+em+'?\n\nIP yang ikut diblokir ('+(pv.ips||[]).length+'): '+((pv.ips||[]).join(', ')||'-')+'\nAkun lain yang ikut kena ('+(pv.akun||[]).length+'): '+((pv.akun||[]).map(x=>x.email).join(', ')||'-')))return
  const r=await call('ban',{email:em,ip:true});if(r.error)return alert(r.error)
  alert('Diblokir. IP: '+((r.ips||[]).join(', ')||'-')+'\nAkun terkait: '+((r.akun||[]).map(x=>x.email).join(', ')||'-'));load();if(bip)loadBip()}}>Ban + IP</button><button className="btn sil" onClick={async()=>{if(!em)return alert('Isi email pengguna dulu')
  const r=await call('unban',{email:em});if(r.error)return alert(r.error)
  alert('Blokir dibuka. IP dilepas: '+((r.ips||[]).join(', ')||'-')+'\nAkun terkait pulih: '+((r.akun||[]).map(x=>x.email).join(', ')||'-'));load();if(bip)loadBip()}}>Unban</button><button className="btn blue" onClick={()=>act('markup',{percent:n})}>Set Markup %</button><button className="btn" onClick={async()=>{const r=await call('resetlink',{email:em});r.error?alert(r.error):prompt('Link reset password (berlaku 30 menit, sekali pakai). Salin lalu kirim ke pengguna:',r.link)}}>Link Reset Password</button></div></div>
 <div className="card"><textarea value={t} onChange={e=>setT(e.target.value)} placeholder="Broadcast (muncul di beranda dashboard pengguna)"/><button className="btn blue" onClick={()=>act('broadcast',{text:t})}>Kirim Broadcast</button></div>
 <div className="card"><h3>Pengguna ({d.users.length})</h3><p className="muted">Ketuk pengguna untuk membuka halaman detail lengkap (order, mutasi, IP, login terakhir, aksi cepat).</p>
  <input placeholder="🔍 Cari email / nama / ID Telegram..." value={uq} onChange={e=>setUq(e.target.value)}/>
  <div style={{overflowX:'auto'}}><table className="ud-list"><thead><tr><th>Pengguna</th><th>Saldo</th><th>Status</th></tr></thead><tbody>{d.users.filter(u=>{const q=uq.trim().toLowerCase();return !q||[u.email,u.name,u.tgUser,u.tgId,u.id].some(v=>String(v||'').toLowerCase().includes(q))}).slice(0,200).map(u=><tr key={u.id} className="ud-rowlink" onClick={()=>setUd(u.id)}><td><b>{u.name||u.email}</b><small>{u.email}{u.tgId?' · ✈️':''}</small></td><td>{rp(u.balance)}</td><td>{u.banned?<span className="ud-pill bad">BANNED</span>:<span className="ud-pill ok">aktif</span>} <span style={{color:'#2b66e8'}}>›</span></td></tr>)}</tbody></table></div></div></>}
  {/* IP yang sedang diblokir ikut ban akun. Bisa dibuka satu-satu kalau ada yang kena imbas. */}
  {tab==='main'&&<div className="card"><h3>🚫 IP yang diblokir ({(bip||[]).length})</h3>
   <p className="muted">Setiap kali sebuah akun dibanned, alamat IP yang pernah dipakainya ikut diblokir — begitu juga akun lain yang nyambung lewat IP atau Telegram yang sama. Satu IP bisa dipakai banyak orang (WiFi kantor / kuota seluler), jadi buka lagi IP tertentu kalau ada yang kena imbas.</p>
   <div className="tabs" style={{margin:'6px 0 10px'}}><button className="btn" onClick={loadBip}>🔄 Muat daftar</button></div>
   {!bip?<p className="muted">Tekan «Muat daftar» untuk melihat.</p>
   :!bip.length?<p className="muted">Belum ada IP yang diblokir.</p>
   :<div className="jba-list">{bip.map(x=><div key={x.ip} className="jba-row">
     <span className="jba-ic">🚫</span>
     <div style={{minWidth:0,flex:1}}><b className="mono">{x.ip}</b>
      <small>dari akun {x.email||x.by} · {x.at?new Date(x.at).toLocaleString('id-ID'):'-'}</small></div>
     <button className="btn sil" onClick={async()=>{if(!confirm('Buka blokir IP '+x.ip+'?'))return
      const r=await call('ban/ip/open',{ip:x.ip});if(r.error)return alert(r.error)
      setBip(Array.isArray(r.items)?r.items:[])}}>Buka IP ini</button></div>)}</div>}</div>}

 {tab==='bot'&&<AdminBots call={call}/>}
 {tab==='kl'&&<AdminKelola call={call}/>}
 {tab==='bca'&&<AdminBroadcast call={call}/>}
 {tab==='job'&&<AdminJobs call={call}/>}
 {tab==='ord'&&<AdminOrders call={call}/>}
   {tab==='rs'&&<AdminReseller call={call}/>}
{tab==='dep'&&dp&&<>
  <div className="card"><h3>🔀 Mesin rute deposit</h3><p className="muted">Pilih <b>satu</b> mesin rute yang dipakai. Saklar rute di bawahnya milik mesin yang sedang dipilih — jadi pengaturan V1 dan V2 tersimpan sendiri-sendiri dan tidak saling menimpa.</p>
   <div className="eng-pick">{Object.entries(ENGINES).map(([k,[nm,ttl,ds]])=>{const on=(dp.engine||'v1')===k
    return <button key={k} type="button" className={'eng'+(on?' on':'')} onClick={()=>setDp({...dp,engine:k})}>
     <b>{nm}</b><span>{ttl}</span><small>{ds}</small>{on&&<em>dipakai sekarang</em>}</button>})}</div></div>
  <div className="card"><h3>{(dp.engine||'v1')==='v2'?'🆕 Rute V2 (Pakasir + AustinPay)':'🧩 Rute V1 (WarungNokos + Pakasir + AustinPay + SMP Payment)'}</h3>
   <p className="muted">Pengguna hanya melihat nama metode (mis. <b>QRIS</b>). Di belakangnya, tiap deposit dikirim ke salah satu rute aktif secara <b>acak murni tanpa bobot</b> — peluangnya sama besar. Kalau satu rute gagal, otomatis pindah ke rute lain.</p>
   {(()=>{const eng=dp.engine||'v1',keys=eng==='v2'?['pakasir','austin']:['warungnokos','pakasir','austin','smp']
    const rt=eng==='v2'?(dp.routes2||{}):(dp.routes||{})
    const on=keys.filter(k=>(rt[k]||{}).on&&(d.depReady||{})[k]),pct=on.length?Math.round(100/on.length):0
    return keys.map(k=>{const [nm,ds,need]=ROUTE_INFO[k],r=rt[k]||{},ready=(d.depReady||{})[k]
     return <div key={k} className={'rt-row'+(r.on?' on':'')}>
      <div className="rt-main"><b>{nm}</b>{ready?<Chip c="ok">Kredensial siap</Chip>:<Chip c="warn">Belum diisi ({need})</Chip>}{r.on&&ready&&<Chip c="blue">≈ {pct}% deposit</Chip>}<small>{ds}</small></div>
      <Sw on={r.on} set={v=>rtSet(k,'on',v)} label={'Rute '+nm}/></div>})})()}
   <p className="muted" style={{marginTop:10}}>Rute yang kredensialnya belum diisi otomatis dilewati. Isi kredensial di tab 🔌 Integrasi. {(dp.engine||'v1')==='v2'&&<b>Virtual Account hanya ada di Pakasir</b>}</p></div>
  <div className="card"><h3>🏪 Rute deposit bot reseller (tanpa modal)</h3>
   <p className="muted">Pelanggan bot reseller tanpa modal selalu memakai rute ini, <b>terlepas dari mesin V1/V2 di atas</b>. Tiap deposit dikirim ke salah satu rute aktif secara <b>acak merata</b> — kadang AustinPay, kadang SMP Payment. Kalau satu rute gagal atau kredensialnya belum diisi, otomatis pindah ke rute lain.</p>
   {(()=>{const keys=['austin','smp'],rt=dp.routes3||{austin:{on:true},smp:{on:true}}
    const on=keys.filter(k=>(rt[k]||{}).on&&(d.depReady||{})[k]),pct=on.length?Math.round(100/on.length):0
    return <>{keys.map(k=>{const [nm,ds,need]=ROUTE_INFO[k],r=rt[k]||{},ready=(d.depReady||{})[k]
     return <div key={k} className={'rt-row'+(r.on?' on':'')}>
      <div className="rt-main"><b>{nm}</b>{ready?<Chip c="ok">Kredensial siap</Chip>:<Chip c="warn">Belum diisi ({need})</Chip>}{r.on&&ready&&<Chip c="blue">≈ {pct}% deposit</Chip>}<small>{ds}</small></div>
      <Sw on={r.on} set={v=>setDp(x=>({...x,routes3:{...(x.routes3||{austin:{on:true},smp:{on:true}}),[k]:{...((x.routes3||{})[k]||{}),on:v}}}))} label={'Rute reseller '+nm}/></div>})}
     {!on.length&&<p className="muted" style={{marginTop:10,color:'#c0392b'}}><b>Perhatian:</b> tidak ada rute siap & aktif — pelanggan bot reseller tidak bisa deposit sampai minimal satu rute diisi kredensialnya dan dinyalakan.</p>}</>})()}</div>
  <div className="card"><h3>💳 Metode yang tampil di pengguna</h3><p className="muted">Matikan metode untuk menyembunyikannya. Virtual Account hanya berjalan lewat rute Pakasir (harus aktif).</p>
   <div className="mt-grid">{Object.keys(METH_NAME).map(k=><div key={k} className={'mt-item'+(dp.methods[k]&&dp.methods[k].on?' on':'')}><span>{METH_NAME[k]}</span><Sw on={dp.methods[k]&&dp.methods[k].on} set={v=>setDp({...dp,methods:{...dp.methods,[k]:{on:v}}})} label={METH_NAME[k]}/></div>)}</div></div>
  <div className="card"><h3>🔢 Batas nominal</h3><div className="ad-g"><label>Minimal (Rp)<input type="number" value={dp.min} onChange={e=>setDp({...dp,min:e.target.value})}/></label><label>Maksimal (Rp)<input type="number" value={dp.max} onChange={e=>setDp({...dp,max:e.target.value})}/></label></div>
   <p className="muted">VA otomatis minimal Rp10.000. QRIS maksimal Rp10.000.000 (batas gateway).</p></div>
  <div className="card"><h3>🛟 Selamatkan deposit tertahan</h3>
   <p className="muted">Menanyakan ulang <b>semua</b> deposit yang masih menunggu / kedaluwarsa ke gateway, lalu mengkreditkan yang ternyata sudah dibayar. Aman ditekan berkali-kali — deposit yang sudah masuk tidak akan dikreditkan dua kali. Pakai ini untuk pengguna yang sudah transfer tapi saldonya belum masuk.</p>
   <div className="ad-g"><label>Rentang (hari ke belakang)<input type="number" min="1" max="60" value={rsDays} onChange={e=>setRsDays(e.target.value)}/></label></div>
   <div className="tabs" style={{marginTop:10}}><button className="btn blue" disabled={rsBusy} onClick={depRescue}>{rsBusy?'Memeriksa…':'🛟 Periksa & kreditkan sekarang'}</button></div>
   {rsOut&&<div className="bk-isi" style={{marginTop:12}}><b>Hasil: {rsOut.masuk} deposit masuk saldo</b>
    <p className="muted" style={{margin:'4px 0 0'}}>{rsOut.dicek} tagihan diperiksa dari {rsOut.total} yang tertahan · {(rsOut.ms/1000).toFixed(1)} detik</p>
    {!!(rsOut.hasil||[]).length&&<div className="jba-list" style={{marginTop:8}}>{rsOut.hasil.map((x,i)=><div key={i} className="jba-row"><div style={{flex:1,minWidth:0}}><b>{x.email}</b><small>ID {x.id}</small></div><b>{rp(x.amount)}</b></div>)}</div>}
    {rsOut.total>rsOut.dicek&&<p className="muted">Sebagian belum sempat diperiksa (batas waktu 45 detik). Tekan sekali lagi untuk melanjutkan.</p>}</div>}</div>
  <div className="card"><h3>🔔 Webhook (opsional, mempercepat saldo masuk)</h3><p className="muted">Tempel URL ini di pengaturan webhook Pakasir. Isinya tidak dipercaya mentah-mentah: status selalu dicek ulang ke gateway. Tanpa webhook pun saldo tetap masuk lewat cek otomatis tiap menit.</p>
   <div className="url-box"><code>{d.hook}</code><button className="btn sil" onClick={()=>{try{navigator.clipboard.writeText(d.hook);alert('URL disalin')}catch(e){prompt('Salin URL:',d.hook)}}}>Salin</button></div></div>
  <div className="savebar"><button className="btn blue" disabled={sb} onClick={saveDep}>{sb?'Menyimpan…':'Simpan pengaturan deposit'}</button></div></>}
 {tab==='srv'&&sr&&<>
  <div className="card"><h3>🖥 Server nokos</h3><p className="muted">Saklar langsung berlaku. Nama, lencana, dan deskripsi tampil di pilihan server pengguna. Server yang kuncinya belum diisi otomatis tersembunyi dari pengguna.</p>
   {(d.servers||[]).map(s=>{const off=d.cfg.off.includes(s.server),has=(d.secSet||{})[s.needs],o=sr.srv[s.server]||{},set=(f,v)=>setSr({...sr,srv:{...sr.srv,[s.server]:{...o,[f]:v}}})
    return <div key={s.server} className={'sv-row'+(off?' off':'')}>
     <div className="sv-top"><code>{s.server}</code>{has?<Chip c="ok">Kunci siap</Chip>:<Chip c="warn">Kunci belum diisi</Chip>}<span style={{flex:1}}/><Sw on={!off} set={v=>act('server',{server:s.server,on:v})} label={'Server '+s.server}/></div>
     <div className="ad-g"><label>Nama<input value={o.name??s.name} onChange={e=>set('name',e.target.value)}/></label><label>Lencana<input value={o.badge??s.badge} onChange={e=>set('badge',e.target.value)}/></label></div>
     <label className="blk">Deskripsi<input value={o.description??s.description} onChange={e=>set('description',e.target.value)}/></label>
     {/* Label server: bebas ditambah, diubah, dihapus. Tampil sebagai stiker di pilihan server pengguna. */}
     <div className="lb-box"><div className="lb-top"><b>Label</b><span style={{flex:1}}/>
       <button className="btn sil" disabled={(o.labels||[]).length>=6} onClick={()=>set('labels',[...(o.labels||[]),{t:'LABEL BARU',c:'blue'}])}>+ Tambah label</button></div>
      {(o.labels||[]).length===0&&<small className="muted">Belum ada label. Contoh: TERLARIS, MURAH, STOK BANYAK.</small>}
      {(o.labels||[]).map((l,li)=><div key={li} className="lb-row">
       <span className={'lb-pv l-'+(l.c||'blue')}>{l.t||'LABEL'}</span>
       <input maxLength={18} value={l.t||''} onChange={e=>set('labels',(o.labels||[]).map((x,n)=>n===li?{...x,t:e.target.value}:x))}/>
       <select value={l.c||'blue'} onChange={e=>set('labels',(o.labels||[]).map((x,n)=>n===li?{...x,c:e.target.value}:x))}>
        {[['blue','Biru'],['green','Hijau'],['red','Merah'],['yellow','Kuning'],['purple','Ungu'],['ink','Hitam']].map(([v,t])=><option key={v} value={v}>{t}</option>)}</select>
       <button className="btn red" onClick={()=>set('labels',(o.labels||[]).filter((x,n)=>n!==li))}>Hapus</button></div>)}</div></div>})}</div>
  <div className="card"><h3>🌍 Negara per server</h3><p className="muted">Daftar negara yang dipindai per server (pisahkan koma). Makin banyak negara, makin banyak panggilan API saat pengguna memilih aplikasi.</p>
   <h4 style={{margin:'14px 0 6px'}}>WarungNokos Server 2</h4>
   <p className="muted">Daftar layanan Server Express diambil per negara, jadi makin banyak negara makin lambat. Kosongkan untuk memakai Indonesia + beberapa negara pertama.</p>
   <div className="ad-g">
    <label>ID / nama negara (pisahkan koma)<input placeholder="7, 6 atau Indonesia, Malaysia" value={sr.wnc||''} onChange={e=>setSr({...sr,wnc:e.target.value})}/></label>
    <label>Maks. negara bila kosong<input type="number" min="1" max="30" value={sr.wnm} onChange={e=>setSr({...sr,wnm:e.target.value})}/></label></div>
   <h4 style={{margin:'14px 0 6px'}}>Dibanana (dibanana.id)</h4>
   <p className="muted">API Dibanana tidak punya daftar negara, jadi isi kode negara (ISO-2, pisahkan koma) yang mau ditampilkan per server. Kosong = daftar bawaan (±70 negara: id, my, sg, us, uk, ph, th, vn, in, co, br, dll). Negara yang tidak punya stok otomatis tidak tampil.</p>
   <div className="ad-g">{[['1','Ekonomi','kosong = bawaan'],['2','Premium','kosong = bawaan'],['3','Khusus','kosong = bawaan'],['4','WA Luar','kosong = bawaan']].map(([i,n,ph])=><label key={i}>{n}<input placeholder={ph} value={(sr.dbc||{})[i]||''} onChange={e=>setSr({...sr,dbc:{...(sr.dbc||{}),[i]:e.target.value}})}/></label>)}</div></div>
  <div className="savebar"><button className="btn blue" disabled={sb} onClick={saveSrv}>{sb?'Menyimpan…':'Simpan nama, label & negara'}</button></div></>}
 {tab==='pop'&&po&&<AdminPopups pops={po} setPops={setPo} save={savePop} busy={poBusy} shrink={shrinkS} sel={poSel} setSel={setPoSel}/>}
 {tab==='apk'&&ap&&<>
  <div className="card"><h3>📱 Aplikasi (APK)</h3><p className="muted">Mengatur halaman <code>/apk</code> — tombolnya sudah ada di dashboard pengguna, tepat di bawah kotak Chat CS. Kalau saklar mati atau tautan kosong, halaman itu tetap bisa dibuka tapi hanya menampilkan cara memasang versi web (PWA).</p>
   <div className="sv-top"><b>Tombol unduh APK aktif</b><span style={{flex:1}}/><Sw on={!!ap.on} set={v=>setAp({...ap,on:v})} label="Unduh APK"/></div>
   <label className="blk">Tautan APK<input placeholder="https://.../artapedia.apk atau /artapedia.apk" value={ap.url||''} onChange={e=>setAp({...ap,url:e.target.value})}/></label>
   <div className="ad-g"><label>Versi<input placeholder="1.0.0" value={ap.ver||''} onChange={e=>setAp({...ap,ver:e.target.value})}/></label>
    <label>Ukuran berkas<input placeholder="8 MB" value={ap.size||''} onChange={e=>setAp({...ap,size:e.target.value})}/></label></div>
   <label className="blk">Catatan rilis (satu baris = satu poin)<textarea rows={4} maxLength={600} placeholder={'Versi pertama Artapedia ID\nNotifikasi OTP langsung ke HP'} value={ap.note||''} onChange={e=>setAp({...ap,note:e.target.value})}/></label>
   <p className="muted">Letakkan berkas APK di <code>public/</code> lalu tulis <code>/nama.apk</code>, atau pakai tautan Google Drive / GitHub Release yang bisa diunduh langsung.</p>
   <div className="savebar"><a className="btn sil" href="/apk" target="_blank" rel="noopener">Lihat halaman /apk</a><span style={{flex:1}}/><button className="btn blue" disabled={apBusy} onClick={saveApk}>{apBusy?'Menyimpan…':'Simpan pengaturan aplikasi'}</button></div></div></>}
 {tab==='mt'&&mt&&<>
  <AdminAuto call={call}/>
  <div className="card"><h3>🛠 Maintenance seluruh situs</h3><p className="muted">Saat aktif, pesanan nokos baru dan deposit baru ditolak (503) di web maupun API. Status order, pembatalan, refund, dan pengecekan deposit tetap jalan, jadi saldo pengguna tidak tersangkut. Halaman /admin tidak pernah ditutup.</p>
   <div className="sv-top"><b>Maintenance aktif</b><span style={{flex:1}}/><Sw on={!!mt.on} set={v=>setMt({...mt,on:v})} label="Maintenance seluruh situs"/></div>
   <label className="blk">Tampilan<select value={mt.mode||'full'} onChange={e=>setMt({...mt,mode:e.target.value})}><option value="full">Layar penuh (halaman ditutup)</option><option value="soft">Banner saja (pengguna masih bisa lihat dashboard)</option></select></label>
   <label className="blk">Pesan untuk pengguna<textarea rows={3} maxLength={300} placeholder="Contoh: Perawatan sistem sampai pukul 14.00 WIB. Saldo kamu aman." value={mt.msg||''} onChange={e=>setMt({...mt,msg:e.target.value})}/></label></div>
  <div className="card"><h3>🖥 Maintenance per server</h3><p className="muted">Server yang dimaintenance tetap tampil di daftar tapi tidak bisa dipilih, dan order ke server itu ditolak. Beda dengan saklar di tab Server yang menyembunyikan server sepenuhnya.</p>
   {(d.servers||[]).map(s=>{const o=(mt.srv||{})[s.server]||{on:false,msg:''},set=(f,v)=>setMt({...mt,srv:{...(mt.srv||{}),[s.server]:{...o,[f]:v}}})
    return <div key={s.server} className={'sv-row'+(o.on?'':' off')} style={o.on?{borderColor:'#f59e0b'}:undefined}>
     <div className="sv-top"><code>{s.server}</code>{o.on&&<Chip c="warn">Maintenance</Chip>}<span style={{flex:1}}/><Sw on={!!o.on} set={v=>set('on',v)} label={'Maintenance '+s.server}/></div>
     <label className="blk">Pesan server ini (opsional)<input maxLength={200} placeholder="Server sedang perbaikan, pakai server lain dulu" value={o.msg||''} onChange={e=>set('msg',e.target.value)}/></label></div>})}</div>
  <div className="savebar"><button className="btn blue" disabled={mtSv} onClick={saveMt}>{mtSv?'Menyimpan…':'Simpan maintenance'}</button></div></>}
 {tab==='mk'&&mkS&&<>
  <div className="card"><h3>💰 Markup harga nokos</h3><p className="muted">Harga jual = harga modal dari penyedia + persen markup + tambahan Rp (opsional), lalu dibulatkan ke atas. Pengaturan per server menimpa markup umum. Jaminan OTP (+10%) dihitung dari harga jual ini. Langsung berlaku untuk harga baru di web dan API; pesanan yang sudah dibuat tidak berubah.</p>
   <div className="ad-g"><label>Markup umum (%)<input type="number" min="0" max="500" step="0.5" value={mkS.pct} onChange={e=>setMkS({...mkS,pct:e.target.value})}/></label>
    <label>Pembulatan ke atas<select value={mkS.round} onChange={e=>setMkS({...mkS,round:+e.target.value})}>{[[0,'Tanpa pembulatan'],[50,'Kelipatan Rp50'],[100,'Kelipatan Rp100'],[500,'Kelipatan Rp500'],[1000,'Kelipatan Rp1.000']].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label></div></div>
  <div className="card"><h3>Markup per server</h3><p className="muted">Kosongkan persen supaya ikut markup umum. Tambahan Rp ditambahkan di atas persen (mis. +Rp300 per nomor).</p>
   {(d.servers||[]).map(s=>{const o=mkS.srv[s.server]||{},set=(f,v)=>setMkS({...mkS,srv:{...mkS.srv,[s.server]:{...o,[f]:v}}}),eff=o.pct===''||o.pct==null?mkS.pct:o.pct
    return <div key={s.server} className="sv-row"><div className="sv-top"><code>{s.server}</code><b>{s.name}</b><span style={{flex:1}}/><Chip c="ok">{(+eff||0)}% + {rp(o.flat)}</Chip></div>
     <div className="ad-g"><label>Persen (kosong = umum)<input type="number" min="0" max="500" step="0.5" placeholder={'umum '+(+mkS.pct||0)} value={o.pct??''} onChange={e=>set('pct',e.target.value)}/></label><label>Tambahan Rp<input type="number" min="0" max="1000000" placeholder="0" value={o.flat??''} onChange={e=>set('flat',e.target.value)}/></label></div></div>})}</div>
  <div className="card"><h3>Simulasi harga</h3><label>Harga modal (Rp)<input type="number" min="0" value={mkB} onChange={e=>setMkB(e.target.value)}/></label>
   <div className="ad-g" style={{marginTop:10}}>{(d.servers||[]).map(s=><div key={s.server} className="card" style={{margin:0,padding:12}}><small className="muted">{s.name}</small><br/><b>{rp(calcMk(+mkB||0,s.server))}</b><br/><small className="muted">untung {rp(calcMk(+mkB||0,s.server)-(+mkB||0))}</small></div>)}</div></div>
  <div className="savebar"><button className="btn blue" disabled={mkSv} onClick={saveMk}>{mkSv?'Menyimpan…':'Simpan markup'}</button></div></>}
 {tab==='int'&&<>
  <div className="card"><h3>🔌 Integrasi & kunci API</h3><p className="muted">Semua yang dulu diisi lewat env sekarang bisa diisi di sini, tanpa redeploy. Isian dashboard menang atas env. Kunci rahasia tidak pernah ditampilkan utuh. Kosongkan kolom untuk membiarkan nilai lama.</p>
   <p className="muted">Tetap lewat env karena dibutuhkan sebelum panel ini bisa dibuka: <code>MONGODB_URI</code>, <code>ADMIN_PASSWORD</code>, <code>CRON_SECRET</code>.</p></div>
  {!ig&&<div className="card">Memuat…</div>}
  {ig&&GROUPS.map(([g,ttl,sub,tt])=><div key={g} className="card"><div className="int-h"><div><h3>{ttl}</h3><small className="muted">{sub}</small></div>{tt&&<button className="btn sil" disabled={tr[tt]&&tr[tt].busy} onClick={()=>testSec(tt)}>{tr[tt]&&tr[tt].busy?'Menguji…':'Tes koneksi'}</button>}</div>
   {tt&&tr[tt]&&!tr[tt].busy&&<p className={'tres '+(tr[tt].ok?'ok':'bad')}>{tr[tt].ok?'✓ ':'✕ '}{tr[tt].info||tr[tt].error}</p>}
   {g==='csbot'&&<div className="int-f" style={{display:'block'}}>
    <b>💬 Webhook bot Customer Service</b>
    <p className="muted" style={{margin:'4px 0 8px'}}>Setelah token & ID diisi dan disimpan, tekan Pasang webhook. Cara balas dari Telegram: <b>Reply</b> pesan notifikasi bot, atau ketuk tombol 💬 Balas lalu ketik (teks atau foto). Perintah: /daftar (chat belum dibalas), /selesai.</p>
    {cb?<p className="muted">Bot: <code>{cb.username?'@'+cb.username:'-'}</code>{cb.milik?' · ✅ webhook menunjuk ke situs ini':(cb.url?' · ⚠️ menunjuk ke alamat lain':' · ⚠️ webhook belum dipasang')}{cb.secret?' · 🔐 secret tersimpan':''}{cb.pending?' · antrean '+cb.pending:''}{cb.err?' · error terakhir: '+cb.err:''}{cb.ready===false?' · ⚠️ ID Telegram admin belum diisi':''}</p>
     :<p className="muted">Isi & simpan token bot dulu, lalu status webhook muncul di sini.</p>}
    <div className="tabs">
     <button className="btn blue" disabled={!!cbB} onClick={()=>csHook('on')}>{cbB==='on'?'Memasang…':'⚡ Pasang webhook'}</button>
     <button className="btn sil" disabled={!!cbB} onClick={()=>csHook('status')}>{cbB==='status'?'Memuat…':'Segarkan status'}</button>
     <button className="btn sil" disabled={!!cbB} onClick={()=>csHook('off')}>{cbB==='off'?'Mematikan…':'Matikan'}</button></div></div>}
   {g==='smscode'&&<div className="int-f" style={{display:'block'}}>
    <b>⚡ Webhook OTP seketika</b>
    <p className="muted" style={{margin:'4px 0 8px'}}>Tanpa webhook, kode OTP baru terbaca saat sapuan berkala (tiap menit). Dengan webhook, SMSCode memberi tahu situs ini begitu SMS masuk, jadi kodenya tampil ke pembeli dalam hitungan detik. Isinya tidak dipercaya mentah-mentah: statusnya selalu ditanya ulang ke SMSCode, jadi kiriman palsu tidak bisa mengarang OTP.</p>
    {wh?<p className="muted">Alamat terdaftar: <code>{wh.url||'(belum ada)'}</code>{wh.milik?' · ✅ sudah menunjuk ke situs ini':(wh.url?' · ⚠️ menunjuk ke alamat lain':'')}{wh.secret?' · 🔐 secret tersimpan':' · ⚠️ secret belum tersimpan'}</p>
     :<p className="muted">Isi API token SMSCode dulu, lalu status webhook muncul di sini.</p>}
    <div className="tabs">
     <button className="btn blue" disabled={!!whB} onClick={()=>hookDo('on')}>{whB==='on'?'Memasang…':'⚡ Pasang webhook'}</button>
     <button className="btn sil" disabled={!!whB} onClick={()=>hookDo('test')}>{whB==='test'?'Menguji…':'Kirim uji'}</button>
     <button className="btn sil" disabled={!!whB} onClick={()=>hookDo('off')}>{whB==='off'?'Mematikan…':'Matikan'}</button></div></div>}
   {ig.filter(x=>x.g===g).map(x=><div key={x.k} className="int-f"><label>{x.l}<input type={x.secret?'password':'text'} autoComplete="off" placeholder={x.secret?(x.set?x.hint+' · tersimpan':'Belum diisi'):(x.ph||'')} value={se[x.k]??(x.secret?'':x.val)} onChange={e=>setSe({...se,[x.k]:e.target.value})}/></label>
    <div className="int-m">{x.src==='dashboard'?<Chip c="blue">dashboard</Chip>:x.src==='env'?<Chip>env</Chip>:<Chip c="warn">kosong</Chip>}{x.src==='dashboard'&&<button className="lnk" onClick={()=>resetSec(x.k)}>reset</button>}</div></div>)}</div>)}
  <div className="savebar"><button className="btn blue" disabled={sb||!Object.keys(se).length} onClick={saveSec}>{sb?'Menyimpan…':'Simpan integrasi'+(Object.keys(se).length?' ('+Object.keys(se).length+' perubahan)':'')}</button></div></>}
{tab==='home'&&sn&&<>
  <div className="card"><h3>🎬 Animasi pembuka</h3>
   <p className="muted">Animasi maskot &amp; logo yang tampil sekali tiap kunjungan sebelum beranda. Matikan kalau mau pengunjung langsung melihat isi situs.</p>
   <div className="rt-row"><div style={{flex:1}}><b>Animasi pembuka</b><br/><small className="muted">{(d.cfg.intro||{}).on!==false?'🟢 Aktif — tampil sekali per kunjungan':'⚪ Mati — pengunjung langsung masuk beranda'}</small></div>
    <Sw on={(d.cfg.intro||{}).on!==false} label="Animasi pembuka" set={v=>saveIntro(v)}/></div></div>
  <div className="card"><h3>🔢 Angka di beranda web</h3>
   <p style={{color:'#64748b',fontSize:14}}>Dua angka di bagian atas beranda (Pengguna dan OTP sukses). Isi angka bebas, atau kosongkan supaya memakai angka asli dari database.</p>
   <div className="ad-g"><label>Pengguna<input type="number" min="0" placeholder={'Otomatis (asli: '+((d.real||{}).users??0)+')'} value={sn.users} onChange={e=>setSn({...sn,users:e.target.value})}/></label>
   <label>OTP sukses<input type="number" min="0" placeholder={'Otomatis (asli: '+((d.real||{}).orders??0)+')'} value={sn.orders} onChange={e=>setSn({...sn,orders:e.target.value})}/></label></div>
   <div className="tabs" style={{marginTop:10}}><button className="btn blue" onClick={saveStats}>Simpan angka</button><button className="btn sil" onClick={()=>setSn({users:'',orders:''})}>Kosongkan (pakai angka asli)</button></div></div>
  <div className="card"><h3>{lf.id?'✏️ Ubah data leaderboard':'🏆 Tambah ke leaderboard'}</h3>
   <p style={{color:'#64748b',fontSize:14}}>Isi email atau nama. Kalau berupa email, otomatis disensor saat tampil (ab***c@gmail.com). Data ini ikut tampil di Leaderboard global bersama pengguna asli, dan tidak ikut hadiah mingguan/bulanan.</p>
   <label>Email / nama<input placeholder="mis. budi@gmail.com atau Budi" value={lf.name} onChange={e=>setLf({...lf,name:e.target.value})}/></label>
   <div className="ad-g"><label>Saldo (Rp)<input type="number" min="0" value={lf.balance} onChange={e=>setLf({...lf,balance:e.target.value})}/></label>
    <label>Jumlah transaksi<input type="number" min="0" placeholder="otomatis = jumlah sukses" value={lf.trx} onChange={e=>setLf({...lf,trx:e.target.value})}/></label>
    <label>Berapa kali deposit<input type="number" min="0" value={lf.dep} onChange={e=>setLf({...lf,dep:e.target.value})}/></label>
    <label>Transaksi sukses<input type="number" min="0" value={lf.ok} onChange={e=>setLf({...lf,ok:e.target.value})}/></label>
    <label>Total belanja (Rp)<input type="number" min="0" value={lf.spent} onChange={e=>setLf({...lf,spent:e.target.value})}/></label></div>
   <div className="tabs" style={{marginTop:10}}><button className="btn blue" onClick={lbSave}>{lf.id?'Simpan perubahan':'Tambah'}</button>{lf.id&&<button className="btn sil" onClick={()=>setLf(EMPTY)}>Batal ubah</button>}</div></div>
  <div className="card"><h3>Data leaderboard manual ({(d.lb||[]).length})</h3>
   {!(d.lb||[]).length&&<p style={{color:'#64748b'}}>Belum ada data manual. Leaderboard hanya berisi pengguna asli.</p>}
   {(d.lb||[]).map(x=><div key={x.id} className="ad-row" style={{borderBottom:'1px solid #e2e8f4',padding:'8px 0'}}><div style={{flex:1,minWidth:0}}><b>{x.name}</b><br/><small style={{color:'#64748b'}}>Saldo {rp(x.balance)} · {x.trx||0} transaksi · {x.dep||0}x deposit · {x.ok||0} sukses</small></div><button className="btn sil" onClick={()=>lbEdit(x)}>Ubah</button><button className="btn sil" onClick={()=>lbDel(x)}>Hapus</button></div>)}</div></>}
  {tab==='cs'&&<>{csm&&<div className="card"><h3>💬 Saklar customer service</h3>
  <p className="muted">Kalau dimatikan, pengguna tidak bisa mengirim pesan dan alasan yang kamu tulis ditampilkan di halaman CS mereka. Admin tetap bisa membaca & membalas chat lama.</p>
  <div className="sv-top"><b>{csm.on?'CS aktif (ikut jam layanan)':'CS dimatikan'}</b><span style={{flex:1}}/><Sw on={!!csm.on} set={v=>setCsm({...csm,on:v})} label="Customer service"/></div>
  <label className="blk">Alasan kalau dimatikan (wajib)<textarea rows={2} maxLength={300} placeholder="Contoh: Admin sedang libur sampai Senin. Kendala mendesak hubungi Telegram @artapedia." value={csm.msg||''} onChange={e=>setCsm({...csm,msg:e.target.value})}/></label>
  <div className="savebar"><button className="btn blue" disabled={csBusy} onClick={saveCs}>{csBusy?'Menyimpan…':'Simpan saklar CS'}</button></div></div>}
  <PushCard api={pushApi} compact prefix="push/" title="Notifikasi HP admin" desc="Setiap ada pengguna chat CS, HP ini berbunyi & bergetar — walaupun Chrome sudah ditutup." onMsg={m=>alert(m)}/>
  <div className="card"><h3>Chat Customer Service</h3><p style={{color:'#64748b',fontSize:14}}>Pengguna hanya bisa mengirim pesan jam 09.00-17.00 dan 18.00-22.00 WIB. Admin bisa membalas kapan saja.</p>
  <div className="ad-cs"><div className="ad-th card" style={{margin:0,padding:0}}>{th.length===0&&<p style={{padding:12,color:'#64748b'}}>Belum ada percakapan.</p>}{th.map(x=><button key={x.uid} className={cur===x.uid?'on':''} onClick={()=>open(x.uid)}><b>{x.email}</b>{x.unread>0&&<span className="dot">{x.unread}</span>}<small>{x.last}</small></button>)}</div>
  <div>{!cur?<p style={{color:'#64748b'}}>Pilih percakapan di kiri.</p>:<>
  {cu&&<div className="cs-u">
   <div className="cs-u-h"><b>{cu.email}</b>{cu.banned&&<Chip c="warn">Dibanned</Chip>}{cu.tg&&<Chip c="blue">✈️ Telegram</Chip>}
    <span style={{flex:1}}/><button className="btn sil" style={{padding:'5px 10px',fontSize:12}} onClick={()=>setUd(cu.uid)}>Detail lengkap</button></div>
   <div className="cs-u-s"><span>Saldo <b>{rp(cu.balance)}</b></span><span>{cu.orders} order sukses</span><span>belanja {rp(cu.spent)}</span>{cu.pending>0&&<span>{cu.pending} menunggu</span>}</div>
   <div className="cs-u-q">{[5000,10000,25000,50000,100000].map(v=>
    <button key={v} className={+String(sAmt).replace(/\D/g,'')===v?'on':''} onClick={()=>setSAmt(String(v))}>{v>=1000?(v/1000)+'rb':v}</button>)}</div>
   <div className="cs-u-f">
    <input inputMode="numeric" placeholder="Nominal" value={sAmt?'Rp'+(+String(sAmt).replace(/\D/g,'')||0).toLocaleString('id-ID'):''}
     onChange={e=>setSAmt(e.target.value.replace(/\D/g,''))}/>
    <input placeholder="Keterangan (opsional)" value={sNote} maxLength={60} onChange={e=>setSNote(e.target.value)}/>
   </div>
   <div className="cs-u-b">
    <button className="btn" disabled={!!sBusy} onClick={()=>csSaldo('add')}>{sBusy==='add'?'…':'+ Tambah saldo'}</button>
    <button className="btn sil" disabled={!!sBusy} onClick={()=>csSaldo('del')}>{sBusy==='del'?'…':'− Kurangi'}</button>
    <label className="cs-u-t"><input type="checkbox" checked={sTell} onChange={e=>setSTell(e.target.checked)}/> kabari di chat</label>
   </div></div>}
  <div className="chat" ref={box} style={{maxHeight:380,background:'#f7f9fe',borderRadius:14,padding:10}}>{ms.map((m,i)=><div key={i} className={'msg '+(m.from==='admin'?'user':'admin')}>{m.img&&<img src={m.img} alt="" onClick={()=>window.open(m.img)}/>}{m.text}<small>{m.from==='admin'?'Admin':'Pengguna'} · {new Date(m.at).toLocaleString('id-ID')}</small></div>)}</div>
  {rimg&&<div style={{margin:'8px 0'}}><img src={rimg} alt="" style={{maxHeight:90,borderRadius:10}}/> <button className="btn sil" onClick={()=>setRimg('')}>✕</button></div>}<div className="cin"><label className="btn sil" style={{cursor:'pointer',margin:0}}>📷<input type="file" accept="image/*" hidden onChange={async e=>{const f=e.target.files[0];e.target.value='';if(f)try{setRimg(await shrinkS(f))}catch(x){alert('Foto tidak bisa dipakai')}}}/></label><input value={rt} onChange={e=>setRt(e.target.value)} onKeyDown={e=>e.key==='Enter'&&reply()} placeholder="Tulis balasan..."/><button disabled={!rt.trim()&&!rimg} onClick={reply}>➤</button></div></>}</div></div></div></>}
 {tab==='gw'&&<>
  <div className="card"><h3>⚡ QRIS Gateway — ringkasan uang</h3>
   <p className="muted">Produk terpisah dari toko nokos: pengguna menerima pembayaran QRIS lewat situs ini, kamu ambil biaya layanan dari tiap transaksi lunas.</p>
   {!gw?<p className="muted">Memuat…</p>:<>
    <div className="ad-kpi" style={{maxWidth:'none',marginBottom:14}}>
     <div><small>Laba biaya layanan</small><b>{rp(gw.total.laba)}</b></div>
     <div><small>Total uang masuk</small><b>{rp(gw.total.masuk)}</b></div>
     <div><small>Saldo mengendap</small><b>{rp(gw.total.saldo)}</b></div>
     <div><small>Sudah ditarik</small><b>{rp(gw.total.keluar)}</b></div>
    </div>
    <div className={'tres '+(gw.austin.ok?'ok':'bad')}>
     {gw.austin.ok?<>AustinPay terhubung{gw.austin.user?<> · akun <b>{gw.austin.user.username}</b> · saldo <b>{rp(gw.austin.user.balance)}</b></>:null}{gw.austin.hmac?' · HMAC aktif':' · HMAC belum dipakai'}</>
      :<>AustinPay belum siap: {gw.austin.error}</>}</div>
    <div className="tabs" style={{marginTop:10}}><button className="btn sil" onClick={testGw}>{gt&&gt.busy?'Menguji…':'Tes koneksi AustinPay'}</button>
     <button className="btn sil" onClick={()=>setTab('int')}>Isi kredensial AustinPay</button></div>
    {gt&&!gt.busy&&<div className={'tres '+(gt.ok?'ok':'bad')}>{gt.ok?'Koneksi berhasil.':'Gagal: '+gt.error}</div>}
   </>}</div>

  {gc&&<div className="card"><h3>⚙️ Pengaturan & tarif</h3>
   <p className="muted">Biaya layanan inilah keuntunganmu: dipotong dari tiap QRIS yang lunas, sebelum masuk ke saldo merchant.</p>
   <div className="mt-grid">
    <div className="mt-item">QRIS Gateway aktif<Sw on={gc.on} set={v=>setGc({...gc,on:v})} label="Gateway aktif"/></div>
    <div className="mt-item">Tarik dana aktif<Sw on={gc.wdOn} set={v=>setGc({...gc,wdOn:v})} label="Tarik dana aktif"/></div>
   </div>
   <label className="blk" style={{marginTop:10}}>Nama produk<input value={gc.name} onChange={e=>setGc({...gc,name:e.target.value})} placeholder="Artapedia Pay"/></label>
   <div className="dc-two" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
    <label className="blk">Biaya layanan (%)<input type="number" step="0.1" min="0" max="20" value={gc.fee} onChange={e=>setGc({...gc,fee:e.target.value})}/></label>
    <label className="blk">Biaya tetap per transaksi (Rp)<input type="number" min="0" value={gc.feeFlat} onChange={e=>setGc({...gc,feeFlat:e.target.value})}/></label>
    <label className="blk">Nominal QRIS minimal<input type="number" value={gc.min} onChange={e=>setGc({...gc,min:e.target.value})}/></label>
    <label className="blk">Nominal QRIS maksimal<input type="number" value={gc.max} onChange={e=>setGc({...gc,max:e.target.value})}/></label>
    <label className="blk">Tarik dana minimal<input type="number" value={gc.wdMin} onChange={e=>setGc({...gc,wdMin:e.target.value})}/></label>
    <label className="blk">Tambahan biaya tarik (Rp)<input type="number" min="0" value={gc.wdFee} onChange={e=>setGc({...gc,wdFee:e.target.value})}/></label>
   </div>
   <p className="muted">Contoh: biaya 0,7% + Rp0 → merchant terima QRIS Rp50.000, saldonya bertambah Rp49.650, Rp350 jadi milikmu.</p>
   <div className="savebar"><button className="btn blue" disabled={sb} onClick={saveGw}>{sb?'Menyimpan…':'Simpan pengaturan'}</button></div></div>}

  {gw&&<div className="card"><h3>🏪 Merchant ({gw.merchants.length})</h3>
   <p className="muted">Pengguna yang memakai QRIS Gateway. Bekukan akun untuk menghentikan transaksi & penarikan mereka.</p>
   {gw.merchants.length===0?<p className="muted">Belum ada yang memakai gateway.</p>
   :<table className="ud-list"><thead><tr><th>Merchant</th><th>Masuk</th><th>Laba kamu</th><th>Saldo</th><th>Status</th></tr></thead>
    <tbody>{gw.merchants.map(m=><tr key={m.uid}>
     <td><b>{m.email}</b><small>{m.trx} transaksi · ditarik {rp(m.out)}</small></td>
     <td>{rp(m.gross)}</td><td><b style={{color:'#14804a'}}>{rp(m.fee)}</b></td><td>{rp(m.balance)}</td>
     <td><button className={'btn '+(m.on?'sil':'')} style={{padding:'5px 10px',fontSize:12}} onClick={()=>gwToggle(m)}>{m.on?'Aktif':'Dibekukan'}</button>{' '}
      <button className={'btn '+(gwSel&&gwSel.uid===m.uid?'blue':'sil')} style={{padding:'5px 10px',fontSize:12}} onClick={()=>setGwSel(gwSel&&gwSel.uid===m.uid?null:m)}>Saldo</button></td></tr>)}</tbody></table>}
  </div>}
  {gwSel&&<div className="card"><h3>💼 Ubah saldo gateway · {gwSel.email}</h3>
   <p className="muted">Saldo sekarang <b>{rp(gwSel.balance)}</b>. Ini uang yang bisa merchant tarik, jadi menambah saldo berarti menambah kewajiban bayar. Pengurangan ditolak kalau membuat saldonya minus.</p>
   <div className="ad-g">
    <label>Nominal (Rp)<input type="number" value={gwAmt} onChange={e=>setGwAmt(e.target.value)} placeholder="50000"/></label>
    <label>Catatan (opsional)<input value={gwNote} onChange={e=>setGwNote(e.target.value)} placeholder="Koreksi manual"/></label></div>
   <div className="tabs" style={{marginTop:10}}>
    <button className="btn blue" disabled={!!gwBusy} onClick={()=>gwSaldo('add')}>{gwBusy==='add'?'Memproses…':'➕ Tambah saldo'}</button>
    <button className="btn sil" disabled={!!gwBusy} onClick={()=>gwSaldo('del')}>{gwBusy==='del'?'Memproses…':'➖ Kurangi saldo'}</button>
    <button className="btn sil" onClick={()=>setGwSel(null)}>Batal</button></div></div>}
 </>}

 {tab==='ann'&&<><div className="card"><h3>Buat pengumuman</h3><input placeholder="Judul" value={an.title} onChange={e=>setAn({...an,title:e.target.value})}/><textarea rows="5" placeholder="Isi pengumuman" value={an.body} onChange={e=>setAn({...an,body:e.target.value})}/>
  <input type="file" accept="image/*" onChange={pickImg}/>{an.img&&<div><img src={an.img} alt="" style={{maxWidth:'100%',maxHeight:200,borderRadius:12,margin:'8px 0'}}/><br/><button className="btn sil" onClick={()=>setAn({...an,img:''})}>Hapus gambar</button></div>}
  <div style={{marginTop:10}}><button className="btn blue" onClick={post}>Terbitkan</button></div><p style={{color:'#64748b',fontSize:13}}>Pengumuman tampil di halaman /pengumuman, beranda web, dan dashboard semua pengguna, plus dikirim ke channel.</p></div>
  <div className="card"><h3>Pengumuman terbit ({d.ann.length})</h3>{d.ann.map(x=><div key={x.id} className="ad-row" style={{borderBottom:'1px solid #e2e8f4',padding:'8px 0'}}>{x.img&&<img src={x.img} alt="" style={{width:60,height:60,objectFit:'cover',borderRadius:10}}/>}<div style={{flex:1}}><b>{x.title}</b><br/><small style={{color:'#64748b'}}>{new Date(x.at).toLocaleString('id-ID')}</small></div><button className="btn sil" onClick={()=>confirm('Hapus pengumuman ini?')&&act('ann/del',{id:x.id})}>Hapus</button></div>)}</div></>}
 {tab==='promo'&&pr&&<>
  <div className="card"><h3>🤝 Referral / ajak teman</h3><label className="ad-ck"><input type="checkbox" checked={!!pr.ref.on} onChange={sec('ref','on')}/> Aktif</label>
   <div className="ad-g"><label>Bonus pengajak (Rp)<input type="number" value={pr.ref.referrer} onChange={sec('ref','referrer')}/></label><label>Bonus yang diajak (Rp)<input type="number" value={pr.ref.referee} onChange={sec('ref','referee')}/></label><label>Min. deposit pertama teman (Rp)<input type="number" value={pr.ref.minDep} onChange={sec('ref','minDep')}/></label><label>Maks. bonus per pengajak (jumlah teman)<input type="number" value={pr.ref.maxRef} onChange={sec('ref','maxRef')}/></label></div>
   <p style={{color:'#64748b',fontSize:13}}>Bonus dibayar otomatis saat teman menyelesaikan deposit pertama sebesar minimal nominal di atas (anti akun palsu).</p></div>
  <div className="card"><h3>🎁 Bonus deposit (cashback)</h3><label className="ad-ck"><input type="checkbox" checked={!!pr.bonus.on} onChange={sec('bonus','on')}/> Aktif</label>
   <div className="ad-g"><label>Persen bonus biasa (%)<input type="number" step="0.1" value={pr.bonus.pct} onChange={sec('bonus','pct')}/></label><label>Min. deposit dapat bonus (Rp)<input type="number" value={pr.bonus.minAmt} onChange={sec('bonus','minAmt')}/></label><label>Maks. bonus per deposit (Rp, 0 = tanpa batas)<input type="number" value={pr.bonus.max} onChange={sec('bonus','max')}/></label><label>Persen bonus di hari spesial (%)<input type="number" step="0.1" value={pr.bonus.dayPct} onChange={sec('bonus','dayPct')}/></label></div>
   <div style={{margin:'8px 0'}}><b style={{fontSize:14}}>Hari spesial (pakai persen hari spesial):</b><div className="tabs" style={{marginTop:6}}>{['Min','Sen','Sel','Rab','Kam','Jum','Sab'].map((h,i)=><button key={i} className={'btn '+((pr.bonus.days||[]).includes(i)?'blue':'sil')} style={{padding:'6px 12px'}} onClick={()=>day(i)}>{h}</button>)}</div></div>
   <p style={{color:'#64748b',fontSize:13}}>Contoh: persen biasa 2% min Rp5.000; hari Jumat 5%. Hari dihitung WIB sesuai saat deposit dibuat.</p></div>
  <div className="card"><h3>🏆 Hadiah leaderboard mingguan</h3><label className="ad-ck"><input type="checkbox" checked={!!pr.weekly.on} onChange={sec('weekly','on')}/> Aktif (banner "Pembeli terbanyak dapat hadiah" tampil di leaderboard & dashboard)</label>
   <div className="ad-g"><label>Juara berdasarkan<select value={pr.weekly.metric} onChange={sec('weekly','metric')}><option value="trx">Jumlah transaksi sukses</option><option value="spent">Total belanja (Rp)</option></select></label><label>Hadiah juara 1,2,3... (Rp, pisahkan koma)<input value={pr.weekly.prizes} onChange={sec('weekly','prizes')}/></label><label>Syarat minimal (transaksi, atau Rp bila total belanja)<input type="number" value={pr.weekly.min} onChange={sec('weekly','min')}/></label></div>
   <p style={{color:'#64748b',fontSize:13}}>Periode Senin 00.00 - Minggu 24.00 WIB. Hadiah dibagikan otomatis oleh cron tiap Senin dini hari ke saldo juara minggu lalu.</p>
   <button className="btn sil" onClick={payWk}>Bagikan hadiah minggu lalu sekarang</button></div>
  <div className="card"><h3>📆 Hadiah leaderboard bulanan</h3><label className="ad-ck"><input type="checkbox" checked={!!pr.monthly.on} onChange={sec('monthly','on')}/> Aktif (tab "Bulanan" muncul di leaderboard)</label>
   <div className="ad-g"><label>Juara berdasarkan<select value={pr.monthly.metric} onChange={sec('monthly','metric')}><option value="trx">Jumlah transaksi sukses</option><option value="spent">Total belanja (Rp)</option></select></label><label>Hadiah juara 1,2,3... (Rp, pisahkan koma)<input value={pr.monthly.prizes} onChange={sec('monthly','prizes')}/></label><label>Syarat minimal (transaksi, atau Rp bila total belanja)<input type="number" value={pr.monthly.min} onChange={sec('monthly','min')}/></label></div>
   <p style={{color:'#64748b',fontSize:13}}>Periode tanggal 1 00.00 WIB sampai akhir bulan. Hadiah dibagikan otomatis oleh cron tiap tanggal 1 dini hari ke juara bulan lalu.</p>
   <button className="btn sil" onClick={payMo}>Bagikan hadiah bulan lalu sekarang</button></div>
  <button className="btn blue" onClick={savePromo}>Simpan semua pengaturan promo</button></>}
 {tab==='site'&&st&&<div className="card"><h3>🔗 Link dokumentasi & Base URL API</h3>
  <p style={{color:'#64748b',fontSize:14}}>Dipakai di halaman /docs dan menu API Key pengguna. Kosongkan untuk memakai domain situs ini secara otomatis.</p>
  <label style={{fontSize:14,fontWeight:600,color:'#41507a'}}>Base URL API (domain, mis. https://api.domainkamu.com)<input placeholder="https://domainkamu.com" value={st.baseUrl||''} onChange={e=>setSt({...st,baseUrl:e.target.value})}/></label>
  <label style={{fontSize:14,fontWeight:600,color:'#41507a'}}>Link dokumentasi (mis. /docs atau https://docs.domainkamu.com)<input placeholder="/docs" value={st.docsUrl||''} onChange={e=>setSt({...st,docsUrl:e.target.value})}/></label>
  <p style={{fontSize:13,color:'#64748b'}}>Pengguna akan melihat: <code>{(st.baseUrl||'(domain situs)').replace(/\/+$/,'')}/api/v1</code></p>
  <button className="btn blue" onClick={saveSite}>Simpan</button></div>}
 {tab==='tap'&&tp&&<div className="card"><h3>🔓 Pintu rahasia ke panel admin</h3>
  <p className="muted">Ketuk tulisan <b>ARTAPEDIA ID</b> di kaki halaman dashboard pengguna sebanyak jumlah di bawah, dan panel admin terbuka <b>tanpa mengetik password</b>. Pemeriksaannya dilakukan di server, jadi mengubah angka lewat browser tidak ada gunanya.</p>
  <p className="muted"><b>Penting:</b> selama daftar email masih kosong, <b>siapa pun yang sudah login</b> bisa masuk dengan mengetuk. Isi emailmu di bawah supaya hanya kamu yang bisa.</p>
  <div className="sv-top"><b>Pintu rahasia aktif</b><span style={{flex:1}}/><Sw on={!!tp.on} set={v=>setTp({...tp,on:v})} label="Pintu rahasia"/></div>
  <div className="ad-g"><label>Jumlah ketukan<input type="number" min="3" max="100" value={tp.n} onChange={e=>setTp({...tp,n:e.target.value})}/></label></div>
  <label className="blk">Email yang boleh (pisahkan koma; kosong = siapa pun yang login)
   <textarea rows="2" placeholder="kamu@gmail.com, admin@artapedia.id" value={tp.emails} onChange={e=>setTp({...tp,emails:e.target.value})}/></label>
  <p className="muted">Token hasil ketukan berlaku <b>8 jam</b>, disimpan di server, dan tidak pernah membocorkan password aslinya. Tiap kali ada yang masuk lewat pintu ini, notifikasi dikirim ke channel admin.</p>
  <div className="savebar"><button className="btn blue" disabled={sb} onClick={saveTap}>{sb?'Menyimpan…':'Simpan pintu rahasia'}</button></div></div>}
 {tab==='bk'&&<>
  <div className="card"><h3>💾 Backup otomatis ke Telegram owner</h3>
   {bk&&(!bk.token||!bk.chat)&&<p style={{color:'#c0392b'}}><b>Belum siap:</b> isi env {!bk.token&&'TELEGRAM_BOT_TOKEN '}{!bk.chat&&'BACKUP_CHAT_ID (chat ID Telegram pribadi owner, jangan channel publik)'} lalu redeploy.</p>}
   <p style={{color:'#64748b',fontSize:14}}>Isi backup: <b>seluruh database</b> — pengguna web &amp; bot (saldo, API key, riwayat order/deposit/mutasi), <b>reseller beserta dompet &amp; pelanggannya</b>, daftar <b>bot Telegram</b>, akun <b>QRIS Gateway</b>, <b>job &amp; bukti fotonya</b>, chat CS, pengumuman, pengaturan, dan hadiah mingguan. Yang sengaja tidak ikut: sesi login, token reset password, dan penghitung rate-limit.</p>
   {bk&&bk.isi&&<div className="bk-isi"><b>Isi database sekarang ({bk.isi.total} data)</b>
    <div className="bk-grid">{bk.isi.rows.map(r=><div key={r.k}><small>{r.l}</small><span>{r.n}</span></div>)}</div></div>}
   <label className="ad-ck"><input type="checkbox" checked={!!bh.on} onChange={e=>setBh({...bh,on:e.target.checked})}/> Backup otomatis aktif</label>
   <label>Kirim tiap<select value={bh.hours} onChange={e=>setBh({...bh,hours:+e.target.value})}>{[[1,'1 jam'],[3,'3 jam'],[6,'6 jam'],[12,'12 jam'],[24,'1 hari'],[48,'2 hari'],[168,'1 minggu']].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
   <div className="tabs" style={{marginTop:10}}><button className="btn blue" onClick={bkSave}>Simpan jadwal</button><button className="btn" disabled={bb} onClick={bkNow}>{bb?'Memproses...':'Kirim backup ke Telegram sekarang'}</button></div>
   {bk&&bk.meta&&<p style={{marginTop:12,fontSize:14}}>Backup terakhir: <b>{new Date(bk.meta.shownAt||bk.meta.at).toLocaleString('id-ID')}</b> · {bk.meta.ok?<span style={{color:'#1a9b55'}}>berhasil ({bk.meta.entries} data, {bk.meta.parts} file)</span>:<span style={{color:'#c0392b'}}>gagal: {bk.meta.error}</span>}</p>}
   <p style={{color:'#64748b',fontSize:13}}>Backup otomatis dijalankan oleh cron yang sama (ping tiap 1 menit ke /api/cron).</p></div>
  <div className="card"><h3>⬇️ Ekspor / ⬆️ Import</h3>
   <div className="tabs"><button className="btn blue" disabled={bb} onClick={bkDl}>Unduh backup (.json.gz)</button></div>
   <div style={{marginTop:14}}><b style={{fontSize:14}}>👥 Data semua pengguna</b>
    <p style={{color:'#64748b',fontSize:13}}>{bk&&bk.stats?<>Di database: <b>{bk.stats.users}</b> pengguna · terdaftar di indeks: <b style={{color:bk.stats.users===bk.stats.indexed?'#1a9b55':'#c0392b'}}>{bk.stats.indexed}</b>{bk.stats.users!==bk.stats.indexed&&' (ada yang belum terindeks, tekan Perbaiki)'}.</>:'Memuat…'} Berisi email, nama, saldo, API key, tanggal gabung, ajakan, ringkasan order/deposit, webhook & whitelist IP. Hash password tidak ikut. Backup otomatis & tombol "Kirim backup ke Telegram" juga mengirim file ini (CSV + JSON lengkap).</p>
    <div className="tabs"><button className="btn blue" disabled={bb} onClick={()=>dlUsers('csv')}>Unduh pengguna (CSV)</button><button className="btn" disabled={bb} onClick={()=>dlUsers('json')}>Unduh pengguna lengkap (JSON)</button><button className="btn" disabled={bb} onClick={reidx}>🔧 Perbaiki daftar pengguna</button></div></div>
   <div style={{marginTop:14}}><b style={{fontSize:14}}>Import / pulihkan dari file backup</b>
    <label className="ad-ck"><input type="radio" checked={imode==='merge'} onChange={()=>setImode('merge')}/> Gabungkan (data di file menimpa yang sama, data baru tetap aman)</label>
    <label className="ad-ck"><input type="radio" checked={imode==='replace'} onChange={()=>setImode('replace')}/> Ganti total (hapus semua data lalu pulihkan dari file)</label>
    <input type="file" multiple accept=".gz,.json,application/gzip,application/json" disabled={bb} onChange={bkImp}/>
    <p style={{color:'#64748b',fontSize:13}}>Bisa pilih beberapa file sekaligus kalau backup dari Telegram terbagi beberapa bagian. File .json.gz langsung bisa dipakai tanpa diekstrak.</p></div>
   {bs&&<p><b>{bs}</b></p>}</div></>}
 {tab==='notif'&&<div className="card"><h3>Tombol di bawah notifikasi channel</h3><p style={{color:'#64748b',fontSize:14}}>Tombol ini muncul di bawah setiap notifikasi Telegram (maks 6, link harus diawali http/https). Email pengguna otomatis disensor di semua notifikasi.</p>
  {btn.map((b,i)=><div key={i} className="ad-row"><input placeholder="Teks tombol, mis. 🌐 Buka Web" value={b.text} onChange={e=>setBtn(btn.map((x,j)=>j===i?{...x,text:e.target.value}:x))}/><input placeholder="https://..." value={b.url} onChange={e=>setBtn(btn.map((x,j)=>j===i?{...x,url:e.target.value}:x))}/><button className="btn sil" onClick={()=>setBtn(btn.filter((_,j)=>j!==i))}>✕</button></div>)}
  <div className="tabs" style={{marginTop:10}}>{btn.length<6&&<button className="btn sil" onClick={()=>setBtn([...btn,{text:'',url:''}])}>+ Tambah tombol</button>}<button className="btn blue" onClick={async()=>{await act('buttons',{buttons:btn});alert('Tombol disimpan')}}>Simpan</button><button className="btn" onClick={tes}>Tes kirim notifikasi</button></div></div>}
 </div></div></div>}
