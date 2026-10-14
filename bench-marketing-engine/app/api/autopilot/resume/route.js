import {NextResponse} from 'next/server';
import {db,query,log} from '../../../../lib/server';
import {prepareApplications} from '../../../../lib/autopilot';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const respond=(body,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(request){
 if(request.headers.get('x-bench-request')!=='1'||request.headers.get('origin')!==new URL(request.url).origin)return respond({error:'Request denied'},403);
 try{
  const form=await request.formData();
  const candidate=String(form.get('candidate_id')||'');
  const upload=form.get('resume');
  if(!/^[0-9a-f-]{36}$/i.test(candidate)||!(upload instanceof File))return respond({error:'Candidate and PDF resume required'},400);
  if(!upload.name.toLowerCase().endsWith('.pdf')||upload.size<300||upload.size>2*1024*1024)return respond({error:'Upload a PDF resume smaller than 2 MB'},400);
  const bytes=Buffer.from(await upload.arrayBuffer());
  if(bytes.toString('ascii',0,5)!=='%PDF-')return respond({error:'File is not a valid PDF'},400);
  // Import the parser implementation directly. The package root can execute its bundled
  // debug/test entrypoint when evaluated by the Next.js server compiler.
  const parseModule=await import('pdf-parse/lib/pdf-parse.js');
  const parse=parseModule.default||parseModule;
  const parsed=await parse(bytes,{max:15});
  const text=String(parsed.text||'').replace(/\u0000/g,'').trim().slice(0,50000);
  if(text.length<150)return respond({error:'Text extraction failed. Use a searchable, text-based PDF resume.'},400);
  const sql=db();
  const saved=await query(sql,"INSERT INTO bm_application_profiles(candidate_id,resume_text,resume_file,resume_filename) VALUES($1,$2,decode($3,'base64'),$4) ON CONFLICT(candidate_id) DO UPDATE SET resume_text=EXCLUDED.resume_text,resume_file=EXCLUDED.resume_file,resume_filename=EXCLUDED.resume_filename,updated_at=NOW() RETURNING candidate_id",[candidate,text,bytes.toString('base64'),upload.name.slice(0,160)]);
  if(!saved.length)return respond({error:'Candidate not found'},404);
  // The upload is already committed; queue recalculation must never turn a
  // successful PDF upload into a misleading failure response.
  let prep={prepared:0,ready:0,blocked:0};
  let warning=null;
  try {
    prep=await prepareApplications(sql,candidate);
  } catch(queueError) {
    console.error('Resume saved but job match refresh failed',queueError);
    warning='Resume uploaded successfully. Job matching needs a retry.';
  }
  await log(sql,'resume','PDF resume uploaded and text extracted for candidate '+candidate+'.');
  return respond({uploaded:true,characters:text.length,filename:upload.name,warning,...prep});
   }catch(e){
    console.error('Resume upload failure',e);
    if(e?.code==='ENOENT')return respond({error:'Server PDF reader configuration failed. Please retry after deployment.'},500);
    return respond({error:'Resume processing failed. Please retry or use a searchable PDF under 2 MB.'},500);
  }
}