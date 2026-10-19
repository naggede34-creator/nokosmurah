'use client'
import {useState,useEffect,useCallback,useMemo,useRef} from 'react'
// ===========================================================================
// Gateway SMP (khusus admin). Komponen ini hanya dirender di /admin dan SEMUA datanya
// diambil lewat call('agw/...') yang diperiksa password admin / token pintu rahasia di server.
// Tab: Ringkasan · API Key · Transaksi · Dokumentasi · Uji
// ===========================================================================
const rp=n=>'Rp'+Math.round(+n||0).toLocaleString('id-ID')
const wib=v=>{const d=new Date(v);return isNaN(d)||!v?'-':d.toLocaleString('id-ID',{timeZone:'Asia/Jakarta',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).replace('.',':')}
const ST={pending:['warn','🟡 Menunggu'],paid:['ok','🟢 Lunas'],expired:['red','⚪ Kedaluwarsa'],canceled:['red','⛔ Dibatalkan']}
const Sw=({on,set,label})=><button type="button" role="switch" aria-checked={!!on} aria-label={label} className={'sw'+(on?' on':'')} onClick={()=>set(!on)}><i/></button>
const salin=async(t,note)=>{try{await navigator.clipboard.writeText(String(t));return note||'Tersalin'}catch(e){return 'Gagal menyalin, salin manual'}}
const unduh=(nama,teks)=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([teks],{type:'text/markdown;charset=utf-8'}));a.download=nama;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000)}
const mask=s=>s?s.slice(0,12)+'••••••••••••••••••••'+s.slice(-4):''

// Markdown ringan -> HTML aman (docs dibuat oleh kita sendiri; tetap di-escape)
const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
function mdHtml(md){
 const out=[],L=md.split('\n');let i=0
 const inl=t=>esc(t).replace(/`([^`]+)`/g,'<code>$1</code>').replace(/\*\*([^*]+)\*\*/g,'<b>$1</b>').replace(/\*([^*]+)\*/g,'<i>$1</i>')
 while(i<L.length){
  const l=L[i]
  if(l.startsWith('```')){const buf=[];i++;while(i<L.length&&!L[i].startsWith('```')){buf.push(L[i]);i++};i++
   out.push('<pre class="ag-pre"><code>'+esc(buf.join('\n'))+'</code></pre>');continue}
  if(/^\|.*\|$/.test(l)&&/^\|[\s:|-]+\|$/.test(L[i+1]||'')){
   const head=l.split('|').slice(1,-1).map(x=>x.trim());i+=2;const rows=[]
   while(i<L.length&&/^\|.*\|$/.test(L[i])){rows.push(L[i].split('|').slice(1,-1).map(x=>x.trim()));i++}
   out.push('<div class="ag-tw"><table><thead><tr>'+head.map(h=>'<th>'+inl(h)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map(c=>'<td>'+inl(c.replace(/\\\|/g,'|'))+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>');continue}
  let m
  if((m=/^(#{1,3})\s+(.*)$/.exec(l))){out.push(`<h${m[1].length+1}>${inl(m[2])}</h${m[1].length+1}>`);i++;continue}
  if(/^---+$/.test(l)){out.push('<hr/>');i++;continue}
  if(/^>\s?/.test(l)){out.push('<blockquote>'+inl(l.replace(/^>\s?/,''))+'</blockquote>');i++;continue}
  if(/^(-|\d+\.)\s+/.test(l)){const ord=/^\d+\./.test(l),items=[]
   while(i<L.length&&/^(-|\d+\.)\s+/.test(L[i])){items.push('<li>'+inl(L[i].replace(/^(-|\d+\.)\s+/,''))+'</li>');i++}
   out.push((ord?'<ol>':'<ul>')+items.join('')+(ord?'</ol>':'</ul>'));continue}
  if(!l.trim()){i++;continue}
  out.push('<p>'+inl(l)+'</p>');i++}
 return out.join('')}

const CSS=`
.ag-sub{display:flex;gap:6px;flex-wrap:wrap;margin:4px 0 2px}
.ag-sub button{border:0;border-radius:11px;padding:9px 14px;font-weight:800;font-size:14px;background:#eef2f8;color:#51607a;cursor:pointer;font-family:inherit}
.ag-sub button.on{background:#2563eb;color:#fff}
.ag-key{border:1px solid #e1e8f2;border-radius:16px;padding:14px;margin:10px 0;background:#fbfcff}
.ag-key.off{opacity:.65}
.ag-kh{display:flex;align-items:center;gap:10px;justify-content:space-between;flex-wrap:wrap}
.ag-kh b{font-size:16px}
.ag-cp{display:flex;gap:6px;align-items:center;margin:6px 0}
.ag-cp code{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;background:#eef2f8;border-radius:9px;padding:8px 10px;font-size:12.5px;display:block}
.ag-cp .btn{padding:7px 11px;font-size:13px;flex:none}
.ag-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
.ag-row .btn{padding:7px 12px;font-size:13px}
.ag-l{font-size:12px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.04em;margin-top:10px}
.ag-tbw{overflow-x:auto}
.ag-tbw table{min-width:640px;font-size:13.5px}
.ag-tbw td,.ag-tbw th{white-space:nowrap}
.ag-doc{line-height:1.6;font-size:14.5px;overflow-wrap:anywhere}
.ag-doc h2{font-size:21px;margin:22px 0 8px}.ag-doc h3{font-size:17px;margin:18px 0 6px}.ag-doc h4{font-size:15px;margin:14px 0 4px}
.ag-doc code{background:#eef2f8;border-radius:6px;padding:1px 6px;font-size:.92em}
.ag-doc .ag-pre{background:#0f172a;color:#e2e8f0;border-radius:12px;padding:12px 14px;overflow-x:auto;margin:8px 0;font-size:12.5px;line-height:1.5}
.ag-doc .ag-pre code{background:none;color:inherit;padding:0;font-size:inherit}
.ag-doc .ag-tw{overflow-x:auto;margin:8px 0}.ag-doc table{min-width:480px;font-size:13.5px}
.ag-doc blockquote{border-left:4px solid #2563eb;background:#eef4ff;margin:8px 0;padding:8px 12px;border-radius:0 10px 10px 0}
.ag-doc ul,.ag-doc ol{padding-left:22px;margin:6px 0}
.ag-qr{text-align:center}.ag-qr img{width:230px;max-width:100%;border-radius:12px;border:1px solid #e1e8f2;background:#fff;padding:8px}
.ag-bars{display:flex;align-items:flex-end;gap:4px;height:90px;margin-top:10px}
.ag-bars i{flex:1;background:linear-gradient(#4d8dff,#1e6bff);border-radius:5px 5px 0 0;min-height:3px;display:block}
.ag-two{display:grid;grid-template-columns:1fr 1fr;gap:12px}
@media(max-width:640px){.ag-two{grid-template-columns:1fr}}
`

export default function AdminGateway({call:callRaw}){
 // call() milik halaman admin dibuat ulang tiap render; dibungkus supaya efek di bawah tidak terpicu terus-menerus
 const ref=useRef(callRaw);ref.current=callRaw
 const call=useCallback((a,b)=>ref.current(a,b),[])
 const [sub,setSub]=useState('ring'),[d,setD]=useState(null),[err,setErr]=useState(''),[msg,setMsg]=useState('')
 const [cfg,setCfg]=useState(null),[busy,setBusy]=useState('')
 const flash=(t,ms=3500)=>{setMsg(t);setTimeout(()=>setMsg(m=>m===t?'':m),ms)}
 const load=useCallback(async()=>{const r=await call('agw/data',{});if(r&&r.error){setErr(r.error);return}setErr('');setD(r);setCfg(c=>c||r.cfg)},[call])
 useEffect(()=>{load()},[load])
 const run=async(label,a,b,after)=>{setBusy(label);const r=await call(a,b||{});setBusy('')
  if(r&&r.error){flash('❌ '+r.error,6000);return null}
  if(after)await after(r);await load();return r}

 if(err)return <div className="card"><h3>🏦 Gateway SMP</h3><p className="muted">{err}</p></div>
 if(!d)return <div className="card"><h3>🏦 Gateway SMP</h3><p className="muted">Memuat…</p></div>

 return <div>
  <style>{CSS}</style>
  <div className="card"><h3>🏦 Gateway SMP <span className="chip2 blue" style={{marginLeft:6}}>khusus admin</span></h3>
   <p className="muted">Payment gateway QRIS berbasis SMP Payment untuk aplikasi/developer milikmu. Hanya admin yang bisa menerbitkan key dan melihat transaksi di halaman ini. Uang langsung masuk ke akun SMP Payment-mu.</p>
   <div className="ag-sub">{[['ring','📊 Ringkasan'],['key','🔑 API Key'],['trx','🧾 Transaksi'],['doc','📖 Dokumentasi'],['uji','🧪 Uji']].map(([k,l])=><button key={k} className={sub===k?'on':''} onClick={()=>setSub(k)}>{l}</button>)}</div>
   {msg&&<div className={'tres '+(msg.startsWith('❌')?'bad':'ok')}>{msg}</div>}
  </div>
  {sub==='ring'&&<Ringkasan d={d} cfg={cfg} setCfg={setCfg} run={run} busy={busy}/>}
  {sub==='key'&&<Keys d={d} run={run} busy={busy} flash={flash} call={call}/>}
  {sub==='trx'&&<Trx d={d} call={call} flash={flash} reload={load}/>}
  {sub==='doc'&&<Docs d={d} call={call} flash={flash}/>}
  {sub==='uji'&&<Uji d={d} call={call} flash={flash} reload={load}/>}
 </div>}

// ------------------------------------------------------------------ Ringkasan
function Ringkasan({d,cfg,setCfg,run,busy}){
 const s=d.stats,mx=Math.max(1,...s.days.map(x=>x.sum))
 return <>
  <div className="card"><h3>📊 Pendapatan lewat gateway</h3>
   <div className="ad-kpi" style={{maxWidth:'none'}}>
    <div><small>Hari ini</small><b>{rp(s.today.sum)}</b><i>{s.today.n} lunas</i></div>
    <div><small>7 hari</small><b>{rp(s.week.sum)}</b><i>{s.week.n} lunas</i></div>
    <div><small>30 hari</small><b>{rp(s.month.sum)}</b><i>{s.month.n} lunas</i></div>
    <div><small>Menunggu bayar</small><b>{s.pending}</b><i>tagihan aktif</i></div>
   </div>
   <div className="ag-bars" title="Nominal lunas 14 hari terakhir (WIB)">{s.days.map(x=><i key={x.d} style={{height:Math.max(3,x.sum/mx*100)+'%'}} title={x.d+' · '+rp(x.sum)+' · '+x.n+' trx'}/>)}</div>
   <small className="muted">14 hari terakhir. Total sejak awal: {rp(s.all.sum)} · {s.all.n} transaksi.</small></div>

  <div className="card"><h3>🔌 Status SMP Payment</h3>
   <div className={'tres '+(d.smp.ready?'ok':'bad')}>{d.smp.ready
    ?<>SMP Payment siap{d.smp.qrisDinamis?' · QRIS dinamis (nominal terisi otomatis)':' · QRIS berupa gambar: pembeli harus mengetik total sendiri'}{d.smp.username?<> · akun <b>{d.smp.username}</b></>:null}</>
    :<>SMP Payment belum siap. Isi <b>QRIS statis</b> dan <b>Key rahasia callback</b> di menu Integrasi &amp; kunci › SMP Payment.</>}</div>
   <p className="ag-l">URL callback (tempel di dashboard SMP Payment)</p>
   <div className="ag-cp"><code>{d.smp.callback}</code></div>
   {!d.smp.hasSecret&&<small className="muted">Key rahasia callback belum diisi, jadi URL di atas masih berisi placeholder.</small>}
   <small className="muted" style={{display:'block'}}>Callback yang sama dipakai deposit pengguna &amp; gateway ini; sistem membedakan tagihannya otomatis.</small></div>

  {cfg&&<div className="card"><h3>⚙️ Pengaturan gateway</h3>
   <div className="mt-grid"><div className="mt-item">Gateway aktif<Sw on={cfg.on} set={v=>setCfg({...cfg,on:v})} label="Gateway aktif"/></div></div>
   <div className="ag-two" style={{marginTop:10}}>
    <label className="blk">Nominal minimal (Rp)<input type="number" value={cfg.min} onChange={e=>setCfg({...cfg,min:e.target.value})}/></label>
    <label className="blk">Nominal maksimal (Rp)<input type="number" value={cfg.max} onChange={e=>setCfg({...cfg,max:e.target.value})}/></label>
    <label className="blk">Masa berlaku tagihan (menit, 2–30)<input type="number" min="2" max="30" value={cfg.expMin} onChange={e=>setCfg({...cfg,expMin:e.target.value})}/></label></div>
   <button className="btn blue" disabled={!!busy} onClick={()=>run('cfg','agw/cfg',{cfg},()=>{})}>{busy==='cfg'?'Menyimpan…':'Simpan pengaturan'}</button></div>}

  {d.orphans.length>0&&<div className="card"><h3>⚠️ Pembayaran SMP tanpa tagihan ({d.orphans.length})</h3>
   <p className="muted">Uang masuk tapi nominalnya tidak cocok dengan tagihan aktif mana pun (daftar ini dipakai bersama deposit pengguna). Cek di mutasi SMP, lalu kaitkan ke tagihan gateway lewat tab Transaksi atau kreditkan manual.</p>
   <div className="ag-tbw"><table><thead><tr><th>Waktu</th><th>Nominal</th><th>Penerbit</th><th>Pembayar</th><th>RRN</th></tr></thead>
    <tbody>{d.orphans.map(o=><tr key={o.rrn}><td>{wib(o.at)}</td><td><b>{rp(o.nominal)}</b></td><td>{o.issuer||'-'}</td><td>{o.payer||'-'}</td><td className="mono">{o.rrn}</td></tr>)}</tbody></table></div></div>}
 </>}

// ------------------------------------------------------------------ API Key
function Keys({d,run,busy,flash,call}){
 const [nama,setNama]=useState(''),[show,setShow]=useState({})
 return <>
  <div className="card"><h3>🔑 Buat API key</h3>
   <p className="muted">Satu key per aplikasi/developer supaya mudah dicabut tanpa mengganggu yang lain. Key hanya bisa dibuat di sini.</p>
   <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
    <input style={{flex:'1 1 220px'}} placeholder="Nama aplikasi / developer, mis. Toko Budi" maxLength={40} value={nama} onChange={e=>setNama(e.target.value)}/>
    <button className="btn blue" disabled={!!busy||!nama.trim()} onClick={()=>run('new','agw/key/new',{name:nama},()=>{setNama('');flash('✅ Key dibuat')})}>{busy==='new'?'Membuat…':'+ Buat key'}</button></div></div>
  {d.keys.length===0&&<div className="card"><p className="muted">Belum ada API key.</p></div>}
  {d.keys.map(k=><KeyCard key={k.id} k={k} base={d.base} show={!!show[k.id]} toggle={()=>setShow(s=>({...s,[k.id]:!s[k.id]}))} run={run} busy={busy} flash={flash} call={call}/>)}
 </>}

function KeyCard({k,base,show,toggle,run,busy,flash,call}){
 const [ip,setIp]=useState((k.ipw||[]).join(', ')),[hu,setHu]=useState(k.hook.url||''),[nm,setNm]=useState(k.name)
 useEffect(()=>{setIp((k.ipw||[]).join(', '));setHu(k.hook.url||'');setNm(k.name)},[k.ipw,k.hook.url,k.name])
 const b=x=>busy===x+k.id
 const kopi=async(t,n)=>flash(await salin(t,n))
 return <div className={'ag-key'+(k.on?'':' off')}>
  <div className="ag-kh"><b>{k.name}</b><span style={{display:'flex',gap:8,alignItems:'center'}}><span className={'chip2 '+(k.on?'ok':'red')}>{k.on?'Aktif':'Nonaktif'}</span>
   <Sw on={k.on} set={v=>run('on'+k.id,'agw/key/on',{id:k.id,on:v})} label="Key aktif"/></span></div>
  <p className="ag-l">API key</p>
  <div className="ag-cp"><code>{show?k.key:mask(k.key)}</code><button className="btn sil" onClick={toggle}>{show?'Sembunyi':'Lihat'}</button><button className="btn sil" onClick={()=>kopi(k.key,'API key tersalin')}>Salin</button></div>

  <p className="ag-l">Tanda tangan HMAC (opsional, lebih aman)</p>
  {k.secret?<div className="ag-cp"><code>{show?k.secret:mask(k.secret)}</code><button className="btn sil" onClick={()=>kopi(k.secret,'API secret tersalin')}>Salin</button>
    <button className="btn red" onClick={()=>run('sec'+k.id,'agw/key/secret',{id:k.id,on:false})}>Matikan</button></div>
   :<div className="ag-row"><button className="btn sil" disabled={!!busy} onClick={()=>run('sec'+k.id,'agw/key/secret',{id:k.id,on:true})}>Aktifkan API secret</button><small className="muted">Jika aktif, setiap request wajib bertanda tangan (lihat Dokumentasi §3.2).</small></div>}

  <p className="ag-l">Whitelist IP server (kosong = semua IP boleh)</p>
  <div style={{display:'flex',gap:8,flexWrap:'wrap'}}><input style={{flex:'1 1 220px'}} placeholder="mis. 203.0.113.10, 2001:db8::1" value={ip} onChange={e=>setIp(e.target.value)}/>
   <button className="btn sil" disabled={!!busy} onClick={()=>run('ipw'+k.id,'agw/key/ipw',{id:k.id,ipw:ip},()=>flash('✅ Whitelist disimpan'))}>Simpan IP</button></div>

  <p className="ag-l">Webhook (dikirim saat lunas / kedaluwarsa)</p>
  <div style={{display:'flex',gap:8,flexWrap:'wrap'}}><input style={{flex:'1 1 260px'}} placeholder="https://aplikasimu.com/agw-webhook" value={hu} onChange={e=>setHu(e.target.value)}/>
   <button className="btn sil" disabled={!!busy} onClick={()=>run('hk'+k.id,'agw/key/hook',{id:k.id,url:hu,on:!!hu.trim()},()=>flash(hu.trim()?'✅ Webhook disimpan & diaktifkan':'Webhook dimatikan'))}>Simpan webhook</button></div>
  {k.hook.url&&<>
   <div className="ag-cp"><code>{show?k.hook.secret:mask(k.hook.secret)}</code><button className="btn sil" onClick={()=>kopi(k.hook.secret,'Webhook secret tersalin')}>Salin secret</button></div>
   <div className="ag-row"><span className={'chip2 '+(k.hook.on?'ok':'')}>{k.hook.on?'Webhook aktif':'Webhook mati'}</span>
    <button className="btn sil" disabled={!!busy} onClick={async()=>{const r=await run('ht'+k.id,'agw/key/hooktest',{id:k.id});if(r)flash(r.result.ok?'✅ Tes webhook diterima (HTTP '+r.result.code+')':'❌ Tes webhook gagal: '+(r.result.error||('HTTP '+r.result.code)),6000)}}>{b('ht')?'Mengirim…':'Tes webhook'}</button>
    <button className="btn sil" disabled={!!busy} onClick={()=>confirm('Ganti webhook secret? Penerima webhook harus memakai secret baru.')&&run('hs'+k.id,'agw/key/hooksecret',{id:k.id},()=>flash('✅ Secret webhook diganti'))}>Ganti secret</button></div></>}

  <div className="ag-row" style={{marginTop:14,paddingTop:12,borderTop:'1px solid #e1e8f2'}}>
   <input style={{flex:'1 1 150px',margin:0}} value={nm} maxLength={40} onChange={e=>setNm(e.target.value)}/>
   <button className="btn sil" disabled={!!busy||!nm.trim()||nm===k.name} onClick={()=>run('rn'+k.id,'agw/key/rename',{id:k.id,name:nm},()=>flash('✅ Nama diubah'))}>Ubah nama</button>
   <button className="btn red" disabled={!!busy} onClick={()=>confirm('Ganti API key "'+k.name+'"? Key lama langsung tidak berlaku dan aplikasinya harus memakai key baru.')&&run('rg'+k.id,'agw/key/regen',{id:k.id},()=>flash('✅ Key diganti'))}>Ganti key</button>
   <button className="btn red" disabled={!!busy} onClick={()=>confirm('HAPUS key "'+k.name+'" permanen? Aplikasinya langsung tidak bisa memakai gateway. Riwayat tagihan tetap tersimpan.')&&run('dl'+k.id,'agw/key/del',{id:k.id},()=>flash('Key dihapus'))}>Hapus</button></div>
 </div>}

// ------------------------------------------------------------------ Transaksi
function Trx({d,call,flash,reload}){
 const [f,setF]=useState({status:'',q:'',keyId:''}),[pg,setPg]=useState(1),[r,setR]=useState(null),[busy,setBusy]=useState(''),[sel,setSel]=useState(null)
 const load=useCallback(async(p=pg)=>{const x=await call('agw/inv',{...f,page:p,limit:15});if(x&&!x.error)setR(x)},[call,f,pg])
 useEffect(()=>{load(pg)},[pg,f.status,f.keyId])      // eslint-disable-line
 useEffect(()=>{const t=setInterval(()=>load(pg),15000);return()=>clearInterval(t)},[load,pg])
 const act=async(label,a,b,ok)=>{setBusy(label);const x=await call(a,b);setBusy('')
  if(x&&x.error){flash('❌ '+x.error,6000);return}
  flash(ok||'✅ Selesai');await load(pg);reload()}
 return <div className="card"><h3>🧾 Transaksi gateway</h3>
  <div className="ag-two" style={{gridTemplateColumns:'1fr 1fr 2fr'}}>
   <select value={f.status} onChange={e=>{setPg(1);setF({...f,status:e.target.value})}}><option value="">Semua status</option><option value="pending">Menunggu</option><option value="paid">Lunas</option><option value="expired">Kedaluwarsa</option><option value="canceled">Dibatalkan</option></select>
   <select value={f.keyId} onChange={e=>{setPg(1);setF({...f,keyId:e.target.value})}}><option value="">Semua key</option>{d.keys.map(k=><option key={k.id} value={k.id}>{k.name}</option>)}</select>
   <input placeholder="Cari invoice / order ID / nominal, lalu Enter" value={f.q} onChange={e=>setF({...f,q:e.target.value})} onKeyDown={e=>e.key==='Enter'&&(setPg(1),load(1))}/></div>
  {!r?<p className="muted">Memuat…</p>:r.items.length===0?<p className="muted">Belum ada transaksi.</p>:<>
   <div className="ag-tbw"><table><thead><tr><th>Waktu</th><th>Key</th><th>Order ID</th><th>Nominal</th><th>Total bayar</th><th>Status</th><th>Webhook</th><th/></tr></thead>
    <tbody>{r.items.map(x=><tr key={x.invoice_id} style={sel===x.invoice_id?{background:'#f3f7ff'}:null}>
     <td>{wib(x.created_at)}</td><td>{x.key_name}</td><td className="mono">{x.order_id||'-'}</td><td>{rp(x.amount)}</td><td><b>{rp(x.total_pay)}</b></td>
     <td><span className={'chip2 '+ST[x.status][0]}>{ST[x.status][1]}</span>{x.late&&<span className="chip2 warn" style={{marginLeft:4}}>telat</span>}</td>
     <td>{x.hook?<span className={'chip2 '+(x.hook.ok?'ok':'red')} title={x.hook.err||''}>{x.hook.ok?'✓ terkirim':'✗ gagal ×'+x.hook.n}</span>:'-'}</td>
     <td><button className="btn sil" style={{padding:'5px 10px',fontSize:12.5}} onClick={()=>setSel(sel===x.invoice_id?null:x.invoice_id)}>{sel===x.invoice_id?'Tutup':'Detail'}</button></td></tr>)}</tbody></table></div>
   {sel&&(()=>{const x=r.items.find(i=>i.invoice_id===sel);if(!x)return null
    return <div className="ag-key"><div className="ag-kh"><b className="mono">{x.invoice_id}</b><span className={'chip2 '+ST[x.status][0]}>{ST[x.status][1]}</span></div>
     <div className="ag-two" style={{marginTop:8,fontSize:14}}>
      <div>Aplikasi: <b>{x.key_name}</b><br/>Order ID: <b>{x.order_id||'-'}</b><br/>Nominal: <b>{rp(x.amount)}</b> + kode unik <b>{x.unique_code}</b><br/>Total bayar: <b>{rp(x.total_pay)}</b><br/>Keterangan: {x.description||'-'}</div>
      <div>Dibuat: {wib(x.created_at)}<br/>Kedaluwarsa: {wib(x.expired_at)}<br/>Dibayar: {x.paid_at?wib(x.paid_at):'-'}<br/>Pembayar: {x.payer_name||'-'} {x.issuer?'· '+x.issuer:''}<br/>RRN: <span className="mono">{x.reference||'-'}</span></div></div>
     {x.hook&&<small className="muted">Webhook {x.hook.event}: {x.hook.ok?'terkirim (HTTP '+x.hook.code+')':'gagal — '+(x.hook.err||'')} · percobaan {x.hook.n} · {wib(x.hook.at)}</small>}
     <div className="ag-row">
      <button className="btn sil" disabled={!!busy} onClick={()=>act('chk','agw/inv/check',{id:x.invoice_id},'Status diperbarui')}>Cek status</button>
      {(x.status==='paid'||x.status==='expired')&&<button className="btn sil" disabled={!!busy} onClick={()=>act('rs','agw/inv/resend',{id:x.invoice_id},'Webhook dikirim ulang')}>Kirim ulang webhook</button>}
      {(x.status==='pending'||x.status==='expired')&&<button className="btn blue" disabled={!!busy} onClick={()=>confirm('Tandai LUNAS secara manual?\n\nLakukan HANYA setelah kamu memastikan uang '+rp(x.total_pay)+' sudah masuk di SMP Payment. Webhook lunas akan dikirim ke aplikasinya.')&&act('pd','agw/inv/paid',{id:x.invoice_id,note:'ditandai admin'},'Ditandai lunas')}>Tandai lunas</button>}
      {x.status==='pending'&&<button className="btn red" disabled={!!busy} onClick={()=>confirm('Batalkan tagihan ini?')&&act('cn','agw/inv/cancel',{id:x.invoice_id},'Tagihan dibatalkan')}>Batalkan</button>}</div>
     {d.orphans.filter(o=>o.nominal===x.total_pay&&(x.status==='pending'||x.status==='expired')).map(o=><div key={o.rrn} className="tres ok" style={{marginTop:10}}>Ada pembayaran SMP masuk <b>{rp(o.nominal)}</b> ({o.payer||'-'} · {o.issuer||'-'}) yang nominalnya cocok.
      <button className="btn blue" style={{marginLeft:8,padding:'5px 10px',fontSize:12.5}} disabled={!!busy} onClick={()=>act('at','agw/orphan/attach',{rrn:o.rrn,id:x.invoice_id},'Pembayaran dikaitkan')}>Kaitkan ke tagihan ini</button></div>)}
    </div>})()}
   <div className="ag-row" style={{justifyContent:'space-between',alignItems:'center'}}><small className="muted">{r.total} tagihan · halaman {r.page}/{r.pages} (300 terbaru)</small>
    <span style={{display:'flex',gap:6}}><button className="btn sil" disabled={pg<=1} onClick={()=>setPg(pg-1)}>‹</button><button className="btn sil" disabled={pg>=r.pages} onClick={()=>setPg(pg+1)}>›</button></span></div></>}
 </div>}

// ------------------------------------------------------------------ Dokumentasi
function Docs({d,call,flash}){
 const [md,setMd]=useState('')
 useEffect(()=>{call('agw/docs',{}).then(r=>r&&r.md&&setMd(r.md))},[call])
 const html=useMemo(()=>md?mdHtml(md):'',[md])
 return <div className="card"><h3>📖 Dokumentasi API developer</h3>
  <p className="muted">Berikan dokumen ini beserta API key ke developer. Base URL sudah terisi otomatis ({d.base}).</p>
  <div className="ag-row" style={{marginBottom:10}}>
   <button className="btn blue" disabled={!md} onClick={()=>unduh('ADMIN-GATEWAY-API.md',md)}>⬇ Unduh (.md)</button>
   <button className="btn sil" disabled={!md} onClick={async()=>flash(await salin(md,'Dokumentasi tersalin'))}>Salin semua</button></div>
  {!md?<p className="muted">Memuat…</p>:<div className="ag-doc" dangerouslySetInnerHTML={{__html:html}}/>}</div>}

// ------------------------------------------------------------------ Uji
function Uji({d,call,flash,reload}){
 const [kid,setKid]=useState((d.keys[0]||{}).id||''),[amt,setAmt]=useState('1000'),[inv,setInv]=useState(null),[busy,setBusy]=useState(false)
 useEffect(()=>{if(!inv||inv.status!=='pending')return;const t=setInterval(async()=>{const r=await call('agw/inv/check',{id:inv.invoice_id});if(r&&r.invoice){setInv(r.invoice);if(r.invoice.status==='paid')reload()}},4000);return()=>clearInterval(t)},[inv&&inv.invoice_id,inv&&inv.status])   // eslint-disable-line
 const buat=async()=>{setBusy(true);const r=await call('agw/inv/new',{id:kid,amount:amt,description:'Tagihan uji dari admin'});setBusy(false)
  if(r&&r.error)return flash('❌ '+r.error,6000);setInv(r.invoice);reload()}
 return <div className="card"><h3>🧪 Uji gateway</h3>
  <p className="muted">Buat tagihan QRIS asli lewat salah satu key, lalu bayar nominal kecil untuk memastikan alur QRIS → callback SMP → status lunas → webhook berjalan.</p>
  {d.keys.length===0?<p className="muted">Buat API key dulu di tab 🔑 API Key.</p>:<>
   <div className="ag-two"><label className="blk">Key<select value={kid} onChange={e=>setKid(e.target.value)}>{d.keys.map(k=><option key={k.id} value={k.id}>{k.name}</option>)}</select></label>
    <label className="blk">Nominal (Rp)<input type="number" value={amt} onChange={e=>setAmt(e.target.value)}/></label></div>
   <button className="btn blue" disabled={busy} onClick={buat}>{busy?'Membuat…':'Buat tagihan uji'}</button></>}
  {inv&&<div className="ag-qr" style={{marginTop:16}}>
   <div className={'tres '+(inv.status==='paid'?'ok':inv.status==='pending'?'':'bad')}>{ST[inv.status][1]} · <span className="mono">{inv.invoice_id}</span></div>
   <div style={{fontSize:22,fontWeight:900,margin:'6px 0'}}>{rp(inv.total_pay)}</div><small className="muted">Bayar TEPAT sejumlah ini (nominal {rp(inv.amount)} + kode unik {inv.unique_code}). Berlaku sampai {wib(inv.expired_at)}.</small>
   {inv.status==='pending'&&(inv.qr_image?<div style={{marginTop:10}}><img alt="QRIS" src={inv.qr_image}/></div>:<p className="muted">QR tidak tersedia.</p>)}
   {inv.status==='paid'&&<div className="tres ok">Pembayaran diterima{inv.payer_name?' dari '+inv.payer_name:''}. Alur berjalan 👍</div>}
   <div className="ag-row" style={{justifyContent:'center'}}>{inv.status==='pending'&&<button className="btn red" onClick={async()=>{const r=await call('agw/inv/cancel',{id:inv.invoice_id});if(r&&r.invoice){setInv(r.invoice);reload()}}}>Batalkan</button>}
    <button className="btn sil" onClick={()=>setInv(null)}>Tutup</button></div></div>}
 </div>}
