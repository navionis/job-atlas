"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Pause, Play, ArrowUpDown, ShieldCheck, Rss, Users, UserPlus, UserMinus, ArrowUpRight } from "lucide-react";
import { FadeIn } from "../../../components/motion";
import { catalog } from "../../../lib/catalog";
import { Favicon } from "../../../components/favicon";
import { Spinner } from "../../../components/loader";
import { Select } from "../../../components/select";
import { refresh, useLiveData } from "../../../lib/live";
import type { Snapshot } from "../../../lib/types";

type AdminUser = { email: string; admin: boolean; viaEnv: boolean; marked: number };
const RANKS = [5, 4, 3, 2, 1].map((n) => ({
  value: String(n),
  label: `${n} — ${n === 5 ? "Top" : n === 4 ? "High" : n === 3 ? "Normal" : n === 2 ? "Low" : "Bottom"}`,
}));

export default function AdminClient({
  initial,
  sourceRank: initialRank,
  users: initialUsers,
  me,
}: {
  initial: Snapshot;
  sourceRank: Record<string, number>;
  users: AdminUser[];
  me: string;
}) {
  const { data } = useLiveData(initial);
  const [tab, setTab] = useState<"sources" | "users">("sources");
  const [users, setUsers] = useState(initialUsers);
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
  const setUserAdmin = (email: string, admin: boolean) => {
    setBusy((b) => [...b, email]);
    void fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, admin }),
    })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw Error(d?.error || "Could not update admins");
        if (d.users) setUsers(d.users);
        toast.success(admin ? `${email} is now an admin` : `Admin revoked for ${email}`);
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Could not update admins"))
      .finally(() => setBusy((b) => b.filter((x) => x !== email)));
  };
  const configured = data.sources.filter((s) => s.status !== "not configured");
  return (
    <FadeIn className="pf-wrap">
      <div className="section-title">
        <div>
          <h2>
            <ShieldCheck size={17} /> Admin
          </h2>
          <p>Feed control and user administration.</p>
        </div>
        <span className="pill">
          {saving ? <Spinner size={12} /> : <ArrowUpDown size={11} />}
          {saving ? "saving" : `${configured.length} feeds · ${users.length} users`}
        </span>
      </div>
      <div className="m-tabs">
        <button className={"m-tab" + (tab === "sources" ? " on" : "")} onClick={() => setTab("sources")}>
          <Rss size={13} /> Sources
        </button>
        <button className={"m-tab" + (tab === "users" ? " on" : "")} onClick={() => setTab("users")}>
          <Users size={13} /> Users
        </button>
      </div>
      {tab === "sources" && (
        <div className="pf-card">
          <p className="pf-hint">
            Enable or disable feeds and set fetch priority per provider. Disabled feeds stop fetching and hide cached
            listings. Catalog entries marked research-only have no active connector.
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
      )}
      {tab === "users" && (
        <div className="pf-card">
          <p className="pf-hint">
            Signed-in Google accounts. The first verified sign-in holds the admin seat; grant or revoke additional
            admins here. Env-listed admins can only be removed via ADMIN_EMAILS.
          </p>
          <div className="pf-resumes">
            {users.map((u) => (
              <div className="resume-row" key={u.email}>
                <span className={"resume-icon" + (u.admin ? " rank-badge" : "")}>{u.admin ? "A" : "U"}</span>
                <div className="resume-meta">
                  <b>
                    {u.email}
                    {u.email === me && <span className="pill">you</span>}
                  </b>
                  <small>
                    {u.marked} jobs marked · {u.admin ? (u.viaEnv ? "admin via ADMIN_EMAILS" : "admin") : "member"}
                  </small>
                </div>
                {u.admin ? (
                  <button
                    className="src-toggle"
                    disabled={busy.includes(u.email) || u.viaEnv || u.email === me}
                    onClick={() => setUserAdmin(u.email, false)}
                    title={
                      u.viaEnv ? "Granted via ADMIN_EMAILS" : u.email === me ? "Cannot revoke yourself" : "Revoke admin"
                    }
                  >
                    {busy.includes(u.email) ? <Spinner size={11} /> : <UserMinus size={11} />}
                    Revoke admin
                  </button>
                ) : (
                  <button
                    className="src-toggle off"
                    disabled={busy.includes(u.email)}
                    onClick={() => setUserAdmin(u.email, true)}
                  >
                    {busy.includes(u.email) ? <Spinner size={11} /> : <UserPlus size={11} />}
                    Make admin
                  </button>
                )}
              </div>
            ))}
            {users.length === 0 && <p className="pf-hint">No users yet.</p>}
          </div>
        </div>
      )}
    </FadeIn>
  );
}
