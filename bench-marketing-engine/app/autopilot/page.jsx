'use client';
import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {ArrowLeft,ArrowRight,ArrowUpRight,CheckCircle2,ChevronDown,Clock3,FileCheck2,FileText,Globe,Info,LoaderCircle,LockKeyhole,PauseCircle,Play,RefreshCw,Send,Settings2,ShieldCheck,Sparkles,Target,UploadCloud,Users,XCircle,Zap} from 'lucide-react';
import './autopilot.css';
const blank={candidates:[],jobs:[]};
const empty={profiles:[],applications:[],totals:[],filteredOut:0,sendingConfigured:false};
const cls=(s)=>s==='submitted'?'done':s==='blocked'||s==='needs_review'?'blocked':s==='ready'?'ready':'muted';
const statusTitle={
submitted:'Submitted — receipt recorded',ready:'Ready for authorized submission',blocked:'Blocked by eligibility policy',
needs_review:'Outcome requires manual verification',needs_profile:'Resume / applicant details missing',needs_consent:'Permission not confirmed',
needs_integration:'Employer submission integration unavailable',needs_details:'Full job details required',eligibility_review:'Eligibility requires review',paused:'Autopilot paused',low_match:'Below quality threshold',submitting:'Submitting',prepared:'Preparing'
};
const pick=(p)=>({applicant_email:p?.applicant_email||'',phone:p?.phone||'',linkedin_url:p?.linkedin_url||'',preferences:p?.preferences||'',submission_authorized:p?.submission_authorized===true,autopilot_enabled:p?.autopilot_enabled===true,min_score:Number(p?.min_score||80),daily_cap:Number(p?.daily_cap||5)});
export default function Autopilot(){
 const [base,setBase]=useState(blank),[data,setData]=useState(empty),[selected,setSelected]=useState(''),[form,setForm]=useState(pick(null)),[file,setFile]=useState(null),[loading,setLoading]=useState(true),[working,setWorking]=useState(false),[notice,setNotice]=useState(''),[error,setError]=useState(''),[statusFilter,setStatusFilter]=useState('all');
 const prof=data.profiles.find(p=>p.candidate_id===selected);
 const candidate=base.candidates.find(c=>c.id===selected);
 const items=data.applications.filter(a=>statusFilter==='all'||a.status===statusFilter);
 const count=(s)=>data.applications.filter(a=>a.status===s).length;
 async function load(initial=false){
  const [a,b]=await Promise.all([fetch('/api/state',{cache:'no-store'}),fetch('/api/autopilot',{cache:'no-store'})]);
  const one=await a.json(),two=await b.json();
  if(!a.ok||!b.ok)throw Error(one.error||two.error||'Could not read workspace');
  setBase(one);setData(two);
  if(initial){let id=one.candidates[0]?.id||'';setSelected(id);setForm(pick(two.profiles.find(p=>p.candidate_id===id)));}
  return {one,two};
 }
 useEffect(()=>{load(true).catch(e=>setError(e.message)).finally(()=>setLoading(false))},[]);
 function choose(id){setSelected(id);setForm(pick(data.profiles.find(p=>p.candidate_id===id)));setFile(null);setNotice('');setError('');}
 async function perform(action,custom){
  setWorking(true);setError('');setNotice('');
  try{
   let response=await fetch('/api/autopilot',{method:'POST',headers:{'Content-Type':'application/json','x-bench-request':'1'},body:JSON.stringify({action,...custom})});
   let body=await response.json();if(!response.ok)throw Error(body.error||'Request failed');
   const updated=await load();const current=updated.two.profiles.find(x=>x.candidate_id===selected);setForm(pick(current));
   if(action==='prepare')setNotice('Imported '+(body.discovery?.imported||0)+' new Dice jobs. Found '+body.prepared+' target-role applications; '+body.irrelevant+' unrelated job comparisons skipped.');
   else if(action==='submit')setNotice(body.submitted+' applications confirmed by employer ATS. '+body.needsReview+' require review.');
   else setNotice('Application preferences saved. Candidate permission and thresholds are now recorded.');
  }catch(e){setError(e.message);}finally{setWorking(false);}
 }
 async function upload(){
  if(!file||!selected)return;
  setWorking(true);setError('');setNotice('');
  try{
   const fields=new FormData();fields.set('candidate_id',selected);fields.set('resume',file);
   const response=await fetch('/api/autopilot/resume',{method:'POST',headers:{'x-bench-request':'1'},body:fields});
   const body=await response.json();if(!response.ok)throw Error(body.error||'Upload failed');
   await load();setNotice('PDF saved, '+body.characters+' characters extracted. Application matches refreshed.');setFile(null);
  }catch(e){setError(e.message)}finally{setWorking(false)}
 }
 const stages=[{id:'all',label:'All',count:data.applications.length},{id:'ready',label:'Ready',count:count('ready')},{id:'needs_integration',label:'Integration needed',count:count('needs_integration')},{id:'needs_profile',label:'Incomplete',count:count('needs_profile')},{id:'submitted',label:'Submitted',count:count('submitted')},{id:'blocked',label:'Blocked',count:count('blocked')},{id:'eligibility_review',label:'Review',count:count('eligibility_review')},{id:'needs_details',label:'Needs full JD',count:count('needs_details')},{id:'low_match',label:'Low match',count:count('low_match')}];
 return <div className="ap-shell">
  <aside className="ap-sidebar"><Link href="/" className="ap-logo"><span><Target size={22}/></span><strong>BenchPilot<em>AI</em></strong></Link><div className="ap-nav-title">WORKSPACE</div><Link href="/" className="ap-back"><ArrowLeft size={17}/> Command Center</Link><div className="ap-active"><Zap size={18}/> Auto Applications</div><div className="ap-side-bottom"><ShieldCheck size={19}/><p><b>Candidate-first automation</b><br/>Truthful evidence. Permission before submissions. Proof after every successful application.</p></div></aside>
  <main className="ap-main"><header className="ap-top"><div><span className="ap-dot"/> Application Agent <span className="ap-separator">/</span> Operations</div><span className="ap-private"><LockKeyhole size={13}/> Private workspace</span></header><div className="ap-container">
   <div className="ap-heading"><div><span className="ap-kicker"><Sparkles size={14}/> APPLICATION INTELLIGENCE</span><h1>Your job-application autopilot.</h1><p>Find the right jobs. Prepare accurate applications. Submit only through approved employer channels.</p></div><button className="ap-btn outline" disabled={working} onClick={()=>load().then(()=>setNotice('Latest records loaded')).catch(e=>setError(e.message))}><RefreshCw size={16} className={working?'ap-spin':''}/> Refresh</button></div>
   <div className="ap-hero"><div><span className="ap-tag"><Zap size={13}/> QUALITY OVER VOLUME</span><h2>Put applications on autopilot.<br/><span>Keep the decisions accountable.</span></h2><p>Only verified profiles with candidate permission can enter automatic submission. Every job is checked against resume evidence, eligibility and your quality threshold.</p></div><div className="ap-orbit"><Target size={66}/></div></div>
   {data.filteredOut>0&&<div className="ap-message success"><CheckCircle2 size={17}/>{data.filteredOut} unrelated historical records hidden from the active application queue. No applications or profiles were deleted.</div>}
   {error&&<div className="ap-message error"><XCircle size={17}/>{error}<button onClick={()=>setError('')}>Dismiss</button></div>}
   {notice&&<div className="ap-message success"><CheckCircle2 size={17}/>{notice}<button onClick={()=>setNotice('')}>Dismiss</button></div>}
   <div className="ap-stats"><div><span>Target-role application records</span><strong>{data.applications.length}</strong><small>Prepared and tracked</small></div><div><span>ATS-ready</span><strong>{count('ready')}</strong><small>Authorization required</small></div><div><span>Submitted</span><strong>{count('submitted')}</strong><small>Employer endpoint confirmed</small></div><div><span>Needs action</span><strong>{count('needs_profile')+count('needs_integration')+count('needs_review')+count('needs_consent')+count('needs_details')+count('eligibility_review')}</strong><small>Blocked or missing information</small></div></div>
   <div className="ap-layout"><section className="ap-card"><div className="ap-card-title"><span className="ap-card-icon"><Users size={19}/></span><div><h3>Candidate autopilot setup</h3><p>Each candidate needs an accurate profile and permission.</p></div></div>
     {loading?<div className="ap-empty"><LoaderCircle className="ap-spin"/> Loading profiles...</div>:base.candidates.length===0?<div className="ap-empty"><Users size={32}/><h3>Add your first candidate</h3><p>Start with a genuine candidate record. The application agent cannot apply for someone who has not been added.</p><Link href="/" className="ap-btn primary">Go to candidates <ArrowRight size={16}/></Link></div>:<div className="ap-form">
       <label>Candidate to configure<select value={selected} onChange={e=>choose(e.target.value)}>{base.candidates.map(c=><option key={c.id} value={c.id}>{c.name} — {c.role}</option>)}</select></label>
       <div className="ap-candidate-strip"><span className="ap-avatar">{candidate?.name?.split(/\s+/).slice(0,2).map(s=>s[0]).join('').toUpperCase()}</span><div><strong>{candidate?.name}</strong><small>{candidate?.role} · {candidate?.work_auth||'Work authorization not verified'}</small></div></div>
       <label>Candidate's application email<input type="email" value={form.applicant_email} placeholder="candidate@domain.com" onChange={e=>setForm({...form,applicant_email:e.target.value})}/></label>
       <div className="ap-two"><label>Phone number<input value={form.phone} placeholder="Verified candidate number" onChange={e=>setForm({...form,phone:e.target.value})}/></label><label>LinkedIn profile<input value={form.linkedin_url} placeholder="https://linkedin.com/in/..." onChange={e=>setForm({...form,linkedin_url:e.target.value})}/></label></div>
       <label>Upload candidate's original PDF resume<div className="ap-upload"><UploadCloud size={22}/><input id="resume" type="file" accept="application/pdf,.pdf" onChange={e=>setFile(e.target.files?.[0]||null)}/><span>{file?file.name:prof?.resume_filename?'Stored: '+prof.resume_filename:'Select a PDF resume (up to 2 MB)'}</span></div></label>
       <button className="ap-btn outline ap-upload-btn" disabled={!file||working} onClick={upload}>{working?<LoaderCircle className="ap-spin" size={16}/>:<FileText size={16}/>} Extract resume and store</button>
       <div className="ap-divider"/>
       <label>Minimum match-quality score <b>{form.min_score}%</b><input type="range" min="75" max="100" step="5" value={form.min_score} onChange={e=>setForm({...form,min_score:Number(e.target.value)})}/></label>
       <label>Maximum verified applications per candidate per day<select value={form.daily_cap} onChange={e=>setForm({...form,daily_cap:Number(e.target.value)})}>{[1,2,3,5,8,10,12].map(n=><option key={n} value={n}>{n} applications</option>)}</select></label>
       <label>Candidate restrictions and sponsorship requirements<textarea value={form.preferences} rows={3} placeholder="e.g. needs sponsorship, onsite only in New Jersey, no relocation" onChange={e=>setForm({...form,preferences:e.target.value})}/></label>
       <label className="ap-check"><input type="checkbox" checked={form.submission_authorized} onChange={e=>setForm({...form,submission_authorized:e.target.checked,autopilot_enabled:e.target.checked?form.autopilot_enabled:false})}/><span>I confirm this candidate expressly authorized applications to be submitted on their behalf using the verified information provided.</span></label>
       <label className="ap-check"><input type="checkbox" disabled={!form.submission_authorized} checked={form.autopilot_enabled} onChange={e=>setForm({...form,autopilot_enabled:e.target.checked})}/><span><b>Enable automatic submissions</b> when a supported employer integration exists and quality checks pass.</span></label>
       <button className="ap-btn primary wide" disabled={working} onClick={()=>perform('profile',{candidate_id:selected,...form})}>{working?<LoaderCircle size={16} className="ap-spin"/>:<ShieldCheck size={16}/>} Save candidate autopilot settings</button>
       <p className="ap-tiny"><Info size={14}/> A resume and candidate consent are required; the system never invents answers.</p>
     </div>}</section>
     <div className="ap-right"><section className="ap-card"><div className="ap-card-title"><span className="ap-card-icon blue"><Settings2 size={20}/></span><div><h3>Automation status</h3><p>What's running and what still needs a connection.</p></div></div><div className="ap-checklist">
     <div><CheckCircle2 className="green" size={18}/><span>Public job discovery and matching</span><b>Active</b></div>
     <div><CheckCircle2 className="green" size={18}/><span>Resume PDF extraction and grounding</span><b>Available</b></div>
     <div><CheckCircle2 className="green" size={18}/><span>Duplicate prevention and audit trail</span><b>Active</b></div>
     <div>{data.sendingConfigured?<CheckCircle2 className="green" size={18}/>:<PauseCircle size={18} className="amber"/>}<span>Direct employer ATS application access</span><b>{data.sendingConfigured?'Configured':'Not connected'}</b></div>
     </div><div className="ap-callout"><LockKeyhole size={16}/><span><b>No fake submission numbers.</b> A job is marked submitted only after an authorized employer ATS endpoint returns success. No LinkedIn scraping, bypassing CAPTCHAs, or invented experience.</span></div>
     <div className="ap-controls"><button className="ap-btn outline" disabled={working||!base.candidates.length} onClick={()=>perform('prepare',{candidate_id:selected})}><RefreshCw size={16}/> Find matches for selected candidate</button><button className="ap-btn primary" disabled={working||!data.sendingConfigured||!count('ready')} onClick={()=>perform('submit')}><Send size={16}/> Run eligible submissions</button></div>
     </section><section className="ap-card ap-how"><div className="ap-card-title"><span className="ap-card-icon green"><FileCheck2 size={19}/></span><div><h3>How autonomous applications work</h3><p>What happens after you set up each candidate.</p></div></div><div className="ap-steps">{[{n:'01',title:'Discover',sub:'Daily public job-feed scan looks for new vacancies'},{n:'02',title:'Qualify',sub:'Role, skills, authorization and resume facts checked'},{n:'03',title:'Prepare',sub:'Candidate-specific application text generated from evidence'},{n:'04',title:'Submit if authorized',sub:'Only supported employer integrations; missing answers stop submission'},{n:'05',title:'Record proof',sub:'Confirmed receipts, errors, and duplicate tracking'}].map(x=><div className="ap-step" key={x.n}><span>{x.n}</span><div><strong>{x.title}</strong><p>{x.sub}</p></div></div>)}</div></section></div>
   </div>
   <section className="ap-card ap-apps"><div className="ap-list-title"><div><h3>Application control center</h3><p>Real application decisions and verified submission outcomes.</p></div><span className="ap-total">{data.applications.length} relevant · {data.filteredOut||0} archived irrelevant</span></div><div className="ap-filters">{stages.map(x=><button key={x.id} className={statusFilter===x.id?'selected':''} onClick={()=>setStatusFilter(x.id)}>{x.label} <span>{x.count}</span></button>)}</div>
   {items.length?<div className="ap-table-wrap"><table><thead><tr><th>Candidate</th><th>Employer / role</th><th>Quality</th><th>Application status</th><th>Evidence</th><th>Job</th></tr></thead><tbody>{items.map(a=><tr key={a.id}><td><b>{a.candidate_name}</b></td><td><strong>{a.job_title}</strong><small>{a.company}</small></td><td><span className="ap-score">{a.quality_score}%</span></td><td><span className={'ap-status '+cls(a.status)}>{statusTitle[a.status]||a.status}</span></td><td><span title={a.last_error||a.reason}>{a.confirmation_ref||a.last_error||a.reason}</span></td><td>{a.job_url?<a href={a.job_url} target="_blank" rel="noopener noreferrer"><ArrowUpRight size={17}/></a>:'—'}</td></tr>)}</tbody></table></div>:<div className="ap-empty"><FileCheck2 size={34}/><h3>Nothing in this view yet</h3><p>Upload the candidate's verified resume, then click Find matches for selected candidate. Unrelated jobs will no longer appear here.</p></div>}
   </section><footer className="ap-footer">BenchPilot AI · Application outcomes are verified before they're counted. <span>No fake applicants. No fake submissions.</span></footer>
  </div></main>
 </div>;
}