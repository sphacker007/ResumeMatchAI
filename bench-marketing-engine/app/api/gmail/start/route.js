import {NextResponse} from 'next/server';
import {db} from '../../../../lib/server';
import {createAuthorization,googleConfigured} from '../../../../lib/gmail';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request){
  try{
    if(!googleConfigured())return NextResponse.redirect(new URL('/autopilot?gmail=setup',request.url));
    const u=new URL(request.url),kind=u.searchParams.get('kind');
    if(!['candidate','marketing'].includes(kind))return NextResponse.redirect(new URL('/autopilot?gmail=invalid',request.url));
    const url=await createAuthorization(db(),kind,u.searchParams.get('candidate_id'));
    return NextResponse.redirect(url);
  }catch(e){
    console.error('Gmail authorization start failed',e.message);
    return NextResponse.redirect(new URL('/autopilot?gmail=error',request.url));
  }
}