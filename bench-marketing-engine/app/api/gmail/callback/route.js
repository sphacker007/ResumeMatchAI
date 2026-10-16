import {NextResponse} from 'next/server';
import {db} from '../../../../lib/server';
import {completeAuthorization} from '../../../../lib/gmail';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request){
  const u=new URL(request.url);
  try{
    if(u.searchParams.get('error'))return NextResponse.redirect(new URL('/autopilot?gmail=denied',request.url));
    const connected=await completeAuthorization(db(),{state:u.searchParams.get('state'),code:u.searchParams.get('code')});
    const dest=new URL('/autopilot',request.url);
    dest.searchParams.set('gmail','connected');
    dest.searchParams.set('type',connected.kind);
    return NextResponse.redirect(dest);
  }catch(e){
    console.error('Gmail OAuth callback failed:',e.message);
    return NextResponse.redirect(new URL('/autopilot?gmail=error',request.url));
  }
}