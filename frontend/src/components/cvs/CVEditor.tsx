import { useEffect, useState, useCallback, useRef } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import { cvsApi, jobsApi, scoreBucket, type CVDraft, type CVSectionKind, type CVVersion, type JobOut } from '../../lib/api';
import CVScorePanel from './CVScorePanel';

interface Props {
  draft: CVDraft;
  onUpdate: (next: CVDraft) => void;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
}

const SECTION_LABELS: Record<CVSectionKind, string> = {
  summary: 'Professional summary',
  bullets: 'Experience bullets',
  experience: 'Experience entry',
  skills: 'Skills list',
};

export default function CVEditor({ draft, onUpdate, onError, onSuccess }: Props) {
  const [tab, setTab] = useState<'preview' | 'sections' | 'score'>('preview');
  // Per-button busy key: 'summary' | 'skills' | `bullets:${idx}` | null.
  // Multiple bullet rows each get their own spinner so the user can
  // polish one entry while another finishes.
  const [enhancing, setEnhancing] = useState<string | null>(null);
  const [jobs, setJobs] = useState<JobOut[]>([]);
  const [targetJobId, setTargetJobId] = useState<string>('');
  const [versions, setVersions] = useState<CVVersion[]>([]);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  useEffect(() => {
    // Fetch parsed jobs for the ATS-keyword target selector
    jobsApi
      .list()
      .then((data) => {
        const parsed = data.filter((j) => j.status === 'parsed');
        setJobs(parsed);
        if (parsed.length && !targetJobId) setTargetJobId(parsed[0].id);
      })
      .catch(() => {
        // Non-fatal — user just won't see the keyword-target option
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch the version history whenever the active draft changes.
  useEffect(() => {
    let cancelled = false;
    cvsApi
      .versions(draft.id)
      .then((vs) => {
        if (!cancelled) setVersions(vs);
      })
      .catch(() => {
        if (!cancelled) setVersions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [draft.id, draft.updated_at]);

  const handleEnhance = useCallback(
    async (section: CVSectionKind, experienceIndex?: number) => {
      const key =
        section === 'bullets' || section === 'experience'
          ? `bullets:${experienceIndex ?? 0}`
          : section;
      setEnhancing(key);
      try {
        const next = await cvsApi.enhance(draft.id, {
          section,
          experience_index: experienceIndex,
          target_job_id: targetJobId || undefined,
        });
        onUpdate(next);
        onSuccess(`${SECTION_LABELS[section]} enhanced`);
      } catch (e: unknown) {
        const detail =
          (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
          (e as Error).message ||
          'Enhancement failed';
        onError(detail);
      } finally {
        setEnhancing(null);
      }
    },
    [draft.id, targetJobId, onUpdate, onError, onSuccess]
  );

  const handlePatchTitle = useCallback(
    async (newTitle: string) => {
      if (!newTitle.trim() || newTitle === draft.title) return;
      try {
        const next = await cvsApi.patch(draft.id, { title: newTitle });
        onUpdate(next);
      } catch (e: unknown) {
        const detail =
          (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
          (e as Error).message;
        onError(detail);
      }
    },
    [draft.id, draft.title, onUpdate, onError]
  );

  // Persist target-job change to BE (H1 fix). Stores last-picked id in a
  // ref to avoid an infinite loop when the draft's job_id is updated.
  const lastPickedJobRef = useRef<string | null>(null);
  const handlePatchJobId = useCallback(
    async (newJobId: string) => {
      if (newJobId === lastPickedJobRef.current) return;
      lastPickedJobRef.current = newJobId;
      // Normalise "" -> null so backend can detach
      const payload_job_id = newJobId || null;
      if (payload_job_id === (draft.job_id || null)) return;
      try {
        const next = await cvsApi.patch(draft.id, { job_id: payload_job_id });
        onUpdate(next);
        onSuccess(payload_job_id ? `Target job updated` : `Target job cleared`);
      } catch (e: unknown) {
        const detail =
          (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
          (e as Error).message;
        onError(detail);
      }
    },
    [draft.id, draft.job_id, onUpdate, onError, onSuccess]
  );

  // Restore a previous CV version into the live draft (L1).
  const handleRestore = useCallback(
    async (versionId: string) => {
      if (!confirm('Restore this version? The current draft will be replaced.')) return;
      setRestoringId(versionId);
      try {
        const next = await cvsApi.restoreVersion(draft.id, versionId);
        onUpdate(next);
        onSuccess('Version restored');
      } catch (e: unknown) {
        const detail =
          (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
          (e as Error).message;
        onError(detail);
      } finally {
        setRestoringId(null);
      }
    },
    [draft.id, onUpdate, onError, onSuccess]
  );

  const cvJson = draft.cv_json || {};
  const experience = cvJson.experience || [];
  const education = cvJson.education || [];
  const skills = cvJson.skills || [];
  const projects = cvJson.projects || [];

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4 bg-slate-50">
        <input
          type="text"
          defaultValue={draft.title}
          onBlur={(e) => handlePatchTitle(e.target.value)}
          className="text-xl font-semibold bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-indigo-200 rounded px-2 py-1 -ml-2 flex-1"
          data-testid="cv-title-input"
        />
        <span
          className={clsx(
            'px-2 py-0.5 text-xs rounded-full font-medium',
            draft.status === 'draft' && 'bg-amber-100 text-amber-800',
            draft.status === 'ready' && 'bg-green-100 text-green-800',
            draft.status === 'exported' && 'bg-blue-100 text-blue-800'
          )}
        >
          {draft.status}
        </span>
      </div>

      {/* Target job + tabs */}
      <div className="px-6 py-3 border-b border-slate-200 flex items-center justify-between gap-4">
        <div className="flex gap-1">
          <button
            onClick={() => setTab('preview')}
            data-testid="tab-preview"
            className={clsx(
              'px-3 py-1.5 text-sm font-medium rounded-md',
              tab === 'preview' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'
            )}
          >
            Preview
          </button>
          <button
            onClick={() => setTab('sections')}
            data-testid="tab-sections"
            className={clsx(
              'px-3 py-1.5 text-sm font-medium rounded-md',
              tab === 'sections' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'
            )}
          >
            Sections
          </button>
          <button
            onClick={() => setTab('score')}
            data-testid="tab-score"
            className={clsx(
              'px-3 py-1.5 text-sm font-medium rounded-md inline-flex items-center gap-1.5',
              tab === 'score' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'
            )}
          >
            Score
            {/* F4 fix: chip uses the unified scoreBucket() so the chip
                agrees with the recommendation card cutoffs. Old code
                used 0.75/0.5; new code uses 0.7/0.5 to match BE. */}
            <span
              className={clsx(
                'text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-full',
                scoreBucket(draft.score) === 'good' && 'bg-emerald-100 text-emerald-700',
                scoreBucket(draft.score) === 'ok' && 'bg-amber-100 text-amber-700',
                scoreBucket(draft.score) === 'low' && 'bg-red-100 text-red-700'
              )}
              data-testid="cv-score-chip"
            >
              {Math.round(draft.score * 100)}
            </span>
          </button>
        </div>
        {jobs.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500">Target job (ATS):</label>
            <select
              value={targetJobId}
              onChange={(e) => {
                setTargetJobId(e.target.value);
                handlePatchJobId(e.target.value);
              }}
              className="text-xs border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              data-testid="target-job-select"
            >
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title || 'Untitled'}
                  {j.company ? ` @ ${j.company}` : ''}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Body */}
      {tab === 'preview' && (
        <div className="p-6">
          <div
            className="bg-white border border-slate-200 rounded-lg p-8 max-h-[600px] overflow-y-auto"
            data-testid="cv-preview"
          >
            {draft.rendered_html ? (
              <iframe
                srcDoc={draft.rendered_html}
                title="CV Preview"
                className="w-full min-h-[500px] border-0"
              />
            ) : (
              <div className="text-slate-400 text-sm">No preview available.</div>
            )}
          </div>
        </div>
      )}

      {tab === 'score' && (
        <div className="p-6 max-w-3xl" data-testid="score-tab-content">
          {/* Phase 7: live CV score panel — auto-refreshes on save via the
              embedded score_breakdown_json in the draft prop. */}
          <CVScorePanel cv={draft} />
          <p className="mt-3 text-[12px] text-slate-500 leading-relaxed">
            Score = 0.4 × ATS keyword coverage + 0.3 × skill gap + 0.2 × bullet
            strength + 0.1 × format safety. Each save recomputes the score
            automatically. Use the recommendations above to lift it before
            applying.
          </p>
        </div>
      )}
      {tab === 'sections' && (
        <div className="p-6 space-y-6">
          {/* Summary */}
          <section data-testid="section-summary">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-slate-700">Professional summary</h3>
              <EnhanceButton
                busy={enhancing === 'summary'}
                onClick={() => handleEnhance('summary')}
                testId="enhance-summary"
              />
            </div>
            <textarea
              value={cvJson.summary || ''}
              readOnly
              rows={4}
              className="w-full text-sm border border-slate-200 rounded p-2 bg-slate-50"
            />
          </section>

          {/* Experience */}
          <section data-testid="section-experience">
            <h3 className="text-sm font-semibold text-slate-700 mb-2">Experience</h3>
            <div className="space-y-4">
              {experience.map((job, idx) => (
                <div
                  key={idx}
                  className="border border-slate-200 rounded-lg p-3 bg-slate-50"
                  data-testid={`experience-${idx}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="font-medium text-sm">
                        {job.title || 'Untitled'}
                        {job.company ? ` · ${job.company}` : ''}
                      </div>
                      <div className="text-xs text-slate-500">
                        {[job.start, job.end === null ? 'Present' : job.end]
                          .filter(Boolean)
                          .join(' – ')}
                      </div>
                    </div>
                    <EnhanceButton
                      busy={enhancing === `bullets:${idx}`}
                      onClick={() => handleEnhance('bullets', idx)}
                      testId={`enhance-bullets-${idx}`}
                    />
                  </div>
                  <ul className="list-disc list-inside text-xs text-slate-700 space-y-1">
                    {(job.bullets || []).map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          {/* Skills */}
          <section data-testid="section-skills">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-slate-700">Skills</h3>
              <EnhanceButton
                busy={enhancing === 'skills'}
                onClick={() => handleEnhance('skills')}
                testId="enhance-skills"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {skills.map((s, i) => (
                <span
                  key={i}
                  className="text-xs bg-slate-100 border border-slate-200 px-2 py-0.5 rounded"
                >
                  {s}
                </span>
              ))}
            </div>
          </section>

          {/* Education + Projects (read-only for now) */}
          {education.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Education</h3>
              <div className="space-y-1 text-xs text-slate-700">
                {education.map((e, i) => (
                  <div key={i}>
                    {[e.degree, e.field].filter(Boolean).join(' · ')} —{' '}
                    {e.institution}
                  </div>
                ))}
              </div>
            </section>
          )}

          {projects.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Projects</h3>
              <div className="space-y-1 text-xs text-slate-700">
                {projects.map((p, i) => (
                  <div key={i}>
                    <span className="font-medium">{p.name}:</span> {p.description}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Version history (L1) */}
          <section data-testid="section-versions">
            <h3 className="text-sm font-semibold text-slate-700 mb-2">
              Version history ({versions.length})
            </h3>
            {versions.length === 0 ? (
              <div className="text-xs text-slate-400">No versions yet.</div>
            ) : (
              <div className="space-y-1.5">
                {versions.map((v) => (
                  <div
                    key={v.id}
                    className="flex items-center justify-between gap-2 border border-slate-200 rounded p-2 bg-white"
                    data-testid={`version-${v.version_number}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium text-slate-700">
                        v{v.version_number}
                        <span className="ml-2 text-slate-400 font-normal">
                          {new Date(v.created_at).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 truncate">
                        {v.change_summary || '(no summary)'}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRestore(v.id)}
                      disabled={restoringId === v.id}
                      className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      data-testid={`restore-v${v.version_number}`}
                    >
                      {restoringId === v.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        'Restore'
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function EnhanceButton({
  busy,
  onClick,
  testId,
}: {
  busy: boolean;
  onClick: () => void;
  testId?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      data-testid={testId}
      className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
      <span>{busy ? 'Enhancing…' : 'Enhance with AI'}</span>
    </button>
  );
}