import {NextResponse} from 'next/server';
import {db,query,refreshMatches,log} from '../../../lib/server';
import {scanDiceJobs} from '../../../lib/dice';
import {prepareApplications} from '../../../lib/autopilot';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
export async function GET(request){
 if(!process.env.CRON_SECRET||request.headers.get('authorization')!=='Bearer '+process.env.CRON_SECRET)return NextResponse.json({error:'Unauthorized scheduler'},{status:401});
 try{
  const sql=db();
  const candidates=await query(sql,"SELECT DISTINCT role FROM bm_candidates WHERE active=true ORDER BY role LIMIT 4");
  const keywords=candidates.length?candidates.map(c=>c.role):['Python Developer','AI ML Engineer','Data Scientist','Java Developer'];
  const scanned=await scanDiceJobs(sql,keywords,12);
  const matches=scanned.imported?await refreshMatches(sql):0;
  const applications=scanned.imported?await prepareApplications(sql):{prepared:0,ready:0,blocked:0};
  await log(sql,'dice','Dice MCP: '+scanned.imported+' public contract jobs from '+scanned.queries+' searches; '+matches+' matching opportunities evaluated.');
  return NextResponse.json({scanned,matches,applications},{headers:{'Cache-Control':'no-store'}});
 }catch(e){console.error('Dice cron',e);return NextResponse.json({error:'Dice discovery failed, see server logs'},{status:500})}
}