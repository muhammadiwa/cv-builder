'use client';

import { motion, useReducedMotion } from 'framer-motion';

interface SuggestedChipsProps {
    chips: string[];
    onSelect: (chip: string) => void;
}

export function SuggestedChips({ chips, onSelect }: SuggestedChipsProps) {
    const prefersReduced = useReducedMotion();

    if (chips.length === 0) return null;

    return (
        <div
            className="flex flex-wrap gap-2 px-4"
            role="group"
            aria-label="Saran balasan"
        >
            {chips.map((chip, i) => (
                <motion.button
                    // Compose key with index so duplicate chip text doesn't collide
                    key={`${i}-${chip}`}
                    initial={prefersReduced ? undefined : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    // Skip stagger entirely under prefers-reduced-motion
                    transition={
                        prefersReduced
                            ? { duration: 0 }
                            : { delay: 0.3 + i * 0.08, duration: 0.2 }
                    }
                    onClick={() => onSelect(chip)}
                    className="px-3 py-1.5 text-sm border border-primary/40 text-primary rounded-full hover:bg-primary/10 transition-colors focus-ring"
                >
                    {chip}
                </motion.button>
            ))}
        </div>
    );
}
