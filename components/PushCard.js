'use client'
import {useState,useEffect,useCallback} from 'react'
import {supported,permission,enable,disable,ringtone,hushRingtone,onPush,register,primeAudio} from './push'
const ago=t=>{if(!t)return '-';const s=Math.floor((Date.now()-t)/1000)
 return s<60?'baru saja':s<3600?Math.floor(s/60)+' menit lalu':s<86400?Math.floor(s/3600)+' jam lalu':new Date(t).toLocaleDateString('id-ID',{day:'numeric',month:'short'})}
// Kartu "Notifikasi HP" dipakai di panel admin (chat CS masuk) dan dashboard/profil pengguna.
// api: (path, body?) => Promise<json> — pemanggil yang menentukan cara autentikasinya.
export default function PushCard({api,prefix='v1/push/',title='Notifikasi HP',desc,onMsg,compact}){
 const [st,setSt]=useState('load'),[busy,setBusy]=useState(''),[err,setErr]=useState(''),[dev,setDev]=useState([]),[det,setDet]=useState(false)
 const say=m=>{setErr(m);onMsg&&onMsg(m)}
 const loadDev=useCallback(async()=>{try{const r=await api(prefix+'status');if(r&&r.list)setDev(r.list)}catch(e){}},[api,prefix])
 const refresh=useCallback(async()=>{
  if(!supported())return setSt('no')
  try{const reg=await register(),s=await reg.pushManager.getSubscription()
   setSt(permission()==='denied'?'denied':s?'on':'off')}catch(e){setSt('off')}
  loadDev()},[loadDev])
 useEffect(()=>{refresh()},[refresh])
 useEffect(()=>onPush(()=>ringtone(12)),[])
 const go=async()=>{primeAudio();setBusy('on')
  try{await enable(api,prefix+'key',prefix+'subscribe');setSt('on');await loadDev()
   say('Notifikasi HP aktif di perangkat ini. Sekarang tekan "Tes bunyi".')}
  catch(e){say(e.message)}
  setBusy('')}
 const off=async()=>{setBusy('off');try{await disable(api,prefix+'unsubscribe');setSt('off');await loadDev();say('Notifikasi dimatikan di perangkat ini.')}catch(e){say(e.message)}setBusy('')}
 const test=async()=>{primeAudio();setBusy('t');ringtone(6)
  try{const r=await api(prefix+'test',{})
   if(r.list)setDev(r.list)
   if(r.error)say(r.error)
   else if(r.sent>0)say('Terkirim ke '+r.sent+' dari '+r.total+' perangkat. Tutup tab ini dan cek layar kunci HP.')
   else{setDet(true);say('Tidak ada yang berhasil dikirim. Lihat sebabnya di daftar perangkat di bawah.')}
   if(r.removed>0)say((r.sent>0?'Terkirim ke '+r.sent+' perangkat. ':'')+r.removed+' langganan lama dibuang — aktifkan ulang di perangkat itu.')}
  catch(e){say('Tes gagal: '+e.message)}
  setBusy('')}
 if(st==='load')return null
 const bad=dev.filter(d=>d.last&&!d.last.ok)
 return <div className={compact?'pn-card compact':'pn-card'}>
  <div className="pn-h"><span className="pn-ic">{st==='on'?'🔔':'🔕'}</span><div><b>{title}</b><small>{desc||'Bunyi & bergetar di HP walaupun tab browser sudah ditutup.'}</small></div>
   <span className={'pn-st '+(st==='on'?'on':st==='denied'?'bad':'')}>{st==='on'?'AKTIF':st==='denied'?'DIBLOKIR':st==='no'?'TIDAK DIDUKUNG':'MATI'}</span></div>
  {st==='no'
   ? <p className="pn-p">Browser ini belum mendukung notifikasi web. Di Android pakai Chrome; di iPhone buka lewat Safari lalu <b>Bagikan › Tambahkan ke Layar Utama</b>, buka dari ikon itu, baru aktifkan.</p>
   : <>
   <p className="pn-p pn-key">⚠️ Tombol ini mendaftarkan <b>perangkat yang sedang kamu pakai sekarang</b>. Kalau yang mau berbunyi HP-mu, buka halaman ini <b>di HP itu</b> lalu tekan tombolnya di sana — mengaktifkan di laptop tidak membuat HP berbunyi.</p>
   <div className="pn-row">
    {st!=='on'&&<button type="button" className="pn-b go" disabled={!!busy||st==='denied'} onClick={go}>{busy==='on'?'Mengaktifkan…':'🔔 Aktifkan di perangkat ini'}</button>}
    {st==='on'&&<><button type="button" className="pn-b" disabled={!!busy} onClick={test}>{busy==='t'?'Mengirim…':'🔊 Tes bunyi'}</button>
     <button type="button" className="pn-b gh" disabled={!!busy} onClick={go}>🔁 Daftar ulang</button>
     <button type="button" className="pn-b gh" disabled={!!busy} onClick={off}>Matikan</button>
     <button type="button" className="pn-b gh" onClick={hushRingtone}>Hentikan nada</button></>}
   </div>
   {st==='denied'&&<p className="pn-p">Notifikasi diblokir untuk situs ini. Ketuk ikon gembok/⚙ di address bar › <b>Notifikasi</b> › <b>Izinkan</b>, lalu muat ulang halaman.</p>}
   <button type="button" className="pn-more" onClick={()=>{setDet(!det);loadDev()}}>
    {det?'▾':'▸'} Perangkat terdaftar: <b>{dev.length}</b>{bad.length>0&&<em> · {bad.length} bermasalah</em>}</button>
   {det&&<div className="pn-dev">
    {dev.length===0&&<p className="pn-p" style={{margin:0}}>Belum ada perangkat terdaftar. Buka halaman ini di HP yang mau berbunyi, lalu tekan <b>Aktifkan di perangkat ini</b>.</p>}
    {dev.map(d=><div key={d.id} className={'pn-d'+(d.last&&!d.last.ok?' bad':'')}>
     <span className="pn-di">{d.last?(d.last.ok?'✅':'❌'):'⏳'}</span>
     <span className="pn-dt"><b>{d.svc}</b><small title={d.label}>{(d.label||'').slice(0,58)||'Perangkat'}</small>
      <small>Didaftarkan {ago(d.at)}{d.last?' · kiriman terakhir '+ago(d.last.at)+(d.last.ok?' berhasil':' GAGAL'):' · belum pernah dikirimi'}</small>
      {d.last&&!d.last.ok&&d.last.err&&<small className="pn-de">{d.last.err}</small>}</span></div>)}
    <p className="pn-p" style={{marginTop:8}}>Satu baris = satu HP/browser. Kalau HP-mu tidak ada di daftar ini, notifikasinya memang belum pernah didaftarkan dari HP tersebut.</p></div>}
   {st==='on'&&<p className="pn-p">Supaya sekeras nada telepon: Android › Setelan › Notifikasi › Chrome (atau Artapedia kalau sudah di-install) › pilih <b>Mendesak</b> dan nada yang nyaring, lalu matikan penghemat baterai untuk Chrome. Pasang juga ke layar utama lewat menu browser › <b>Install app</b>.</p>}
   </>}
  {err&&<p className="pn-e">{err}</p>}
 </div>}
