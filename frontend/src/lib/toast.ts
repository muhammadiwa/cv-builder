/** Toast notification helper (Phase 10A).

Lightweight CustomEvent-based pub/sub. Fires events on `window`, and
``<Toast />`` (mounted in App.tsx) listens and renders a top banner.

Usage:
  import { toast } from '../lib/toast';
  toast.success('Template created');
  toast.error('Failed to save');

Or use the underlying ``showToast(type, message, opts?)`` directly.

Phase 10F: added optional ``opts.action`` so callers can attach a
small button to a toast (e.g. "Open existing" on a 409 duplicate).
*/
export type ToastType = 'success' | 'error' | 'info';

export interface ToastAction {
  /** Button label. */
  label: string;
  /** Click handler. The toast auto-dismisses after this fires. */
  onClick: () => void;
}

export interface ToastEvent {
  type: ToastType;
  message: string;
  /** Auto-dismiss after this many ms. Default 4000. */
  ttl?: number;
  /** Optional action button rendered alongside the message. */
  action?: ToastAction;
}

const TOAST_EVENT = 'app:toast';
export const TOAST_EVENT_NAME = TOAST_EVENT;

export interface ToastOptions {
  ttl?: number;
  action?: ToastAction;
}

export function showToast(
  type: ToastType,
  message: string,
  opts: number | ToastOptions = {},
): void {
  const normalized: ToastOptions =
    typeof opts === 'number' ? { ttl: opts } : opts;
  const detail: ToastEvent = {
    type,
    message,
    ttl: normalized.ttl ?? 4000,
    action: normalized.action,
  };
  // In environments without a listener (tests, SSR), fall back to
  // console so messages aren't silently dropped.
  window.dispatchEvent(new CustomEvent<ToastEvent>(TOAST_EVENT, { detail }));
  if (type === 'error') {
    // Always log errors so they're visible in DevTools even if the
    // toast UI isn't mounted yet.
    // eslint-disable-next-line no-console
    console.error('[toast]', message);
  }
}

/** Shorthand object — ``toast.success(msg)`` reads cleaner than
``showToast('success', msg)`` at call sites. Wraps :func:`showToast`. */
export const toast = {
  success: (message: string, opts: number | ToastOptions = {}) =>
    showToast('success', message, opts),
  error: (message: string, opts: number | ToastOptions = {}) =>
    showToast('error', message, opts),
  info: (message: string, opts: number | ToastOptions = {}) =>
    showToast('info', message, opts),
};
