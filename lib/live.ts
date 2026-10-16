import { useEffect, useState } from "react";
import type { JobStatus, Snapshot } from "./types";

type Snap = { data: Snapshot; loading: boolean; error: string; connection: string; touched: boolean };
type ProfileMeta = { keywords: string[]; sourceRank: Record<string, number> };

let snap: Snap = {
  data: { jobs: [], sources: [], statuses: {}, updatedAt: 0 },
  loading: true,
  error: "",
  connection: "Connecting",
  touched: false,
};
const snapSubs = new Set<(s: Snap) => void>();
let snapStarted = false;
const emit = (p: Partial<Snap>) => {
  snap = { ...snap, ...p };
  if (p.data) snap.touched = true;
  snapSubs.forEach((f) => f(snap));
};
const load = () =>
  fetch("/api/jobs")
    .then((r) => {
      if (!r.ok) throw Error();
      return r.json();
    })
    .then((d) => emit({ data: d, loading: false, error: "" }))
    .catch(() => emit({ error: "Could not load feeds. Check the server connection and retry.", loading: false }));
export function refresh() {
  return load();
}
function startSnapshot() {
  if (snapStarted) return;
  snapStarted = true;
  void load();
  const events = new EventSource("/api/events");
  events.onopen = () => emit({ connection: "Auto-updates connected" });
  events.addEventListener("snapshot", (e) => emit({ data: JSON.parse(e.data), loading: false, error: "" }));
  events.addEventListener("feed-error", () => emit({ error: "Feed refresh failed; previous results retained." }));
  events.onerror = () => emit({ connection: "Reconnecting · polling fallback" });
  setInterval(() => {
    if (events.readyState !== EventSource.OPEN) void load();
  }, 60000);
}
export function useSnapshot(): Snap {
  const [s, setS] = useState(snap);
  useEffect(() => {
    snapSubs.add(setS);
    startSnapshot();
    return () => {
      snapSubs.delete(setS);
    };
  }, []);
  return s;
}
export function useLiveData(initial: Snapshot): Snap {
  const s = useSnapshot();
  useEffect(() => {
    if (!snap.touched) emit({ data: initial });
  }, [initial]);
  const data = s.touched ? s.data : initial;
  const loading = s.loading && !data.jobs.length && !data.updatedAt;
  return { ...s, data, loading };
}
export function mark(id: string, status: JobStatus): Promise<void> {
  const cur = snap.data.statuses || {};
  emit({
    data: {
      ...snap.data,
      statuses:
        status === "listed"
          ? Object.fromEntries(Object.entries(cur).filter(([k]) => k !== id))
          : { ...cur, [id]: { status, at: Date.now() } },
    },
  });
  return fetch("/api/status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, status }),
  })
    .then(() => {})
    .catch(() => {});
}

let profileMeta: ProfileMeta = { keywords: [], sourceRank: {} };
let profileLoaded = false;
let metaTouched = false;
const profileSubs = new Set<(p: ProfileMeta) => void>();
function useProfileMeta(): ProfileMeta {
  const [p, setP] = useState(profileMeta);
  useEffect(() => {
    profileSubs.add(setP);
    if (!profileLoaded) {
      profileLoaded = true;
      fetch("/api/profile")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d) {
            profileMeta = { keywords: d.keywords || [], sourceRank: d.sourceRank || {} };
            metaTouched = true;
            profileSubs.forEach((f) => f(profileMeta));
          }
        })
        .catch(() => {});
    }
    return () => {
      profileSubs.delete(setP);
    };
  }, []);
  return p;
}
export function updateProfileMeta(p: ProfileMeta) {
  profileMeta = p;
  metaTouched = true;
  profileSubs.forEach((f) => f(p));
}
export function useLiveProfileMeta(initial: ProfileMeta): ProfileMeta {
  const p = useProfileMeta();
  return metaTouched ? p : initial;
}
