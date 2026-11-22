import { makeFetchTransport } from '@sentry/nextjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setBrowserReportingAllowed } from './browser-gate';
import { applyBrowserReportingGate } from './browser-reporting-options';
import { buildBrowserSentryOptions } from './sentry-browser-options';
import { buildSentryOptions, scrubEvent } from './sentry-options';

vi.mock('@sentry/nextjs', () => ({
  makeFetchTransport: vi.fn(),
  browserTracingIntegration: () => ({ name: 'BrowserTracing' }),
}));

const DSN = 'https://public@o0.ingest.sentry.io/1';
type Integration = { name: string };
const envelope = [{ sent_at: 'now' }, []] as never;

function innerTransport() {
  const inner = {
    send: vi.fn().mockResolvedValue({ statusCode: 200 }),
    flush: vi.fn().mockResolvedValue(true),
  };
  vi.mocked(makeFetchTransport).mockReturnValue(inner);
  return inner;
}

function gated(rate?: string) {
  const base = rate
    ? buildBrowserSentryOptions({ dsn: DSN, environment: 'production', tracesSampleRate: rate })
    : buildSentryOptions({ dsn: DSN, environment: 'production' });
  return applyBrowserReportingGate(base)!;
}

const integrationNames = (options: ReturnType<typeof gated>, defaults: string[]) =>
  (options.integrations as (d: never) => Integration[])(
    defaults.map((name) => ({ name })) as never,
  ).map((integration) => integration.name);

beforeEach(() => setBrowserReportingAllowed(false));
afterEach(() => {
  setBrowserReportingAllowed(false);
  vi.mocked(makeFetchTransport).mockReset();
});

describe('applyBrowserReportingGate', () => {
  it('returns null when there are no options (no dsn)', () => {
    expect(applyBrowserReportingGate(null)).toBeNull();
    expect(applyBrowserReportingGate(buildSentryOptions({}))).toBeNull();
  });

  it('keeps the shared minimum-data options and disables client reports', () => {
    const options = gated();

    expect(options.dsn).toBe(DSN);
    expect(options.environment).toBe('production');
    expect(options.sendDefaultPii).toBe(false);
    expect(options.beforeSend).toBe(scrubEvent);
    expect(options.beforeBreadcrumb).toBeTypeOf('function');
    expect(options.sendClientReports).toBe(false);
    // Nothing of the tracing hardening of buildSentryOptions is lost.
    expect(options.tracePropagationTargets).toEqual([]);
    expect(options.tracesSampleRate).toBe(0);
  });

  it('removes the BrowserSession integration (no release-health sessions) and keeps the rest', () => {
    expect(integrationNames(gated(), ['InboundFilters', 'BrowserSession', 'Breadcrumbs'])).toEqual([
      'InboundFilters',
      'Breadcrumbs',
    ]);
  });

  it('with Web Vitals on, adds the tracing integrations to the defaults and still drops BrowserSession', () => {
    const options = gated('0.1');

    expect(integrationNames(options, ['InboundFilters', 'BrowserSession', 'BrowserTracing'])).toEqual([
      'InboundFilters',
      'BrowserTracing',
      'BrowserTracing',
      'EnvelopeTraceScrub',
    ]);
    expect(options.tracesSampleRate).toBe(0.1);
    expect(options.tracePropagationTargets).toEqual([]);
    expect(options.beforeSendTransaction).toBeTypeOf('function');
    expect(options.beforeSendSpan).toBeTypeOf('function');
  });

  it('keeps a function-form integrations option (it receives the defaults without BrowserSession)', () => {
    const received: string[][] = [];
    const options = applyBrowserReportingGate({
      dsn: DSN,
      integrations: (defaults) => {
        received.push(defaults.map((integration) => integration.name));
        return defaults;
      },
    })!;

    integrationNames(options, ['InboundFilters', 'BrowserSession']);

    expect(received).toEqual([['InboundFilters']]);
  });

  it('transport drops every envelope while the gate is closed', async () => {
    const inner = innerTransport();
    const transport = gated().transport?.({} as never);

    await expect(transport?.send(envelope)).resolves.toEqual({});

    expect(inner.send).not.toHaveBeenCalled();
  });

  it('transport delegates to the fetch transport while the gate is open', async () => {
    const inner = innerTransport();
    const transport = gated().transport?.({} as never);
    setBrowserReportingAllowed(true);

    await expect(transport?.send(envelope)).resolves.toEqual({ statusCode: 200 });

    expect(inner.send).toHaveBeenCalledWith(envelope);
  });

  it('transport checks the gate on every send, not once at creation', async () => {
    const inner = innerTransport();
    const transport = gated().transport?.({} as never);
    setBrowserReportingAllowed(true);
    await transport?.send(envelope);
    setBrowserReportingAllowed(false);

    await transport?.send(envelope);

    expect(inner.send).toHaveBeenCalledTimes(1);
  });

  it('transport always delegates flush', async () => {
    const inner = innerTransport();
    const transport = gated().transport?.({} as never);

    await expect(transport?.flush(500)).resolves.toBe(true);

    expect(inner.flush).toHaveBeenCalledWith(500);
  });
});
