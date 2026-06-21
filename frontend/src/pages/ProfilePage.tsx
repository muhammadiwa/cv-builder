import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { User, AlertCircle, History } from 'lucide-react';
import clsx from 'clsx';

import { profileApi, UploadStatus } from '../lib/api';
import UploadZone from '../components/UploadZone';
import ProfileEditForm, { ProfileData } from '../components/ProfileEditForm';
import PageHeader from '../components/PageHeader';

type UploadStatusState = 'idle' | 'uploading' | 'parsing' | 'parsed' | 'failed';

// Module-level so HMR + Strict Mode double-invoke can't double-schedule
let pollTimer: ReturnType<typeof setInterval> | null = null;
function clearPollTimer() {
  if (pollTimer !== null) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

export default function ProfilePage() {
  const qc = useQueryClient();
  const [uploadState, setUploadState] = useState<UploadStatusState>('idle');
  const [uploadFileName, setUploadFileName] = useState<string>();
  const [uploadError, setUploadError] = useState<string>();
  const [confidenceScore, setConfidenceScore] = useState<number>();
  const [saving, setSaving] = useState(false);
  const [saveBanner, setSaveBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  // local guard to prevent overlapping save requests (UI debounce)
  const saveInFlightRef = useRef(false);
  // monotonic counter — only the latest poll request's result can update UI
  const uploadTokenRef = useRef(0);

  // Load profile (404 = no profile yet, normal)
  const profileQuery = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      try {
        return await profileApi.getProfile<ProfileData>();
      } catch (e: any) {
        if (e?.response?.status === 404) return null;
        throw e;
      }
    },
    refetchOnWindowFocus: false,
  });

  // Load version history
  const versionsQuery = useQuery({
    queryKey: ['profile-versions'],
    queryFn: () => profileApi.getVersions(),
    enabled: !!profileQuery.data,
    refetchOnWindowFocus: false,
  });

  const stopPolling = useCallback(() => {
    clearPollTimer();
  }, []);

  // Cleanup on unmount
  useEffect(() => stopPolling, [stopPolling]);

  const startPolling = useCallback(
    (uploadId: string) => {
      stopPolling();
      const myToken = ++uploadTokenRef.current;
      pollTimer = setInterval(async () => {
        try {
          const status: UploadStatus = await profileApi.getUploadStatus(uploadId);
          // If a newer upload started, ignore this poll's result
          if (myToken !== uploadTokenRef.current) return;
          if (status.status === 'parsed') {
            setUploadState('parsed');
            setConfidenceScore(status.confidence_score);
            stopPolling();
            qc.invalidateQueries({ queryKey: ['profile'] });
            qc.invalidateQueries({ queryKey: ['profile-versions'] });
          } else if (status.status === 'failed') {
            setUploadState('failed');
            setUploadError(status.error_message ?? 'Parse failed');
            stopPolling();
          }
        } catch {
          // network blip — keep polling
        }
      }, 1500);
    },
    [qc, stopPolling],
  );

  const handleUpload = useCallback(
    async (file: File) => {
      // Reset upload-related state immediately so a new upload starts clean
      setUploadState('uploading');
      setUploadFileName(file.name);
      setUploadError(undefined);
      setConfidenceScore(undefined);
      // bump token — cancels any in-flight poll for prior upload
      uploadTokenRef.current += 1;
      stopPolling();
      try {
        const resp = await profileApi.uploadResume(file);
        setUploadState('parsing');
        startPolling(resp.upload_id);
      } catch (e: any) {
        setUploadState('failed');
        const detail = e?.response?.data?.detail ?? e?.message ?? 'Upload failed';
        setUploadError(typeof detail === 'string' ? detail : JSON.stringify(detail));
      }
    },
    [startPolling, stopPolling],
  );

  const handleSave = useCallback(
    async (patch: Partial<ProfileData>) => {
      // Guard against double-clicks and overlapping saves
      if (saveInFlightRef.current) return;
      saveInFlightRef.current = true;
      setSaving(true);
      setSaveBanner(null);
      try {
        await profileApi.patchProfile<ProfileData>(patch);
        await qc.invalidateQueries({ queryKey: ['profile'] });
        await qc.invalidateQueries({ queryKey: ['profile-versions'] });
        setSaveBanner({ kind: 'ok', text: 'Profile saved.' });
        setTimeout(() => setSaveBanner(null), 3000);
      } catch (e: any) {
        const detail = e?.response?.data?.detail ?? e?.message ?? 'Save failed';
        setSaveBanner({ kind: 'err', text: typeof detail === 'string' ? detail : 'Save failed' });
      } finally {
        setSaving(false);
        saveInFlightRef.current = false;
      }
    },
    [qc],
  );

  // Save a single section (skills / work / education / projects) in
  // place. The BE handler accepts base_profile_json as a key and
  // replaces the whole dict, so we read the current state, swap the
  // one section, and PATCH the result.
  const handleSectionSave = useCallback(
    async <K extends 'work' | 'education' | 'skills' | 'projects'>(
      section: K,
      items: NonNullable<NonNullable<ProfileData['base_profile_json']>[K]>,
    ) => {
      if (saveInFlightRef.current) return;
      saveInFlightRef.current = true;
      setSaving(true);
      setSaveBanner(null);
      try {
        const current = profileQuery.data?.base_profile_json ?? {};
        const updated = { ...current, [section]: items };
        await profileApi.patchProfile<ProfileData>({
          base_profile_json: updated as ProfileData['base_profile_json'],
        });
        await qc.invalidateQueries({ queryKey: ['profile'] });
        await qc.invalidateQueries({ queryKey: ['profile-versions'] });
        setSaveBanner({ kind: 'ok', text: 'Profile saved.' });
        setTimeout(() => setSaveBanner(null), 3000);
      } catch (e: any) {
        const detail = e?.response?.data?.detail ?? e?.message ?? 'Save failed';
        setSaveBanner({ kind: 'err', text: typeof detail === 'string' ? detail : 'Save failed' });
      } finally {
        setSaving(false);
        saveInFlightRef.current = false;
      }
    },
    [qc, profileQuery.data],
  );

  const profile = profileQuery.data;
  const isLoading = profileQuery.isLoading;
  const hasProfile = !!profile;

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        icon={User}
        title="Base Profile"
        subtitle="The structured resume data that powers every tailored CV."
      />

      {/* Save banner */}
      {saveBanner && (
        <div
          className={clsx(
            'rounded-lg px-4 py-2.5 text-sm flex items-center gap-2',
            saveBanner.kind === 'ok'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-red-50 text-red-700 border border-red-200',
          )}
        >
          <AlertCircle size={14} />
          {saveBanner.text}
        </div>
      )}

      {/* Main content */}
      {isLoading ? (
        <div className="card card-pad text-sm text-slate-500">Loading profile…</div>
      ) : !hasProfile ? (
        <div className="card card-pad space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Upload your resume</h2>
            <p className="text-xs text-slate-500 mt-1">
              AI will extract your experience, skills, and education into a structured
              profile. Nothing is invented — review everything before saving.
            </p>
          </div>
          <UploadZone
            status={uploadState}
            fileName={uploadFileName}
            errorMessage={uploadError}
            onUpload={handleUpload}
          />
          {uploadState === 'parsed' && profileQuery.isFetching && (
            <div className="text-xs text-slate-500">Loading parsed profile…</div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
          {/* Main editor */}
          <div className="lg:col-span-8 space-y-6">
            <ProfileEditForm
              profile={profile}
              onSave={handleSave}
              onSectionSave={handleSectionSave}
              saving={saving}
            />
          </div>

          {/* Sidebar: re-upload + version history */}
          <aside className="lg:col-span-4 space-y-6">
            <section className="card card-pad">
              <h3 className="section-title">Re-upload resume</h3>
              <p className="text-xs text-slate-500 mb-3">
                Drop a new file to replace the current profile. A new version is saved automatically.
              </p>
              <UploadZone
                status={uploadState}
                fileName={uploadFileName}
                errorMessage={uploadError}
                confidenceScore={confidenceScore}
                onUpload={handleUpload}
              />
            </section>

            <section className="card card-pad">
              <div className="flex items-center gap-2 mb-3">
                <History size={14} className="text-slate-500" />
                <h3 className="section-title mb-0">Version history</h3>
              </div>
              {versionsQuery.isLoading && (
                <div className="text-xs text-slate-500">Loading…</div>
              )}
              {versionsQuery.data && versionsQuery.data.length === 0 && (
                <div className="text-xs text-slate-500 italic">No versions yet.</div>
              )}
              {versionsQuery.data && versionsQuery.data.length > 0 && (
                <div className="space-y-2.5">
                  {versionsQuery.data.map((v) => (
                    <div key={v.id} className="flex items-start gap-2 text-xs">
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 text-slate-600 font-semibold shrink-0">
                        v{v.version_number}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-slate-700 leading-snug">{v.change_summary}</div>
                        <div className="text-slate-400 mt-0.5">
                          {new Date(v.created_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}