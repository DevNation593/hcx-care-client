import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BROWSER_TRACING_OPTIONS,
  buildBrowserSentryOptions,
  buildBrowserTracesSampler,
} from './sentry-browser-options';
import { buildSentryOptions } from './sentry-options';
import { scrubSpan, scrubTransaction } from './sentry-tracing';

const { browserTracingIntegration } = vi.hoisted(() => ({
  browserTracingIntegration: vi.fn((options: unknown) => ({ name: 'BrowserTracing', options })),
}));
vi.mock('@sentry/nextjs', () => ({ browserTracingIntegration }));

const DSN = 'https://public@o0.ingest.sentry.io/1';

type Sampler = (context: unknown) => unknown;

describe('buildBrowserSentryOptions', () => {
  beforeEach(() => browserTracingIntegration.mockClear());

  it('returns null without dsn', () => {
    expect(buildBrowserSentryOptions({})).toBeNull();
    expect(buildBrowserSentryOptions({ dsn: '', tracesSampleRate: '0.1' })).toBeNull();
  });

  it.each([
    ['absent', undefined],
    ['empty', ''],
    ['zero', '0'],
    ['not a number', 'abc'],
    ['negative', '-1'],
    ['above one', '2'],
    ['a percentage', '10%'],
  ])('adds no integration and loads no tracing code when the rate is %s', (_label, rate) => {
    const options = buildBrowserSentryOptions({ dsn: DSN, tracesSampleRate: rate });

    // The sampler and the transaction filter are new closures on each call: compare the rest.
    expect(options).toEqual({
      ...buildSentryOptions({ dsn: DSN }),
      tracesSampler: expect.any(Function),
      beforeSendTransaction: expect.any(Function),
    });
    expect(options?.tracesSampleRate).toBe(0);
    expect(options?.integrations).toBeUndefined();
    expect(options?.tracePropagationTargets).toEqual([]);
    // The sampler of the base options always answers 0, and no transaction is ever sent.
    expect((options?.tracesSampler as Sampler)({ parentSampled: true })).toBe(0);
    expect((options?.beforeSendTransaction as Sampler)({ type: 'transaction' })).toBeNull();
    expect(browserTracingIntegration).not.toHaveBeenCalled();
  });

  it('samples at the configured rate and adds the browser tracing integration', () => {
    const options = buildBrowserSentryOptions({ dsn: DSN, tracesSampleRate: '0.1' });

    expect(options?.tracesSampleRate).toBe(0.1);
    expect(browserTracingIntegration).toHaveBeenCalledTimes(1);
    expect(options?.integrations).toEqual([
      { name: 'BrowserTracing', options: expect.any(Object) },
      { name: 'EnvelopeTraceScrub', setup: expect.any(Function) },
    ]);
  });

  it('measures vitals only: no API request spans, no propagation, no clicks, no long tasks', () => {
    const options = buildBrowserSentryOptions({ dsn: DSN, tracesSampleRate: '1' });
    const passed = browserTracingIntegration.mock.calls[0][0] as Record<string, unknown>;

    expect(options?.tracePropagationTargets).toEqual([]);
    expect(passed).toMatchObject({
      traceFetch: false,
      traceXHR: false,
      enableLongTask: false,
      enableLongAnimationFrame: false,
      enableHTTPTimings: false,
      linkPreviousTrace: 'off',
      enableInp: true,
    });
    // `_experiments` is where click tracing (`ui.action.click`, with element text) lives.
    expect(passed._experiments).toBeUndefined();
    expect(passed).not.toHaveProperty('enableInteractions');
    expect(BROWSER_TRACING_OPTIONS.traceFetch).toBe(false);
  });

  it('scrubs transactions and spans when tracing is on; below it no transaction is sent', () => {
    const on = buildBrowserSentryOptions({ dsn: DSN, tracesSampleRate: '0.1' });
    const off = buildBrowserSentryOptions({ dsn: DSN, tracesSampleRate: '0' });

    expect(on?.beforeSendTransaction).toBe(scrubTransaction);
    expect(on?.beforeSendSpan).toBe(scrubSpan);
    expect((off?.beforeSendTransaction as Sampler)({ type: 'transaction' })).toBeNull();
    expect(off?.beforeSendSpan).toBeUndefined();
  });

  it('keeps privacy settings with tracing on: no PII, no replay, no breadcrumbs of ui or requests', () => {
    const options = buildBrowserSentryOptions({ dsn: DSN, tracesSampleRate: '1' });

    expect(options?.sendDefaultPii).toBe(false);
    expect(options?.replaysSessionSampleRate).toBe(0);
    expect(options?.replaysOnErrorSampleRate).toBe(0);
    for (const category of ['ui.click', 'fetch', 'xhr', 'console']) {
      expect(options?.beforeBreadcrumb?.({ category }, undefined)).toBeNull();
    }
  });

  it('with tracing on the sampler decides by Math.random, not by the incoming trace', () => {
    const options = buildBrowserSentryOptions({ dsn: DSN, tracesSampleRate: '0.05' });
    const sampler = options?.tracesSampler as Sampler;
    const forged = {
      parentSampled: true,
      parentSampleRate: 1,
      normalizedRequest: { headers: { baggage: 'sentry-sample_rand=0' } },
    };

    const random = vi.spyOn(Math, 'random').mockReturnValue(0.9);
    expect(sampler(forged)).toBe(false);
    random.mockReturnValue(0.01);
    expect(sampler(forged)).toBe(true);
    expect(sampler({ parentSampled: false })).toBe(true);
    random.mockRestore();
  });
});

describe('buildBrowserTracesSampler', () => {
  it('answers a boolean: true below the rate, false from it up', () => {
    const sampler = buildBrowserTracesSampler(0.1);
    const random = vi.spyOn(Math, 'random');

    for (const [value, expected] of [
      [0, true],
      [0.099, true],
      [0.1, false],
      [0.99, false],
    ] as const) {
      random.mockReturnValue(value);
      expect(sampler()).toBe(expected);
    }
    random.mockRestore();
  });
});
