import { ImageResponse } from "next/og";
import { snapshot } from "../../../../lib/feeds";
import { sourceName } from "../../../../lib/catalog";
import { OgShell, OgBrand, OgFoot } from "../../../../components/og";

export const alt = "Job listing on Job Atlas";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const dynamic = "force-dynamic";

export default async function OgImage({ params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params;
  const snap = await snapshot("").catch(() => null);
  const j = snap?.jobs.find((x) => x.id === decodeURIComponent(raw));
  const src = j ? sourceName(j.source) : "";
  return new ImageResponse(
    <OgShell pad={64}>
      <OgBrand mark={52} font={34} />
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: 30, color: "#9db2d8", marginBottom: 16 }}>{j?.company || "Job listing"}</div>
        <div
          style={{
            fontSize: j && j.title.length > 60 ? 52 : 64,
            fontWeight: 800,
            letterSpacing: -2.5,
            lineHeight: 1.08,
            display: "flex",
          }}
        >
          {j ? (j.title.length > 90 ? j.title.slice(0, 87) + "…" : j.title) : "Discover jobs"}
        </div>
        <div style={{ fontSize: 26, color: "#7e93c2", marginTop: 20, display: "flex" }}>
          {[j?.location, j?.remote ? "Remote" : "", src && `via ${src}`].filter(Boolean).join("  ·  ")}
        </div>
      </div>
      <OgFoot font={20} items={["LOCATION EVIDENCE", "ELIGIBILITY SCOPE", "SOURCE ATTRIBUTION"]} />
    </OgShell>,
    size,
  );
}
