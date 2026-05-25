"use client";

import { useRef, useState, useEffect } from "react";
import { motion, useInView } from "framer-motion";
import { Quote, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionHeader } from "./section-header";

function AnimatedCounter({
  from,
  to,
  suffix,
  className,
  delay = 0,
}: {
  from: number;
  to: number;
  suffix: string;
  className?: string;
  delay?: number;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const [count, setCount] = useState(from);

  useEffect(() => {
    if (!inView) return;
    const timer = setTimeout(() => {
      const duration = 1500;
      const steps = 60;
      const increment = (to - from) / steps;
      const interval = duration / steps;
      let current = from;
      const t = setInterval(() => {
        current += increment;
        if (current >= to) {
          setCount(to);
          clearInterval(t);
        } else {
          setCount(Math.round(current));
        }
      }, interval);
      return () => clearInterval(t);
    }, delay * 1000);
    return () => clearTimeout(timer);
  }, [inView, from, to, delay]);

  return (
    <span ref={ref} className={className}>
      {count}
      {suffix}
    </span>
  );
}

function Gauge({
  percentage,
  color,
  delay = 0,
}: {
  percentage: number;
  color: string;
  delay?: number;
}) {
  const circumference = 2 * Math.PI * 52;
  const offset = circumference * (1 - percentage / 100);

  return (
    <svg className="w-32 h-32 -rotate-90" viewBox="0 0 120 120">
      <circle
        cx="60"
        cy="60"
        r="52"
        fill="none"
        stroke="currentColor"
        strokeWidth="8"
        className="text-[var(--color-border)]"
      />
      <motion.circle
        cx="60"
        cy="60"
        r="52"
        fill="none"
        stroke="currentColor"
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        whileInView={{ strokeDashoffset: offset }}
        viewport={{ once: true }}
        transition={{ duration: 1.5, delay, ease: [0.16, 1, 0.3, 1] }}
        className={color}
      />
    </svg>
  );
}

const cardVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.2, duration: 0.6, ease: [0.16, 1, 0.3, 1] as const },
  }),
};

export function AtsScore() {
  return (
    <section className="relative py-[clamp(64px,10vw,128px)] bg-[var(--color-bg)]">
      <div className="mx-auto max-w-[1280px] px-[clamp(16px,5vw,64px)]">
        <SectionHeader
          tag="Skor ATS"
          title="Dari"
          highlight="tak terdeteksi jadi lolos otomatis"
        />

        {/* Before/After */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 max-w-4xl mx-auto">
          {/* Before */}
          <motion.div
            custom={0}
            variants={cardVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="relative rounded-2xl border-2 border-red-200 dark:border-red-900/30 bg-[var(--color-surface)] p-6 sm:p-8"
          >
            <div className="flex items-center gap-2 mb-6">
              <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
                <X className="w-4 h-4 text-red-500" />
              </div>
              <span className="font-medium text-[var(--color-text-primary)]">CV Biasa</span>
            </div>

            <div className="relative w-32 h-32 mx-auto mb-4">
              <div className="text-red-500">
                <Gauge percentage={52} color="text-red-500" />
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <AnimatedCounter
                  from={0}
                  to={52}
                  suffix="%"
                  className="text-3xl font-bold text-red-500"
                />
              </div>
            </div>
            <p className="text-center text-sm text-[var(--color-text-secondary)]">
              Resume tidak dioptimalkan untuk ATS. Keyword dan formatting tidak terbaca.
            </p>
          </motion.div>

          {/* After */}
          <motion.div
            custom={1}
            variants={cardVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="relative rounded-2xl border-2 border-emerald-200 dark:border-emerald-900/30 bg-[var(--color-surface)] p-6 sm:p-8 shadow-xl shadow-emerald-500/5"
          >
            <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-2xl opacity-10 blur-xl" />

            <div className="flex items-center gap-2 mb-6 relative">
              <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/20 flex items-center justify-center">
                <Check className="w-4 h-4 text-emerald-500" />
              </div>
              <span className="font-medium text-[var(--color-text-primary)]">CV dengan Lolos</span>
            </div>

            <div className="relative w-32 h-32 mx-auto mb-4">
              <div className="text-emerald-500">
                <Gauge percentage={94} color="text-emerald-500" delay={0.3} />
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <AnimatedCounter
                  from={0}
                  to={94}
                  suffix="%"
                  className="text-3xl font-bold text-emerald-500"
                  delay={0.3}
                />
              </div>
            </div>
            <p className="text-center text-sm text-[var(--color-text-secondary)]">
              Resume dioptimalkan dengan keyword yang tepat. Format ATS-friendly.
            </p>
          </motion.div>
        </div>

        {/* Testimonial */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.8, duration: 0.5 }}
          className="relative mt-12 max-w-2xl mx-auto text-center"
        >
          <Quote className="w-8 h-8 mx-auto mb-4 opacity-30 text-[var(--color-primary)]" />
          <blockquote className="text-lg sm:text-xl text-[var(--color-text-primary)] italic leading-relaxed">
            &ldquo;Saya kira CV saya sudah bagus. Ternyata ATS tidak bisa bacanya.&rdquo;
          </blockquote>
          <p className="mt-4 text-sm text-[var(--color-text-secondary)]">
            &mdash; Andi Pratama, Pelamar Kerja
          </p>
        </motion.div>
      </div>
    </section>
  );
}
