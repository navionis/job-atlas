"use client";
import { RotateCw, Sparkles } from "lucide-react";
import type { AiRun } from "../lib/live";
import { Spinner } from "./loader";

/** Trigger + status for a Devin match run. Poll-driven; matches land on cards
 *  as "AI n" pills via useAiMatch(). */
export default function AiMatchControl({ run, onStart }: { run: AiRun; onStart: () => void }) {
  if (run.status === "running")
    return (
      <span className="pill green" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <Spinner size={12} /> Devin is ranking your jobs…
      </span>
    );
  const done = run.status === "done";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      {done && "matches" in run ? (
        <span className="pill green">AI match · {(run.matches || []).filter((m) => m.score >= 60).length} strong</span>
      ) : null}
      {run.status === "error" && "error" in run && run.error ? (
        <span className="pill amber" title={run.error}>
          AI match failed
        </span>
      ) : null}
      <button className="ghost" onClick={onStart} title="Rank current listings against your profile with Devin">
        {done || run.status === "error" ? <RotateCw size={13} /> : <Sparkles size={13} />}
        {done ? "Re-run AI match" : "AI match"}
      </button>
    </span>
  );
}
