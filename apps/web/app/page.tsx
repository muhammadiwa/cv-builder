"use client";

import { Navbar } from "@/components/navbar";
import { Hero } from "@/components/hero";
import { HowItWorks } from "@/components/how-it-works";
import { AiDemo } from "@/components/ai-demo";
import { AtsScore } from "@/components/ats-score";
import { Templates } from "@/components/templates";
import { Features } from "@/components/features";
import { Pricing } from "@/components/pricing";
import { Testimonials } from "@/components/testimonials";
import { FAQ } from "@/components/faq";
import { CtaSection } from "@/components/cta-section";
import { Footer } from "@/components/footer";

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <HowItWorks />
        <AiDemo />
        <AtsScore />
        <Templates />
        <Features />
        <Pricing />
        <Testimonials />
        <FAQ />
        <CtaSection />
      </main>
      <Footer />
    </>
  );
}
