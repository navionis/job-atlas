"use client";
import { useRef, useState } from "react";
import { Upload, Trash2, FileText, Plus, X, User, ArrowUpDown, ListPlus } from "lucide-react";
import { Spinner } from "../../../components/loader";
import { Favicon } from "../../../components/favicon";
import { FadeIn } from "../../../components/motion";
import { useSnapshot, updateProfileMeta } from "../../../lib/live";
import { Select } from "../../../components/select";
import type { Session } from "../../../lib/auth";
export type ResumeRow = {
  id: string;
  name: string;
  size: number;
  uploadedAt: number;
  chars: number;
  keywords: string[];
};
export type ProfileData = {
  keywords: string[];
  manual: string[];
  excluded: string[];
  resumes: ResumeRow[];
  sourceRank: Record<string, number>;
};
function KwAdd({
  onAdd,
  placeholder,
  disabled,
}: {
  onAdd: (ks: string[]) => void;
  placeholder: string;
  disabled?: boolean;
}) {
  const [v, setV] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const go = () => {
    if (disabled) return;
    const ks = [
      ...new Set(
        v
          .split(/[,;]+/)
          .map((x) => x.trim().toLowerCase())
          .filter(Boolean),
      ),
    ];
    if (ks.length) onAdd(ks);
    setV("");
    inputRef.current?.focus();
  };
  return (
    <div className="kw-add">
      <input
        ref={inputRef}
        placeholder={placeholder}
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") go();
        }}
      />
      <button className="ghost" onClick={go} disabled={disabled} aria-label="Add keyword">
        <Plus size={12} />
      </button>
    </div>
  );
}
export default function ProfileClient({ me, initial }: { me: Session; initial: ProfileData }) {
  const { data } = useSnapshot();
  const [pf, setPf] = useState<ProfileData>(initial);
  const [busy, setBusy] = useState(false),
    [saving, setSaving] = useState(""),
    [error, setError] = useState(""),
    [kw, setKw] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const kwRef = useRef<HTMLInputElement>(null);
  const apply = (d: Partial<ProfileData>) => {
    setPf((p) => ({ ...p, ...d }));
    updateProfileMeta({ keywords: d.keywords ?? pf.keywords, sourceRank: d.sourceRank ?? pf.sourceRank });
  };
  const upload = async (f: File) => {
    setBusy(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", f);
      const r = await fetch("/api/profile/resume", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) throw Error(d.error || "Upload failed");
      apply(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    }
    setBusy(false);
    if (fileRef.current) fileRef.current.value = "";
  };
  const removeResume = async (id: string) => {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/profile/resume?id=" + encodeURIComponent(id), { method: "DELETE" });
      const d = await r.json();
      if (!r.ok) throw Error();
      apply(d);
    } catch {
      setError("Delete failed — try again");
    }
    setBusy(false);
  };
  const put = async (body: object, key = "save") => {
    setSaving(key);
    try {
      const r = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw Error();
      apply(d);
    } catch {
      setError("Could not save changes");
    }
    setSaving("");
  };
  const addKw = () => {
    if (saving) return;
    const ks = [
      ...new Set(
        kw
          .split(/[,;]+/)
          .map((x) => x.trim().toLowerCase())
          .filter((x) => x && !pf.manual.includes(x)),
      ),
    ];
    if (!ks.length) return;
    put({ keywords: [...pf.manual, ...ks], excluded: pf.excluded.filter((x) => !ks.includes(x)) }, "kw:manual");
    setKw("");
    kwRef.current?.focus();
  };
  const fmt = (n: number) =>
    n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB";
  return (
    <FadeIn className="pf-wrap">
      <div className="section-title">
        <div>
          <h2>Your profile</h2>
          <p>Resumes, extracted keywords, and account details</p>
        </div>
        <span className="pill green">Google account</span>
      </div>
      {error && (
        <div className="alert" role="alert">
          {error}
        </div>
      )}
      <div className="pf-account">
        {me.picture ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="pf-avatar" src={me.picture} alt="" referrerPolicy="no-referrer" />
        ) : (
          <span className="pf-avatar pf-initial">
            <User size={22} />
          </span>
        )}
        <div>
          <b>{me.name || "—"}</b>
          <small>{me.email}</small>
          <small>Authentication: Google</small>
        </div>
      </div>
      <div className="pf-card">
        <div className="pf-card-head">
          <h3>Resumes</h3>
          <span className="pill">{pf.resumes.length} uploaded</span>
        </div>
        <p className="pf-hint">
          Upload a PDF, DOCX, or .txt/.md resume. The text and extracted keywords are stored with each file and you can
          delete them at any time.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.docx,.txt,.md,.text"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
          }}
        />
        <button className="primary" disabled={busy} onClick={() => fileRef.current?.click()}>
          <Upload size={14} /> {busy ? "Processing…" : "Upload resume"}
        </button>
        {pf.resumes.length === 0 ? (
          <div className="pf-empty">
            <FileText size={28} strokeWidth={1.4} />
            <p>No resumes yet.</p>
          </div>
        ) : (
          <div className="pf-resumes">
            {pf.resumes.map((r) => (
              <div className="resume-row" key={r.id}>
                <span className="resume-icon">
                  <FileText size={16} />
                </span>
                <div className="resume-meta">
                  <b>{r.name}</b>
                  <small>
                    {fmt(r.size)} · {r.chars.toLocaleString()} chars captured ·{" "}
                    {new Date(r.uploadedAt).toLocaleString()}
                  </small>
                  <small>{r.keywords.length} keywords extracted</small>
                </div>
                <button
                  className="resume-del"
                  disabled={busy}
                  onClick={() => void removeResume(r.id)}
                  title="Delete resume"
                >
                  {busy ? <Spinner size={14} /> : <Trash2 size={14} />}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="pf-card">
        <div className="pf-card-head">
          <h3>Keywords</h3>
          <span className="pill">
            {!!saving && <Spinner size={12} />}
            {saving ? "Saving…" : `${pf.keywords.length} active`}
          </span>
        </div>
        <p className="pf-hint">
          Keywords are grouped by the resume they came from, plus a manual group. They drive the default search in
          Discover jobs — typing in the search box overrides them. Remove a keyword with ×, or add to a group below it.
        </p>
        {pf.resumes.length === 0 && pf.manual.length === 0 && (
          <p className="pf-hint">No keywords yet — upload a resume or add manual ones below.</p>
        )}
        {pf.resumes.map((r) => (
          <div className="kw-group" key={r.id}>
            <div className="kw-group-head">
              <FileText size={12} /> {r.name}
              {saving === `kw:${r.id}` && <Spinner size={12} />}
              <button
                className="kw-all"
                disabled={!!saving || busy}
                onClick={() => put({ resumeExtract: { [r.id]: true } }, `kw:${r.id}`)}
                title="Re-extract all keywords from this resume's stored text"
              >
                <ListPlus size={11} /> Add all extracted
              </button>
            </div>
            <div className="kw-list">
              {r.keywords.map((k) => (
                <span className="kw-tag" key={k}>
                  {k}
                  <button
                    disabled={!!saving}
                    onClick={() => put({ resumeKeywords: { [r.id]: r.keywords.filter((x) => x !== k) } }, `kw:${r.id}`)}
                    aria-label={`Remove ${k}`}
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}
              {r.keywords.length === 0 && <span className="pf-hint">None extracted.</span>}
            </div>
            <KwAdd
              disabled={!!saving}
              placeholder="Add keywords to this resume"
              onAdd={(ks) =>
                put(
                  { resumeKeywords: { [r.id]: [...r.keywords, ...ks.filter((k) => !r.keywords.includes(k))] } },
                  `kw:${r.id}`,
                )
              }
            />
          </div>
        ))}
        <div className="kw-group">
          <div className="kw-group-head">
            Manual keywords
            {saving === "kw:manual" && <Spinner size={12} />}
          </div>
          <div className="kw-list">
            {pf.manual.map((k) => (
              <span className="kw-tag manual" key={k}>
                {k}
                <button
                  disabled={!!saving}
                  onClick={() => {
                    if (pf.manual.includes(k)) put({ keywords: pf.manual.filter((x) => x !== k) }, "kw:manual");
                    else put({ excluded: [...pf.excluded, k] }, "kw:manual");
                  }}
                  aria-label={`Remove ${k}`}
                >
                  <X size={11} />
                </button>
              </span>
            ))}
            {pf.manual.length === 0 && <span className="pf-hint">None yet.</span>}
          </div>
          <div className="kw-input">
            <input
              ref={kwRef}
              placeholder="Add keywords — e.g. typescript, node.js"
              value={kw}
              onChange={(e) => setKw(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addKw();
              }}
            />
            <button className="ghost" onClick={addKw} disabled={!!saving}>
              <Plus size={13} /> Add
            </button>
          </div>
        </div>
      </div>
      <div className="pf-card">
        <div className="pf-card-head">
          <h3>Source ranking</h3>
          <span className="pill">
            {saving.startsWith("rank:") ? <Spinner size={12} /> : <ArrowUpDown size={11} />}
            {saving.startsWith("rank:") ? "saving" : "ordering"}
          </span>
        </div>
        <p className="pf-hint">
          Rank each feed 1–5. Discover jobs sorts listings from your highest-ranked sources first, then by date. Unset
          sources default to 3.
        </p>
        {data.sources.length === 0 ? (
          <p className="pf-hint">No feeds connected yet.</p>
        ) : (
          <div className="pf-resumes">
            {[...data.sources]
              .sort((a, b) => b.count - a.count)
              .map((s) => {
                const key = s.id.split(":")[0],
                  rank = pf.sourceRank[key] ?? 3;
                return (
                  <div className="resume-row" key={s.id}>
                    <span className="resume-icon rank-badge">{rank}</span>
                    <div className="resume-meta">
                      <b className="src-name">
                        <Favicon source={key} size={15} /> {s.name}
                      </b>
                      <small>
                        {s.count} jobs · {s.status}
                      </small>
                    </div>
                    <Select
                      compact
                      value={String(rank)}
                      disabled={!!saving || busy}
                      onChange={(v) => put({ sourceRank: { ...pf.sourceRank, [key]: Number(v) } }, `rank:${key}`)}
                      ariaLabel={`Rank for ${s.name}`}
                      options={[5, 4, 3, 2, 1].map((n) => ({
                        value: String(n),
                        label: `${n} — ${n === 5 ? "Top" : n === 4 ? "High" : n === 3 ? "Normal" : n === 2 ? "Low" : "Bottom"}`,
                      }))}
                    />
                    {saving === `rank:${key}` ? (
                      <Spinner size={14} className="rank-spin" />
                    ) : (
                      <span className="rank-spin-slot" />
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </FadeIn>
  );
}
