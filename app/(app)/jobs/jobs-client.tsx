"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { Search, MapPin, ArrowUpRight, Compass, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { EASE } from "../../../components/motion";
import { countries, groups, scopeMatches } from "../../../lib/geo";
import { catalog } from "../../../lib/catalog";
import { useLiveData, useLiveProfileMeta, mark } from "../../../lib/live";
import { Select } from "../../../components/select";
import type { Snapshot } from "../../../lib/types";

export default function JobsClient({
  initial,
  meta,
}: {
  initial: Snapshot;
  meta: { keywords: string[]; sourceRank: Record<string, number> };
}) {
  const { data, loading, error } = useLiveData(initial);
  const { keywords: profileKw, sourceRank: srcRank } = useLiveProfileMeta(meta);
  const [country, setCountry] = useState(""),
    [group, setGroup] = useState(""),
    [query, setQuery] = useState(""),
    [source, setSource] = useState(""),
    [remote, setRemote] = useState(false),
    [sched, setSched] = useState(""),
    [statusFilter, setStatusFilter] = useState("listed"),
    [mode, setMode] = useState("location"),
    [unknown, setUnknown] = useState(false),
    [page, setPage] = useState(1),
    [marking, setMarking] = useState<string[]>([]);
  const doMark = (id: string, st: "listed" | "applied" | "cancelled" | "ignored") => {
    setMarking((m) => [...m, id]);
    void mark(id, st).finally(() => setMarking((m) => m.filter((x) => x !== id)));
  };
  const filterKey = [country, group, query, source, remote, sched, statusFilter, mode, unknown].join("|");
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setPage(1);
  }
  useEffect(() => {
    try {
      const f = JSON.parse(localStorage.getItem("atlas-filters") || "{}");
      if (f.country) setCountry(f.country);
      if (f.group) setGroup(f.group);
      if (f.mode) setMode(f.mode);
      if (f.source) setSource(f.source);
      if (f.sched) setSched(f.sched);
      if (f.statusFilter) setStatusFilter(f.statusFilter);
      if (f.remote) setRemote(true);
      if (f.unknown) setUnknown(true);
      if (f.query) setQuery(f.query);
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(
        "atlas-filters",
        JSON.stringify({ country, group, mode, source, sched, statusFilter, remote, unknown, query }),
      );
    } catch {}
  }, [country, group, mode, source, sched, statusFilter, remote, unknown, query]);
  const selected = country || group;
  const terms = useMemo(
    () => (query ? [query.toLowerCase()] : profileKw.map((k) => k.toLowerCase())),
    [query, profileKw],
  );
  const filtered = useMemo(
    () =>
      data.jobs
        .filter((j) => {
          if ((source && j.source !== source) || (remote && !j.remote)) return false;
          if (sched) {
            const t = `${j.title} ${j.tags.join(" ")} ${j.summary}`.toLowerCase();
            if (!new RegExp(sched + "[\\s-]?time").test(t)) return false;
          }
          const st = (data.statuses || {})[j.id]?.status || "listed";
          if (statusFilter !== "all" && st !== statusFilter) return false;
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
    [data, terms, country, group, source, remote, sched, statusFilter, mode, unknown, srcRank],
  );
  const countryOptions = countries.filter((c) => !group || groups[group]?.includes(c.code));
  const name = countries.find((c) => c.code === country)?.name || group || "Everywhere";
  const reset = () => {
    setCountry("");
    setGroup("");
    setQuery("");
    setSource("");
    setRemote(false);
    setSched("");
    setStatusFilter("listed");
    setUnknown(false);
    setMode("location");
  };
  return (
    <div className="workspace" id="listings">
      <aside>
        <div className="filter-title">
          Find your place <button onClick={reset}>Reset</button>
        </div>
        <label>
          REGION OR GROUP
          <Select
            ariaLabel="Region or group"
            value={group}
            onChange={(v) => {
              setGroup(v);
              setCountry("");
            }}
            options={[
              { value: "", label: "All regions" },
              ...Object.keys(groups)
                .sort()
                .map((g) => ({ value: g, label: g })),
            ]}
          />
        </label>
        <label>
          EXCLUDE COUNTRY
          <Select
            ariaLabel="Country or territory"
            value={country}
            onChange={setCountry}
            options={[
              { value: "", label: "No exclusion" },
              ...(country && !countryOptions.some((c) => c.code === country)
                ? [
                    {
                      value: country,
                      label: `${countries.find((c) => c.code === country)?.name} (selected)`,
                    },
                  ]
                : []),
              ...countryOptions.map((c) => ({ value: c.code, label: `${c.name} · ${c.code}` })),
            ]}
          />
        </label>
        <label>
          MATCH AGAINST
          <Select
            ariaLabel="Match against"
            value={mode}
            onChange={setMode}
            options={[
              { value: "location", label: "Listed location" },
              { value: "eligibility", label: "Candidate eligibility" },
            ]}
          />
        </label>
        <label>
          SOURCE
          <Select
            ariaLabel="Source"
            value={source}
            onChange={setSource}
            options={[
              { value: "", label: "All connected sources" },
              ...catalog.filter((c) => c.implemented).map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
        </label>
        <label>
          FULL / PART TIME
          <Select
            ariaLabel="Schedule"
            value={sched}
            onChange={setSched}
            options={[
              { value: "", label: "Any schedule" },
              { value: "full", label: "Full-time" },
              { value: "part", label: "Part-time" },
            ]}
          />
        </label>
        <label>
          JOB STATUS
          <Select
            ariaLabel="Job status"
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: "listed", label: "Listed only" },
              { value: "applied", label: "Applied only" },
              { value: "cancelled", label: "Cancelled only" },
              { value: "ignored", label: "Ignored only" },
              { value: "all", label: "All statuses" },
            ]}
          />
        </label>
        <label className="check">
          <input type="checkbox" checked={remote} onChange={(e) => setRemote(e.target.checked)} />
          Remote only
        </label>
        <label className="check">
          <input type="checkbox" checked={unknown} onChange={(e) => setUnknown(e.target.checked)} />
          Include unknown / needs review
        </label>
        <div className="note">
          <b>Remote ≠ worldwide</b>
          <p>
            A country match is a discovery aid, not proof of work authorization. Confirm the employer’s requirements
            before applying.
          </p>
        </div>
      </aside>
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
        <div className="section-title">
          <div>
            <h2>
              Opportunities {country ? "excluding" : "in"} {name}
            </h2>
            <p>
              {loading ? "Checking available feeds…" : `${filtered.length} matching jobs in the loaded feed slices`}
            </p>
          </div>
          <span className="pill green">{mode === "eligibility" ? "Candidate scope" : "Location matching"}</span>
        </div>
        {selected && (
          <div className="coverage">
            {name} is selectable even when a provider has no coverage. Worldwide listings are included when explicitly
            labeled.{" "}
            {mode === "eligibility"
              ? "Only explicit candidate-location fields count; missing fields stay unknown."
              : "Regional matches use the group definitions below."}
          </div>
        )}
        {error && (
          <div className="alert" role="alert">
            {error}
            <button onClick={() => window.location.reload()}>Retry</button>
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
            <div className="loading" />
            <h3>Opening the atlas…</h3>
            <p>Fetching available sources. No sample jobs are mixed into results.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">
              <Compass size={44} strokeWidth={1.4} />
            </div>
            <h3>No matching listings yet.</h3>
            <p>
              This does not mean there are no jobs in {name}.<br />
              The connected sources may not cover this location.
            </p>
            <button className="primary" onClick={reset}>
              Explore all locations <ArrowUpRight size={13} />
            </button>
            <Link className="text-button" href="/sources">
              Check coverage & connect more sources
            </Link>
          </div>
        ) : (
          <div className="cards">
            <AnimatePresence mode="popLayout">
              {filtered.slice((page - 1) * 20, page * 20).map((j, i) => {
                const se = (data.statuses || {})[j.id],
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
                    <div className="company-icon">{j.company.slice(0, 2).toUpperCase()}</div>
                    <div className="job-content">
                      <div className="job-top">
                        <span>
                          {j.company} · via {catalog.find((c) => c.id === j.source)?.name || j.source}
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
                        {marking.includes(j.id) && <Loader2 className="spin act-spin" size={13} />}
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
                      </div>
                    </div>
                  </motion.article>
                );
              })}
            </AnimatePresence>
          </div>
        )}
        {filtered.length > 20 && (
          <div className="pagination">
            <button disabled={page === 1} onClick={() => setPage(page - 1)}>
              <ChevronLeft size={13} /> Previous
            </button>
            <span>
              Page {page} of {Math.ceil(filtered.length / 20)}
            </span>
            <button disabled={page * 20 >= filtered.length} onClick={() => setPage(page + 1)}>
              Next <ChevronRight size={13} />
            </button>
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
