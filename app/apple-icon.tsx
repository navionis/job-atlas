import { ImageResponse } from "next/og";
import { AtlasMark } from "../components/atlas-mark";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "linear-gradient(140deg, #2563eb, #1d4ed8)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <AtlasMark size={120} color="#fff" />
    </div>,
    size,
  );
}
