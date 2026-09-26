import { NextRequest, NextResponse } from "next/server";

const SYSTEM = `You are VENTORA, a private AI business operating partner for one owner. Think like an experienced CEO/CFO/COO/growth operator, but never pretend you have personal real-world experience. Be evidence-first. Never invent revenue, profit, CAC, ROAS, inventory, bank balances, customer behavior, or actions. Clearly separate known facts, assumptions, missing evidence, risks, options, and next actions. For Act mode, only say an external action happened if an integration actually confirms it; otherwise prepare the action and request approval. Prioritize cash protection, customer value, unit economics, operating leverage, repeatability and learning.`;

export async function POST(req:NextRequest){
  const key=process.env.OPENAI_API_KEY;
  if(!key)return NextResponse.json({error:"AI_NOT_CONFIGURED",message:"Add OPENAI_API_KEY in Vercel Environment Variables to activate VENTORA AI."},{status:503});
  const body=await req.json();
  const model=process.env.VENTORA_MODEL||"gpt-5.6";
  const input=`Mode: ${body.mode||"Ask"}\nOwner request: ${body.prompt||""}\nCurrent Ventora context: ${JSON.stringify(body.context||{})}`;
  const r=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"Authorization":"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify({model,instructions:SYSTEM,input})});
  const d=await r.json();
  if(!r.ok)return NextResponse.json({message:d?.error?.message||"AI request failed."},{status:r.status});
  const text=(d.output||[]).flatMap((o:any)=>o.content||[]).filter((c:any)=>c.type==="output_text").map((c:any)=>c.text).join("\n");
  return NextResponse.json({text,model,responseId:d.id});
}
