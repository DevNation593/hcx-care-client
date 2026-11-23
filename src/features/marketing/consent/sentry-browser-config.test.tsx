import { act, render } from '@testing-library/react';
import type { BrowserOptions, Event } from '@sentry/nextjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setBrowserReportingAllowed } from '@/lib/monitoring/browser-gate';
import { resetConsent, writeConsent } from './consent';
import { SentryBrowser } from './sentry-browser';

const { init, browserTracingIntegration } = vi.hoisted(() => ({
  init: vi.fn(),
  browserTracingIntegration: vi.fn(() => ({ name: 'BrowserTracing' })),
}));
const scope = { clearBreadcrumbs: vi.fn() };
vi.mock('@sentry/nextjs', () => ({
  init,
  getClient: vi.fn(),
  captureException: vi.fn(),
  makeFetchTransport: vi.fn(),
  browserTracingIntegration,
  getIsolationScope: () => scope,
  getCurrentScope: () => scope,
  getGlobalScope: () => scope,
}));

const DSN = 'https://public@o0.ingest.sentry.io/1';

/** The options the browser SDK is initialized with: SentryBrowser is its only init (SEC-WEB-09). */
function initOptions({ dsn }: { dsn?: string } = { dsn: DSN }): BrowserOptions | undefined {
  act(() => writeConsent('accepted'));
  render(<SentryBrowser dsn={dsn} environment="production" />);
  return init.mock.calls[0]?.[0];
}

/** What the SDK resolves for the `integrations` option, given its default integrations. */
function integrationNames(options: BrowserOptions | undefined, defaults = ['Dedupe', 'BrowserSession']) {
  const resolve = options?.integrations as (d: never) => Array<{ name: string }>;
  return resolve(defaults.map((name) => ({ name })) as never).map((integration) => integration.name);
}

describe('browser SDK configuration (SentryBrowser is its only init)', () => {
  beforeEach(() => {
    init.mockClear();
    browserTracingIntegration.mockClear();
    window.localStorage.clear();
    act(() => resetConsent());
    setBrowserReportingAllowed(false);
    vi.stubEnv('NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    setBrowserReportingAllowed(false);
  });

  it('does not initialize Sentry without a DSN', () => {
    expect(initOptions({})).toBeUndefined();
    expect(init).not.toHaveBeenCalled();
  });

  it.each(['', 'abc', '0', '-1', '5', '10%'])(
    'with NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=%p it initializes without tracing',
    (rate) => {
      vi.stubEnv('NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE', rate);

      const options = initOptions();

      expect(init).toHaveBeenCalledTimes(1);
      expect(options?.tracesSampleRate).toBe(0);
      // Only the gate's own change to the defaults: no tracing integration is added.
      expect(integrationNames(options)).toEqual(['Dedupe']);
      expect(options?.tracePropagationTargets).toEqual([]);
      // Nothing is sampled and no transaction is sent, whatever an incoming trace says.
      expect((options?.tracesSampler as (c: unknown) => unknown)({ parentSampled: true })).toBe(0);
      expect((options?.beforeSendTransaction as (e: unknown) => unknown)({})).toBeNull();
      expect(browserTracingIntegration).not.toHaveBeenCalled();
    },
  );

  it('with a valid rate it samples, adds the browser tracing integration and the scrubbers', () => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE', '0.1');

    const options = initOptions();

    expect(options?.tracesSampleRate).toBe(0.1);
    // Added to the defaults, and BrowserSession is still removed.
    expect(integrationNames(options)).toEqual(['Dedupe', 'BrowserTracing', 'EnvelopeTraceScrub']);
    expect(options?.tracePropagationTargets).toEqual([]);
    expect(options?.sendDefaultPii).toBe(false);
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

  it.each(['', '0.1'])('at rate %p it always gates the transport and turns off sessions and client reports', (rate) => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE', rate);

    const options = initOptions();

    expect(options?.transport).toEqual(expect.any(Function));
    expect(options?.sendClientReports).toBe(false);
    expect(integrationNames(options)).not.toContain('BrowserSession');
  });
});
