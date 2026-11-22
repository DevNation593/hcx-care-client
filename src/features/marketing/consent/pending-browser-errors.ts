import * as Sentry from '@sentry/nextjs';
import { isBrowserReportingAllowed } from '@/lib/monitoring/browser-gate';
import { readConsent } from './consent';

/**
 * Render errors of public pages can be raised before the browser SDK is ready: the boundary's
 * effect runs before `SentryBrowser`'s (it comes first in the layout), and during hydration
 * `useConsent` still reads 'unset'. Those errors are kept here, briefly and in memory only,
 * until `SentryBrowser` has initialized the SDK and opened the reporting gate.
 *
 * Privacy rules (SEC-WEB-09):
 * - Only the (marketing) boundary may call `reportMarketingError`; the root `error.tsx` and
 *   `global-error.tsx` keep a plain `captureException`, which the gate drops, and never queue.
 * - An error is queued only if the visitor had already accepted cookies at that moment
 *   (read synchronously from storage), so an error that happened before consent is never sent
 *   after a later acceptance.
 * - `SentryBrowser` clears the queue when it unmounts (leaving the public pages) and when
 *   consent is rejected.
 */
const MAX_PENDING = 5;

let pending: unknown[] = [];
// Errors that were already sent (objects only), so effect re-runs never report one twice.
const captured = new WeakSet<object>();

function isObject(value: unknown): value is object {
  return (typeof value === 'object' && value !== null) || typeof value === 'function';
}

function captureOnce(error: unknown): void {
  if (isObject(error)) {
    if (captured.has(error)) return;
    captured.add(error);
  }
  Sentry.captureException(error);
}

/** Reports a render error of a public page now, or queues it until reporting is ready. */
export function reportMarketingError(error: unknown): void {
  if (isObject(error) && captured.has(error)) return;
  if (Sentry.getClient() && isBrowserReportingAllowed()) {
    captureOnce(error);
    return;
  }
  // Not ready yet: keep it only if consent was already given, otherwise drop it for good.
  if (readConsent() !== 'accepted') return;
  if (pending.includes(error)) return;
  pending.push(error);
  if (pending.length > MAX_PENDING) pending.shift();
}

/** Returns the queued errors and empties the queue. */
export function drainPendingBrowserErrors(): unknown[] {
  const drained = pending;
  pending = [];
  return drained;
}

export function clearPendingBrowserErrors(): void {
  pending = [];
}

/** Sends every queued error once. Call only after the SDK is initialized and the gate is open. */
export function flushPendingBrowserErrors(): void {
  for (const error of drainPendingBrowserErrors()) captureOnce(error);
}
