"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Quote, Star, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionHeader } from "./section-header";

const testimonials = [
  {
    name: "Anisa Rahma",
    role: "Fresh Graduate, Universitas Indonesia",
    quote:
      "Awalnya saya bingung cara bikin CV yang bener. Tapi Kak nuntun saya step by step lewat chat. Hasilnya? ATS score 94%! Langsung dipanggil interview 3 perusahaan.",
    beforeScore: 45,
    afterScore: 94,
    stars: 5,
  },
  {
    name: "Budi Santoso",
    role: "Software Engineer, 5yr experience",
    quote:
      "Saya pikir CV saya udah oke. Ternyata ATS score cuma 52%. Setelah pake Lolos dan optimasi keywords, naik ke 91%. Dua minggu kemudian dapat panggilan dari GoTo.",
    beforeScore: 52,
    afterScore: 91,
    stars: 5,
  },
  {
    name: "Citra Dewi",
    role: "Marketing Manager",
    quote:
      "Fitur AI Career Coach-nya luar biasa. Kak kasih saran karir yang personal dan bantu translate pengalaman saya ke bahasa yang tepat buat ATS. Highly recommended!",
    beforeScore: 58,
    afterScore: 96,
    stars: 5,
  },
  {
    name: "Dimas Prasetyo",
    role: "Career Switcher, Logistics to Product",
    quote:
      "Pindah karir itu susah apalagi bikin CV yang relevan. Lolos bantu banget — dari skor 38% langsung ke 87%. Akhirnya diterima sebagai Associate Product Manager!",
    beforeScore: 38,
    afterScore: 87,
    stars: 4,
  },
];

const logos = ["UGM", "UI", "ITB", "BINUS", "Kompas", "Detik", "Tech in Asia", "Glints"];

export function Testimonials() {
  const [[currentIndex, direction], setPage] = useState([0, 0]);
  const [isPaused, setIsPaused] = useState(false);

  const paginate = useCallback(
    (newDirection: number) => {
      setPage(([prev]) => [
        (prev + newDirection + testimonials.length) % testimonials.length,
        newDirection,
      ]);
    },
    []
  );

  // Auto-advance
  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => paginate(1), 5000);
    return () => clearInterval(interval);
  }, [isPaused, paginate]);

  const t = testimonials[currentIndex];

  return (
    <section className="relative py-[clamp(64px,10vw,128px)] bg-[var(--color-bg)]">
      <div className="mx-auto max-w-[1280px] px-[clamp(16px,5vw,64px)]">
        <SectionHeader tag="Testimonial" title="Yang mereka rasakan" />

        {/* Carousel */}
        <div
          className="relative max-w-3xl mx-auto"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          {/* Nav arrows */}
          <button
            onClick={() => paginate(-1)}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 sm:-translate-x-16 w-10 h-10 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] flex items-center justify-center hover:bg-[var(--color-surface-hover)] transition-colors z-10"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => paginate(1)}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 sm:translate-x-16 w-10 h-10 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] flex items-center justify-center hover:bg-[var(--color-surface-hover)] transition-colors z-10"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {/* Card */}
          <div className="overflow-hidden">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={currentIndex}
                custom={direction}
                variants={{
                  enter: (d: number) => ({ x: d > 0 ? 50 : -50, opacity: 0 }),
                  center: { x: 0, opacity: 1 },
                  exit: (d: number) => ({ x: d > 0 ? -50 : 50, opacity: 0 }),
                }}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-6 sm:p-8 md:p-10 shadow-md"
              >
                <Quote className="w-6 h-6 sm:w-8 sm:h-8 opacity-20 text-[var(--color-primary)] mb-4" />
                <blockquote className="text-base sm:text-lg md:text-xl text-[var(--color-text-primary)] leading-relaxed">
                  &ldquo;{t.quote}&rdquo;
                </blockquote>

                {/* Scores */}
                <div className="mt-6 flex items-center gap-4 text-sm">
                  <span className="px-3 py-1 rounded-full bg-red-100 dark:bg-red-900/20 text-red-500 font-semibold">
                    {t.beforeScore}%
                  </span>
                  <ArrowRight className="w-4 h-4 text-[var(--color-text-tertiary)]" />
                  <span className="px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/20 text-emerald-500 font-semibold">
                    {t.afterScore}%
                  </span>
                </div>

                {/* Author */}
                <div className="mt-6 flex items-center gap-4 pt-6 border-t border-[var(--color-border)]">
                  <div className="w-12 h-12 rounded-full bg-gradient-card flex items-center justify-center text-white font-bold">
                    {t.name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-[var(--color-text-primary)]">{t.name}</p>
                    <p className="text-sm text-[var(--color-text-secondary)]">{t.role}</p>
                  </div>
                  <div className="flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={cn(
                          "w-4 h-4",
                          i < t.stars
                            ? "text-yellow-500 fill-yellow-500"
                            : "text-[var(--color-border)]"
                        )}
                      />
                    ))}
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Dots */}
          <div className="flex justify-center gap-2 mt-8">
            {testimonials.map((_, i) => (
              <button
                key={i}
                onClick={() => setPage([i, i > currentIndex ? 1 : -1])}
                className={cn(
                  "w-2 h-2 rounded-full transition-all duration-300",
                  i === currentIndex
                    ? "bg-[var(--color-primary)] w-6"
                    : "bg-[var(--color-border)] hover:bg-[var(--color-text-tertiary)]"
                )}
              />
            ))}
          </div>
        </div>

        {/* Featured in */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="mt-16 text-center"
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-tertiary)] mb-6">
            Diliput oleh
          </p>
          <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-12 opacity-40 dark:opacity-30">
            {logos.map((logo) => (
              <span
                key={logo}
                className="h-6 sm:h-8 text-[var(--color-text-tertiary)] font-semibold text-sm tracking-tight"
              >
                {logo}
              </span>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
