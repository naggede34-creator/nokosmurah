'use client'
import {useState,useEffect,useCallback} from 'react'
const dt=ms=>{if(!ms)return '-';const d=new Date(+ms);return isNaN(d)?'-':d.toLocaleString('id-ID',{timeZone:'Asia/Jakarta',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).replace('.',':')+' WIB'}
const mmss=s=>{s=Math.max(0,Math.floor(s));return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')}
const NAMA={sessions:'Sesi login lama',tokens:'Token kedaluwarsa',jobs:'Antrean / broadcast lama',states:'Status bot kosong',users:'Pengguna tidak terpakai',bots:'Bot reseller tidak terpakai',orphans:'Bot yatim (akun reseller sudah tidak ada)',idx:'Indeks pengguna rusak'}
const Hasil=({s})=>{const k=Object.keys(NAMA).filter(x=>s&&s[x]>0)
 return k.length?<ul style={{margin:'6px 0',paddingLeft:18}}>{k.map(x=><li key={x}>{NAMA[x]}: <b>{s[x]}</b></li>)}</ul>:<p className="muted" style={{margin:'6px 0'}}>Tidak ada sampah, sistem sudah bersih.</p>}

// Maintenance otomatis harian: jadwal, durasi, aturan pembersihan, simulasi, dan jalankan sekarang.
export default function AdminAuto({call}){
 const [d,setD]=useState(null),[f,setF]=useState(null),[busy,setBusy]=useState(''),[msg,setMsg]=useState(''),[dry,setDry]=useState(null),[now,setNow]=useState(Date.now())
 const load=useCallback(async()=>{const r=await call('auto/get');if(r.error){setMsg('❌ '+r.error);return}setD(r);setF(x=>x||JSON.parse(JSON.stringify(r.cfg)))},[])
 useEffect(()=>{load()},[load])
 useEffect(()=>{const i=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(i)},[])
 useEffect(()=>{if(!d||!d.active)return;const i=setInterval(load,8000);return()=>clearInterval(i)},[d&&d.active])
 if(!d||!f)return <div className="card"><p className="muted">{msg||'Memuat maintenance otomatis...'}</p></div>
 const run=async(k,fn,ok)=>{setBusy(k);setMsg('');try{const r=await fn();if(r.error)setMsg('❌ '+r.error);else{setMsg('✅ '+ok);await load()}return r}catch(e){setMsg('❌ '+e.message)}finally{setBusy('')}}
 const setSlot=(i,v)=>setF({...f,slots:f.slots.map((x,j)=>j===i?v:x)})
 const left=d.active?Math.max(0,(d.until-now)/1000):0
 return <div className="card"><h3>🤖 Maintenance otomatis harian</h3>
  <p className="muted">Tiap jam yang dijadwalkan, situs masuk maintenance singkat, membersihkan sampah, lalu kembali normal sendiri. Awal dan hasilnya dikabari ke channel notifikasi, dan saat selesai pengguna bot ikut dikabari. Butuh pinger cron tiap 1 menit ke <code>/api/cron</code> (sama seperti sinkron deposit).</p>
  {d.active&&<div className="ud-msg" style={{background:'#fff7e6'}}>🚧 Maintenance otomatis sedang berjalan · sisa <b>{mmss(left)}</b> · selesai {dt(d.until)}</div>}
  <label className="ud-chk"><input type="checkbox" checked={f.on} onChange={e=>setF({...f,on:e.target.checked})}/> Aktifkan jadwal otomatis</label>
  <p className="muted" style={{margin:'6px 0 2px'}}>Jam mulai (WIB). Bawaan: 12:00 siang dan 03:00 dini hari.</p>
  <div className="ud-row wrap">{f.slots.map((s,i)=><span key={i} style={{display:'inline-flex',gap:6,alignItems:'center'}}>
   <input type="time" value={s} onChange={e=>setSlot(i,e.target.value)} style={{width:130}}/>
   {f.slots.length>1&&<button className="btn" onClick={()=>setF({...f,slots:f.slots.filter((_,j)=>j!==i)})} aria-label="Hapus jam">✕</button>}</span>)}
   {f.slots.length<6&&<button className="btn" onClick={()=>setF({...f,slots:[...f.slots,'18:00']})}>➕ Tambah jam</button>}</div>
  <p className="muted" style={{margin:'10px 0 2px'}}>Lama maintenance (menit, 1-10)</p>
  <input type="number" min="1" max="10" value={f.mins} onChange={e=>setF({...f,mins:e.target.value})} style={{width:120}}/>
  <p className="muted" style={{margin:'10px 0 2px'}}>Pesan di layar maintenance (kosong = pesan bawaan)</p>
  <input value={f.msg} maxLength={200} onChange={e=>setF({...f,msg:e.target.value})} placeholder="Maintenance otomatis: sistem sedang dibersihkan..."/>
  <label className="ud-chk" style={{marginTop:10}}><input type="checkbox" checked={f.notifyUsers!==false} onChange={e=>setF({...f,notifyUsers:e.target.checked})}/> Kabari semua pengguna lewat bot Telegram saat maintenance SELESAI</label>
  {f.notifyUsers!==false&&<><p className="muted" style={{margin:'4px 0 2px 26px'}}>Pesan ke pengguna (kosong = pesan bawaan). Dikirim ke bot utama, reseller tanpa modal, dan reseller mandiri. Kabar ke channel admin selalu dikirim.</p>
  <input value={f.doneMsg||''} maxLength={300} onChange={e=>setF({...f,doneMsg:e.target.value})} placeholder="Maintenance sudah selesai. Situs & bot normal kembali..." style={{marginLeft:26,width:'calc(100% - 26px)'}}/></>}
  <h4 style={{margin:'14px 0 4px'}}>Yang dibersihkan</h4>
  <label className="ud-chk"><input type="checkbox" checked disabled/> Sampah sistem: sesi login lama, token kedaluwarsa, antrean broadcast lama, status bot kosong, indeks rusak</label>
  <label className="ud-chk"><input type="checkbox" checked={f.delUsers} onChange={e=>setF({...f,delUsers:e.target.checked})}/> Hapus pengguna yang tidak terpakai</label>
  {f.delUsers&&<p className="muted" style={{margin:'0 0 6px 26px'}}>Hanya akun dengan saldo 0, tanpa transaksi apa pun, tanpa referral, tidak diblokir, tanpa akun reseller/chat CS, dan tidak login selama <input type="number" min="14" max="3650" value={f.userDays} onChange={e=>setF({...f,userDays:e.target.value})} style={{width:80,display:'inline-block',margin:'0 4px'}}/> hari.</p>}
  <label className="ud-chk"><input type="checkbox" checked={f.delBots} onChange={e=>setF({...f,delBots:e.target.checked})}/> Lepas bot reseller yang tidak pernah dipakai</label>
  {f.delBots&&<p className="muted" style={{margin:'0 0 6px 26px'}}>Bot yang umurnya lebih dari <input type="number" min="3" max="3650" value={f.botDays} onChange={e=>setF({...f,botDays:e.target.value})} style={{width:80,display:'inline-block',margin:'0 4px'}}/> hari, belum pernah menjual, pelanggan 2 orang atau kurang, tanpa saldo/stok/penarikan/tagihan. Pemilik dikabari lewat bot, akun resellernya tetap ada dan bisa membuat bot lagi. Bot yatim (akun resellernya sudah tidak ada) ikut dibersihkan.</p>}
  <div className="ud-row wrap" style={{marginTop:10}}>
   <button className="btn blue" disabled={!!busy} onClick={()=>run('save',()=>call('auto/save',{cfg:f}),'Pengaturan disimpan').then(r=>{if(r&&!r.error)setF(JSON.parse(JSON.stringify(r.cfg)))})}>{busy==='save'?'Menyimpan...':'💾 Simpan'}</button>
   <button className="btn" disabled={!!busy} onClick={async()=>{setDry(null);const r=await run('dry',()=>call('auto/dry'),'Simulasi selesai, tidak ada yang dihapus');if(r&&!r.error)setDry(r)}}>{busy==='dry'?'Memindai...':'🔍 Simulasi (tidak menghapus)'}</button>
   <button className="btn ud-r" disabled={!!busy||d.active} onClick={()=>confirm('Mulai maintenance SEKARANG selama '+f.mins+' menit dan jalankan pembersihan sungguhan? Pesanan & deposit baru berhenti sementara.')&&run('go',()=>call('auto/run'),'Maintenance dimulai, kembali normal otomatis')}>{busy==='go'?'Memulai...':'▶️ Jalankan sekarang'}</button></div>
  {msg&&<div className="ud-msg">{msg}</div>}
  <p className="muted" style={{marginBottom:0}}>Jadwal berikutnya: <b>{d.next?dt(d.next):'-'}</b>{!d.cfg.on&&' (jadwal sedang dimatikan)'}. Simpan dulu sebelum simulasi / jalankan agar memakai pengaturan terbaru.</p>
  {dry&&<div className="ud-msg"><b>Hasil simulasi</b> · dipindai {dry.scanned} data{dry.lengkap?'':' (belum semua, tinggal sebagian untuk putaran berikutnya)'}
   <Hasil s={dry.stats}/>{dry.sample&&dry.sample.length>0&&<div className="muted">Contoh pengguna: {dry.sample.join(', ')}</div>}{dry.botNames&&dry.botNames.length>0&&<div className="muted">Bot: {dry.botNames.join(', ')}</div>}</div>}
  {d.last&&<div className="ud-msg"><b>Pembersihan terakhir</b> · {dt(d.last.at)} · {d.last.mode==='auto'?'otomatis':'manual'} · dipindai {d.last.scanned}
   <Hasil s={d.last.stats}/>{(d.last.botNames||[]).length>0&&<div className="muted">Bot dilepas: {d.last.botNames.join(', ')}</div>}{(d.last.errs||[]).length>0&&<div style={{color:'#dc2626'}}>Catatan: {d.last.errs[0]}</div>}</div>}
 </div>}
