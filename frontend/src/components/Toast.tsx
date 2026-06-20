/**
 * <Toast /> — top-banner toast renderer (Phase 10A).
 *
 * Listens to `app:toast` CustomEvents (see lib/toast.ts) and renders
 * the latest one as a fixed top banner with auto-dismiss.
 *
 * Multiple toasts stack vertically with the newest on top. Click to
 * dismiss early.
 */
import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { TOAST_EVENT_NAME, type ToastEvent, type ToastType } from '../lib/toast';

interface ActiveToast extends ToastEvent {
  id: number;
}

const ICONS: Record<ToastType, typeof AlertCircle> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};

const COLORS: Record<ToastType, string> = {
  success: 'bg-green-50 border-green-200 text-green-800',
  error: 'bg-rose-50 border-rose-200 text-rose-800',
  info: 'bg-blue-50 border-blue-200 text-blue-800',
};

export default function Toast() {
  const [toasts, setToasts] = useState<ActiveToast[]>([]);

  useEffect(() => {
    let nextId = 1;
    const handler = (e: Event) => {
      const ce = e as CustomEvent<ToastEvent>;
      const { type, message, ttl = 4000 } = ce.detail;
      const id = nextId++;
      setToasts((prev) => [...prev, { id, type, message, ttl }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, ttl);
    };
    window.addEventListener(TOAST_EVENT_NAME, handler);
    return () => window.removeEventListener(TOAST_EVENT_NAME, handler);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none"
      data-testid="toast-container"
    >
      {toasts.map((t) => {
        const Icon = ICONS[t.type];
        return (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-2 px-3 py-2 rounded border shadow-sm max-w-md ${COLORS[t.type]}`}
            data-testid={`toast-${t.type}`}
            role="status"
          >
            <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span className="text-sm flex-1">{t.message}</span>
            <button
              onClick={() =>
                setToasts((prev) => prev.filter((x) => x.id !== t.id))
              }
              className="text-current opacity-60 hover:opacity-100"
              aria-label="Dismiss"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}