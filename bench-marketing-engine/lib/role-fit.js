// Strict role relevance is the first gate before location and work-authorization checks.
// A job for a restaurant strategy manager must never enter a software engineer's queue.
const families={
 software: /\b(full[\s-]?stack|software (developer|engineer)|web developer|front[\s-]?end|back[\s-]?end|backend|frontend|node\.?js|python developer|java developer|react developer|application developer|javascript developer|typescript developer|software development engineer|\.net developer|programmer)\b/i,
 ai: /\b(ai\/?ml|machine learning|artificial intelligence|gen(?:erative)?\s*ai|llm|nlp|deep learning|mlops|computer vision|ai engineer|ml engineer|ai scientist|prompt engineer)\b/i,
 data: /\b(data scien(?:ce|tist)|data analyst|data engineer|analytics engineer|bi engineer|business intelligence|database developer|etl developer)\b/i,
 cloud: /\b(devops|site reliability|sre\b|cloud engineer|infrastructure engineer|platform engineer|kubernetes engineer)\b/i,
 support: /\b(mes\b|manufacturing execution|application support|technical support|production support|system support|support engineer|it support|desktop support|service desk|helpdesk|help desk|systems administrator)\b/i,
 qa: /\b(qa\b|quality assurance|quality engineer|software test|test engineer|sdet|test automation|automation testing)\b/i,
 security: /\b(cyber|security analyst|security engineer|soc analyst|information security|penetration tester)\b/i,
 supply: /\b(supply chain|logistics|procurement|inventory analyst|demand planning|operations research)\b/i,
 ux: /\b(ui\/?ux|product designer|ux designer|user experience|user interface|visual designer)\b/i
};
const executive=/\b(associate manager|marketing manager|marketing lead|sales (manager|director|representative)|account manager|business development|product manager|program manager|project manager|partnerships|merchant onboarding|restaurant growth|strategy & operations|pricing strategist|growth strategist|recruiter|talent acquisition|director of|vice president|chief of staff)\b/i;
const normalize=(v)=>String(v||'').toLowerCase().replace(/[^a-z0-9+#. ]+/g,' ').trim();
export function roleFamilies(title){
 const s=String(title||'');
 // Software roles sometimes explicitly require ML/AI too; preserve both tags.
 return Object.entries(families).filter(([,pattern])=>pattern.test(s)).map(([k])=>k);
}
export function roleRelevance(candidate,job) {
 const a=String(candidate.role||'').trim(),b=String(job.title||'').trim();
 if(!a||!b)return {relevant:false,reason:'Role/title missing'};
 const target=roleFamilies(a),opening=roleFamilies(b);
 if(executive.test(b)&&!executive.test(a))return {relevant:false,reason:'Non-target management or commercial role'};
 if(target.length&&opening.length){
   const overlap=target.filter(x=>opening.includes(x));
   // Software + AI or software + data is allowed only when explicitly in candidate role.
   if(overlap.length)return {relevant:true,family:overlap[0],confidence:'category'};
   return {relevant:false,reason:'Job title targets a different technical discipline'};
 }
 if(target.length&&!opening.length)return {relevant:false,reason:'Job title does not identify target discipline'};
 // For narrow niche roles, compare meaningful job-title terms.
 const stop=new Set(['senior','junior','lead','staff','principal','engineer','developer','analyst','specialist','associate','technician','consultant','professional','level','technical','software','full','time','remote','hybrid','on','site','ii','iii','iv']);
 const tokens=normalize(a).split(/\s+/).filter(w=>w.length>=3&&!stop.has(w));
 const btokens=new Set(normalize(b).split(/\s+/));
 const hits=tokens.filter(w=>btokens.has(w));
 return {relevant:hits.length>0,reason:hits.length?'Shared specialized job title':'No matching target-role terms',family:'other'};
}
export function jobLooksComplete(job){
 // Public boards may return short excerpts rather than the entire JD.
 return String(job.description||'').length>=450&&!/Listing summary only; verify full requirements/.test(String(job.description||''));
}
