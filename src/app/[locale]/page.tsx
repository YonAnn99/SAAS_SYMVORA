import { Navbar } from "@/components/marketing/navbar";
import { Hero } from "@/components/marketing/hero";
import { AboutUs } from "@/components/marketing/about-us";
import { TrustedBy } from "@/components/marketing/trusted-by";
import { Features } from "@/components/marketing/features";
import { BusinessTypes } from "@/components/marketing/business-types";
import { CFDISection } from "@/components/marketing/cfdi-section";
import { WhyChooseUs } from "@/components/marketing/why-choose-us";
import { SecuritySection } from "@/components/marketing/security-section";
import { Benefits } from "@/components/marketing/benefits";
import { Integrations } from "@/components/marketing/integrations";
import { Setup } from "@/components/marketing/setup";
import { CTA } from "@/components/marketing/cta";
import { Footer } from "@/components/marketing/footer";

export default function LocalePage() {
  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      <Navbar />
      <main>
        <Hero />
        <AboutUs />
        <TrustedBy />
        <Features />
        <BusinessTypes />
        <CFDISection />
        <WhyChooseUs />
        <SecuritySection />
        <Benefits />
        <Integrations />
        <Setup />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
