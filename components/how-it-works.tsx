"use client";

import { motion } from "framer-motion";
import { SectionHeader } from "./section-header";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.2, delayChildren: 0.1 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 60 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 80, damping: 15 },
  },
};

const steps = [
  {
    number: "1",
    title: "Ngobrol sama Kak",
    description:
      "Chat via WhatsApp atau web. Kak, AI career assistant-mu, tanya pengalaman, skill, dan goals karirmu.",
    illustration: "💬",
  },
  {
    number: "2",
    title: "AI Bikin CV-mu",
    description:
      "Lolos otomatis susun pengalamanmu ke template ATS-friendly. Format rapi, siap pakai dalam 5 menit.",
    illustration: "📄",
  },
  {
    number: "3",
    title: "Lamar & Diterima",
    description:
      "Download PDF, langsung lamar. CV-mu sudah dioptimalkan biar HRD dan robot ATS kasih lampu hijau.",
    illustration: "🎉",
  },
];

function StepCard({ step, index }: { step: (typeof steps)[0]; index: number }) {
  return (
    <motion.div
      variants={cardVariants}
      className="relative flex flex-col items-center text-center"
    >
      {/* Step number */}
      <div className="relative z-10 w-14 h-14 rounded-full bg-gradient-card flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-[var(--color-primary-glow)] mb-6">
        {step.number}
      </div>

      {/* Illustration */}
      <div className="w-full aspect-[4/3] rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-md overflow-hidden mb-5 flex items-center justify-center text-6xl">
        {step.illustration}
      </div>

      <h3 className="font-display text-xl font-semibold text-[var(--color-text-primary)] mb-2">
        {step.title}
      </h3>
      <p className="text-[var(--color-text-secondary)] leading-relaxed max-w-xs">
        {step.description}
      </p>
    </motion.div>
  );
}

export function HowItWorks() {
  return (
    <section className="relative py-[clamp(64px,10vw,128px)] bg-[var(--color-bg-secondary)]">
      <div className="mx-auto max-w-[1280px] px-[clamp(16px,5vw,64px)]">
        <SectionHeader
          tag="Cara Kerja"
          title="Ngobrol bentar,"
          highlight="CV langsung jadi"
          description="Tiga langkah sederhana menuju CV yang dilirik HRD dan lolos ATS."
        />

        {/* Steps */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          className="relative grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 lg:gap-16"
        >
          {/* Connecting line desktop */}
          <div className="hidden md:block absolute top-[72px] left-[calc(16.67%+24px)] right-[calc(16.67%+24px)] h-0.5 bg-[var(--color-border)]">
            <motion.div
              initial={{ width: "0%" }}
              whileInView={{ width: "100%" }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
              className="h-full bg-gradient-card"
            />
          </div>

          {steps.map((step, i) => (
            <StepCard key={step.number} step={step} index={i} />
          ))}
        </motion.div>
      </div>
    </section>
  );
}
