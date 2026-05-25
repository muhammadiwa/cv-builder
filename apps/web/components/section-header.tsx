"use client";

import { motion } from "framer-motion";

interface SectionHeaderProps {
  tag?: string;
  title: string;
  highlight?: string;
  description?: string;
}

export function SectionHeader({ tag, title, highlight, description }: SectionHeaderProps) {
  return (
    <div className="text-center mb-12 sm:mb-16">
      {tag && (
        <motion.span
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="text-sm font-semibold text-[var(--color-primary)] uppercase tracking-widest"
        >
          {tag}
        </motion.span>
      )}
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.1, duration: 0.5 }}
        className="mt-4 font-display text-3xl sm:text-4xl md:text-5xl font-bold text-[var(--color-text-primary)] tracking-tight"
      >
        {title}{" "}
        {highlight && (
          <span className="text-transparent bg-clip-text bg-gradient-card">{highlight}</span>
        )}
      </motion.h2>
      {description && (
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="mt-4 text-lg text-[var(--color-text-secondary)] max-w-xl mx-auto"
        >
          {description}
        </motion.p>
      )}
    </div>
  );
}
