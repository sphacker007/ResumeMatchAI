import {NextResponse} from 'next/server';
import {inspectDice,queryDice} from '../../../lib/dice';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){
 try{
  const tools=await inspectDice();
  const search=tools.find(x=>x.name==='search_jobs');
  if(!search)return NextResponse.json({connected:true,tools:tools.map(t=>t.name),warning:'Search tool not available'},{headers:{'Cache-Control':'no-store'}});
  const request={keyword:'Python Developer',location:'United States',posted_date:'SEVEN',jobs_per_page:2};
  const response=await queryDice(request);
  return NextResponse.json({connected:true,tool:search,request,result:{isError:response.isError||false,structured:response.structuredContent||null,content:(response.content||[]).map(c=>({type:c.type,text:String(c.text||'').slice(0,5000)}))}},{headers:{'Cache-Control':'no-store'}});
 }catch(e){console.error('Dice MCP diagnostic failed',e);return NextResponse.json({connected:false,error:String(e.message).slice(0,300)},{status:503,headers:{'Cache-Control':'no-store'}})}
}