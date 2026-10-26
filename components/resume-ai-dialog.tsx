"use client";
import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Check, FileSearch, ScanText, Sparkles, X } from "lucide-react";
import { EASE } from "./motion";
import { Spinner } from "./loader";
import type { ResumeRow } from "../app/(app)/profile/profile-client";

type Phase = "starting" | "running" | "done" | "error";
type Props = {
  resume: { id: string; name: string };
  onApply: (d: { resumes?: ResumeRow[]; keywords?: string[] }) => void;
  onClose: () => void;
};

const STAGES: { key: string; label: string; icon: typeof Sparkles }[] = [
  { key: "scan", label: "Reading document text", icon: ScanText },
  { key: "agent", label: "Devin agent analyzing", icon: Sparkles },
  { key: "extract", label: "Extracting skill keywords", icon: FileSearch },
];
const POLL_MS = 4000;
const MAX_POLLS = 100; // ~7 min ceiling — a stuck session can't poll forever

/** Full-lifecycle dialog: starts the Devin resume-analysis run on mount, polls
 *  it to completion, then hands the updated profile view to the parent. The
 *  locally-extracted keywords (saved at upload) remain as the fallback on any
 *  failure — this dialog never leaves the user worse off. */
export default function ResumeAiDialog({ resume, onApply, onClose }: Props) {
  const [phase, setPhase] = useState<Phase>("starting");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [summary, setSummary] = useState("");
  const [error, setError] = useState("");
  const [step, setStep] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const onApplyRef = useRef(onApply);
  useEffect(() => {
    onApplyRef.current = onApply;
  });

  // Cosmetic stage progression while the session runs — the real gate is the
  // poll; steps just give the wait a pulse.
  useEffect(() => {
    if (phase !== "running") return;
    const t = setInterval(() => {
      setElapsed((e) => e + 4);
      setStep((s) => Math.min(s + 1, STAGES.length - 1));
    }, 4000);
    return () => clearInterval(t);
  }, [phase]);

  useEffect(() => {
    let cancelled = false;
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const fail = (msg: string) => {
      if (!cancelled) {
        setError(msg);
        setPhase("error");
      }
    };
    (async () => {
      try {
        const r = await fetch("/api/agent/resume", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resumeId: resume.id }),
        });
        const d = await r.json().catch(() => ({}));
        if (cancelled) return;
        if (!r.ok) {
          fail(
            r.status === 503
              ? "AI analysis isn't configured — locally extracted keywords are already applied."
              : d.error || "Could not start the agent",
          );
          return;
        }
        setPhase("running");
        for (let i = 0; i < MAX_POLLS; i++) {
          await wait(i ? POLL_MS : 3000);
          if (cancelled) return;
          const pr = await fetch(`/api/agent/resume?id=${encodeURIComponent(resume.id)}`);
          const pd = await pr.json().catch(() => ({}));
          if (cancelled) return;
          const st = pd.agentRun?.status;
          if (st === "done") {
            setKeywords(pd.extracted || []);
            setSummary(pd.summary || "");
            setPhase("done");
            onApplyRef.current(pd);
            return;
          }
          if (st === "error" || pd.error) {
            fail(pd.error || "Analysis failed — keeping the locally extracted keywords");
            return;
          }
        }
        fail("The agent is taking unusually long — keeping the locally extracted keywords.");
      } catch {
        fail("Could not reach the agent service — locally extracted keywords are already applied.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [resume.id]);

  const busy = phase === "starting" || phase === "running";
  return (
    <motion.div
      className="ai-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={() => !busy && onClose()}
    >
      <motion.div
        className="ai-modal"
        role="dialog"
        aria-modal="true"
        aria-label="AI resume analysis"
        initial={{ opacity: 0, scale: 0.92, y: 18 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.22, ease: EASE }}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="ai-close" onClick={onClose} disabled={busy} aria-label="Close">
          <X size={15} />
        </button>
        <div className="ai-orb">
          <Sparkles size={22} />
        </div>
        <h3>
          {phase === "done" ? "Keywords extracted" : phase === "error" ? "Couldn't finish" : "Analyzing your resume"}
        </h3>
        <p className="ai-sub">
          {busy ? (
            <>
              Devin · {resume.name} · {elapsed}s elapsed
            </>
          ) : phase === "done" ? (
            <>{keywords.length} keywords applied to this resume</>
          ) : (
            error
          )}
        </p>
        {busy && (
          <div className="ai-steps">
            {STAGES.map((s, i) => (
              <div key={s.key} className={`ai-step ${i < step ? "done" : i === step ? "on" : ""}`}>
                <span className="ai-step-ic">
                  {i < step ? <Check size={12} /> : i === step ? <Spinner size={12} /> : <s.icon size={12} />}
                </span>
                {s.label}
              </div>
            ))}
            <div className="ai-track">
              <motion.div
                className="ai-bar"
                animate={{ x: ["-100%", "100%"] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              />
            </div>
          </div>
        )}
        {phase === "done" && (
          <>
            {summary && <p className="ai-summary">“{summary}”</p>}
            <div className="ai-kws">
              {keywords.map((k, i) => (
                <motion.span
                  key={k}
                  className="kw-tag"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.03, duration: 0.2 }}
                >
                  {k}
                </motion.span>
              ))}
            </div>
            <button className="primary" onClick={onClose}>
              Done
            </button>
          </>
        )}
        {phase === "error" && (
          <button className="primary" onClick={onClose}>
            Close
          </button>
        )}
      </motion.div>
    </motion.div>
  );
}
