"use client";

import { use, useEffect } from "react";
import dynamic from "next/dynamic";
import { useResume } from "@/hooks/useResume";
import { useDebouncedSync } from "@/hooks/useDebouncedSync";
import { useEditorStore } from "@/stores/editorStore";
import EditorToolbar from "@/components/editor/EditorToolbar";

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

  useEffect(() => {
    if (data?.sections) {
      setSections(data.sections);
    }
  }, [data, setSections]);

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
    <div className="min-h-screen flex flex-col">
      <EditorToolbar />
      <div className="flex-1 bg-muted/30">
        <ResumeCanvas />
      </div>
    </div>
  );
}
