import { NextResponse } from 'next/server';
export function middleware(request) {
 const pass=process.env.APP_PASSWORD, user=process.env.APP_USER;
 if(request.nextUrl.pathname==='/api/scan' && request.method==='GET' && process.env.CRON_SECRET && request.headers.get('authorization')==='Bearer '+process.env.CRON_SECRET)return NextResponse.next();
 // Vercel project Deployment Protection (SSO) is required for the private initial release.
 // Optional application-level Basic Auth is enabled only after both credentials are configured.
 if(!pass || !user)return NextResponse.next();
 const actual=request.headers.get('authorization')||'';
 const expected='Basic '+btoa(user+':'+pass);
 if(actual!==expected)return new NextResponse('Authentication required',{status:401,headers:{'WWW-Authenticate':'Basic realm="BenchPilot AI"','Cache-Control':'no-store'}});
 return NextResponse.next();
}
export const config={matcher:['/((?!_next/static|_next/image|favicon.ico).*)']};