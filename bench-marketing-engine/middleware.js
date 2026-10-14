import { NextResponse } from 'next/server';
export function middleware(request){
 const username=process.env.APP_USER,password=process.env.APP_PASSWORD;
 if(!username||!password)return new NextResponse('Private workspace is not configured.',{status:503});
 if(request.nextUrl.pathname==='/api/scan' && request.method==='GET' && process.env.CRON_SECRET && request.headers.get('authorization')==='Bearer '+process.env.CRON_SECRET)return NextResponse.next();
 const provided=request.headers.get('authorization')||'';
 const expected='Basic '+btoa(username+':'+password);
 if(provided!==expected)return new NextResponse('Authentication required',{status:401,headers:{'WWW-Authenticate':'Basic realm="BenchPilot AI private workspace"','Cache-Control':'no-store'}});
 return NextResponse.next();
}
export const config={matcher:['/((?!_next/static|_next/image|favicon.ico).*)']};