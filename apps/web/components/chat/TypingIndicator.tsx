'use client';

import { motion, useReducedMotion } from 'framer-motion';

interface TypingIndicatorProps {
    label: string;
}

export function TypingIndicator({ label }: TypingIndicatorProps) {
    const prefersReduced = useReducedMotion();

    return (
        <motion.div
            initial={prefersReduced ? undefined : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="flex items-center gap-2"
            role="status"
            aria-label="Kak sedang mengetik..."
        >
            <div className="flex items-center gap-1 px-4 py-3 bg-[hsl(var(--color-kak-bubble))] border border-[hsl(var(--color-kak-bubble-border))] rounded-2xl rounded-tl">
                {[0, 1, 2].map((i) => (
                    <motion.span
                        key={i}
                        className="w-2 h-2 rounded-full bg-muted-foreground/60"
                        animate={prefersReduced ? undefined : { y: [0, -4, 0] }}
                        transition={
                            prefersReduced
                                ? undefined
                                : {
                                    duration: 0.6,
                                    repeat: Infinity,
                                    delay: i * 0.15,
                                    ease: 'easeInOut',
                                }
                        }
                    />
                ))}
            </div>
            <span className="text-xs text-muted-foreground">{label}</span>
        </motion.div>
    );
}
