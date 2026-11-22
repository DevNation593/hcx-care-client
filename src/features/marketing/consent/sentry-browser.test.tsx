import { act, render } from '@testing-library/react';
import * as Sentry from '@sentry/nextjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isBrowserReportingAllowed, setBrowserReportingAllowed } from '@/lib/monitoring/browser-gate';
import { resetConsent, writeConsent } from './consent';
import { SentryBrowser } from './sentry-browser';

const scopes = vi.hoisted(() => ({
  isolation: { clearBreadcrumbs: vi.fn() },
  current: { clearBreadcrumbs: vi.fn() },
  global: { clearBreadcrumbs: vi.fn() },
}));

// The real SDK is exercised in sentry-browser.integration.test.tsx; here it is replaced to
// observe how the component drives it.
vi.mock('@sentry/nextjs', () => ({
  init: vi.fn(),
  getClient: vi.fn(),
  makeFetchTransport: vi.fn(),
  getIsolationScope: () => scopes.isolation,
  getCurrentScope: () => scopes.current,
  getGlobalScope: () => scopes.global,
}));

const DSN = 'https://key@o0.ingest.sentry.io/1';

function clearedCount() {
  return (
    scopes.isolation.clearBreadcrumbs.mock.calls.length +
    scopes.current.clearBreadcrumbs.mock.calls.length +
    scopes.global.clearBreadcrumbs.mock.calls.length
  );
}

beforeEach(() => {
  window.localStorage.clear();
  act(() => resetConsent());
  setBrowserReportingAllowed(false);
  vi.mocked(Sentry.init).mockReset();
  vi.mocked(Sentry.getClient).mockReset();
  for (const scope of Object.values(scopes)) scope.clearBreadcrumbs.mockClear();
});
afterEach(() => setBrowserReportingAllowed(false));

describe('SentryBrowser', () => {
  it('renders nothing', () => {
    act(() => writeConsent('accepted'));
    const { container } = render(<SentryBrowser dsn={DSN} />);
    expect(container).toBeEmptyDOMElement();
  });

  it.each(['unset', 'rejected'] as const)('does not initialize nor open the gate when consent is %s', (state) => {
    if (state === 'rejected') act(() => writeConsent('rejected'));
    render(<SentryBrowser dsn={DSN} />);
    expect(Sentry.init).not.toHaveBeenCalled();
    expect(isBrowserReportingAllowed()).toBe(false);
  });

  it.each([undefined, '', '   '])('does not initialize without a dsn (%j)', (dsn) => {
    act(() => writeConsent('accepted'));
    render(<SentryBrowser dsn={dsn} />);
    expect(Sentry.init).not.toHaveBeenCalled();
    expect(isBrowserReportingAllowed()).toBe(false);
  });

  it('initializes once with the browser-only gated options when consent is accepted', () => {
    act(() => writeConsent('accepted'));
    const { rerender } = render(<SentryBrowser dsn={DSN} environment="production" />);
    rerender(<SentryBrowser dsn={DSN} environment="production" />);

    expect(Sentry.init).toHaveBeenCalledTimes(1);
    expect(Sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: DSN,
        environment: 'production',
        sendDefaultPii: false,
        tracesSampleRate: 0,
        sendClientReports: false,
        transport: expect.any(Function),
        integrations: expect.any(Function),
      }),
    );
    expect(isBrowserReportingAllowed()).toBe(true);
  });

  it('does not initialize again when a client already exists', () => {
    vi.mocked(Sentry.getClient).mockReturnValue({} as ReturnType<typeof Sentry.getClient>);
    act(() => writeConsent('accepted'));
    render(<SentryBrowser dsn={DSN} />);

    expect(Sentry.init).not.toHaveBeenCalled();
    expect(isBrowserReportingAllowed()).toBe(true);
  });

  it('closes the gate on unmount (leaving the marketing pages)', () => {
    act(() => writeConsent('accepted'));
    const { unmount } = render(<SentryBrowser dsn={DSN} />);
    expect(isBrowserReportingAllowed()).toBe(true);

    unmount();

    expect(isBrowserReportingAllowed()).toBe(false);
  });

  it('closes the gate when consent is withdrawn', () => {
    act(() => writeConsent('accepted'));
    render(<SentryBrowser dsn={DSN} />);
    expect(isBrowserReportingAllowed()).toBe(true);

    act(() => writeConsent('rejected'));

    expect(isBrowserReportingAllowed()).toBe(false);
  });

  it('reopens the gate without a second init when consent is accepted again', () => {
    act(() => writeConsent('accepted'));
    vi.mocked(Sentry.init).mockImplementation(() => {
      vi.mocked(Sentry.getClient).mockReturnValue({} as ReturnType<typeof Sentry.getClient>);
      return undefined;
    });
    render(<SentryBrowser dsn={DSN} />);
    act(() => writeConsent('rejected'));
    act(() => writeConsent('accepted'));

    expect(Sentry.init).toHaveBeenCalledTimes(1);
    expect(isBrowserReportingAllowed()).toBe(true);
  });

  it('clears stored breadcrumbs on every scope each time the gate opens', () => {
    act(() => writeConsent('accepted'));
    const { unmount } = render(<SentryBrowser dsn={DSN} />);
    expect(scopes.isolation.clearBreadcrumbs).toHaveBeenCalledTimes(1);
    expect(scopes.current.clearBreadcrumbs).toHaveBeenCalledTimes(1);
    expect(scopes.global.clearBreadcrumbs).toHaveBeenCalledTimes(1);

    unmount();
    const afterFirst = clearedCount();
    render(<SentryBrowser dsn={DSN} />);

    expect(clearedCount()).toBeGreaterThan(afterFirst);
  });

  it('does not touch breadcrumbs when the gate stays closed', () => {
    render(<SentryBrowser dsn={DSN} />);
    expect(clearedCount()).toBe(0);
  });
});
