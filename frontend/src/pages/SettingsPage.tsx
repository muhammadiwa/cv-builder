/**
 * SettingsPage — Phase 10B.
 *
 * First real sub-section: LLM providers (multi-provider, OpenAI-compatible).
 * Provider config (base URL, API key, per-task model, priority, on/off)
 * is stored in the DB so users can add / edit / toggle at runtime without
 * a restart. API keys are encrypted at rest on the server; the FE only
 * ever sees an `api_key_set: bool` flag.
 *
 * Future sub-sections (theme, default CV template, etc.) will be added
 * below the LLM section in subsequent phases.
 */
import { useEffect, useState } from 'react';
import {
  Brain,
  Plus,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  X,
  Loader2,
  ChevronDown,
} from 'lucide-react';
import { showToast, toast } from '../lib/toast';
import {
  LLM_TASK_TYPES,
  llmProvidersApi,
  type LLMProvider,
  type LLMProviderKind,
  type LLMProviderPatchPayload,
  type LLMTaskType,
} from '../lib/api';

const TASK_LABEL: Record<LLMTaskType, string> = {
  resume_parse: 'Resume Parse',
  job_analyze: 'Job Analyze',
  match: 'Match Score',
  cv_generate: 'CV Generate',
  cv_score: 'CV Score',
  cv_improve: 'CV Improve',
  cv_enhance: 'CV Enhance',
  cover_letter: 'Cover Letter',
};

const KIND_LABEL: Record<LLMProviderKind, string> = {
  openai_compat: 'OpenAI-compatible',
  anthropic: 'Anthropic',
};

export default function SettingsPage() {
  const [providers, setProviders] = useState<LLMProvider[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  const load = async () => {
    try {
      const data = await llmProvidersApi.list();
      setProviders(data);
      setError(null);
    } catch (e) {
      setError((e as Error).message || 'Failed to load providers');
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (error) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="card card-pad text-rose-700 bg-rose-50">
          {error}
        </div>
      </div>
    );
  }

  if (!providers) {
    return (
      <div className="max-w-3xl mx-auto text-slate-500 flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading settings…
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
            <Brain size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Settings</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              LLM providers, defaults, and app preferences.
            </p>
          </div>
        </div>
      </div>

      {/* ── LLM Providers section ────────────────────────── */}
      <section className="card card-pad space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              LLM Providers
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Multi-provider, OpenAI-compatible. Toggle on/off at runtime.
              API keys are encrypted at rest.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => load()}
              className="btn-secondary"
              data-testid="refresh-providers"
              aria-label="Refresh providers"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="btn-primary"
              data-testid="add-provider"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add provider
            </button>
          </div>
        </div>

        {providers.length === 0 ? (
          <div className="text-sm text-slate-500 py-6 text-center">
            No providers configured yet. Click <strong>Add provider</strong>{' '}
            to add your first one.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {providers.map((p) => (
              <ProviderRow
                key={p.id}
                provider={p}
                onEdit={() => setEditingId(p.id)}
                onDelete={async () => {
                  if (
                    !confirm(
                      `Delete provider "${p.display_name}"? This can't be undone.`,
                    )
                  ) {
                    return;
                  }
                  try {
                    await llmProvidersApi.delete(p.id);
                    showToast('success', `Deleted ${p.display_name}`);
                    await load();
                  } catch (e) {
                    showToast('error', `Delete failed: ${(e as Error).message}`);
                  }
                }}
                onTest={async () => {
                  setTestingId(p.id);
                  try {
                    const r = await llmProvidersApi.test(p.id);
                    if (r.ok) {
                      showToast('success', `Reachable in ${r.latency_ms ?? '?'}ms — ${r.message}`,);
                    } else {
                      showToast('error', `Test failed: ${r.message}`);
                    }
                  } catch (e) {
                    toast.error(
                      `Test failed: ${(e as Error).message}`,
                    );
                  } finally {
                    setTestingId(null);
                  }
                }}
                onToggle={async (enabled) => {
                  const payload: LLMProviderPatchPayload = { enabled };
                  try {
                    await llmProvidersApi.patch(p.id, payload);
                    showToast('success', `${enabled ? 'Enabled' : 'Disabled'} ${p.display_name}`,);
                    await load();
                  } catch (e) {
                    toast.error(
                      `Toggle failed: ${(e as Error).message}`,
                    );
                  }
                }}
                isTesting={testingId === p.id}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Add modal ────────────────────────────────────── */}
      {showCreate && (
        <ProviderFormModal
          mode="create"
          onClose={() => setShowCreate(false)}
          onSaved={async (saved) => {
            showToast('success', `Created ${saved.display_name}`);
            setShowCreate(false);
            await load();
          }}
        />
      )}

      {/* ── Edit modal ────────────────────────────────────── */}
      {editingId && (
        <ProviderFormModal
          mode="edit"
          providerId={editingId}
          onClose={() => setEditingId(null)}
          onSaved={async (saved) => {
            showToast('success', `Saved ${saved.display_name}`);
            setEditingId(null);
            await load();
          }}
        />
      )}
    </div>
  );
}

// ── Provider row (card) ─────────────────────────────────────────────
function ProviderRow({
  provider,
  onEdit,
  onDelete,
  onTest,
  onToggle,
  isTesting,
}: {
  provider: LLMProvider;
  onEdit: () => void;
  onDelete: () => void;
  onTest: () => void;
  onToggle: (enabled: boolean) => void;
  isTesting: boolean;
}) {
  const hasKey = provider.api_key_set;
  const canEnable = hasKey;
  return (
    <div
      className="py-3 flex items-start justify-between gap-3"
      data-testid={`provider-row-${provider.id}`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-900 truncate">
            {provider.display_name}
          </span>
          <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">
            {KIND_LABEL[provider.kind]}
          </span>
          <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">
            priority {provider.priority}
          </span>
          {!hasKey && (
            <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> no key
            </span>
          )}
        </div>
        <div className="text-xs text-slate-500 truncate mt-0.5">
          {provider.base_url || <em className="text-slate-400">no base URL</em>}
        </div>
        <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
          {LLM_TASK_TYPES.map((t) => {
            const m = provider.models_json[t];
            if (!m) return null;
            return (
              <span key={t} className="whitespace-nowrap">
                <span className="text-slate-400">{TASK_LABEL[t]}:</span>{' '}
                <span className="font-mono">{m}</span>
              </span>
            );
          })}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
          <input
            type="checkbox"
            checked={provider.enabled}
            disabled={!canEnable}
            onChange={(e) => onToggle(e.target.checked)}
            className="w-4 h-4"
            data-testid={`provider-toggle-${provider.id}`}
            aria-label={`Enable ${provider.display_name}`}
          />
          <span>{provider.enabled ? 'On' : 'Off'}</span>
        </label>
        <button
          onClick={onTest}
          disabled={isTesting || !hasKey || !provider.base_url}
          className="btn-secondary text-xs"
          data-testid={`provider-test-${provider.id}`}
          aria-label={`Test ${provider.display_name}`}
        >
          {isTesting ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            'Test'
          )}
        </button>
        <button
          onClick={onEdit}
          className="btn-secondary text-xs"
          data-testid={`provider-edit-${provider.id}`}
        >
          Edit
        </button>
        <button
          onClick={onDelete}
          className="btn-secondary text-xs text-rose-600"
          data-testid={`provider-delete-${provider.id}`}
          aria-label={`Delete ${provider.display_name}`}
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

// ── Add/Edit modal ──────────────────────────────────────────────────
function ProviderFormModal({
  mode,
  providerId,
  onClose,
  onSaved,
}: {
  mode: 'create' | 'edit';
  providerId?: string;
  onClose: () => void;
  onSaved: (saved: LLMProvider) => void;
}) {
  const [loading, setLoading] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);

  const [id, setId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [kind, setKind] = useState<LLMProviderKind>('openai_compat');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [existingKeySet, setExistingKeySet] = useState(false);
  const [priority, setPriority] = useState(99);
  const [enabled, setEnabled] = useState(false);
  const [maxTokens, setMaxTokens] = useState(4000);
  const [temperature, setTemperature] = useState(0.3);
  const [modelsJson, setModelsJson] = useState<Record<string, string>>({});

  // Load existing for edit
  useEffect(() => {
    if (mode !== 'edit' || !providerId) return;
    (async () => {
      try {
        const p = await llmProvidersApi.get(providerId);
        setId(p.id);
        setDisplayName(p.display_name);
        setKind(p.kind);
        setBaseUrl(p.base_url);
        setExistingKeySet(p.api_key_set);
        setPriority(p.priority);
        setEnabled(p.enabled);
        setMaxTokens(p.max_tokens_default);
        setTemperature(p.temperature_default);
        setModelsJson({ ...(p.models_json || {}) });
      } catch (e) {
        showToast('error', `Load failed: ${(e as Error).message}`);
        onClose();
      } finally {
        setLoading(false);
      }
    })();
  }, [mode, providerId, onClose]);

  const handleSubmit = async () => {
    if (!displayName.trim()) {
      showToast('error', 'Display name required');
      return;
    }
    if (mode === 'create' && !/^[a-z0-9][a-z0-9_\-]*$/.test(id)) {
      showToast('error', 'ID must be lowercase, start alphanumeric, no spaces');
      return;
    }
    setSaving(true);
    try {
      // Strip empty model entries before submit
      const cleanModels: Record<string, string> = {};
      for (const [k, v] of Object.entries(modelsJson)) {
        if (v && v.trim()) cleanModels[k] = v.trim();
      }
      let saved: LLMProvider;
      if (mode === 'create') {
        saved = await llmProvidersApi.create({
          id,
          display_name: displayName.trim(),
          kind,
          base_url: baseUrl.trim(),
          api_key: apiKey,
          enabled: apiKey ? enabled : false,  // can't enable without key
          priority,
          models_json: cleanModels,
          max_tokens_default: maxTokens,
          temperature_default: temperature,
        });
      } else {
        // Patch — only send api_key if user typed something (server treats
        // empty as "clear").
        const payload: LLMProviderPatchPayload = {
          display_name: displayName.trim(),
          kind,
          base_url: baseUrl.trim(),
          priority,
          enabled,
          models_json: cleanModels,
          max_tokens_default: maxTokens,
          temperature_default: temperature,
        };
        if (apiKey.length > 0) payload.api_key = apiKey;
        saved = await llmProvidersApi.patch(providerId!, payload);
      }
      onSaved(saved);
    } catch (e) {
      const msg = (e as Error).message;
      showToast('error', `Save failed: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={mode === 'create' ? 'Add LLM provider' : 'Edit LLM provider'}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">
            {mode === 'create' ? 'Add LLM Provider' : `Edit "${displayName}"`}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="p-12 flex items-center justify-center text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
          </div>
        ) : (
          <div className="flex-1 overflow-auto p-6 space-y-4">
            {/* ID + Name */}
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="ID (slug)"
                hint={
                  mode === 'edit'
                    ? 'Cannot be changed'
                    : 'lowercase, start alphanumeric'
                }
              >
                <input
                  type="text"
                  value={id}
                  disabled={mode === 'edit'}
                  onChange={(e) => setId(e.target.value)}
                  placeholder="my-provider"
                  className="input"
                  data-testid="provider-id"
                />
              </Field>
              <Field label="Display name" required>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="My Provider"
                  className="input"
                  data-testid="provider-name"
                />
              </Field>
            </div>

            {/* Kind + Base URL */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Kind">
                <div className="relative">
                  <select
                    value={kind}
                    onChange={(e) =>
                      setKind(e.target.value as LLMProviderKind)
                    }
                    className="input appearance-none pr-8"
                    data-testid="provider-kind"
                  >
                    <option value="openai_compat">OpenAI-compatible</option>
                    <option value="anthropic">Anthropic</option>
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </Field>
              <Field label="Base URL" hint="https://… required">
                <input
                  type="text"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder={
                    kind === 'anthropic'
                      ? 'https://api.anthropic.com'
                      : 'https://api.openai.com/v1'
                  }
                  className="input"
                  data-testid="provider-url"
                />
              </Field>
            </div>

            {/* API Key */}
            <Field
              label="API Key"
              hint={
                existingKeySet && mode === 'edit'
                  ? 'Key is set — leave blank to keep it, type a new value to rotate, type empty to clear.'
                  : 'Stored encrypted at rest (Fernet). Never returned in API responses.'
              }
            >
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={
                    existingKeySet && mode === 'edit'
                      ? '••••••• (leave blank to keep)'
                      : 'sk-...'
                  }
                  className="input pr-9 font-mono text-xs"
                  autoComplete="off"
                  data-testid="provider-key"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label={showKey ? 'Hide key' : 'Show key'}
                  tabIndex={-1}
                >
                  {showKey ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              {existingKeySet && mode === 'edit' && !apiKey && (
                <div className="text-xs text-emerald-700 mt-1 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Key is currently set
                </div>
              )}
            </Field>

            {/* Toggle + Priority */}
            <div className="grid grid-cols-3 gap-3">
              <Field label="Enabled">
                <label className="flex items-center gap-2 mt-2">
                  <input
                    type="checkbox"
                    checked={enabled}
                    disabled={mode === 'create' && !apiKey}
                    onChange={(e) => setEnabled(e.target.checked)}
                    className="w-4 h-4"
                    data-testid="provider-enabled"
                  />
                  <span className="text-sm text-slate-700">
                    {enabled ? 'On' : 'Off'}
                  </span>
                </label>
              </Field>
              <Field label="Priority" hint="lower = tried first">
                <input
                  type="number"
                  min={1}
                  max={999}
                  value={priority}
                  onChange={(e) => setPriority(Number(e.target.value) || 99)}
                  className="input"
                  data-testid="provider-priority"
                />
              </Field>
              <Field label="Max tokens">
                <input
                  type="number"
                  min={64}
                  max={128000}
                  value={maxTokens}
                  onChange={(e) =>
                    setMaxTokens(Number(e.target.value) || 4000)
                  }
                  className="input"
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Temperature" hint="0.0 = deterministic, 2.0 = chaotic">
                <input
                  type="number"
                  min={0}
                  max={2}
                  step={0.1}
                  value={temperature}
                  onChange={(e) =>
                    setTemperature(Number(e.target.value) || 0.3)
                  }
                  className="input"
                />
              </Field>
            </div>

            {/* Models per task */}
            <div>
              <div className="text-sm font-medium text-slate-700 mb-2">
                Models per task
              </div>
              <div className="grid grid-cols-2 gap-2">
                {LLM_TASK_TYPES.map((t) => (
                  <Field key={t} label={TASK_LABEL[t]}>
                    <input
                      type="text"
                      value={modelsJson[t] || ''}
                      onChange={(e) =>
                        setModelsJson((m) => ({
                          ...m,
                          [t]: e.target.value,
                        }))
                      }
                      placeholder="model-name"
                      className="input font-mono text-xs"
                      data-testid={`provider-model-${t}`}
                    />
                  </Field>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Leave blank to fall back to other enabled providers for that
                task. The first enabled provider (lowest priority) with a
                model set is used first; the rest are fallback.
              </p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-3 border-t border-slate-200 bg-slate-50">
          <button
            onClick={onClose}
            className="btn-secondary"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="btn-primary"
            disabled={saving || loading}
            data-testid="provider-save"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-1" />
                Saving…
              </>
            ) : mode === 'create' ? (
              'Create'
            ) : (
              'Save'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-700">
        {label}
        {required && <span className="text-rose-500 ml-0.5">*</span>}
      </span>
      <div className="mt-1">{children}</div>
      {hint && <span className="text-[11px] text-slate-500 mt-0.5">{hint}</span>}
    </label>
  );
}