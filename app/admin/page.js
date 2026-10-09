'use client'
import {useState,useEffect,useRef} from 'react'
const rp=n=>'Rp'+(+n||0).toLocaleString('id-ID')
// kecilkan gambar di browser supaya ringan (maks 1000px, JPEG)
const shrinkS=f=>new Promise((res,rej)=>{const r=new FileReader();r.onerror=rej;r.onload=()=>{const im=new Image();im.onerror=rej;im.onload=()=>{for(const [m,q] of [[900,.72],[700,.6],[520,.5]]){const k=Math.min(1,m/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=im.width*k;c.height=im.height*k;c.getContext('2d').drawImage(im,0,0,c.width,c.height);const o=c.toDataURL('image/jpeg',q);if(o.length<=280000)return res(o)}rej(new Error('big'))};im.src=r.result};r.readAsDataURL(f)})
const shrink=f=>new Promise((res,rej)=>{const r=new FileReader();r.onerror=rej;r.onload=()=>{const im=new Image();im.onerror=rej;im.onload=()=>{const k=Math.min(1,1000/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=im.width*k;c.height=im.height*k;c.getContext('2d').drawImage(im,0,0,c.width,c.height);res(c.toDataURL('image/jpeg',.8))};im.src=r.result};r.readAsDataURL(f)})
export default function A(){
 const [pw,setPw]=useState(''),[d,setD]=useState(null),[em,setEm]=useState(''),[n,setN]=useState(0),[t,setT]=useState(''),[tab,setTab]=useState('main')
 const [btn,setBtn]=useState([]),[an,setAn]=useState({title:'',body:'',img:''}),[th,setTh]=useState([]),[cur,setCur]=useState(null),[ms,setMs]=useState([]),[rt,setRt]=useState(''),[rimg,setRimg]=useState('')
 const box=useRef(null),curR=useRef(null);curR.current=cur
 const [pr,setPr]=useState(null),[bk,setBk]=useState(null),[bs,setBs]=useState(''),[imode,setImode]=useState('merge'),[bb,setBb]=useState(false),[bh,setBh]=useState({on:true,hours:24}),[st,setSt]=useState(null),[sn,setSn]=useState(null)
 const EMPTY={id:'',name:'',balance:'',trx:'',spent:''},[lf,setLf]=useState(EMPTY)
 const call=(a,b)=>fetch('/api/admin/'+a,{method:'POST',headers:{'Content-Type':'application/json','x-admin':pw},body:JSON.stringify(b||{})}).then(r=>r.json())
 const load=async()=>{const r=await call('data');setD(r);if(r.cfg){setBtn(r.cfg.buttons||[]);setPr(p=>p||{ref:{...r.cfg.ref},bonus:{...r.cfg.bonus},weekly:{...r.cfg.weekly,prizes:(r.cfg.weekly.prizes||[]).join(', ')},monthly:{...r.cfg.monthly,prizes:(r.cfg.monthly.prizes||[]).join(', ')}});setSt(x=>x||{...r.cfg.site});setSn(x=>x||{users:String((r.cfg.stats||{}).users??''),orders:String((r.cfg.stats||{}).orders??'')})}}
 const act=async(a,b)=>{const r=await call(a,b);if(r.error)alert(r.error);load();return r}
 const tes=async()=>{const r=await call('testnotif');alert(r.ok?'Notifikasi terkirim ke Telegram':'Gagal: '+r.error)}
 const loadTh=async()=>{const r=await call('cs/list');setTh(r.items||[]);if(curR.current){const x=await call('cs/thread',{uid:curR.current});setMs(x.msgs||[])}}
 useEffect(()=>{if(!d||d.error||tab!=='cs')return;loadTh();const i=setInterval(loadTh,5000);return()=>clearInterval(i)},[d&&!d.error,tab,cur])
 useEffect(()=>{if(box.current)box.current.scrollTop=box.current.scrollHeight},[ms.length])
 const open=async uid=>{setCur(uid);const x=await call('cs/thread',{uid});setMs(x.msgs||[]);loadTh()}
 const reply=async()=>{if((!rt.trim()&&!rimg)||!cur)return;const x=await call('cs/reply',{uid:cur,text:rt,img:rimg});if(x.error)return alert(x.error);setRt('');setRimg('');setMs(x.msgs||[]);loadTh()}
 const loadBk=async()=>{const r=await call('backup/status');setBk(r);if(r.cfg)setBh(r.cfg)}
 useEffect(()=>{if(d&&!d.error&&tab==='bk')loadBk()},[d&&!d.error,tab])
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
  for(;;){const r=await call('backup/page',{cursor:cur2});if(r.error)throw Error(r.error)
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
   let batch=[],sz=0,done=0;const LIM=1800000
   const flush=async()=>{if(!batch.length)return;const r=await call('backup/import',{items:batch});if(r.error)throw Error(r.error);done+=batch.length;batch=[];sz=0;setBs('Mengimpor... '+done+'/'+all.length)}
   for(const en of all){const s=JSON.stringify(en.v)
    if(s.length>LIM){await flush();for(let o=0;o<s.length;o+=LIM){const r=await call('backup/import',{items:[{k:en.k,part:{o,total:s.length,s:s.slice(o,o+LIM)}}]});if(r.error)throw Error(r.error)}done++;continue}
    if(sz+s.length>LIM)await flush();batch.push({k:en.k,v:en.v});sz+=s.length+en.k.length+12}
   await flush();setBs('Import selesai: '+all.length+' data dipulihkan');alert('Import selesai ('+all.length+' data).');setPr(null);load()
  }catch(x){alert('Import gagal: '+x.message);setBs('')}
  setBb(false)}
const saveStats=async()=>{const r=await call('stats',sn);if(r.error)return alert(r.error);alert('Angka beranda disimpan. Beranda memperbarui angka dalam hitungan detik.');load()}
 const lbSave=async()=>{const r=await call(lf.id?'lb/edit':'lb/add',lf);if(r.error)return alert(r.error);setLf(EMPTY);load()}
 const lbEdit=x=>{setLf({id:x.id,name:x.name,balance:String(x.balance),trx:String(x.trx),spent:String(x.spent)});window.scrollTo({top:0,behavior:'smooth'})}
 const lbDel=async x=>{if(!confirm('Hapus "'+x.name+'" dari leaderboard?'))return;const r=await call('lb/del',{id:x.id});if(r.error)return alert(r.error);if(lf.id===x.id)setLf(EMPTY);load()}
 const pickImg=async e=>{const f=e.target.files[0];if(!f)return;try{setAn({...an,img:await shrink(f)})}catch(x){alert('Gambar tidak bisa dibaca')}}
 const post=async()=>{const r=await act('ann/add',an);if(!r.error)setAn({title:'',body:'',img:''})}
 if(!d||d.error)return <div className="card"><h2>Admin Login</h2><input type="password" placeholder="Password" onChange={e=>setPw(e.target.value)} onKeyDown={e=>e.key==='Enter'&&load()}/><button className="btn blue" onClick={load}>Masuk</button></div>
 const unread=th.reduce((a,x)=>a+x.unread,0)
 return <><div className="ad-tabs">{[['main','Ringkasan'],['home','🏠 Beranda'],['cs','💬 CS'+(unread?' ('+unread+')':'')],['ann','📣 Pengumuman'],['promo','🎁 Promo'],['site','🔗 Link API'],['bk','💾 Backup'],['notif','🔔 Notifikasi channel']].map(([k,l])=><button key={k} className={tab===k?'on':''} onClick={()=>setTab(k)}>{l}</button>)}<button onClick={()=>location.href='/admin/settings/buttons'}>🧩 Tombol sosial</button></div>
 {tab==='main'&&<><div className="card"><h2>Admin Panel</h2><p>Markup: {d.cfg.markup}%</p>
 <input value={em} onChange={e=>setEm(e.target.value)} placeholder="Email user"/><input type="number" value={n} onChange={e=>setN(e.target.value)} placeholder="Nominal / persen"/>
 <div className="tabs"><button className="btn" onClick={()=>act('addsaldo',{email:em,amount:n})}>Add Saldo</button><button className="btn" onClick={()=>act('delsaldo',{email:em,amount:n})}>Del Saldo</button><button className="btn sil" onClick={()=>act('ban',{email:em})}>Ban</button><button className="btn sil" onClick={()=>act('unban',{email:em})}>Unban</button><button className="btn blue" onClick={()=>act('markup',{percent:n})}>Set Markup %</button><button className="btn" onClick={async()=>{const r=await call('resetlink',{email:em});r.error?alert(r.error):prompt('Link reset password (berlaku 30 menit, sekali pakai). Salin lalu kirim ke pengguna:',r.link)}}>Link Reset Password</button></div></div>
 <div className="card"><h3>Server (klik untuk on/off)</h3><div className="tabs">{['warungnokos_s1','warungnokos_s2'].map(s=>{const off=d.cfg.off.includes(s);return <button key={s} className={'btn '+(off?'sil':'blue')} onClick={()=>act('server',{server:s,on:off})}>{s}: {off?'OFF':'ON'}</button>})}</div></div>
 <div className="card"><textarea value={t} onChange={e=>setT(e.target.value)} placeholder="Broadcast (muncul di beranda dashboard pengguna)"/><button className="btn blue" onClick={()=>act('broadcast',{text:t})}>Kirim Broadcast</button></div>
 <div className="card"><h3>Pengguna ({d.users.length})</h3><div style={{overflowX:'auto'}}><table><tbody>{d.users.map(u=><tr key={u.id}><td>{u.email}</td><td>{rp(u.balance)}</td><td>{u.banned?'BANNED':'aktif'}</td></tr>)}</tbody></table></div></div></>}
{tab==='home'&&sn&&<>
  <div className="card"><h3>🔢 Angka di beranda web</h3>
   <p style={{color:'#64748b',fontSize:14}}>Dua angka di bagian atas beranda (Pengguna dan OTP sukses). Isi angka bebas, atau kosongkan supaya memakai angka asli dari database.</p>
   <div className="ad-g"><label>Pengguna<input type="number" min="0" placeholder={'Otomatis (asli: '+((d.real||{}).users??0)+')'} value={sn.users} onChange={e=>setSn({...sn,users:e.target.value})}/></label>
   <label>OTP sukses<input type="number" min="0" placeholder={'Otomatis (asli: '+((d.real||{}).orders??0)+')'} value={sn.orders} onChange={e=>setSn({...sn,orders:e.target.value})}/></label></div>
   <div className="tabs" style={{marginTop:10}}><button className="btn blue" onClick={saveStats}>Simpan angka</button><button className="btn sil" onClick={()=>setSn({users:'',orders:''})}>Kosongkan (pakai angka asli)</button></div></div>
  <div className="card"><h3>{lf.id?'✏️ Ubah data leaderboard':'🏆 Tambah ke leaderboard'}</h3>
   <p style={{color:'#64748b',fontSize:14}}>Isi email atau nama. Kalau berupa email, otomatis disensor saat tampil (ab***c@gmail.com). Data ini muncul di tab Saldo terbanyak dan Transaksi terbanyak, bersama pengguna asli, dan tidak ikut hadiah mingguan/bulanan.</p>
   <label>Email / nama<input placeholder="mis. budi@gmail.com atau Budi" value={lf.name} onChange={e=>setLf({...lf,name:e.target.value})}/></label>
   <div className="ad-g"><label>Saldo (Rp)<input type="number" min="0" value={lf.balance} onChange={e=>setLf({...lf,balance:e.target.value})}/></label><label>Transaksi sukses<input type="number" min="0" value={lf.trx} onChange={e=>setLf({...lf,trx:e.target.value})}/></label><label>Total belanja (Rp)<input type="number" min="0" value={lf.spent} onChange={e=>setLf({...lf,spent:e.target.value})}/></label></div>
   <div className="tabs" style={{marginTop:10}}><button className="btn blue" onClick={lbSave}>{lf.id?'Simpan perubahan':'Tambah'}</button>{lf.id&&<button className="btn sil" onClick={()=>setLf(EMPTY)}>Batal ubah</button>}</div></div>
  <div className="card"><h3>Data leaderboard manual ({(d.lb||[]).length})</h3>
   {!(d.lb||[]).length&&<p style={{color:'#64748b'}}>Belum ada data manual. Leaderboard hanya berisi pengguna asli.</p>}
   {(d.lb||[]).map(x=><div key={x.id} className="ad-row" style={{borderBottom:'1px solid #e2e8f4',padding:'8px 0'}}><div style={{flex:1,minWidth:0}}><b>{x.name}</b><br/><small style={{color:'#64748b'}}>Saldo {rp(x.balance)} · {x.trx} transaksi · belanja {rp(x.spent)}</small></div><button className="btn sil" onClick={()=>lbEdit(x)}>Ubah</button><button className="btn sil" onClick={()=>lbDel(x)}>Hapus</button></div>)}</div></>}
  {tab==='cs'&&<div className="card"><h3>Chat Customer Service</h3><p style={{color:'#64748b',fontSize:14}}>Pengguna hanya bisa mengirim pesan jam 09.00-17.00 dan 18.00-22.00 WIB. Admin bisa membalas kapan saja.</p>
  <div className="ad-cs"><div className="ad-th card" style={{margin:0,padding:0}}>{th.length===0&&<p style={{padding:12,color:'#64748b'}}>Belum ada percakapan.</p>}{th.map(x=><button key={x.uid} className={cur===x.uid?'on':''} onClick={()=>open(x.uid)}><b>{x.email}</b>{x.unread>0&&<span className="dot">{x.unread}</span>}<small>{x.last}</small></button>)}</div>
  <div>{!cur?<p style={{color:'#64748b'}}>Pilih percakapan di kiri.</p>:<><div className="chat" ref={box} style={{maxHeight:380,background:'#f7f9fe',borderRadius:14,padding:10}}>{ms.map((m,i)=><div key={i} className={'msg '+(m.from==='admin'?'user':'admin')}>{m.img&&<img src={m.img} alt="" onClick={()=>window.open(m.img)}/>}{m.text}<small>{m.from==='admin'?'Admin':'Pengguna'} · {new Date(m.at).toLocaleString('id-ID')}</small></div>)}</div>
  {rimg&&<div style={{margin:'8px 0'}}><img src={rimg} alt="" style={{maxHeight:90,borderRadius:10}}/> <button className="btn sil" onClick={()=>setRimg('')}>✕</button></div>}<div className="cin"><label className="btn sil" style={{cursor:'pointer',margin:0}}>📷<input type="file" accept="image/*" hidden onChange={async e=>{const f=e.target.files[0];e.target.value='';if(f)try{setRimg(await shrinkS(f))}catch(x){alert('Foto tidak bisa dipakai')}}}/></label><input value={rt} onChange={e=>setRt(e.target.value)} onKeyDown={e=>e.key==='Enter'&&reply()} placeholder="Tulis balasan..."/><button disabled={!rt.trim()&&!rimg} onClick={reply}>➤</button></div></>}</div></div></div>}
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
 {tab==='bk'&&<>
  <div className="card"><h3>💾 Backup otomatis ke Telegram owner</h3>
   {bk&&(!bk.token||!bk.chat)&&<p style={{color:'#c0392b'}}><b>Belum siap:</b> isi env {!bk.token&&'TELEGRAM_BOT_TOKEN '}{!bk.chat&&'BACKUP_CHAT_ID (chat ID Telegram pribadi owner, jangan channel publik)'} lalu redeploy.</p>}
   <p style={{color:'#64748b',fontSize:14}}>Isi backup: semua pengguna (saldo, API key, riwayat order, deposit, mutasi), referral, chat CS, pengumuman, pengaturan, hadiah mingguan. Sesi login & token reset tidak ikut.</p>
   <label className="ad-ck"><input type="checkbox" checked={!!bh.on} onChange={e=>setBh({...bh,on:e.target.checked})}/> Backup otomatis aktif</label>
   <label>Kirim tiap<select value={bh.hours} onChange={e=>setBh({...bh,hours:+e.target.value})}>{[[1,'1 jam'],[3,'3 jam'],[6,'6 jam'],[12,'12 jam'],[24,'1 hari'],[48,'2 hari'],[168,'1 minggu']].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
   <div className="tabs" style={{marginTop:10}}><button className="btn blue" onClick={bkSave}>Simpan jadwal</button><button className="btn" disabled={bb} onClick={bkNow}>{bb?'Memproses...':'Kirim backup ke Telegram sekarang'}</button></div>
   {bk&&bk.meta&&<p style={{marginTop:12,fontSize:14}}>Backup terakhir: <b>{new Date(bk.meta.shownAt||bk.meta.at).toLocaleString('id-ID')}</b> · {bk.meta.ok?<span style={{color:'#1a9b55'}}>berhasil ({bk.meta.entries} data, {bk.meta.parts} file)</span>:<span style={{color:'#c0392b'}}>gagal: {bk.meta.error}</span>}</p>}
   <p style={{color:'#64748b',fontSize:13}}>Backup otomatis dijalankan oleh cron yang sama (ping tiap 1 menit ke /api/cron).</p></div>
  <div className="card"><h3>⬇️ Ekspor / ⬆️ Import</h3>
   <div className="tabs"><button className="btn blue" disabled={bb} onClick={bkDl}>Unduh backup (.json.gz)</button></div>
   <div style={{marginTop:14}}><b style={{fontSize:14}}>Import / pulihkan dari file backup</b>
    <label className="ad-ck"><input type="radio" checked={imode==='merge'} onChange={()=>setImode('merge')}/> Gabungkan (data di file menimpa yang sama, data baru tetap aman)</label>
    <label className="ad-ck"><input type="radio" checked={imode==='replace'} onChange={()=>setImode('replace')}/> Ganti total (hapus semua data lalu pulihkan dari file)</label>
    <input type="file" multiple accept=".gz,.json,application/gzip,application/json" disabled={bb} onChange={bkImp}/>
    <p style={{color:'#64748b',fontSize:13}}>Bisa pilih beberapa file sekaligus kalau backup dari Telegram terbagi beberapa bagian. File .json.gz langsung bisa dipakai tanpa diekstrak.</p></div>
   {bs&&<p><b>{bs}</b></p>}</div></>}
 {tab==='notif'&&<div className="card"><h3>Tombol di bawah notifikasi channel</h3><p style={{color:'#64748b',fontSize:14}}>Tombol ini muncul di bawah setiap notifikasi Telegram (maks 6, link harus diawali http/https). Email pengguna otomatis disensor di semua notifikasi.</p>
  {btn.map((b,i)=><div key={i} className="ad-row"><input placeholder="Teks tombol, mis. 🌐 Buka Web" value={b.text} onChange={e=>setBtn(btn.map((x,j)=>j===i?{...x,text:e.target.value}:x))}/><input placeholder="https://..." value={b.url} onChange={e=>setBtn(btn.map((x,j)=>j===i?{...x,url:e.target.value}:x))}/><button className="btn sil" onClick={()=>setBtn(btn.filter((_,j)=>j!==i))}>✕</button></div>)}
  <div className="tabs" style={{marginTop:10}}>{btn.length<6&&<button className="btn sil" onClick={()=>setBtn([...btn,{text:'',url:''}])}>+ Tambah tombol</button>}<button className="btn blue" onClick={async()=>{await act('buttons',{buttons:btn});alert('Tombol disimpan')}}>Simpan</button><button className="btn" onClick={tes}>Tes kirim notifikasi</button></div></div>}</>}
