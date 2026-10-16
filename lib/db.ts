import {Pool} from "pg";
import type {Job,StatusEntry} from "./types";
export type Entry={jobs:Job[];next:number;fetched:number;status:string;detail:string};
export type StoreState={entries:Record<string,Entry>;attempts:Record<string,number[]>;lifetime:Record<string,number>;statuses:Record<string,StatusEntry>};
let pool:Pool|undefined,schema:Promise<Pool>|undefined;
export function pgEnabled(){return !!process.env.DATABASE_URL}
// An sslmode/ssl query param in the URL would override the explicit ssl option; DATABASE_SSL owns it.
function connStr(){const cs=process.env.DATABASE_URL||"";if(process.env.DATABASE_SSL!=="true")return cs;try{const u=new URL(cs);u.searchParams.delete("sslmode");u.searchParams.delete("ssl");return u.href}catch{return cs}}
export function setPoolForTesting(p:Pool|undefined){pool=p;schema=undefined}
async function client():Promise<Pool>{
 if(!pgEnabled())throw new Error("DATABASE_URL is not configured");
 if(!schema)schema=(async()=>{
  if(!pool){pool=new Pool({connectionString:connStr(),max:3,idleTimeoutMillis:30000,connectionTimeoutMillis:10000,ssl:process.env.DATABASE_SSL==="true"?{rejectUnauthorized:false}:undefined});pool.on("error",()=>{});}
  await pool.query(`create table if not exists feed_state(feed_id text primary key,jobs jsonb not null default '[]',next_fetch bigint not null default 0,fetched_at bigint not null default 0,status text not null default '',detail text not null default '')`);
  await pool.query(`create table if not exists feed_attempts(scope text primary key,attempts jsonb not null default '[]',lifetime integer not null default 0)`);
  await pool.query(`create table if not exists jobs(job_id text primary key,source text not null,title text not null,company text not null,url text not null,location text not null,remote boolean not null default false,posted timestamptz,tags jsonb not null default '[]',scope jsonb,eligibility jsonb,summary text not null default '',first_seen timestamptz not null default now(),last_seen timestamptz not null default now())`);
  await pool.query(`create index if not exists jobs_source_idx on jobs(source)`);
  await pool.query(`create index if not exists jobs_posted_idx on jobs(posted desc)`);
  await pool.query(`create table if not exists job_status(job_id text primary key,status text not null,updated timestamptz not null default now())`);
  return pool;
 })().catch(e=>{schema=undefined;throw e});
 return schema;
}
export async function loadState():Promise<StoreState|null>{
 try{
  const p=await client();
  const [e,a,s]=await Promise.all([p.query(`select feed_id,jobs,next_fetch,fetched_at,status,detail from feed_state`),p.query(`select scope,attempts,lifetime from feed_attempts`),p.query(`select job_id,status,updated from job_status`)]);
  const state:StoreState={entries:{},attempts:{},lifetime:{},statuses:{}};
  for(const r of e.rows)state.entries[r.feed_id]={jobs:r.jobs,next:Number(r.next_fetch),fetched:Number(r.fetched_at),status:r.status,detail:r.detail};
  for(const r of a.rows){state.attempts[r.scope]=r.attempts;state.lifetime[r.scope]=Number(r.lifetime)}
  for(const r of s.rows)if(["listed","applied","cancelled","ignored"].includes(r.status))state.statuses[r.job_id]={status:r.status,at:new Date(r.updated||0).getTime()||0};
  return state;
 }catch{return null}
}
async function insertRows(p:Pool,rows:any[][],cols:number,sql:(ph:string)=>string){
 for(let i=0;i<rows.length;i+=100){
  const chunk=rows.slice(i,i+100),vals:any[]=[];
  const ph=chunk.map((r,k)=>{vals.push(...r);return "("+r.map((_,j)=>"$"+(k*cols+j+1)).join(",")+")"});
  await p.query(sql(ph.join(",")),vals);
 }
}
export async function saveState(state:StoreState){
 try{
  const p=await client();
  await insertRows(p,Object.entries(state.entries).map(([id,e])=>[id,JSON.stringify(e.jobs),e.next,e.fetched,e.status,e.detail]),6,ph=>`insert into feed_state(feed_id,jobs,next_fetch,fetched_at,status,detail) values ${ph} on conflict(feed_id) do update set jobs=excluded.jobs,next_fetch=excluded.next_fetch,fetched_at=excluded.fetched_at,status=excluded.status,detail=excluded.detail`);
  await insertRows(p,Object.entries(state.attempts).map(([scope,a])=>[scope,JSON.stringify(a),state.lifetime[scope]||0]),3,ph=>`insert into feed_attempts(scope,attempts,lifetime) values ${ph} on conflict(scope) do update set attempts=excluded.attempts,lifetime=excluded.lifetime`);
  await p.query(`delete from job_status where not (job_id = any($1::text[]))`,[Object.keys(state.statuses)]);
  await insertRows(p,Object.entries(state.statuses).map(([id,s])=>[id,s.status,new Date(s.at||Date.now()).toISOString()]),3,ph=>`insert into job_status(job_id,status,updated) values ${ph} on conflict(job_id) do update set status=excluded.status,updated=excluded.updated`);
 }catch{}
}
export async function upsertJobs(jobs:Job[]){
 try{
  const p=await client();
  await insertRows(p,jobs.map(j=>[j.id,j.source,j.title,j.company,j.url,j.location,j.remote,j.posted||null,JSON.stringify(j.tags),JSON.stringify(j.scope),JSON.stringify(j.eligibility),j.summary]),12,ph=>`insert into jobs(job_id,source,title,company,url,location,remote,posted,tags,scope,eligibility,summary) values ${ph} on conflict(job_id) do update set title=excluded.title,company=excluded.company,url=excluded.url,location=excluded.location,remote=excluded.remote,posted=excluded.posted,tags=excluded.tags,summary=excluded.summary,last_seen=now()`);
 }catch{}
}
