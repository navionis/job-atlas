import type { ReactNode } from "react";
import { AtlasMark } from "./atlas-mark";

const BG = "linear-gradient(140deg, #0b0f19 0%, #101a33 55%, #0f2a5c 100%)";

/** Branded outer frame for generated OpenGraph images (used inside ImageResponse). */
export function OgShell({ children, pad = 72 }: { children: ReactNode; pad?: number }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: pad,
        background: BG,
        color: "#f4f7ff",
        fontFamily: "sans-serif",
      }}
    >
      {children}
    </div>
  );
}

/** Logo + wordmark row. */
export function OgBrand({ mark = 64, font = 44 }: { mark?: number; font?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: mark * 0.3 }}>
      <div
        style={{
          width: mark,
          height: mark,
          borderRadius: mark * 0.28,
          background: "#2563eb",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <AtlasMark size={mark * 0.66} color="#fff" />
      </div>
      <div style={{ fontSize: font, fontWeight: 800, letterSpacing: -1, display: "flex" }}>
        job atlas<span style={{ color: "#3b82f6" }}>.</span>
      </div>
    </div>
  );
}

/** Bottom tagline row — dot-separated capability labels. */
export function OgFoot({ items, font = 22 }: { items: string[]; font?: number }) {
  return (
    <div style={{ display: "flex", gap: 14, fontSize: font, color: "#5f739f" }}>
      {items.flatMap((item, i) =>
        i === 0 ? [<span key={item}>{item}</span>] : [<span key={"/" + item}>/</span>, <span key={item}>{item}</span>],
      )}
    </div>
  );
}
