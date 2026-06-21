import { useEffect, useRef, useState } from 'react';
import { Save, X, ChevronDown, ChevronRight, Loader2, Plus, Check, Pencil } from 'lucide-react';

/**
 * Update button shown in the Basics section header. Three visual states:
 *   - dirty=false: muted "Update" button (disabled, hint there's nothing to save)
 *   - dirty=true:  primary "Update" + secondary "Discard" buttons
 *   - justSaved:  green "Saved ✓" pill (auto-clears after 2.5s)
 *
 * Other sections get a disabled Update button + tooltip explaining
 * inline editing isn't there yet (consistent visual pattern).
 */
function BasicsUpdateButton({
  dirty,
  saving = false,
  justSaved,
  onSave,
  onReset,
}: {
  dirty: boolean;
  saving?: boolean;
  justSaved: boolean;
  onSave: () => void;
  onReset: () => void;
}) {
  if (justSaved) {
    return (
      <span
        data-testid="basics-saved-pill"
        className="inline-flex items-center gap-1 px-2.5 py-1 text-[12px] font-semibold rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200"
      >
        <Check size={12} /> Saved
      </span>
    );
  }
  if (dirty) {
    return (
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onReset}
          disabled={saving}
          data-testid="basics-discard"
          className="inline-flex items-center gap-1 px-2 py-1 text-[12px] font-medium border border-slate-200 text-slate-700 bg-white rounded hover:border-slate-300 transition-colors disabled:opacity-50"
        >
          <X size={12} /> Discard
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          data-testid="basics-update"
          className="inline-flex items-center gap-1 px-2.5 py-1 text-[12px] font-semibold bg-brand-600 text-white rounded hover:bg-brand-700 transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
          Update
        </button>
      </div>
    );
  }
  return (
    <button
      type="button"
      disabled
      data-testid="basics-update"
      className="inline-flex items-center gap-1 px-2.5 py-1 text-[12px] font-medium border border-slate-200 text-slate-500 bg-slate-50 rounded cursor-not-allowed"
      title="Edit a field above to enable Update"
    >
      <Pencil size={12} /> Update
    </button>
  );
}

/**
 * Update button for read-only sections (Experience / Skills /
 * Education / Projects). Inline editing for these isn't there yet,
 * so the button is disabled with a tooltip that explains the
 * placeholder honestly — much better UX than a missing button
 * (where the user might wonder if the section is editable at all).
 *
 * NOTE: per user feedback, the disabled-with-tooltip approach was
 * considered annoying visual noise. Removed entirely from
 * Experience / Skills / Education / Projects — only Basics has
 * a visible Update button. The "re-upload your resume" path
 * remains the way to refresh those sections.
 */

export interface ProfileData {
  id: string;
  name: string;
  title?: string | null;
  email: string;
  phone?: string | null;
  location?: string | null;
  linkedin?: string | null;
  github?: string | null;
  portfolio?: string | null;
  summary?: string | null;
  confidence_score: number;
  base_profile_json: {
    basics?: {
      name?: string;
      label?: string;
      email?: string;
      phone?: string;
      url?: string;
      summary?: string;
      location?: { city?: string; country?: string };
      profiles?: Array<{ network?: string; username?: string; url?: string }>;
    };
    work?: Array<{
      name: string;
      position: string;
      location?: string;
      startDate?: string;
      endDate?: string | null;
      highlights?: string[];
    }>;
    education?: Array<{
      institution: string;
      area?: string;
      studyType?: string;
      endDate?: string;
    }>;
    skills?: Array<{
      name: string;
      level?: string;
      keywords: string[];
    }>;
    projects?: Array<{
      name: string;
      description?: string;
      highlights?: string[];
    }>;
    certificates?: Array<{ name: string; issuer?: string; date?: string }>;
    languages?: Array<{ language: string; fluency?: string }>;
  };
  updated_at?: string;
}

interface ProfileEditFormProps {
  profile: ProfileData;
  onSave: (patch: Partial<ProfileData>) => Promise<void>;
  saving?: boolean;
}

export default function ProfileEditForm({ profile, onSave, saving }: ProfileEditFormProps) {
  const [basicsOpen, setBasicsOpen] = useState(true);
  const [workOpen, setWorkOpen] = useState(true);
  const [skillsOpen, setSkillsOpen] = useState(true);
  const [eduOpen, setEduOpen] = useState(false);
  const [projOpen, setProjOpen] = useState(false);

  // Resolve each link field with a fallback chain:
  //   1. The flat column (e.g. profile.linkedin)
  //   2. The LLM-extracted basics.profiles[i] where network matches
  //   3. A heuristic on basics.url (LinkedIn/GitHub/Portfolio by host)
  //   4. Empty
  // The LLM sometimes returns LinkedIn/GitHub only inside basics.profiles
  // (with no flat column) so we can't rely on the flat column alone.
  const profiles = profile.base_profile_json?.basics?.profiles ?? [];
  const basicsUrl = profile.base_profile_json?.basics?.url ?? '';
  const profileLink = (network: string): string => {
    const hit = profiles.find(
      (p) => p.network?.toLowerCase() === network.toLowerCase(),
    );
    if (hit?.url) return hit.url;
    // Host-based heuristic: basics.url is the LLM's catch-all
    // for "wherever you can find me online".
    const host = (url: string) => {
      try { return new URL(url).hostname.toLowerCase(); } catch { return ''; }
    };
    if (network === 'LinkedIn' && host(basicsUrl).includes('linkedin.com')) return basicsUrl;
    if (network === 'GitHub'   && host(basicsUrl).includes('github.com'))   return basicsUrl;
    if (network === 'Portfolio' && basicsUrl) {
      // Treat as portfolio if it's NOT linkedin/github.
      const h = host(basicsUrl);
      if (h && !h.includes('linkedin.com') && !h.includes('github.com')) return basicsUrl;
    }
    return '';
  };

  const [name, setName] = useState(profile.name);
  const [title, setTitle] = useState(profile.title ?? '');
  const [email, setEmail] = useState(profile.email);
  const [phone, setPhone] = useState(profile.phone ?? '');
  const [location, setLocation] = useState(profile.location ?? '');
  const [linkedin, setLinkedin] = useState(profile.linkedin ?? profileLink('LinkedIn'));
  const [github, setGithub] = useState(profile.github ?? profileLink('GitHub'));
  const [portfolio, setPortfolio] = useState(
    profile.portfolio ?? profileLink('Portfolio'),
  );
  const [summary, setSummary] = useState(profile.summary ?? '');

  // Per-section "just saved" feedback. Each section's Update button
  // briefly flips this state to true on success so the button can show
  // a "Saved ✓" pill for a couple of seconds. Cleared on next edit.
  const [basicsJustSaved, setBasicsJustSaved] = useState(false);
  const basicsSavedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const basicsDirty =
    name !== profile.name ||
    title !== (profile.title ?? '') ||
    email !== profile.email ||
    phone !== (profile.phone ?? '') ||
    location !== (profile.location ?? '') ||
    linkedin !== (profile.linkedin ?? '') ||
    github !== (profile.github ?? '') ||
    portfolio !== (profile.portfolio ?? '') ||
    summary !== (profile.summary ?? '');

  // Cleanup the saved-pill timer on unmount
  useEffect(
    () => () => {
      if (basicsSavedTimer.current) clearTimeout(basicsSavedTimer.current);
    },
    [],
  );

  const handleSaveBasics = async () => {
    await onSave({
      name, title, email, phone, location,
      linkedin, github, portfolio, summary,
    });
    setBasicsJustSaved(true);
    if (basicsSavedTimer.current) clearTimeout(basicsSavedTimer.current);
    basicsSavedTimer.current = setTimeout(() => setBasicsJustSaved(false), 2500);
  };

  const handleResetBasics = () => {
    setName(profile.name);
    setTitle(profile.title ?? '');
    setEmail(profile.email);
    setPhone(profile.phone ?? '');
    setLocation(profile.location ?? '');
    setLinkedin(profile.linkedin ?? '');
    setGithub(profile.github ?? '');
    setPortfolio(profile.portfolio ?? '');
    setSummary(profile.summary ?? '');
    setBasicsJustSaved(false);
    if (basicsSavedTimer.current) clearTimeout(basicsSavedTimer.current);
  };

  const Section = ({
    title,
    open,
    onToggle,
    headerAction,
    children,
  }: {
    title: string;
    open: boolean;
    onToggle: () => void;
    headerAction?: React.ReactNode;
    children: React.ReactNode;
  }) => (
    <section className="card card-pad">
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={onToggle}
          className="flex items-center gap-2 text-left flex-1 min-w-0"
        >
          <h3 className="section-title mb-0">{title}</h3>
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        {headerAction && <div className="shrink-0">{headerAction}</div>}
      </div>
      {open && <div className="mt-4 space-y-4">{children}</div>}
    </section>
  );

  const work = profile.base_profile_json.work ?? [];
  const edu = profile.base_profile_json.education ?? [];
  const skills = profile.base_profile_json.skills ?? [];
  const projects = profile.base_profile_json.projects ?? [];

  return (
    <div className="space-y-6">
      {/* Last updated line — kept simple, no actions here. The Update
          button for each section lives in its own header (per-section
          save). */}
      <div className="text-xs text-slate-500">
        Last updated:{' '}
        {profile.updated_at
          ? new Date(profile.updated_at).toLocaleString()
          : 'unknown'}
      </div>

      {/* Basics */}
      <Section
        title="Basics"
        open={basicsOpen}
        onToggle={() => setBasicsOpen(!basicsOpen)}
        headerAction={
          <BasicsUpdateButton
            dirty={basicsDirty}
            saving={saving}
            onSave={handleSaveBasics}
            onReset={handleResetBasics}
            justSaved={basicsJustSaved}
          />
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Full name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="label">Title / current role</label>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <label className="label">Location</label>
            <input
              className="input"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
          <div>
            <label className="label">LinkedIn URL</label>
            <input
              className="input"
              value={linkedin}
              onChange={(e) => setLinkedin(e.target.value)}
              placeholder="https://linkedin.com/in/your-handle"
            />
            {!linkedin && (
              <button
                type="button"
                onClick={() => setLinkedin('https://linkedin.com/in/')}
                className="mt-1 inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700"
              >
                <Plus size={11} /> Add LinkedIn
              </button>
            )}
          </div>
          <div>
            <label className="label">GitHub URL</label>
            <input
              className="input"
              value={github}
              onChange={(e) => setGithub(e.target.value)}
              placeholder="https://github.com/your-handle"
            />
            {!github && (
              <button
                type="button"
                onClick={() => setGithub('https://github.com/')}
                className="mt-1 inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700"
              >
                <Plus size={11} /> Add GitHub
              </button>
            )}
          </div>
          <div>
            <label className="label">Portfolio URL</label>
            <input
              type="url"
              className="input"
              value={portfolio}
              onChange={(e) => setPortfolio(e.target.value)}
              placeholder="https://yourname.dev"
            />
            {!portfolio && (
              <button
                type="button"
                onClick={() => setPortfolio('https://')}
                className="mt-1 inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700"
              >
                <Plus size={11} /> Add Portfolio
              </button>
            )}
          </div>
        </div>
        <div>
          <label className="label">Professional summary</label>
          <textarea
            className="input min-h-[88px] resize-y"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
          />
        </div>
      </Section>

      {/* Work experience (read-only preview, edit Phase 3) */}
      <Section
        title={`Experience (${work.length})`}
        open={workOpen}
        onToggle={() => setWorkOpen(!workOpen)}
      >
        {work.length === 0 && (
          <div className="text-xs text-slate-500 italic">No experience extracted yet.</div>
        )}
        <div className="space-y-4">
          {work.map((w, i) => (
            <div key={i} className="border-l-2 border-brand-200 pl-3">
              <div className="flex items-baseline justify-between gap-2">
                <div className="font-medium text-sm text-slate-900">
                  {w.position} · {w.name}
                </div>
                <div className="text-xs text-slate-500 tabular-nums shrink-0">
                  {w.startDate ?? '?'} — {w.endDate ?? 'Present'}
                </div>
              </div>
              {w.location && (
                <div className="text-xs text-slate-500 mt-0.5">{w.location}</div>
              )}
              {w.highlights && w.highlights.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs text-slate-700">
                  {w.highlights.map((h, j) => (
                    <li key={j} className="leading-relaxed">
                      · {h}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
        <div className="text-xs text-slate-500 italic pt-2 border-t border-slate-100">
          Inline editing for experience comes in Phase 3.
        </div>
      </Section>

      {/* Skills (read-only) */}
      <Section
        title={`Skills (${skills.length} ${skills.length === 1 ? 'category' : 'categories'}, ${
          skills.reduce((acc, s) => acc + s.keywords.length, 0)
        } ${skills.reduce((acc, s) => acc + s.keywords.length, 0) === 1 ? 'keyword' : 'keywords'})`}
        open={skillsOpen}
        onToggle={() => setSkillsOpen(!skillsOpen)}
      >
        {skills.length === 0 && (
          <div className="text-xs text-slate-500 italic">No skills extracted yet.</div>
        )}
        <div className="space-y-3">
          {skills.map((s, i) => (
            <div key={i}>
              <div className="flex items-baseline justify-between mb-1.5">
                <div className="text-xs font-medium text-slate-700">{s.name}</div>
                {s.level && (
                  <div className="text-xs text-slate-500">{s.level}</div>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {s.keywords.map((k) => (
                  <span
                    key={k}
                    className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs"
                  >
                    {k}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Education (read-only) */}
      {edu.length > 0 && (
        <Section
          title={`Education (${edu.length})`}
          open={eduOpen}
          onToggle={() => setEduOpen(!eduOpen)}
        >
          <div className="space-y-2">
            {edu.map((e, i) => (
              <div key={i} className="flex items-baseline justify-between">
                <div className="text-sm text-slate-900">
                  {e.studyType && `${e.studyType}, `}
                  {e.institution}
                  {e.area && ` · ${e.area}`}
                </div>
                {e.endDate && <div className="text-xs text-slate-500">{e.endDate}</div>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Projects (read-only) */}
      {projects.length > 0 && (
        <Section
          title={`Projects (${projects.length})`}
          open={projOpen}
          onToggle={() => setProjOpen(!projOpen)}
        >
          <div className="space-y-3">
            {projects.map((p, i) => (
              <div key={i}>
                <div className="text-sm font-medium text-slate-900">{p.name}</div>
                {p.description && (
                  <div className="text-xs text-slate-600 mt-1">{p.description}</div>
                )}
                {p.highlights && p.highlights.length > 0 && (
                  <ul className="mt-1 space-y-0.5 text-xs text-slate-700">
                    {p.highlights.map((h, j) => (
                      <li key={j}>· {h}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}