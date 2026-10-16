"use client";
import { ArrowUpRight } from "lucide-react";
import { FadeIn } from "../../../components/motion";
import { catalog } from "../../../lib/catalog";
import { useLiveData } from "../../../lib/live";
import { Favicon } from "../../../components/favicon";
import type { Snapshot } from "../../../lib/types";

export default function SourcesClient({ initial }: { initial: Snapshot }) {
  const { data } = useLiveData(initial);
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
                          <div key={s.id}>
                            <span className="pill">{s.status}</span>
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
