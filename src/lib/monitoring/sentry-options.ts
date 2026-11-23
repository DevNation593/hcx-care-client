import axios from 'axios';
import { isMarkedApiError } from './api-error-marker';
import { isBrowserReportingAllowed } from './browser-gate';
import { scrubSamplingMetadata } from './sentry-envelope';
import {
  parametrizedFrameFile,
  parametrizedLocation,
  parametrizedTransactionName,
} from './sentry-route';
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
    // Browser, server and edge never sample by default, whatever a request or a `<meta
    // name="sentry-trace">` says: with `tracesSampleRate: 0` the SDK still inherits the sampling
    // decision of an incoming trace, so anyone could force a transaction (with the full URL and
    // headers of the request) by sending `sentry-trace: <id>-<id>-1`. The server and the edge keep
    // this at any rate: tracing lives in the browser only (`buildBrowserSentryOptions`).
    tracesSampler: () => 0,
    beforeSendTransaction: () => null,
    // At any rate, in the browser, the server and the edge: no `sentry-trace` or `baggage` header on
    // any outgoing request. By default the SDK adds them (to every destination on the server, to the
    // same origin in the browser) even when the trace is not sampled.
    tracePropagationTargets: [],
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    sendDefaultPii: false,
    beforeBreadcrumb: scrubBreadcrumb,
    beforeSend: scrubEvent,
  };
}

/** Categories that can carry request URLs or bodies and logged patient data. */
const DROPPED_BREADCRUMB_CATEGORIES = new Set(['http', 'fetch', 'xhr', 'console']);

/**
 * Every `ui.*` breadcrumb is dropped: `ui.click` carries the CSS selector of the element,
 * including aria-label/title/name/alt, which the app fills with patient names and answers.
 */
function isDroppedCategory(category: string | undefined): boolean {
  return !!category && (category.startsWith('ui.') || DROPPED_BREADCRUMB_CATEGORIES.has(category));
}

/** Breadcrumb data that holds a page or request location. */
const BREADCRUMB_LOCATION_KEYS = ['from', 'to', 'url'] as const;

/**
 * Drops the breadcrumbs that can carry data and parametrizes the location of the rest: a navigation
 * breadcrumb names the pages the user went through (`/verify/<code>`, `/patients/<id>`), so `from`,
 * `to` and `url` keep the route (`/verify/:param`) and lose ids, codes, query string and fragment.
 * What covers a value is the shape heuristic plus `DYNAMIC_ROUTES` (the pages of the app and
 * `/public/documents/<code>`): an id of any other API URL written in lowercase letters would pass.
 * Such URLs do not get here today, because the `http`, `fetch` and `xhr` breadcrumbs are dropped.
 * Used as `beforeBreadcrumb` and again over `event.breadcrumbs` in `scrubEvent`.
 */
function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  // Browser only: while the gate is closed (outside the public pages) nothing is recorded, so
  // dashboard navigation can never be attached to a later event.
  if (typeof window !== 'undefined' && !isBrowserReportingAllowed()) return null;
  if (isDroppedCategory(breadcrumb.category)) return null;
  if (!breadcrumb.data) return breadcrumb;
  const data = { ...breadcrumb.data };
  for (const key of BREADCRUMB_LOCATION_KEYS) {
    if (typeof data[key] === 'string') data[key] = parametrizedLocation(data[key]);
  }
  return { ...breadcrumb, data };
}

/**
 * Removes everything that could carry patient data or credentials before an
 * event leaves the browser. Returns null to discard the event. Never throws:
 * if scrubbing itself fails, the sensitive parts are dropped instead of
 * sending the event untouched.
 *
 * In the browser nothing leaves unless the reporting gate is open (public pages with cookie
 * consent, SEC-WEB-09). Server and edge have no `window` and are not gated.
 */
export function scrubEvent(event: ErrorEvent, hint?: EventHint): ErrorEvent | null {
  if (typeof window !== 'undefined' && !isBrowserReportingAllowed()) return null;
  try {
    // The API reports its own 5xx and 4xx are expected: reporting them here would duplicate.
    // The API client rejects with marked plain ApiError objects; AxiosError is kept as well.
    const original = hint?.originalException;
    if (axios.isAxiosError(original) || isMarkedApiError(original)) return null;

    scrubRequest(event);
    scrubRoute(event);
    scrubUser(event);
    // `extra` holds the whole object when something that is not an Error is thrown.
    delete event.extra;
    scrubFrames(event);
    // The `trace` header of the envelope is copied from here: no route, no request, no scopes.
    scrubSamplingMetadata(event);
  } catch {
    delete event.request;
    delete event.transaction;
    delete event.breadcrumbs;
    delete event.tags;
    delete event.user;
    delete event.extra;
    delete event.sdkProcessingMetadata;
    try {
      if (event.contexts) delete event.contexts.nextjs;
    } catch {
      delete event.contexts;
    }
    try {
      scrubFrames(event);
    } catch {
      delete event.exception;
      delete event.threads;
    }
  }
  return event;
}

/**
 * Every frame of every exception (chained ones are more entries of `values`) and of every thread:
 * no variables, and the page URL of the frames that are not a file of the build parametrized.
 */
function scrubFrames(event: ErrorEvent): void {
  const stacktraces = [
    ...(event.exception?.values ?? []).map((exception) => exception.stacktrace),
    ...(event.threads?.values ?? []).map((thread) => thread.stacktrace),
  ];
  for (const stacktrace of stacktraces) {
    for (const frame of stacktrace?.frames ?? []) {
      delete frame.vars;
      if (typeof frame.filename === 'string') frame.filename = parametrizedFrameFile(frame.filename);
      if (typeof frame.abs_path === 'string') frame.abs_path = parametrizedFrameFile(frame.abs_path);
    }
  }
}

function scrubRequest(event: ErrorEvent): void {
  const request = event.request;
  if (!request) return;

  delete request.data;
  delete request.cookies;
  delete request.headers;
  delete request.query_string;
  // Origin and parametrized route only: ids and codes in the path identify a patient or a document
  // (`/verify/<code>` answers, without a session, who the patient and the professional are), and
  // the query string and the fragment can carry search terms, names or tokens.
  if (typeof request.url === 'string') request.url = parametrizedLocation(request.url);
}

/**
 * The route the error happened on: `transaction` (and the `transaction` tag some SDKs copy from it),
 * the path of the request of `onRequestError` and the breadcrumbs, which `beforeBreadcrumb` already filtered when they were recorded.
 */
function scrubRoute(event: ErrorEvent): void {
  if (typeof event.transaction === 'string') {
    event.transaction = parametrizedTransactionName(event.transaction);
  }
  if (typeof event.tags?.transaction === 'string') {
    event.tags.transaction = parametrizedTransactionName(event.tags.transaction);
  }
  // Set by `captureRequestError` (the `onRequestError` hook of Next) with the path of the request.
  const nextjs = event.contexts?.nextjs;
  if (typeof nextjs?.request_path === 'string') {
    nextjs.request_path = parametrizedLocation(nextjs.request_path);
  }
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs
      .map(scrubBreadcrumb)
      .filter((breadcrumb): breadcrumb is Breadcrumb => breadcrumb !== null);
  }
}

function scrubUser(event: ErrorEvent): void {
  if (!event.user) return;

  if (event.user.id !== undefined && event.user.id !== null) {
    event.user = { id: event.user.id };
  } else {
    delete event.user;
  }
}
