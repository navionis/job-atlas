"use client";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowUpRight } from "lucide-react";
import { FadeIn, EASE } from "../../components/motion";
import { countries, groups } from "../../lib/geo";
import { catalog } from "../../lib/catalog";
import { useLiveData } from "../../lib/live";
import { Favicon } from "../../components/favicon";
import type { JobStatus, Snapshot } from "../../lib/types";

export default function DashboardClient({ initial }: { initial: Snapshot }) {
  const { data } = useLiveData(initial);
  const stOf = (id: string) => (data.statuses || {})[id]?.status || "listed";
  const countSt = (s: JobStatus) => data.jobs.filter((j) => stOf(j.id) === s).length;
  const srcRows = catalog
    .filter((c) => c.implemented)
    .map((c) => ({ id: c.id, name: c.name, n: data.jobs.filter((j) => j.source === c.id).length }))
    .filter((r) => r.n > 0)
    .sort((a, b) => b.n - a.n);
  const maxSrc = Math.max(1, ...srcRows.map((r) => r.n));
  const compRows = [
    ...data.jobs.reduce((m, j) => m.set(j.company, (m.get(j.company) || 0) + 1), new Map<string, number>()),
  ]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  const maxComp = Math.max(1, ...compRows.map((r) => r[1]));
  return (
    <>
      <section className="hero">
        <FadeIn className="hero-copy">
          <div className="eyebrow">GLOBAL JOB DISCOVERY</div>
          <h1>
            Your next chapter.
            <br />
            <em>Find your place.</em>
          </h1>
          <p>Explore work by country, region, and the places employers actually include in their listings.</p>
          <div className="hero-cta">
            <Link className="primary" href="/jobs">
              Explore listings
            </Link>
            <Link className="ghost" href="/sources">
              View sources
            </Link>
          </div>
        </FadeIn>
        <FadeIn className="hero-visual" delay={0.15} y={24}>
          <div aria-hidden="true" style={{ position: "relative" }}>
            <div className="v-card">
              <div className="v-head">
                <span className="v-dot" />
                LIVE FEED
              </div>
              {[64, 88, 74, 80].map((w, i) => (
                <div className="v-row" key={i}>
                  <span className="v-icon" />
                  <div className="v-lines">
                    <i style={{ width: w + "%" }} />
                    <i style={{ width: w * 0.55 + "%" }} />
                  </div>
                </div>
              ))}
              <div className="v-foot">
                <span>
                  <b>{data.jobs.length}</b> listings indexed
                </span>
                <span>
                  <b>{data.sources.filter((s) => s.status === "connected").length}</b> feeds live
                </span>
              </div>
            </div>
            <span className="chip a">{countries.length} countries</span>
            <span className="chip b">
              Remote <ArrowUpRight size={11} />
            </span>
            <span className="chip c">Worldwide</span>
          </div>
        </FadeIn>
      </section>
      <FadeIn className="metrics" delay={0.25} y={8}>
        <span>
          <b>{countries.length}</b> countries & territories
        </span>
        <span>
          <b>{Object.keys(groups).length}</b> geographic groups
        </span>
        <span>
          <b>{data.sources.filter((s) => s.status === "connected").length}</b> connected feeds
        </span>
        <span className="last">
          {data.updatedAt
            ? `Latest fetch ${new Date(data.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
            : "Waiting for first fetch"}
        </span>
      </FadeIn>
      <section className="dash">
        <div className="section-title">
          <div>
            <h2>Pipeline overview</h2>
            <p>{`${data.jobs.length} listings across ${data.sources.filter((s) => s.status === "connected").length} connected feeds`}</p>
          </div>
          <span className="pill green">Live</span>
        </div>
        <div className="dash-grid">
          {(
            [
              [data.jobs.length, "Total listings"],
              [countSt("listed"), "Listed"],
              [countSt("applied"), "Applied"],
              [countSt("cancelled"), "Cancelled"],
              [countSt("ignored"), "Ignored"],
              [data.jobs.filter((j) => j.remote).length, "Remote"],
              [data.sources.filter((s) => s.status === "connected").length, "Feeds connected"],
            ] as [number, string][]
          ).map(([v, l], i) => (
            <motion.div
              className="stat"
              key={l}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 + i * 0.05, ease: EASE }}
            >
              <b>{v}</b>
              <span>{l}</span>
            </motion.div>
          ))}
        </div>
        <div className="dash-cols">
          <FadeIn className="panel" delay={0.55}>
            <h3>Listings by source</h3>
            {srcRows.length ? (
              srcRows.map((r) => (
                <div className="bar-row" key={r.name}>
                  <span className="name">
                    <Favicon source={r.id} size={14} />
                    {r.name}
                  </span>
                  <div className="track">
                    <div className="fill" style={{ width: `${(r.n / maxSrc) * 100}%` }} />
                  </div>
                  <span className="num">{r.n}</span>
                </div>
              ))
            ) : (
              <p>No listings yet.</p>
            )}
          </FadeIn>
          <FadeIn className="panel" delay={0.65}>
            <h3>Top companies</h3>
            {compRows.length ? (
              compRows.map(([c, n], i) => (
                <div className="bar-row co" key={c}>
                  <span className="co-ico">{c.slice(0, 2).toUpperCase()}</span>
                  <span className="name">
                    <i className="co-rank">{String(i + 1).padStart(2, "0")}</i>
                    {c}
                  </span>
                  <div className="track">
                    <div className="fill" style={{ width: `${(n / maxComp) * 100}%` }} />
                  </div>
                  <span className="num">{n}</span>
                </div>
              ))
            ) : (
              <p>No listings yet.</p>
            )}
          </FadeIn>
        </div>
        <FadeIn className="panel" delay={0.75}>
          <h3>Latest listings</h3>
          {data.jobs.slice(0, 8).map((j) => (
            <a className="mini" key={j.id} href={j.url} target="_blank" rel="noreferrer">
              <span className="mini-fav">
                <Favicon source={j.source} size={16} />
              </span>
              <span className="mini-text">
                <b>{j.title}</b>
                <small>
                  {j.company} · {j.location}
                </small>
              </span>
              <span className="mini-meta">
                <span className="src-name">{catalog.find((c) => c.id === j.source)?.name || j.source}</span>
                <small>{j.posted ? new Date(j.posted).toLocaleDateString() : "—"}</small>
              </span>
              <ArrowUpRight size={14} className="mini-arrow" />
            </a>
          ))}
        </FadeIn>
      </section>
    </>
  );
}
