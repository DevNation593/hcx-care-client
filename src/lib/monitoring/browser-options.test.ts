import { makeFetchTransport } from '@sentry/nextjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildBrowserSentryOptions } from './browser-options';
import { setBrowserReportingAllowed } from './browser-gate';
import { scrubEvent } from './sentry-options';

vi.mock('@sentry/nextjs', () => ({ makeFetchTransport: vi.fn() }));

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

beforeEach(() => setBrowserReportingAllowed(false));
afterEach(() => {
  setBrowserReportingAllowed(false);
  vi.mocked(makeFetchTransport).mockReset();
});

describe('buildBrowserSentryOptions', () => {
  it('returns null without dsn', () => {
    expect(buildBrowserSentryOptions({})).toBeNull();
    expect(buildBrowserSentryOptions({ dsn: '  ' })).toBeNull();
  });

  it('keeps the shared minimum-data options and disables client reports', () => {
    const options = buildBrowserSentryOptions({ dsn: DSN, environment: 'production' });

    expect(options?.dsn).toBe(DSN);
    expect(options?.environment).toBe('production');
    expect(options?.sendDefaultPii).toBe(false);
    expect(options?.beforeSend).toBe(scrubEvent);
    expect(options?.beforeBreadcrumb).toBeTypeOf('function');
    expect(options?.sendClientReports).toBe(false);
  });

  it('removes the BrowserSession integration (no release-health sessions) and keeps the rest', () => {
    const options = buildBrowserSentryOptions({ dsn: DSN });
    const defaults = ['InboundFilters', 'BrowserSession', 'Breadcrumbs'].map((name) => ({ name }) as Integration);

    const integrations = (options?.integrations as (d: never) => Integration[])(defaults as never);

    expect(integrations.map((i) => i.name)).toEqual(['InboundFilters', 'Breadcrumbs']);
  });

  it('transport drops every envelope while the gate is closed', async () => {
    const inner = innerTransport();
    const transport = buildBrowserSentryOptions({ dsn: DSN })?.transport?.({} as never);

    await expect(transport?.send(envelope)).resolves.toEqual({});

    expect(inner.send).not.toHaveBeenCalled();
  });

  it('transport delegates to the fetch transport while the gate is open', async () => {
    const inner = innerTransport();
    const transport = buildBrowserSentryOptions({ dsn: DSN })?.transport?.({} as never);
    setBrowserReportingAllowed(true);

    await expect(transport?.send(envelope)).resolves.toEqual({ statusCode: 200 });

    expect(inner.send).toHaveBeenCalledWith(envelope);
  });

  it('transport checks the gate on every send, not once at creation', async () => {
    const inner = innerTransport();
    const transport = buildBrowserSentryOptions({ dsn: DSN })?.transport?.({} as never);
    setBrowserReportingAllowed(true);
    await transport?.send(envelope);
    setBrowserReportingAllowed(false);

    await transport?.send(envelope);

    expect(inner.send).toHaveBeenCalledTimes(1);
  });

  it('transport always delegates flush', async () => {
    const inner = innerTransport();
    const transport = buildBrowserSentryOptions({ dsn: DSN })?.transport?.({} as never);

    await expect(transport?.flush(500)).resolves.toBe(true);

    expect(inner.flush).toHaveBeenCalledWith(500);
  });
});
