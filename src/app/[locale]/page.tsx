import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "SYMVORA — Punto de venta, inventario y facturación CFDI para PyMEs en México",
  description:
    "Sistema de punto de venta e inventarios con facturación CFDI 4.0 para abarrotes, tiendas y comercios en México. Sin comisiones por venta, soporte en español y demo gratuita de 7 días.",
  alternates: {
    canonical: "/",
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
  },
  twitter: {
    card: "summary_large_image",
    title: "SYMVORA — Punto de venta, inventario y CFDI para PyMEs mexicanas",
    description:
      "Punto de venta, inventarios y facturación CFDI 4.0 en una sola plataforma pensada para PyMEs mexicanas.",
  },
};

export default function LocalePage() {
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
      </main>
      <Footer />
      <WhatsAppFab />
    </div>
  );
}
