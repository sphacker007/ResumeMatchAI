"use client";

import { FormEvent, useEffect, useState } from "react";

type View = "Dashboard"|"AI Command"|"Sales"|"Inventory"|"Orders"|"Marketing"|"Finance"|"Customers"|"Intelligence"|"Experiments"|"Plans"|"Connections"|"Settings";
type Mode = "Ask"|"Plan"|"Act"|"Decide"|"Challenge"|"War Room";
type Goal = {id:string;title:string;target:string};
type Experiment = {id:string;title:string;note:string};

const nav: Array<[View,string]> = [
  ["Dashboard","▦"],["AI Command","✦"],["Sales","↗"],["Inventory","▣"],["Orders","≣"],
  ["Marketing","◎"],["Finance","₹"],["Customers","◉"],["Intelligence","◈"],["Experiments","⌬"],["Plans","⌖"]
];
const sources = [
  ["Shopify","Orders, products, customers and inventory"],
  ["Meta Ads","Spend, campaigns, creatives, CAC and ROAS"],
  ["Business Bank","Cash, inflows, outflows and runway"],
  ["Gmail","Business conversations and follow-ups"]
];

export default function Page(){
  const [view,setView]=useState<View>("Dashboard");
  const [coach,setCoach]=useState(false);
  const [mode,setMode]=useState<Mode>("Ask");
  const [prompt,setPrompt]=useState("");
  const [answer,setAnswer]=useState("");
  const [loading,setLoading]=useState(false);
  const [goals,setGoals]=useState<Goal[]>([]);
  const [experiments,setExperiments]=useState<Experiment[]>([]);
  const [modal,setModal]=useState<"goal"|"experiment"|null>(null);
  const [title,setTitle]=useState("");
  const [secondary,setSecondary]=useState("");

  useEffect(()=>{
    try{
      setGoals(JSON.parse(localStorage.getItem("ventora_goals")||"[]"));
      setExperiments(JSON.parse(localStorage.getItem("ventora_experiments")||"[]"));
    }catch{}
  },[]);
  useEffect(()=>{localStorage.setItem("ventora_goals",JSON.stringify(goals))},[goals]);
  useEffect(()=>{localStorage.setItem("ventora_experiments",JSON.stringify(experiments))},[experiments]);

  function openAI(m:Mode="Ask",seed=""){setMode(m);setPrompt(seed);setCoach(true)}
  async function ask(e:FormEvent){
    e.preventDefault(); if(!prompt.trim()) return; setLoading(true); setAnswer("");
    try{
      const r=await fetch("/api/coach",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({mode,prompt,context:{goals,experiments,connectedSources:[]}})});
      const d=await r.json(); setAnswer(d.text||d.message||"VENTORA AI is not configured yet.");
    }catch{setAnswer("VENTORA could not reach the AI service.");}
    setLoading(false);
  }
  function save(){
    if(!title.trim())return;
    if(modal==="goal")setGoals(v=>[...v,{id:crypto.randomUUID(),title:title.trim(),target:secondary.trim()}]);
    else setExperiments(v=>[...v,{id:crypto.randomUUID(),title:title.trim(),note:secondary.trim()}]);
    setTitle("");setSecondary("");setModal(null);
  }

  return <main className="app">
    <aside className="sidebar">
      <div className="brand"><div className="brandmark">V</div><div><b>VENTORA</b><span>AI Business OS</span></div></div>
      <div className="sideLabel">WORKSPACE</div>
      <nav>{nav.slice(0,8).map(([n,i])=><button key={n} className={view===n?"active":""} onClick={()=>setView(n)}><i>{i}</i><span>{n}</span>{view===n&&<em/>}</button>)}</nav>
      <div className="sideLabel">INTELLIGENCE</div>
      <nav>{nav.slice(8).map(([n,i])=><button key={n} className={view===n?"active":""} onClick={()=>setView(n)}><i>{i}</i><span>{n}</span>{view===n&&<em/>}</button>)}</nav>
      <div className="sidebarBottom">
        <button className={view==="Connections"?"active":""} onClick={()=>setView("Connections")}><i>↔</i><span>Connections</span></button>
        <button className={view==="Settings"?"active":""} onClick={()=>setView("Settings")}><i>⚙</i><span>Settings</span></button>
        <div className="owner"><div>SP</div><p><b>Shubham</b><span>Owner workspace</span></p><strong>›</strong></div>
      </div>
    </aside>

    <section className="workspace">
      <header className="topbar">
        <div className="search">⌕ <span>Search VENTORA...</span><kbd>⌘ K</kbd></div>
        <div className="topActions"><button>◌</button><button className="secure">◉ Private & locked</button></div>
      </header>
      <div className="content">
        {view==="Dashboard" && <Dashboard goals={goals} experiments={experiments} openAI={openAI} setView={setView}/>}
        {view==="AI Command" && <AICommand openAI={openAI}/>}
        {["Sales","Orders","Marketing","Finance","Customers"].includes(view) && <DataView title={view} setView={setView} openAI={openAI}/>}
        {view==="Inventory" && <Inventory setView={setView} openAI={openAI}/>}
        {view==="Intelligence" && <Intelligence openAI={openAI}/>}
        {view==="Experiments" && <Records kind="Experiments" items={experiments} add={()=>setModal("experiment")} ask={()=>openAI("Plan","Suggest three low-risk business experiments with clear success metrics.")}/>}
        {view==="Plans" && <Records kind="Plans" items={goals} add={()=>setModal("goal")} ask={()=>openAI("Plan","Turn my current business objective into a 90-day operating plan with weekly milestones.")}/>}
        {view==="Connections" && <Connections/>}
        {view==="Settings" && <SettingsView setView={setView}/>}
      </div>
    </section>

    <button className="askFloat" onClick={()=>openAI()}>✦ Ask VENTORA</button>

    {coach&&<div className="overlay" onClick={()=>setCoach(false)}><aside className="coach" onClick={e=>e.stopPropagation()}>
      <div className="coachHead"><div><div className="aiLogo">✦</div><p><b>VENTORA AI</b><span>Private executive reasoning</span></p></div><button onClick={()=>setCoach(false)}>×</button></div>
      <div className="modes">{(["Ask","Plan","Act","Decide","Challenge","War Room"] as Mode[]).map(m=><button key={m} className={mode===m?"on":""} onClick={()=>setMode(m)}>{m}</button>)}</div>
      <div className="coachBody">{!answer&&!loading&&<div className="coachWelcome"><div>◈</div><h2>{mode} mode</h2><p>VENTORA separates facts, assumptions and missing evidence before giving advice.</p><button onClick={()=>setPrompt("What should I focus on first based on the information currently available?")}>What should I focus on first?</button><button onClick={()=>setPrompt("Challenge my current business assumptions and show the risks.")}>Challenge my assumptions</button></div>}{loading&&<div className="thinking"><span/><b>VENTORA is reasoning…</b></div>}{answer&&<div className="answer">{answer}</div>}</div>
      <form className="composer" onSubmit={ask}><textarea value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder={"Use "+mode+" mode..."}/><button disabled={loading||!prompt.trim()}>→</button></form>
      <small className="coachFoot">VENTORA does not fabricate business metrics when data is missing.</small>
    </aside></div>}

    {modal&&<div className="modalOverlay" onClick={()=>setModal(null)}><div className="modal" onClick={e=>e.stopPropagation()}>
      <div className="modalHead"><div><span>{modal.toUpperCase()}</span><h2>{modal==="goal"?"New business goal":"New experiment"}</h2></div><button onClick={()=>setModal(null)}>×</button></div>
      <label>{modal==="goal"?"Goal":"Experiment name"}<input value={title} onChange={e=>setTitle(e.target.value)} autoFocus/></label>
      <label>{modal==="goal"?"Target / deadline":"Hypothesis"}<textarea value={secondary} onChange={e=>setSecondary(e.target.value)}/></label>
      <button className="primary full" onClick={save}>Save</button>
    </div></div>}
  </main>
}

function Dashboard({goals,experiments,openAI,setView}:{goals:Goal[];experiments:Experiment[];openAI:(m?:Mode,s?:string)=>void;setView:(v:View)=>void}){
  return <section>
    <div className="pageTitle"><div><span>EXECUTIVE CONTROL CENTER</span><h1>Business overview</h1><p>One place for operations, growth, money and AI decisions.</p></div><div className="headingActions"><button className="ghost" onClick={()=>setView("Connections")}>Connect data</button><button className="primary" onClick={()=>openAI("Ask")}>✦ Ask VENTORA</button></div></div>
    <div className="metricGrid">
      <Metric label="Revenue" hint="Connect Shopify or sales source" icon="₹"/>
      <Metric label="Net profit" hint="Connect finance data" icon="↗"/>
      <Metric label="Orders" hint="Connect commerce source" icon="▤"/>
      <Metric label="Ad efficiency" hint="Connect Meta Ads" icon="◎"/>
    </div>
    <div className="dashboardGrid">
      <article className="panel performance"><div className="panelHead"><div><span>PERFORMANCE</span><h2>Revenue & profit trend</h2></div><button>Last 30 days⌄</button></div><EmptyGraph/></article>
      <article className="panel aiBrief"><div className="panelHead"><div><span>AI CEO BRIEF</span><h2>Waiting for live business data</h2></div><div className="darkIcon">✦</div></div><p>VENTORA will summarize what changed, why it matters, risks and your next priorities after verified sources are connected.</p><div className="briefRows"><div><i>01</i><span><b>No fabricated insights</b><small>Recommendations only use real data or facts you provide.</small></span></div><div><i>02</i><span><b>Owner-controlled actions</b><small>High-impact changes require explicit approval.</small></span></div></div><button className="darkBtn" onClick={()=>openAI("Plan","Tell me exactly what business data you need first to build a reliable CEO briefing.")}>Prepare my data plan →</button></article>
    </div>
    <div className="lowerGrid">
      <article className="panel inventoryWatch"><div className="panelHead"><div><span>OPERATIONS</span><h2>Inventory watch</h2></div><button onClick={()=>setView("Inventory")}>Open inventory →</button></div><EmptyTable labels={["Product","Stock","Velocity","Status"]}/></article>
      <article className="panel priorities"><div className="panelHead"><div><span>EXECUTION</span><h2>Owner priorities</h2></div><button onClick={()=>setView("Plans")}>View plans →</button></div>{goals.length?goals.slice(0,3).map((g,i)=><div className="priority" key={g.id}><i>0{i+1}</i><span><b>{g.title}</b><small>{g.target||"Target not set"}</small></span></div>):<div className="emptySmall"><b>No priorities yet</b><span>Create a business goal and VENTORA will turn it into measurable work.</span><button onClick={()=>setView("Plans")}>Create goal</button></div>}</article>
      <article className="panel experimentsCard"><div className="panelHead"><div><span>EXPERIMENTS</span><h2>Growth lab</h2></div><button onClick={()=>setView("Experiments")}>Open lab →</button></div><div className="bigNumber">{experiments.length}</div><p>{experiments.length?"experiments saved":"No experiments running yet."}</p><button className="softBtn" onClick={()=>openAI("Plan","Suggest one low-risk growth experiment I can run first.")}>✦ Ask AI for a test</button></article>
    </div>
    <article className="panel dataCoverage"><div><span>DATA COVERAGE</span><h2>Build VENTORA&apos;s business brain</h2><p>Connect verified systems so every dashboard, forecast and recommendation is grounded in real information.</p></div><div className="coverage"><div><b>0%</b><span>Live data connected</span></div><button className="primary" onClick={()=>setView("Connections")}>Connect sources</button></div></article>
  </section>
}

function Metric({label,hint,icon}:{label:string;hint:string;icon:string}){return <article className="metric"><div className="metricTop"><span>{label}</span><i>{icon}</i></div><strong>—</strong><small>{hint}</small></article>}
function EmptyGraph(){return <div className="emptyGraph"><div className="gridLines"/><div className="emptyGraphMsg"><b>No live performance data</b><span>Connect a revenue source to populate this chart.</span></div><div className="xaxis"><span>Day 1</span><span>Day 10</span><span>Day 20</span><span>Today</span></div></div>}
function EmptyTable({labels}:{labels:string[]}){return <div className="emptyTable"><div className="tableHead">{labels.map(x=><span key={x}>{x}</span>)}</div><div className="tableEmpty"><b>No records yet</b><span>Verified data will appear here after a connection syncs.</span></div></div>}

function AICommand({openAI}:{openAI:(m:Mode,s?:string)=>void}){return <SectionTitle eyebrow="AI EXECUTIVE TEAM" title="AI Command" text="Ask, plan, decide, challenge assumptions, investigate problems and prepare approved actions."><div className="modeCards">{(["Ask","Plan","Act","Decide","Challenge","War Room"] as Mode[]).map(m=><button key={m} onClick={()=>openAI(m)}><i>✦</i><b>{m}</b><span>{modeText(m)}</span><strong>Open →</strong></button>)}</div></SectionTitle>}
function modeText(m:Mode){return {Ask:"Understand the business from evidence.",Plan:"Turn objectives into measurable execution.",Act:"Prepare approved actions and workflows.",Decide:"Compare options, downside and impact.",Challenge:"Expose weak assumptions and blind spots.","War Room":"Investigate urgent performance issues."}[m]}

function DataView({title,setView,openAI}:{title:View;setView:(v:View)=>void;openAI:(m:Mode,s?:string)=>void}){return <SectionTitle eyebrow="BUSINESS MODULE" title={title} text={"Real "+title.toLowerCase()+" intelligence will populate from verified connections."}><div className="moduleTop"><button className="primary" onClick={()=>setView("Connections")}>Connect data source</button><button className="ghost" onClick={()=>openAI("Plan","Design the "+title.toLowerCase()+" KPI framework and operating workflow I should use.")}>✦ Build framework with AI</button></div><div className="metricGrid three"><Metric label={title+" KPI 1"} hint="Waiting for source" icon="◈"/><Metric label={title+" KPI 2"} hint="Waiting for source" icon="◎"/><Metric label={title+" KPI 3"} hint="Waiting for source" icon="↗"/></div><article className="panel"><div className="panelHead"><div><span>{String(title).toUpperCase()}</span><h2>Operational records</h2></div><button>Export</button></div><EmptyTable labels={["Item","Performance","Change","Status"]}/></article></SectionTitle>}

function Inventory({setView,openAI}:{setView:(v:View)=>void;openAI:(m:Mode,s?:string)=>void}){return <SectionTitle eyebrow="OPERATIONS" title="Inventory" text="Stock, sell-through, days remaining, reorder points and supplier decisions."><div className="moduleTop"><button className="primary" onClick={()=>setView("Connections")}>Connect Shopify</button><button className="ghost" onClick={()=>openAI("Plan","Design my inventory policy: reorder points, safety stock, slow-moving alerts and cash protection.")}>✦ Build inventory policy</button></div><div className="metricGrid three"><Metric label="Inventory value" hint="Awaiting products" icon="₹"/><Metric label="Low stock SKUs" hint="Awaiting inventory" icon="!"/><Metric label="Sell-through" hint="Awaiting orders" icon="↗"/></div><article className="panel"><div className="panelHead"><div><span>STOCK CONTROL</span><h2>Products & inventory</h2></div><button>Filters ⚙</button></div><EmptyTable labels={["Product / SKU","On hand","Days left","Sell-through","Reorder","Status"]}/></article></SectionTitle>}

function Intelligence({openAI}:{openAI:(m:Mode,s?:string)=>void}){return <SectionTitle eyebrow="VENTORA INTELLIGENCE" title="Intelligence" text="Signals, forecasts, anomalies, opportunities and risks across every connected business system."><div className="intelligenceHero"><div><span>BUSINESS BRAIN</span><h2>Evidence first. Decisions second.</h2><p>VENTORA will combine commerce, advertising, finance and operational data into one reasoning layer.</p><button onClick={()=>openAI("Challenge","Challenge my current growth strategy using only facts I have provided. Clearly identify missing evidence.")}>Challenge my strategy →</button></div><div className="brain">◈</div></div><div className="signalGrid"><Signal title="Opportunities"/><Signal title="Risks"/><Signal title="Anomalies"/><Signal title="Forecasts"/></div></SectionTitle>}
function Signal({title}:{title:string}){return <article className="panel signal"><i>◇</i><h3>{title}</h3><p>Waiting for enough verified data.</p></article>}

function Records({kind,items,add,ask}:{kind:"Plans"|"Experiments";items:Array<Goal|Experiment>;add:()=>void;ask:()=>void}){return <SectionTitle eyebrow={kind==="Plans"?"OBJECTIVES → EXECUTION":"GROWTH LAB"} title={kind} text={kind==="Plans"?"Business outcomes, milestones and weekly commitments.":"Hypotheses, tests, success metrics and learning."}><div className="moduleTop"><button className="primary" onClick={add}>＋ Add {kind==="Plans"?"goal":"experiment"}</button><button className="ghost" onClick={ask}>✦ Build with AI</button></div>{items.length?<div className="recordGrid">{items.map(x=><article className="record" key={x.id}><i>{kind==="Plans"?"⌖":"⌬"}</i><span><small>{kind==="Plans"?"ACTIVE":"DRAFT"}</small><b>{x.title}</b><p>{"target" in x?(x.target||"No target set"):(x.note||"No hypothesis added")}</p></span></article>)}</div>:<article className="panel largeEmpty"><b>No {kind.toLowerCase()} yet</b><span>Create the first one yourself or let VENTORA help structure it.</span><button onClick={ask}>Ask VENTORA</button></article>}</SectionTitle>}

function Connections(){return <SectionTitle eyebrow="DATA LAYER" title="Connections" text="VENTORA never labels a system connected until authorization and a real sync succeed."><div className="connectorGrid">{sources.map(([name,desc])=><article key={name}><div className="connectorLogo">{name[0]}</div><span className="notConnected">Not connected</span><h3>{name}</h3><p>{desc}</p><button onClick={()=>alert(name+" connection workflow will be added using the provider's official authorization flow.")}>Set up connection →</button></article>)}</div><div className="securityBanner"><i>✓</i><div><b>Private by design</b><span>Provider tokens stay server-side. External write actions require explicit owner approval and an audit trail.</span></div></div></SectionTitle>}

function SettingsView({setView}:{setView:(v:View)=>void}){return <SectionTitle eyebrow="OWNER CONFIGURATION" title="Settings" text="Business context, security, approvals and AI behavior."><div className="settingsGrid"><article className="panel settingsCard"><span>BUSINESS PROFILE</span><h2>Company context</h2><label>Business name<input placeholder="Your business name"/></label><label>Industry<input placeholder="e.g. D2C apparel"/></label><label>Primary objective<textarea placeholder="What outcome matters most right now?"/></label><button className="primary">Save profile</button></article><article className="panel securityCard"><span>SECURITY</span><h2>Owner controls</h2><div><i>◉</i><p><b>Passkey / fingerprint</b><small>Production WebAuthn device-backed unlock.</small></p><em>Setup next</em></div><div><i>✓</i><p><b>Action approval policy</b><small>High-impact external actions require your approval.</small></p><em>Locked</em></div><div><i>↔</i><p><b>Connected systems</b><small>Manage data and action permissions.</small></p><button onClick={()=>setView("Connections")}>Manage</button></div></article></div></SectionTitle>}

function SectionTitle({eyebrow,title,text,children}:{eyebrow:string;title:string;text:string;children:React.ReactNode}){return <section><div className="pageTitle"><div><span>{eyebrow}</span><h1>{title}</h1><p>{text}</p></div></div>{children}</section>}
