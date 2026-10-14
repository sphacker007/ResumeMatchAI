import {NextResponse} from 'next/server';
import {db,query} from '../../../lib/server';
import {readPublicJobs,parseFeedToken} from '../../../lib/feeds';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){
 try{
  const sql=db();
  const sources=await query(sql,"SELECT company,token,last_scan,last_error FROM bm_sources WHERE enabled=true ORDER BY created_at DESC LIMIT 30");
  const byProvider=new Map();
  for(const source of sources){
   const type=parseFeedToken(source.token).provider;
   if(!byProvider.has(type))byProvider.set(type,source);
  }
  const tests=await Promise.all(Array.from(byProvider.entries()).map(async ([provider,source])=>{
   try{
    const feed=await readPublicJobs(source.token,2);
    return {provider,company:source.company,connection:'reachable',sampleJobs:feed.items.map(j=>({title:j.title,url:j.url}))};
   }catch(e){return {provider,company:source.company,connection:'error',error:String(e.message).slice(0,200)}}
  }));
  return NextResponse.json({sourcesConnected:sources.length,providers:tests,hasApplicationSubmissionCredential:!!(process.env.GREENHOUSE_JOB_BOARD_API_KEY&&process.env.GREENHOUSE_ALLOWED_BOARD),accountIntegrations:{linkedin:false,indeed:false,dice:false,workday:false},note:'Public listings do not authorize automated applications.'},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return NextResponse.json({error:'Unable to run source diagnostics'},{status:500})}
}