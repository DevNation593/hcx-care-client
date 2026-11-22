// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';
import {
  type Envelope,
  forcedRequest,
  initWith,
  loadEdge,
  PATIENT_ID,
  type Runtime,
  transactions,
} from '@/test/sentry-harness';

/**
 * The edge uses `buildSentryOptions` (`sentry.edge.config.ts`) with the real edge build of
 * `@sentry/nextjs`. With the options of origin/dev this build did not sample a forced `sentry-trace`
 * either (checked while writing this test: 0 transactions), so this is a guard: the same options
 * (`tracesSampler`, `beforeSendTransaction`) now keep it that way whatever the SDK does with the
 * incoming trace.
 */
describe('edge runtime of @sentry/nextjs', () => {
  let Sentry: Runtime;
  let sent: Envelope[];

  beforeAll(async () => {
    Sentry = await loadEdge();
    sent = initWith(Sentry);
  });

  it('a forced sentry-trace, with or without a baggage with sample_rand=0, produces no transaction', async () => {
    await forcedRequest(Sentry, false);
    await forcedRequest(Sentry, true);

    expect(transactions(sent)).toHaveLength(0);
  });

  it('an error captured in a request with a forced sentry-trace has no route in the envelope header', async () => {
    await forcedRequest(Sentry, true, true);

    const errorEnvelope = sent.find((e) => e[1].some(([h]) => h.type === 'event'));
    expect(errorEnvelope).toBeDefined();
    expect(JSON.stringify(errorEnvelope)).not.toContain(PATIENT_ID);
    expect(errorEnvelope![0].trace ?? {}).not.toHaveProperty('transaction');
  });
});
