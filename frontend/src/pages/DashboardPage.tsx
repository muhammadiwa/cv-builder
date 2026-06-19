import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useState, useEffect, useMemo } from 'react';
import clsx from 'clsx';
import {
  Search,
  CheckCircle2,
  Upload,
  FileText,
  Briefcase,
  Sparkles,
} from 'lucide-react';

type HealthResp = { status: string; service: string; version: string; environment: string };

// ── Sub-components ──────────────────────────────────────────────

function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <div
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      className="rounded-full bg-gradient-to-br from-brand-500 to-indigo-600 text-white font-semibold flex items-center justify-center shrink-0"
    >
      {initials}
    </div>
  );
}

function StatusDot({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span
        className={clsx(
          'w-1.5 h-1.5 rounded-full',
          ok ? 'bg-emerald-500' : 'bg-slate-300',
        )}
      />
      <span className="text-slate-600">{label}</span>
    </span>
  );
}

// ── Main page ──────────────────────────────────────────────────

const SAMPLE_MATCHES = [
  { title: 'Senior Backend Engineer', company: 'Bukalapak', location: 'Jakarta', match: 87, tier: 'hot', days: 1 },
  { title: 'Full Stack Developer', company: 'Shopee', location: 'Remote', match: 72, tier: 'warm', days: 2 },
  { title: 'Backend Engineer (Fintech)', company: 'Dana', location: 'Jakarta', match: 65, tier: 'warm', days: 3 },
  { title: 'Senior Python Developer', company: 'Tiket.com', location: 'Bandung', match: 58, tier: 'cold', days: 5 },
  { title: 'Backend Engineer (Intern)', company: 'StartupABC', location: 'Jakarta', match: 47, tier: 'cold', days: 6 },
];

const TIER_STYLES: Record<string, string> = {
  hot: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warm: 'bg-amber-50 text-amber-700 border-amber-200',
  cold: 'bg-slate-100 text-slate-600 border-slate-200',
};

const SAMPLE_ACTIVITY = [
  { text: 'Applied to Senior Backend Engineer at Bukalapak', time: '2h ago', icon: Briefcase },
  { text: 'CV draft v3 generated for Xendit', time: '4h ago', icon: FileText },
  { text: 'Resume parsed and Base Profile created', time: '1d ago', icon: Sparkles },
];

export default function DashboardPage() {
  const health = useQuery({
    queryKey: ['health'],
    queryFn: async () => (await api.get<HealthResp>('/health')).data,
    refetchInterval: 30_000,
  });

  const online = health.data?.status === 'healthy';

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* ── Header (compact, NOT a hero) ──────────────────────── */}
      <div className="flex items-center justify-between gap-6 flex-wrap pt-2">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 tracking-tight">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Build a tailored CV for each job in minutes, not hours.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusDot ok={online} label={online ? 'Backend online' : 'Offline'} />
        </div>
      </div>

      {/* ── Profile banner (single, compact) ──────────────────── */}
      <div className="card card-pad flex items-center gap-4">
        <Avatar name="Mohammad Pratama" size={48} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-slate-900">Mohammad Pratama</h2>
            <span className="text-xs text-slate-500">·</span>
            <span className="text-xs text-slate-600">Senior Backend Engineer</span>
          </div>
          <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
            <span>📍 Jakarta</span>
            <span>·</span>
            <span>6 years experience</span>
            <span>·</span>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
              <span>⚠</span> Base Profile not uploaded
            </span>
          </div>
        </div>
        <a href="/profile" className="text-xs text-brand-600 hover:text-brand-700 font-medium shrink-0">
          Set up →
        </a>
      </div>

      {/* ── Two-column: jobs (left, 8/12) + sidebar (right, 4/12) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT — Top job matches (the actual product) */}
        <section className="lg:col-span-8 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Top job matches</h3>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500">5 sample matches</span>
              <button className="text-xs text-brand-600 hover:text-brand-700 font-medium">
                View all →
              </button>
            </div>
          </div>

          {SAMPLE_MATCHES.map((m, i) => (
            <article
              key={i}
              className="card card-pad hover:border-slate-300 hover:shadow-sm transition cursor-pointer"
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                  <Briefcase size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <h4 className="text-sm font-semibold text-slate-900 truncate">{m.title}</h4>
                    <span className="text-xs text-slate-500 truncate">@ {m.company}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                    <span>📍 {m.location}</span>
                    <span>·</span>
                    <span>{m.days}d ago</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div
                    className={clsx(
                      'text-2xl font-bold tabular-nums leading-none',
                      m.tier === 'hot' ? 'text-emerald-600' : m.tier === 'warm' ? 'text-amber-600' : 'text-slate-500',
                    )}
                  >
                    {m.match}
                  </div>
                  <div
                    className={clsx(
                      'text-[9px] uppercase tracking-wider font-semibold mt-1 px-1.5 py-0.5 rounded border',
                      TIER_STYLES[m.tier],
                    )}
                  >
                    {m.tier}
                  </div>
                </div>
              </div>
              {/* mini match bar */}
              <div className="mt-3 h-1 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={clsx(
                    'h-full rounded-full',
                    m.tier === 'hot' ? 'bg-emerald-500' : m.tier === 'warm' ? 'bg-amber-500' : 'bg-slate-400',
                  )}
                  style={{ width: `${m.match}%` }}
                />
              </div>
            </article>
          ))}
        </section>

        {/* RIGHT — onboarding + activity */}
        <aside className="lg:col-span-4 space-y-6">
          {/* Onboarding card */}
          <section className="card card-pad">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Get started</h3>
            <ol className="space-y-2.5 text-sm">
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-gradient-to-br from-brand-500 to-indigo-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  1
                </span>
                <div>
                  <div className="font-medium text-slate-900">Upload your resume</div>
                  <div className="text-xs text-slate-500">Build your Base Profile</div>
                </div>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-400 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  2
                </span>
                <div>
                  <div className="text-slate-600">Paste a job description</div>
                  <div className="text-xs text-slate-400">AI matches your profile</div>
                </div>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-400 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  3
                </span>
                <div>
                  <div className="text-slate-600">Generate CV + letter</div>
                  <div className="text-xs text-slate-400">Score, improve, export</div>
                </div>
              </li>
            </ol>
            <button className="btn btn-primary w-full mt-4 text-xs">
              <Upload size={13} /> Upload your first resume
            </button>
          </section>

          {/* Activity feed */}
          <section className="card card-pad">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Recent activity</h3>
            <div className="space-y-2.5">
              {SAMPLE_ACTIVITY.map((a, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-md bg-slate-100 text-slate-500 flex items-center justify-center shrink-0 mt-0.5">
                    <a.icon size={12} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-slate-700 leading-snug">{a.text}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{a.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Tips card to balance height */}
          <section className="card card-pad bg-gradient-to-br from-brand-50 to-indigo-50 border-brand-100">
            <h3 className="text-sm font-semibold text-slate-900 mb-2">💡 Pro tip</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Tailoring your CV to each job's keywords increases ATS pass rate by
              <span className="font-semibold text-brand-700"> ~60%</span>. Use the
              match score as a starting point, then refine with the improvement suggestions.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
