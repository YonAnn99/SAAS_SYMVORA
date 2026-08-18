import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/es/demo", "/en/demo"],
      },
    ],
    sitemap: "https://www.symvora.com.mx/sitemap.xml",
  };
}