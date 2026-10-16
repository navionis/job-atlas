"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight, FileText, MapPin } from "lucide-react";
import { catalog } from "../../../lib/catalog";
import { rankJobs } from "../../../lib/match";
import { useLiveData, mark } from "../../../lib/live";
import { EASE } from "../../../components/motion";
import { Favicon } from "../../../components/favicon";
import { Spinner } from "../../../components/loader";
import { Select } from "../../../components/select";
import type { Snapshot } from "../../../lib/types";

type MatchProfile = {
  resumes: { id: string; name: string; keywords: string[] }[];
  manual: string[];
  excluded: string[];
  sourceRank: Record<string, number>;
};
export default function MatchesClient({ initial, profile }: { initial: Snapshot; profile: MatchProfile }) {
  const { data } = useLiveData(initial);
  const [tab, setTab] = useState(profile.resumes[0]?.id || "manual");
  const [statusFilter, setStatusFilter] = useState("listed");
  const [shown, setShown] = useState(15);
  const [marking, setMarking] = useState<string[]>([]);
  const moreRef = useRef<HTMLDivElement>(null);
  const activeResume = profile.resumes.find((r) => r.id === tab);
  const keywords = activeResume ? activeResume.keywords : profile.manual;
  const matches = useMemo(
    () =>
      rankJobs(data.jobs, keywords, profile.excluded, profile.sourceRank).filter(
        (m) => statusFilter === "all" || ((data.statuses || {})[m.job.id]?.status || "listed") === statusFilter,
      ),
    [data.jobs, data.statuses, keywords, profile.excluded, profile.sourceRank, statusFilter],
  );
  const [prevKey, setPrevKey] = useState(tab + "|" + statusFilter);
  if (tab + "|" + statusFilter !== prevKey) {
    setPrevKey(tab + "|" + statusFilter);
    setShown(15);
  }
  useEffect(() => {
    const el = moreRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (es) => {
        if (es[0].isIntersecting) setShown((n) => n + 15);
      },
      { rootMargin: "600px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  const doMark = (id: string, st: "listed" | "applied" | "cancelled" | "ignored") => {
    setMarking((m) => [...m, id]);
    void mark(id, st).finally(() => setMarking((m) => m.filter((x) => x !== id)));
  };
  return (
    <>
      <div className="section-title" style={{ marginTop: 8 }}>
        <div>
          <h2>Resume matches</h2>
          <p>
            {activeResume
              ? `Jobs ranked against ${activeResume.name} — ${keywords.length} keywords`
              : "Jobs ranked against your manual keywords"}
          </p>
        </div>
        <div className="m-status">
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
        </div>
      </div>
      {profile.resumes.length + (profile.manual.length ? 1 : 0) > 1 && (
        <div className="m-tabs">
          {profile.resumes.map((r) => (
            <button key={r.id} className={"m-tab" + (tab === r.id ? " on" : "")} onClick={() => setTab(r.id)}>
              <FileText size={13} /> {r.name}
            </button>
          ))}
          {profile.manual.length > 0 && (
            <button className={"m-tab" + (tab === "manual" ? " on" : "")} onClick={() => setTab("manual")}>
              Manual keywords
            </button>
          )}
        </div>
      )}
      {!profile.resumes.length && !profile.manual.length && (
        <div className="empty">
          <div className="empty-icon">
            <FileText size={44} strokeWidth={1.2} />
          </div>
          <h3>No resumes or keywords yet</h3>
          <p>Upload a resume on your profile and we&apos;ll rank every listing against it.</p>
          <Link className="primary" href="/profile">
            Go to profile
          </Link>
        </div>
      )}
      {(profile.resumes.length > 0 || profile.manual.length > 0) && matches.length === 0 && (
        <div className="empty">
          <h3>No matches above the threshold</h3>
          <p>Add more resume keywords on your profile, or remove excluded terms that are filtering listings out.</p>
        </div>
      )}
      <div className="cards">
        <AnimatePresence mode="popLayout">
          {matches.slice(0, shown).map((m, i) => {
            const j = m.job;
            const se = (data.statuses || {})[j.id];
            const st = se?.status || "listed";
            const stAt = se?.at || 0;
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
                <div className="mscore" title="Keyword match score">
                  <b>{m.score}</b>
                  <span>match</span>
                  <i className="mgauge">
                    <i className="mfill" style={{ height: `${Math.min(100, m.score)}%` }} />
                  </i>
                </div>
                <div className="job-content">
                  <div className="job-top">
                    <span className="job-via">
                      {j.company} · via <Favicon source={j.source} />{" "}
                      {catalog.find((c) => c.id === j.source)?.name || j.source}
                    </span>
                    <span className="job-st">
                      {st !== "listed" && (
                        <span className={"pill" + (st === "applied" ? " green" : st === "cancelled" ? " amber" : "")}>
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
                    {(profile.sourceRank[j.source] ?? 3) >= 4 && <span className="pill">Priority feed</span>}
                    {m.hits.slice(0, 6).map((k) => (
                      <span className="pill kw-hit" key={k}>
                        {k}
                      </span>
                    ))}
                    {m.hits.length > 6 && <span className="pill">+{m.hits.length - 6} more</span>}
                  </div>
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
      {shown < matches.length && (
        <div ref={moreRef} className="m-more">
          <Spinner size={16} /> Loading more matches…
        </div>
      )}
    </>
  );
}
