'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {Activity,AlertCircle,ArrowLeft,ArrowRight,Bell,CheckCircle2,ChevronDown,Clock3,ExternalLink,Inbox,KeyRound,LockKeyhole,Mail,MailCheck,RefreshCw,ShieldCheck,Trash2,Users,XCircle} from 'lucide-react';
import './gmail.css';
const empty={googleConfigured:false,candidateMailboxes:[],marketingMailbox:null,events:[],pendingAlerts:0};
const types={interview:'Interview / screening',confirmation:'Application confirmed',recruiter_reply:'Recruiter response',rejection:'Application decision'};
function time(v){return v?new Date(v).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'Not yet'}
export default function GmailWorkspace(){
 const [data,setData]=useState(empty),[candidates,setCandidates]=useState([]),[selected,setSelected]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState('');
 async function refresh(init=false){
  const [state,mail]=await Promise.all([fetch('/api/state',{cache:'no-store'}),fetch('/api/gmail',{cache:'no-store'})]);
  const a=await state.json(),b=await mail.json();
  if(!state.ok||!mail.ok)throw Error(a.error||b.error||'Unable to load Gmail dashboard');
  setData(b);setCandidates(a.candidates||[]);
  if(init)setSelected(a.candidates?.[0]?.id||'');
  return b;
 }
 useEffect(()=>{refresh(true).catch(e=>setError(e.message)).finally(()=>setLoading(false));},[]);
 async function execute(action,args={}){
  setBusy(true);setError('');setNotice('');
  try{
   const r=await fetch('/api/gmail',{method:'POST',headers:{'x-bench-request':'1','Content-Type':'application/json'},body:JSON.stringify({action,...args})});
   const result=await r.json();
   if(!r.ok)throw Error(result.error||'Request failed');
   await refresh();
   setNotice(action==='sync'?'Scanned '+result.processed+' candidate inboxes; tracked '+result.events+' new relevant emails; sent '+result.alerts+' marketing alerts.':'Gmail mailbox disconnected. Monitoring stopped.');
  }catch(e){setError(e.message)}finally{setBusy(false)}
 }
 function connect(kind){
  if(!data.googleConfigured)return setError('Google OAuth is not configured. Follow the setup instructions below.');
  if(kind==='candidate'&&!selected)return setError('Choose a candidate to connect their Gmail.');
  window.location.assign('/api/gmail/start?kind='+kind+(kind==='candidate'?'&candidate_id='+encodeURIComponent(selected):''));
 }
 const selectedCandidate=candidates.find(c=>c.id===selected);
 const candidateMailbox=data.candidateMailboxes.find(m=>m.candidate_id===selected);
 const isConfigured=data.googleConfigured;
 const message=new URLSearchParams(typeof window!=='undefined'?window.location.search:'').get('gmail');
 const hints={connected:'Gmail connected. The original correspondence stays in its Google account.',denied:'Google permission was not granted.',setup:'Google OAuth configuration is required before connecting.',error:'Google sign-in failed. Confirm the authorized email and OAuth redirect settings.',invalid:'Unknown connection type.'};
 return <div className="gm-shell">
  <aside className="gm-side"><Link href="/" className="gm-logo"><span><Mail size={20}/></span>BenchPilot<b>AI</b></Link><div className="gm-side-label">WORKSPACE</div><Link href="/" className="gm-side-link"><ArrowLeft size={16}/> Overview</Link><Link href="/autopilot" className="gm-side-link"><Activity size={16}/> Auto Applications</Link><div className="gm-side-link active"><Inbox size={17}/> Gmail & Alerts</div><div className="gm-side-bottom"><ShieldCheck size={18}/><p>Candidate Gmail is read-only. Notification emails use your connected marketing Gmail. No recruiter replies are sent automatically.</p></div></aside>
  <main className="gm-main"><div className="gm-top"><span><span className="gm-indicator"/> BenchPilot / Gmail Intelligence</span><span className="gm-top-private"><LockKeyhole size={13}/> Private</span></div><div className="gm-content">
   <div className="gm-heading"><div><span className="gm-kicker"><Bell size={14}/> RESPONSE INTELLIGENCE</span><h1>Gmail connections & recruiter alerts</h1><p>Keep the original candidate correspondence in Gmail. Track important replies and notify your marketing team.</p></div><button className="gm-button secondary" disabled={busy} onClick={()=>refresh().then(()=>setNotice('Status refreshed')).catch(e=>setError(e.message))}><RefreshCw size={15}/> Refresh</button></div>
   {(message&&hints[message])&&<div className={'gm-banner '+(message==='connected'?'good':'warn')}><AlertCircle size={17}/>{hints[message]}</div>}
   {error&&<div className="gm-banner warn"><XCircle size={17}/>{error}<button onClick={()=>setError('')}>Dismiss</button></div>}
   {notice&&<div className="gm-banner good"><CheckCircle2 size={17}/>{notice}<button onClick={()=>setNotice('')}>Dismiss</button></div>}
   <div className="gm-metrics"><div><span>Candidate inboxes</span><strong>{data.candidateMailboxes.filter(m=>m.status==='connected').length}</strong><small>Read-only authorized connections</small></div><div><span>Recruiter email events</span><strong>{data.events.length}</strong><small>Recent detected messages</small></div><div><span>Alerts awaiting delivery</span><strong>{data.pendingAlerts}</strong><small>Waiting for marketing Gmail</small></div><div><span>Marketing Gmail</span><strong className="gm-text-state">{data.marketingMailbox?'Connected':'Not connected'}</strong><small>Sender and recipient of alerts</small></div></div>
   {!isConfigured&&<div className="gm-banner setup"><KeyRound size={20}/><div><strong>One-time Google OAuth setup needed</strong><p>Google OAuth client credentials have not been added to BenchPilot’s Vercel project. The secure workflow is installed, but Google has not authorized this application yet. Follow the setup card below; don't paste a client secret into candidate fields.</p></div></div>}
   <div className="gm-columns"><section className="gm-panel"><div className="gm-panel-head"><div className="gm-panel-icon"><Users size={21}/></div><div><h2>Connect a candidate Gmail</h2><p>The candidate signs into Google and grants read-only access.</p></div></div><div className="gm-panel-body">
    <label>Candidate<select value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Select candidate</option>{candidates.map(c=><option key={c.id} value={c.id}>{c.name} — {c.role}</option>)}</select></label>
    {selectedCandidate&&<div className="gm-candidate"><span>{selectedCandidate.name?.split(/\s+/).slice(0,2).map(a=>a[0]).join('')}</span><div><strong>{selectedCandidate.name}</strong><small>Application Gmail should match the saved candidate email</small></div></div>}
    {candidateMailbox?<><div className="gm-connected"><CheckCircle2 size={19}/><div><strong>{candidateMailbox.address}</strong><p>Last checked: {time(candidateMailbox.last_checked_at)}</p>{candidateMailbox.last_error&&<p className="gm-error">{candidateMailbox.last_error}</p>}</div></div><button className="gm-button outline" disabled={busy} onClick={()=>{if(window.confirm('Disconnect this Gmail and delete its tracked messages?'))execute('disconnect',{mailbox_id:candidateMailbox.id})}}><Trash2 size={15}/> Disconnect candidate Gmail</button></>:<button className="gm-button primary wide" onClick={()=>connect('candidate')} disabled={!selected||!isConfigured}><Mail size={16}/> Connect candidate Google account <ArrowRight size={16}/></button>}
    <p className="gm-footnote"><ShieldCheck size={15}/> The candidate retains ownership of the Gmail account. BenchPilot never needs the password and cannot send emails from candidate Gmail.</p>
   </div></section>
   <section className="gm-panel"><div className="gm-panel-head"><div className="gm-panel-icon blue"><Bell size={21}/></div><div><h2>Marketing inbox notifications</h2><p>Connect the Gmail address where you want alerts.</p></div></div><div className="gm-panel-body">
    <div className="gm-notify-card"><MailCheck size={23}/><div><strong>Alerts are sent to the connected marketing Gmail itself.</strong><p>Application confirmations, recruiter replies, interview requests and decisions are summarized. The original candidate email stays in their own inbox.</p></div></div>
    {data.marketingMailbox?<><div className="gm-connected"><CheckCircle2 size={18}/><div><strong>{data.marketingMailbox.address}</strong><p>Connected as the marketing alert inbox</p>{data.marketingMailbox.last_error&&<p className="gm-error">{data.marketingMailbox.last_error}</p>}</div></div><button className="gm-button outline" disabled={busy} onClick={()=>{if(window.confirm('Disconnect marketing Gmail? Future alert delivery will pause.'))execute('disconnect',{mailbox_id:data.marketingMailbox.id})}}><Trash2 size={15}/> Disconnect marketing Gmail</button></>:<button className="gm-button primary wide" disabled={!isConfigured} onClick={()=>connect('marketing')}><Bell size={16}/> Connect marketing Gmail <ArrowRight size={16}/></button>}
    <button className="gm-button secondary wide" disabled={busy||!data.candidateMailboxes.length} onClick={()=>execute('sync')}><RefreshCw size={16}/> Check inboxes and deliver alerts now</button>
    <p className="gm-footnote"><Clock3 size={15}/> Automatic checks run daily on the configured Vercel schedule. Manual checks can be run anytime; instant Gmail push notifications are not configured.</p>
   </div></section></div>
   <section className="gm-panel gm-events"><div className="gm-panel-head"><div className="gm-panel-icon green"><Inbox size={21}/></div><div><h2>Recruiter and application activity</h2><p>Detected messages only. No email content is changed or deleted.</p></div><button className="gm-button secondary" disabled={busy} onClick={()=>execute('sync')}><RefreshCw size={15}/> Sync</button></div>
    {data.events.length?<div className="gm-event-list">{data.events.map(e=><div className="gm-event" key={e.id}><div className="gm-event-icon"><Mail size={18}/></div><div className="gm-event-body"><strong>{types[e.category]||e.category} <span>· {e.candidate_name}</span></strong><p>{e.subject||'Untitled email'}</p><small>{e.sender}</small></div><div className="gm-event-right"><small>{time(e.received_at)}</small><span className={e.notified_at?'gm-alert-sent':'gm-alert-pending'}>{e.notified_at?'Marketing alerted':'Alert pending'}</span></div></div>)}</div>:<div className="gm-empty"><Inbox size={32}/><h3>No tracked recruiter messages yet</h3><p>Connect candidate Gmail and marketing Gmail. New relevant emails will appear here after a successful sync.</p></div>}
   </section>
   <section className="gm-panel gm-setup"><div className="gm-panel-head"><div className="gm-panel-icon"><KeyRound size={20}/></div><div><h2>Google Cloud OAuth setup</h2><p>One-time account authorization before you can connect mailboxes.</p></div></div><div className="gm-guide"><p>Enable the Gmail API in your Google Cloud project and create an OAuth 2.0 <strong>Web application</strong> client. Set the authorized redirect URI to:</p><code>https://benchpilot-ai.vercel.app/api/gmail/callback</code><p>Save its Client ID and Client Secret as encrypted production environment variables in Vercel:</p><code>GOOGLE_CLIENT_ID</code><code>GOOGLE_CLIENT_SECRET</code><p>The encryption key is already configured separately. Configure Google’s OAuth consent screen, add candidate and marketing Gmail accounts as test users during testing, and review Gmail restricted-scope verification requirements before wider use.</p><p><strong>Requested permissions:</strong> candidate Gmail — read-only plus verified email identity; marketing Gmail — send-only plus verified email identity.</p><a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer">Open Google Cloud credentials <ExternalLink size={15}/></a></div></section>
   <div className="gm-footer">BenchPilot AI · Secure mailbox synchronization <span>Connected candidates keep their original emails in Gmail.</span></div>
  </div></main>
 </div>;
}