import { ImageResponse } from "next/og";
import { OgShell, OgBrand, OgFoot } from "../components/og";

export const alt = "Job Atlas — Work without borders";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    <OgShell>
      <OgBrand />
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: 76, fontWeight: 800, letterSpacing: -3, lineHeight: 1.05 }}>Work without borders.</div>
        <div style={{ fontSize: 30, color: "#9db2d8", marginTop: 24 }}>
          Country-aware job discovery across public and configured feeds — filtered, ranked, tracked.
        </div>
      </div>
      <OgFoot items={["GEO-ELIGIBILITY", "RESUME MATCHING", "PIPELINE TRACKING"]} />
    </OgShell>,
    size,
  );
}
