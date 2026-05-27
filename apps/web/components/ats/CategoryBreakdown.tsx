"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEditorStore } from "@/stores/editorStore";
import { useEditorLayoutStore } from "@/stores/editorLayoutStore";
import type { DimensionKey } from "@/lib/ats-engine/types";
import { DIMENSION_WEIGHTS } from "@/lib/ats-engine/types";
import { CategoryCard } from "./CategoryCard";
import { DIMENSION_LABELS, DIMENSION_SECTION_MAP } from "./ats-colors";

/**
 * Staggered list of 6 CategoryCards reading from editorStore.atsScore.dimensions.
 */
export function CategoryBreakdown() {
    const dimensions = useEditorStore((s) => s.atsScore?.dimensions);
    const sections = useEditorStore((s) => s.sections);
    const setActiveSectionId = useEditorLayoutStore((s) => s.setActiveSectionId);
    const prefersReduced = useReducedMotion();

    if (!dimensions) return null;

    const dimensionKeys = Object.keys(DIMENSION_WEIGHTS) as DimensionKey[];

    const handleCardClick = (key: DimensionKey) => {
        const targetSectionType = DIMENSION_SECTION_MAP[key];
        if (!targetSectionType) return;
        const section = sections.find((s) => s.sectionType === targetSectionType);
        if (section) {
            setActiveSectionId(section.id);
        }
    };

    return (
        <motion.div
            className="space-y-2"
            initial="hidden"
            animate="visible"
            variants={
                prefersReduced
                    ? { hidden: {}, visible: {} }
                    : {
                        hidden: {},
                        visible: {
                            transition: { staggerChildren: 0.05, delayChildren: 0.2 },
                        },
                    }
            }
        >
            {dimensionKeys.map((key, i) => {
                const dim = dimensions[key];
                return (
                    <motion.div
                        key={key}
                        variants={
                            prefersReduced
                                ? { hidden: { opacity: 1 }, visible: { opacity: 1 } }
                                : {
                                    hidden: { opacity: 0, y: 8 },
                                    visible: {
                                        opacity: 1,
                                        y: 0,
                                        transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] },
                                    },
                                }
                        }
                    >
                        <CategoryCard
                            name={DIMENSION_LABELS[key]}
                            score={dim.score}
                            details={dim.details}
                            staggerDelay={i * 0.05}
                            onCardClick={
                                DIMENSION_SECTION_MAP[key]
                                    ? () => handleCardClick(key)
                                    : undefined
                            }
                        />
                    </motion.div>
                );
            })}
        </motion.div>
    );
}
