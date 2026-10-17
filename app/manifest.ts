import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Job Atlas — Work without borders",
    short_name: "Job Atlas",
    description: "Country-aware job discovery across public and configured job feeds.",
    start_url: "/",
    display: "standalone",
    background_color: "#0b0f19",
    theme_color: "#2563eb",
    icons: [
      { src: "/favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
