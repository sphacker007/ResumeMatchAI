import {NextResponse} from 'next/server';
import {db,query} from '../../../../lib/server';
import {seal,unseal,googleConfigured,classifyMessage} from '../../../../lib/gmail';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){
  try{
    const sample='benchpilot-oauth-encryption-smoke-test';
    const sealed=seal(sample);
    const encryptionOk=unseal(sealed)===sample && !sealed.includes(sample);
    const classification=classifyMessage({payload:{headers:[{name:'From',value:'jobs@example.test'},{name:'Subject',value:'We received your application'}]},snippet:'Thank you for applying. We received your application.',threadId:'synthetic-test',internalDate:String(Date.now())});
    const tables=await query(db(),"SELECT count(*)::int AS n FROM bm_gmail_mailboxes");
    return NextResponse.json({encryption:encryptionOk?'passed':'failed',classification:classification?.category==='confirmation'?'passed':'failed',database:'connected',linkedMailboxes:tables[0]?.n||0,googleOAuthConfigured:googleConfigured(),noRealCandidateDataRead:true},{headers:{'Cache-Control':'no-store'}});
  }catch(error){
    console.error('Gmail smoke test failed',error.message);
    return NextResponse.json({test:'failed',detail:String(error.message).slice(0,120)},{status:503});
  }
}