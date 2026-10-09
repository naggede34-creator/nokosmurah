import './globals.css'
import './tailwind.css'
import './fx.css'
import CsFab from '../components/CsFab'
import Shell from '../components/Shell'
import {THEME_INIT} from '../components/ThemeToggle'
export const metadata={title:'Artapedia ID - Nokos & OTP Otomatis',description:'Beli nomor OTP murah, cepat, otomatis'}
export const viewport={width:'device-width',initialScale:1,themeColor:'#f4f7fc'}
export default function L({children}){return <html lang="id" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{__html:THEME_INIT}}/></head><body>
<Shell>{children}</Shell><CsFab/></body></html>}
