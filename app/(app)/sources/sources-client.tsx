"use client";
import Link from "next/link";
import { ArrowUpRight, Rss, Settings2 } from "lucide-react";
import { FadeIn } from "../../../components/motion";
import { catalog } from "../../../lib/catalog";
import { Favicon } from "../../../components/favicon";
import { useLiveData } from "../../../lib/live";
import { statusTier, statusTone } from "../../../lib/source-status";
import type { Snapshot } from "../../../lib/types";

export default function SourcesClient({ initial, canAdmin }: { initial: Snapshot; canAdmin: boolean }) {
  const { data } = useLiveData(initial);
  const rows = [...data.sources].sort((a, b) => statusTier(a.status) - statusTier(b.status) || b.count - a.count);
  const configured = rows.filter((s) => s.status !== "not configured");
  const live = configured.filter((s) => s.status === "connected").length;
  const research = catalog.filter((c) => !c.implemented);
  const catOf = (id: string) => catalog.find((c) => c.id === id.split(":")[0]);
  return (
    <FadeIn className="pf-wrap">
      <div className="section-title">
        <div>
          <h2>
            <Rss size={17} /> Connected sources
          </h2>
          <p>Live health for every configured feed — listing counts, freshness, and next refresh.</p>
        </div>
        <span className="pill">
          {live} live · {data.jobs.length} listings
        </span>
      </div>
      <div className="src-grid">
        {configured.map((s) => {
          const c = catOf(s.id);
          return (
            <div className="pf-card src-card" key={s.id}>
              <div className="src-card-head">
                {c?.url ? (
                  <a className="src-link" href={c.url} target="_blank" rel="noreferrer">
                    <Favicon source={c.id} size={15} /> {s.name} <ArrowUpRight size={12} />
                  </a>
                ) : (
                  <span className="src-link">
                    <Favicon source={s.id.split(":")[0]} size={15} /> {s.name}
                  </span>
                )}
                <span className={"pill" + (statusTone(s.status) ? " " + statusTone(s.status) : "")}>{s.status}</span>
              </div>
              <div className="src-card-stats">
                <span>
                  <b>{s.count}</b> jobs
                </span>
                <span>fetched {s.fetchedAt ? new Date(s.fetchedAt).toLocaleString() : "—"}</span>
                {s.nextFetch > 0 && (
                  <span>
                    next {new Date(s.nextFetch).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
              </div>
              {s.detail && <p className="pf-hint">{s.detail}</p>}
              {c && (
                <small>
                  {c.coverage} · {c.cadence}
                </small>
              )}
            </div>
          );
        })}
      </div>
      {!configured.length && <p className="pf-hint">No feeds configured yet.</p>}
      <div className="src-foot">
        <span>
          {rows.length - configured.length} configured-but-idle slots · {research.length} catalog entries under research
        </span>
        {canAdmin && (
          <Link className="src-link" href="/admin/sources">
            <Settings2 size={13} /> Manage feeds in Admin
          </Link>
        )}
      </div>
    </FadeIn>
  );
}
