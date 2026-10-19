import type { MetadataRoute } from "next";
import { snapshot } from "../lib/feeds";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = process.env.APP_ORIGIN || "http://localhost:3000";
  const snap = await snapshot("").catch(() => null);
  const jobs: MetadataRoute.Sitemap = (snap?.jobs || [])
    .filter((j) => j.posted)
    .sort((a, b) => b.posted.localeCompare(a.posted))
    .slice(0, 200)
    .map((j) => ({
      url: `${origin}/jobs/${encodeURIComponent(j.id)}`,
      lastModified: new Date(j.posted),
      changeFrequency: "daily",
      priority: 0.6,
    }));
  return [
    {
      url: origin,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${origin}/jobs`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 0.9,
    },
    {
      url: `${origin}/sources`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 0.7,
    },
    {
      url: `${origin}/login`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    ...jobs,
  ];
}
