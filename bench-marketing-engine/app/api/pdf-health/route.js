import {NextResponse} from 'next/server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
function syntheticPdf(){
  const stream='BT /F1 14 Tf 45 700 Td (BenchPilot synthetic PDF extraction check) Tj ET';
  const objects=[
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Count 1 /Kids [3 0 R] >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Length '+stream.length+' >>\nstream\n'+stream+'\nendstream'
  ];
  let pdf='%PDF-1.4\n';
  const offsets=[];
  for(let i=0;i<objects.length;i++){
    offsets.push(Buffer.byteLength(pdf));
    pdf+=(i+1)+' 0 obj\n'+objects[i]+'\nendobj\n';
  }
  const start=Buffer.byteLength(pdf);
  pdf+='xref\n0 6\n0000000000 65535 f \n';
  for(const offset of offsets)pdf+=String(offset).padStart(10,'0')+' 00000 n \n';
  pdf+='trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n'+start+'\n%%EOF\n';
  return Buffer.from(pdf,'utf8');
}
export async function GET(){
  try{
    const mod=await import('pdf-parse/lib/pdf-parse.js');
    const parse=mod.default||mod;
    const result=await parse(syntheticPdf());
    const text=String(result.text||'');
    if(!text.includes('BenchPilot synthetic PDF extraction check'))throw Error('Extracted text does not match test input');
    return NextResponse.json({pdfReader:'working',pages:result.numpages,test:'synthetic PDF text extracted',readsCandidateData:false},{headers:{'Cache-Control':'no-store'}});
  }catch(error){
    console.error('PDF parser smoke test failed',error);
    return NextResponse.json({pdfReader:'unavailable',error:String(error.message||error).slice(0,220)},{status:503});
  }
}