"use client";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Upload, Trash2, FileText, Plus, X, User, ListPlus, Pencil, Check } from "lucide-react";
import { Spinner } from "../../../components/loader";
import { FadeIn } from "../../../components/motion";
import { updateProfileMeta } from "../../../lib/live";
import { FiltersPanel } from "../../../components/filters-panel";
import type { DiscoverFilters } from "../../../lib/types";
import type { Session } from "../../../lib/auth";
export type ResumeRow = {
  id: string;
  name: string;
  alias?: string;
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
  filters: Partial<DiscoverFilters>;
};
function KwAdd({
  onAdd,
  placeholder,
  disabled,
  className = "kw-add",
  label,
}: {
  onAdd: (ks: string[]) => void;
  placeholder: string;
  disabled?: boolean;
  className?: string;
  label?: string;
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
    <div className={className}>
      <input
        ref={inputRef}
        aria-label={placeholder}
        placeholder={placeholder}
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") go();
        }}
      />
      <button className="ghost" onClick={go} disabled={disabled} aria-label="Add keyword">
        <Plus size={label ? 13 : 12} />
        {label}
      </button>
    </div>
  );
}
export default function ProfileClient({ me, initial }: { me: Session; initial: ProfileData }) {
  const [pf, setPf] = useState<ProfileData>(initial);
  const [busy, setBusy] = useState(false),
    [saving, setSaving] = useState(""),
    [renaming, setRenaming] = useState(""),
    [aliasVal, setAliasVal] = useState(""),
    [deleting, setDeleting] = useState(""),
    [confirming, setConfirming] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const apply = (d: Partial<ProfileData>) => {
    setPf((p) => ({ ...p, ...d }));
    updateProfileMeta({ keywords: d.keywords ?? pf.keywords, sourceRank: d.sourceRank ?? pf.sourceRank });
  };
  const upload = async (f: File) => {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const r = await fetch("/api/profile/resume", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) throw Error(d.error || "Upload failed");
      apply(d);
      toast.success(
        `"${f.name}" uploaded — ${d.resumes?.find((x: ResumeRow) => x.name === f.name)?.keywords.length ?? 0} keywords extracted`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    }
    setBusy(false);
    if (fileRef.current) fileRef.current.value = "";
  };
  const removeResume = async (id: string) => {
    if (deleting) return;
    setConfirming("");
    setDeleting(id);
    try {
      const r = await fetch("/api/profile/resume?id=" + encodeURIComponent(id), { method: "DELETE" });
      const d = await r.json();
      if (!r.ok) throw Error();
      apply(d);
      toast.success("Resume deleted");
    } catch {
      toast.error("Delete failed — try again");
    }
    setDeleting("");
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
      toast.error("Could not save changes");
    }
    setSaving("");
  };
  const saveAlias = async (id: string) => {
    if (saving) return;
    setSaving("rn:" + id);
    try {
      const r = await fetch("/api/profile/resume", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, alias: aliasVal }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error || "Rename failed");
      apply(d);
      setRenaming("");
      toast.success(aliasVal.trim() ? "Alias saved" : "Alias cleared");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Rename failed");
    }
    setSaving("");
  };
  const filters: DiscoverFilters = {
    country: pf.filters.country || "",
    group: pf.filters.group || "",
    mode: pf.filters.mode || "location",
    source: pf.filters.source || "",
    sched: pf.filters.sched || "",
    statusFilter: pf.filters.statusFilter || "listed",
    remote: pf.filters.remote === "onsite" ? "onsite" : pf.filters.remote ? "remote" : "",
    remoteTo: pf.filters.remoteTo || "",
    unknown: !!pf.filters.unknown,
    query: pf.filters.query || "",
  };
  const setFilters = (patch: Partial<DiscoverFilters>) => put({ filters: { ...pf.filters, ...patch } }, "filters");
  const resetFilters = () => put({ filters: {} }, "filters");
  const addKw = (ks: string[]) => {
    const fresh = ks.filter((k) => !pf.manual.includes(k));
    if (fresh.length)
      put({ keywords: [...pf.manual, ...fresh], excluded: pf.excluded.filter((x) => !fresh.includes(x)) }, "kw:manual");
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
          {busy ? <Spinner size={14} /> : <Upload size={14} />} {busy ? "Processing…" : "Upload resume"}
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
                  {renaming === r.id ? (
                    <div className="alias-edit">
                      <input
                        autoFocus
                        value={aliasVal}
                        placeholder={r.name}
                        maxLength={80}
                        onChange={(e) => setAliasVal(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void saveAlias(r.id);
                          if (e.key === "Escape") setRenaming("");
                        }}
                      />
                      <button
                        className="ghost"
                        disabled={!!saving}
                        onClick={() => void saveAlias(r.id)}
                        title="Save alias"
                      >
                        {saving === `rn:${r.id}` ? <Spinner size={12} /> : <Check size={12} />}
                      </button>
                    </div>
                  ) : (
                    <b>{r.alias || r.name}</b>
                  )}
                  <small>
                    {r.alias ? `${r.name} · ` : ""}
                    {fmt(r.size)} · {r.chars.toLocaleString()} chars captured ·{" "}
                    {new Date(r.uploadedAt).toLocaleString()}
                  </small>
                  <small>{r.keywords.length} keywords extracted</small>
                </div>
                <button
                  className="resume-del edit"
                  disabled={busy || !!saving || !!deleting}
                  onClick={() => {
                    setRenaming(r.id);
                    setAliasVal(r.alias || "");
                  }}
                  title="Rename alias"
                >
                  <Pencil size={13} />
                </button>
                {confirming === r.id ? (
                  <>
                    <button
                      className="src-toggle"
                      disabled={busy || !!deleting}
                      onClick={() => void removeResume(r.id)}
                    >
                      {deleting === r.id ? <Spinner size={11} /> : null}
                      Confirm delete
                    </button>
                    <button
                      className="resume-del edit"
                      disabled={busy || !!deleting}
                      onClick={() => setConfirming("")}
                      title="Cancel"
                    >
                      <X size={13} />
                    </button>
                  </>
                ) : (
                  <button
                    className="resume-del"
                    disabled={busy || !!deleting}
                    onClick={() => setConfirming(r.id)}
                    title="Delete resume"
                  >
                    {deleting === r.id ? <Spinner size={14} /> : <Trash2 size={14} />}
                  </button>
                )}
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
          Keywords are grouped by the resume they came from, plus a manual group. In Discover jobs each resume and the
          manual group get their own ranked tab — the Profile and All listings tabs never use them. Remove a keyword
          with ×, or add to a group below it.
        </p>
        {pf.resumes.length === 0 && pf.manual.length === 0 && (
          <p className="pf-hint">No keywords yet — upload a resume or add manual ones below.</p>
        )}
        {pf.resumes.map((r) => (
          <div className="kw-group" key={r.id}>
            <div className="kw-group-head">
              <FileText size={12} /> {r.alias || r.name}
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
          <KwAdd
            className="kw-input"
            label="Add"
            disabled={!!saving}
            placeholder="Add keywords — e.g. typescript, node.js"
            onAdd={addKw}
          />
        </div>
      </div>
      <div className="pf-card" id="filters">
        <div className="pf-card-head">
          <h3>Search preferences</h3>
          <span className="pill">
            {saving === "filters" && <Spinner size={12} />}
            {saving === "filters" ? "Saving…" : "Applied in Discover"}
          </span>
        </div>
        <p className="pf-hint">
          Your default filters for Discover jobs — saved to your profile and applied automatically wherever you sign in.
        </p>
        <div className="fp-grid">
          <FiltersPanel value={filters} onChange={setFilters} onReset={resetFilters} busy={saving === "filters"} />
        </div>
      </div>
    </FadeIn>
  );
}
