"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionHeader } from "./section-header";

const categories = ["Semua", "Professional", "Modern", "ATS-Friendly", "Kreatif", "Minimalis"] as const;

const templates = [
  { id: 1, name: "Professional Blue", category: "Professional", color: "from-blue-500 to-blue-700" },
  { id: 2, name: "Modern Indigo", category: "Modern", color: "from-indigo-500 to-violet-600" },
  { id: 3, name: "ATS Pro", category: "ATS-Friendly", color: "from-gray-600 to-gray-800" },
  { id: 4, name: "Creative Mint", category: "Kreatif", color: "from-emerald-400 to-teal-500" },
  { id: 5, name: "Clean Minimal", category: "Minimalis", color: "from-slate-400 to-slate-600" },
  { id: 6, name: "Executive Dark", category: "Professional", color: "from-gray-900 to-black" },
  { id: 7, name: "Vibrant Coral", category: "Kreatif", color: "from-rose-400 to-pink-500" },
  { id: 8, name: "Simple ATS", category: "ATS-Friendly", color: "from-sky-500 to-indigo-500" },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const },
  },
};

export function Templates() {
  const [activeCategory, setActiveCategory] = useState("Semua");

  const filtered = activeCategory === "Semua"
    ? templates
    : templates.filter((t) => t.category === activeCategory);

  return (
    <section id="templates" className="relative py-[clamp(64px,10vw,128px)] bg-[var(--color-bg-secondary)]">
      <div className="mx-auto max-w-[1280px] px-[clamp(16px,5vw,64px)]">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
          <SectionHeader
            tag="Template"
            title="Pilih template favoritmu"
          />
          <a
            href="/templates"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors whitespace-nowrap"
          >
            Lihat Semua Template
            <ArrowRight className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* Filter chips */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200",
                activeCategory === cat
                  ? "bg-[var(--color-primary)] text-white shadow-sm"
                  : "bg-[var(--color-surface)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:border-[var(--color-primary)]/30 hover:text-[var(--color-text-primary)]"
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Template grid */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeCategory}
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5"
          >
            {filtered.map((template) => (
              <motion.div
                key={template.id}
                variants={cardVariants}
                layout
                className="group relative rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300"
              >
                {/* Preview */}
                <div
                  className={cn(
                    "aspect-[210/297] bg-gradient-to-br p-4",
                    template.color
                  )}
                >
                  <div className="h-2 w-3/4 bg-white/20 rounded mb-2" />
                  <div className="h-2 w-1/2 bg-white/20 rounded mb-4" />
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex gap-2 mb-2">
                      <div className="h-2 w-2 rounded-full bg-white/20 mt-1" />
                      <div className="flex-1">
                        <div className="h-2 w-full bg-white/20 rounded mb-1" />
                        <div className="h-2 w-4/5 bg-white/20 rounded" />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Overlay */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                  <button className="px-4 py-2 bg-white text-gray-900 rounded-lg text-sm font-semibold shadow-lg transform scale-90 group-hover:scale-100 transition-transform duration-300">
                    Gunakan Template
                  </button>
                </div>

                {/* Label */}
                <div className="p-3 border-t border-[var(--color-border)]">
                  <p className="text-sm font-medium text-[var(--color-text-primary)]">{template.name}</p>
                  <p className="text-xs text-[var(--color-text-tertiary)]">{template.category}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
