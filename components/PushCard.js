'use client'
import {useState,useEffect,useCallback} from 'react'
import {supported,permission,enable,disable,ringtone,hushRingtone,onPush,register} from './push'
// Kartu "Notifikasi HP" dipakai di dashboard pengguna dan panel admin.
// api: (path, body?) => Promise<json>  — pemanggil yang menentukan cara autentikasinya.
export default function PushCard({api,prefix='v1/push/',title='Notifikasi HP',desc,onMsg,compact}){
 const [st,setSt]=useState('load'),[busy,setBusy]=useState(''),[err,setErr]=useState('')
 const say=m=>{setErr(m);onMsg&&onMsg(m)}
 const refresh=useCallback(async()=>{
  if(!supported())return setSt('no')
  try{const reg=await register(),s=await reg.pushManager.getSubscription()
   setSt(permission()==='denied'?'denied':s?'on':'off')}catch(e){setSt('off')}},[])
 useEffect(()=>{refresh()},[refresh])
 useEffect(()=>onPush(()=>ringtone(10)),[])
 const go=async()=>{setBusy('on');try{await enable(api,prefix+'key',prefix+'subscribe');setSt('on');say('Notifikasi HP aktif. Coba tombol "Tes bunyi".')}catch(e){say(e.message)}setBusy('')}
 const off=async()=>{setBusy('off');try{await disable(api,prefix+'unsubscribe');setSt('off');say('Notifikasi HP dimatikan di perangkat ini.')}catch(e){say(e.message)}setBusy('')}
 const test=async()=>{setBusy('t');ringtone(6);try{const r=await api(prefix+'test',{});say(r.ok?'Tes terkirim ke '+(r.sent||1)+' perangkat. Tutup tab ini dan cek layar kunci HP.':(r.error||'Tes gagal'))}catch(e){say('Tes gagal')}setBusy('')}
 if(st==='load')return null
 return <div className={compact?'pn-card compact':'pn-card'}>
  <div className="pn-h"><span className="pn-ic">{st==='on'?'🔔':'🔕'}</span><div><b>{title}</b><small>{desc||'Bunyi & bergetar di HP walaupun tab browser sudah ditutup.'}</small></div>
   <span className={'pn-st '+(st==='on'?'on':st==='denied'?'bad':'')}>{st==='on'?'AKTIF':st==='denied'?'DIBLOKIR':st==='no'?'TIDAK DIDUKUNG':'MATI'}</span></div>
  {st==='no'
   ? <p className="pn-p">Browser ini belum mendukung notifikasi web. Di Android pakai Chrome; di iPhone buka lewat Safari lalu <b>Bagikan › Tambahkan ke Layar Utama</b>, buka dari ikon itu, baru aktifkan.</p>
   : <>
   <div className="pn-row">
    {st!=='on'&&<button type="button" className="pn-b go" disabled={!!busy||st==='denied'} onClick={go}>{busy==='on'?'Mengaktifkan…':'🔔 Aktifkan notifikasi HP'}</button>}
    {st==='on'&&<><button type="button" className="pn-b" disabled={!!busy} onClick={test}>{busy==='t'?'Mengirim…':'🔊 Tes bunyi'}</button>
     <button type="button" className="pn-b gh" disabled={!!busy} onClick={off}>{busy==='off'?'…':'Matikan'}</button>
     <button type="button" className="pn-b gh" onClick={hushRingtone}>Hentikan nada</button></>}
   </div>
   {st==='denied'&&<p className="pn-p">Notifikasi diblokir untuk situs ini. Ketuk ikon gembok/⚙ di address bar › <b>Notifikasi</b> › <b>Izinkan</b>, lalu muat ulang halaman.</p>}
   {st==='on'&&<p className="pn-p">Supaya sekeras nada telepon: Android › Setelan › Notifikasi › Chrome (atau Artapedia kalau sudah di-install) › pilih <b>Mendesak</b> dan nada yang nyaring. Pasang juga ke layar utama lewat menu browser › <b>Install app</b> supaya tetap bunyi saat Chrome ditutup penuh.</p>}
   </>}
  {err&&<p className="pn-e">{err}</p>}
 </div>}
