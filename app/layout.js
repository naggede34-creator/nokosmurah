import './globals.css'
import './tailwind.css'
import './fx.css'
import CsFab from '../components/CsFab'
import Shell from '../components/Shell'
export const metadata={title:'Artapedia ID - Nokos & OTP Otomatis',description:'Beli nomor OTP murah, cepat, otomatis'}
export const viewport={width:'device-width',initialScale:1,themeColor:'#060a1f'}
export default function L({children}){return <html lang="id"><body>
<Shell>{children}</Shell><CsFab/></body></html>}
