"use client";
import { useState } from "react";
import { ArrowUpRight, Pause, Play } from "lucide-react";
import { FadeIn } from "../../../components/motion";
import { catalog } from "../../../lib/catalog";
import { refresh, useLiveData } from "../../../lib/live";
import { Favicon } from "../../../components/favicon";
import type { Snapshot } from "../../../lib/types";

export default function SourcesClient({ initial }: { initial: Snapshot }) {
  const { data } = useLiveData(initial);
  const [busy, setBusy] = useState<string[]>([]);
  const toggle = (id: string, disabled: boolean) => {
    setBusy((b) => [...b, id]);
    void fetch("/api/sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, disabled }),
    })
      .then(() => refresh())
      .finally(() => setBusy((b) => b.filter((x) => x !== id)));
  };
  return (
    <FadeIn className="sources">
      <div className="section-title">
        <h2>Know your sources.</h2>
        <span>Research checked October 6, 2026</span>
      </div>
      <p>
        19 connector types implemented. Nine public feeds are enabled by default. No public upstream WebSocket was
        verified. Browser updates use SSE over cached REST feeds.
      </p>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Source</th>
              <th>Access & coverage</th>
              <th>Published limits</th>
              <th>Refresh policy</th>
              <th>Connection</th>
            </tr>
          </thead>
          <tbody>
            {catalog.map((c) => (
              <tr key={c.id}>
                <td>
                  <a href={c.url} target="_blank" rel="noreferrer" className="src-link">
                    <Favicon source={c.id} size={15} /> {c.name} <ArrowUpRight size={12} />
                  </a>
                </td>
                <td>
                  {c.access}
                  <small>{c.coverage}</small>
                </td>
                <td>{c.limit}</td>
                <td>{c.cadence}</td>
                <td>
                  {c.implemented
                    ? data.sources
                        .filter((s) => s.id.split(":")[0] === c.id)
                        .map((s) => (
                          <div key={s.id} className="src-status">
                            <span className="pill">{s.status}</span>
                            {s.status !== "not configured" && (
                              <button
                                className={"src-toggle" + (s.status === "disabled" ? " off" : "")}
                                disabled={busy.includes(s.id)}
                                onClick={() => toggle(s.id, s.status !== "disabled")}
                                aria-label={s.status === "disabled" ? `Enable ${s.name}` : `Disable ${s.name}`}
                                title={s.status === "disabled" ? "Enable fetching" : "Disable fetching"}
                              >
                                {s.status === "disabled" ? <Play size={11} /> : <Pause size={11} />}
                                {s.status === "disabled" ? "Enable" : "Disable"}
                              </button>
                            )}
                            <small>
                              {s.name} · {s.count} jobs
                            </small>
                            <small>{s.detail}</small>
                            {s.nextFetch > 0 && (
                              <small>Next eligible fetch: {new Date(s.nextFetch).toLocaleString()}</small>
                            )}
                          </div>
                        ))
                    : "Research only"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </FadeIn>
  );
}
