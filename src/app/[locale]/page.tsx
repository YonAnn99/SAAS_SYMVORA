// FAQ_KEYS debe vivir aquí (Server Component) — NO se puede importar
// desde faq.tsx porque tiene "use client" y al cruzar el boundary
// server→client se serializa como referencia, no como array literal.
// En runtime resultaba en: "TypeError: o.FAQ_KEYS.map is not a function"
const FAQ_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8"] as const;

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Navbar } from "@/components/marketing/navbar";
import { Hero } from "@/components/marketing/hero";
import { CompatibilityBar } from "@/components/marketing/compatibility-bar";
import { Features } from "@/components/marketing/features";
import { BusinessTypes } from "@/components/marketing/business-types";
import { CFDISection } from "@/components/marketing/cfdi-section";
import { WhyChooseUs } from "@/components/marketing/why-choose-us";
import { SecuritySection } from "@/components/marketing/security-section";
import { Benefits } from "@/components/marketing/benefits";
import { Integrations } from "@/components/marketing/integrations";
import { Setup } from "@/components/marketing/setup";
import { FAQ } from "@/components/marketing/faq";
import { CTA } from "@/components/marketing/cta";
import { AboutUs } from "@/components/marketing/about-us";
import { Footer } from "@/components/marketing/footer";
import { WhatsAppFab } from "@/components/marketing/whatsapp-fab";
import { JsonLd } from "@/components/marketing/json-ld";
import { getSiteUrl } from "@/lib/site";
import {
  faqPageSchema,
  softwareApplicationSchema,
} from "@/lib/seo/structured-data";

export const metadata: Metadata = {
  title: "SYMVORA — Punto de venta, inventario y facturación CFDI para PyMEs en México",
  description:
    "Sistema de punto de venta e inventarios con facturación CFDI 4.0 para abarrotes, tiendas y comercios en México. Sin comisiones por venta, soporte en español y demo gratuita de 7 días.",
  alternates: {
    canonical: "/es",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    title: "SYMVORA — Punto de venta, inventario y CFDI para PyMEs mexicanas",
    description:
      "Punto de venta, inventarios y facturación CFDI 4.0 en una sola plataforma pensada para PyMEs mexicanas.",
    locale: "es_MX",
    type: "website",
    siteName: "SYMVORA",
    images: ["/og-symvora.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "SYMVORA — Punto de venta, inventario y CFDI para PyMEs mexicanas",
    description:
      "Punto de venta, inventarios y facturación CFDI 4.0 en una sola plataforma pensada para PyMEs mexicanas.",
    images: ["/og-symvora.png"],
  },
};

export default async function LocalePage() {
  const t = await getTranslations("landing");
  const siteUrl = getSiteUrl();

  const featureList = [
    t("features.pos.title"),
    t("features.inventory.title"),
    t("features.purchases.title"),
    t("features.finances.title"),
  ];

  const faqs = FAQ_KEYS.map((key) => ({
    question: t(`faq.items.${key}.question`),
    answer: t(`faq.items.${key}.answer`),
  }));

  const software = softwareApplicationSchema(siteUrl, {
    description:
      "Punto de venta, inventarios y facturación CFDI 4.0 para PyMEs mexicanas. Suscripción fija de $400 MXN/mes sin comisiones por venta.",
    featureList,
  });

  const faqSchema = faqPageSchema(siteUrl, faqs);

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      <Navbar />
      <main>
        <Hero />
        <CompatibilityBar />
        <Features />
        <BusinessTypes />
        <CFDISection />
        <WhyChooseUs />
        <SecuritySection />
        <Benefits />
        <Integrations />
        <Setup />
        <FAQ />
        <CTA />
        <AboutUs />
        <JsonLd id="ld-software" data={software} />
        <JsonLd id="ld-faq" data={faqSchema} />
      </main>
      <Footer />
      <WhatsAppFab />
    </div>
  );
}
