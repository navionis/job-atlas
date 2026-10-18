import { ImageResponse } from "next/og";
import { AtlasMark } from "../components/atlas-mark";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "linear-gradient(140deg, #2563eb, #1d4ed8)",
        borderRadius: 14,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <AtlasMark size={44} color="#fff" />
    </div>,
    size,
  );
}
