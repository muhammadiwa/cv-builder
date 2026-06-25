import axios from 'axios';

export const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 120_000,
});

// ── Typed wrappers ──────────────────────────────────────────────

export interface UploadResponse {
  upload_id: string;
  status: 'parsing' | 'parsed' | 'failed' | 'pending';
}

export interface UploadStatus {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  status: string;
  confidence_score: number;
  error_message?: string | null;
  parsed_json?: Record<string, unknown>;
}

export interface ProfileVersion {
  id: string;
  version_number: number;
  change_summary: string;
  created_at: string;
}

export const profileApi = {
  uploadResume: async (file: File): Promise<UploadResponse> => {
    const fd = new FormData();
    fd.append('file', file);
    const resp = await api.post<UploadResponse>('/profile/resume/upload', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60_000,
    });
    return resp.data;
  },

  getUploadStatus: async (uploadId: string): Promise<UploadStatus> => {
    const resp = await api.get<UploadStatus>(`/profile/resume/upload/${uploadId}`);
    return resp.data;
  },

  getProfile: async <T>(): Promise<T> => {
    const resp = await api.get<T>('/profile');
    return resp.data;
  },

  patchProfile: async <T>(patch: Partial<T>): Promise<T> => {
    const resp = await api.patch<T>('/profile', patch);
    return resp.data;
  },

  getVersions: async (): Promise<ProfileVersion[]> => {
    const resp = await api.get<ProfileVersion[]>('/profile/versions');
    return resp.data;
  },
};

// ── Jobs ─────────────────────────────────────────────────────────────

export type JobStatus = 'pending' | 'scraping' | 'parsing' | 'parsed' | 'failed';
export type JobSourceType = 'url' | 'manual';

export interface JobSkillCategory {
  name: string;
  keywords: string[];
}

export interface JobAnalysis {
  title?: string;
  company?: string;
  location?: string;
  remote_type?: string;
  employment_type?: string;
  seniority?: string;
  salary?: { min?: number; max?: number; currency?: string };
  summary?: string;
  responsibilities?: string[];
  required_skills?: JobSkillCategory[];
  preferred_skills?: JobSkillCategory[];
  required_experience_years?: number;
  required_education?: string;
  ats_keywords?: string[];
  confidence_score?: number;
  industry?: string;
}

export interface JobOut {
  id: string;
  source_type: JobSourceType;
  source_url?: string | null;
  raw_description?: string;
  title?: string | null;
  company?: string | null;
  location?: string | null;
  remote?: boolean;
  employment_type?: string | null;
  seniority?: string | null;
  salary_min?: number | null;
  salary_max?: number | null;
  salary_currency?: string | null;
  job_analysis_json?: JobAnalysis | Record<string, never>;
  ats_keywords_json?: string[] | Record<string, never>;
  status: JobStatus;
  error_message?: string | null;
  parsed_at?: string | null;
  created_at: string;
  updated_at: string;
  // When the source job board published the role. Preferred over
  // created_at for "Posted X ago" display. Null if the source didn't
  // expose a date (manual paste without user-supplied date).
  posted_at?: string | null;
}

export interface JobIn {
  source_type: JobSourceType;
  source_url?: string;
  raw_description?: string;
  title?: string;
  company?: string;
  location?: string;
  remote?: boolean;
  employment_type?: string;
  seniority?: string;
  salary_min?: number;
  salary_max?: number;
  salary_currency?: string;
  // Optional: client-supplied posting date for the 'manual' path.
  // The 'url' path usually leaves this null — the scraper will
  // override it from the source HTML if available.
  posted_at?: string | null;
}

// Phase 10E: paginated wrapper for the /api/jobs list response.
// Backend returns this shape (see backend/app/schemas/schemas.py
// PaginatedJobsOut) so the FE can drive pagination without a second
// round-trip to count jobs.
export interface PaginatedJobsOut {
  items: JobOut[];
  total: number;
  skip: number;
  limit: number;
  has_more: boolean;
}

export const jobsApi = {
  // Phase 10E: paginated response. Returns { items, total, skip, limit,
  // has_more }. Caller unwraps .items for the grid; the page component
  // also reads .total + .has_more for the pagination UI.
  list: async (skip = 0, limit = 24): Promise<PaginatedJobsOut> => {
    const resp = await api.get<PaginatedJobsOut>('/jobs', {
      params: { skip, limit },
    });
    return resp.data;
  },

  create: async (payload: JobIn): Promise<JobOut> => {
    const resp = await api.post<JobOut>('/jobs', payload);
    return resp.data;
  },

  get: async (id: string): Promise<JobOut> => {
    const resp = await api.get<JobOut>(`/jobs/${id}`);
    return resp.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/jobs/${id}`);
  },

  reanalyze: async (id: string): Promise<JobOut> => {
    const resp = await api.post<JobOut>(`/jobs/${id}/reanalyze`);
    return resp.data;
  },
};

// ── Match (Phase 5) ──────────────────────────────────────────────────

export type Recommendation = 'apply' | 'stretch' | 'skip';

export interface SkillMatchDetail {
  required_skill: string;
  required_keyword: string;
  matched_keyword: string | null;
  strength: number;
  // L2 fix: which matcher strategy produced this hit. "" | "exact" |
  // "substring" | "fuzzy". Lets the FE group by strategy and badge
  // fuzzy hits as "approximate" so users know when to double-check.
  match_method: 'exact' | 'substring' | 'fuzzy' | '' | null;
}

export interface ExperienceBreakdown {
  required_years: number | null;
  profile_years: number | null;
  status: 'exceeds' | 'meets' | 'close' | 'below' | 'unknown';
}

export interface SeniorityBreakdown {
  job_seniority: string | null;
  profile_seniority: string | null;
  status: 'match' | 'close' | 'mismatch' | 'unknown';
}

export interface EducationBreakdown {
  required: string | null;
  profile: string | null;
  status: 'exceeds' | 'meets' | 'below' | 'unknown';
}

export interface ScoreBreakdown {
  skill: number;
  experience: number;
  seniority: number;
  education: number;
}

export interface LLMNarrative {
  summary: string | null;
  strengths: string[];
  gaps: string[];
}

export interface JobMatch {
  id: string;
  job_id: string;
  profile_id: string;
  match_score: number;
  recommendation: Recommendation;
  score_breakdown: ScoreBreakdown;
  matched_skills: SkillMatchDetail[];
  missing_skills: SkillMatchDetail[];
  experience: ExperienceBreakdown;
  seniority: SeniorityBreakdown;
  education: EducationBreakdown;
  llm: LLMNarrative | null;
  confidence_score: number | null;
  // L2 fix: per-strategy hit counts from the matcher. Always present
  // (zero-filled on a 0% match or legacy rows). Used by the panel's
  // breakdown header to show "12 exact, 3 fuzzy" etc.
  match_telemetry: { exact: number; substring: number; fuzzy: number };
  created_at: string;
  updated_at: string | null;
}

// Phase 10D: ultra-light match summary for the job listing grid.
// Returned by GET /api/matches/summaries. The full JobMatch (with
// breakdown, matched/missing skills, LLM narrative) is fetched on
// demand when the user opens the Match Score Drawer.
export interface JobMatchSummary {
  job_id: string;
  match_score: number;        // 0.0 - 1.0
  recommendation: 'apply' | 'stretch' | 'skip';
  confidence_score: number | null;  // 0.0 - 1.0, null = unknown
  created_at: string;
}

export const matchesApi = {
  compute: async (jobId: string, opts?: { fast?: boolean }): Promise<JobMatch> => {
    // M3 fix: ?fast=true skips the LLM narrator (instant deterministic
    // refresh; useful when iterating on profile tweaks).
    const qs = opts?.fast ? '?fast=true' : '';
    const resp = await api.post<JobMatch>(`/jobs/${jobId}/match${qs}`);
    return resp.data;
  },
  get: async (jobId: string): Promise<JobMatch> => {
    const resp = await api.get<JobMatch>(`/jobs/${jobId}/match`);
    return resp.data;
  },
  delete: async (jobId: string): Promise<void> => {
    await api.delete(`/jobs/${jobId}/match`);
  },
  // Phase 10D: bulk summary fetch for the job listing grid. Returns one
  // lightweight entry per job that has a match. Jobs without a match
  // are simply absent — the FE treats absence as "no score yet".
  listSummaries: async (): Promise<JobMatchSummary[]> => {
    const resp = await api.get<JobMatchSummary[]>('/matches/summaries');
    return resp.data;
  },
};

// ── CV Drafts ────────────────────────────────────────────────────

export interface CVBasics {
  name?: string | null;
  title?: string | null;
  email?: string | null;
  phone?: string | null;
  location?: string | null;
  linkedin?: string | null;
  github?: string | null;
  portfolio?: string | null;
  url?: string | null;
}

export interface CVExperienceEntry {
  title?: string;
  company?: string;
  location?: string;
  start?: string;
  end?: string | null;
  bullets?: string[];
}

export interface CVEducationEntry {
  institution?: string;
  degree?: string;
  field?: string;
  start?: string;
  end?: string;
  gpa?: string;
}

export interface CVProjectEntry {
  name?: string;
  description?: string;
  tech?: string[];
  url?: string;
}

export interface CVJson {
  basics?: CVBasics;
  summary?: string;
  experience?: CVExperienceEntry[];
  education?: CVEducationEntry[];
  skills?: string[];
  projects?: CVProjectEntry[];
}

export interface CVDraft {
  id: string;
  job_id: string;
  profile_id: string;
  template_id: string;
  title: string;
  cv_json: CVJson;
  rendered_html: string | null;
  score: number;
  score_breakdown_json: Record<string, unknown>;
  status: 'draft' | 'ready' | 'exported';
  created_at: string;
  updated_at: string;
}

export interface CVRenderResponse {
  cv_draft_id: string;
  format: 'html' | 'markdown';
  content: string;
  sections: { kind: string; title: string; body_md: string }[];
}

export interface CVVersion {
  id: string;
  cv_draft_id: string;
  version_number: number;
  change_summary: string;
  score: number;
  created_at: string;
}

// ── Phase 7: CV scoring + recommendations ──────────────────────────────

export type CVScoreAxis = 'ats_coverage' | 'skill_gap' | 'bullet_strength' | 'format_safety';
export type CVRecommendationImpact = 'high' | 'med' | 'low';

export interface CVScoreRecommendation {
  id: string;
  title: string;
  impact: CVRecommendationImpact;
  axis: CVScoreAxis;
  details: string;
}

export interface CVScoreAxisData {
  score: number;
  weight: number;
  matched?: string[];
  missing?: string[];
  details?: Record<string, unknown>;
}

// F3 fix: enforce the 4-axis shape at the TS level so the FE
// hydration code doesn't have to hand-roll fallbacks. Mirrors the
// Pydantic ``_axes_have_all_known_keys`` validator on the BE.
export type CVScoreAxes = {
  ats_coverage: CVScoreAxisData;
  skill_gap: CVScoreAxisData;
  bullet_strength: CVScoreAxisData;
  format_safety: CVScoreAxisData;
};

export interface CVScore {
  cv_id: string;
  overall: number;
  axes: CVScoreAxes;
  matched_keywords: string[];
  missing_keywords: string[];
  matched_skills: string[];
  missing_skills: string[];
  recommendations: CVScoreRecommendation[];
  scored_at: string;
}

// F6 fix: single source of truth for projecting
// ``CVDraft.score_breakdown_json`` → ``CVScore``. Used by the
// hydration effect in CVScorePanel; kept here so any future field
// added to CVScore is added in one place (the panel doesn't reinvent
// the shape).
export function breakdownToScore(
  breakdown: Record<string, unknown>,
  cv: CVDraft
): CVScore {
  const axesRaw = (breakdown.axes ?? {}) as Partial<CVScoreAxes>;
  // Hydrate any missing axis with a safe zero so the UI can still
  // render. The BE validator guarantees all four are present for
  // new responses; this fallback covers legacy rows.
  const axes: CVScoreAxes = {
    ats_coverage: axesRaw.ats_coverage ?? { score: 0, weight: 0 },
    skill_gap: axesRaw.skill_gap ?? { score: 0, weight: 0 },
    bullet_strength: axesRaw.bullet_strength ?? { score: 0, weight: 0 },
    format_safety: axesRaw.format_safety ?? { score: 0, weight: 0 },
  };
  return {
    cv_id: cv.id,
    overall: (breakdown.overall as number) ?? cv.score ?? 0,
    axes,
    matched_keywords: axes.ats_coverage.matched ?? [],
    missing_keywords: axes.ats_coverage.missing ?? [],
    matched_skills: axes.skill_gap.matched ?? [],
    missing_skills: axes.skill_gap.missing ?? [],
    recommendations: (breakdown.recommendations as CVScoreRecommendation[]) ?? [],
    scored_at: cv.updated_at,
  };
}

export interface CVRecommendationItem {
  cv_id: string;
  cv_title: string;
  job_id: string;
  job_title: string;
  company: string | null;
  match_score: number;
  cv_score: number;
  composite: number;
  recommendation: 'apply' | 'stretch' | 'skip';
  missing_skills: string[];
}

// ── Phase 8: PDF export ──────────────────────────────────────────────
// Phase 8.5 fix: 'failed' file_type is a real value (renderer failure
// path persists a row so the history sidebar shows the failure).
export interface CVExport {
  id: string;
  entity_type: 'cv' | 'cover_letter';
  file_type: 'pdf' | 'docx' | 'failed';
  file_size: number;
  // Phase 8.5 B10: content hash of the actual returned bytes.
  sha256: string | null;
  created_at: string;
}

// F4 fix: unified threshold set used across the FE for "is this
// score good?". Matches the BE composite-recommendation cutoffs
// (apply ≥ 0.7, stretch ≥ 0.5) so the chip on the CV editor tab and
// the recommendation card never disagree for the same number.
export const SCORE_THRESHOLDS = {
  good: 0.7,
  ok: 0.5,
} as const;

export function scoreBucket(score: number): 'good' | 'ok' | 'low' {
  if (score >= SCORE_THRESHOLDS.good) return 'good';
  if (score >= SCORE_THRESHOLDS.ok) return 'ok';
  return 'low';
}

export type CVSectionKind = 'summary' | 'bullets' | 'experience' | 'skills';

export const cvsApi = {
  list: async (): Promise<CVDraft[]> => {
    const resp = await api.get<CVDraft[]>('/cvs');
    return resp.data;
  },
  get: async (cvId: string): Promise<CVDraft> => {
    const resp = await api.get<CVDraft>(`/cvs/${cvId}`);
    return resp.data;
  },
  create: async (payload: {
    job_id: string;
    profile_id: string;
    title: string;
    template_id?: string;
  }): Promise<CVDraft> => {
    const resp = await api.post<CVDraft>('/cvs', payload);
    return resp.data;
  },
  patch: async (
    cvId: string,
    payload: { title?: string; cv_json?: CVJson; status?: string; template_id?: string; job_id?: string | null }
  ): Promise<CVDraft> => {
    const resp = await api.patch<CVDraft>(`/cvs/${cvId}`, payload);
    return resp.data;
  },
  delete: async (cvId: string): Promise<void> => {
    await api.delete(`/cvs/${cvId}`);
  },
  render: async (cvId: string, format: 'html' | 'markdown' = 'html'): Promise<CVRenderResponse> => {
    const resp = await api.get<CVRenderResponse>(`/cvs/${cvId}/render`, {
      params: { format },
    });
    return resp.data;
  },
  enhance: async (
    cvId: string,
    payload: {
      section: CVSectionKind;
      experience_index?: number;
      target_job_id?: string;
    }
  ): Promise<CVDraft> => {
    const resp = await api.post<CVDraft>(`/cvs/${cvId}/enhance`, payload);
    return resp.data;
  },
  versions: async (cvId: string): Promise<CVVersion[]> => {
    const resp = await api.get<CVVersion[]>(`/cvs/${cvId}/versions`);
    return resp.data;
  },
  restoreVersion: async (cvId: string, versionId: string): Promise<CVDraft> => {
    const resp = await api.post<CVDraft>(
      `/cvs/${cvId}/versions/${versionId}/restore`,
    );
    return resp.data;
  },
  // Phase 7: force re-score + return full breakdown.
  score: async (cvId: string): Promise<CVScore> => {
    const resp = await api.post<CVScore>(`/cvs/${cvId}/score`);
    return resp.data;
  },
  // Phase 7: best CV×job pairs sorted by composite score.
  recommendations: async (limit = 10): Promise<CVRecommendationItem[]> => {
    const resp = await api.get<CVRecommendationItem[]>(
      `/cvs/recommendations?limit=${limit}`,
    );
    return resp.data;
  },
  // Phase 8: trigger an ATS-safe PDF export. Returns the file name
  // suggested by the server (Content-Disposition) and triggers a
  // browser download. Throws on non-2xx so the caller can surface
  // a toast.
  exportPdf: async (cvId: string, fmt: 'pdf' | 'docx' = 'pdf'): Promise<{ fileName: string; exportId: string; size: number }> => {
    const resp = await api.post<Blob>(
      // Phase 8.5 B7: query param name is still `format` on the
      // URL (FastAPI binds it via Query alias if we wanted, but the
      // FE consumer is the legacy caller; the route param is
      // renamed server-side). Renamed `format` → `fmt` only at the
      // Python layer to stop shadowing the builtin.
      `/cvs/${cvId}/export?format=${fmt}`,
      null,
      { responseType: 'blob' },
    );
    // Read the suggested file name + export id from custom headers
    // (set by the route). Fall back to a sensible default if missing.
    const cd = resp.headers['content-disposition'] as string | undefined;
    const match = cd?.match(/filename="?([^"]+)"?/);
    const fileName = match?.[1] ?? `cv_${cvId.slice(0, 8)}.pdf`;
    const exportId = (resp.headers['x-cv-export-id'] as string | undefined) ?? '';
    const sizeHeader = resp.headers['x-cv-export-size'] as string | undefined;
    const size = sizeHeader ? Number(sizeHeader) : resp.data.size;

    // Trigger download via a hidden anchor + Object URL.
    const url = URL.createObjectURL(resp.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Defer revoke so the browser has time to start the download.
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    return { fileName, exportId, size };
  },
  // Phase 8: history of past PDF generations for this CV.
  listExports: async (cvId: string, limit = 10): Promise<CVExport[]> => {
    const resp = await api.get<CVExport[]>(`/cvs/${cvId}/exports?limit=${limit}`);
    return resp.data;
  },
};

// ── Phase 9B: Applications ───────────────────────────────────────────

export type ApplicationStatus =
  | 'draft'
  | 'ready'
  | 'applied'
  | 'interview'
  | 'rejected'
  | 'offer';

export interface Application {
  id: string;
  job_id: string;
  cv_draft_id: string | null;
  cover_letter_id: string | null;
  status: ApplicationStatus;
  applied_date: string | null;
  follow_up_date: string | null;
  contact_person: string | null;
  contact_email: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const APPLICATION_STATUSES: ApplicationStatus[] = [
  'draft',
  'ready',
  'applied',
  'interview',
  'offer',
  'rejected',
];

export const applicationsApi = {
  list: async (params?: { status?: ApplicationStatus; job_id?: string; limit?: number }): Promise<Application[]> => {
    const resp = await api.get<Application[]>('/applications', { params });
    return resp.data;
  },
  // M6 fix (Phase 9 review): removed `get` — dead code. The detail
  // drawer uses ``apps.find((a) => a.id === selectedId)`` on the
  // already-loaded list, so the per-id GET was never called. If a
  // future feature needs a fresh fetch, re-add it then.
  create: async (payload: {
    job_id: string;
    cv_draft_id?: string | null;
    cover_letter_id?: string | null;
    status?: ApplicationStatus;
    notes?: string | null;
    contact_person?: string | null;
    contact_email?: string | null;
    follow_up_date?: string | null;
  }): Promise<Application> => {
    const resp = await api.post<Application>('/applications', payload);
    return resp.data;
  },
  patch: async (id: string, payload: Partial<Application>): Promise<Application> => {
    const resp = await api.patch<Application>(`/applications/${id}`, payload);
    return resp.data;
  },
  transition: async (id: string, status: ApplicationStatus): Promise<Application> => {
    const resp = await api.post<Application>(`/applications/${id}/status`, { status });
    return resp.data;
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/applications/${id}`);
  },
};

// ── Phase 9A: Cover Letters ─────────────────────────────────────────

export type CoverLetterTone =
  | 'professional'
  | 'confident'
  | 'friendly'
  | 'concise'
  | 'formal';

export type CoverLetterStatus = 'draft' | 'ready' | 'exported';

export interface CoverLetterGenerateIn {
  job_id: string;
  profile_id: string;
  cv_draft_id?: string | null;
  tone?: CoverLetterTone;
  use_llm?: boolean;
}

export interface CoverLetterPatchIn {
  subject?: string;
  content?: string;
  tone?: CoverLetterTone;
  status?: CoverLetterStatus;
  personalization_points?: string[];
}

export interface CoverLetterScoreAxis {
  score: number;
  weight: number;
  details?: Record<string, unknown>;
}

export interface CoverLetterScoreBreakdown {
  overall?: number;
  axes?: Record<string, CoverLetterScoreAxis>;
  matched_keywords?: string[];
  missing_keywords?: string[];
  matched_skills?: string[];
  missing_skills?: string[];
  recommendations?: { id: string; title: string; impact: 'high' | 'med' | 'low'; details: string }[];
  scored_at?: string;
}

export interface CoverLetterOut {
  id: string;
  job_id: string;
  profile_id: string;
  cv_draft_id: string | null;
  tone: CoverLetterTone;
  subject: string | null;
  content: string;
  personalization_points: string[];
  job_keywords_used: string[];
  score: number;
  score_breakdown_json: CoverLetterScoreBreakdown;
  status: CoverLetterStatus;
  created_at: string;
  updated_at: string;
}

export const coverLettersApi = {
  generate: async (payload: CoverLetterGenerateIn): Promise<CoverLetterOut> => {
    const resp = await api.post<CoverLetterOut>('/cover-letters/generate', payload);
    return resp.data;
  },
  list: async (opts?: { jobId?: string; limit?: number }): Promise<CoverLetterOut[]> => {
    const resp = await api.get<CoverLetterOut[]>('/cover-letters', {
      params: { job_id: opts?.jobId, limit: opts?.limit ?? 50 },
    });
    return resp.data;
  },
  get: async (id: string): Promise<CoverLetterOut> => {
    const resp = await api.get<CoverLetterOut>(`/cover-letters/${id}`);
    return resp.data;
  },
  patch: async (id: string, payload: CoverLetterPatchIn): Promise<CoverLetterOut> => {
    const resp = await api.patch<CoverLetterOut>(`/cover-letters/${id}`, payload);
    return resp.data;
  },
  rescore: async (id: string): Promise<CoverLetterOut> => {
    const resp = await api.post<CoverLetterOut>(`/cover-letters/${id}/rescore`);
    return resp.data;
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/cover-letters/${id}`);
  },
  exportFile: async (
    id: string,
    fmt: 'pdf' | 'docx' = 'pdf',
  ): Promise<{ fileName: string; exportId: string; size: number }> => {
    const resp = await api.post<Blob>(
      `/cover-letters/${id}/export?format=${fmt}`,
      null,
      { responseType: 'blob' },
    );
    const cd = resp.headers['content-disposition'] as string | undefined;
    const match = cd?.match(/filename="?([^"]+)"?/);
    const fileName = match?.[1] ?? `cover_letter_${id.slice(0, 8)}.${fmt}`;
    // H1 fix (Phase 9 review): header name is X-Cover-Letter-Export-Id
    // (different from the CV export's X-Cv-Export-Id). Reading the
    // wrong header returned an empty exportId and broke the audit
    // hook on the FE.
    const exportId = (resp.headers['x-cover-letter-export-id'] as string | undefined) ?? '';
    const sizeHeader = resp.headers['x-cover-letter-export-size'] as string | undefined;
    const size = sizeHeader ? Number(sizeHeader) : resp.data.size;
    const url = URL.createObjectURL(resp.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return { fileName, exportId, size };
  },
  listExports: async (id: string, limit = 10): Promise<CVExport[]> => {
    const resp = await api.get<CVExport[]>(`/cover-letters/${id}/exports?limit=${limit}`);
    return resp.data;
  },
};// ── Phase 10A: Templates ──────────────────────────────────────────
export type FontFamily = 'serif' | 'sans' | 'mono';
export type Density = 'compact' | 'normal' | 'spacious';
export type BulletStyle = 'dash' | 'bullet' | 'arrow';
export type DateFormat = 'Mon YYYY' | 'MM/YYYY' | 'YYYY';
export type PageSize = 'A4' | 'Letter';

// Phase 10B: structural axes — drive LAYOUT, not just typography.
export type HeaderStyle = 'stacked' | 'inline' | 'banner';
export type SectionHeadingStyle = 'bar' | 'underline' | 'plain' | 'numbered';
export type ExperienceLayout = 'standard' | 'dates_right' | 'inline_dates' | 'compact';
export type SkillsLayout =
  | 'comma' | 'pipe' | 'categorized' | 'pills'
  | 'proficiency' | 'chips';

// Phase 10C: decoration axes — color, heading rule, name typography,
// sidebar layout. All optional so legacy configs keep working.
export type HeadingRule = 'bar' | 'underline' | 'double' | 'thick' | 'plain';
export type NameTypography = 'regular' | 'display' | 'letter_spaced';

export interface TemplateConfigJson {
  id: string;
  name: string;
  type: 'cv' | 'cover_letter';
  sections: string[];
  font_family: FontFamily;
  accent_color: string;
  density: Density;
  bullet_style: BulletStyle;
  date_format: DateFormat;
  page_size: PageSize;
  header_style: HeaderStyle;
  section_heading_style: SectionHeadingStyle;
  experience_layout: ExperienceLayout;
  skills_layout: SkillsLayout;
  // Phase 10C decoration axes (all optional for backward compat)
  heading_rule?: HeadingRule;
  name_typography?: NameTypography;
  sidebar_layout?: boolean;
  ats_friendly: boolean;
  description: string;
}

export interface TemplateSummary {
  id: string;
  name: string;
  type: 'cv' | 'cover_letter';
  description: string;
  is_ats_friendly: boolean;
  is_default: boolean;
  created_at: string;
  template_config_json: TemplateConfigJson;
}

export interface Template extends TemplateSummary {
  template_config_json: TemplateConfigJson;
}

export interface TemplatePreviewResponse {
  rendered_html: string;
  config_used: TemplateConfigJson;
}

export const templatesApi = {
  list: async (type?: 'cv' | 'cover_letter'): Promise<TemplateSummary[]> => {
    const resp = await api.get<TemplateSummary[]>('/templates', {
      params: type ? { type } : undefined,
    });
    return resp.data;
  },
  get: async (id: string): Promise<Template> => {
    const resp = await api.get<Template>(`/templates/${id}`);
    return resp.data;
  },
  create: async (payload: {
    id: string;
    name: string;
    description?: string;
    type?: 'cv' | 'cover_letter';
    sections?: string[];
    font_family?: FontFamily;
    accent_color?: string;
    density?: Density;
    bullet_style?: BulletStyle;
    date_format?: DateFormat;
    page_size?: PageSize;
    header_style?: HeaderStyle;
    section_heading_style?: SectionHeadingStyle;
    experience_layout?: ExperienceLayout;
    skills_layout?: SkillsLayout;
    // Phase 10C decoration axes
    heading_rule?: HeadingRule;
    name_typography?: NameTypography;
    sidebar_layout?: boolean;
    is_ats_friendly?: boolean;
  }): Promise<Template> => {
    const resp = await api.post<Template>('/templates', payload);
    return resp.data;
  },
  patch: async (
    id: string,
    payload: Partial<{
      name: string;
      description: string;
      sections: string[];
      font_family: FontFamily;
      accent_color: string;
      density: Density;
      bullet_style: BulletStyle;
      date_format: DateFormat;
      page_size: PageSize;
      header_style: HeaderStyle;
      section_heading_style: SectionHeadingStyle;
      experience_layout: ExperienceLayout;
      skills_layout: SkillsLayout;
      // Phase 10C decoration axes
      heading_rule: HeadingRule;
      name_typography: NameTypography;
      sidebar_layout: boolean;
      is_ats_friendly: boolean;
    }>,
  ): Promise<Template> => {
    const resp = await api.patch<Template>(`/templates/${id}`, payload);
    return resp.data;
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/templates/${id}`);
  },
  duplicate: async (id: string, newId: string): Promise<Template> => {
    const resp = await api.post<Template>(
      `/templates/${id}/duplicate`,
      {},
      { params: { new_id: newId } },
    );
    return resp.data;
  },
  preview: async (payload: {
    profile_id?: string;
    cv_json?: CVJson;
    template_config_json: Partial<TemplateConfigJson>;
  }): Promise<TemplatePreviewResponse> => {
    const resp = await api.post<TemplatePreviewResponse>(
      '/templates/preview',
      payload,
    );
    return resp.data;
  },
};

// ── LLM Providers (Phase 10B) ──────────────────────────────────────
export type LLMProviderKind = 'openai_compat' | 'anthropic';

export type LLMTaskType =
  | 'resume_parse'
  | 'job_analyze'
  | 'match'
  | 'score_match'
  | 'cv_generate'
  | 'cv_score'
  | 'cv_improve'
  | 'cv_enhance'
  | 'cover_letter';

export const LLM_TASK_TYPES: readonly LLMTaskType[] = [
  'resume_parse',
  'job_analyze',
  'match',
  'score_match',
  'cv_generate',
  'cv_score',
  'cv_improve',
  'cv_enhance',
  'cover_letter',
] as const;

export interface LLMProvider {
  id: string;
  display_name: string;
  kind: LLMProviderKind;
  base_url: string;
  api_key_set: boolean;
  enabled: boolean;
  priority: number;
  models_json: Partial<Record<LLMTaskType, string>>;
  max_tokens_default: number;
  temperature_default: number;
  created_at: string;
  updated_at: string;
}

export interface LLMProviderCreatePayload {
  id: string;
  display_name: string;
  kind: LLMProviderKind;
  base_url?: string;
  api_key?: string;
  enabled?: boolean;
  priority?: number;
  models_json?: Partial<Record<LLMTaskType, string>>;
  max_tokens_default?: number;
  temperature_default?: number;
}

export interface LLMProviderPatchPayload {
  display_name?: string;
  kind?: LLMProviderKind;
  base_url?: string | null;
  api_key?: string;  // empty string clears the key
  enabled?: boolean;
  priority?: number;
  models_json?: Partial<Record<LLMTaskType, string>>;
  max_tokens_default?: number;
  temperature_default?: number;
}

export interface LLMProviderTestPayload {
  model?: string;
  prompt?: string;
}

export interface LLMProviderTestResult {
  ok: boolean;
  message: string;
  latency_ms?: number | null;
  model?: string | null;
  response_preview?: string | null;
}

export const llmProvidersApi = {
  list: async (): Promise<LLMProvider[]> => {
    const resp = await api.get<LLMProvider[]>('/llm-providers');
    return resp.data;
  },
  get: async (id: string): Promise<LLMProvider> => {
    const resp = await api.get<LLMProvider>(`/llm-providers/${id}`);
    return resp.data;
  },
  create: async (payload: LLMProviderCreatePayload): Promise<LLMProvider> => {
    const resp = await api.post<LLMProvider>('/llm-providers', payload);
    return resp.data;
  },
  patch: async (
    id: string,
    payload: LLMProviderPatchPayload,
  ): Promise<LLMProvider> => {
    const resp = await api.patch<LLMProvider>(
      `/llm-providers/${id}`,
      payload,
    );
    return resp.data;
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/llm-providers/${id}`);
  },
  test: async (
    id: string,
    payload: LLMProviderTestPayload = {},
  ): Promise<LLMProviderTestResult> => {
    const resp = await api.post<LLMProviderTestResult>(
      `/llm-providers/${id}/test`,
      payload,
    );
    return resp.data;
  },
};