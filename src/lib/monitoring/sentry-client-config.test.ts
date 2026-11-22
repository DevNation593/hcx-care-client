import type { BrowserOptions, Event } from '@sentry/nextjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { init, browserTracingIntegration } = vi.hoisted(() => ({
  init: vi.fn(),
  browserTracingIntegration: vi.fn(() => ({ name: 'BrowserTracing' })),
}));
vi.mock('@sentry/nextjs', () => ({ init, browserTracingIntegration }));

const DSN = 'https://public@o0.ingest.sentry.io/1';

async function loadConfig(): Promise<BrowserOptions | undefined> {
  vi.resetModules();
  await import('../../../sentry.client.config');
  return init.mock.calls[0]?.[0];
}

describe('sentry.client.config', () => {
  beforeEach(() => {
    init.mockClear();
    browserTracingIntegration.mockClear();
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', DSN);
    vi.stubEnv('NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE', '');
  });

  afterEach(() => vi.unstubAllEnvs());

  it('does not initialize Sentry without a DSN', async () => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', '');

    expect(await loadConfig()).toBeUndefined();
    expect(init).not.toHaveBeenCalled();
  });

  it.each(['', 'abc', '0', '-1', '5', '10%'])(
    'with NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=%p it initializes exactly as before: no tracing',
    async (rate) => {
      vi.stubEnv('NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE', rate);

      const options = await loadConfig();

      expect(init).toHaveBeenCalledTimes(1);
      expect(options?.tracesSampleRate).toBe(0);
      expect(options?.integrations).toBeUndefined();
      expect(options?.tracePropagationTargets).toEqual([]);
      // Nothing is sampled and no transaction is sent, whatever an incoming trace says.
      expect((options?.tracesSampler as (c: unknown) => unknown)({ parentSampled: true })).toBe(0);
      expect((options?.beforeSendTransaction as (e: unknown) => unknown)({})).toBeNull();
      expect(browserTracingIntegration).not.toHaveBeenCalled();
    },
  );

  it('with a valid rate it samples, adds the browser tracing integration and the scrubbers', async () => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE', '0.1');

    const options = await loadConfig();

    expect(options?.tracesSampleRate).toBe(0.1);
    expect(
      (options?.integrations as Array<{ name: string }>).map((integration) => integration.name),
    ).toEqual(['BrowserTracing', 'EnvelopeTraceScrub']);
    expect(options?.tracePropagationTargets).toEqual([]);
    expect(options?.sendDefaultPii).toBe(false);
    // The modules are loaded again for each test: check what the scrubbers do, not their identity.
    const transaction = {
      type: 'transaction',
      transaction: '/patients/3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b?search=Ana',
      user: { email: 'ana@example.com' },
    } as Event;
    const scrubbed = options?.beforeSendTransaction?.(transaction as never, {});
    expect(scrubbed).toMatchObject({ transaction: '/patients/:param' });
    expect(JSON.stringify(scrubbed)).not.toContain('ana@example.com');
    expect(options?.beforeSendSpan).toEqual(expect.any(Function));
  });
});
