// @vitest-environment node
import * as Sentry from '@sentry/nextjs';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  type Envelope,
  forcedRequest,
  initWith,
  PATIENT_ID,
  transactions,
} from '@/test/sentry-harness';

/**
 * The Next server uses `buildSentryOptions` (`sentry.server.config.ts`) with the real server build of
 * `@sentry/nextjs` (under Node the package resolves to it): it never samples and never sends a
 * transaction, even when a client sends `sentry-trace: <id>-<id>-1`.
 */
describe('server runtime of @sentry/nextjs', () => {
  let sent: Envelope[];

  beforeAll(() => {
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
    expect(transactions(sent)).toHaveLength(0);
  });
});
