import type { Scope } from "./geo";
export type Job = {
  id: string;
  title: string;
  company: string;
  url: string;
  source: string;
  location: string;
  remote: boolean;
  posted: string;
  tags: string[];
  scope: Scope;
  eligibility: Scope;
  summary: string;
};
export type SourceStatus = {
  id: string;
  name: string;
  status: string;
  count: number;
  fetchedAt: number;
  nextFetch: number;
  detail: string;
};
export type JobStatus = "listed" | "applied" | "cancelled" | "ignored";
export type StatusEntry = { status: JobStatus; at: number };
export type Snapshot = {
  jobs: Job[];
  sources: SourceStatus[];
  statuses: Record<string, StatusEntry>;
  updatedAt: number;
  serverAt?: number;
};
export type Resume = {
  id: string;
  name: string;
  alias?: string;
  size: number;
  uploadedAt: number;
  text: string;
  keywords: string[];
  agentRun?: { sessionId: string; url: string; ranAt: number; status: "running" | "done" | "error" };
  aiSummary?: string;
};
export type DiscoverFilters = {
  country: string;
  group: string;
  mode: string;
  source: string;
  sched: string;
  statusFilter: string;
  remote: string;
  remoteTo: string;
  unknown: boolean;
  query: string;
};
export type JobsMeta = {
  guest?: boolean;
  keywords: string[];
  sourceRank: Record<string, number>;
  filters: Partial<DiscoverFilters>;
  resumes: { id: string; name: string; alias?: string; keywords: string[] }[];
  manual: string[];
  excluded: string[];
};
export type AgentMatch = {
  sessionId: string;
  url: string;
  ranAt: number;
  status: "running" | "done" | "error";
  matches?: { id: string; score: number; reason: string }[];
  error?: string;
};
export type Profile = {
  keywords: string[];
  excluded: string[];
  resumes: Resume[];
  sourceRank: Record<string, number>;
  filters: Partial<DiscoverFilters>;
  agentMatch?: AgentMatch;
};
