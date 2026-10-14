import {NextResponse} from 'next/server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const SAMPLE_PDF=["JVBERi0xLjcKJcK1wrYKCjEgMCBvYmoKPDwvVHlwZS9DYXRhbG9nL1BhZ2VzIDIgMCBSPj4KZW5kb2JqCgoyIDAgb2JqCjw8L1R5cGUvUGFnZXMvQ291bnQg",
"MS9LaWRzWzQgMCBSXT4+CmVuZG9iagoKMyAwIG9iago8PC9Gb250PDwvaGVsdiA1IDAgUj4+Pj4KZW5kb2JqCgo0IDAgb2JqCjw8L1R5cGUvUGFnZS9NZWRp",
"YUJveFswIDAgNTk1IDg0Ml0vUm90YXRlIDAvUmVzb3VyY2VzIDMgMCBSL1BhcmVudCAyIDAgUi9Db250ZW50c1s2IDAgUl0+PgplbmRvYmoKCjUgMCBvYmoK",
"PDwvVHlwZS9Gb250L1N1YnR5cGUvVHlwZTEvQmFzZUZvbnQvSGVsdmV0aWNhL0VuY29kaW5nL1dpbkFuc2lFbmNvZGluZz4+CmVuZG9iagoKNiAwIG9iago8",
"PC9MZW5ndGggMTAzL0ZpbHRlci9GbGF0ZURlY29kZT4+CnN0cmVhbQp42hWLsQ6DMAwFd3+F/6COg59BQh2QWLpV8lZ1SUvEAAML30/QTSfd0UFTUGJpJDZj",
"751jp8e6bCcn5aj8GTuFYUFGb4IBP1TvVFyQXD3DXJtl/FFRYCp32Y6M8vzGi+agN13pTRfuCmVuZHN0cmVhbQplbmRvYmoKCnhyZWYKMCA3CjAwMDAwMDAw",
"MDAgNjU1MzUgZiAKMDAwMDAwMDAxNiAwMDAwMCBuIAowMDAwMDAwMDYyIDAwMDAwIG4gCjAwMDAwMDAxMTQgMDAwMDAgbiAKMDAwMDAwMDE1NSAwMDAwMCBu",
"IAowMDAwMDAwMjYyIDAwMDAwIG4gCjAwMDAwMDAzNTEgMDAwMDAgbiAKCnRyYWlsZXIKPDwvU2l6ZSA3L1Jvb3QgMSAwIFIvSURbPEMzQTI1QkMzOTNDM0FG",
"MERDMkI1M0E3NTNGMUVDMkEwPjwxOEJCQjExM0FFMUMxQUU0REY4OEQzMjNDRjVDMEJENT5dPj4Kc3RhcnR4cmVmCjUyMgolJUVPRgo="].join('');
export async function GET(){
  try{
    await import('pdf-parse/worker');
    const {PDFParse}=await import('pdf-parse');
    const sample=Buffer.from(SAMPLE_PDF,'base64');
    const parser=new PDFParse({data:new Uint8Array(sample)});
    let result;
    try {
      result=await parser.getText();
    } finally {
      await parser.destroy();
    }
    if(!String(result.text||'').includes('BenchPilot parser smoke check'))throw new Error('PDF text could not be extracted');
    return NextResponse.json({pdfReader:'working',pages:result.total||result.pages?.length||1,test:'selectable text extracted',readsCandidateData:false},{headers:{'Cache-Control':'no-store'}});
  }catch(e){
    console.error('PDF parser smoke test failed',e);
    return NextResponse.json({pdfReader:'unavailable',error:String(e.message||e).slice(0,150)},{status:503});
  }
}