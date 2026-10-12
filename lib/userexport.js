// Format data pengguna (tanpa hash password) untuk ekspor: dipakai server (kirim Telegram) dan browser (unduh manual).
export const COLS=['id','email','nama','saldo','api_key','bergabung','diblokir','kode_ajakan','diajak_oleh','jumlah_ajakan','pendapatan_ajakan','total_order','order_sukses','order_batal','total_belanja','total_deposit','deposit_sukses','nominal_deposit','whitelist_ip','webhook_url','webhook_aktif']
export const flat=u=>{
 const tx=u.tx||[],ord=tx.filter(x=>x.type==='order'),dep=tx.filter(x=>x.type==='deposit'),okO=ord.filter(x=>x.status==='success'),okD=dep.filter(x=>x.status==='completed'||x.status==='success'||x.credited)
 return [u.id,u.email,u.name,u.balance||0,u.apikey,u.joinedAt,u.banned?'ya':'tidak',u.refCode||'',u.refBy||'',u.refCount||0,u.refEarn||0,ord.length,okO.length,ord.filter(x=>x.status==='cancelled'||x.status==='expired').length,okO.reduce((a,x)=>a+(+x.price||0),0),dep.length,okD.length,okD.reduce((a,x)=>a+(+x.amount||0),0),(u.ipw||[]).join(' '),(u.hook&&u.hook.url)||'',u.hook&&u.hook.on?'ya':'tidak']}
const cell=v=>{v=String(v??'');if(/^[=+\-@\t\r]/.test(v))v="'"+v;return /[",\n\r;]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v}
export const toCsv=users=>'\ufeff'+[COLS.join(','),...users.map(u=>flat(u).map(cell).join(','))].join('\r\n')
// salinan pengguna tanpa hash password, siap diekspor
export const clean=u=>{const {pass,...x}=u;if(x.hook)x.hook={...x.hook};return x}
