import {readPublicJobs} from './feeds';
import { neon } from '@neondatabase/serverless';
export function db() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured');
  return neon(process.env.DATABASE_URL);
}
export const clean = (v,n=3000) => String(v ?? '').trim().slice(0,n);
export const query = (sql,statement,params=[]) => sql.query(statement,params);
export function matchCandidate(candidate,job) {
  const description = (job.title + ' ' + job.description).toLowerCase();
  const auth = clean(candidate.work_auth).toLowerCase();
  const restricted = /\b(us citizens? only|must be (a )?u\.?s\.? citizen|us citizenship required|no opt\b|opt (is )?not (accepted|eligible)|green card holders? only|active (security )?clearance required|must have (active )?clearance)\b/i;
  if (/(opt|f.?1|student)/.test(auth) && restricted.test(description)) return {score:0,flags:'Explicit eligibility restriction — verify manually',explanation:'Job appears to exclude this work authorization or require clearance. Do not submit without verification.'};
  const skills=clean(candidate.skills,3000).split(/[,;\n]/).map(x=>x.trim().toLowerCase()).filter(x=>x.length>1).slice(0,32);
  const found=skills.filter(s=>description.includes(s)), missing=skills.filter(s=>!description.includes(s));
  const role=clean(candidate.role).toLowerCase().replace(/[^a-z0-9+#.]+/g,' ').split(/\s+/).filter(w=>w.length>3 && !['engineer','developer','analyst','senior','junior','specialist'].includes(w));
  const jobTitle=job.title.toLowerCase();
  const roleHits=role.filter(w=>jobTitle.includes(w)).length;
  const score=Math.min(95,Math.round((skills.length?found.length/skills.length:0)*70+(role.length?Math.min(1,roleHits/role.length)*25:0)+(found.length?5:0)));
  return {score,flags:'',explanation:(found.length?'Matched: '+found.slice(0,6).join(', '):'No confirmed skill overlap')+(missing.length?' · Check: '+missing.slice(0,4).join(', '):'')+'. Eligibility requires recruiter verification.'};
}
export async function log(sql,kind,detail){await query(sql,'INSERT INTO bm_events (kind,detail) VALUES ($1,$2)',[kind,detail]);}
export async function refreshMatches(sql, candidateId=null, jobId=null) {
  const candidates=await query(sql,candidateId?'SELECT * FROM bm_candidates WHERE id=$1 AND active=true':'SELECT * FROM bm_candidates WHERE active=true ORDER BY created_at DESC LIMIT 60',candidateId?[candidateId]:[]);
  const jobs=await query(sql,jobId?'SELECT * FROM bm_jobs WHERE id=$1':'SELECT * FROM bm_jobs ORDER BY created_at DESC LIMIT 250',jobId?[jobId]:[]);
  let count=0;
  for(const c of candidates) for(const j of jobs) {
    const r=matchCandidate(c,j);
    if(r.score<35 && !r.flags)continue;
    await query(sql,'INSERT INTO bm_matches(candidate_id,job_id,score,explanation,flags) VALUES ($1,$2,$3,$4,$5) ON CONFLICT(candidate_id,job_id) DO UPDATE SET score=EXCLUDED.score,explanation=EXCLUDED.explanation,flags=EXCLUDED.flags',[c.id,j.id,r.score,r.explanation,r.flags]);count++;
  }
  return count;
}
export function draftMessage(c,j) {
  return {subject:'Candidate availability | '+j.title+' — '+j.company,
   body:'Hello,\n\nI came across the '+j.title+' opening at '+j.company+'. We represent '+c.name+', a '+c.role+' professional whose stated experience may be relevant.\n\nCore skills: '+c.skills+'.\nLocation: '+c.location+'.\nWork authorization: '+c.work_auth+'.\n\nWould your team consider a staffing-agency candidate for this requirement? If so, I can share the approved resume and coordinate a discussion. Please confirm third-party submission and work-authorization eligibility.\n\nBest regards,\nTalent Marketing Team\n\nIf you prefer not to receive further messages, please let us know.'};
}
export async function scanSources(sql) {
 // Rotating least-recently-scanned boards avoids starving providers.
 const sources=await query(sql,"SELECT * FROM bm_sources WHERE enabled=true ORDER BY last_scan ASC NULLS FIRST,created_at ASC LIMIT 6");
 let processed=0,failed=0,scannedJobs=0,inserted=0;
 const errors=[];
 for(const source of sources){
   try{
    const {provider,slug,items}=await readPublicJobs(source.token,35);
    for(const j of items){
      const stamp=/^\d{4}-\d\d-\d\d/.test(j.updated||'')?j.updated:null;
      const result=await query(sql,"INSERT INTO bm_jobs(source,external_id,company,title,location,description,url,posted_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(source,external_id) DO UPDATE SET title=EXCLUDED.title,location=EXCLUDED.location,description=EXCLUDED.description,url=EXCLUDED.url RETURNING id",[
        provider,slug+':'+j.id,source.company,clean(j.title,240),clean(j.location,200),clean(j.description,14000),j.url,stamp
      ]);
      if(result.length)inserted++;
      scannedJobs++;
    }
    await query(sql,"UPDATE bm_sources SET last_scan=NOW(),last_error=NULL WHERE id=$1",[source.id]);
    processed++;
   }catch(e){
    errors.push(source.company+': '+clean(e.message,120));
    await query(sql,"UPDATE bm_sources SET last_scan=NOW(),last_error=$1 WHERE id=$2",[clean(e.message,300),source.id]);
    failed++;
   }
 }
 const matches=processed?await refreshMatches(sql):0;
 await log(sql,'scan','Scanned '+processed+' public job feeds, '+failed+' failed, processed '+scannedJobs+' current postings; evaluated '+matches+' matches.');
 return {sources:processed,failed,jobsProcessed:scannedJobs,upserted:inserted,matches,errors};
}