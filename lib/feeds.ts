import {createHash} from "node:crypto";
import {readFileSync,writeFileSync,mkdirSync,renameSync} from "node:fs";
import {join} from "node:path";
import {parseScope} from "./geo";
import {catalog} from "./catalog";
import type {Job,Snapshot,SourceStatus} from "./types";
type Row=Record<string,any>;
type Feed={id:string; provider:string; url:string; ttl:number; init?:RequestInit; map:(data:any)=>Job[]};
const H=3600000;
const plain=(v:any)=>String(v??"").replace(/<[^>]*>/g," ").replace(/&[^;]+;/g," ").replace(/\s+/g," ").trim();
function job(source:string,r:Row):Job{
 const location=plain(r.location), elig=plain(r.eligibility);
 const date=new Date(r.posted||"");
 return {id:source+":"+r.id,title:plain(r.title),company:plain(r.company)||"Employer not specified",url:safeUrl(r.url),source,location:location||"Location not specified",remote:!!r.remote,posted:isNaN(date.getTime())?"":date.toISOString(),tags:(r.tags||[]).map(plain),scope:parseScope(location),eligibility:parseScope(elig),summary:plain(r.summary).slice(0,1200)};
}
function safeUrl(v:any){try{const u=new URL(v);return ["https:","http:"].includes(u.protocol)?u.href:""}catch{return ""}}
const list=(s:string|undefined)=>(s||"").split(",").map(x=>x.trim()).filter(x=>/^[a-zA-Z0-9_-]+$/.test(x)).slice(0,20);
export function feeds():Feed[]{
 const out:Feed[]=[
 {id:"remotive",provider:"remotive",url:"https://remotive.com/api/remote-jobs",ttl:6*H,map:d=>(d.jobs||[]).map((r:Row)=>job("remotive",{id:r.id,title:r.title,company:r.company_name,url:r.url,location:r.candidate_required_location,eligibility:r.candidate_required_location,remote:true,posted:r.publication_date,tags:[r.category],summary:r.description}))},
 {id:"remoteok",provider:"remoteok",url:"https://remoteok.com/api",ttl:H,map:d=>(Array.isArray(d)?d:[]).filter((r:Row)=>r.id&&r.position).map((r:Row)=>job("remoteok",{id:r.id,title:r.position,company:r.company,url:r.url,location:r.location,remote:true,posted:r.date,tags:r.tags,summary:r.description}))},
 {id:"arbeitnow",provider:"arbeitnow",url:"https://www.arbeitnow.com/api/job-board-api",ttl:H,map:d=>(d.data||[]).map((r:Row)=>job("arbeitnow",{id:r.slug,title:r.title,company:r.company_name,url:r.url,location:r.location,remote:r.remote,posted:r.created_at*1000,tags:r.tags,summary:r.description}))}
 ];
 if(process.env.MUSE_API_KEY) out.push({id:"muse",provider:"muse",url:"https://www.themuse.com/api/public/jobs?page=0&api_key="+encodeURIComponent(process.env.MUSE_API_KEY),ttl:H,map:d=>(d.results||[]).map((r:Row)=>job("muse",{id:r.id,title:r.name,company:r.company?.name,url:r.refs?.landing_page,location:(r.locations||[]).map((x:Row)=>x.name).join("; "),posted:r.publication_date,remote:(r.locations||[]).some((x:Row)=>/remote/i.test(x.name)),tags:(r.categories||[]).map((x:Row)=>x.name),summary:r.contents}))});
 for(const slug of list(process.env.GREENHOUSE_BOARDS)) out.push({id:"greenhouse:"+slug,provider:"greenhouse",url:`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`,ttl:H,map:d=>(d.jobs||[]).map((r:Row)=>job("greenhouse",{id:slug+":"+r.id,title:r.title,company:slug,url:r.absolute_url,location:r.location?.name,posted:r.updated_at,remote:/remote/i.test(r.location?.name||""),summary:r.content}))});
 for(const slug of list(process.env.LEVER_BOARDS)) out.push({id:"lever:"+slug,provider:"lever",url:`https://api.lever.co/v0/postings/${slug}?mode=json`,ttl:H,map:d=>(Array.isArray(d)?d:[]).map((r:Row)=>job("lever",{id:slug+":"+r.id,title:r.text,company:slug,url:r.hostedUrl,location:r.categories?.location,posted:r.createdAt,remote:r.workplaceType==="remote",tags:[r.categories?.team].filter(Boolean),summary:r.descriptionPlain}))});
 for(const slug of list(process.env.ASHBY_BOARDS)) out.push({id:"ashby:"+slug,provider:"ashby",url:`https://api.ashbyhq.com/posting-api/job-board/${slug}`,ttl:H,map:d=>(d.jobs||[]).filter((r:Row)=>r.isListed!==false).map((r:Row)=>job("ashby",{id:r.id||r.jobUrl,title:r.title,company:slug,url:r.jobUrl,location:[r.location,r.address?.postalAddress?.addressCountry,...(r.secondaryLocations||[]).flatMap((x:Row)=>[x.location,x.address?.postalAddress?.addressCountry])].filter(Boolean).join("; "),posted:r.publishedAt,remote:r.isRemote,summary:r.descriptionPlain}))});
 for(const slug of list(process.env.SMARTRECRUITERS_BOARDS)) out.push({id:"smartrecruiters:"+slug,provider:"smartrecruiters",url:`https://api.smartrecruiters.com/v1/companies/${slug}/postings?limit=100&offset=0&destination=PUBLIC`,ttl:H,map:d=>(d.content||[]).map((r:Row)=>job("smartrecruiters",{id:r.id,title:r.name,company:r.company?.name||slug,url:`https://jobs.smartrecruiters.com/${slug}/${r.id}`,location:[r.location?.city,r.location?.country?.toUpperCase()].filter(Boolean).join(", "),remote:r.location?.remote,posted:r.releasedDate}))});
 const market=(process.env.ADZUNA_COUNTRY||"gb").toLowerCase();
 if(process.env.ADZUNA_APP_ID&&process.env.ADZUNA_APP_KEY&&/^[a-z]{2}$/.test(market)) out.push({id:"adzuna:"+market,provider:"adzuna",url:`https://api.adzuna.com/v1/api/jobs/${market}/search/1?`+new URLSearchParams({app_id:process.env.ADZUNA_APP_ID,app_key:process.env.ADZUNA_APP_KEY,results_per_page:"50",what:process.env.FEED_KEYWORDS||"developer"}),ttl:6*H,map:d=>(d.results||[]).map((r:Row)=>job("adzuna",{id:r.id,title:r.title,company:r.company?.display_name,url:r.redirect_url,location:(r.location?.area||[r.location?.display_name]).filter(Boolean).join(", "),posted:r.created,summary:r.description}))});
 if(process.env.JOOBLE_API_KEY&&process.env.JOOBLE_ENABLED==="true") out.push({id:"jooble",provider:"jooble",url:"https://jooble.org/api/"+encodeURIComponent(process.env.JOOBLE_API_KEY),ttl:24*H,init:{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({keywords:process.env.FEED_KEYWORDS||"developer",location:process.env.JOOBLE_LOCATION||"United States",page:"1"})},map:d=>(d.jobs||[]).map((r:Row)=>job("jooble",{id:r.id,title:r.title,company:r.company,url:r.link,location:r.location,posted:r.updated,summary:r.snippet}))});
 if(process.env.USAJOBS_API_KEY&&process.env.USAJOBS_EMAIL) out.push({id:"usajobs",provider:"usajobs",url:"https://data.usajobs.gov/api/search?ResultsPerPage=100&Keyword="+encodeURIComponent(process.env.FEED_KEYWORDS||"developer"),ttl:6*H,init:{headers:{"User-Agent":process.env.USAJOBS_EMAIL,"Authorization-Key":process.env.USAJOBS_API_KEY}},map:d=>(d.SearchResult?.SearchResultItems||[]).map((x:Row)=>{const r=x.MatchedObjectDescriptor;return job("usajobs",{id:x.MatchedObjectId,title:r.PositionTitle,company:r.OrganizationName,url:r.PositionURI,location:(r.PositionLocation||[]).map((l:Row)=>[l.LocationName,l.CountryCode].filter(Boolean).join(", ")).join("; "),posted:r.PublicationStartDate,summary:r.QualificationSummary})})});
 if(process.env.RELIEFWEB_APPNAME) out.push({id:"reliefweb",provider:"reliefweb",url:"https://api.reliefweb.int/v2/jobs?"+new URLSearchParams({appname:process.env.RELIEFWEB_APPNAME}),ttl:6*H,init:{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({limit:100,sort:["date.created:desc"],fields:{include:["title","url","body","country.name","source.name","date.created"]},...(process.env.RELIEFWEB_COUNTRY?{filter:{field:"country.iso3",value:process.env.RELIEFWEB_COUNTRY.toLowerCase()}}:{})})},map:d=>(d.data||[]).map((x:Row)=>{const r=x.fields;return job("reliefweb",{id:x.id,title:r.title,company:(r.source||[]).map((a:Row)=>a.name).join(", "),url:r.url,location:(r.country||[]).map((a:Row)=>a.name).join("; "),posted:r.date?.created,summary:r.body})})});
 if(process.env.REED_API_KEY) out.push({id:"reed",provider:"reed",url:"https://www.reed.co.uk/api/1.0/search?"+new URLSearchParams({keywords:process.env.FEED_KEYWORDS||"developer",resultsToTake:"100"}),ttl:6*H,init:{headers:{Authorization:"Basic "+Buffer.from(process.env.REED_API_KEY+":").toString("base64")}},map:d=>(d.results||[]).map((r:Row)=>job("reed",{id:r.jobId,title:r.jobTitle,company:r.employerName,url:r.jobUrl,location:r.locationName,summary:r.jobDescription}))});
 return out;
}
type Entry={jobs:Job[]; next:number; fetched:number; status:string; detail:string};
type State={entries:Record<string,Entry>; attempts:Record<string,number[]>; lifetime:Record<string,number>};
const dir=process.env.DATA_DIR||join(process.cwd(),".data");
const file=join(dir,"feeds.json");
function load():State{try{const d=JSON.parse(readFileSync(file,"utf8"));if(!d.entries||!d.attempts||!d.lifetime)throw Error();return d}catch(e:any){if(e.code!=="ENOENT")throw new Error("Cannot read feed state; restore it before fetching to preserve quotas.");return {entries:{},attempts:{},lifetime:{}}}}
const globalState=globalThis as typeof globalThis & {atlas?:{state:State;pending?:Promise<Snapshot>}};
const shared=globalState.atlas??=( {state:load()} );
function save(){mkdirSync(dir,{recursive:true});writeFileSync(file+".tmp",JSON.stringify(shared.state));renameSync(file+".tmp",file)}
export function retryDelay(value:string|null,now=Date.now()){if(!value)return 15*60000;const n=Number(value);return Number.isFinite(n)?Math.max(60000,n*1000):Math.max(60000,(Date.parse(value)||now+15*60000)-now)}
function reserve(f:Feed){
 const now=Date.now(), scope=f.provider+":"+createHash("sha256").update(f.provider==="jooble"?process.env.JOOBLE_API_KEY||"":f.provider==="adzuna"?process.env.ADZUNA_APP_ID||"":"public").digest("hex").slice(0,16);
 const a=(shared.state.attempts[scope]||[]).filter(t=>now-t<31*24*H);
 const limits=f.provider==="adzuna"?[[60000,25],[24*H,250],[7*24*H,1000],[31*24*H,2500]]:f.provider==="remotive"?[[24*H,4],[60000,2]]:[];
 if(limits.some(([window,max])=>a.filter(t=>now-t<window).length>=max))throw Error("Local quota reached; cached results retained");
 if(f.provider==="jooble"&&(shared.state.lifetime[scope]||0)>=500)throw Error("Local Jooble lifetime budget exhausted");
 shared.state.attempts[scope]=[...a,now];shared.state.lifetime[scope]=(shared.state.lifetime[scope]||0)+1;
 save(); // Reserve before network, including failed calls.
}
async function refresh(f:Feed){
 let e=shared.state.entries[f.id];if(e&&e.next>Date.now())return;
 e??={jobs:[],next:0,fetched:0,status:"loading",detail:""};shared.state.entries[f.id]=e;
 e.next=Date.now()+f.ttl;
 try{
  reserve(f);
  const response=await fetch(f.url,{...f.init,headers:{Accept:"application/json",...f.init?.headers},signal:AbortSignal.timeout(18000),cache:"no-store",redirect:"error"});
  if(!response.ok){if(response.status===429||response.status===503)e.next=Math.max(e.next,Date.now()+retryDelay(response.headers.get("retry-after")));throw Error(`Provider returned HTTP ${response.status}`)}
  const raw=await response.json();
  const jobs=f.map(raw).filter(j=>j.title&&j.url);
  e.jobs=jobs;e.fetched=Date.now();e.status="connected";e.detail=f.provider==="remotive"?"Provider listings delayed by 24 hours":"Latest configured feed slice; see coverage";
 }catch(error){e.status=e.jobs.length?"stale":"unavailable";e.detail=error instanceof Error&&/^(Provider returned|Local )/.test(error.message)?error.message:"Could not retrieve feed; check server network and source configuration"}
 save();
}
async function collect():Promise<Snapshot>{
 const configured=feeds();
 // Three concurrent upstream requests; no per-viewer polling amplification.
 for(let i=0;i<configured.length;i+=3)await Promise.all(configured.slice(i,i+3).map(refresh));
 const sources:SourceStatus[]=configured.map(f=>{const e=shared.state.entries[f.id];return {id:f.id,name:catalog.find(c=>c.id===f.provider)!.name+(f.id.includes(":")?" · "+f.id.split(":")[1]:""),status:e.status,count:e.jobs.length,fetchedAt:e.fetched,nextFetch:e.next,detail:e.detail}});
 for(const c of catalog.filter(c=>c.implemented&&!configured.some(f=>f.provider===c.id)))sources.push({id:c.id,name:c.name,status:"not configured",count:0,fetchedAt:0,nextFetch:0,detail:"Add credentials or board slugs in .env.local"});
 const seen=new Set<string>();
 const jobs=configured.flatMap(f=>shared.state.entries[f.id]?.jobs||[]).filter(j=>{const k=j.url.split("?")[0];if(seen.has(k))return false;seen.add(k);return true}).sort((a,b)=>b.posted.localeCompare(a.posted));
 return {jobs,sources,updatedAt:Math.max(0,...sources.map(s=>s.fetchedAt))};
}
export function snapshot(){if(!shared.pending)shared.pending=collect().finally(()=>{shared.pending=undefined});return shared.pending}
