"use client";

import { useEffect, useState } from "react";
import { useEditorStore } from "@/stores/editorStore";
import { useSyncStatus } from "@/hooks/useSyncStatus";

/**
 * StatusBar
 *
 * Persistent footer showing at-a-glance editor health:
 *   - ATS score mini ring (placeholder until Story 3.1)
 *   - Word count derived live from sections' content
 *   - Last-saved timestamp ("just now", "3m ago") with `Intl.RelativeTimeFormat`
 *   - Sync indicator dot (green/yellow/red) with tooltip
 *
 * The bar is intentionally compact so it doesn't compete with the canvas.
 */
export function StatusBar() {
  const sections = useEditorStore((s) => s.sections);
  const { status, lastSyncedAt } = useSyncStatus();

  const wordCount = countWords(sections);

  return (
    <div className="flex items-center gap-4 px-4 h-9 border-t bg-background/80 backdrop-blur text-xs text-muted-foreground">
      <ATSMiniRing score={null} />
      <Separator />
      <span aria-label={`${wordCount} words`}>{wordCount} kata</span>
      <Separator />
      <RelativeTime ts={lastSyncedAt} />
      <div className="ml-auto">
        <SyncDot status={status} />
      </div>
    </div>
  );
}

function Separator() {
  return <span className="h-3 w-px bg-border" aria-hidden="true" />;
}

/**
 * Placeholder mini ring. Renders a static 0% with a "soon" affordance until
 * the ATS engine lands in Story 3.1.
 */
function ATSMiniRing({ score }: { score: number | null }) {
  const value = score ?? 0;
  const radius = 7;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <span
      className="inline-flex items-center gap-1.5"
      title={
        score == null
          ? "ATS scoring will arrive in Story 3.1"
          : `ATS score: ${score}%`
      }
    >
      <svg width={18} height={18} viewBox="0 0 18 18" aria-hidden="true">
        <circle
          cx="9"
          cy="9"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.2}
          strokeWidth={2}
        />
        <circle
          cx="9"
          cy="9"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 9 9)"
        />
      </svg>
      <span>ATS {score == null ? "—" : `${score}%`}</span>
    </span>
  );
}

function SyncDot({ status }: { status: "synced" | "pending" | "offline" }) {
  const map = {
    synced: { color: "bg-emerald-500", label: "Tersimpan" },
    pending: { color: "bg-amber-500", label: "Menyimpan…" },
    offline: { color: "bg-red-500", label: "Offline" },
  } as const;
  const { color, label } = map[status];

  return (
    <span
      className="inline-flex items-center gap-1.5"
      role="status"
      aria-live="polite"
      title={label}
    >
      <span
        className={`h-2 w-2 rounded-full ${color}`}
        aria-hidden="true"
      />
      <span>{label}</span>
    </span>
  );
}

/**
 * Re-renders once a minute so "just now" stays accurate without burning
 * frames. Locale-aware via `Intl.RelativeTimeFormat`.
 */
function RelativeTime({ ts }: { ts: number | null }) {
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  if (ts == null) {
    return <span>Belum disimpan</span>;
  }

  const seconds = Math.max(0, Math.floor((now - ts) / 1000));
  const rtf = new Intl.RelativeTimeFormat("id", { numeric: "auto" });

  let label: string;
  if (seconds < 30) label = "baru saja";
  else if (seconds < 60) label = rtf.format(-seconds, "second");
  else if (seconds < 3600) label = rtf.format(-Math.floor(seconds / 60), "minute");
  else if (seconds < 86_400) label = rtf.format(-Math.floor(seconds / 3600), "hour");
  else label = rtf.format(-Math.floor(seconds / 86_400), "day");

  return (
    <span title={new Date(ts).toLocaleString("id-ID")}>Disimpan {label}</span>
  );
}

function countWords(
  sections: { content: Record<string, unknown> }[],
): number {
  let total = 0;
  for (const s of sections) {
    for (const v of Object.values(s.content)) {
      if (typeof v !== "string") continue;
      // Strip HTML produced by RichTextField, then count whitespace-separated words.
      const stripped = v.replace(/<[^>]*>/g, " ").trim();
      if (!stripped) continue;
      total += stripped.split(/\s+/).length;
    }
  }
  return total;
}
