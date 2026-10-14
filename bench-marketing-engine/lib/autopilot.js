import {clean,query,matchCandidate,log} from './server';
const EXCLUDE=/\b(no (staffing )?agencies|no third[- ]party (candidates?|recruiters?|vendors?)|no vendors|no c2c|w2 only)\b/i;
export function evaluate(c,j,p){
 const score=matchCandidate(c,j);
 const jd=clean(j.description,16000);
 const blockers=[];
 if(score.flags)blockers.push(score.flags);
 const candidateLoc=clean(c.location,220).toLowerCase();
 const jobLoc=clean(j.location,220).toLowerCase();
 const remote=/remote|anywhere|united states|usa/.test(jobLoc);
 if(candidateLoc && jobLoc && !remote && !candidateLoc.split(/[,;/]/).map(x=>x.trim()).filter(x=>x.length>2).some(part=>jobLoc.includes(part)||part.includes(jobLoc)))blockers.push('Job location does not match the candidate location preferences.');
 const requestedYears=[...jd.matchAll(/(?:at least|minimum(?: of)?|requires?)?\s*(\d{1,2})\+?\s*years? (?:of )?(?:professional )?(?:experience|in)/gi)].map(m=>Number(m[1]));
 if(requestedYears.length&&Number(c.experience||0)>0&&Math.max(...requestedYears)>Number(c.experience)+1)blockers.push('Experience minimum exceeds verified years.');
 if(EXCLUDE.test(jd))blockers.push('The posting excludes staffing firm submissions.');
 if(/no sponsorship|unable to sponsor|will not sponsor/i.test(jd)&&/need sponsorship|require sponsorship/i.test(c.notes+' '+p.preferences))blockers.push('Sponsorship excluded.');
 const skills=clean(c.skills,4000).split(/[,;\n]/).map(s=>s.trim()).filter(Boolean);
 const verified=skills.filter(s=>clean(p.resume_text,50000).toLowerCase().includes(s.toLowerCase()));
 const relevant=verified.filter(s=>jd.toLowerCase().includes(s.toLowerCase()));
 const quality=Math.min(score.score,Math.round(relevant.length/Math.max(3,verified.length)*70+(score.score>=70?22:8)));
 const missing=[];
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.applicant_email||''))missing.push('candidate email');
 if(!p.resume_text||p.resume_text.length<150)missing.push('verified resume text');
 if(!p.resume_filename)missing.push('original PDF resume');
 if(c.name.trim().split(/\s+/).length<2)missing.push('full candidate name');
 let status='prepared',reason='';
 if(blockers.length){status='blocked';reason=blockers.join(' ');}
 else if(quality<Number(p.min_score||80)){status='low_match';reason='Quality score '+quality+' below threshold '+p.min_score;}
 else if(missing.length){status='needs_profile';reason='Missing '+missing.join(', ');}
 else if(!p.submission_authorized){status='needs_consent';reason='Candidate permission for submissions has not been confirmed.';}
 else if(!p.autopilot_enabled){status='paused';reason='Autopilot disabled for this candidate.';}
 else if(j.source==='greenhouse'&&process.env.GREENHOUSE_JOB_BOARD_API_KEY&&process.env.GREENHOUSE_ALLOWED_BOARD===String(j.external_id).split(':')[0]){status='ready';reason='Employer-authorized application API available.';}
 else {status='needs_integration';reason='No authorized application channel for this employer.';}
 const body='Dear Hiring Team,\n\nI am applying for the '+clean(j.title,170)+' position at '+clean(j.company,140)+'.\n\n'+(relevant.length?'My verified background includes '+relevant.slice(0,6).join(', ')+'.':'I would welcome the chance to discuss my relevant experience.')+'\n\nThank you for considering my application.\n\n'+clean(c.name,140);
 return {status,quality,reason,body};
}
export async function prepareApplications(sql,candidateId=null){
 const profiles=await query(sql,"SELECT c.*,p.applicant_email,p.phone,p.linkedin_url,p.resume_text,p.resume_filename,p.submission_authorized,p.autopilot_enabled,p.min_score,p.daily_cap,p.preferences FROM bm_candidates c JOIN bm_application_profiles p ON c.id=p.candidate_id WHERE c.active=true"+(candidateId?" AND c.id=$1":"")+" LIMIT 40",candidateId?[candidateId]:[]);
 const jobs=await query(sql,"SELECT * FROM bm_jobs ORDER BY created_at DESC LIMIT 160");
 let prepared=0,ready=0,blocked=0;
 for(const c of profiles)for(const j of jobs){
  const r=evaluate(c,j,c);
  if(r.quality<Math.max(50,c.min_score-25)&&r.status!=='blocked')continue;
  const rows=await query(sql,"SELECT id FROM bm_matches WHERE candidate_id=$1 AND job_id=$2",[c.id,j.id]);
  await query(sql,"INSERT INTO bm_applications(candidate_id,job_id,match_id,status,quality_score,reason,application_text,submission_channel) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(candidate_id,job_id) DO UPDATE SET status=CASE WHEN bm_applications.status IN ('submitted','submitting','needs_review') THEN bm_applications.status ELSE EXCLUDED.status END,reason=CASE WHEN bm_applications.status IN ('submitted','submitting','needs_review') THEN bm_applications.reason ELSE EXCLUDED.reason END,quality_score=EXCLUDED.quality_score,application_text=EXCLUDED.application_text,updated_at=NOW()",[c.id,j.id,rows[0]?.id||null,r.status,r.quality,r.reason,r.body,j.source]);
  prepared++;if(r.status==='ready')ready++;if(r.status==='blocked')blocked++;
 }
 if(prepared)await log(sql,'autopilot','Evaluated '+prepared+' opportunities; '+ready+' ATS-ready; '+blocked+' blocked.');
 return {prepared,ready,blocked};
}
async function sendToGreenhouse(c,j){
 const parts=String(j.external_id).split(':');
 if(parts.length!==2||!/^[\w-]+$/.test(parts[0])||!/^\d+$/.test(parts[1])||parts[0]!==process.env.GREENHOUSE_ALLOWED_BOARD||!process.env.GREENHOUSE_JOB_BOARD_API_KEY)throw Error('This employer board is not authorized for API submissions.');
 const url='https://boards-api.greenhouse.io/v1/boards/'+parts[0]+'/jobs/'+parts[1];
 const response=await fetch(url+'?questions=true',{signal:AbortSignal.timeout(10000),cache:'no-store'});
 if(!response.ok)throw Error('Unable to verify live application questions.');
 const detail=await response.json();
 if(!Array.isArray(detail.questions))throw Error('Required application questions unavailable.');
 const known=new Set(['first_name','last_name','email','phone','resume','cover_letter']);
 for(const question of detail.questions){if(question.required&&(!Array.isArray(question.fields)||question.fields.some(f=>!known.has(f.name))))throw Error('Custom required application questions need human review: '+clean(question.label,120));}
 if(!c.resume_base64)throw Error('No attached candidate PDF.');
 const names=c.name.trim().split(/\s+/);
 const form=new FormData();form.set('first_name',names.shift());form.set('last_name',names.join(' '));form.set('email',c.applicant_email);if(c.phone)form.set('phone',c.phone);
 form.set('resume',new Blob([Buffer.from(c.resume_base64,'base64')],{type:'application/pdf'}),c.resume_filename);
 const key=Buffer.from(process.env.GREENHOUSE_JOB_BOARD_API_KEY+':').toString('base64');
 const submitted=await fetch(url,{method:'POST',headers:{Authorization:'Basic '+key},body:form,signal:AbortSignal.timeout(20000)});
 if(!submitted.ok)throw Error('Employer ATS returned '+submitted.status);
 return 'Greenhouse HTTP '+submitted.status+' at '+new Date().toISOString();
}
export async function submitReady(sql,limit=5){
 const apps=await query(sql,"SELECT a.id,a.candidate_id,c.name,p.applicant_email,p.phone,p.resume_filename,p.daily_cap,j.source,j.external_id FROM bm_applications a JOIN bm_candidates c ON a.candidate_id=c.id JOIN bm_application_profiles p ON p.candidate_id=c.id JOIN bm_jobs j ON a.job_id=j.id WHERE a.status='ready' AND p.autopilot_enabled=true AND p.submission_authorized=true AND c.active=true ORDER BY a.quality_score DESC LIMIT $1",[Math.min(Math.max(Number(limit)||5,1),8)]);
 let submitted=0,needsReview=0,skipped=0;
 for(const a of apps){
  const daily=await query(sql,"SELECT count(*)::int AS n FROM bm_applications WHERE candidate_id=$1 AND status='submitted' AND submitted_at >= date_trunc('day',now())",[a.candidate_id]);
  if(Number(daily[0]?.n||0)>=a.daily_cap){skipped++;continue;}
  const claim=await query(sql,"UPDATE bm_applications SET status='submitting',updated_at=NOW() WHERE id=$1 AND status='ready' RETURNING id",[a.id]);if(!claim.length)continue;
  try{
   if(a.source!=='greenhouse')throw Error('No supported submission adapter.');
   const pdf=await query(sql,"SELECT encode(resume_file,'base64') AS bytes FROM bm_application_profiles WHERE candidate_id=$1",[a.candidate_id]);
   const receipt=await sendToGreenhouse({...a,resume_base64:pdf[0]?.bytes},a);
   await query(sql,"UPDATE bm_applications SET status='submitted',submitted_at=NOW(),confirmation_ref=$1,last_error='',reason='Employer ATS returned success',updated_at=NOW() WHERE id=$2",[receipt,a.id]);
   await query(sql,"INSERT INTO bm_application_attempts(application_id,outcome,detail) VALUES ($1,$2,$3)",[a.id,'submitted',receipt]);submitted++;
  }catch(e){
   const detail=clean(e.message,500);
   await query(sql,"UPDATE bm_applications SET status='needs_review',reason='Check ATS outcome before retry',last_error=$1,updated_at=NOW() WHERE id=$2",[detail,a.id]);
   await query(sql,"INSERT INTO bm_application_attempts(application_id,outcome,detail) VALUES ($1,$2,$3)",[a.id,'needs_review',detail]);needsReview++;
  }
 }
 if(submitted||needsReview)await log(sql,'submissions',submitted+' employer-confirmed; '+needsReview+' require review.');
 return {submitted,needsReview,skipped,examined:apps.length};
}