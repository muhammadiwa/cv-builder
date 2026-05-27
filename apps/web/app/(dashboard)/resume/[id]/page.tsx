"use client";

import { use, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useResume } from "@/hooks/useResume";
import { useDebouncedSync } from "@/hooks/useDebouncedSync";
import { useIndexedDBSync } from "@/hooks/useIndexedDBSync";
import { useResumeRestore } from "@/hooks/useResumeRestore";
import { useEditorKeyboard } from "@/hooks/useEditorKeyboard";
import { useEditorStore } from "@/stores/editorStore";
import EditorToolbar from "@/components/editor/EditorToolbar";
import { EditorShell } from "@/components/editor/EditorShell";
import { GlobalCommandPalette } from "@/components/editor/GlobalCommandPalette";
import { SlashCommandPalette } from "@/components/editor/SlashCommandPalette";

const ResumeCanvas = dynamic(
  () => import("@/components/editor/ResumeCanvas"),
  { ssr: false },
);

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function EditorPage({ params }: PageProps) {
  const { id } = use(params);
  const { data, isLoading, error } = useResume(id);
  const markSyncedAll = useEditorStore((s) => s.markSyncedAll);
  const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false);

  // Local-first cache restore.
  useResumeRestore(id);

  // Merge server sections via per-field LWW.
  useEffect(() => {
    if (!data?.sections) return;
    markSyncedAll(data.sections);
  }, [data, markSyncedAll]);

  // Keep IDB cache in step at 800ms idle.
  useIndexedDBSync(id);
  // Keep the API in step at 2s idle.
  useDebouncedSync(id);

  // Centralized keyboard shortcuts (⌘Z, ⌘⇧Z, ⌘S, ⌘K, Tab).
  useEditorKeyboard({ onOpenCommandPalette: () => setCmdPaletteOpen(true) });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Loading resume…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-destructive">Failed to load resume.</p>
        <a href="/dashboard" className="text-sm underline">
          Back to Dashboard
        </a>
      </div>
    );
  }

  return (
    <EditorShell>
      <EditorToolbar />
      <div className="bg-muted/30 min-h-full">
        <ResumeCanvas />
      </div>
      <SlashCommandPalette />
      <GlobalCommandPalette open={cmdPaletteOpen} onOpenChange={setCmdPaletteOpen} />
    </EditorShell>
  );
}
