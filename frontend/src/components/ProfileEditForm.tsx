import { useState } from 'react';
import clsx from 'clsx';
import { Save, X, ChevronDown, ChevronRight, Loader2, AlertTriangle, CheckCircle2, AlertCircle, Plus } from 'lucide-react';

function ConfidenceBadge({ score }: { score: number }) {
  // Color-code the parser confidence so users notice low-confidence parses
  const pct = Math.round(score * 100);
  const tone =
    score >= 0.75 ? { icon: CheckCircle2, color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' } :
    score >= 0.5  ? { icon: AlertCircle,   color: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200' } :
                    { icon: AlertTriangle, color: 'text-red-700',     bg: 'bg-red-50',     border: 'border-red-200' };
  const Icon = tone.icon;
  const label =
    score >= 0.75 ? 'High confidence' :
    score >= 0.5  ? 'Medium confidence' :
                    'Low confidence — review carefully';
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium',
        tone.color, tone.bg, tone.border,
      )}
      title={label}
    >
      <Icon size={11} />
      {pct}% confidence
    </span>
  );
}

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
      summary?: string;
      location?: { city?: string; country?: string };
      profiles?: Array<{ network: string; url: string }>;
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

  const [name, setName] = useState(profile.name);
  const [title, setTitle] = useState(profile.title ?? '');
  const [email, setEmail] = useState(profile.email);
  const [phone, setPhone] = useState(profile.phone ?? '');
  const [location, setLocation] = useState(profile.location ?? '');
  const [linkedin, setLinkedin] = useState(profile.linkedin ?? '');
  const [github, setGithub] = useState(profile.github ?? '');
  const [summary, setSummary] = useState(profile.summary ?? '');

  const dirty =
    name !== profile.name ||
    title !== (profile.title ?? '') ||
    email !== profile.email ||
    phone !== (profile.phone ?? '') ||
    location !== (profile.location ?? '') ||
    linkedin !== (profile.linkedin ?? '') ||
    github !== (profile.github ?? '') ||
    summary !== (profile.summary ?? '');

  const handleSave = async () => {
    await onSave({ name, title, email, phone, location, linkedin, github, summary });
  };

  const handleReset = () => {
    setName(profile.name);
    setTitle(profile.title ?? '');
    setEmail(profile.email);
    setPhone(profile.phone ?? '');
    setLocation(profile.location ?? '');
    setLinkedin(profile.linkedin ?? '');
    setGithub(profile.github ?? '');
    setSummary(profile.summary ?? '');
  };

  const Section = ({
    title,
    open,
    onToggle,
    children,
  }: {
    title: string;
    open: boolean;
    onToggle: () => void;
    children: React.ReactNode;
  }) => (
    <section className="card card-pad">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between text-left"
      >
        <h3 className="section-title mb-0">{title}</h3>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>
      {open && <div className="mt-4 space-y-4">{children}</div>}
    </section>
  );

  const work = profile.base_profile_json.work ?? [];
  const edu = profile.base_profile_json.education ?? [];
  const skills = profile.base_profile_json.skills ?? [];
  const projects = profile.base_profile_json.projects ?? [];

  return (
    <div className="space-y-6">
      {/* Save bar (sticky-feeling, top of form) */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span>
            Last updated:{' '}
            {profile.updated_at
              ? new Date(profile.updated_at).toLocaleString()
              : 'unknown'}
          </span>
          <ConfidenceBadge score={profile.confidence_score} />
        </div>
        <div className="flex items-center gap-2">
          {dirty && (
            <button
              onClick={handleReset}
              disabled={saving}
              className="btn btn-ghost text-xs"
            >
              <X size={13} /> Discard
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!dirty || saving}
            className={clsx('btn btn-primary text-xs', !dirty && 'opacity-50 cursor-not-allowed')}
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            Save changes
          </button>
        </div>
      </div>

      {/* Basics */}
      <Section title="Basics" open={basicsOpen} onToggle={() => setBasicsOpen(!basicsOpen)}>
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
        <Section title={`Education (${edu.length})`} open={eduOpen} onToggle={() => setEduOpen(!eduOpen)}>
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