/**
 * Toast notification helper (Phase 10A).
 *
 * Lightweight CustomEvent-based pub/sub. Fires events on `window`, and
 * ``<Toast />`` (mounted in App.tsx) listens and renders a top banner.
 *
 * Usage:
 *   import { showToast } from '../lib/toast';
 *   showToast('success', 'Template created');
 *   showToast('error', 'Failed to save');
 */
export type ToastType = 'success' | 'error' | 'info';

export interface ToastEvent {
  type: ToastType;
  message: string;
  /** Auto-dismiss after this many ms. Default 4000. */
  ttl?: number;
}

const TOAST_EVENT = 'app:toast';

export function showToast(
  type: ToastType,
  message: string,
  ttl = 4000
): void {
  // In environments without a listener (tests, SSR), fall back to
  // console so messages aren't silently dropped.
  const detail: ToastEvent = { type, message, ttl };
  window.dispatchEvent(new CustomEvent<ToastEvent>(TOAST_EVENT, { detail }));
  if (type === 'error') {
    // Always log errors so they're visible in DevTools even if the
    // toast UI isn't mounted yet.
    // eslint-disable-next-line no-console
    console.error('[toast]', message);
  }
}

export const TOAST_EVENT_NAME = TOAST_EVENT;