import axios from 'axios';
import type { Breadcrumb, BrowserOptions, ErrorEvent, EventHint } from '@sentry/nextjs';

/**
 * Sentry options for the web app: errors only, minimum data (clinical SaaS).
 *
 * Returns null when there is no DSN so Sentry is never initialized in local
 * runs, CI or tests.
 */
export function buildSentryOptions(env: {
  dsn?: string;
  environment?: string;
}): BrowserOptions | null {
  const dsn = env.dsn?.trim();
  if (!dsn) return null;

  return {
    dsn,
    environment: env.environment || 'development',
    tracesSampleRate: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    sendDefaultPii: false,
    beforeBreadcrumb: filterBreadcrumb,
    beforeSend: scrubEvent,
  };
}

/** Categories that can carry what the user typed, request bodies or logged patient data. */
const DROPPED_BREADCRUMB_CATEGORIES = new Set(['ui.input', 'fetch', 'xhr', 'console']);

function filterBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  if (breadcrumb.category && DROPPED_BREADCRUMB_CATEGORIES.has(breadcrumb.category)) return null;
  if (breadcrumb.category === 'navigation' && breadcrumb.data) {
    const data = { ...breadcrumb.data };
    for (const key of ['from', 'to'] as const) {
      if (typeof data[key] === 'string') data[key] = stripQueryAndFragment(data[key]);
    }
    return { ...breadcrumb, data };
  }
  return breadcrumb;
}

/** Query strings and fragments can carry search terms, names or tokens. */
function stripQueryAndFragment(url: string): string {
  const end = url.search(/[?#]/);
  return end === -1 ? url : url.slice(0, end);
}

/**
 * Removes everything that could carry patient data or credentials before an
 * event leaves the browser. Returns null to discard the event. Never throws:
 * if scrubbing itself fails, the sensitive parts are dropped instead of
 * sending the event untouched.
 */
export function scrubEvent(event: ErrorEvent, hint?: EventHint): ErrorEvent | null {
  try {
    // The API reports its own 5xx and 4xx are expected: reporting them here would duplicate.
    if (axios.isAxiosError(hint?.originalException)) return null;

    scrubRequest(event);
    scrubUser(event);
    // `extra` holds the whole object when something that is not an Error is thrown.
    delete event.extra;
  } catch {
    delete event.request;
    delete event.user;
    delete event.extra;
  }
  return event;
}

function scrubRequest(event: ErrorEvent): void {
  const request = event.request;
  if (!request) return;

  delete request.data;
  delete request.cookies;
  delete request.headers;
  delete request.query_string;
  if (typeof request.url === 'string') request.url = stripQueryAndFragment(request.url);
}

function scrubUser(event: ErrorEvent): void {
  if (!event.user) return;

  if (event.user.id !== undefined && event.user.id !== null) {
    event.user = { id: event.user.id };
  } else {
    delete event.user;
  }
}
