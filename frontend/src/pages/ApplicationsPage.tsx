import { useCallback, useEffect, useState } from 'react';
import {
  CheckSquare,
  Plus,
  Trash2,
  Loader2,
  X,
  ChevronRight,
  Calendar,
  Mail,
  User as UserIcon,
  StickyNote,
} from 'lucide-react';
import clsx from 'clsx';
import {
  applicationsApi,
  jobsApi,
  APPLICATION_STATUSES,
  type Application,
  type ApplicationStatus,
  type JobOut,
} from '../lib/api';

const STATUS_META: Record<
  ApplicationStatus,
  { label: string; accent: string; chipBg: string; chipText: string; dotColor: string }
> = {
  draft: {
    label: 'Draft',
    accent: 'border-slate-300',
    chipBg: 'bg-slate-100',
    chipText: 'text-slate-700',
    dotColor: 'bg-slate-400',
  },
  ready: {
    label: 'Ready',
    accent: 'border-blue-300',
    chipBg: 'bg-blue-50',
    chipText: 'text-blue-700',
    dotColor: 'bg-blue-500',
  },
  applied: {
    label: 'Applied',
    accent: 'border-indigo-300',
    chipBg: 'bg-indigo-50',
    chipText: 'text-indigo-700',
    dotColor: 'bg-indigo-500',
  },
  interview: {
    label: 'Interview',
    accent: 'border-amber-300',
    chipBg: 'bg-amber-50',
    chipText: 'text-amber-700',
    dotColor: 'bg-amber-500',
  },
  offer: {
    label: 'Offer',
    accent: 'border-green-300',
    chipBg: 'bg-green-50',
    chipText: 'text-green-700',
    dotColor: 'bg-green-500',
  },
  rejected: {
    label: 'Rejected',
    accent: 'border-red-300',
    chipBg: 'bg-red-50',
    chipText: 'text-red-700',
    dotColor: 'bg-red-500',
  },
};

function fmtDate(s: string | null | undefined): string {
  if (!s) return '';
  return new Date(s).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function ApplicationsPage() {
  const [apps, setApps] = useState<Application[]>([]);
  const [jobs, setJobs] = useState<Record<string, JobOut>>({});
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const showToast = useCallback((type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [list, jobsList] = await Promise.all([
        applicationsApi.list({ limit: 500 }),
        jobsApi.list(0, 500),
      ]);
      setApps(list);
      setJobs(Object.fromEntries(jobsList.map((j) => [j.id, j])));
      setError(null);
    } catch (e: unknown) {
      const detail =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (e as Error).message ||
        'Failed to load applications';
      setError(detail);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm('Delete this application? This cannot be undone.')) return;
      try {
        await applicationsApi.delete(id);
        showToast('success', 'Application deleted');
        if (selectedId === id) setSelectedId(null);
        await fetchAll();
      } catch (e: unknown) {
        const detail =
          (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
          (e as Error).message;
        showToast('error', detail);
      }
    },
    [selectedId, showToast, fetchAll],
  );

  const handleTransition = useCallback(
    async (app: Application, newStatus: ApplicationStatus) => {
      try {
        const updated = await applicationsApi.transition(app.id, newStatus);
        setApps((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
        showToast(
          'success',
          newStatus === 'applied' && !app.applied_date
            ? `Moved to ${STATUS_META[newStatus].label} (date stamped)`
            : `Moved to ${STATUS_META[newStatus].label}`,
        );
      } catch (e: unknown) {
        const detail =
          (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
          (e as Error).message;
        showToast('error', detail);
      }
    },
    [showToast],
  );

  const handlePatch = useCallback(
    async (app: Application, patch: Partial<Application>) => {
      try {
        const updated = await applicationsApi.patch(app.id, patch);
        setApps((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
        showToast('success', 'Saved');
      } catch (e: unknown) {
        const detail =
          (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
          (e as Error).message;
        showToast('error', detail);
      }
    },
    [showToast],
  );

  if (loading && apps.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-500" data-testid="loading">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Loading applications…
      </div>
    );
  }

  const byStatus = APPLICATION_STATUSES.reduce(
    (acc, s) => {
      acc[s] = apps.filter((a) => a.status === s);
      return acc;
    },
    {} as Record<ApplicationStatus, Application[]>,
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <CheckSquare className="w-6 h-6" />
            Applications
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Kanban-style tracking across the application lifecycle.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-3 py-2 rounded-md"
          data-testid="create-app-btn"
        >
          <Plus className="w-4 h-4" />
          New Application
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
            toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white',
          )}
          data-testid="toast"
        >
          {toast.msg}
        </div>
      )}

      {/* Kanban board */}
      <div
        className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3"
        data-testid="kanban-board"
      >
        {APPLICATION_STATUSES.map((s) => {
          const meta = STATUS_META[s];
          const items = byStatus[s];
          return (
            <div
              key={s}
              className={clsx('bg-white rounded-xl border-t-4 shadow-sm', meta.accent)}
              data-testid={`column-${s}`}
            >
              <div className="px-3 py-2 flex items-center justify-between border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className={clsx('w-2 h-2 rounded-full', meta.dotColor)} />
                  <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    {meta.label}
                  </h3>
                </div>
                <span className="text-xs font-medium text-slate-500">{items.length}</span>
              </div>
              <div className="p-2 space-y-2 min-h-[120px]">
                {items.length === 0 ? (
                  <div className="text-xs text-slate-400 text-center py-6">Empty</div>
                ) : (
                  items.map((a) => (
                    <ApplicationCard
                      key={a.id}
                      app={a}
                      job={jobs[a.job_id]}
                      isSelected={selectedId === a.id}
                      onSelect={() => setSelectedId(a.id)}
                      onDelete={() => handleDelete(a.id)}
                      onTransition={(next) => handleTransition(a, next)}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail drawer */}
      {selectedId && (
        <ApplicationDetail
          app={apps.find((a) => a.id === selectedId)!}
          job={jobs[apps.find((a) => a.id === selectedId)?.job_id ?? '']}
          onClose={() => setSelectedId(null)}
          onPatch={(p) => {
            const app = apps.find((a) => a.id === selectedId);
            if (app) handlePatch(app, p);
          }}
          onTransition={(s) => {
            const app = apps.find((a) => a.id === selectedId);
            if (app) handleTransition(app, s);
          }}
        />
      )}

      {showCreate && (
        <CreateApplicationModal
          jobs={Object.values(jobs).filter((j) => j.status === 'parsed')}
          existingAppJobIds={new Set(apps.map((a) => a.job_id))}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            showToast('success', 'Application created');
            fetchAll();
          }}
          onError={(m) => showToast('error', m)}
        />
      )}
    </div>
  );
}

// ── Card ─────────────────────────────────────────────────────────────

function ApplicationCard({
  app,
  job,
  isSelected,
  onSelect,
  onDelete,
  onTransition,
}: {
  app: Application;
  job: JobOut | undefined;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onTransition: (s: ApplicationStatus) => void;
}) {
  const title = job?.title ?? '(unknown job)';
  const company = job?.company ?? '';
  const nextStatuses = APPLICATION_STATUSES.filter((s) => s !== app.status);

  return (
    <div
      onClick={onSelect}
      className={clsx(
        'group bg-white rounded-md border border-slate-200 px-3 py-2 cursor-pointer hover:border-slate-300 hover:shadow-sm transition-all',
        isSelected && 'ring-2 ring-indigo-500 border-indigo-300',
      )}
      data-testid={`app-card-${app.id}`}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-slate-900 truncate">{title}</div>
          {company && (
            <div className="text-xs text-slate-500 truncate">{company}</div>
          )}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-600 transition-opacity"
          aria-label="Delete application"
          data-testid={`delete-app-${app.id}`}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Footer: dates + next status */}
      <div className="mt-1.5 flex items-center justify-between gap-1 text-[10px] text-slate-500">
        <span>{fmtDate(app.applied_date) || fmtDate(app.updated_at)}</span>
        <div className="relative">
          <select
            value=""
            onChange={(e) => {
              e.stopPropagation();
              const v = e.target.value;
              if (v) {
                onTransition(v as ApplicationStatus);
                e.target.value = '';
              }
            }}
            onClick={(e) => e.stopPropagation()}
            className="text-[10px] bg-slate-50 border border-slate-200 rounded px-1 py-0.5 cursor-pointer"
            data-testid={`transition-${app.id}`}
          >
            <option value="">Move →</option>
            {nextStatuses.map((s) => (
              <option key={s} value={s}>
                {STATUS_META[s].label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

// ── Detail drawer ────────────────────────────────────────────────────

function ApplicationDetail({
  app,
  job,
  onClose,
  onPatch,
  onTransition,
}: {
  app: Application;
  job: JobOut | undefined;
  onClose: () => void;
  onPatch: (p: Partial<Application>) => void;
  onTransition: (s: ApplicationStatus) => void;
}) {
  const [notes, setNotes] = useState(app.notes ?? '');
  const [contact, setContact] = useState(app.contact_person ?? '');
  const [email, setEmail] = useState(app.contact_email ?? '');
  const [followUp, setFollowUp] = useState(
    app.follow_up_date ? app.follow_up_date.slice(0, 10) : '',
  );
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setNotes(app.notes ?? '');
    setContact(app.contact_person ?? '');
    setEmail(app.contact_email ?? '');
    setFollowUp(app.follow_up_date ? app.follow_up_date.slice(0, 10) : '');
    setDirty(false);
  }, [app.id, app.notes, app.contact_person, app.contact_email, app.follow_up_date]);

  const save = useCallback(() => {
    onPatch({
      notes: notes || null,
      contact_person: contact || null,
      contact_email: email || null,
      follow_up_date: followUp ? new Date(followUp).toISOString() : null,
    });
    setDirty(false);
  }, [notes, contact, email, followUp, onPatch]);

  const meta = STATUS_META[app.status];

  return (
    <div
      className="fixed inset-0 z-40 bg-black/40 flex justify-end"
      onClick={onClose}
      data-testid="detail-drawer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-md h-full overflow-y-auto shadow-xl"
      >
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-slate-900 truncate">
              {job?.title ?? '(unknown job)'}
            </h2>
            {job?.company && (
              <div className="text-xs text-slate-500 truncate">{job.company}</div>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
            data-testid="close-drawer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Status switcher */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Status</label>
            <div className="flex flex-wrap gap-1.5">
              {APPLICATION_STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => onTransition(s)}
                  className={clsx(
                    'px-2 py-1 rounded-md text-xs font-medium border',
                    app.status === s
                      ? clsx(meta.chipBg, meta.chipText, 'border-current')
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300',
                  )}
                  data-testid={`set-status-${s}`}
                >
                  {STATUS_META[s].label}
                </button>
              ))}
            </div>
            {app.applied_date && (
              <div className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Applied {fmtDate(app.applied_date)}
              </div>
            )}
          </div>

          {/* Follow-up */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Follow-up date</label>
            <input
              type="date"
              value={followUp}
              onChange={(e) => {
                setFollowUp(e.target.value);
                setDirty(true);
              }}
              className="w-full text-sm border border-slate-200 rounded-md px-2 py-1.5 focus:border-indigo-500 focus:outline-none"
              data-testid="follow-up-input"
            />
          </div>

          {/* Contact */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Contact person
            </label>
            <div className="relative">
              <UserIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={contact}
                onChange={(e) => {
                  setContact(e.target.value);
                  setDirty(true);
                }}
                placeholder="Recruiter name"
                className="w-full text-sm border border-slate-200 rounded-md pl-7 pr-2 py-1.5 focus:border-indigo-500 focus:outline-none"
                data-testid="contact-input"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Contact email</label>
            <div className="relative">
              <Mail className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setDirty(true);
                }}
                placeholder="recruiter@company.com"
                className="w-full text-sm border border-slate-200 rounded-md pl-7 pr-2 py-1.5 focus:border-indigo-500 focus:outline-none"
                data-testid="email-input"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
              <StickyNote className="w-3 h-3" />
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                setDirty(true);
              }}
              rows={8}
              placeholder="Interview prep, salary discussion, links to relevant docs…"
              className="w-full text-sm border border-slate-200 rounded-md p-2 focus:border-indigo-500 focus:outline-none"
              data-testid="notes-input"
            />
          </div>

          {dirty && (
            <button
              onClick={save}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-3 py-2 rounded-md"
              data-testid="save-detail-btn"
            >
              Save changes
            </button>
          )}

          <div className="pt-3 border-t border-slate-200 text-xs text-slate-500 space-y-1">
            <div className="flex items-center gap-1">
              <ChevronRight className="w-3 h-3" />
              Created {fmtDate(app.created_at)}
            </div>
            <div className="flex items-center gap-1">
              <ChevronRight className="w-3 h-3" />
              Updated {fmtDate(app.updated_at)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Create modal ────────────────────────────────────────────────────

function CreateApplicationModal({
  jobs,
  existingAppJobIds,
  onClose,
  onCreated,
  onError,
}: {
  jobs: JobOut[];
  existingAppJobIds: Set<string>;
  onClose: () => void;
  onCreated: (app: Application) => void;
  onError: (msg: string) => void;
}) {
  const available = jobs.filter((j) => !existingAppJobIds.has(j.id));
  const [jobId, setJobId] = useState(available[0]?.id ?? '');
  const [status, setStatus] = useState<ApplicationStatus>('draft');
  const [notes, setNotes] = useState('');
  const [creating, setCreating] = useState(false);

  const submit = useCallback(async () => {
    if (!jobId) {
      onError('Pick a job to apply to');
      return;
    }
    setCreating(true);
    try {
      const created = await applicationsApi.create({
        job_id: jobId,
        status,
        notes: notes || null,
      });
      onCreated(created);
    } catch (e: unknown) {
      const detail =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (e as Error).message;
      onError(detail);
    } finally {
      setCreating(false);
    }
  }, [jobId, status, notes, onCreated, onError]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      data-testid="create-modal"
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
          <h3 className="text-base font-semibold text-slate-900">New application</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
            data-testid="create-modal-close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Job</label>
            {available.length === 0 ? (
              <div className="text-sm text-slate-500 py-2">
                All parsed jobs already have an application. Delete one first or add a new job.
              </div>
            ) : (
              <select
                value={jobId}
                onChange={(e) => setJobId(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-md px-2 py-1.5 focus:border-indigo-500 focus:outline-none"
                data-testid="job-select"
              >
                {available.map((j) => (
                  <option key={j.id} value={j.id}>
                    {[j.title, j.company].filter(Boolean).join(' — ') || j.id.slice(0, 8)}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Starting status</label>
            <div className="flex flex-wrap gap-1.5">
              {APPLICATION_STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={clsx(
                    'px-2 py-1 rounded-md text-xs font-medium border',
                    status === s
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-300'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300',
                  )}
                  data-testid={`start-status-${s}`}
                >
                  {STATUS_META[s].label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Optional context…"
              className="w-full text-sm border border-slate-200 rounded-md p-2 focus:border-indigo-500 focus:outline-none"
              data-testid="notes-create"
            />
          </div>
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
            disabled={!jobId || creating}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium px-3 py-1.5 rounded-md"
            data-testid="create-submit"
          >
            {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            {creating ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}