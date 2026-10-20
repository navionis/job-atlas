"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { motion } from "motion/react";
import { Search, MapPin, ArrowUpRight, CalendarDays, Compass, FileText, User, X } from "lucide-react";
import { Spinner } from "../../../components/loader";
import { Select } from "../../../components/select";
import { EASE } from "../../../components/motion";
import { countries, scopeMatches } from "../../../lib/geo";
import { sourceName } from "../../../lib/catalog";
import { useLiveData, useLiveProfileMeta, refresh, useServerClock } from "../../../lib/live";
import { rankJobs, type JobMatch } from "../../../lib/match";
import { PillTabs } from "../../../components/pill-tabs";
import { JobHead, RemotePill, HitPills, JobActions } from "../../../components/job-parts";
import type { Snapshot, JobsMeta } from "../../../lib/types";

const PAGE = 15;
const STAGES = [
  ["listed", "Listed"],
  ["applied", "Applied"],
  ["cancelled", "Cancelled"],
  ["ignored", "Ignored"],
  ["all", "All"],
] as const;
type JobStatus = (typeof STAGES)[number][0];
const DAY_HOURS: [value: string, label: string, hours: number][] = [
  ["", "All time", 0],
  ["24h", "Last 24h", 24],
  ["48h", "Last 48h", 48],
  ["3d", "Last 3 days", 72],
  ["7d", "Last week", 168],
  ["14d", "Last 2 weeks", 336],
  ["30d", "Last month", 720],
  ["90d", "Last 3 months", 2160],
];
const DAYS = DAY_HOURS.map(([value, label]) => ({ value, label }));
const LEGACY_DAYS: Record<string, string> = { today: "24h", yesterday: "48h" };

export default function JobsClient({ initial, meta }: { initial: Snapshot; meta: JobsMeta }) {
  const guest = !!meta.guest;
  const router = useRouter();
  const { data, loading, error } = useLiveData(initial);
  const { sourceRank: srcRank } = useLiveProfileMeta(meta, !guest);
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
  const defaultTab = guest ? "all" : "profile";
  const validMatch = (v: string | null): v is string =>
    !guest &&
    (v === "all" ||
      v === "profile" ||
      (v === "manual" && meta.manual.length > 0) ||
      meta.resumes.some((r) => r.id === v));
  const validStatus = (v: string | null): v is JobStatus => STAGES.some(([s]) => s === v);
  const tab = validMatch(sp.get("match")) ? sp.get("match")! : defaultTab;
  const statusFilter: JobStatus = validStatus(sp.get("status")) ? (sp.get("status") as JobStatus) : "listed";
  const rawDays = sp.get("days");
  const days = LEGACY_DAYS[rawDays || ""] || (DAYS.some((d) => d.value === rawDays) ? rawDays! : "");
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
  const [shown, setShown] = useState(PAGE);
  const pendingScroll = useRef<{ y: number; shown: number } | null>(null);
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
  const now = useServerClock(data.serverAt, initial.serverAt || 0);
  // Rolling windows anchored to server time — "Last 24h" means the past 24
  // hours, so jobs marked applied/cancelled today aren't dropped just because
  // they were posted before midnight.
  const cutoff = useMemo(
    () => (days && now ? now - (DAY_HOURS.find(([v]) => v === days)?.[2] || 720) * 3600000 : 0),
    [days, now],
  );
  const preStatus = useMemo(
    () =>
      data.jobs
        .filter((j) => {
          if (
            terms.length &&
            !terms.some((t) => `${j.title} ${j.company} ${j.tags.join(" ")}`.toLowerCase().includes(t))
          )
            return false;
          if (cutoff) {
            // Recency by either measure: a job qualifies when it was posted in
            // the window OR its pipeline status changed in the window — the
            // Applied tab must find jobs applied today however old the post.
            const recentPost = Date.parse(j.posted) >= cutoff;
            const recentMark = (statuses[j.id]?.at || 0) >= cutoff;
            if (!recentPost && !recentMark) return false;
          }
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
    [data.jobs, statuses, terms, tab, country, group, source, remote, remoteTo, sched, mode, unknown, srcRank, cutoff],
  );
  const counts = useMemo(() => {
    const c: Record<string, number> = { listed: 0, applied: 0, cancelled: 0, ignored: 0 };
    for (const j of preStatus) {
      const se = statuses[j.id];
      const st = se?.status || "listed";
      if (!(st in c)) continue;
      if (cutoff) {
        const ok = st === "listed" ? Date.parse(j.posted) >= cutoff : (se?.at || 0) >= cutoff;
        if (!ok) continue;
      }
      c[st]++;
    }
    return c;
  }, [preStatus, statuses, cutoff]);
  const filtered = useMemo(() => {
    let list =
      statusFilter === "all"
        ? preStatus
        : preStatus.filter((j) => (statuses[j.id]?.status || "listed") === statusFilter);
    // The date window targets the active tab's own timestamp: Applied means
    // *applied* in the window, Listed means *posted* in it, All means either.
    if (cutoff && statusFilter === "listed") list = list.filter((j) => Date.parse(j.posted) >= cutoff);
    else if (cutoff && statusFilter !== "all") list = list.filter((j) => (statuses[j.id]?.at || 0) >= cutoff);
    if (statusFilter === "applied" || statusFilter === "cancelled" || statusFilter === "ignored")
      return [...list].sort((a, b) => (statuses[b.id]?.at || 0) - (statuses[a.id]?.at || 0));
    return list;
  }, [preStatus, statusFilter, statuses, cutoff]);
  const ranked = useMemo(() => {
    if (!matched) return [];
    const r = meta.resumes.find((x) => x.id === tab);
    return rankJobs(filtered, r ? r.keywords : meta.manual, meta.excluded, srcRank);
  }, [matched, tab, filtered, meta.resumes, meta.manual, meta.excluded, srcRank]);
  const total = matched ? ranked.length : filtered.length;
  // Snapshot scroll + loaded count when leaving for a detail page; on return
  // both are restored so the browser can land at the exact spot.
  const openJob = (href: string) => {
    try {
      sessionStorage.setItem(
        `ja:scroll:${location.pathname}${location.search}`,
        JSON.stringify({ y: window.scrollY, shown }),
      );
    } catch {}
    router.push(href);
  };
  const didRestore = useRef(false);
  useEffect(() => {
    if (didRestore.current) return;
    didRestore.current = true;
    try {
      const key = `ja:scroll:${location.pathname}${location.search}`;
      const raw = sessionStorage.getItem(key);
      if (!raw) return;
      sessionStorage.removeItem(key);
      const saved = JSON.parse(raw);
      if (typeof saved?.y !== "number" || saved.y <= 0) return;
      pendingScroll.current = { y: saved.y, shown: Math.min(saved.shown || PAGE, 500) };
      // Grow the list back to its previous depth inside a frame callback —
      // direct setState in an effect body is a cascading-render violation.
      requestAnimationFrame(() => setShown((n) => Math.max(n, pendingScroll.current?.shown ?? n)));
    } catch {}
  }, []);
  // Scroll only once the DOM is tall enough — either the saved depth is
  // rendered or the (shrunken) list has been fully rendered.
  useEffect(() => {
    const p = pendingScroll.current;
    if (p == null || (shown < p.shown && shown < total)) return;
    pendingScroll.current = null;
    window.scrollTo(0, p.y);
  }, [shown, total]);
  const display: { j: (typeof filtered)[number]; m?: JobMatch }[] = matched
    ? ranked.slice(0, shown).map((m) => ({ j: m.job, m }))
    : filtered.slice(0, shown).map((j) => ({ j }));
  const activeResume = meta.resumes.find((r) => r.id === tab);
  const chips = [
    group && `Region: ${group}`,
    country && `Excludes ${name}`,
    mode === "eligibility" && "Candidate eligibility",
    source && `Source: ${sourceName(source)}`,
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
          {!guest && (
            <>
              <PillTabs
                value={tab}
                onChange={setTab}
                ariaLabel="Match source"
                options={[
                  { value: "profile", label: "Profile", icon: <User size={13} /> },
                  { value: "all", label: "All listings" },
                  ...meta.resumes.map((r) => ({
                    value: r.id,
                    label: r.alias || r.name,
                    icon: <FileText size={13} />,
                  })),
                  ...(meta.manual.length > 0 ? [{ value: "manual", label: "Manual keywords" }] : []),
                ]}
              />
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
            </>
          )}
          <PillTabs cls="m-tabs d-tabs" value={days} onChange={setDays} options={DAYS} ariaLabel="Date posted" />
          <div className="d-view">
            <Select
              compact
              value={days}
              onChange={setDays}
              options={DAYS}
              ariaLabel="Date posted"
              icon={<CalendarDays size={13} />}
            />
          </div>
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
          {tab !== "all" && (
            <span className="pill green">{mode === "eligibility" ? "Candidate scope" : "Location matching"}</span>
          )}
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
            {display.map(({ j, m }, i) => {
              const se = statuses[j.id],
                st = se?.status || "listed",
                stAt = se?.at || 0;
              const href = `/jobs/${encodeURIComponent(j.id)}`;
              return (
                <motion.article
                  key={j.id}
                  className={"card-" + st}
                  role="link"
                  tabIndex={0}
                  aria-label={`${j.title} at ${j.company}`}
                  onClick={() => openJob(href)}
                  onMouseMove={(e) => {
                    const r = e.currentTarget.getBoundingClientRect();
                    e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
                    e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
                  }}
                  onAuxClick={(e) => {
                    if (e.button === 1) window.open(href, "_blank", "noopener");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") openJob(href);
                  }}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: Math.min(i * 0.04, 0.4), ease: EASE }}
                >
                  <JobHead j={j} m={m} st={st} stAt={stAt} now={now} />
                  <div className="job-content">
                    <h3>
                      <a
                        href={j.url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        onAuxClick={(e) => e.stopPropagation()}
                      >
                        {j.title} <ArrowUpRight size={13} />
                      </a>
                    </h3>
                    <p className="location">
                      <MapPin size={12} /> {j.location}
                    </p>
                    <div className="tags">
                      <RemotePill j={j} />
                      {(srcRank[j.source] ?? 3) >= 4 && <span className="pill">Priority feed</span>}
                      <HitPills hits={m?.hits} max={6} />
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
                    <JobActions id={j.id} st={st} guest={guest} />
                  </div>
                </motion.article>
              );
            })}
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
