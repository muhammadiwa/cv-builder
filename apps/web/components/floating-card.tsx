"use client";

import { useRef, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { cn } from "@/lib/utils";

interface FloatingCardProps {
  className?: string;
  depth?: number;
  offset?: { x: number; y: number };
}

export function FloatingCard({ className, depth = 0.3, offset = { x: 0, y: 0 } }: FloatingCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll();
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const y = useTransform(scrollY, [0, 500], [0, offset.y]);
  const x = useTransform(scrollY, [0, 500], [0, offset.x]);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const rotateY = ((e.clientX - centerX) / rect.width) * 15 * depth;
    const rotateX = -((e.clientY - centerY) / rect.height) * 15 * depth;
    setMousePos({ x: rotateX, y: rotateY });
  };

  return (
    <motion.div
      ref={cardRef}
      className={cn("absolute pointer-events-auto hidden lg:block", className)}
      style={{ x, y, perspective: 1000 }}
      animate={{ rotateX: mousePos.x, rotateY: mousePos.y }}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
      onMouseMove={handleMouseMove}
    >
      <div className="w-full rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-xl p-4">
        {/* Mock CV content */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-gradient-card" />
          <div className="flex-1">
            <div className="h-2.5 w-28 rounded-full bg-[var(--color-bg-tertiary)] mb-1.5" />
            <div className="h-2 w-20 rounded-full bg-[var(--color-bg-tertiary)]" />
          </div>
        </div>
        <div className="space-y-2">
          <div className="h-2 w-full rounded-full bg-[var(--color-bg-tertiary)]" />
          <div className="h-2 w-5/6 rounded-full bg-[var(--color-bg-tertiary)]" />
          <div className="h-2 w-4/5 rounded-full bg-[var(--color-bg-tertiary)]" />
        </div>
        <div className="mt-3 flex gap-1.5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-5 w-12 rounded-md bg-[var(--color-bg-tertiary)]" />
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <div className="h-6 w-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30" />
          <div className="h-6 w-14 rounded-full bg-indigo-100 dark:bg-indigo-900/30" />
        </div>
      </div>
    </motion.div>
  );
}
