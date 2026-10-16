import {NextResponse} from 'next/server';
import {db,query} from '../../../lib/server';
import {googleConfigured,syncMailboxes,unseal} from '../../../lib/gmail';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
function respond(data,status=200){return NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}});}
export async function GET(){
 try{
  const sql=db();
  const [candidateMailboxes,marketing,events,pending]=await Promise.all([
    query(sql,"SELECT id,candidate_id,address,status,last_checked_at,last_error,connected_at FROM bm_gmail_mailboxes WHERE kind='candidate' ORDER BY connected_at DESC LIMIT 60"),
    query(sql,"SELECT id,address,status,last_error,connected_at FROM bm_gmail_mailboxes WHERE kind='marketing' LIMIT 1"),
    query(sql,"SELECT e.id,e.candidate_id,e.category,e.sender,e.subject,e.snippet,e.received_at,e.notified_at,e.notify_error,c.name AS candidate_name,m.address AS candidate_address FROM bm_gmail_events e JOIN bm_candidates c ON c.id=e.candidate_id JOIN bm_gmail_mailboxes m ON m.id=e.mailbox_id ORDER BY e.received_at DESC LIMIT 80"),
    query(sql,"SELECT count(*)::int AS n FROM bm_gmail_events WHERE notified_at IS NULL")
  ]);
  return respond({googleConfigured:googleConfigured(),candidateMailboxes,marketingMailbox:marketing[0]||null,events,pendingAlerts:pending[0]?.n||0,schedule:'Daily; manual sync available',googleRedirectUri:'https://benchpilot-ai.vercel.app/api/gmail/callback'});
 }catch(e){console.error('Gmail status failed',e);return respond({error:'Unable to load Gmail connection status'},500)}
}
export async function POST(request){
 if(request.headers.get('x-bench-request')!=='1'||request.headers.get('origin')!==new URL(request.url).origin)return respond({error:'Unauthorized action'},403);
 try{
  const args=await request.json(),sql=db();
  if(args.action==='sync')return respond(await syncMailboxes(sql));
  if(args.action==='disconnect'){
    const id=String(args.mailbox_id||'');
    if(!/^[0-9a-f-]{36}$/i.test(id))return respond({error:'Invalid mailbox ID'},400);
    const existing=await query(sql,'SELECT id,kind,address,refresh_token_enc FROM bm_gmail_mailboxes WHERE id=$1',[id]);
    if(!existing[0])return respond({error:'Mailbox not found'},404);
    // Delete locally first, so synchronization stops even if Google revocation fails.
    await query(sql,'DELETE FROM bm_gmail_mailboxes WHERE id=$1',[id]);
    try{
      const raw=unseal(existing[0].refresh_token_enc);
      await fetch('https://oauth2.googleapis.com/revoke?token='+encodeURIComponent(raw),{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},signal:AbortSignal.timeout(8000)});
    }catch(error){console.error('Google token revocation unavailable',error.message);}
    return respond({disconnected:true,deletedLocalMailboxEvents:true});
  }
  return respond({error:'Unknown Gmail action'},404);
 }catch(e){console.error('Gmail action failed',e);return respond({error:'Gmail action failed; check connection details'},500)}
}