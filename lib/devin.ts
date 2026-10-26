import type { Job } from "./types";

// Devin API client (api.devin.ai). Two generations are supported and picked by
// key prefix:
//
//   cog_*  → v3, org-scoped — POST/GET /v3/organizations/{DEVIN_ORG_ID}/sessions
//            (Personal Access Token or service-user key; service users need
//            the UseDevinSessions permission). DEVIN_ORG_ID is required and
//            shown at the top of Settings → Devin API.
//   apk_*  → legacy v1 — POST/GET /v1/sessions. Still accepted during the
//            deprecation window; the org is embedded in the key itself.
//
// Sessions are async and consume ACUs — callers rate-limit and cap
// max_acu_limit. DEVIN_MODE pins the agent mode (swe-2-high default); v1 does
// not document the field, so create retries without it on a 4xx.
const API = "https://api.devin.ai";

const apiKey = () => process.env.DEVIN_API_KEY || "";
const isV3 = () => apiKey().startsWith("cog_");
export const devinEnabled = () => !!apiKey() && (!isV3() || !!process.env.DEVIN_ORG_ID);
export const devinMode = () => process.env.DEVIN_MODE || "swe-2-high";

export type DevinSession = {
  session_id?: string;
  url?: string;
  // v3 fields:
  status?: string; // new | claimed | running | exit | error | suspended | resuming
  status_detail?: string | null; // working | finished | waiting_* | suspend reasons
  // v1 field:
  status_enum?: string; // working | blocked | finished | expired …
  structured_output?: unknown;
  acus_consumed?: number;
};

type Resp = { status: number; data: DevinSession | null };

async function call(path: string, init?: RequestInit): Promise<Resp> {
  const base = isV3() ? `${API}/v3/organizations/${process.env.DEVIN_ORG_ID}` : `${API}/v1`;
  try {
    const r = await fetch(base + path, {
      ...init,
      headers: { Authorization: `Bearer ${apiKey()}`, "Content-Type": "application/json" },
    });
    return { status: r.status, data: r.ok ? ((await r.json()) as DevinSession) : null };
  } catch {
    return { status: 0, data: null };
  }
}

export type MatchVerdict = { id: string; score: number; reason: string };

// Conservative cap — a scoring pass is one reasoning task, not a build job.
const maxAcu = () => Math.max(1, Number(process.env.DEVIN_MAX_ACU) || 2);

/** Prompt kept data-only: instruct the session to analyze inline JSON, write
 *  structured output once, and finish — no repo, browser, or shell work. */
export function buildMatchPrompt(
  profile: { keywords: string[]; excluded: string[]; filters: Record<string, unknown> },
  jobs: Job[],
): string {
  const slim = jobs.map((j) => ({
    id: j.id,
    title: j.title,
    company: j.company,
    location: j.location,
    remote: j.remote,
    tags: j.tags.slice(0, 8),
    summary: (j.summary || "").slice(0, 400),
  }));
  return [
    "You are a job-matching engine inside a job-discovery app.",
    "Do not clone repositories, run shell commands, or browse the web.",
    "Analyze the JSON below, update the structured output exactly once, then finish immediately.",
    "",
    "Score every job 0-100 for fit against the candidate profile. Reward keyword overlap,",
    "seniority/domain fit, and location/remote compatibility with the candidate's filters.",
    "Penalize jobs containing excluded keywords (score them 0-10).",
    "For each job include a one-sentence reason naming the strongest signal.",
    "",
    "PROFILE:",
    JSON.stringify(profile),
    "",
    "JOBS:",
    JSON.stringify(slim),
  ].join("\n");
}

const MATCH_SCHEMA = {
  type: "object",
  properties: {
    matches: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          score: { type: "number" },
          reason: { type: "string" },
        },
        required: ["id", "score", "reason"],
      },
    },
  },
  required: ["matches"],
};

async function createSession(prompt: string, opts: { title: string; schema: object; tag: string }) {
  const body: Record<string, unknown> = {
    prompt,
    title: opts.title,
    max_acu_limit: maxAcu(),
    structured_output_schema: opts.schema,
    tags: ["job-atlas", opts.tag],
    devin_mode: devinMode(),
  };
  if (isV3()) {
    body.structured_output_required = true;
    body.resumable = false;
  } else {
    body.unlisted = true;
  }
  let r = await call("/sessions", { method: "POST", body: JSON.stringify(body) });
  // v1 may reject the undocumented devin_mode field — retry without it and
  // fall back to the org's default agent mode rather than failing the run.
  if (!r.data && !isV3() && r.status >= 400 && r.status < 500) {
    delete body.devin_mode;
    r = await call("/sessions", { method: "POST", body: JSON.stringify(body) });
  }
  return r.data;
}

export function createMatchSession(prompt: string) {
  return createSession(prompt, { title: "Job Atlas — profile match run", schema: MATCH_SCHEMA, tag: "match" });
}

export async function getSession(id: string) {
  return (await call(`/sessions/${id}`)).data;
}

// ---- Resume keyword extraction ------------------------------------------
const RESUME_SCHEMA = {
  type: "object",
  properties: {
    keywords: {
      type: "array",
      items: { type: "string" },
      description: "Skill/keyword terms extracted from the resume",
    },
    summary: { type: "string", description: "One-sentence professional summary" },
  },
  required: ["keywords"],
};

/** Resume text goes inline — capped so the prompt stays one reasonable read. */
export function buildResumePrompt(fileName: string, text: string): string {
  return [
    "You are a resume-analysis engine inside a job-discovery app.",
    "Do not clone repositories, run shell commands, or browse the web.",
    "Read the resume text below, update the structured output exactly once, then finish immediately.",
    "",
    "Extract 15-40 skill keywords a job board should match on: technologies, tools, languages,",
    "frameworks, domains, certifications, and role-level skills. Lowercase, short phrases,",
    'no duplicates, no filler words like "team" or "experience", no personal details,',
    "no employer or school names. Also write a one-sentence professional summary.",
    "",
    `RESUME FILE: ${fileName}`,
    "",
    text.slice(0, 20000),
  ].join("\n");
}

export function createResumeSession(prompt: string) {
  return createSession(prompt, { title: "Job Atlas — resume analysis", schema: RESUME_SCHEMA, tag: "resume" });
}

/** Sanitize the model's keyword list — strings only, deduped, size-bounded. */
export function parseKeywords(output: unknown): { keywords: string[]; summary: string } {
  const o = output as { keywords?: unknown; summary?: unknown } | null;
  const keywords = [
    ...new Set(
      (Array.isArray(o?.keywords) ? (o.keywords as unknown[]) : [])
        .filter((k): k is string | number => typeof k === "string" || typeof k === "number")
        .map((k) => String(k).toLowerCase().trim())
        .filter((k) => k.length > 1 && k.length < 60),
    ),
  ].slice(0, 40);
  return { keywords, summary: String(o?.summary || "").slice(0, 300) };
}

/** Normalizes v1 (status_enum) and v3 (status/status_detail) into one outcome. */
export function sessionOutcome(s: DevinSession): "running" | "done" | "failed" {
  if (isV3())
    return s.status_detail === "finished" || s.status === "exit"
      ? "done"
      : s.status === "error" || s.status === "suspended"
        ? "failed"
        : "running";
  // v1: a one-shot session ends "blocked" (idle, awaiting input) — that is the
  // normal completion state, not an error. Truly dead sessions are
  // expired/suspended. Empty structured output on a "done" run is caught by the
  // route's verdict validation instead.
  return s.status_enum === "finished" || s.status_enum === "blocked"
    ? "done"
    : s.status_enum === "expired" || (s.status_enum || "").startsWith("suspend")
      ? "failed"
      : "running";
}

/** Human-readable terminal detail for error reporting. */
export const sessionDetail = (s: DevinSession) => (isV3() ? s.status_detail || s.status : s.status_enum) || "unknown";

/** Whitelist-extract verdicts from arbitrary structured output — only ids that
 *  exist in `valid` survive, scores clamped to 0-100, reasons trimmed. */
export function parseVerdicts(output: unknown, valid: Set<string>): MatchVerdict[] {
  const rows = (output as { matches?: unknown } | null)?.matches;
  if (!Array.isArray(rows)) return [];
  const out: MatchVerdict[] = [];
  for (const r of rows as { id?: unknown; score?: unknown; reason?: unknown }[]) {
    const id = typeof r?.id === "string" ? r.id : "";
    if (!valid.has(id)) continue;
    const score = Math.max(0, Math.min(100, Math.round(Number(r?.score) || 0)));
    out.push({ id, score, reason: String(r?.reason || "").slice(0, 200) });
  }
  return out;
}
