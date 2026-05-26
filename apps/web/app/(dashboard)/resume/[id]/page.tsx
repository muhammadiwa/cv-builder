"use client";

import { use, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { useResume } from "@/hooks/useResume";
import { useDebouncedSync } from "@/hooks/useDebouncedSync";
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
  const setSections = useEditorStore((s) => s.setSections);
  const dirty = useEditorStore((s) => s.dirty);

  // Track the resume id we last hydrated from the server. We only re-hydrate
  // when:
  //   - we move to a different resume (id changes), OR
  //   - we have no local edits in flight (dirty === false), to avoid
  //     clobbering an unsaved change with a background React Query refetch.
  const hydratedForId = useRef<string | null>(null);
  useEffect(() => {
    if (!data?.sections) return;
    const isNewResume = hydratedForId.current !== data.id;
    if (isNewResume || !dirty) {
      setSections(data.sections);
      hydratedForId.current = data.id;
    }
  }, [data, dirty, setSections]);

  useDebouncedSync(id);

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
