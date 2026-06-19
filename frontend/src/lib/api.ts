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
};