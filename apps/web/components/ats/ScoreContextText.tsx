"use client";

interface ScoreContextTextProps {
    score: number;
}

/**
 * Anchor context text shown alongside the score ring.
 * Score is never shown as a raw number alone (AC-6).
 */
export function ScoreContextText({ score }: ScoreContextTextProps) {
    const context = getContextMessage(score);

    return (
        <div className="text-center space-y-1">
            <p className="text-sm font-medium text-foreground">Skor ATS CV Anda</p>
            <p className="text-xs text-muted-foreground">{context}</p>
        </div>
    );
}

function getContextMessage(score: number): string {
    if (score >= 86) return "Sangat baik! CV Anda siap melewati screening ATS.";
    if (score >= 66) return "Bagus! CV Anda sudah cukup kompetitif.";
    if (score >= 41) return "Cukup baik. Beberapa perbaikan bisa meningkatkan skor.";
    return "Ini awal yang bagus. Semua orang mulai dari sini.";
}
