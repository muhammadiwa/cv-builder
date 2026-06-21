import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  User,
  Briefcase,
  FileText,
  Mail,
  Layers,
  Settings as SettingsIcon,
  Sparkles,
  Menu,
  X,
} from 'lucide-react';
import clsx from 'clsx';
import Toast from './components/Toast';

// ── Nav definition ────────────────────────────────────────────────
// Single source of truth for sidebar items + route paths.
// Keep keys in sync with router.tsx.
const nav: Array<{
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
}> = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/profile', label: 'Profile', icon: User },
  { to: '/jobs', label: 'Job Matching', icon: Briefcase },
  { to: '/cv-drafts', label: 'CV Drafts', icon: FileText },
  { to: '/cover-letters', label: 'Cover Letters', icon: Mail },
  { to: '/templates', label: 'Templates', icon: Layers },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
];

// ── Layout shell ──────────────────────────────────────────────────
// h-screen + overflow-hidden locks the outer container to the viewport.
// Sidebar and main each manage their own internal scroll, so neither
// can "scroll the other". On mobile (< lg), sidebar collapses into a
// drawer that slides in from the left.
export default function App() {
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close drawer on route change (any click on a NavLink).
  useEffect(() => {
    if (!mobileOpen) return;
    const close = () => setMobileOpen(false);
    window.addEventListener('popstate', close);
    return () => window.removeEventListener('popstate', close);
  }, [mobileOpen]);

  // Close drawer on Escape (a11y).
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  const SidebarContent = (
    <>
      {/* Brand */}
      <div className="px-4 pt-5 pb-6 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-gradient-to-br from-brand-500 to-indigo-600 flex items-center justify-center shrink-0">
            <Sparkles size={14} className="text-white" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white leading-tight truncate">
              AI CV ATS
            </div>
            <div className="text-[9px] uppercase tracking-[0.15em] text-slate-500 font-semibold">
              Builder
            </div>
          </div>
        </div>
      </div>

      {/* Nav (own scroll if it ever overflows) */}
      <nav
        className="flex-1 px-2.5 pb-4 space-y-0.5 overflow-y-auto"
        aria-label="Main"
      >
        {nav.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] transition-colors',
                isActive
                  ? 'bg-slate-800 text-white font-medium'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60',
              )
            }
          >
            <n.icon size={15} className="shrink-0" />
            <span className="truncate">{n.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Footer hint — small, low priority */}
      <div className="px-4 py-3 border-t border-slate-800 shrink-0">
        <div className="text-[10px] text-slate-500 leading-relaxed">
          v1.0 · MVP
        </div>
      </div>
    </>
  );

  return (
    <div className="h-screen flex bg-slate-50 overflow-hidden">
      {/* ── Mobile drawer backdrop ──────────────────────────────── */}
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden cursor-default"
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────────────── */}
      {/* Mobile: slide-in drawer. Desktop: always visible, fixed left. */}
      <aside
        className={clsx(
          'bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800',
          // Mobile: drawer, transforms
          'fixed inset-y-0 left-0 z-50 w-64 transition-transform duration-200 ease-out',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          // Desktop: static in flex flow, no transform
          'lg:static lg:translate-x-0 lg:w-56 lg:z-auto lg:shrink-0',
        )}
        aria-label="Sidebar navigation"
      >
        {/* Mobile-only close button */}
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="lg:hidden absolute top-3 right-3 p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800"
          aria-label="Close menu"
        >
          <X size={16} />
        </button>
        {SidebarContent}
      </aside>

      {/* ── Main column ─────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile topbar — hamburger + brand (hidden on desktop) */}
        <header className="lg:hidden h-14 bg-white border-b border-slate-200 flex items-center px-4 gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="p-1.5 -ml-1.5 rounded-md text-slate-600 hover:bg-slate-100"
            aria-label="Open navigation"
            aria-expanded={mobileOpen}
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded bg-gradient-to-br from-brand-500 to-indigo-600 flex items-center justify-center shrink-0">
              <Sparkles size={12} className="text-white" />
            </div>
            <span className="text-sm font-semibold text-slate-900 truncate">
              AI CV ATS
            </span>
          </div>
        </header>

        {/* Scrollable page area. min-w-0 prevents flex children from
            forcing horizontal overflow at narrow viewports. */}
        <main className="flex-1 overflow-y-auto min-w-0">
          <div className="page-shell">
            <Outlet />
          </div>
        </main>
      </div>

      <Toast />
    </div>
  );
}