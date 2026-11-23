// @vitest-environment node
import * as Sentry from '@sentry/nextjs';
import { describe, expect, it } from 'vitest';
import { forcedRequest, initWith, transactions } from '@/test/sentry-harness';

/**
 * Control of `sentry-server.test.ts`: with the options of origin/dev (`tracesSampleRate: 0`, no
 * sampler, no transaction filter) the same forced `sentry-trace` DID produce a transaction. It shows
 * that the harness sees transactions and what `tracesSampler` / `beforeSendTransaction` in
 * `buildSentryOptions` close.
 */
describe('server runtime with the options of origin/dev', () => {
  it('a forced sentry-trace produces a transaction', async () => {
    const sent = initWith(Sentry, { tracesSampler: undefined, beforeSendTransaction: undefined });

    await forcedRequest(Sentry, false);

    expect(transactions(sent)).toHaveLength(1);
  });
});
