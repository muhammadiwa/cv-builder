import { useCallback, useEffect, useState } from 'react';
import {
  Mail,
  Plus,
  Trash2,
  Loader2,
  FileDown,
  RefreshCw,
  Check,
  X,
  Sparkles,
  Eye,
  Pencil,
} from 'lucide-react';
import clsx from 'clsx';
import {
  coverLettersApi,
  jobsApi,
  profileApi,
  scoreBucket,
  type CoverLetterOut,
  type CoverLetterTone,
  type JobOut,
} from '../lib/api';
import { toast } from '../lib/toast';
import PageHeader from '../components/PageHeader';

const TONES: { value: CoverLetterTone; label: string; desc: string }[] = [
  { value: 'professional', label: 'Professional', desc: 'Polished, balanced — the safe default.' },
  { value: 'confident', label: 'Confident', desc: 'Direct, achievement-led, assertive.' },
  { value: 'friendly', label: 'Friendly', desc: 'Warm, personable, team-oriented.' },
  { value: 'concise', label: 'Concise', desc: 'Tight, no fluff, gets to the point.' },
  { value: 'formal', label: 'Formal', desc: 'Reserved, traditional corporate register.' },
];

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function CoverLettersPage() {
  const [letters, setLetters] = useState<CoverLetterOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<CoverLetterOut | null>(null);
  const [showGenerate, setShowGenerate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<'preview' | 'edit'>('preview');
  const [saving, setSaving] = useState(false);
  const [rescoring, setRescoring] = useState(false);
  const [exporting, setExporting] = useState<'pdf' | 'docx' | null>(null);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const data = await coverLettersApi.list();
      setLetters(data);
      setError(null);
    } catch (e: unknown) {
      const detail =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (e as Error).message ||
        'Failed to load cover letters';
      setError(detail);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchOne = useCallback(
    async (id: string) => {
      try {
        const data = await coverLettersApi.get(id);
        setSelected(data);
      } catch (e: unknown) {
        const detail =
          (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
          (e as Error).message;
        toast.error(detail);
      }
    },
    [],
  );

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  useEffect(() => {
    if (selectedId) fetchOne(selectedId);
    else setSelected(null);
  }, [selectedId, fetchOne]);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm('Delete this cover letter? This cannot be undone.')) return;
      try {
        await coverLettersApi.delete(id);
        toast.success('Cover letter deleted');
        if (selectedId === id) setSelectedId(null);
        await fetchList();
      } catch (e: unknown) {
        const detail =
          (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
          (e as Error).message;
        toast.error(detail);
      }
    },
    [selectedId, fetchList],
  );

  const handlePatch = useCallback(
    async (patch: { subject?: string; content?: string; status?: 'draft' | 'ready' | 'exported' }) => {
      if (!selected) return;
      setSaving(true);
      try {
        const updated = await coverLettersApi.patch(selected.id, patch);
        setSelected(updated);
        setLetters((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
        toast.success('Saved');
      } catch (e: unknown) {
        const detail =
          (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
          (e as Error).message;
        toast.error(detail);
      } finally {
        setSaving(false);
      }
    },
    [selected],
  );

  const handleRescore = useCallback(async () => {
    if (!selected) return;
    setRescoring(true);
    try {
      const updated = await coverLettersApi.rescore(selected.id);
      setSelected(updated);
      setLetters((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
      toast.success(`Rescored: ${updated.score.toFixed(2)}`);
    } catch (e: unknown) {
      const detail =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (e as Error).message;
      toast.error(detail);
    } finally {
      setRescoring(false);
    }
  }, [selected]);

  const handleExport = useCallback(
    async (fmt: 'pdf' | 'docx') => {
      if (!selected) return;
      setExporting(fmt);
      try {
        const { fileName } = await coverLettersApi.exportFile(selected.id, fmt);
        toast.success(`Exported ${fileName}`);
        // Refresh to pick up the exported status / new history row
        await fetchOne(selected.id);
        await fetchList();
      } catch (e: unknown) {
        const detail =
          (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
          (e as Error).message;
        toast.error(detail);
      } finally {
        setExporting(null);
      }
    },
    [selected, fetchOne, fetchList],
  );

  const handleStatusToggle = useCallback(async () => {
    if (!selected) return;
    const next = selected.status === 'ready' ? 'draft' : 'ready';
    await handlePatch({ status: next });
  }, [selected, handlePatch]);

  if (loading && letters.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-500" data-testid="loading">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Loading cover letters…
      </div>
    );
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        icon={Mail}
        title="Cover Letters"
        subtitle="Targeted cover letters per job. Editable, scorable, exportable to PDF or DOCX."
        actions={
          <button
            onClick={() => setShowGenerate(true)}
            className="btn-primary text-[13px]"
            data-testid="generate-btn"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Generate Cover Letter
          </button>
        }
      />

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded-md p-3">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        {/* List */}
        <div className="lg:col-span-4">
          <div className="card">
            <div className="px-4 py-3 border-b border-slate-200">
              <h2 className="text-sm font-semibold text-slate-700">
                {letters.length} cover letter{letters.length === 1 ? '' : 's'}
              </h2>
            </div>
            {letters.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-sm">
                No cover letters yet. Click "Generate" to create one for a job.
              </div>
            ) : (
              <ul className="divide-y divide-slate-100" data-testid="letter-list">
                {letters.map((l) => {
                  const bucket = scoreBucket(l.score);
                  return (
                    <li
                      key={l.id}
                      data-testid={`letter-item-${l.id}`}
                      className={clsx(
                        'px-4 py-3 cursor-pointer hover:bg-slate-50',
                        selectedId === l.id && 'bg-indigo-50 border-l-4 border-indigo-500',
                      )}
                      onClick={() => setSelectedId(l.id)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-slate-900 truncate">
                            {l.subject || '(no subject)'}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                            <span>{fmtDate(l.updated_at)}</span>
                            <span>·</span>
                            <span className="capitalize">{l.tone}</span>
                            <span>·</span>
                            <span
                              className={clsx(
                                'inline-flex items-center gap-0.5 font-medium',
                                bucket === 'good' && 'text-green-700',
                                bucket === 'ok' && 'text-amber-700',
                                bucket === 'low' && 'text-slate-500',
                              )}
                            >
                              {l.score.toFixed(2)}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(l.id);
                          }}
                          className="text-slate-400 hover:text-red-600"
                          aria-label="Delete cover letter"
                          data-testid={`delete-letter-${l.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Detail */}
        <div className="lg:col-span-8">
          {selected ? (
            <CoverLetterDetail
              letter={selected}
              saving={saving}
              rescoring={rescoring}
              exporting={exporting}
              previewMode={previewMode}
              setPreviewMode={setPreviewMode}
              onPatch={handlePatch}
              onRescore={handleRescore}
              onExport={handleExport}
              onStatusToggle={handleStatusToggle}
            />
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 border-dashed p-12 text-center text-slate-400">
              <Mail className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">
                Select a cover letter on the left, or click "Generate" to create one.
              </p>
            </div>
          )}
        </div>
      </div>

      {showGenerate && (
        <GenerateCoverLetterModal
          onClose={() => setShowGenerate(false)}
          onCreated={(cl) => {
            setShowGenerate(false);
            setSelectedId(cl.id);
            toast.success('Cover letter generated');
            fetchList();
          }}
          onError={(m) => toast.error(m)}
        />
      )}
    </div>
  );
}

// ── Detail / Editor ─────────────────────────────────────────────────

function CoverLetterDetail({
  letter,
  saving,
  rescoring,
  exporting,
  previewMode,
  setPreviewMode,
  onPatch,
  onRescore,
  onExport,
  onStatusToggle,
}: {
  letter: CoverLetterOut;
  saving: boolean;
  rescoring: boolean;
  exporting: 'pdf' | 'docx' | null;
  previewMode: 'preview' | 'edit';
  setPreviewMode: (m: 'preview' | 'edit') => void;
  onPatch: (p: { subject?: string; content?: string; status?: 'draft' | 'ready' | 'exported' }) => Promise<void>;
  onRescore: () => Promise<void>;
  onExport: (fmt: 'pdf' | 'docx') => Promise<void>;
  onStatusToggle: () => Promise<void>;
}) {
  const [subject, setSubject] = useState(letter.subject ?? '');
  const [content, setContent] = useState(letter.content);
  const [dirty, setDirty] = useState(false);

  // Reset local state when the selected letter changes
  useEffect(() => {
    setSubject(letter.subject ?? '');
    setContent(letter.content);
    setDirty(false);
  }, [letter.id, letter.subject, letter.content]);

  const save = useCallback(async () => {
    await onPatch({ subject, content });
    setDirty(false);
  }, [subject, content, onPatch]);

  const recommendations = letter.score_breakdown_json?.recommendations ?? [];
  const matchedSkills = letter.score_breakdown_json?.matched_skills ?? [];
  const missingSkills = letter.score_breakdown_json?.missing_skills ?? [];
  const bucket = scoreBucket(letter.score);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm" data-testid="letter-detail">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {previewMode === 'edit' ? (
            <input
              type="text"
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value);
                setDirty(true);
              }}
              placeholder="Subject line…"
              className="w-full text-base font-semibold text-slate-900 border-b border-slate-200 focus:border-indigo-500 focus:outline-none py-1"
              data-testid="letter-subject-input"
            />
          ) : (
            <h2 className="text-base font-semibold text-slate-900 truncate">
              {letter.subject || '(no subject)'}
            </h2>
          )}
          <div className="text-xs text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
            <span className="capitalize">Tone: {letter.tone}</span>
            <span>·</span>
            <span>Updated {fmtDate(letter.updated_at)}</span>
            <span
              className={clsx(
                'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider',
                letter.status === 'ready' && 'bg-green-100 text-green-700',
                letter.status === 'draft' && 'bg-slate-100 text-slate-600',
                letter.status === 'exported' && 'bg-indigo-100 text-indigo-700',
              )}
            >
              {letter.status}
            </span>
          </div>
        </div>

        {/* Mode toggle */}
        <div className="flex items-center gap-1 bg-slate-100 rounded-md p-0.5">
          <button
            onClick={() => setPreviewMode('preview')}
            className={clsx(
              'flex items-center gap-1 px-2 py-1 rounded text-xs font-medium',
              previewMode === 'preview'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700',
            )}
            data-testid="mode-preview"
          >
            <Eye className="w-3.5 h-3.5" />
            Preview
          </button>
          <button
            onClick={() => setPreviewMode('edit')}
            className={clsx(
              'flex items-center gap-1 px-2 py-1 rounded text-xs font-medium',
              previewMode === 'edit'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700',
            )}
            data-testid="mode-edit"
          >
            <Pencil className="w-3.5 h-3.5" />
            Edit
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="px-5 py-4">
        {previewMode === 'preview' ? (
          <div
            className="prose prose-slate prose-sm max-w-none whitespace-pre-wrap leading-relaxed text-slate-800"
            data-testid="letter-preview"
          >
            {letter.content}
          </div>
        ) : (
          <textarea
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              setDirty(true);
            }}
            rows={18}
            className="w-full text-sm font-mono leading-relaxed border border-slate-200 rounded-md p-3 focus:border-indigo-500 focus:outline-none"
            data-testid="letter-content-input"
          />
        )}
      </div>

      {/* Footer: score + actions */}
      <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 rounded-b-xl space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div
              className={clsx(
                'flex items-center gap-1.5 text-sm font-semibold',
                bucket === 'good' && 'text-green-700',
                bucket === 'ok' && 'text-amber-700',
                bucket === 'low' && 'text-slate-500',
              )}
              data-testid="letter-score"
            >
              <Sparkles className="w-4 h-4" />
              Score: {letter.score.toFixed(2)}
            </div>
            {matchedSkills.length > 0 && (
              <div className="text-xs text-slate-600">
                <span className="font-medium">{matchedSkills.length}</span> matched
                {missingSkills.length > 0 && (
                  <>
                    {' · '}
                    <span className="font-medium text-amber-700">{missingSkills.length}</span> missing
                  </>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {previewMode === 'edit' && (
              <>
                <button
                  onClick={save}
                  disabled={!dirty || saving}
                  className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium px-2.5 py-1.5 rounded-md"
                  data-testid="save-letter-btn"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Save
                </button>
                {dirty && (
                  <button
                    onClick={() => {
                      setSubject(letter.subject ?? '');
                      setContent(letter.content);
                      setDirty(false);
                    }}
                    className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1.5"
                    data-testid="discard-btn"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </>
            )}
            <button
              onClick={onRescore}
              disabled={rescoring}
              className="flex items-center gap-1 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-xs font-medium px-2.5 py-1.5 rounded-md"
              data-testid="rescore-btn"
              title="Re-score this cover letter against the job"
            >
              {rescoring ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Rescore
            </button>
            <button
              onClick={onStatusToggle}
              className="flex items-center gap-1 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-xs font-medium px-2.5 py-1.5 rounded-md"
              data-testid="toggle-status-btn"
            >
              {letter.status === 'ready' ? 'Mark draft' : 'Mark ready'}
            </button>
            <button
              onClick={() => onExport('pdf')}
              disabled={exporting !== null}
              className="flex items-center gap-1 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-xs font-medium px-2.5 py-1.5 rounded-md"
              data-testid="export-pdf-btn"
            >
              {exporting === 'pdf' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
              PDF
            </button>
            <button
              onClick={() => onExport('docx')}
              disabled={exporting !== null}
              className="flex items-center gap-1 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-xs font-medium px-2.5 py-1.5 rounded-md"
              data-testid="export-docx-btn"
            >
              {exporting === 'docx' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
              DOCX
            </button>
            {/* M6 fix (Phase 9 review): wire coverLettersApi.listExports
                so the BE endpoint has a UI consumer. The dropdown shows
                the last 5 exports for this letter; clicking re-runs
                the export so the user always gets a fresh download. */}
            <ExportHistoryDropdown letterId={letter.id} />
          </div>
        </div>

        {/* Recommendations + matched/missing skills */}
        {(recommendations.length > 0 || matchedSkills.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
            {matchedSkills.length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">
                  Matched keywords
                </div>
                <div className="flex flex-wrap gap-1">
                  {matchedSkills.slice(0, 12).map((k) => (
                    <span
                      key={k}
                      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-green-50 text-green-700 border border-green-200"
                    >
                      {k}
                    </span>
                  ))}
                  {matchedSkills.length > 12 && (
                    <span className="text-[10px] text-slate-500">+{matchedSkills.length - 12} more</span>
                  )}
                </div>
              </div>
            )}
            {missingSkills.length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">
                  Missing keywords
                </div>
                <div className="flex flex-wrap gap-1">
                  {missingSkills.slice(0, 12).map((k) => (
                    <span
                      key={k}
                      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-amber-50 text-amber-700 border border-amber-200"
                    >
                      {k}
                    </span>
                  ))}
                  {missingSkills.length > 12 && (
                    <span className="text-[10px] text-slate-500">+{missingSkills.length - 12} more</span>
                  )}
                </div>
              </div>
            )}
            {recommendations.length > 0 && (
              <div className="md:col-span-2">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">
                  Recommendations
                </div>
                <ul className="space-y-1 text-xs text-slate-700">
                  {recommendations.slice(0, 5).map((r) => (
                    <li key={r.id} className="flex items-start gap-2">
                      <span
                        className={clsx(
                          'inline-flex shrink-0 items-center px-1 py-0.5 rounded text-[9px] font-bold uppercase mt-0.5',
                          r.impact === 'high' && 'bg-red-100 text-red-700',
                          r.impact === 'med' && 'bg-amber-100 text-amber-700',
                          r.impact === 'low' && 'bg-slate-100 text-slate-600',
                        )}
                      >
                        {r.impact}
                      </span>
                      <span>{r.title}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Generate modal ─────────────────────────────────────────────────

function GenerateCoverLetterModal({
  onClose,
  onCreated,
  onError,
}: {
  onClose: () => void;
  onCreated: (cl: CoverLetterOut) => void;
  onError: (msg: string) => void;
}) {
  const [jobs, setJobs] = useState<JobOut[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [jobId, setJobId] = useState('');
  const [profileId, setProfileId] = useState('');
  const [tone, setTone] = useState<CoverLetterTone>('professional');
  const [useLlm, setUseLlm] = useState(true);

  // Load parsed jobs + the user's default profile id in parallel so the
  // BE payload always carries the profile_id it requires (the route
  // 400s on empty string — see backend/app/api/routes/cover_letters.py).
  useEffect(() => {
    let alive = true;
    Promise.all([jobsApi.list(0, 100), profileApi.getProfile<{ id: string }>()])
      .then(([jobPage, profile]) => {
        if (!alive) return;
        // Phase 10E: read .items from paginated response. The cover
        // letter page wants ALL analyzed jobs, so we cap limit=100
        // and pull the full set. The user is unlikely to have more
        // than 100 analyzed jobs; if they do, we'd need a search/select.
        const parsed = jobPage.items.filter((j) => j.status === 'parsed');
        setJobs(parsed);
        if (parsed.length > 0) setJobId(parsed[0].id);
        setProfileId(profile.id);
      })
      .catch((e: unknown) => {
        const detail =
          (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
          (e as Error).message;
        onError(detail);
      })
      .finally(() => {
        if (alive) setLoadingJobs(false);
      });
    return () => {
      alive = false;
    };
  }, [onError]);

  const submit = useCallback(async () => {
    if (!jobId) {
      onError('Pick a parsed job first');
      return;
    }
    setGenerating(true);
    try {
      const created = await coverLettersApi.generate({
        job_id: jobId,
        profile_id: profileId, // empty → BE derives
        tone,
        use_llm: useLlm,
      });
      onCreated(created);
    } catch (e: unknown) {
      const detail =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (e as Error).message;
      onError(detail);
    } finally {
      setGenerating(false);
    }
  }, [jobId, profileId, tone, useLlm, onCreated, onError]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      data-testid="generate-modal"
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
          <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            Generate cover letter
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
            data-testid="generate-modal-close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Job</label>
            {loadingJobs ? (
              <div className="flex items-center text-slate-500 text-sm py-2">
                <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading jobs…
              </div>
            ) : jobs.length === 0 ? (
              <div className="text-sm text-slate-500 py-2">
                No parsed jobs available. Add and parse a job first.
              </div>
            ) : (
              <select
                value={jobId}
                onChange={(e) => setJobId(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-md px-2 py-1.5 focus:border-indigo-500 focus:outline-none"
                data-testid="job-select"
              >
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {[j.title, j.company].filter(Boolean).join(' — ') || j.id.slice(0, 8)}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Tone</label>
            <div className="grid grid-cols-2 gap-2">
              {TONES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setTone(t.value)}
                  className={clsx(
                    'text-left px-3 py-2 rounded-md border text-xs transition-colors',
                    tone === t.value
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-900'
                      : 'border-slate-200 hover:border-slate-300 text-slate-700',
                  )}
                  data-testid={`tone-${t.value}`}
                >
                  <div className="font-semibold">{t.label}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{t.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={useLlm}
              onChange={(e) => setUseLlm(e.target.checked)}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              data-testid="use-llm-checkbox"
            />
            <span>
              Enhance with AI <span className="text-slate-500">(slower, ~30s, natural tone)</span>
            </span>
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-200">
          <button
            onClick={onClose}
            className="text-xs font-medium text-slate-600 hover:text-slate-900 px-3 py-1.5"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!jobId || !profileId || generating}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium px-3 py-1.5 rounded-md"
            data-testid="generate-submit"
          >
            {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {generating ? 'Generating…' : 'Generate'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Export History (M6 fix — wires coverLettersApi.listExports) ──────

function ExportHistoryDropdown({ letterId }: { letterId: string }) {
  const [history, setHistory] = useState<
    { file_type: string; file_size: number; sha256: string | null; created_at: string }[]
  >([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await coverLettersApi.listExports(letterId, 5);
      setHistory(items);
    } catch (e: unknown) {
      const detail =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (e as Error).message;
      setError(detail);
    } finally {
      setLoading(false);
    }
  }, [letterId]);

  useEffect(() => {
    if (open) {
      refresh();
    }
  }, [open, refresh]);

  return (
    <div className="relative" data-testid="export-history">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-xs font-medium px-2.5 py-1.5 rounded-md"
        title="View past exports for this letter"
        data-testid="export-history-btn"
      >
        <FileDown className="w-3.5 h-3.5" />
        History
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-72 bg-white rounded-md border border-slate-200 shadow-lg z-10">
          <div className="px-3 py-2 border-b border-slate-200 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">Recent exports</span>
            <button
              onClick={refresh}
              className="text-[10px] text-indigo-600 hover:text-indigo-800"
              data-testid="export-history-refresh"
            >
              Refresh
            </button>
          </div>
          {loading && (
            <div className="p-3 text-xs text-slate-500 flex items-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin" /> Loading…
            </div>
          )}
          {error && (
            <div className="p-3 text-xs text-red-600">{error}</div>
          )}
          {!loading && !error && history.length === 0 && (
            <div className="p-3 text-xs text-slate-500">No exports yet.</div>
          )}
          {!loading && !error && history.length > 0 && (
            <ul className="max-h-48 overflow-y-auto divide-y divide-slate-100">
              {history.map((h) => (
                <li
                  key={`${h.created_at}-${h.sha256}`}
                  className="px-3 py-1.5 text-[11px] text-slate-600 flex items-center justify-between"
                >
                  <span className="uppercase font-medium">{h.file_type}</span>
                  <span>{new Date(h.created_at).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}