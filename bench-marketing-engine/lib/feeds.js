// Job discovery adapters use documented, public read-only ATS feeds.
// They do not provide submission permission or accounts on any job platform.
const slugOK=/^[a-zA-Z0-9_-]{2,120}$/;
export function parseFeedToken(stored) {
  const value=String(stored||'');
  const match=value.match(/^(lever|ashby|greenhouse):(.+)$/i);
  const provider=match?match[1].toLowerCase():'greenhouse';
  const slug=match?match[2]:value;
  if(!slugOK.test(slug))throw Error('Invalid board token');
  return {provider,slug};
}
const plain=(input='')=>String(input||'').replace(/<script[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/&#39;|&apos;/gi,"'").replace(/&quot;/gi,'"').replace(/\s+/g,' ').trim().slice(0,14000);
const first=(...values)=>values.find(x=>typeof x==='string'&&x.trim())||'';
const goodUrl=(url)=>/^https:\/\/[a-z0-9.-]+(?:\/|$)/i.test(String(url))?String(url).slice(0,1300):'';
async function jsonFeed(url) {
 const res=await fetch(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(12000),cache:'no-store'});
 if(!res.ok)throw Error('Provider HTTP '+res.status);
 const result=await res.json();
 if(!result)throw Error('Empty provider response');
 return result;
}
export async function readPublicJobs(token,max=35){
 const {provider,slug}=parseFeedToken(token);
 let items=[];
 if(provider==='greenhouse'){
  const data=await jsonFeed('https://boards-api.greenhouse.io/v1/boards/'+encodeURIComponent(slug)+'/jobs?content=true');
  if(!Array.isArray(data.jobs))throw Error('Unexpected Greenhouse response');
  items=data.jobs.map(j=>({
    id:String(j.id||''),title:j.title,description:plain(j.content),
    location:first(j.location?.name),url:goodUrl(j.absolute_url),
    updated:j.updated_at
  }));
 }else if(provider==='lever'){
  const data=await jsonFeed('https://api.lever.co/v0/postings/'+encodeURIComponent(slug)+'?mode=json&limit=100');
  if(!Array.isArray(data))throw Error('Unexpected Lever response');
  items=data.map(j=>({
   id:String(j.id||''),title:j.text,description:plain(first(j.descriptionPlain,j.description,j.additionalPlain,j.additional)),
   location:first(j.categories?.location,j.categories?.allLocations?.join(', '),j.workplaceType),
   url:goodUrl(j.hostedUrl||j.applyUrl),updated:null
  }));
 }else if(provider==='ashby'){
  const data=await jsonFeed('https://api.ashbyhq.com/posting-api/job-board/'+encodeURIComponent(slug));
  if(!Array.isArray(data.jobs))throw Error('Unexpected Ashby response');
  items=data.jobs.filter(j=>j.isListed!==false).map(j=>({
   id:String(j.id||j.jobUrl||''),title:j.title,description:plain(first(j.descriptionPlain,j.descriptionHtml,j.description)),
   location:first(j.location,j.secondaryLocations?.map(x=>x.location).join(', ')),
   url:goodUrl(j.jobUrl||j.applyUrl),updated:j.publishedAt||null
  }));
 }
 // Limit writes per invocation and reject invalid/outside provider URLs.
 return {provider,slug,items:items.filter(j=>j.id&&j.title&&j.url&&j.description).slice(0,max)};
}
