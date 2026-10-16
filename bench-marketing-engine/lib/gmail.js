import {randomBytes,createHash,createCipheriv,createDecipheriv} from 'node:crypto';
import {query} from './server';

const OAUTH='https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN='https://oauth2.googleapis.com/token';
const ME='https://www.googleapis.com/oauth2/v3/userinfo';
const GMAIL='https://gmail.googleapis.com/gmail/v1/users/me';
const CANDIDATE_SCOPE='https://www.googleapis.com/auth/gmail.readonly';
const MARKETING_SCOPE='https://www.googleapis.com/auth/gmail.send';
const EMAIL_SCOPE='https://www.googleapis.com/auth/userinfo.email';

export function googleConfigured(){return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.MAIL_TOKEN_KEY);}
export function callbackUri(){return process.env.GMAIL_REDIRECT_URI||'https://benchpilot-ai.vercel.app/api/gmail/callback';}
function encryptionKey(){const v=process.env.MAIL_TOKEN_KEY||'';if(!/^[0-9a-f]{64}$/i.test(v))throw Error('MAIL_TOKEN_KEY must be a 32-byte hex secret');return Buffer.from(v,'hex');}
export function seal(value){
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',encryptionKey(),iv);
  const enc=Buffer.concat([cipher.update(String(value),'utf8'),cipher.final()]);
  return 'v1:'+Buffer.concat([iv,cipher.getAuthTag(),enc]).toString('base64url');
}
export function unseal(ciphertext){
  if(!String(ciphertext).startsWith('v1:'))throw Error('Unsupported encrypted token');
  const data=Buffer.from(ciphertext.slice(3),'base64url');
  if(data.length<29)throw Error('Invalid encrypted token');
  const dec=createDecipheriv('aes-256-gcm',encryptionKey(),data.subarray(0,12));
  dec.setAuthTag(data.subarray(12,28));
  return Buffer.concat([dec.update(data.subarray(28)),dec.final()]).toString('utf8');
}
const sha=(s)=>createHash('sha256').update(s).digest('hex');
async function googleForm(params){
  const response=await fetch(TOKEN,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(params),signal:AbortSignal.timeout(12000),cache:'no-store'});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Error('Google OAuth token exchange failed ('+response.status+')');
  return data;
}
export async function createAuthorization(sql,kind,candidateId){
  if(!googleConfigured())throw Error('Google OAuth has not been configured');
  if(!['candidate','marketing'].includes(kind))throw Error('Invalid mailbox connection type');
  if(kind==='candidate'){
    if(!/^[a-f0-9-]{36}$/i.test(candidateId||''))throw Error('Valid candidate required');
    const rows=await query(sql,"SELECT p.applicant_email FROM bm_candidates c JOIN bm_application_profiles p ON p.candidate_id=c.id WHERE c.id=$1 AND c.active=true",[candidateId]);
    if(!rows[0]?.applicant_email)throw Error('Save the authorized candidate application email before connecting Gmail');
  }
  const token=randomBytes(32).toString('base64url');
  await query(sql,"INSERT INTO bm_gmail_oauth_states(state_hash,kind,candidate_id,expires_at) VALUES($1,$2,$3,NOW()+interval '10 minutes')",[sha(token),kind,kind==='candidate'?candidateId:null]);
  const qs=new URLSearchParams({client_id:process.env.GOOGLE_CLIENT_ID,redirect_uri:callbackUri(),response_type:'code',scope:EMAIL_SCOPE+' '+(kind==='candidate'?CANDIDATE_SCOPE:MARKETING_SCOPE),state:token,access_type:'offline',prompt:'consent',include_granted_scopes:'false'});
  return OAUTH+'?'+qs.toString();
}
export async function completeAuthorization(sql,{state,code}){
  if(!state||!code||!googleConfigured())throw Error('Incomplete Google OAuth callback');
  const used=await query(sql,"UPDATE bm_gmail_oauth_states SET used_at=NOW() WHERE state_hash=$1 AND used_at IS NULL AND expires_at>NOW() RETURNING kind,candidate_id",[sha(state)]);
  if(!used.length)throw Error('OAuth authorization expired or was already used. Connect again.');
  const session=used[0];
  const tokens=await googleForm({client_id:process.env.GOOGLE_CLIENT_ID,client_secret:process.env.GOOGLE_CLIENT_SECRET,redirect_uri:callbackUri(),grant_type:'authorization_code',code});
  if(!tokens.refresh_token||!tokens.access_token)throw Error('Google did not return offline access. Reconnect and approve requested permissions.');
  const me=await fetch(ME,{headers:{Authorization:'Bearer '+tokens.access_token},signal:AbortSignal.timeout(10000)});
  if(!me.ok)throw Error('Unable to verify Google account email');
  const profile=await me.json();
  const address=String(profile.email||'').trim().toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)||!profile.verified_email)throw Error('Google account address is not verified');
  if(session.kind==='candidate'){
    const [candidate]=await query(sql,"SELECT p.applicant_email FROM bm_application_profiles p WHERE p.candidate_id=$1",[session.candidate_id]);
    if(!candidate||candidate.applicant_email.trim().toLowerCase()!==address)throw Error('Connected Gmail does not match the approved candidate application email');
  }
  const required=session.kind==='candidate'?CANDIDATE_SCOPE:MARKETING_SCOPE;
  if(!String(tokens.scope||'').split(/\s+/).includes(required))throw Error('Required Gmail permission was not granted.');
  const encrypted=seal(tokens.refresh_token);
  const matches=await query(sql,"SELECT id FROM bm_gmail_mailboxes WHERE kind=$1 AND candidate_id IS NOT DISTINCT FROM $2",[session.kind,session.candidate_id]);
  if(matches.length){
    await query(sql,"UPDATE bm_gmail_mailboxes SET address=$1,refresh_token_enc=$2,scopes=$3,status='connected',last_error=NULL,last_checked_at=CASE WHEN kind='candidate' THEN NOW() ELSE last_checked_at END,connected_at=NOW(),updated_at=NOW() WHERE id=$4",[address,encrypted,tokens.scope||'',matches[0].id]);
  }else{
    await query(sql,"INSERT INTO bm_gmail_mailboxes(kind,candidate_id,address,refresh_token_enc,scopes,last_checked_at) VALUES($1,$2,$3,$4,$5,CASE WHEN $1='candidate' THEN NOW() ELSE NULL END)",[session.kind,session.candidate_id,address,encrypted,tokens.scope||'']);
  }
  return {kind:session.kind,address};
}
export async function gmailAccess(mailbox){
  const refresh=unseal(mailbox.refresh_token_enc);
  const data=await googleForm({client_id:process.env.GOOGLE_CLIENT_ID,client_secret:process.env.GOOGLE_CLIENT_SECRET,refresh_token:refresh,grant_type:'refresh_token'});
  if(!data.access_token)throw Error('Google refresh failed');
  return data.access_token;
}
export async function gmailFetch(token,path,params={}){
  const queryText=new URLSearchParams(params).toString();
  const response=await fetch(GMAIL+path+(queryText?'?'+queryText:''),{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(14000),cache:'no-store'});
  if(!response.ok)throw Error('Gmail read returned HTTP '+response.status);
  return response.json();
}
export function classifyMessage(message){
  const headers=message.payload?.headers||[];
  const h=(key)=>String(headers.find(v=>v.name?.toLowerCase()===key)?.value||'').slice(0,500);
  const subject=h('subject'),sender=h('from'),lower=(subject+' '+String(message.snippet||'').slice(0,360)).toLowerCase();
  const from=sender.toLowerCase();
  if(/(?:^|\W)(promotion|discount|sale|newsletter|unsubscribe|marketing offer)(?:\W|$)/.test(lower)&&!/interview|application/.test(lower))return null;
  let category=null;
  if(/\b(interview (invitation|request|schedule|scheduled|availability)|schedule (a|your|an) (call|interview|screen)|screening (call|interview|request)|technical interview)\b/i.test(lower))category='interview';
  else if(/\b(unfortunately|not moving forward|other candidates|position has been filled|unable to proceed|we regret to inform|not selected)\b/i.test(lower)&&/application|position|role|candidate|interview/.test(lower))category='rejection';
  else if(/\b(application (received|submitted|confirmation|acknowledg)|thank you for applying|thanks for applying|we received your application|your application to)\b/i.test(lower))category='confirmation';
  else if(/\b(recruiter|hiring|your resume|your profile|following up on|regarding your application|job opportunity|we would like to speak)\b/i.test(lower)&&!/no.reply|noreply/.test(from))category='recruiter_reply';
  return category?{category,subject:subject.replace(/[\r\n]/g,' ').slice(0,240),sender:sender.replace(/[\r\n]/g,' ').slice(0,250),snippet:String(message.snippet||'').slice(0,400),thread:String(message.threadId||''),timestamp:message.internalDate?new Date(Number(message.internalDate)):new Date()}:null;
}
function formatAlert(event,candidateName,mailboxAddress){
  const title=({'interview':'Interview / screening request','rejection':'Application decision','confirmation':'Application confirmation','recruiter_reply':'Recruiter response'})[event.category]||'Candidate email update';
  const lines=[
    'BenchPilot AI · Candidate Gmail notification','',
    'Type: '+title,
    'Candidate: '+candidateName,
    'Candidate Gmail: '+mailboxAddress,
    'From: '+event.sender,
    'Subject: '+event.subject,
    'Received: '+new Date(event.received_at).toISOString(),
    '',
    'The original email remains in the candidate Gmail account.',
    'Sign in to BenchPilot for tracking; contact the candidate for any reply or action.',
    'No responses were sent to recruiters automatically.'
  ];
  return {subject:'[BenchPilot] '+title+' — '+candidateName,body:lines.join('\n')};
}
export async function sendMarketingAlert(sender,event,candidateName,mailboxAddress){
  const token=await gmailAccess(sender);
  const content=formatAlert(event,candidateName,mailboxAddress);
  const cleanHeader=(s)=>String(s).replace(/[\r\n]/g,' ').slice(0,250);
  const title='=?UTF-8?B?'+Buffer.from(cleanHeader(content.subject),'utf8').toString('base64')+'?=';
  const raw=['From: '+cleanHeader(sender.address),'To: '+cleanHeader(sender.address),'Subject: '+title,'MIME-Version: 1.0','Content-Type: text/plain; charset=UTF-8','',''+content.body].join('\r\n');
  const response=await fetch(GMAIL+'/messages/send',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({raw:Buffer.from(raw,'utf8').toString('base64url')}),signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw Error('Marketing Gmail sending failed with HTTP '+response.status);
  return response.json();
}
export async function syncMailboxes(sql){
  if(!googleConfigured())return {configured:false,processed:0,events:0,alerts:0};
  const mailboxes=await query(sql,"SELECT id,kind,candidate_id,address,refresh_token_enc,last_checked_at,status FROM bm_gmail_mailboxes WHERE kind='candidate' AND status='connected' ORDER BY last_checked_at ASC NULLS FIRST LIMIT 5");
  const [marketing]=await query(sql,"SELECT * FROM bm_gmail_mailboxes WHERE kind='marketing' AND status='connected' LIMIT 1");
  let processed=0,events=0,alerts=0,failures=0;
  for(const m of mailboxes){
    try{
      const started=new Date();
      const access=await gmailAccess(m);
      const after=Math.floor((new Date(m.last_checked_at||Date.now()).getTime()-60000)/1000);
      const messages=await gmailFetch(access,'/messages',{q:'in:inbox after:'+Math.max(0,after)+' -in:trash -in:spam',maxResults:'50'});
      for(const stub of messages.messages||[]){
        if(!stub.id)continue;
        const existed=await query(sql,"SELECT id FROM bm_gmail_events WHERE mailbox_id=$1 AND gmail_message_id=$2",[m.id,stub.id]);
        if(existed.length)continue;
        const full=await gmailFetch(access,'/messages/'+encodeURIComponent(stub.id),{format:'metadata'});
        const info=classifyMessage(full);
        if(!info)continue;
        const result=await query(sql,"INSERT INTO bm_gmail_events(mailbox_id,candidate_id,gmail_message_id,gmail_thread_id,category,sender,subject,snippet,received_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(mailbox_id,gmail_message_id) DO NOTHING RETURNING id",[m.id,m.candidate_id,stub.id,info.thread,info.category,info.sender,info.subject,info.snippet,info.timestamp]);
        events+=result.length;
      }
      if(messages.nextPageToken){
        await query(sql,"UPDATE bm_gmail_mailboxes SET last_error='Large inbox: only 50 recent messages checked. Sync again to inspect earlier messages.',updated_at=NOW() WHERE id=$1",[m.id]);
      }else{
        await query(sql,"UPDATE bm_gmail_mailboxes SET last_checked_at=$1,last_error=NULL,updated_at=NOW() WHERE id=$2",[started,m.id]);
      }
      processed++;
    }catch(e){
      failures++;
      await query(sql,"UPDATE bm_gmail_mailboxes SET last_error=$1,updated_at=NOW() WHERE id=$2",[String(e.message).slice(0,230),m.id]);
    }
  }
  if(marketing){
    const pending=await query(sql,"SELECT e.id,e.category,e.subject,e.sender,e.received_at,c.name AS candidate_name,m.address AS candidate_address FROM bm_gmail_events e JOIN bm_candidates c ON c.id=e.candidate_id JOIN bm_gmail_mailboxes m ON m.id=e.mailbox_id WHERE e.notified_at IS NULL ORDER BY e.received_at ASC LIMIT 18");
    for(const e of pending){
      try{
        const sent=await sendMarketingAlert(marketing,e,e.candidate_name,e.candidate_address);
        await query(sql,"UPDATE bm_gmail_events SET notified_at=NOW(),notify_error=NULL WHERE id=$1",[e.id]);alerts++;
      }catch(error){
        await query(sql,"UPDATE bm_gmail_events SET notify_error=$1 WHERE id=$2",[String(error.message).slice(0,220),e.id]);
        break;
      }
    }
  }
  return {configured:true,processed,events,alerts,failures,marketingConnected:!!marketing};
}