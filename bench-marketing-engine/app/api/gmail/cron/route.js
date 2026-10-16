import {NextResponse} from 'next/server';
import {db} from '../../../../lib/server';
import {syncMailboxes} from '../../../../lib/gmail';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
export async function GET(request){
  if(!process.env.CRON_SECRET||request.headers.get('authorization')!=='Bearer '+process.env.CRON_SECRET)return NextResponse.json({error:'Unauthorized cron'},{status:401});
  try{
    const result=await syncMailboxes(db());
    return NextResponse.json(result,{headers:{'Cache-Control':'no-store'}});
  }catch(e){
    console.error('Gmail cron failed',e);
    return NextResponse.json({error:'Mailbox sync failed'},{status:500});
  }
}