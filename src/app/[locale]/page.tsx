// FAQ_KEYS debe vivir aquí (Server Component) — NO se puede importar
// desde faq.tsx porque tiene "use client" y al cruzar el boundary
// server→client se serializa como referencia, no como array literal.
// En runtime resultaba en: "TypeError: o.FAQ_KEYS.map is not a function"
const FAQ_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8"] as const;

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AppFrame } from "@/components/ui/app-frame";
import { Hero } from "@/components/marketing/hero";
import { CompatibilityBar } from "@/components/marketing/compatibility-bar";
import LogoCarousel from "@/components/ui/logo-carousel";
import { Features } from "@/components/marketing/features";
import { BusinessTypes } from "@/components/marketing/business-types";
import { CFDISection } from "@/components/marketing/cfdi-section";
import { WhyChooseUs } from "@/components/marketing/why-choose-us";
import { SecuritySection } from "@/components/marketing/security-section";
import { Benefits } from "@/components/marketing/benefits";
import { Setup } from "@/components/marketing/setup";
import { FAQ } from "@/components/marketing/faq";
import { CTA } from "@/components/marketing/cta";
import { AboutUs } from "@/components/marketing/about-us";
import { VoiceNarrator } from "@/components/marketing/voice-narrator";
import Footer from "@/components/ui/footer";
import { JsonLd } from "@/components/marketing/json-ld";
import { getSiteUrl } from "@/lib/site";
import {
  faqPageSchema,
  softwareApplicationSchema,
} from "@/lib/seo/structured-data";

export const metadata: Metadata = {
  title: "SYMVORA — POS, inventario y facturación CFDI para PyMEs",
  description:
    "Sistema de punto de venta e inventarios con facturación CFDI 4.0 para PyMEs en México. Sin comisiones por venta y demo gratuita de 7 días.",
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
    title: "SYMVORA — POS, inventario y facturación CFDI para PyMEs",
    description:
      "Punto de venta, inventarios y facturación CFDI 4.0 en una sola plataforma pensada para PyMEs mexicanas.",
    url: "https://www.symvora.com.mx/es",
    locale: "es_MX",
    type: "website",
    siteName: "SYMVORA",
    images: [
      {
        url: "/og-symvora-v3.jpg",
        width: 1200,
        height: 630,
        alt: "SYMVORA — Punto de venta, inventario y facturación CFDI 4.0 para PyMEs",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SYMVORA — POS, inventario y facturación CFDI para PyMEs",
    description:
      "Punto de venta, inventarios y facturación CFDI 4.0 en una sola plataforma pensada para PyMEs mexicanas.",
    images: ["/og-symvora-v3.jpg"],
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
    <AppFrame>
      <Hero />
      <LogoCarousel />
      <CompatibilityBar />
      <Features />
      <BusinessTypes />
      <CFDISection />
      <WhyChooseUs />
      <SecuritySection />
      <Benefits />
      <Setup />
      <FAQ />
      <CTA />
      <AboutUs />
      <Footer />
      <JsonLd id="ld-software" data={software} />
      <JsonLd id="ld-faq" data={faqSchema} />
    </AppFrame>
  );
}
