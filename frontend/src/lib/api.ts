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
}

export const jobsApi = {
  create: async (payload: JobIn): Promise<JobOut> => {
    const resp = await api.post<JobOut>('/jobs', payload);
    return resp.data;
  },

  list: async (skip = 0, limit = 50): Promise<JobOut[]> => {
    const resp = await api.get<JobOut[]>('/jobs', { params: { skip, limit } });
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

export interface CVScore {
  cv_id: string;
  overall: number;
  axes: Record<CVScoreAxis, CVScoreAxisData>;
  matched_keywords: string[];
  missing_keywords: string[];
  matched_skills: string[];
  missing_skills: string[];
  recommendations: CVScoreRecommendation[];
  scored_at: string;
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
};