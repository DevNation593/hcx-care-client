import path from 'node:path';
import { buildSentryOptions } from '@/lib/monitoring/sentry-options';

/**
 * Harness of the tests that run the REAL `@sentry/nextjs` server or edge build with an in-memory
 * transport (nothing is sent). The Node SDK keeps global state (OpenTelemetry): each test file inits
 * it once.
 */

export const DSN = 'https://public@o0.ingest.sentry.io/1';
export const PATIENT_ID = '3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b';
const SENTRY_TRACE = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-cccccccccccccccc-1';
const BAGGAGE =
  'sentry-trace_id=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa,sentry-sample_rand=0,sentry-sample_rate=1,sentry-sampled=true,sentry-public_key=x';

export type Envelope = [Record<string, any>, Array<[Record<string, any>, Record<string, any>]>];
export type Runtime = typeof import('@sentry/nextjs');

/** The edge build of the package, bypassing the `exports` map (vitest resolves the Node one). */
export async function loadEdge(): Promise<Runtime> {
  const entry = path.resolve(process.cwd(), 'node_modules/@sentry/nextjs/build/cjs/edge/index.js');
  return (await import(/* @vite-ignore */ entry)) as Runtime;
}

export function initWith(Sentry: Runtime, overrides: Record<string, unknown> = {}): Envelope[] {
  const sent: Envelope[] = [];
  const options = buildSentryOptions({ dsn: DSN, environment: 'production' })!;
  Sentry.init({
    ...options,
    ...overrides,
    transport: (() => ({
      send: async (envelope: Envelope) => {
        sent.push(envelope);
        return {};
      },
      flush: async () => true,
    })) as never,
  } as never);
  return sent;
}

export const transactions = (sent: Envelope[]) =>
  sent.flatMap((e) => e[1]).filter(([header]) => header.type === 'transaction');

/**
 * What `wrapRouteHandlerWithSentry` and the server components wrapper do with the incoming request:
 * continue the trace of its `sentry-trace` (and `baggage`) headers around the work of the request.
 * An error is captured inside it.
 */
export async function forcedRequest(Sentry: Runtime, withBaggage: boolean, captureError = false) {
  Sentry.continueTrace(
    { sentryTrace: SENTRY_TRACE, baggage: withBaggage ? BAGGAGE : undefined },
    () => {
      Sentry.startSpan({ name: `GET /patients/${PATIENT_ID}`, op: 'http.server' }, () => {
        if (captureError) Sentry.captureException(new Error('server 500'));
      });
    },
  );
  await new Promise((resolve) => setTimeout(resolve, 200));
  await Sentry.flush(1000);
}
