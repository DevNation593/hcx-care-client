import type { Event } from '@sentry/nextjs';
import { pickAllowed, scrubSamplingMetadata } from './sentry-envelope';

/**
 * Web Vitals of real users (LCP, INP, CLS, TTFB, FCP) through Sentry tracing.
 *
 * Privacy first (clinical SaaS): the browser sees patient ids in URLs, patient names in the DOM and
 * the API URLs it calls. A page transaction therefore leaves the browser only after
 * `scrubTransaction` rebuilt it from an allowlist: the parametrized route (`/patients/:id`),
 * durations, the vitals and nothing else. No URL with ids, query string, fragment, headers, cookies,
 * user, element selectors or text, resource URLs or API requests.
 */

type SpanJson = NonNullable<Event['spans']>[number];

const RATE_PATTERN = /^(?:\d+(?:\.\d+)?|\.\d+)$/;

/**
 * `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE`: a number in (0, 1]. Absent, empty, malformed, negative or
 * greater than 1 means 0 (tracing off): a typo must never switch sampling on at 100%.
 */
export function parseTracesSampleRate(raw: string | undefined): number {
  const text = raw?.trim();
  if (!text || !RATE_PATTERN.test(text)) return 0;
  const rate = Number(text);
  return rate > 0 && rate <= 1 ? rate : 0;
}

const UNMATCHED = '<unmatched route>';

/** A word of a static route (`patients`, `como-funciona`). */
const STATIC_SEGMENT = /^[a-z][a-z-]*$/;
/** A parameter of the route manifest (`:id`, `:slug*`) or of a Next route (`[id]`, `[...slug]`). */
const PARAM_SEGMENT =
  /^(?::[A-Za-z_][A-Za-z0-9_]*[*?]*|\[{1,2}(?:\.{3})?[A-Za-z_][A-Za-z0-9_]*\]{1,2})$/;
/**
 * Lowercase words joined by two or more hyphens look like a verification code
 * (`abcd-efgh-jkmn-pqrs`), not like a route: they are parameters unless they are one of the few
 * static pages of the app with a name like that.
 */
const CODE_LIKE_SEGMENT = /^[a-z0-9]+(?:-[a-z0-9]+){2,}$/;
const KNOWN_LONG_ROUTES: ReadonlySet<string> = new Set(['casos-de-exito', 'tratamiento-de-datos']);

function isRouteWord(segment: string): boolean {
  if (!STATIC_SEGMENT.test(segment)) return false;
  return !CODE_LIKE_SEGMENT.test(segment) || KNOWN_LONG_ROUTES.has(segment);
}

/**
 * Keeps the words of a route and replaces anything else (a UUID, a verification code, a number, an
 * encoded value) with `:param`, so a raw path that no route pattern matched cannot leak an id.
 * Query string and fragment are always removed.
 */
export function parametrizePath(path: string): string {
  const clean = path.split(/[?#]/)[0];
  const segments = clean
    .split('/')
    .map((segment) =>
      segment === '' || isRouteWord(segment) || PARAM_SEGMENT.test(segment) ? segment : ':param',
    );
  return segments.join('/') || '/';
}

function pathOf(nameOrUrl: string): string {
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(nameOrUrl)) return nameOrUrl;
  try {
    return new URL(nameOrUrl).pathname;
  } catch {
    return UNMATCHED;
  }
}

function parametrizedName(name: string | undefined): string {
  if (!name) return UNMATCHED;
  const path = pathOf(name);
  return path.startsWith('/') ? parametrizePath(path) : UNMATCHED;
}

/** `https://app.example.com/patients/abc?x=1#y` becomes `https://app.example.com/patients/:param`. */
function parametrizedUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parametrizePath(parsed.pathname)}`;
  } catch {
    return undefined;
  }
}

/**
 * Data of the root span and of the spans kept. Only numbers and constants of the SDK: the vitals
 * attributes that name elements or URLs (`lcp.element`, `lcp.url`, `cls.source.*`) are not here.
 */
const SPAN_DATA_KEYS: ReadonlySet<string> = new Set([
  'sentry.op',
  'sentry.origin',
  'sentry.source',
  'sentry.sample_rate',
  'sentry.exclusive_time',
  'sentry.idle_span_finish_reason',
  'navigation.type',
  'browser.web_vital.lcp.value',
  'browser.web_vital.cls.value',
  'browser.web_vital.fcp.value',
  'browser.web_vital.ttfb.value',
  'browser.web_vital.inp.value',
  'release',
  'environment',
]);

const BROWSER_SPAN_OP = /^browser\./;

/**
 * A child span survives only if it times a phase of the page load (`browser.request`,
 * `browser.response`, `browser.domContentLoadedEvent`...). Resource spans are named with the full
 * URL of the asset or the API request, and `ui.*` spans with the element: both are dropped.
 */
function isKeptSpan(span: SpanJson): boolean {
  return !!span.op && BROWSER_SPAN_OP.test(span.op);
}

function cleanMeasurements(measurements: unknown): Record<string, unknown> | undefined {
  if (!measurements || typeof measurements !== 'object') return undefined;
  const clean: Record<string, unknown> = {};
  for (const [name, entry] of Object.entries(measurements)) {
    const { value, unit } = (entry ?? {}) as {
      value?: unknown;
      unit?: unknown;
    };
    if (typeof value === 'number' && Number.isFinite(value)) {
      clean[name] = typeof unit === 'string' ? { value, unit } : { value };
    }
  }
  return clean;
}

/** Sentry also passes the root span of a transaction (named after its route) through `beforeSendSpan`. */
function isPageSpan(span: SpanJson): boolean {
  return span.op === 'pageload' || span.op === 'navigation';
}

/**
 * The description of a span is replaced by its op: the standalone INP span is named after the element
 * that was clicked (`button[aria-label="Ana Pérez"]`) and a phase span after the page URL.
 */
function scrubSpanJson(span: SpanJson): SpanJson {
  const scrubbed: SpanJson = {
    span_id: span.span_id,
    trace_id: span.trace_id,
    start_timestamp: span.start_timestamp,
    data: pickAllowed(span.data, SPAN_DATA_KEYS) as SpanJson['data'],
  };
  if (span.parent_span_id) scrubbed.parent_span_id = span.parent_span_id;
  if (span.timestamp !== undefined) scrubbed.timestamp = span.timestamp;
  if (span.op) scrubbed.op = span.op;
  // The root span (page load or navigation) is named after the route; any other span after its op.
  const description = isPageSpan(span) ? parametrizedName(span.description) : span.op;
  if (description) scrubbed.description = description;
  if (span.status) scrubbed.status = span.status;
  if (span.origin) scrubbed.origin = span.origin;
  if (span.exclusive_time !== undefined) scrubbed.exclusive_time = span.exclusive_time;
  if (span.is_segment !== undefined) scrubbed.is_segment = span.is_segment;
  const measurements = cleanMeasurements(span.measurements);
  if (measurements && Object.keys(measurements).length) {
    scrubbed.measurements = measurements as SpanJson['measurements'];
  }
  // The page that was being used: standalone vitals spans carry it as `transaction`.
  const page = span.data?.transaction;
  if (typeof page === 'string') scrubbed.data.transaction = parametrizedName(page);
  return scrubbed;
}

/**
 * For `beforeSendSpan`, which Sentry applies to the children of a transaction and to standalone spans
 * (the INP of an interaction). It never throws: a span that cannot be scrubbed is reduced to its op.
 */
export function scrubSpan(span: SpanJson): SpanJson {
  try {
    return scrubSpanJson(span);
  } catch {
    return {
      span_id: span.span_id,
      trace_id: span.trace_id,
      start_timestamp: span.start_timestamp,
      timestamp: span.timestamp,
      op: span.op,
      description: span.op,
      data: {},
    };
  }
}

const TOP_LEVEL_KEYS = new Set([
  'type',
  'event_id',
  'timestamp',
  'start_timestamp',
  'platform',
  'release',
  'environment',
  'sdk',
  'sdkProcessingMetadata',
]);

function scrubContexts(event: Event): NonNullable<Event['contexts']> {
  const contexts: NonNullable<Event['contexts']> = {};
  const trace = event.contexts?.trace;
  if (trace) {
    const { trace_id, span_id, parent_span_id, op, status, origin, data } = trace;
    const scrubbed = {
      trace_id,
      span_id,
      data: pickAllowed(data, SPAN_DATA_KEYS),
    } as NonNullable<NonNullable<Event['contexts']>['trace']>;
    if (parent_span_id) scrubbed.parent_span_id = parent_span_id;
    if (op) scrubbed.op = op;
    if (status) scrubbed.status = status;
    if (origin) scrubbed.origin = origin;
    contexts.trace = scrubbed;
  }
  return contexts;
}

/**
 * For `beforeSendTransaction`: rebuilds a page load or navigation transaction from an allowlist
 * before it leaves the browser. It never throws and never lets an unscrubbed transaction through:
 * when scrubbing fails the transaction is dropped (null).
 *
 * What remains: the parametrized route as name, the page URL reduced to origin and parametrized
 * path, durations, the vitals as measurements (LCP, FCP, CLS, TTFB, INP), the trace id and the
 * `browser.*` phase spans. `request`, `user`, `tags`, `extra`, `breadcrumbs` and the other
 * contexts are removed.
 */
export function scrubTransaction<T extends Event>(event: T): T | null {
  try {
    const name = parametrizedName(event.transaction);
    const url = parametrizedUrl(event.request?.url);
    const contexts = scrubContexts(event);
    const spans = event.spans?.filter(isKeptSpan).map(scrubSpanJson);
    const measurements = cleanMeasurements(event.measurements);

    for (const key of Object.keys(event)) {
      if (!TOP_LEVEL_KEYS.has(key)) delete (event as Record<string, unknown>)[key];
    }
    event.transaction = name;
    event.transaction_info = { source: 'route' };
    event.contexts = contexts;
    if (spans) event.spans = spans;
    if (measurements) event.measurements = measurements as Event['measurements'];
    if (url) event.request = { url };
    scrubSamplingMetadata(event);
    return event;
  } catch {
    return null;
  }
}
