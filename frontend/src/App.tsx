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
      <aside className="w-60 bg-white border-r border-slate-200 p-4 flex flex-col">
        <div className="text-lg font-semibold text-brand-700 mb-6 leading-tight">
          AI CV ATS
          <div className="text-xs text-slate-500 font-normal">Builder</div>
        </div>
        <nav className="flex flex-col gap-1 flex-1">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-2 px-3 py-2 rounded-lg text-sm',
                  isActive
                    ? 'bg-brand-50 text-brand-700 font-medium'
                    : 'text-slate-600 hover:bg-slate-100',
                )
              }
            >
              <n.icon size={16} /> {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto text-xs text-slate-400">v0.1.0 · MVP</div>
      </aside>
      <main className="flex-1 p-8 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
