"use client";

import { motion } from "framer-motion";
import { ArrowRight, PlayCircle, Star } from "lucide-react";
import { FloatingCard } from "./floating-card";

const headlineText = "CV ATS-mu, siap dalam hitungan menit";

const charVariants = {
  hidden: { opacity: 0, y: 40, rotateX: -20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    rotateX: 0,
    transition: {
      delay: i * 0.03,
      type: "spring" as const,
      stiffness: 100,
      damping: 12,
    },
  }),
};

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (delay: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay, duration: 0.5, ease: [0.16, 1, 0.3, 1] },
  }),
};

const avatars = [
  { id: 1, src: "" },
  { id: 2, src: "" },
  { id: 3, src: "" },
  { id: 4, src: "" },
];

export function Hero() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-[var(--color-bg)]">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-[var(--gradient-hero)] pointer-events-none" />

      {/* Grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3Cpattern id='grid' width='60' height='60' patternUnits='userSpaceOnUse'%3E%3Cpath d='M 60 0 L 0 0 0 60' fill='none' stroke='%236366f1' stroke-width='0.5'/%3E%3C/pattern%3E%3C/defs%3E%3Crect width='100%25' height='100%25' fill='url(%23grid)'/%3E%3C/svg%3E")`,
          backgroundSize: "60px 60px",
        }}
      />

      {/* Floating cards */}
      <FloatingCard
        className="top-[15%] right-[5%] w-[280px] rotate-[8deg]"
        depth={0.3}
        offset={{ x: 40, y: -20 }}
      />
      <FloatingCard
        className="bottom-[20%] left-[5%] w-[240px] rotate-[-5deg]"
        depth={0.2}
        offset={{ x: -30, y: 30 }}
      />
      <FloatingCard
        className="top-[40%] left-[8%] w-[200px] rotate-[12deg] opacity-60"
        depth={0.15}
        offset={{ x: -20, y: -40 }}
      />

      {/* Content */}
      <div className="relative z-10 mx-auto w-full max-w-[1280px] px-[clamp(16px,5vw,64px)] flex flex-col items-center text-center">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text-secondary)] mb-8"
        >
          <span className="w-2 h-2 rounded-full bg-[var(--color-success)] animate-pulse" />
          <span>10,000+ CV dibuat bulan ini</span>
        </motion.div>

        {/* Headline with char-by-char reveal */}
        <h1 className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-bold tracking-tight leading-[1.05] text-[var(--color-text-primary)] max-w-4xl">
          {headlineText.split("").map((char, i) => (
            <motion.span
              key={i}
              custom={i}
              variants={charVariants}
              initial="hidden"
              animate="visible"
              className="inline-block"
            >
              {char === " " ? " " : char}
            </motion.span>
          ))}
        </h1>

        {/* Subheadline */}
        <motion.p
          variants={fadeUp}
          custom={0.8}
          initial="hidden"
          animate="visible"
          className="mt-6 text-lg sm:text-xl text-[var(--color-text-secondary)] max-w-2xl leading-relaxed"
        >
          Ngobrol 5 menit sama Kak, AI career assistant-mu. CV langsung jadi,{" "}
          <span className="text-[var(--color-primary)] font-medium">lolos ATS</span>, siap lamar.
        </motion.p>

        {/* CTA Group */}
        <motion.div
          variants={fadeUp}
          custom={1.0}
          initial="hidden"
          animate="visible"
          className="mt-10 flex flex-col sm:flex-row items-center gap-4"
        >
          <button className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-[var(--color-primary)] text-white font-semibold text-base hover:bg-[var(--color-primary-hover)] shadow-lg shadow-[var(--color-primary-glow)] transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]">
            Buat CV Gratis
            <ArrowRight className="w-4 h-4" />
          </button>
          <button className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] font-medium text-base hover:bg-[var(--color-surface-hover)] transition-all duration-300">
            <PlayCircle className="w-4 h-4 text-[var(--color-primary)]" />
            Lihat Demo
          </button>
        </motion.div>

        {/* Social Proof */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.5 }}
          className="mt-12 flex flex-wrap items-center justify-center gap-8 text-sm text-[var(--color-text-tertiary)]"
        >
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {avatars.map((a) => (
                <div
                  key={a.id}
                  className="w-8 h-8 rounded-full border-2 border-[var(--color-surface)] bg-gradient-card"
                />
              ))}
            </div>
            <span>
              Dipake <strong className="text-[var(--color-text-primary)]">10,000+</strong> pencari kerja
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
            <span>
              Rating <strong className="text-[var(--color-text-primary)]">4.8</strong> dari 2,500+ ulasan
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
