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
};
export type Resume = {
  id: string;
  name: string;
  size: number;
  uploadedAt: number;
  text: string;
  keywords: string[];
};
export type Profile = { keywords: string[]; excluded: string[]; resumes: Resume[]; sourceRank: Record<string, number> };
