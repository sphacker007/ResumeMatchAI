import {NextResponse} from 'next/server';
import {db,query,clean,log} from '../../../lib/server';
import {prepareApplications,submitReady,evaluate} from '../../../lib/autopilot';
import {roleRelevance} from '../../../lib/role-fit';
import {scanDiceJobs} from '../../../lib/dice';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export const maxDuration=60;
const ok=(x,status=200)=>NextResponse.json(x,{status,headers:{'Cache-Control':'no-store'}});
const bad=(s,status=400)=>ok({error:s},status);
const isUuid=(s)=>/^[0-9a-f-]{36}$/i.test(String(s||''));
export async function GET(){
 try{
 const sql=db();
 const [profiles,apps,totals]=await Promise.all([
  query(sql,"SELECT candidate_id,applicant_email,phone,linkedin_url,substring(resume_text,1,10000) AS resume_text,resume_filename,submission_authorized,autopilot_enabled,min_score,daily_cap,preferences,updated_at FROM bm_application_profiles ORDER BY updated_at DESC LIMIT 100"),
  query(sql,"SELECT a.id,a.candidate_id,a.job_id,a.status,a.quality_score,a.reason,a.application_text,a.submission_channel,a.submitted_at,a.confirmation_ref,a.last_error,a.updated_at,c.name AS candidate_name,c.role AS candidate_role,j.title AS job_title,j.company,j.url AS job_url FROM bm_applications a JOIN bm_candidates c ON c.id=a.candidate_id JOIN bm_jobs j ON j.id=a.job_id ORDER BY a.created_at DESC LIMIT 750"),
  query(sql,"SELECT status,count(*)::int AS count FROM bm_applications GROUP BY status")
 ]);
 const visible=apps.filter(a=>roleRelevance({role:a.candidate_role},{title:a.job_title}).relevant || ['submitted','submitting','needs_review'].includes(a.status));
 const filteredOut=apps.length-visible.length;
 const pending=visible.filter(a=>!['submitted','submitting','needs_review'].includes(a.status)).map(a=>a.id);
 if(pending.length){
  const details=await query(sql,"SELECT a.id AS application_id,c.name,c.role,c.skills,c.work_auth,c.location,c.experience,c.notes,j.title,j.description,j.location AS job_location,j.company,j.source,j.external_id,p.applicant_email,p.resume_text,p.resume_filename,p.submission_authorized,p.autopilot_enabled,p.min_score,p.preferences FROM bm_applications a JOIN bm_candidates c ON c.id=a.candidate_id JOIN bm_jobs j ON j.id=a.job_id JOIN bm_application_profiles p ON p.candidate_id=c.id WHERE a.id=ANY($1::uuid[]) LIMIT 120",[pending]);
  const current=new Map(details.map(row=>{const candidate={name:row.name,role:row.role,skills:row.skills,work_auth:row.work_auth,location:row.location,experience:row.experience,notes:row.notes};const job={title:row.title,description:row.description,location:row.job_location,company:row.company,source:row.source,external_id:row.external_id};return [row.application_id,evaluate(candidate,job,row)];}));
  for(const item of visible){const updated=current.get(item.id);if(updated){item.status=updated.status;item.quality_score=updated.quality;item.reason=updated.reason;item.application_text=updated.body;}}
 }
 return ok({profiles,applications:visible,totals,filteredOut,sendingConfigured:!!(process.env.GREENHOUSE_JOB_BOARD_API_KEY&&process.env.GREENHOUSE_ALLOWED_BOARD),supportedChannel:'Employer-authorized Greenhouse API only'});
 }catch(e){console.error('Autopilot state',e);return bad('Unable to read autopilot state',500)}
}
export async function POST(request){
 try{
 if(request.headers.get('x-bench-request')!=='1'||request.headers.get('origin')!==new URL(request.url).origin)return bad('Request denied',403);
 const sql=db(),p=await request.json(),action=p.action;
 if(action==='profile'){
  if(!isUuid(p.candidate_id))return bad('Select a valid candidate');
  const users=await query(sql,"SELECT id FROM bm_candidates WHERE id=$1 AND active=true",[p.candidate_id]);if(!users.length)return bad('Candidate does not exist.');
  const applicant_email=clean(p.applicant_email,254),phone=clean(p.phone,80),linkedin_url=clean(p.linkedin_url,800),preferences=clean(p.preferences,1500);
  const consent=p.submission_authorized===true;
  const enabled=p.autopilot_enabled===true;
  if(enabled&&!consent)return bad('Candidate-specific permission must be confirmed before automation can be enabled.');
  if(applicant_email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(applicant_email))return bad('Use a valid candidate email.');
  const minScore=Math.max(75,Math.min(100,Number(p.min_score)||80));
  const dailyCap=Math.max(1,Math.min(12,Number(p.daily_cap)||5));
  await query(sql,"INSERT INTO bm_application_profiles(candidate_id,applicant_email,phone,linkedin_url,submission_authorized,autopilot_enabled,min_score,daily_cap,preferences) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(candidate_id) DO UPDATE SET applicant_email=EXCLUDED.applicant_email,phone=EXCLUDED.phone,linkedin_url=EXCLUDED.linkedin_url,submission_authorized=EXCLUDED.submission_authorized,autopilot_enabled=EXCLUDED.autopilot_enabled,min_score=EXCLUDED.min_score,daily_cap=EXCLUDED.daily_cap,preferences=EXCLUDED.preferences,updated_at=NOW()",[p.candidate_id,applicant_email,phone,linkedin_url,consent,enabled,minScore,dailyCap,preferences]);
  const queued=await prepareApplications(sql,p.candidate_id);
  await log(sql,'autopilot', 'Updated consent and quality preferences for candidate '+p.candidate_id+'.');
  return ok({saved:true,...queued});
 }
 if(action==='prepare'){
  const cid=isUuid(p.candidate_id)?p.candidate_id:null;
  const targets=await query(sql,'SELECT DISTINCT role FROM bm_candidates WHERE active=true'+(cid?' AND id=$1':'')+' LIMIT 3',cid?[cid]:[]);
  const discovery=targets.length?await scanDiceJobs(sql,targets.map(c=>c.role),10):{imported:0,queries:0};
  const result=await prepareApplications(sql,cid);
  return ok({...result,discovery});
 }
 if(action==='submit'){
  // Explicitly enabled candidate profiles plus an employer-provided credential are both mandatory.
  if(!process.env.GREENHOUSE_JOB_BOARD_API_KEY||!process.env.GREENHOUSE_ALLOWED_BOARD)return bad('No employer-authorized ATS submission integration is configured.');
  return ok(await submitReady(sql,5));
 }
 return bad('Unsupported action',404);
 }catch(e){console.error('Autopilot action',e);return bad('Action failed. Check workspace configuration.',500)}
}