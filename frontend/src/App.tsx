import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  User,
  Briefcase,
  FileText,
  Mail,
  CheckSquare,
  Layers,
  Brain,
  Settings as SettingsIcon,
  Search,
  Sparkles,
} from 'lucide-react';
import clsx from 'clsx';

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/profile', label: 'Profile', icon: User },
  { to: '/jobs', label: 'Job Matching', icon: Briefcase },
  { to: '/cv-drafts', label: 'CV Drafts', icon: FileText },
  { to: '/cover-letters', label: 'Cover Letters', icon: Mail },
  { to: '/applications', label: 'Applications', icon: CheckSquare },
  { to: '/templates', label: 'Templates', icon: Layers },
  { to: '/prompts', label: 'AI Prompts', icon: Brain },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
];

export default function App() {
  return (
    <div className="min-h-screen flex">
      {/* Sidebar — darker for app-shell feel */}
      <aside className="w-64 bg-slate-950 text-slate-300 flex flex-col">
        {/* Brand */}
        <div className="px-5 pt-5 pb-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-brand-500/30">
              <Sparkles size={16} className="text-white" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white leading-tight">AI CV ATS</div>
              <div className="text-[10px] uppercase tracking-[0.15em] text-slate-500 font-semibold">
                Builder
              </div>
            </div>
          </div>
        </div>

        {/* Search hint */}
        <div className="px-3 mb-3">
          <div className="flex items-center gap-2 px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-md text-xs text-slate-500">
            <Search size={12} />
            <span>Jump to…</span>
            <kbd className="ml-auto px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-[10px] font-mono text-slate-400">
              ⌘K
            </kbd>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-colors',
                  isActive
                    ? 'bg-slate-800/80 text-white font-medium shadow-inner'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute -ml-3 w-0.5 h-5 bg-brand-500 rounded-r" />
                  )}
                  <n.icon size={15} className="shrink-0" />
                  <span>{n.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-900 text-[10px] text-slate-600 flex items-center justify-between">
          <span>v0.1.0 · MVP</span>
          <span className="text-slate-500">⌘K menu</span>
        </div>
      </aside>

      <main className="flex-1 bg-slate-50 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
