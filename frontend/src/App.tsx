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
    <div className="min-h-screen flex bg-white">
      {/* Sidebar — softer dark, narrower, less heavy */}
      <aside className="w-56 bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800">
        {/* Brand */}
        <div className="px-4 pt-4 pb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-gradient-to-br from-brand-500 to-indigo-600 flex items-center justify-center">
              <Sparkles size={14} className="text-white" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white leading-tight">AI CV ATS</div>
              <div className="text-[9px] uppercase tracking-[0.15em] text-slate-500 font-semibold">
                Builder
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2.5 space-y-0.5 overflow-y-auto">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] transition-colors',
                  isActive
                    ? 'bg-slate-800 text-white font-medium'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60',
                )
              }
            >
              <n.icon size={15} className="shrink-0" />
              <span>{n.label}</span>
            </NavLink>
          ))}
        </nav>

        </aside>

      <main className="flex-1 bg-slate-50 overflow-y-auto">
        <div className="max-w-screen-2xl mx-auto px-8 py-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
