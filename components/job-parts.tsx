"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Favicon } from "./favicon";
import { Spinner } from "./loader";
import { sourceName } from "../lib/catalog";
import { mark } from "../lib/live";
import { relTime } from "../lib/time";
import type { Job, JobStatus } from "../lib/types";
import type { JobMatch } from "../lib/match";

/** Match-score badge, or a company monogram when no match was computed. */
export function MatchBadge({ m, company }: { m?: JobMatch | null; company: string }) {
  return m ? (
    <div className="mscore" title="Keyword match score">
      <b>{m.score}</b>
      <span>match</span>
      <i className="mfill" style={{ height: `${Math.min(100, m.score)}%` }} />
    </div>
  ) : (
    <div className="company-icon">{company.slice(0, 2).toUpperCase()}</div>
  );
}

/** Pipeline-state pill (Applied / Cancelled / Ignored) — hidden while listed. */
export function StatusPill({ st, stAt, now }: { st: JobStatus | "listed"; stAt: number; now: number }) {
  if (st === "listed") return null;
  return (
    <span className={"pill" + (st === "applied" ? " green" : st === "cancelled" ? " amber" : "")}>
      {st[0].toUpperCase() + st.slice(1)}
      {stAt ? " · " + relTime(stAt, now) : ""}
    </span>
  );
}

/** Card head: match/monogram + company·source + status + relative posted time. */
export function JobHead({
  j,
  m,
  st,
  stAt,
  now,
}: {
  j: Job;
  m?: JobMatch | null;
  st: JobStatus | "listed";
  stAt: number;
  now: number;
}) {
  return (
    <div className="job-head">
      <MatchBadge m={m} company={j.company} />
      <div className="job-top">
        <span className="job-via">
          {j.company} · via <Favicon source={j.source} /> {sourceName(j.source)}
        </span>
        <span className="job-st">
          <StatusPill st={st} stAt={stAt} now={now} />
          <span title={j.posted ? new Date(j.posted).toLocaleString() : undefined}>{relTime(j.posted, now)}</span>
        </span>
      </div>
    </div>
  );
}

/** Remote / Hybrid / On-site pill derived from the job's flags and location text. */
export function RemotePill({ j }: { j: Job }) {
  return j.remote ? (
    <span className="pill green">Remote</span>
  ) : /hybrid/i.test(j.location) ? (
    <span className="pill amber">Hybrid</span>
  ) : (
    <span className="pill">On-site</span>
  );
}

/** Matched-keyword pills with an overflow counter. */
export function HitPills({ hits, max = 6 }: { hits?: string[]; max?: number }) {
  if (!hits?.length) return null;
  return (
    <>
      {hits.slice(0, max).map((k) => (
        <span className="pill kw-hit" key={k}>
          {k}
        </span>
      ))}
      {hits.length > max && <span className="pill">+{hits.length - max} more</span>}
    </>
  );
}

/** Pipeline action buttons. Guests are routed to sign-in; busy state is local. */
export function JobActions({
  id,
  st,
  guest,
  next,
  children,
}: {
  id: string;
  st: string;
  guest?: boolean;
  next?: string;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const doMark = (status: JobStatus) => {
    if (guest) {
      // Default return destination is wherever the action was pressed — the
      // card's list view or the detail page, params included.
      const dest = next || window.location.pathname + window.location.search;
      router.push("/login?next=" + encodeURIComponent(dest));
      return;
    }
    setBusy(true);
    void mark(id, status).finally(() => setBusy(false));
  };
  return (
    // Clicks here must not bubble to a clickable-card parent.
    <div className="job-actions" onClick={(e) => e.stopPropagation()}>
      {children}
      {st !== "applied" && (
        <button className="act-on" disabled={busy} onClick={() => doMark("applied")}>
          Mark applied
        </button>
      )}
      {st !== "cancelled" && (
        <button disabled={busy} onClick={() => doMark("cancelled")}>
          Mark cancelled
        </button>
      )}
      {st !== "ignored" && (
        <button disabled={busy} onClick={() => doMark("ignored")}>
          Ignore
        </button>
      )}
      {st !== "listed" && (
        <button disabled={busy} onClick={() => doMark("listed")}>
          Back to listed
        </button>
      )}
      {busy && <Spinner size={15} className="act-spin" />}
    </div>
  );
}
