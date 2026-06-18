import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useEffect, useState, useMemo } from 'react';
import clsx from 'clsx';
import {
  Activity,
  Search,
  CheckCircle2,
  AlertCircle,
  Upload,
  FileText,
  Briefcase,
  ArrowUpRight,
  Sparkles,
  Layers,
} from 'lucide-react';

type HealthResp = { status: string; service: string; version: string; environment: string };
type ReadyResp = { status: string; checks: Record<string, string> };

// ── Sub-components ──────────────────────────────────────────────

function Sparkline({ values, color = '#10b981' }: { values: number[]; color?: string }) {
  if (values.length < 2) return <div className="h-8" />;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const w = 80;
  const h = 28;
  const stepX = w / (values.length - 1);
  const points = values
    .map((v, i) => `${(i * stepX).toFixed(1)},${(h - ((v - min) / range) * h).toFixed(1)}`)
    .join(' ');
  const last = values[values.length - 1];
  const prev = values[values.length - 2] ?? last;
  const trend = last - prev;
  return (
    <svg width={w} height={h} className="overflow-visible">
      <defs>
        <linearGradient id={`spark-${color}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      <polygon points={`0,${h} ${points} ${w},${h}`} fill={`url(#spark-${color})`} />
      <circle cx={w} cy={h - ((last - min) / range) * h} r="2" fill={color} />
      <text x={w - 3} y="11" textAnchor="end" fontSize="9" fontWeight="600" fill={color} className="tabular-nums">
        {trend > 0 ? '▲' : trend < 0 ? '▼' : '·'} {Math.abs(trend).toFixed(0)}
      </text>
    </svg>
  );
}

function Ring({ value, total, size = 56 }: { value: number; total: number; size?: number }) {
  const pct = total > 0 ? value / total : 0;
  const r = size / 2 - 4;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct);
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth="4" className="text-slate-200" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={pct === 1 ? '#10b981' : pct >= 0.5 ? '#f59e0b' : '#f43f5e'}
        strokeWidth="4"
        strokeDasharray={c}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-500"
      />
    </svg>
  );
}

// ── Main page ──────────────────────────────────────────────────

const PHASES = [
  { n: '00', title: 'Skeleton + schema + stack lock-in', group: 'Foundation', done: true },
  { n: '01', title: 'AI provider abstraction + LLM-as-narrator', group: 'Foundation', done: false },
  { n: '02', title: 'Resume upload (PDF/DOCX) + AI parser', group: 'Core', done: false },
  { n: '03', title: 'Base Profile editor + version history', group: 'Core', done: false },
  { n: '04', title: 'Job URL/manual JD + analyzer', group: 'Core', done: false },
  { n: '05', title: 'Matching engine (deterministic + LLM)', group: 'Core', done: false },
  { n: '06', title: 'CV generator (template + LLM filler)', group: 'Core', done: false },
  { n: '07', title: 'CV scoring + recommendation', group: 'Core', done: false },
  { n: '08', title: 'Apply improvement + re-score', group: 'Core', done: false },
  { n: '09', title: 'Cover letter generator', group: 'Core', done: false },
  { n: '10', title: 'Export PDF + DOCX', group: 'Polish', done: false },
  { n: '11', title: 'Application tracking + history', group: 'Polish', done: false },
  { n: '12', title: 'AI Prompt Manager + Settings polish', group: 'Polish', done: false },
];

const GROUPS = ['Foundation', 'Core', 'Polish'] as const;
type GroupName = (typeof GROUPS)[number];
const GROUP_STYLES: Record<GroupName, { dot: string; text: string; bg: string }> = {
  Foundation: { dot: 'bg-slate-400', text: 'text-slate-600', bg: 'bg-slate-50' },
  Core: { dot: 'bg-brand-500', text: 'text-brand-700', bg: 'bg-brand-50' },
  Polish: { dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50' },
};

const RECENT_ACTIVITY = [
  { kind: 'upload', text: 'resume.pdf uploaded', time: '2h ago', icon: Upload },
  { kind: 'score', text: 'Senior Backend @ Bukalapak — 87 match', time: '4h ago', icon: Briefcase },
  { kind: 'cv', text: 'CV draft v3 generated', time: '1d ago', icon: FileText },
  { kind: 'export', text: 'Cover letter exported (PDF)', time: '2d ago', icon: ArrowUpRight },
  { kind: 'parse', text: 'Resume parsed — confidence 0.92', time: '3d ago', icon: Sparkles },
];

export default function DashboardPage() {
  const health = useQuery({
    queryKey: ['health'],
    queryFn: async () => (await api.get<HealthResp>('/health')).data,
    refetchInterval: 30_000,
  });
  const ready = useQuery({
    queryKey: ['ready'],
    queryFn: async () => (await api.get<ReadyResp>('/health/ready')).data,
    refetchInterval: 30_000,
  });

  // Synthetic ping history for the sparkline (real impl would persist in DB).
  const [pingHistory, setPingHistory] = useState<number[]>(() =>
    Array.from({ length: 20 }, () => 200 + Math.random() * 200),
  );
  const [pingMs, setPingMs] = useState<number | null>(null);
  useEffect(() => {
    const t0 = performance.now();
    api.get('/health').then(() => {
      const ms = Math.round(performance.now() - t0);
      setPingMs(ms);
      setPingHistory((h) => [...h.slice(1), ms]);
    });
  }, []);

  // Readiness calc.
  const checks = ready.data?.checks ?? {};
  const checkEntries = Object.entries(checks);
  const passingCount = checkEntries.filter(([, v]) => v === 'ok').length;
  const totalChecks = checkEntries.length;

  const completedPhases = PHASES.filter((p) => p.done).length;
  const totalPhases = PHASES.length;
  const progressPct = (completedPhases / totalPhases) * 100;

  // Phases by group, preserving order.
  const phasesByGroup = useMemo(() => {
    const m: Record<GroupName, typeof PHASES> = { Foundation: [], Core: [], Polish: [] };
    for (const p of PHASES) m[p.group as GroupName].push(p);
    return m;
  }, []);

  return (
    <div className="-m-8 min-h-full">
      {/* ── Hero ──────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-indigo-700 text-white">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, white 0%, transparent 40%), radial-gradient(circle at 80% 60%, white 0%, transparent 50%)',
          }}
        />
        <div className="absolute inset-0 opacity-[0.07]" style={{
          backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }} />
        <div className="relative px-8 pt-7 pb-8 flex items-center justify-between gap-6 flex-wrap">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.2em] text-white/60 font-semibold mb-1.5 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
              Welcome back
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">Mohammad</h1>
            <p className="text-white/70 mt-1 text-sm max-w-md">
              Upload your primary resume to build a Base Profile, then paste a job to generate
              a tailored CV and cover letter.
            </p>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <button className="btn bg-white/10 hover:bg-white/20 text-white border border-white/20 backdrop-blur-sm text-xs px-3 py-1.5">
              View docs
            </button>
            <button className="btn bg-white text-brand-700 hover:bg-brand-50 text-xs px-3 py-1.5 shadow-lg shadow-brand-900/30">
              <Upload size={13} /> Upload resume
            </button>
          </div>
        </div>
      </section>

      <div className="px-8 -mt-6 relative z-10 space-y-6">
        {/* ── Top bar with global status ────────────────────── */}
        <div className="card shadow-lg shadow-slate-200/60 px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Search size={12} className="text-slate-400" />
              <span className="text-slate-400">Jump to…</span>
              <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[10px] font-mono text-slate-500">
                ⌘K
              </kbd>
            </div>
            <div className="h-4 w-px bg-slate-200" />
            <div className="flex items-center gap-2 text-xs">
              {health.data?.status === 'healthy' ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  <span className="font-medium text-slate-700">Backend online</span>
                </>
              ) : (
                <>
                  <span className="h-2 w-2 rounded-full bg-slate-300" />
                  <span className="text-slate-500">Backend …</span>
                </>
              )}
            </div>
          </div>
          <div className="text-xs text-slate-400 tabular-nums">
            v{health.data?.version ?? '0.1.0'} · {health.data?.environment ?? 'development'}
          </div>
        </div>

        {/* ── Two-column: left = status widgets + roadmap, right = activity + checks ── */}
        <div className="grid grid-cols-12 gap-6">
          {/* LEFT COLUMN */}
          <div className="col-span-12 xl:col-span-8 space-y-6">
            <div className="grid grid-cols-3 gap-4">
              {/* Backend uptime */}
              <div className="card card-pad relative overflow-hidden">
                <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-50 rounded-full" />
                <div className="relative">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.15em] text-slate-500 font-semibold">
                    <Activity size={11} className="text-emerald-600" />
                    Backend
                  </div>
                  <div className="mt-2 flex items-baseline gap-1.5">
                    <div className="text-2xl font-bold text-slate-900 tabular-nums">
                      {health.data?.status === 'healthy' ? '99.9' : '–'}
                    </div>
                    <span className="text-xs text-slate-400">% uptime</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400">7d rolling</span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                      <CheckCircle2 size={9} /> healthy
                    </span>
                  </div>
                </div>
              </div>

              {/* API ping */}
              <div className="card card-pad relative overflow-hidden">
                <div className="absolute -right-4 -top-4 w-24 h-24 bg-amber-50 rounded-full" />
                <div className="relative">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.15em] text-slate-500 font-semibold">
                    <Activity size={11} className="text-amber-600" />
                    API ping
                  </div>
                  <div className="mt-2 flex items-baseline gap-1.5">
                    <div className="text-2xl font-bold text-slate-900 tabular-nums">
                      {pingMs != null ? pingMs : '–'}
                    </div>
                    <span className="text-xs text-slate-400">ms</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <Sparkline
                      values={pingHistory}
                      color={pingMs && pingMs > 500 ? '#f43f5e' : pingMs && pingMs > 200 ? '#f59e0b' : '#10b981'}
                    />
                  </div>
                </div>
              </div>

              {/* Readiness ring */}
              <div className="card card-pad relative overflow-hidden">
                <div className="absolute -right-4 -top-4 w-24 h-24 bg-brand-50 rounded-full" />
                <div className="relative flex items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.15em] text-slate-500 font-semibold">
                      <CheckCircle2 size={11} className="text-brand-600" />
                      Readiness
                    </div>
                    <div className="mt-2 flex items-baseline gap-1.5">
                      <div className="text-2xl font-bold text-slate-900 tabular-nums">
                        {passingCount}/{totalChecks || 2}
                      </div>
                      <span className="text-xs text-slate-400">checks</span>
                    </div>
                    <div className="mt-2 text-[10px]">
                      {ready.data?.status === 'ready' ? (
                        <span className="text-emerald-700 font-semibold">All systems ready</span>
                      ) : (
                        <span className="text-amber-700 font-semibold">Action needed</span>
                      )}
                    </div>
                  </div>
                  <div className="text-brand-500 ml-auto">
                    <Ring value={passingCount} total={totalChecks || 2} size={56} />
                  </div>
                </div>
              </div>
            </div>

            {/* Quick actions row */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { title: 'Upload resume', desc: 'Build Base Profile', icon: Upload, accent: 'from-brand-500 to-indigo-600' },
                { title: 'Match a job', desc: 'Generate tailored CV', icon: Briefcase, accent: 'from-emerald-500 to-teal-600' },
                { title: 'Browse templates', desc: 'ATS-safe designs', icon: FileText, accent: 'from-amber-500 to-orange-600' },
              ].map((a) => (
                <button
                  key={a.title}
                  className="group card card-pad text-left flex items-center gap-3 hover:shadow-md hover:-translate-y-0.5 transition-all"
                >
                  <div
                    className={clsx(
                      'w-10 h-10 rounded-lg bg-gradient-to-br text-white flex items-center justify-center shadow-sm',
                      a.accent,
                    )}
                  >
                    <a.icon size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-900 group-hover:text-brand-700 transition">
                      {a.title}
                    </div>
                    <div className="text-xs text-slate-500">{a.desc}</div>
                  </div>
                  <ArrowUpRight size={14} className="text-slate-300 group-hover:text-brand-500 transition" />
                </button>
              ))}
            </div>

            {/* Build progress — dev build status (compact) */}
            <div className="card card-pad">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.15em] text-slate-500 font-semibold">
                    <Layers size={11} className="text-slate-500" />
                    Build progress
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">Internal roadmap</p>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-slate-900 tabular-nums leading-none">
                    {completedPhases}/{totalPhases}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mt-0.5">
                    phases
                  </div>
                </div>
              </div>

              {/* progress bar */}
              <div className="h-1 bg-slate-100 rounded-full overflow-hidden mb-3">
                <div
                  className="h-full bg-gradient-to-r from-brand-500 to-indigo-500 rounded-full transition-all duration-700"
                  style={{ width: `${progressPct}%` }}
                />
              </div>

              {/* compact 3-line summary per group */}
              <div className="space-y-2">
                {GROUPS.map((g) => {
                  const groupPhases = phasesByGroup[g];
                  const doneInGroup = groupPhases.filter((p) => p.done).length;
                  return (
                    <div key={g} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className={clsx('w-1.5 h-1.5 rounded-full', GROUP_STYLES[g].dot)} />
                        <span className={clsx('font-medium', GROUP_STYLES[g].text)}>{g}</span>
                      </div>
                      <span className="text-slate-500 tabular-nums">
                        {doneInGroup}/{groupPhases.length}
                        <span className="text-slate-400 ml-1">done</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Top job matches — empty state, previews the value */}
            <div className="card card-pad relative overflow-hidden">
              <div
                className="absolute inset-0 opacity-40"
                style={{
                  backgroundImage:
                    'radial-gradient(circle at 0% 100%, rgba(124,58,237,0.08), transparent 50%)',
                }}
              />
              <div className="relative">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.15em] text-slate-500 font-semibold">
                    <Briefcase size={11} className="text-brand-600" />
                    Top job matches
                  </div>
                  <span className="text-[10px] text-slate-400">last 30 days</span>
                </div>

                <div className="space-y-2">
                  {/* Sample row 1 — placeholder preview */}
                  <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-dashed border-slate-200 bg-slate-50/50">
                    <div className="w-9 h-9 rounded-md bg-gradient-to-br from-brand-500 to-indigo-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                      ?
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-700 truncate">
                        No jobs analyzed yet
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Paste a job description to see matches here
                      </div>
                    </div>
                    <button className="btn btn-secondary text-[11px] px-2.5 py-1 shrink-0">
                      Add
                    </button>
                  </div>
                  {/* Sample row 2 — ghost preview (how it'll look) */}
                  <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-slate-100 opacity-50">
                    <div className="w-9 h-9 rounded-md bg-slate-200 text-slate-400 flex items-center justify-center text-xs font-bold shrink-0">
                      ?
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-700 truncate">Senior Backend Engineer</div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                        <span>Bukalapak</span>
                        <span className="text-slate-300">·</span>
                        <span>Jakarta</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-base font-bold text-emerald-600 tabular-nums leading-none">87</div>
                      <div className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold mt-0.5">match</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-slate-100 opacity-30">
                    <div className="w-9 h-9 rounded-md bg-slate-200 text-slate-400 flex items-center justify-center text-xs font-bold shrink-0">?</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-700 truncate">Full Stack Developer</div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                        <span>Shopee</span>
                        <span className="text-slate-300">·</span>
                        <span>Remote</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-base font-bold text-amber-600 tabular-nums leading-none">72</div>
                      <div className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold mt-0.5">match</div>
                    </div>
                  </div>
                </div>

                <button className="btn btn-primary w-full mt-3 text-xs">
                  <Briefcase size={13} /> Analyze your first job
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="col-span-12 xl:col-span-4 space-y-6">
            {/* Quick start / onboarding */}
            <div className="card card-pad relative overflow-hidden">
              <div
                className="absolute inset-0 opacity-30"
                style={{
                  backgroundImage:
                    'radial-gradient(circle at 100% 0%, rgba(124,58,237,0.10), transparent 50%)',
                }}
              />
              <div className="relative">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.15em] text-slate-500 font-semibold mb-3">
                  <Sparkles size={11} className="text-brand-600" />
                  Quick start
                </div>
                <ol className="space-y-2.5">
                  {[
                    { n: 1, t: 'Upload your primary resume', d: 'Build your Base Profile', active: true },
                    { n: 2, t: 'Paste a job description', d: 'AI matches your profile', active: false },
                    { n: 3, t: 'Generate tailored CV + letter', d: 'Score, improve, export', active: false },
                  ].map((s) => (
                    <li key={s.n} className="flex items-start gap-3">
                      <span
                        className={clsx(
                          'w-6 h-6 rounded-full text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5',
                          s.active
                            ? 'bg-gradient-to-br from-brand-500 to-indigo-600 text-white shadow-md shadow-brand-500/30'
                            : 'bg-slate-100 text-slate-400',
                        )}
                      >
                        {s.n}
                      </span>
                      <div>
                        <div className={clsx('text-sm font-medium', s.active ? 'text-slate-900' : 'text-slate-600')}>
                          {s.t}
                        </div>
                        <div className="text-[11px] text-slate-500">{s.d}</div>
                      </div>
                    </li>
                  ))}
                </ol>
                <button className="btn btn-primary w-full mt-4 text-xs">
                  <Upload size={13} /> Upload resume
                </button>
              </div>
            </div>

            {/* Recent activity card */}
            <div className="card card-pad">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.15em] text-slate-500 font-semibold">
                  <Activity size={11} className="text-brand-600" />
                  Recent activity
                </div>
                <span className="text-[10px] text-slate-400">last 5</span>
              </div>
              <div className="space-y-1 -mx-2">
                {RECENT_ACTIVITY.map((a, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-slate-50 transition-colors group"
                  >
                    <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-500 group-hover:bg-white group-hover:text-brand-600 group-hover:shadow-sm flex items-center justify-center transition">
                      <a.icon size={12} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-slate-700 truncate">{a.text}</div>
                      <div className="text-[10px] text-slate-400">{a.time}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 text-center">
                <button className="text-xs text-brand-600 hover:text-brand-700 font-medium">
                  View all activity →
                </button>
              </div>
            </div>

            {/* Readiness checks — compact actionable */}
            <div className="card card-pad">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.15em] text-slate-500 font-semibold mb-3">
                <CheckCircle2 size={11} className="text-brand-600" />
                System checks
              </div>
              <div className="space-y-2">
                {checkEntries.map(([k, v]) => {
                  const ok = v === 'ok';
                  const failed = v.startsWith('failed');
                  return (
                    <div
                      key={k}
                      className={clsx(
                        'flex items-start gap-2.5 px-2.5 py-2 rounded-lg border',
                        ok
                          ? 'border-emerald-100 bg-emerald-50/40'
                          : failed
                            ? 'border-rose-100 bg-rose-50/40'
                            : 'border-amber-100 bg-amber-50/40',
                      )}
                    >
                      {ok ? (
                        <CheckCircle2 size={14} className="text-emerald-500 mt-0.5 shrink-0" />
                      ) : failed ? (
                        <AlertCircle size={14} className="text-rose-500 mt-0.5 shrink-0" />
                      ) : (
                        <AlertCircle size={14} className="text-amber-500 mt-0.5 shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium text-slate-900 font-mono">{k}</div>
                        {v !== 'ok' && (
                          <div className="text-[10px] text-slate-500 mt-0.5 truncate font-mono">
                            {v.replace(/^[a-z_]+: /i, '')}
                          </div>
                        )}
                      </div>
                      {!ok && (
                        <button className="text-[10px] font-semibold text-brand-600 hover:text-brand-700 shrink-0">
                          Fix
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
