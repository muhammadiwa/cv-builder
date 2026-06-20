/**
 * Toast notification helper (Phase 10A).
 *
 * Lightweight CustomEvent-based pub/sub. Fires events on `window`, and
 * ``<Toast />`` (mounted in App.tsx) listens and renders a top banner.
 *
 * Usage:
 *   import { toast } from '../lib/toast';
 *   toast.success('Template created');
 *   toast.error('Failed to save');
 *
 * Or use the underlying ``showToast(type, message, ttl?)`` directly.
 */
export type ToastType = 'success' | 'error' | 'info';

export interface ToastEvent {
  type: ToastType;
  message: string;
  /** Auto-dismiss after this many ms. Default 4000. */
  ttl?: number;
}

const TOAST_EVENT = 'app:toast';
export const TOAST_EVENT_NAME = TOAST_EVENT;

export function showToast(
  type: ToastType,
  message: string,
  ttl: number = 4000,
): void {
  const detail: ToastEvent = { type, message, ttl };
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
 * ``showToast('success', msg)`` at call sites. Wraps :func:`showToast`. */
export const toast = {
  success: (message: string, ttl?: number) => showToast('success', message, ttl),
  error: (message: string, ttl?: number) => showToast('error', message, ttl),
  info: (message: string, ttl?: number) => showToast('info', message, ttl),
};