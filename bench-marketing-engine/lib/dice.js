import {Client,StreamableHTTPClientTransport} from '@modelcontextprotocol/client';
const ENDPOINT='https://mcp.dice.com/mcp';
async function runDice(fn){
 const client=new Client({name:'benchpilot-dice-discovery',version:'1.0.0'},{versionNegotiation:{mode:'legacy'}});
 try{
  const transport=new StreamableHTTPClientTransport(new URL(ENDPOINT));
  await client.connect(transport);
  return await fn(client);
 }finally{await client.close().catch(()=>{});}
}
export async function inspectDice(){
 return runDice(async c=>{
   const response=await c.listTools();
   return (response.tools||[]).map(t=>({name:t.name,description:String(t.description||'').slice(0,180),schema:t.inputSchema}));
 });
}
export async function queryDice(search){
 return runDice(async c=>c.callTool({name:'search_jobs',arguments:search}));
}

const safe=(v,n=2000)=>String(v??'').trim().slice(0,n);
export async function scanDiceJobs(sql,keywords,perQuery=12){
 const words=[...new Set((keywords||[]).map(x=>safe(x,90)).filter(x=>x.length>=3))].slice(0,4);
 let queries=0,imported=0,failed=0;const errors=[];
 for(const keyword of words){
  try{
   const response=await queryDice({keyword,location:'United States',posted_date:'SEVEN',jobs_per_page:Math.min(20,Math.max(2,perQuery)),employment_types:['CONTRACTS','THIRD_PARTY']});
   if(response.isError)throw Error('Dice MCP job search returned an error');
   let data=response.structuredContent;
   if(!data?.data){
    const text=response.content?.find(c=>c.type==='text')?.text;
    try{data=JSON.parse(text||'{}')}catch{throw Error('Dice search returned unrecognized data')}
   }
   if(!Array.isArray(data.data))throw Error('Dice job search result missing jobs');
   for(const j of data.data.slice(0,Math.min(perQuery,20))){
    const external=safe(j.guid||j.id,100);
    const url=safe(j.detailsPageUrl,1000);
    if(!external||!/^https:\/\/(?:www\.)?dice\.com\/job-detail\//i.test(url)||!j.title||!j.companyName)continue;
    const body=[
      safe(j.summary,5000),
      'Listing summary only; verify full requirements, sponsorship, and third-party submission eligibility with employer.',
      'Type: '+safe(j.employmentType,120),
      'Employer type: '+safe(j.employerType,70),
      'Location: '+safe(j.jobLocation?.displayName,180),
      'Workplace: '+safe((j.workplaceTypes||[]).join(', '),150)
    ].join(' ');
    const stamp=/^\d{4}-\d\d-\d\d/.test(j.postedDate||'')?j.postedDate:null;
    await sql.query("INSERT INTO bm_jobs(source,external_id,company,title,location,description,url,posted_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(source,external_id) DO UPDATE SET title=EXCLUDED.title,location=EXCLUDED.location,description=EXCLUDED.description,url=EXCLUDED.url",['dice',external,safe(j.companyName,180),safe(j.title,250),safe(j.jobLocation?.displayName,180),body,url,stamp]);
    imported++;
   }
   queries++;
  }catch(e){failed++;errors.push(keyword+': '+safe(e.message,180));}
 }
 return {queries,imported,failed,errors};
}
