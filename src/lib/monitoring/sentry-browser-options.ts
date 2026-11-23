import { browserTracingIntegration } from '@sentry/nextjs';
import type { BrowserOptions } from '@sentry/nextjs';
import { scrubEnvelopeTrace } from './sentry-envelope';
import { buildSentryOptions } from './sentry-options';
import { parseTracesSampleRate, scrubSpan, scrubTransaction } from './sentry-tracing';

type Integration = ReturnType<typeof browserTracingIntegration>;

/**
 * Options of the browser tracing integration, which measures the Web Vitals (LCP, INP, CLS, TTFB,
 * FCP) of the page load and of each client-side navigation.
 *
 * Everything that is not a vital is switched off:
 * - `traceFetch` / `traceXHR` do not create a span per API call (its URL carries ids). Together with
 *   the client option `tracePropagationTargets: []`, `sentry-trace` and `baggage` are never added to
 *   a request. Propagating them to the API is a deliberate decision, see docs/DOCUMENTATION.md.
 * - Long task and long animation frame spans, link to the previous trace and HTTP timings.
 * - No `_experiments`: that is where click tracing (`ui.action.click`, with the text of the element)
 *   lives. INP stays on, but `beforeSendSpan` replaces the name of its span (the element) by the op
 *   and `EnvelopeTraceScrub` removes it from the `trace` header of its envelope.
 */
export const BROWSER_TRACING_OPTIONS = {
  traceFetch: false,
  traceXHR: false,
  enableLongTask: false,
  enableLongAnimationFrame: false,
  enableHTTPTimings: false,
  linkPreviousTrace: 'off',
  enableInp: true,
} as const;

/**
 * Samples with `Math.random() < rate` and answers a boolean. Neither the sampling decision of the
 * trace of a `<meta name="sentry-trace">` nor its `sample_rand` can raise the fraction of sampled
 * page loads, and `buildSentryOptions` (rate 0) keeps its own sampler that always answers 0.
 */
export function buildBrowserTracesSampler(rate: number): () => boolean {
  return () => Math.random() < rate;
}

/**
 * The `trace` header of the envelope of a standalone span (the INP of an interaction) is computed
 * from the live span, which is named after the clicked element, and `beforeSendSpan` does not touch
 * it. This integration reduces the header of every envelope to the allowed keys.
 */
const envelopeTraceScrub: Integration = {
  name: 'EnvelopeTraceScrub',
  setup(client) {
    client.on('beforeEnvelope', scrubEnvelopeTrace);
  },
};

/**
 * Options of the browser SDK when `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` is set: the common
 * ones plus the browser tracing integration, the sampler and the scrubbers of transactions, spans and
 * envelope headers. `tracesSampleRate` is the raw text of the variable: invalid means 0.
 *
 * At rate 0 it returns exactly what `buildSentryOptions` returns: nothing changes in the browser. Its only
 * caller is `SentryBrowser` (src/features/marketing/consent/sentry-browser.tsx, the only browser init,
 * mounted in the (marketing) layout), which then wraps the result in the reporting gate. There is no
 * `sentry.client.config.ts`. `SentryBrowser`
 * does not even use this module when the variable is not defined at build time, so
 * none of this code reaches the bundle.
 */
export function buildBrowserSentryOptions(env: {
  dsn?: string;
  environment?: string;
  tracesSampleRate?: string;
}): BrowserOptions | null {
  const options = buildSentryOptions(env);
  const tracesSampleRate = parseTracesSampleRate(env.tracesSampleRate);
  if (!options || !tracesSampleRate) return options;

  return {
    ...options,
    tracesSampleRate,
    // Replaces the `() => 0` of `buildSentryOptions`, which would cancel the rate.
    tracesSampler: buildBrowserTracesSampler(tracesSampleRate),
    // Not even to the same origin (the default): no request carries `sentry-trace` or `baggage`.
    tracePropagationTargets: [],
    // A transaction or a span never leaves the browser without being scrubbed.
    beforeSendTransaction: scrubTransaction,
    beforeSendSpan: scrubSpan,
    integrations: [browserTracingIntegration({ ...BROWSER_TRACING_OPTIONS }), envelopeTraceScrub],
  };
}
