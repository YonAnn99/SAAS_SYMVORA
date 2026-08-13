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
