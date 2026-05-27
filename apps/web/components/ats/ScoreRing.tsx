"use client";

import { useEffect, useId } from "react";
import {
    motion,
    useMotionValue,
    useTransform,
    useSpring,
    useReducedMotion,
} from "framer-motion";
import { getScoreColor } from "./ats-colors";

interface ScoreRingProps {
    value: number;
    size?: number;
    strokeWidth?: number;
    animated?: boolean;
    /** Controls spring duration: true = 1.5s first-load, false = 300ms update */
    isFirstRender?: boolean;
}

/**
 * SVG ring gauge displaying an ATS score 0-100 with gradient stroke
 * and spring-animated fill. Accessible via role="meter".
 */
export function ScoreRing({
    value,
    size = 120,
    strokeWidth = 12,
    animated = true,
    isFirstRender = false,
}: ScoreRingProps) {
    const prefersReduced = useReducedMotion();
    const gradientId = useId();

    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const clampedValue = Math.min(100, Math.max(0, value));

    // Spring config: first render = slow dramatic, updates = snappy
    const springConfig = isFirstRender
        ? { stiffness: 60, damping: 12, mass: 1 }
        : { stiffness: 200, damping: 20 };

    // Animated stroke offset
    const targetOffset = circumference * (1 - clampedValue / 100);

    // Animated number counter
    const motionValue = useMotionValue(0);
    const springValue = useSpring(motionValue, springConfig);
    const displayValue = useTransform(springValue, (v) => Math.round(v));

    useEffect(() => {
        motionValue.set(clampedValue);
    }, [clampedValue, motionValue, prefersReduced, animated]);

    const scoreColor = getScoreColor(clampedValue);

    return (
        <div
            className="relative inline-flex items-center justify-center"
            style={{ width: size, height: size }}
            role="meter"
            aria-valuenow={clampedValue}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Skor ATS: ${clampedValue} dari 100`}
        >
            <svg
                width={size}
                height={size}
                className="transform -rotate-90"
                aria-hidden="true"
            >
                <defs>
                    <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="hsl(var(--ats-red))" />
                        <stop offset="40%" stopColor="hsl(var(--ats-amber))" />
                        <stop offset="65%" stopColor="hsl(var(--ats-blue))" />
                        <stop offset="100%" stopColor="hsl(var(--ats-emerald))" />
                    </linearGradient>
                </defs>

                {/* Background circle */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="hsl(var(--border))"
                    strokeWidth={strokeWidth}
                />

                {/* Animated foreground circle */}
                <motion.circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={`url(#${gradientId})`}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    initial={
                        animated && !prefersReduced
                            ? { strokeDashoffset: circumference }
                            : { strokeDashoffset: targetOffset }
                    }
                    animate={{ strokeDashoffset: targetOffset }}
                    transition={
                        animated && !prefersReduced
                            ? { type: "spring", ...springConfig }
                            : { duration: 0 }
                    }
                />
            </svg>

            {/* Center text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <motion.span
                    className="text-[28px] font-display font-bold tabular-nums"
                    style={{ color: scoreColor }}
                >
                    {displayValue}
                </motion.span>
                <span className="text-[11px] text-muted-foreground">/100</span>
            </div>
        </div>
    );
}
