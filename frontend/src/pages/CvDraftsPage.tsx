import { useEffect, useState, useCallback } from 'react';
import { FileText, Plus, Trash2, X, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import { cvsApi, jobsApi, type CVDraft, type JobOut } from '../lib/api';
import CVEditor from '../components/cvs/CVEditor';

interface JobOption {
  id: string;
  label: string;
  parsed: boolean;
}

export default function CvDraftsPage() {
  const [drafts, setDrafts] = useState<CVDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedDraft, setSelectedDraft] = useState<CVDraft | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const showToast = useCallback((type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const fetchDrafts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await cvsApi.list();
      setDrafts(data);
      setError(null);
    } catch (e: unknown) {
      const detail =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (e as Error).message ||
        'Failed to load CVs';
      setError(detail);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDraft = useCallback(async (id: string) => {
    try {
      const data = await cvsApi.get(id);
      setSelectedDraft(data);
    } catch (e: unknown) {
      const detail =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (e as Error).message;
      showToast('error', detail);
    }
  }, [showToast]);

  useEffect(() => {
    fetchDrafts();
  }, [fetchDrafts]);

  useEffect(() => {
    if (selectedId) fetchDraft(selectedId);
    else setSelectedDraft(null);
  }, [selectedId, fetchDraft]);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm('Delete this CV? This cannot be undone.')) return;
      try {
        await cvsApi.delete(id);
        showToast('success', 'CV deleted');
        if (selectedId === id) setSelectedId(null);
        await fetchDrafts();
      } catch (e: unknown) {
        const detail =
          (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
          (e as Error).message;
        showToast('error', detail);
      }
    },
    [selectedId, showToast, fetchDrafts]
  );

  const handleDraftUpdate = useCallback((next: CVDraft) => {
    setSelectedDraft(next);
    setDrafts((prev) => prev.map((d) => (d.id === next.id ? next : d)));
  }, []);

  // ── Render ────────────────────────────────────────────────────────
  if (loading && drafts.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Loading CVs…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-6 h-6" />
            CV Drafts
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Generated from your profile + targeted to a job. LLM-enhance individual sections.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-3 py-2 rounded-md"
          data-testid="create-cv-btn"
        >
          <Plus className="w-4 h-4" />
          New CV
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded-md p-3">
          {error}
        </div>
      )}

      {toast && (
        <div
          className={clsx(
            'fixed bottom-6 right-6 z-50 px-4 py-2 rounded-md text-sm shadow-lg',
            toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
          )}
          data-testid="cv-toast"
        >
          {toast.msg}
        </div>
      )}

      {/* List + Detail split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* List */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="px-4 py-3 border-b border-slate-200">
              <h2 className="text-sm font-semibold text-slate-700">
                {drafts.length} CV{drafts.length === 1 ? '' : 's'}
              </h2>
            </div>
            {drafts.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-sm">
                No CVs yet. Click "New CV" to generate one.
              </div>
            ) : (
              <ul className="divide-y divide-slate-100" data-testid="cv-list">
                {drafts.map((d) => (
                  <li
                    key={d.id}
                    data-testid={`cv-item-${d.id}`}
                    className={clsx(
                      'px-4 py-3 cursor-pointer hover:bg-slate-50',
                      selectedId === d.id && 'bg-indigo-50 border-l-4 border-indigo-500'
                    )}
                    onClick={() => setSelectedId(d.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-slate-900 truncate">{d.title}</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {new Date(d.updated_at).toLocaleDateString()} · {d.status}
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(d.id);
                        }}
                        className="text-slate-400 hover:text-red-600"
                        aria-label={`Delete ${d.title}`}
                        data-testid={`delete-cv-${d.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Detail / editor */}
        <div className="lg:col-span-2">
          {selectedDraft ? (
            <CVEditor
              draft={selectedDraft}
              onUpdate={handleDraftUpdate}
              onError={(m) => showToast('error', m)}
              onSuccess={(m) => showToast('success', m)}
            />
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 border-dashed p-12 text-center text-slate-400">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">Select a CV on the left to preview and edit it.</p>
            </div>
          )}
        </div>
      </div>

      {showCreate && (
        <CreateCVModal
          onClose={() => setShowCreate(false)}
          onCreated={(cv) => {
            setShowCreate(false);
            setSelectedId(cv.id);
            showToast('success', `CV "${cv.title}" created`);
            fetchDrafts();
          }}
          onError={(m) => showToast('error', m)}
        />
      )}
    </div>
  );
}

// ── Create modal ──────────────────────────────────────────────────
function CreateCVModal({
  onClose,
  onCreated,
  onError,
}: {
  onClose: () => void;
  onCreated: (cv: CVDraft) => void;
  onError: (msg: string) => void;
}) {
  const [jobs, setJobs] = useState<JobOption[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [creating, setCreating] = useState(false);
  const [jobId, setJobId] = useState('');
  const [title, setTitle] = useState('');

  useEffect(() => {
    let alive = true;
    jobsApi
      .list()
      .then((data: JobOut[]) => {
        if (!alive) return;
        const opts = data.map((j) => ({
          id: j.id,
          label: `${j.title || 'Untitled'}${j.company ? ` @ ${j.company}` : ''}`,
          parsed: j.status === 'parsed',
        }));
        setJobs(opts);
        const firstParsed = opts.find((o) => o.parsed);
        if (firstParsed) setJobId(firstParsed.id);
        setLoadingJobs(false);
      })
      .catch((e) => {
        if (!alive) return;
        onError((e as Error).message || 'Failed to load jobs');
        setLoadingJobs(false);
      });
    return () => {
      alive = false;
    };
  }, [onError]);

  const handleCreate = useCallback(async () => {
    if (!jobId || !title.trim()) return;
    setCreating(true);
    try {
      // Get profile_id from /api/profile
      const profileRes = await fetch('/api/profile');
      if (!profileRes.ok) {
        throw new Error('No profile found. Upload a resume first.');
      }
      const profile = await profileRes.json();
      const cv = await cvsApi.create({
        job_id: jobId,
        profile_id: profile.id,
        title: title.trim(),
      });
      onCreated(cv);
    } catch (e: unknown) {
      const detail =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (e as Error).message ||
        'Failed to create CV';
      onError(detail);
    } finally {
      setCreating(false);
    }
  }, [jobId, title, onCreated, onError]);

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
      data-testid="create-cv-modal"
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Generate new CV</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Target job
            </label>
            {loadingJobs ? (
              <div className="text-sm text-slate-500">Loading jobs…</div>
            ) : jobs.length === 0 ? (
              <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                No jobs found. Add a job on the Jobs page first.
              </div>
            ) : (
              <select
                value={jobId}
                onChange={(e) => setJobId(e.target.value)}
                className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                data-testid="create-cv-job-select"
              >
                <option value="">Select a job…</option>
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.label}
                    {j.parsed ? '' : ' (not analyzed yet)'}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              CV title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Senior Backend CV for Quik Hire"
              className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
              data-testid="create-cv-title-input"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 rounded-md"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!jobId || !title.trim() || creating}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="create-cv-submit"
          >
            {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {creating ? 'Generating…' : 'Generate CV'}
          </button>
        </div>
      </div>
    </div>
  );
}