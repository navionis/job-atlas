"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { Search, MapPin, ArrowUpRight, Compass, FileText } from "lucide-react";
import { Spinner } from "../../../components/loader";
import { Favicon } from "../../../components/favicon";
import { EASE } from "../../../components/motion";
import { countries, scopeMatches } from "../../../lib/geo";
import { catalog } from "../../../lib/catalog";
import { useLiveData, useLiveProfileMeta, mark } from "../../../lib/live";
import { rankJobs, type JobMatch } from "../../../lib/match";
import type { Snapshot, DiscoverFilters } from "../../../lib/types";

type Meta = {
  keywords: string[];
  sourceRank: Record<string, number>;
  filters: Partial<DiscoverFilters>;
  resumes: { id: string; name: string; alias?: string; keywords: string[] }[];
  manual: string[];
  excluded: string[];
};

const PAGE = 15;
const STAGES = [
  ["listed", "Listed"],
  ["applied", "Applied"],
  ["cancelled", "Cancelled"],
  ["ignored", "Ignored"],
  ["all", "All"],
] as const;
type JobStatus = (typeof STAGES)[number][0];

export default function JobsClient({ initial, meta }: { initial: Snapshot; meta: Meta }) {
  const { data, loading, error } = useLiveData(initial);
  const { keywords: profileKw, sourceRank: srcRank } = useLiveProfileMeta(meta);
  const sp = useSearchParams();
  const f = meta.filters;
  const country = f.country || "",
    group = f.group || "",
    source = f.source || "",
    remote = f.remote === "onsite" ? "onsite" : f.remote ? "remote" : "",
    remoteTo = f.remoteTo || "",
    sched = f.sched || "",
    mode = f.mode || "location",
    unknown = !!f.unknown;
  const defaultTab = meta.resumes[0]?.id || (meta.manual.length ? "manual" : "all");
  const validMatch = (v: string | null): v is string =>
    v === "all" || (v === "manual" && meta.manual.length > 0) || meta.resumes.some((r) => r.id === v);
  const validStatus = (v: string | null): v is JobStatus => STAGES.some(([s]) => s === v);
  const tab = validMatch(sp.get("match")) ? sp.get("match")! : defaultTab;
  const statusFilter: JobStatus = validStatus(sp.get("status")) ? (sp.get("status") as JobStatus) : "listed";
  const hydrated = useRef(false);
  const query = sp.get("q") ?? "";
  const setParams = useCallback(
    (updates: Record<string, string | null>, push = false) => {
      const p = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v === null || v === "") p.delete(k);
        else p.set(k, v);
      }
      const s = p.toString();
      const url = s ? `/jobs?${s}` : "/jobs";
      if (push) window.history.pushState(null, "", url);
      else window.history.replaceState(null, "", url);
    },
    [sp],
  );
  const setTab = (v: string) => setParams({ match: v === defaultTab ? null : v }, true);
  const setStatusFilter = (v: JobStatus) => setParams({ status: v === "listed" ? null : v }, true);
  const setQuery = (v: string) => setParams({ q: v });
  const [marking, setMarking] = useState<string[]>([]),
    [shown, setShown] = useState(PAGE);
  const moreRef = useRef<HTMLDivElement>(null);
  const matched = tab !== "all";
  const kwSources = meta.resumes.length + (meta.manual.length ? 1 : 0);
  const doMark = (id: string, st: "listed" | "applied" | "cancelled" | "ignored") => {
    setMarking((m) => [...m, id]);
    void mark(id, st).finally(() => setMarking((m) => m.filter((x) => x !== id)));
  };
  const filterKey = [tab, country, group, query, source, remote, remoteTo, sched, statusFilter, mode, unknown].join(
    "|",
  );
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setShown(PAGE);
  }
  useEffect(() => {
    const el = moreRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (es) => {
        if (es[0].isIntersecting) setShown((n) => n + PAGE);
      },
      { rootMargin: "600px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [matched, shown]);
  useEffect(() => {
    if (error) toast.error(error, { action: { label: "Retry", onClick: () => window.location.reload() } });
  }, [error]);
  const didMount = useRef(false);
  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      return;
    }
    const t = setTimeout(() => {
      void fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filters: { ...meta.filters, query } }),
      }).catch(() => {});
    }, 600);
    return () => clearTimeout(t);
  }, [query, meta.filters]);
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    if (sp.get("q") === null && meta.filters.query) setParams({ q: meta.filters.query });
  }, [sp, meta.filters.query, setParams]);
  const selected = country || group;
  const homeName = countries.find((c) => c.code === remoteTo)?.name || "";
  const name = countries.find((c) => c.code === country)?.name || group || "Everywhere";
  const terms = useMemo(
    () => (query ? [query.toLowerCase()] : profileKw.map((k) => k.toLowerCase())),
    [query, profileKw],
  );
  const statuses = useMemo(() => data.statuses || {}, [data.statuses]);
  const preStatus = useMemo(
    () =>
      data.jobs
        .filter((j) => {
          if (source && j.source !== source) return false;
          if ((remote === "remote" && !j.remote) || (remote === "onsite" && j.remote)) return false;
          if (remoteTo) {
            if (!j.remote || !scopeMatches(j.eligibility, remoteTo)) return false;
            if (j.scope.countries.includes(remoteTo) && !j.scope.excluded.includes(remoteTo)) return false;
          }
          if (sched) {
            const t = `${j.title} ${j.tags.join(" ")} ${j.summary}`.toLowerCase();
            if (!new RegExp(sched + "[\\s-]?time").test(t)) return false;
          }
          if (
            terms.length &&
            !terms.some((t) => `${j.title} ${j.company} ${j.tags.join(" ")}`.toLowerCase().includes(t))
          )
            return false;
          const s = mode === "eligibility" ? j.eligibility : j.scope;
          if (country && s.countries.includes(country)) return false;
          if (!group) return true;
          return scopeMatches(s, group) || (unknown && (s.unknown || s.uncertain));
        })
        .sort((a, b) => (srcRank[b.source] ?? 3) - (srcRank[a.source] ?? 3) || b.posted.localeCompare(a.posted)),
    [data.jobs, terms, country, group, source, remote, remoteTo, sched, mode, unknown, srcRank],
  );
  const counts = useMemo(() => {
    const c: Record<string, number> = { listed: 0, applied: 0, cancelled: 0, ignored: 0 };
    for (const j of preStatus) {
      const st = statuses[j.id]?.status || "listed";
      if (st in c) c[st]++;
    }
    return c;
  }, [preStatus, statuses]);
  const filtered = useMemo(
    () =>
      statusFilter === "all"
        ? preStatus
        : preStatus.filter((j) => (statuses[j.id]?.status || "listed") === statusFilter),
    [preStatus, statusFilter, statuses],
  );
  const ranked = useMemo(() => {
    if (!matched) return [];
    const r = meta.resumes.find((x) => x.id === tab);
    return rankJobs(filtered, r ? r.keywords : meta.manual, meta.excluded, srcRank);
  }, [matched, tab, filtered, meta.resumes, meta.manual, meta.excluded, srcRank]);
  const total = matched ? ranked.length : filtered.length;
  const display: { j: (typeof filtered)[number]; m?: JobMatch }[] = matched
    ? ranked.slice(0, shown).map((m) => ({ j: m.job, m }))
    : filtered.slice(0, shown).map((j) => ({ j }));
  const activeResume = meta.resumes.find((r) => r.id === tab);
  const chips = [
    group && `Region: ${group}`,
    country && `Excludes ${name}`,
    mode === "eligibility" && "Candidate eligibility",
    source && `Source: ${catalog.find((c) => c.id === source)?.name || source}`,
    sched && (sched === "full" ? "Full-time" : "Part-time"),
    remote === "remote" && "Remote only",
    remote === "onsite" && "On-site only",
    remoteTo && `Remote to ${homeName}`,
    unknown && "Includes unknown scope",
  ].filter(Boolean) as string[];
  return (
    <div className="workspace" id="listings">
      <section className="results">
        <div className="search">
          <span>
            <Search size={20} />
          </span>
          <input
            aria-label="Search jobs"
            placeholder={
              profileKw.length && !query ? "Matching your profile keywords" : "Job title, company, or keyword"
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <span className="key">{!query && profileKw.length ? "PROFILE" : "SEARCH"}</span>
        </div>
        <div className="pipe" role="tablist" aria-label="Pipeline stage">
          {STAGES.map(([v, l]) => (
            <button
              key={v}
              className={"pipe-tab" + (statusFilter === v ? " on" : "")}
              onClick={() => setStatusFilter(v)}
            >
              {l} <b>{v === "all" ? preStatus.length : counts[v]}</b>
            </button>
          ))}
        </div>
        {kwSources > 0 && (
          <div className="m-tabs">
            <button className={"m-tab" + (tab === "all" ? " on" : "")} onClick={() => setTab("all")}>
              All listings
            </button>
            {meta.resumes.map((r) => (
              <button key={r.id} className={"m-tab" + (tab === r.id ? " on" : "")} onClick={() => setTab(r.id)}>
                <FileText size={13} /> {r.alias || r.name}
              </button>
            ))}
            {meta.manual.length > 0 && (
              <button className={"m-tab" + (tab === "manual" ? " on" : "")} onClick={() => setTab("manual")}>
                Manual keywords
              </button>
            )}
          </div>
        )}
        <div className="section-title">
          <div>
            <h2>
              {matched
                ? activeResume
                  ? `Matched for you — ${activeResume.alias || activeResume.name}`
                  : "Matched for you — manual keywords"
                : remoteTo
                  ? `Remote jobs open to ${homeName}`
                  : `Opportunities ${country ? "excluding" : "in"} ${name}`}
            </h2>
            <p>
              {loading
                ? "Checking available feeds…"
                : matched
                  ? `${ranked.length} jobs ranked against ${activeResume ? activeResume.keywords.length : meta.manual.length} keywords`
                  : `${filtered.length} ${statusFilter === "all" ? "" : statusFilter + " "}jobs in the loaded feed slices`}
            </p>
          </div>
          <span className="pill green">{mode === "eligibility" ? "Candidate scope" : "Location matching"}</span>
        </div>
        {chips.length > 0 && (
          <div className="active-filters">
            <span className="af-label">Search preferences</span>
            {chips.map((c) => (
              <span className="pill" key={c}>
                {c}
              </span>
            ))}
            <Link href="/profile#filters" className="alert-link">
              Edit in Profile <ArrowUpRight size={11} />
            </Link>
          </div>
        )}
        {selected && (
          <div className="coverage">
            {name} is selectable even when a provider has no coverage. Worldwide listings are included when explicitly
            labeled.{" "}
            {mode === "eligibility"
              ? "Only explicit candidate-location fields count; missing fields stay unknown."
              : "Regional matches use the group definitions below."}
          </div>
        )}

        {!loading && data.sources.some((s) => ["unavailable", "stale"].includes(s.status)) && (
          <div className="alert">
            Some feeds are unavailable or stale.{" "}
            <Link href="/admin" className="alert-link">
              View source status <ArrowUpRight size={11} />
            </Link>
          </div>
        )}
        {loading ? (
          <div className="empty">
            <Spinner size={56} className="page-load" />
            <h3>Opening the atlas…</h3>
            <p>Fetching available sources. No sample jobs are mixed into results.</p>
          </div>
        ) : matched && ranked.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">
              <FileText size={44} strokeWidth={1.2} />
            </div>
            <h3>No matches above the threshold</h3>
            <p>Add more resume keywords on your profile, or relax the filters narrowing the result set.</p>
            <Link className="primary" href="/profile">
              Go to profile
            </Link>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">
              <Compass size={44} strokeWidth={1.4} />
            </div>
            {statusFilter !== "all" && preStatus.length > 0 ? (
              <>
                <h3>Nothing {statusFilter} yet.</h3>
                <p>
                  {preStatus.length} jobs match your filters — none are marked {statusFilter}.
                </p>
                <button className="primary" onClick={() => setStatusFilter("listed")}>
                  View listed jobs <ArrowUpRight size={13} />
                </button>
              </>
            ) : (
              <>
                <h3>No matching listings yet.</h3>
                <p>
                  This does not mean there are no jobs in {name}.<br />
                  Your search preferences or the connected sources may not cover it.
                </p>
                <Link className="primary" href="/profile#filters">
                  Adjust search preferences <ArrowUpRight size={13} />
                </Link>
                <Link className="text-button" href="/admin">
                  Check coverage &amp; connect more sources
                </Link>
              </>
            )}
          </div>
        ) : (
          <div className="cards">
            <AnimatePresence mode="popLayout">
              {display.map(({ j, m }, i) => {
                const se = statuses[j.id],
                  st = se?.status || "listed",
                  stAt = se?.at || 0;
                return (
                  <motion.article
                    key={j.id}
                    layout
                    className={"card-" + st}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.3, delay: Math.min(i * 0.04, 0.4), ease: EASE }}
                  >
                    {m ? (
                      <div className="mscore" title="Keyword match score">
                        <b>{m.score}</b>
                        <span>match</span>
                        <i className="mgauge">
                          <i className="mfill" style={{ height: `${Math.min(100, m.score)}%` }} />
                        </i>
                      </div>
                    ) : (
                      <div className="company-icon">{j.company.slice(0, 2).toUpperCase()}</div>
                    )}
                    <div className="job-content">
                      <div className="job-top">
                        <span className="job-via">
                          {j.company} · via <Favicon source={j.source} />{" "}
                          {catalog.find((c) => c.id === j.source)?.name || j.source}
                        </span>
                        <span className="job-st">
                          {st !== "listed" && (
                            <span
                              className={"pill" + (st === "applied" ? " green" : st === "cancelled" ? " amber" : "")}
                            >
                              {st[0].toUpperCase() + st.slice(1)}
                              {stAt ? " · " + new Date(stAt).toLocaleDateString() : ""}
                            </span>
                          )}
                          {j.posted ? new Date(j.posted).toLocaleDateString() : "Date unavailable"}
                        </span>
                      </div>
                      <h3>
                        <a href={j.url} target="_blank" rel="noreferrer">
                          {j.title} <ArrowUpRight size={13} />
                        </a>
                      </h3>
                      <p className="location">
                        <MapPin size={12} /> {j.location}
                      </p>
                      <div className="tags">
                        {j.remote && <span className="pill green">Remote</span>}
                        {(srcRank[j.source] ?? 3) >= 4 && <span className="pill">Priority feed</span>}
                        {m?.hits.slice(0, 6).map((k) => (
                          <span className="pill kw-hit" key={k}>
                            {k}
                          </span>
                        ))}
                        {m && m.hits.length > 6 && <span className="pill">+{m.hits.length - 6} more</span>}
                        {j.scope.groups.map((g) => (
                          <span className="pill" key={g}>
                            {g} · group match
                          </span>
                        ))}
                        {(mode === "eligibility" ? j.eligibility : j.scope).unknown && (
                          <span className="pill amber">Scope unknown</span>
                        )}
                        {(mode === "eligibility" ? j.eligibility : j.scope).uncertain && (
                          <span className="pill amber">Restrictions need review</span>
                        )}
                      </div>
                      <details>
                        <summary>Location evidence & details</summary>
                        <p>Listed location: {j.scope.raw || "Not supplied"}</p>
                        <p>Candidate scope: {j.eligibility.raw || "Not supplied; no eligibility assumed"}</p>
                        <p>{j.summary}</p>
                        <a href={j.url} target="_blank" rel="noreferrer">
                          View original on {catalog.find((c) => c.id === j.source)?.name} <ArrowUpRight size={12} />
                        </a>
                      </details>
                      <div className="job-actions">
                        {st !== "applied" && (
                          <button
                            className="act-on"
                            disabled={marking.includes(j.id)}
                            onClick={() => doMark(j.id, "applied")}
                          >
                            Mark applied
                          </button>
                        )}
                        {st !== "cancelled" && (
                          <button disabled={marking.includes(j.id)} onClick={() => doMark(j.id, "cancelled")}>
                            Mark cancelled
                          </button>
                        )}
                        {st !== "ignored" && (
                          <button disabled={marking.includes(j.id)} onClick={() => doMark(j.id, "ignored")}>
                            Ignore
                          </button>
                        )}
                        {st !== "listed" && (
                          <button disabled={marking.includes(j.id)} onClick={() => doMark(j.id, "listed")}>
                            Back to listed
                          </button>
                        )}
                        {marking.includes(j.id) && <Spinner size={15} className="act-spin" />}
                      </div>
                    </div>
                  </motion.article>
                );
              })}
            </AnimatePresence>
          </div>
        )}
        {shown < total && (
          <div ref={moreRef} className="m-more">
            <Spinner size={16} /> Showing {Math.min(shown, total)} of {total} — scroll for more
          </div>
        )}
        <details className="definitions">
          <summary>How countries and groups are defined</summary>
          <p>
            249 ISO 3166-1 countries and territories, plus Kosovo (XK, user-assigned). Geographic regions and subregions
            come from world-countries. EU and EEA use explicit memberships. EMEA, APAC, LATAM, and MENA are editable
            application conventions, not universal employer definitions. Time-zone and complex restriction text requires
            review.
          </p>
          {country && <p>{name} is excluded — listings that name it are hidden.</p>}
        </details>
      </section>
    </div>
  );
}
