"use client";

import { Sparkles, Target, Palette } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Three empty-state placeholders for the right panel tabs.
 *
 * Each panel will be replaced by the real implementation in a follow-up story:
 *   - AI    → Story 2.5 (AI Inline Rewrite) / Epic 4 (Kak Chat)
 *   - ATS   → Story 3.1 (ATS Scoring Engine)
 *   - Template → Story 5.1 (Template Gallery)
 *
 * The placeholders are intentionally informative so the user understands the
 * surface they are looking at — we want to communicate *what's coming*,
 * not just an empty card.
 */

export function AIPanelPlaceholder() {
  return (
    <Placeholder
      icon={<Sparkles className="h-6 w-6" />}
      title="AI Assistant"
      description="Sebentar lagi, Kak — asisten karier AI-mu — bakal nulis bareng di sini. Tinggal pilih bagian, minta perbaikan, dan lihat saran langsung di samping kanvas."
      cta="Coming soon"
    />
  );
}

export function ATSPanelPlaceholder() {
  return (
    <Placeholder
      icon={<Target className="h-6 w-6" />}
      title="ATS Score"
      description="Skor kelolosan ATS dan rekomendasi perbaikan akan muncul di sini begitu Engine ATS aktif. Buat CV yang lolos screening robot HR."
      cta="Coming soon"
    />
  );
}

export function TemplatePanelPlaceholder() {
  return (
    <Placeholder
      icon={<Palette className="h-6 w-6" />}
      title="Template"
      description="Pilih dan ganti template visual di sini. Layout berubah real-time tanpa kehilangan isi CV-mu."
      cta="Coming soon"
    />
  );
}

function Placeholder({
  icon,
  title,
  description,
  cta,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  cta: string;
}) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-6 py-8 gap-4">
      <div className="rounded-full bg-muted p-4 text-muted-foreground">
        {icon}
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
        {description}
      </p>
      <span className="inline-flex items-center text-xs uppercase tracking-wider text-muted-foreground/70 border rounded-full px-2.5 py-0.5">
        {cta}
      </span>
    </div>
  );
}
