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