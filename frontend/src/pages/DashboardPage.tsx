import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Activity, Database } from 'lucide-react';

type HealthResp = { status: string; service: string; version: string; environment: string };
type ReadyResp = { status: string; checks: Record<string, string> };

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
  const [pingMs, setPingMs] = useState<number | null>(null);

  useEffect(() => {
    const t0 = performance.now();
    api.get('/health').then(() => setPingMs(Math.round(performance.now() - t0)));
  }, []);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">
          AI-powered CV builder tuned for ATS screening. Personal use — single user.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card card-pad">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500 font-medium">
                Backend
              </div>
              <div className="text-lg font-bold mt-1 flex items-center gap-2">
                {health.data?.status === 'healthy' ? (
                  <>
                    <CheckCircle2 size={18} className="text-emerald-600" />
                    Online
                  </>
                ) : (
                  <>
                    <AlertCircle size={18} className="text-rose-600" />
                    {health.isLoading ? 'Checking…' : 'Offline'}
                  </>
                )}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {health.data?.service} v{health.data?.version}
              </div>
            </div>
            <Activity size={20} className="text-slate-400" />
          </div>
        </div>

        <div className="card card-pad">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500 font-medium">
                API ping
              </div>
              <div className="text-lg font-bold mt-1">
                {pingMs != null ? `${pingMs} ms` : 'measuring…'}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Round-trip GET /api/health
              </div>
            </div>
            <Database size={20} className="text-slate-400" />
          </div>
        </div>

        <div className="card card-pad">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500 font-medium">
                Readiness
              </div>
              <div className="text-lg font-bold mt-1 flex items-center gap-2">
                {ready.data?.status === 'ready' ? (
                  <>
                    <CheckCircle2 size={18} className="text-emerald-600" />
                    Ready
                  </>
                ) : (
                  <>
                    <AlertCircle size={18} className="text-amber-600" />
                    Degraded
                  </>
                )}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {ready.data ? Object.keys(ready.data.checks).length : 0} checks
              </div>
            </div>
            <CheckCircle2 size={20} className="text-slate-400" />
          </div>
        </div>
      </div>

      <div className="card card-pad">
        <h2 className="section-title">Phase 0 — Foundation</h2>
        <ul className="space-y-2 text-sm text-slate-700">
          <li>✅ Backend skeleton (FastAPI + 15 ORM tables + health endpoints)</li>
          <li>✅ Frontend skeleton (Vite + React + Tailwind + sidebar nav + Dashboard)</li>
          <li>⏳ Phase 1 — AI provider abstraction + LLM-as-narrator pattern</li>
          <li>⏳ Phase 2 — Resume upload (PDF/DOCX → text → Base Profile)</li>
          <li>⏳ Phase 3 — Base Profile editor + version history</li>
          <li>⏳ Phase 4 — Job URL/manual JD → text → analyze</li>
          <li>⏳ Phase 5 — Matching engine (deterministic + LLM narrative)</li>
          <li>⏳ Phase 6 — CV generator (template + LLM filler)</li>
          <li>⏳ Phase 7 — CV scoring + recommendation</li>
          <li>⏳ Phase 8 — Apply improvement + re-score</li>
          <li>⏳ Phase 9 — Cover letter</li>
          <li>⏳ Phase 10 — Export PDF + DOCX</li>
          <li>⏳ Phase 11 — Application tracking</li>
          <li>⏳ Phase 12 — AI Prompt Manager + Settings polish</li>
        </ul>
      </div>

      {ready.data && (
        <div className="card card-pad">
          <h2 className="section-title">Readiness checks</h2>
          <div className="space-y-1 text-sm">
            {Object.entries(ready.data.checks).map(([k, v]) => (
              <div key={k} className="flex items-center gap-2 font-mono text-xs">
                <span
                  className={
                    v === 'ok'
                      ? 'text-emerald-600'
                      : v.startsWith('failed')
                        ? 'text-rose-600'
                        : 'text-amber-600'
                  }
                >
                  {v === 'ok' ? '✓' : '⚠'} {k}
                </span>
                {v !== 'ok' && <span className="text-slate-500">— {v}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
