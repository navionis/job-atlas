import { ImageResponse } from "next/og";

export const alt = "Job Atlas — Work without borders";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "linear-gradient(140deg, #0b0f19 0%, #101a33 55%, #0f2a5c 100%)",
          color: "#f4f7ff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 18,
              background: "#2563eb",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div style={{ width: 26, height: 26, background: "#fff", transform: "rotate(45deg)", borderRadius: 6 }} />
          </div>
          <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: -1, display: "flex" }}>
            job atlas<span style={{ color: "#3b82f6" }}>.</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 76, fontWeight: 800, letterSpacing: -3, lineHeight: 1.05 }}>
            Work without borders.
          </div>
          <div style={{ fontSize: 30, color: "#9db2d8", marginTop: 24 }}>
            Country-aware job discovery across public and configured feeds — filtered, ranked, tracked.
          </div>
        </div>
        <div style={{ display: "flex", gap: 14, fontSize: 22, color: "#7e93c2" }}>
          <span>GEO-ELIGIBILITY</span>
          <span>/</span>
          <span>RESUME MATCHING</span>
          <span>/</span>
          <span>PIPELINE TRACKING</span>
        </div>
      </div>
    ),
    size,
  );
}
