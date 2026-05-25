"use client";

import { motion } from "framer-motion";
import { ArrowRight, MessageCircle } from "lucide-react";

export function CtaSection() {
  return (
    <section className="relative py-20 sm:py-24 lg:py-32 overflow-hidden bg-[var(--color-bg)]">
      {/* BG decoration */}
      <div className="absolute inset-0 bg-[var(--gradient-hero)] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[var(--color-primary)]/5 blur-3xl pointer-events-none" />

      <div className="relative z-10 mx-auto max-w-3xl px-[clamp(16px,5vw,64px)] text-center">
        {/* Headline */}
        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="font-display text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-[var(--color-text-primary)] tracking-tight leading-[1.1]"
        >
          CV impianmu tinggal{" "}
          <span className="text-transparent bg-clip-text bg-gradient-card">5 menit lagi</span>
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="mt-4 sm:mt-6 text-lg sm:text-xl text-[var(--color-text-secondary)]"
        >
          Ribuan pencari kerja sudah lolos ATS dan dipanggil interview. Giliran lo.
        </motion.p>

        {/* Primary CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="mt-8 sm:mt-10"
        >
          <button className="group inline-flex items-center gap-2.5 px-8 sm:px-10 py-4 sm:py-5 rounded-xl bg-[var(--color-primary)] text-white font-semibold text-base sm:text-lg shadow-xl shadow-[var(--color-primary-glow)] hover:shadow-2xl hover:bg-[var(--color-primary-hover)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-300">
            Buat CV Gratis — Mulai Sekarang
            <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 transition-transform duration-300 group-hover:translate-x-0.5" />
          </button>
        </motion.div>

        {/* WhatsApp CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.6, duration: 0.4 }}
          className="mt-6"
        >
          <button className="inline-flex items-center gap-2.5 px-6 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] font-medium text-sm hover:bg-[var(--color-surface-hover)] transition-all duration-300">
            <MessageCircle className="w-4 h-4 text-[#25D366]" />
            Atau chat kami di WhatsApp
          </button>
        </motion.div>
      </div>
    </section>
  );
}
