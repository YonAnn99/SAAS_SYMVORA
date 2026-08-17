import type { MetadataRoute } from "next";

const BASE_URL = "https://www.symvora.com.mx";

export default function sitemap(): MetadataRoute.Sitemap {
  const languageAlternates = {
    es: `${BASE_URL}/es`,
    "x-default": `${BASE_URL}/es`,
  };

  const lastModified = new Date();

  return [
    {
      url: `${BASE_URL}/es`,
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
      alternates: { languages: languageAlternates },
    },
    {
      url: `${BASE_URL}/es/terminos`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.3,
      alternates: { languages: languageAlternates },
    },
    {
      url: `${BASE_URL}/es/aviso-privacidad`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.3,
      alternates: { languages: languageAlternates },
    },
    {
      url: `${BASE_URL}/es/politica-cookies`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.3,
      alternates: { languages: languageAlternates },
    },
  ];
}