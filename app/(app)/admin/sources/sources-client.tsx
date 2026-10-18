"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Pause, Play, ArrowUpRight } from "lucide-react";
import { catalog } from "../../../../lib/catalog";
import { Favicon } from "../../../../components/favicon";
import { Spinner } from "../../../../components/loader";
import { Select } from "../../../../components/select";
import { refresh, useLiveData } from "../../../../lib/live";
import type { Snapshot } from "../../../../lib/types";

const RANKS = [5, 4, 3, 2, 1].map((n) => ({
  value: String(n),
  label: `${n} — ${n === 5 ? "Top" : n === 4 ? "High" : n === 3 ? "Normal" : n === 2 ? "Low" : "Bottom"}`,
}));

export default function SourcesClient({
  initial,
  sourceRank: initialRank,
}: {
  initial: Snapshot;
  sourceRank: Record<string, number>;
}) {
  const { data } = useLiveData(initial);
  const [rank, setRank] = useState(initialRank);
  const [saving, setSaving] = useState("");
  const [busy, setBusy] = useState<string[]>([]);
  const toggle = (id: string, disabled: boolean) => {
    setBusy((b) => [...b, id]);
    void fetch("/api/sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, disabled }),
    })
      .then(async (r) => {
        if (!r.ok) throw Error((await r.json().catch(() => ({})))?.error || "Could not update source");
        toast.success(disabled ? "Source disabled — listings hidden" : "Source enabled");
        return refresh();
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Could not update source"))
      .finally(() => setBusy((b) => b.filter((x) => x !== id)));
  };
  const setSourceRank = (key: string, value: number) => {
    const next = { ...rank, [key]: value };
    setRank(next);
    setSaving(`rank:${key}`);
    void fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceRank: next }),
    })
      .then((r) => {
        if (!r.ok) throw Error();
      })
      .catch(() => toast.error("Could not save ranking"))
      .finally(() => setSaving(""));
  };
  const configured = data.sources.filter((s) => s.status !== "not configured");
  const tier = (c: (typeof catalog)[number]) => {
    const st = data.sources.filter((s) => s.id.split(":")[0] === c.id);
    const count = st.reduce((n, s) => n + s.count, 0);
    const rank = st.some((s) => s.status === "connected")
      ? 0
      : st.some((s) => s.status === "loading")
        ? 1
        : st.some((s) => s.status === "stale" || s.status === "unavailable")
          ? 2
          : st.some((s) => s.status === "disabled")
            ? 3
            : c.implemented
              ? 4
              : 5;
    return { rank, count };
  };
  const rows = [...catalog].sort((a, b) => {
    const x = tier(a),
      y = tier(b);
    return x.rank - y.rank || y.count - x.count;
  });
  return (
    <>
      <div className="pf-card">
        <p className="pf-hint">
          Enable or disable feeds and set fetch priority per provider. Disabled feeds stop fetching and hide cached
          listings. Catalog entries marked research-only have no active connector.{" "}
          {saving ? "Saving…" : `${configured.length} feeds configured.`}
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
                <th>Manage</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
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
                    {c.implemented ? (
                      data.sources
                        .filter((s) => s.id.split(":")[0] === c.id)
                        .map((s) => (
                          <div key={s.id} className="src-status">
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
                    ) : (
                      <small>Research only</small>
                    )}
                  </td>
                  <td>
                    {c.implemented ? (
                      data.sources
                        .filter((s) => s.id.split(":")[0] === c.id)
                        .map((s) => {
                          const off = s.status === "disabled",
                            nc = s.status === "not configured";
                          return (
                            <div key={s.id} className="src-manage">
                              <Select
                                compact
                                value={String(rank[c.id] ?? 3)}
                                disabled={!!saving || off || nc}
                                onChange={(v) => setSourceRank(c.id, Number(v))}
                                ariaLabel={`Rank for ${s.name}`}
                                options={RANKS}
                              />
                              {!nc && (
                                <button
                                  className={"src-toggle" + (off ? " off" : "")}
                                  disabled={busy.includes(s.id)}
                                  onClick={() => toggle(s.id, !off)}
                                  aria-label={off ? `Enable ${s.name}` : `Disable ${s.name}`}
                                  title={off ? "Enable fetching" : "Disable fetching"}
                                >
                                  {busy.includes(s.id) ? (
                                    <Spinner size={11} />
                                  ) : off ? (
                                    <Play size={11} />
                                  ) : (
                                    <Pause size={11} />
                                  )}
                                  {off ? "Enable" : "Disable"}
                                </button>
                              )}
                            </div>
                          );
                        })
                    ) : (
                      <small>—</small>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
