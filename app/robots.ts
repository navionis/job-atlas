import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const origin = process.env.APP_ORIGIN || "http://localhost:3000";
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/jobs", "/sources", "/login"],
        disallow: ["/api/", "/profile", "/admin", "/matches"],
      },
    ],
    sitemap: `${origin}/sitemap.xml`,
  };
}
