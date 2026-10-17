import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const origin = process.env.APP_ORIGIN || "http://localhost:3000";
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/login"],
        disallow: ["/api/", "/jobs", "/profile", "/admin", "/dashboard"],
      },
    ],
    sitemap: `${origin}/sitemap.xml`,
  };
}
