"use client";
import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowUpRight, MapPin, Globe2, ShieldAlert, CircleCheck } from "lucide-react";
import { FadeIn } from "../../../../components/motion";
import { Spinner } from "../../../../components/loader";
import { JobHead, RemotePill, HitPills, JobActions } from "../../../../components/job-parts";
import { sourceName } from "../../../../lib/catalog";
import { countries } from "../../../../lib/geo";
import { useLiveData, useLiveProfileMeta, useServerClock } from "../../../../lib/live";
import { scoreJob } from "../../../../lib/match";
import type { JobsMeta, Snapshot } from "../../../../lib/types";
import type { Scope } from "../../../../lib/geo";

const nameOf = (code: string) => countries.find((c) => c.code === code)?.name || code;

function ScopeBlock({ scope, empty }: { scope: Scope; empty: string }) {
  const shown = scope.countries.slice(0, 24);
  return (
    <>
      <p className="jd-raw">{scope.raw || empty}</p>
      <div className="tags">
        {scope.worldwide && <span className="pill green">Worldwide</span>}
        {scope.groups.map((g) => (
          <span className="pill" key={g}>
            {g}
          </span>
        ))}
        {shown.map((c) => (
          <span className="pill" key={c}>
            {nameOf(c)}
          </span>
        ))}
        {scope.countries.length > shown.length && (
          <span className="pill">+{scope.countries.length - shown.length} more countries</span>
        )}
        {scope.excluded.map((c) => (
          <span className="pill amber" key={c}>
            excludes {nameOf(c)}
          </span>
        ))}
        {scope.unknown && <span className="pill amber">Scope unknown</span>}
        {scope.uncertain && <span className="pill amber">Restrictions need review</span>}
      </div>
    </>
  );
}

export default function JobClient({ id, initial, meta }: { id: string; initial: Snapshot; meta: JobsMeta }) {
  const { data, loading } = useLiveData(initial);
  const router = useRouter();
  const now = useServerClock(data.serverAt, initial.serverAt || 0);
  const liveMeta = useLiveProfileMeta({ keywords: meta.keywords, sourceRank: {} }, !meta.guest);
  const j = data.jobs.find((x) => x.id === id);
  const se = j ? data.statuses[j.id] : undefined;
  const st = se?.status || "listed";
  const stAt = se?.at || 0;
  const m = useMemo(
    () => (j && !meta.guest ? scoreJob(j, liveMeta.keywords, meta.excluded) : null),
    [j, meta.guest, meta.excluded, liveMeta.keywords],
  );
  if (!j)
    return loading ? (
      <div className="route-load">
        <Spinner size={40} />
      </div>
    ) : (
      <div className="empty">This listing is no longer in the live feed.</div>
    );
  return (
    <FadeIn className="pf-wrap">
      <Link
        href="/jobs"
        className="jd-back"
        onClick={(e) => {
          // The Navigation API exposes the same-origin entry stack — if the
          // entry before this one is ours, back() restores filters AND the
          // scrolled position; on a direct landing, push to a fresh list.
          e.preventDefault();
          const entries = (window as any).navigation?.entries?.() as { url: string }[] | undefined;
          const prevUrl = entries?.[entries.length - 2]?.url;
          if (prevUrl && new URL(prevUrl).origin === location.origin) router.back();
          else router.push("/jobs");
        }}
      >
        <ArrowLeft size={13} /> Back to Discover
      </Link>
      <div className="pf-card jd-card">
        <JobHead j={j} m={m} st={st} stAt={stAt} now={now} />
        <h1 className="jd-title">{j.title}</h1>
        <p className="location">
          <MapPin size={12} /> {j.location}
        </p>
        <div className="tags">
          <RemotePill j={j} />
          <HitPills hits={m?.hits} max={8} />
        </div>
        <JobActions id={j.id} st={st} guest={meta.guest} next={`/jobs/${encodeURIComponent(id)}`}>
          <a className="act-on jd-apply" href={j.url} target="_blank" rel="noreferrer">
            View posting on {sourceName(j.source)} <ArrowUpRight size={13} />
          </a>
        </JobActions>
      </div>

      <div className="jd-grid">
        <div className="pf-card">
          <h2 className="jd-h">
            <MapPin size={14} /> Location evidence
          </h2>
          <p className="pf-hint">Where the employer says the role is based.</p>
          <ScopeBlock scope={j.scope} empty="Not supplied" />
        </div>
        <div className="pf-card">
          <h2 className="jd-h">
            <Globe2 size={14} /> Candidate eligibility
          </h2>
          <p className="pf-hint">Where candidates are allowed to work from. Missing fields stay unknown.</p>
          <ScopeBlock scope={j.eligibility} empty="Not supplied; no eligibility assumed" />
        </div>
      </div>

      {j.summary && (
        <div className="pf-card">
          <h2 className="jd-h">
            <CircleCheck size={14} /> Listing summary
          </h2>
          <p className="jd-summary">{j.summary}</p>
        </div>
      )}

      {!!j.tags.length && (
        <div className="pf-card">
          <h2 className="jd-h">
            <ShieldAlert size={14} /> Tags
          </h2>
          <div className="tags">
            {j.tags.map((t) => (
              <span className="pill" key={t}>
                {t}
              </span>
            ))}
          </div>
        </div>
      )}
    </FadeIn>
  );
}
