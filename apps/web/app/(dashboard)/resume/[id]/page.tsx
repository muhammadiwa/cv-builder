"use client";

import { use, useEffect } from "react";
import dynamic from "next/dynamic";
import { useResume } from "@/hooks/useResume";
import { useDebouncedSync } from "@/hooks/useDebouncedSync";
import { useIndexedDBSync } from "@/hooks/useIndexedDBSync";
import { useResumeRestore } from "@/hooks/useResumeRestore";
import { useEditorStore } from "@/stores/editorStore";
import EditorToolbar from "@/components/editor/EditorToolbar";
import { EditorShell } from "@/components/editor/EditorShell";

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

  // Local-first cache restore. Runs in parallel with `useResume`; the LWW
  // merge inside `markSyncedAll` makes their resolution order irrelevant.
  useResumeRestore(id);

  // When the React Query result arrives, merge server sections into the store
  // via per-field LWW. Client-newer fields stay client-side; server-newer
  // fields replace; conflicts are surfaced to the conflict toast (wired in
  // useDebouncedSync; here we only need the merge).
  useEffect(() => {
    if (!data?.sections) return;
    markSyncedAll(data.sections);
  }, [data, markSyncedAll]);

  // Keep IDB cache in step with the editor store at 800ms idle.
  useIndexedDBSync(id);
  // Keep the API in step at 2s idle (with field timestamps + conflict resolve).
  useDebouncedSync(id);

  // Global ⌘Z listener for AI undo (single-action, max depth 1).
  // Full undo/redo stack deferred to Story 2.6 (zundo).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        const restored = useEditorStore.getState().popUndo();
        if (restored) e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

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
    </EditorShell>
  );
}
