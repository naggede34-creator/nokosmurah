// Waktu Magrib dihitung OFFLINE (tanpa API): posisi matahari (algoritma NOAA) + ihtiyat seperti Kemenag RI.
// Magrib = matahari terbenam (tinggi -0,833°) + 2 menit. Dikalibrasi ke jadwal resmi Kemenag Jakarta 2026: selisih ≤1 menit; daerah lain di luar kota acuan bisa selisih beberapa menit.
export const CITIES={
 'Jakarta':[-6.2088,106.8456,7],'Bandung':[-6.9175,107.6191,7],'Semarang':[-6.9667,110.4167,7],'Yogyakarta':[-7.7956,110.3695,7],
 'Surabaya':[-7.2575,112.7521,7],'Medan':[3.5952,98.6722,7],'Palembang':[-2.9761,104.7754,7],'Banda Aceh':[5.5483,95.3238,7],
 'Padang':[-0.9471,100.4172,7],'Pekanbaru':[0.5071,101.4478,7],'Bandar Lampung':[-5.4292,105.2610,7],'Pontianak':[-0.0263,109.3425,7],
 'Banjarmasin':[-3.3194,114.5908,8],'Balikpapan':[-1.2379,116.8529,8],'Makassar':[-5.1477,119.4327,8],'Manado':[1.4748,124.8421,8],
 'Denpasar':[-8.65,115.2167,8],'Mataram':[-8.5833,116.1167,8],'Ambon':[-3.6954,128.1814,9],'Jayapura':[-2.5337,140.7181,9]}
export const ZONA=tz=>tz===7?'WIB':tz===8?'WITA':'WIT'
const R=Math.PI/180
// Y,M(0-11),D = tanggal kalender. Mengembalikan {ms, hhmm, zona, kota}. ms = instan UTC.
export function maghrib(Y,M,D,kota='Jakarta'){
 const c=CITIES[kota]||CITIES.Jakarta,[lat,lon,tz]=c
 const jd=Date.UTC(Y,M,D,12)/864e5+2440587.5,T=(jd-2451545)/36525
 const L0=((280.46646+T*(36000.76983+T*0.0003032))%360+360)%360
 const Mm=357.52911+T*(35999.05029-0.0001537*T),e=0.016708634-T*(0.000042037+0.0000001267*T)
 const C=Math.sin(Mm*R)*(1.914602-T*(0.004817+0.000014*T))+Math.sin(2*Mm*R)*(0.019993-0.000101*T)+Math.sin(3*Mm*R)*0.000289
 const om=125.04-1934.136*T,lam=L0+C-0.00569-0.00478*Math.sin(om*R)
 const eps=23+(26+(21.448-T*(46.815+T*(0.00059-T*0.001813)))/60)/60+0.00256*Math.cos(om*R)
 const dec=Math.asin(Math.sin(eps*R)*Math.sin(lam*R))
 const y=Math.tan(eps*R/2)**2
 const eot=4*(y*Math.sin(2*L0*R)-2*e*Math.sin(Mm*R)+4*e*y*Math.sin(Mm*R)*Math.cos(2*L0*R)-0.5*y*y*Math.sin(4*L0*R)-1.25*e*e*Math.sin(2*Mm*R))/R
 const cosH=(Math.sin(-0.8333*R)-Math.sin(lat*R)*Math.sin(dec))/(Math.cos(lat*R)*Math.cos(dec))
 if(cosH>1||cosH<-1)return null
 const H=Math.acos(cosH)/R
 const noon=720-4*lon-eot,min=noon+4*H+3.4    // menit sejak 00:00 UTC: ihtiyat 2 menit + koreksi 1,4 menit (dikalibrasi ke jadwal Kemenag Jakarta 2026)
 const ms=Date.UTC(Y,M,D)+Math.round(min*60000)
 const loc=new Date(ms+tz*36e5),p=n=>String(n).padStart(2,'0')
 return {ms,hhmm:p(loc.getUTCHours())+':'+p(loc.getUTCMinutes()),zona:ZONA(tz),kota}}
