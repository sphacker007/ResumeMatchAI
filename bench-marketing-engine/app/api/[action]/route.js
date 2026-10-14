import { NextResponse } from 'next/server';
import { db,clean,query,log,refreshMatches,scanSources,draftMessage } from '../../../lib/server';
import {prepareApplications,submitReady} from '../../../lib/autopilot';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const ok=(data,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}});
const bad=(message,status=400)=>ok({error:message},status);
const uuid=(v)=>/^[a-f0-9-]{36}$/i.test(String(v||''));
const validEmail=(v)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v||''));
async function state(sql){
 const [candidates,sources,jobs,matches,contacts,outreach,events]=await Promise.all([
 query(sql,'SELECT * FROM bm_candidates ORDER BY created_at DESC LIMIT 100'),
 query(sql,'SELECT * FROM bm_sources ORDER BY created_at DESC LIMIT 50'),
 query(sql,'SELECT id,source,company,title,location,url,posted_at,created_at FROM bm_jobs ORDER BY created_at DESC LIMIT 200'),
 query(sql,'SELECT m.*,c.name AS candidate_name,c.role AS candidate_role,j.title AS job_title,j.company AS company,j.url AS job_url FROM bm_matches m JOIN bm_candidates c ON c.id=m.candidate_id JOIN bm_jobs j ON j.id=m.job_id ORDER BY m.score DESC,m.created_at DESC LIMIT 250'),
 query(sql,'SELECT * FROM bm_contacts ORDER BY created_at DESC LIMIT 150'),
 query(sql,'SELECT o.*,c.name AS candidate_name,j.title AS job_title,j.company AS company,t.email AS contact_email,t.name AS contact_name FROM bm_outreach o JOIN bm_matches m ON o.match_id=m.id JOIN bm_candidates c ON c.id=m.candidate_id JOIN bm_jobs j ON j.id=m.job_id LEFT JOIN bm_contacts t ON o.contact_id=t.id ORDER BY o.created_at DESC LIMIT 150'),
 query(sql,'SELECT * FROM bm_events ORDER BY created_at DESC LIMIT 15')
 ]);
 return {candidates,sources,jobs,matches,contacts,outreach,events,automation:{outboundSending:false,aiProviderConfigured:!!process.env.OPENAI_API_KEY,jobFeed:'Greenhouse / Lever / Ashby',cron:'daily'}};
}
export async function GET(request,{params}){
 try{
  const {action}=await params,sql=db();
  if(action==='state')return ok(await state(sql));
  if(action==='scan'){
   if(!process.env.CRON_SECRET||request.headers.get('authorization')!=='Bearer '+process.env.CRON_SECRET)return bad('Unauthorized cron',401);
   const scan=await scanSources(sql);const applications=await prepareApplications(sql);const submissions=await submitReady(sql,5);return ok({scan,applications,submissions});
  }
  return bad('Unknown action',404);
 }catch(e){console.error('GET API error',e);return bad('Server error. Check app configuration and logs.',500)}
}
export async function POST(request,{params}){
 try{
  const {action}=await params;
  if(request.headers.get('x-bench-request')!=='1'||request.headers.get('origin')!==new URL(request.url).origin)return bad('Request denied',403);
  const input=await request.json(),sql=db();
  if(action==='candidate'){
   const name=clean(input.name,120),role=clean(input.role,180),skills=clean(input.skills,2800),work_auth=clean(input.work_auth,160),location=clean(input.location,180),experience=Math.max(0,Math.min(50,Number(input.experience)||0));
   if(name.length<2||!role||!skills||!work_auth)return bad('Name, role, skills and work authorization are required.');
   const rows=await query(sql,'INSERT INTO bm_candidates(name,role,skills,work_auth,location,experience,notes) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id',[name,role,skills,work_auth,location,experience,clean(input.notes,2000)]);
   const matches=await refreshMatches(sql,rows[0].id);
   await log(sql,'candidate','Added '+name+' and evaluated '+matches+' matches.');
   return ok({created:true},201);
  }
  if(action==='source'){
   const slug=clean(input.token,120),company=clean(input.company,180),provider=clean(input.provider||'greenhouse',25).toLowerCase();
   if(!['greenhouse','lever','ashby'].includes(provider))return bad('Unsupported provider');
   if(!/^[a-zA-Z0-9_-]{2,120}$/.test(slug)||!company)return bad('Enter an official public career-board slug and company name.');
   const token=provider==='greenhouse'?slug:provider+':'+slug;
   await query(sql,'INSERT INTO bm_sources(company,token) VALUES ($1,$2) ON CONFLICT(token) DO UPDATE SET company=EXCLUDED.company,enabled=true',[company,token]);
   await log(sql,'source','Added '+provider+' read-only public job feed for '+company);
   return ok({created:true,provider},201);
  }
  if(action==='contact'){
   const address=clean(input.email,254).toLowerCase(),name=clean(input.name,140),company=clean(input.company,180);
   if(!validEmail(address)||!company)return bad('A valid email and company are required.');
   await query(sql,'INSERT INTO bm_contacts(name,email,company,source_url,verified) VALUES ($1,$2,$3,$4,false) ON CONFLICT(email) DO UPDATE SET name=EXCLUDED.name,company=EXCLUDED.company',[name,address,company,clean(input.source_url,1000)]);
   await log(sql,'contact','Added unverified recruiter contact: '+company);
   return ok({created:true},201);
  }
  if(action==='job'){
   const title=clean(input.title,230),company=clean(input.company,180),url=clean(input.url,1000),description=clean(input.description,12000);
   if(!title||!company||description.length<50)return bad('Title, company, and a JD of at least 50 characters are required.');
   if(url&&!/^https:\/\/[^\s]+$/i.test(url))return bad('Use an HTTPS job URL.');
   const id='manual:'+crypto.randomUUID();
   const rows=await query(sql,'INSERT INTO bm_jobs(source,external_id,company,title,location,description,url) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id',['manual',id,company,title,clean(input.location,180),description,url]);
   const matches=await refreshMatches(sql,null,rows[0].id);
   await log(sql,'job','Added a manually verified requirement at '+company+'; '+matches+' matches.');
   return ok({created:true},201);
  }
  if(action==='scan'){const scan=await scanSources(sql);const applications=await prepareApplications(sql);const submissions=await submitReady(sql,5);return ok({scan,applications,submissions});}
  if(action==='stage'){
   if(!uuid(input.id)||!['discovered','review','contacted','interested','screening','interview','closed','rejected'].includes(input.stage))return bad('Invalid stage');
   await query(sql,'UPDATE bm_matches SET stage=$1 WHERE id=$2',[input.stage,input.id]);
   await log(sql,'pipeline','Updated opportunity to '+input.stage);
   return ok({updated:true});
  }
  if(action==='draft'){
   if(!uuid(input.match_id))return bad('Select an opportunity');
   const rows=await query(sql,'SELECT m.id,c.name,c.role,c.skills,c.location,c.work_auth,j.title AS job_title,j.company AS job_company FROM bm_matches m JOIN bm_candidates c ON c.id=m.candidate_id JOIN bm_jobs j ON j.id=m.job_id WHERE m.id=$1',[input.match_id]);
   const match=rows[0];
   if(!match)return bad('Opportunity not found',404);
   if(!match.skills||!match.work_auth)return bad('Candidate profile is incomplete');
   const message=draftMessage(match,{title:match.job_title,company:match.job_company});
   let contact=null;
   if(uuid(input.contact_id)){
     const rows2=await query(sql,'SELECT id FROM bm_contacts WHERE id=$1 AND opt_out=false',[input.contact_id]);
     if(!rows2[0])return bad('Unknown or opted-out contact');
     contact=input.contact_id;
   }
   const created=await query(sql,'INSERT INTO bm_outreach(match_id,contact_id,subject,body) VALUES ($1,$2,$3,$4) RETURNING id',[match.id,contact,message.subject,message.body]);
   await log(sql,'outreach','Prepared an unsent draft for '+match.name);
   return ok({id:created[0].id},201);
  }
  if(action==='outreach'){
   if(!uuid(input.id))return bad('Invalid draft');
   const rows=await query(sql,'SELECT status FROM bm_outreach WHERE id=$1',[input.id]);
   if(!rows[0]||rows[0].status!=='draft')return bad('Only unsent drafts can be edited');
   await query(sql,'UPDATE bm_outreach SET subject=$1,body=$2,updated_at=NOW() WHERE id=$3',[clean(input.subject,300),clean(input.body,6000),input.id]);
   return ok({updated:true});
  }
  return bad('Unknown action',404);
 }catch(e){console.error('POST API error',e);return bad('Request failed. Check input or server logs.',500)}
}