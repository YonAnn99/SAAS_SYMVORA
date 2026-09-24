// FAQ_KEYS debe vivir aquí (Server Component) — NO se puede importar
// desde faq.tsx porque tiene "use client" y al cruzar el boundary
// server→client se serializa como referencia, no como array literal.
// En runtime resultaba en: "TypeError: o.FAQ_KEYS.map is not a function"
const FAQ_KEYS = ["1", "2", "3", "4", "5", "7", "8"] as const;

import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { AppFrame } from "@/components/ui/app-frame";
import { Hero } from "@/components/marketing/hero";
import { CompatibilityBar } from "@/components/marketing/compatibility-bar";
import LogoCarousel from "@/components/ui/logo-carousel";
import { Features } from "@/components/marketing/features";
import { GirosStrip } from "@/components/marketing/giros-strip";
import { GirosCatalog } from "@/components/marketing/giros-catalog";
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
import { DIAS_PRUEBA } from "@/lib/trial";

export const metadata: Metadata = {
  title: "SYMVORA — POS e inventario para PyMEs",
  description:
    `Sistema de punto de venta e inventarios para PyMEs en México. Sin comisiones por venta y demo gratuita de ${DIAS_PRUEBA} días.`,
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
    title: "SYMVORA — POS e inventario para PyMEs",
    description:
      "Punto de venta, inventarios y finanzas en una sola plataforma pensada para PyMEs mexicanas.",
    url: "https://www.symvora.com.mx/es",
    locale: "es_MX",
    type: "website",
    siteName: "SYMVORA",
    images: [
      {
        url: "/og-symvora.jpeg",
        width: 1200,
        height: 630,
        type: "image/jpeg",
        alt: "SYMVORA — Punto de venta e inventario para PyMEs",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SYMVORA — POS e inventario para PyMEs",
    description:
      "Punto de venta, inventarios y finanzas en una sola plataforma pensada para PyMEs mexicanas.",
    images: ["/og-symvora.jpeg"],
  },
};

export default async function LocalePage() {
  const t = await getTranslations("landing");
  const locale = await getLocale();
  const siteUrl = getSiteUrl();

  const featureList = [
    t("features.pos.title"),
    t("features.inventory.title"),
    t("features.purchases.title"),
    t("features.finances.title"),
    t("features.catalogImport.title"),
  ];

  const faqs = FAQ_KEYS.map((key) => ({
    question: t(`faq.items.${key}.question`),
    answer: t(`faq.items.${key}.answer`),
  }));

  const software = softwareApplicationSchema(siteUrl, {
    description:
      "Punto de venta, inventarios y finanzas para PyMEs mexicanas. Suscripción fija de $399 MXN/mes sin comisiones por venta.",
    featureList,
  });

  const faqSchema = faqPageSchema(siteUrl, faqs);

  return (
    <AppFrame>
      {/* Lo primero que se ve: el visitante se reconoce por su giro antes de
          leer el hero. "Otros" baja a `GirosCatalog` (#giros). */}
      <GirosStrip />
      <Hero />
      <LogoCarousel />
      <Features />
      <GirosCatalog locale={locale} />
      <CompatibilityBar />
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
