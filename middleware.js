import {NextResponse} from 'next/server'
export function middleware(req){
 if(!req.cookies.get('sid'))return NextResponse.redirect(new URL('/login',req.url))}
export const config={matcher:['/dashboard/:path*','/cs']}
