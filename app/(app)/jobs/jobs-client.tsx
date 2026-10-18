"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { Search, MapPin, ArrowUpRight, Compass, FileText, User, X } from "lucide-react";
import { Spinner } from "../../../components/loader";
import { Favicon } from "../../../components/favicon";
import { Select } from "../../../components/select";
import { EASE } from "../../../components/motion";
import { countries, scopeMatches } from "../../../lib/geo";
import { catalog } from "../../../lib/catalog";
import { useLiveData, useLiveProfileMeta, mark, refresh } from "../../../lib/live";
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
const DAYS = [
  { value: "", label: "All time" },
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Since yesterday" },
  { value: "3d", label: "Last 3 days" },
  { value: "7d", label: "Last week" },
  { value: "30d", label: "Last month" },
];

export default function JobsClient({ initial, meta }: { initial: Snapshot; meta: Meta }) {
  const { data, loading, error } = useLiveData(initial);
  const { sourceRank: srcRank } = useLiveProfileMeta(meta);
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
  const defaultTab = "profile";
  const validMatch = (v: string | null): v is string =>
    v === "all" ||
    v === "profile" ||
    (v === "manual" && meta.manual.length > 0) ||
    meta.resumes.some((r) => r.id === v);
  const validStatus = (v: string | null): v is JobStatus => STAGES.some(([s]) => s === v);
  const tab = validMatch(sp.get("match")) ? sp.get("match")! : defaultTab;
  const statusFilter: JobStatus = validStatus(sp.get("status")) ? (sp.get("status") as JobStatus) : "listed";
  const days = DAYS.some((d) => d.value === sp.get("days")) ? sp.get("days")! : "";
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
  const setDays = (v: string) => setParams({ days: v || null }, true);
  const [marking, setMarking] = useState<string[]>([]),
    [shown, setShown] = useState(PAGE);
  const moreObs = useRef<IntersectionObserver | null>(null);
  // Callback ref, not a useEffect — the sentinel mounts late whenever `total`
  // grows (SSE/poll) while `shown`/`matched` stay put, and deps-based effects
  // would never attach the observer.
  const moreRef = useCallback((el: HTMLDivElement | null) => {
    moreObs.current?.disconnect();
    moreObs.current = null;
    if (!el) return;
    const obs = new IntersectionObserver(
      (es) => {
        if (es[0].isIntersecting) setShown((n) => n + PAGE);
      },
      { rootMargin: "600px" },
    );
    obs.observe(el);
    moreObs.current = obs;
  }, []);
  const matched = tab !== "all" && tab !== "profile";
  const doMark = (id: string, st: "listed" | "applied" | "cancelled" | "ignored") => {
    setMarking((m) => [...m, id]);
    void mark(id, st).finally(() => setMarking((m) => m.filter((x) => x !== id)));
  };
  const filterKey = [
    tab,
    country,
    group,
    query,
    source,
    remote,
    remoteTo,
    sched,
    statusFilter,
    mode,
    unknown,
    days,
  ].join("|");
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setShown(PAGE);
  }
  useEffect(() => () => moreObs.current?.disconnect(), []);
  useEffect(() => {
    if (error) toast.error(error, { action: { label: "Retry", onClick: () => void refresh() } });
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
  const terms = useMemo(() => (query ? [query.toLowerCase()] : []), [query]);
  const statuses = useMemo(() => data.statuses || {}, [data.statuses]);
  const [dayCutoff, setDayCutoff] = useState(0);
  useEffect(() => {
    const t = requestAnimationFrame(() => {
      const now = new Date();
      setDayCutoff(
        !days
          ? 0
          : days === "today"
            ? new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
            : days === "yesterday"
              ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).getTime()
              : Date.now() - (days === "3d" ? 3 : days === "7d" ? 7 : 30) * 86400000,
      );
    });
    return () => cancelAnimationFrame(t);
  }, [days]);
  const preStatus = useMemo(
    () =>
      data.jobs
        .filter((j) => {
          if (
            terms.length &&
            !terms.some((t) => `${j.title} ${j.company} ${j.tags.join(" ")}`.toLowerCase().includes(t))
          )
            return false;
          if (dayCutoff && !(Date.parse(j.posted) >= dayCutoff)) return false;
          if (tab === "all") return true;
          if (source && j.source !== source) return false;
          if ((remote === "remote" && !j.remote) || (remote === "onsite" && j.remote)) return false;
          if (remoteTo && (!j.remote || !scopeMatches(j.eligibility, remoteTo))) return false;
          if (sched) {
            const t = `${j.title} ${j.tags.join(" ")} ${j.summary}`.toLowerCase();
            if (!new RegExp(sched + "[\\s-]?time").test(t)) return false;
          }
          const s = mode === "eligibility" ? j.eligibility : j.scope;
          // "Exclude country" hides listings scoped *only* to that country —
          // a Europe-wide remote role still serves an excluded-country user.
          if (country && s.countries.length === 1 && s.countries.includes(country)) return false;
          if (!group) return true;
          return scopeMatches(s, group) || (unknown && (s.unknown || s.uncertain));
        })
        .sort((a, b) => (srcRank[b.source] ?? 3) - (srcRank[a.source] ?? 3) || b.posted.localeCompare(a.posted)),
    [data.jobs, terms, tab, country, group, source, remote, remoteTo, sched, mode, unknown, srcRank, dayCutoff],
  );
  const counts = useMemo(() => {
    const c: Record<string, number> = { listed: 0, applied: 0, cancelled: 0, ignored: 0 };
    for (const j of preStatus) {
      const st = statuses[j.id]?.status || "listed";
      if (st in c) c[st]++;
    }
    return c;
  }, [preStatus, statuses]);
  const filtered = useMemo(() => {
    const list =
      statusFilter === "all"
        ? preStatus
        : preStatus.filter((j) => (statuses[j.id]?.status || "listed") === statusFilter);
    if (statusFilter === "applied" || statusFilter === "cancelled" || statusFilter === "ignored")
      return [...list].sort((a, b) => (statuses[b.id]?.at || 0) - (statuses[a.id]?.at || 0));
    return list;
  }, [preStatus, statusFilter, statuses]);
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
            placeholder="Job title, company, or keyword"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape" && query) setQuery("");
            }}
          />
          {query && (
            <button className="search-clear" onClick={() => setQuery("")} aria-label="Clear search">
              <X size={14} />
            </button>
          )}
          <span className="key">SEARCH</span>
        </div>
        <div className="pipe" role="tablist" aria-label="Pipeline stage">
          {STAGES.map(([v, l]) => (
            <button
              key={v}
              role="tab"
              aria-selected={statusFilter === v}
              className={"pipe-tab" + (statusFilter === v ? " on" : "")}
              onClick={() => setStatusFilter(v)}
            >
              {l} <b>{v === "all" ? preStatus.length : counts[v]}</b>
            </button>
          ))}
        </div>
        <div className="tabs-row">
          <div className="m-tabs" role="tablist" aria-label="Match source">
            <button
              role="tab"
              aria-selected={tab === "profile"}
              className={"m-tab" + (tab === "profile" ? " on" : "")}
              onClick={() => setTab("profile")}
            >
              <User size={13} /> Profile
            </button>
            <button
              role="tab"
              aria-selected={tab === "all"}
              className={"m-tab" + (tab === "all" ? " on" : "")}
              onClick={() => setTab("all")}
            >
              All listings
            </button>
            {meta.resumes.map((r) => (
              <button
                key={r.id}
                role="tab"
                aria-selected={tab === r.id}
                className={"m-tab" + (tab === r.id ? " on" : "")}
                onClick={() => setTab(r.id)}
              >
                <FileText size={13} /> {r.alias || r.name}
              </button>
            ))}
            {meta.manual.length > 0 && (
              <button
                role="tab"
                aria-selected={tab === "manual"}
                className={"m-tab" + (tab === "manual" ? " on" : "")}
                onClick={() => setTab("manual")}
              >
                Manual keywords
              </button>
            )}
          </div>
          <div className="m-view">
            <Select
              value={tab}
              onChange={setTab}
              ariaLabel="Match view"
              options={[
                { value: "profile", label: "Profile" },
                { value: "all", label: "All listings" },
                ...meta.resumes.map((r) => ({ value: r.id, label: r.alias || r.name })),
                ...(meta.manual.length > 0 ? [{ value: "manual", label: "Manual keywords" }] : []),
              ]}
            />
          </div>
          <Select compact value={days} onChange={setDays} options={DAYS} ariaLabel="Posted within" />
        </div>
        <div className="section-title">
          <div>
            <h2>
              {tab === "all"
                ? "All connected listings"
                : matched
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
                  : tab === "all"
                    ? `${filtered.length} jobs across all connected feeds`
                    : filtered.length === data.jobs.length
                      ? `${filtered.length} jobs`
                      : `${filtered.length} of ${data.jobs.length} jobs match your search preferences`}
            </p>
          </div>
          <span className="pill green">{mode === "eligibility" ? "Candidate scope" : "Location matching"}</span>
        </div>
        {tab !== "all" && chips.length > 0 && (
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
        {selected && tab !== "all" && (
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
            <Link href="/sources" className="alert-link">
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
            ) : tab === "all" ? (
              <>
                <h3>No listings in the loaded feeds.</h3>
                <p>The connected sources returned no jobs yet — check their status or connect more.</p>
                <Link className="primary" href="/sources">
                  Check source coverage <ArrowUpRight size={13} />
                </Link>
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
                <Link className="text-button" href="/sources">
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
                        {j.remote ? (
                          <span className="pill green">Remote</span>
                        ) : /hybrid/i.test(j.location) ? (
                          <span className="pill amber">Hybrid</span>
                        ) : (
                          <span className="pill">On-site</span>
                        )}
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
            <Spinner size={30} /> Showing {Math.min(shown, total)} of {total} — scroll for more
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
