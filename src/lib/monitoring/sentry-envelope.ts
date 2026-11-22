/**
 * Small and dependency-free on purpose: `sentry-options.ts` (browser, server and edge, always in the
 * bundle) uses it, so it must not drag the rest of the tracing code along.
 */

/** Dynamic sampling context: ids of the trace and settings only, never the transaction name. */
export const SAMPLING_CONTEXT_KEYS: ReadonlySet<string> = new Set([
  'trace_id',
  'public_key',
  'sample_rate',
  'sample_rand',
  'sampled',
  'release',
  'environment',
  'org_id',
]);

export function pickAllowed(
  source: object | undefined,
  allowed: ReadonlySet<string>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source ?? {})) {
    if (allowed.has(key) && value !== undefined) result[key] = value;
  }
  return result;
}

interface WithSamplingMetadata {
  sdkProcessingMetadata?: { dynamicSamplingContext?: object } & Record<string, unknown>;
}

/**
 * Leaves in `sdkProcessingMetadata` only the dynamic sampling context, reduced to
 * `SAMPLING_CONTEXT_KEYS`. The SDK copies that context to the `trace` header of the envelope; for a
 * sampled request it holds the name of the root span, which can be the raw route. It also protects
 * error events, which `scrubEvent` handles: an error captured during a sampled request carries the
 * context of the live span. The rest (`normalizedRequest`, the captured scopes) is dropped.
 */
export function scrubSamplingMetadata(event: WithSamplingMetadata): void {
  const sampling = event.sdkProcessingMetadata?.dynamicSamplingContext;
  if (sampling) {
    event.sdkProcessingMetadata = {
      dynamicSamplingContext: pickAllowed(sampling, SAMPLING_CONTEXT_KEYS),
    };
  } else {
    delete event.sdkProcessingMetadata;
  }
}

/**
 * The envelope header `trace` of a standalone span (the INP of an interaction) is computed from the
 * live span, whose name is the clicked element: `beforeSendSpan` does not reach it. Reduces it to the
 * allowed keys, so it never carries `transaction` nor any other name.
 */
export function scrubEnvelopeTrace(envelope: unknown): void {
  try {
    const header = (envelope as [{ trace?: object }] | undefined)?.[0];
    if (header?.trace) header.trace = pickAllowed(header.trace, SAMPLING_CONTEXT_KEYS);
  } catch {
    // Never break the send.
  }
}
