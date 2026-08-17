interface OrganizationSchema {
  "@context": "https://schema.org";
  "@type": "Organization";
  "@id": string;
  name: string;
  url: string;
  logo: string;
  description: string;
  areaServed: { "@type": "Country"; name: string }[];
  knowsLanguage: string[];
  contactPoint: {
    "@type": "ContactPoint";
    contactType: string;
    telephone: string;
    areaServed: { "@type": "Country"; name: string };
    availableLanguage: string[];
    url?: string;
  }[];
  sameAs: string[];
}

interface WebSiteSchema {
  "@context": "https://schema.org";
  "@type": "WebSite";
  "@id": string;
  url: string;
  name: string;
  inLanguage: string;
  publisher: { "@id": string };
}

interface PriceSpecification {
  "@type": "UnitPriceSpecification";
  price: number;
  priceCurrency: string;
  unitText: string;
  referenceQuantity: { "@type": "QuantitativeValue"; value: number; unitText: string };
}

interface OfferSchema {
  "@type": "Offer";
  url: string;
  priceCurrency: string;
  price: number;
  priceValidUntil: string;
  availability: string;
  category?: string;
  priceSpecification?: PriceSpecification[];
}

export interface SoftwareApplicationSchema {
  "@context": "https://schema.org";
  "@type": "SoftwareApplication";
  "@id": string;
  name: string;
  description: string;
  url: string;
  applicationCategory: string;
  applicationSubCategory: string;
  operatingSystem: string;
  inLanguage: string;
  publisher: { "@id": string };
  offers: OfferSchema;
  featureList: string[];
  screenshot?: string;
}

export interface FAQItem {
  question: string;
  answer: string;
}

export interface FAQPageSchema {
  "@context": "https://schema.org";
  "@type": "FAQPage";
  "@id": string;
  url: string;
  inLanguage: string;
  isPartOf: { "@id": string };
  mainEntity: {
    "@type": "Question";
    name: string;
    acceptedAnswer: { "@type": "Answer"; text: string };
  }[];
}

export function organizationId(siteUrl: string): string {
  return `${siteUrl}/#organization`;
}

export function websiteId(siteUrl: string): string {
  return `${siteUrl}/#website`;
}

export function softwareApplicationId(siteUrl: string): string {
  return `${siteUrl}/#software`;
}

export function faqPageId(siteUrl: string): string {
  return `${siteUrl}/#faq`;
}

export function organizationSchema(
  siteUrl: string,
  options: {
    description: string;
    whatsappNumber?: string;
    sameAs?: string[];
  }
): OrganizationSchema {
  const whatsapp = options.whatsappNumber ?? process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "5215512345678";

  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": organizationId(siteUrl),
    name: "SYMVORA",
    url: siteUrl,
    logo: `${siteUrl}/symvora-logo.webp`,
    description: options.description,
    areaServed: [{ "@type": "Country", name: "Mexico" }],
    knowsLanguage: ["es-MX"],
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "customer support",
        telephone: `+${whatsapp}`,
        areaServed: { "@type": "Country", name: "Mexico" },
        availableLanguage: ["Spanish"],
        url: `https://wa.me/${whatsapp}`,
      },
    ],
    sameAs: options.sameAs ?? [],
  };
}

export function websiteSchema(siteUrl: string): WebSiteSchema {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": websiteId(siteUrl),
    url: siteUrl,
    name: "SYMVORA",
    inLanguage: "es-MX",
    publisher: { "@id": organizationId(siteUrl) },
  };
}

export function softwareApplicationSchema(
  siteUrl: string,
  options: {
    description: string;
    featureList: string[];
  }
): SoftwareApplicationSchema {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "@id": softwareApplicationId(siteUrl),
    name: "SYMVORA",
    description: options.description,
    url: siteUrl,
    applicationCategory: "BusinessApplication",
    applicationSubCategory: "PointOfSaleApplication",
    operatingSystem: "Web (iOS, Android, Windows, macOS, Linux)",
    inLanguage: "es-MX",
    publisher: { "@id": organizationId(siteUrl) },
    offers: {
      "@type": "Offer",
      url: `${siteUrl}/es`,
      priceCurrency: "MXN",
      price: 400,
      priceValidUntil: "2027-12-31",
      availability: "https://schema.org/InStock",
      category: "subscription",
      priceSpecification: [
        {
          "@type": "UnitPriceSpecification",
          price: 400,
          priceCurrency: "MXN",
          unitText: "mes",
          referenceQuantity: {
            "@type": "QuantitativeValue",
            value: 1,
            unitText: "MONTH",
          },
        },
      ],
    },
    featureList: options.featureList,
  };
}

export function faqPageSchema(
  siteUrl: string,
  items: FAQItem[]
): FAQPageSchema {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": faqPageId(siteUrl),
    url: `${siteUrl}/es`,
    inLanguage: "es-MX",
    isPartOf: { "@id": websiteId(siteUrl) },
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data);
}
