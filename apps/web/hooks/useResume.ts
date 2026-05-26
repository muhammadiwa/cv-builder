"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { SectionType } from "@/types/resume";

export interface ResumeSection {
  id: string;
  resumeId: string;
  sectionType: SectionType;
  displayOrder: number;
  content: Record<string, unknown>;
  aiGenerated: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ResumeData {
  id: string;
  userId: string;
  templateId: string;
  title: string;
  status: "draft" | "published" | "archived";
  language: string;
  atsScore: number | null;
  createdAt: string;
  updatedAt: string;
  template: { id: string; name: string; config: unknown };
  sections: ResumeSection[];
}

export function useResume(id: string) {
  return useQuery({
    queryKey: ["resume", id],
    queryFn: () => apiFetch<ResumeData>(`/resumes/${id}`),
    enabled: !!id,
  });
}
