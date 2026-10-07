import type { Scope } from "./geo";
export type Job={id:string; title:string; company:string; url:string; source:string; location:string; remote:boolean; posted:string; tags:string[]; scope:Scope; eligibility:Scope; summary:string};
export type SourceStatus={id:string; name:string; status:string; count:number; fetchedAt:number; nextFetch:number; detail:string};
export type Snapshot={jobs:Job[]; sources:SourceStatus[]; updatedAt:number};
