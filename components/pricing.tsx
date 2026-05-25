"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionHeader } from "./section-header";

const plans = [
  {
    name: "Gratis",
    monthlyPrice: 0,
    annualPrice: 0,
    description: "Coba dulu, lihat hasilnya",
    features: [
      "1 template CV",
      "ATS scan dasar",
      "Export PDF",
      "Chat dengan Kak (3x)",
    ],
    cta: "Mulai Gratis",
    popular: false,
  },
  {
    name: "Pro",
    monthlyPrice: 49000,
    annualPrice: 35000,
    description: "Paling populer. Untuk pencari kerja serius.",
    features: [
      "Semua template ATS",
      "ATS scan lanjutan + saran",
      "Export PDF + DOCX",
      "Chat dengan Kak (unlimited)",
      "AI Career Coach",
      "Simulasi wawancara",
      "Multiple CV versions",
    ],
    cta: "Langganan Pro",
    popular: true,
  },
  {
    name: "Premium",
    monthlyPrice: 119000,
    annualPrice: 79000,
    description: "Untuk profesional dan pencari kerja aktif.",
    features: [
      "Semua fitur Pro",
      "ATS scan dengan benchmark industri",
      "Cover letter otomatis",
      "Prioritas support",
      "Data export ke semua format",
      "LinkedIn optimization",
      "Konsultasi karir 1-on-1",
    ],
    cta: "Langganan Premium",
    popular: false,
  },
];

function PricingCard({
  plan,
  annual,
}: {
  plan: (typeof plans)[0];
  annual: boolean;
}) {
  const price = annual ? plan.annualPrice : plan.monthlyPrice;

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-30px" }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "relative rounded-2xl border p-6 sm:p-8 flex flex-col transition-all duration-300",
        plan.popular
          ? "border-[var(--color-primary)]/30 bg-[var(--color-surface)] shadow-xl shadow-[var(--color-primary-glow)] scale-[1.02] md:scale-105"
          : "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-primary)]/20"
      )}
    >
      {plan.popular && (
        <>
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-card text-white text-xs font-semibold shadow-lg whitespace-nowrap">
            Paling Populer
          </div>
          <div className="absolute -inset-1 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] rounded-2xl opacity-10 blur-xl -z-10" />
        </>
      )}

      <div>
        <h3 className="font-display text-xl font-semibold text-[var(--color-text-primary)]">
          {plan.name}
        </h3>
        <div className="mt-4 flex items-baseline gap-1">
          <AnimatePresence mode="wait">
            <motion.span
              key={price}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.2 }}
              className="text-4xl font-bold text-[var(--color-text-primary)]"
            >
              {price === 0
                ? "Gratis"
                : `Rp${price.toLocaleString("id-ID")}`}
            </motion.span>
          </AnimatePresence>
          {price > 0 && (
            <span className="text-sm text-[var(--color-text-tertiary)]">/bulan</span>
          )}
        </div>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{plan.description}</p>
      </div>

      <ul className="mt-6 space-y-3 flex-1">
        {plan.features.map((feature, i) => (
          <motion.li
            key={feature}
            initial={{ opacity: 0, x: -10 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 + i * 0.05 }}
            className="flex items-start gap-3 text-sm"
          >
            <Check className="w-4 h-4 text-[var(--color-success)] mt-0.5 flex-shrink-0" />
            <span className="text-[var(--color-text-primary)]">{feature}</span>
          </motion.li>
        ))}
      </ul>

      <button
        className={cn(
          "mt-8 w-full py-3 rounded-xl font-semibold text-sm transition-all duration-300",
          plan.popular
            ? "bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] shadow-lg shadow-[var(--color-primary-glow)]"
            : "bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] hover:bg-[var(--color-border)]"
        )}
      >
        {plan.cta}
      </button>
    </motion.div>
  );
}

export function Pricing() {
  const [annual, setAnnual] = useState(false);

  return (
    <section id="pricing" className="relative py-[clamp(64px,10vw,128px)] bg-[var(--color-bg-secondary)]">
      <div className="mx-auto max-w-[1280px] px-[clamp(16px,5vw,64px)]">
        <SectionHeader
          tag="Harga"
          title="Investasi karir yang"
          highlight="worth it"
        />

        {/* Toggle */}
        <div className="flex items-center justify-center gap-4 mb-10">
          <span
            className={cn(
              "text-sm font-medium transition-colors",
              !annual ? "text-[var(--color-text-primary)]" : "text-[var(--color-text-tertiary)]"
            )}
          >
            Bulanan
          </span>
          <button
            onClick={() => setAnnual(!annual)}
            className={cn(
              "relative w-12 h-6 rounded-full transition-colors duration-200",
              annual ? "bg-[var(--color-primary)]" : "bg-[var(--color-border)]"
            )}
          >
            <motion.div
              className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm"
              animate={{ x: annual ? 24 : 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            />
          </button>
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                "text-sm font-medium transition-colors",
                annual ? "text-[var(--color-text-primary)]" : "text-[var(--color-text-tertiary)]"
              )}
            >
              Tahunan
            </span>
            <span className="text-xs font-semibold text-[var(--color-success)] bg-[var(--color-success-bg)] px-2 py-0.5 rounded-full">
              Hemat 40%
            </span>
          </div>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 max-w-5xl mx-auto">
          {plans.map((plan) => (
            <PricingCard key={plan.name} plan={plan} annual={annual} />
          ))}
        </div>

        <p className="text-center text-sm text-[var(--color-text-tertiary)] mt-8">
          Mulai gratis — tidak perlu kartu kredit.
        </p>
      </div>
    </section>
  );
}
