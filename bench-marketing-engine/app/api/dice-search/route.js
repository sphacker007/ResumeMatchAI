import {NextResponse} from 'next/server';
import {db,refreshMatches,log} from '../../../lib/server';
import {scanDiceJobs} from '../../../lib/dice';
import {prepareApplications} from '../../../lib/autopilot';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
export async function POST(request){
 try{
  if(request.headers.get('x-bench-request')!=='1'||request.headers.get('origin')!==new URL(request.url).origin)return NextResponse.json({error:'Unauthorized'},{status:403});
  const raw=await request.json();
  const keyword=String(raw.keyword||'Python Developer').trim().slice(0,70);
  if(keyword.length<3)return NextResponse.json({error:'Enter a job title or technical keyword'},{status:400});
  const sql=db();
  const scan=await scanDiceJobs(sql,[keyword],15);
  const matches=scan.imported?await refreshMatches(sql):0;
  const applications=scan.imported?await prepareApplications(sql):{prepared:0,ready:0,blocked:0};
  await log(sql,'dice','Manually searched Dice for '+keyword+'; recorded '+scan.imported+' public jobs.');
  return NextResponse.json({scan,matches,applications},{headers:{'Cache-Control':'no-store'}});
 }catch(e){console.error('Dice job search',e);return NextResponse.json({error:'Unable to search Dice job listings'},{status:500})}
}