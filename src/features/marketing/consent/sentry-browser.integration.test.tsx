import { act, render } from '@testing-library/react';
import { AxiosError } from 'axios';
import * as Sentry from '@sentry/nextjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isBrowserReportingAllowed, setBrowserReportingAllowed } from '@/lib/monitoring/browser-gate';
import { resetConsent, writeConsent } from './consent';
import { SentryBrowser } from './sentry-browser';

/**
 * Real browser SDK, real consent store, real gate. Only the network leaf is replaced:
 * `makeFetchTransport` returns a recorder, so everything the SDK would POST (events, sessions,
 * client reports) is observable after passing through the app's gated transport wrapper.
 *
 * `@sentry/nextjs` resolves to its Node build under Vitest and its browser entry needs Next's
 * router, so it is mapped to `@sentry/browser`, the SDK the Next client wraps. The wrapper only
 * adds tracing and a NEXT_REDIRECT filter, which are irrelevant to what is checked here.
 */
const sent = vi.hoisted(() => [] as unknown[]);

vi.mock('@sentry/nextjs', async () => {
  const browser = await import('@sentry/browser');
  return {
    ...browser,
    makeFetchTransport: () => ({
      send: async (envelope: unknown) => {
        sent.push(envelope);
        return {};
      },
      flush: async () => true,
    }),
  };
});

type EnvelopeItem = [{ type: string }, Record<string, unknown>];

function items(): EnvelopeItem[] {
  return (sent as [unknown, EnvelopeItem[]][]).flatMap((envelope) => envelope[1]);
}

function types(): string[] {
  return items().map(([header]) => header.type);
}

function eventMessages(): string[] {
  return items()
    .filter(([header]) => header.type === 'event')
    .map(([, payload]) => (payload as { exception?: { values?: { value?: string }[] } }).exception?.values?.[0]?.value ?? '');
}

function breadcrumbMessages(): string[] {
  return items()
    .filter(([header]) => header.type === 'event')
    .flatMap(([, payload]) => ((payload as { breadcrumbs?: { message?: string; data?: { to?: string } }[] }).breadcrumbs ?? []))
    .map((crumb) => crumb.message ?? crumb.data?.to ?? '');
}

async function settle() {
  // Event processing is promise based; wait for it and flush the SDK.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
    await Sentry.flush(100);
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

function hidePage() {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
  document.dispatchEvent(new Event('visibilitychange'));
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
}

const DSN = 'https://key@o0.ingest.sentry.io/1';

beforeEach(() => {
  window.localStorage.clear();
  act(() => resetConsent());
  setBrowserReportingAllowed(false);
  sent.length = 0;
  // The SDK only sends sessions when a release is set (the Next build injects one), so set it
  // here: otherwise a leaked session would be silently discarded and the checks below vacuous.
  (window as unknown as { SENTRY_RELEASE?: { id: string } }).SENTRY_RELEASE = { id: 'test-release' };
});

afterEach(async () => {
  // No test may ever produce a session or a client report.
  expect(types().filter((type) => type !== 'event')).toEqual([]);
  setBrowserReportingAllowed(false);
  // Drop the SDK client so the next test initializes through SentryBrowser again.
  await Sentry.getClient()?.close(0);
  Sentry.getCurrentScope().setClient(undefined);
  Sentry.getCurrentScope().clear();
  Sentry.getIsolationScope().clear();
  Sentry.getGlobalScope().clear();
});

describe('SentryBrowser with the real SDK', () => {
  it('sends a captured error while mounted with accepted consent', async () => {
    act(() => writeConsent('accepted'));
    render(<SentryBrowser dsn={DSN} environment="test" />);
    expect(Sentry.getClient()).toBeDefined();

    Sentry.captureException(new Error('marketing boom'));
    await settle();

    expect(eventMessages()).toEqual(['marketing boom']);
  });

  it('sends nothing without consent', async () => {
    render(<SentryBrowser dsn={DSN} />);

    Sentry.captureException(new Error('no consent'));
    await settle();

    expect(Sentry.getClient()).toBeUndefined();
    expect(sent).toEqual([]);
  });

  it('sends no session or client report even when the page is hidden while reporting is allowed', async () => {
    act(() => writeConsent('accepted'));
    render(<SentryBrowser dsn={DSN} />);

    hidePage();
    window.history.pushState({}, '', '/como-funciona');
    await settle();

    expect(types()).toEqual([]);
  });

  it('sends no client report even when an event is discarded while reporting is allowed', async () => {
    act(() => writeConsent('accepted'));
    render(<SentryBrowser dsn={DSN} />);

    // API errors are dropped by beforeSend, which records an outcome a client report would carry.
    Sentry.captureException(new AxiosError('Network Error'));
    await settle();
    hidePage();
    await settle();

    expect(sent).toEqual([]);
  });

  it('sends nothing after leaving the marketing layout (unmount)', async () => {
    act(() => writeConsent('accepted'));
    const { unmount } = render(<SentryBrowser dsn={DSN} />);
    Sentry.captureException(new Error('before leaving'));
    await settle();
    expect(eventMessages()).toEqual(['before leaving']);
    sent.length = 0;

    unmount();
    expect(isBrowserReportingAllowed()).toBe(false);
    window.history.pushState({}, '', '/login');
    Sentry.setUser({ id: 'u1' });
    window.history.pushState({}, '', '/dashboard');
    Sentry.captureException(new Error('inside the dashboard'));
    hidePage();
    await settle();

    expect(sent).toEqual([]);
  });

  it('sends nothing after consent goes from accepted to rejected on the same page', async () => {
    act(() => writeConsent('accepted'));
    render(<SentryBrowser dsn={DSN} />);
    Sentry.captureException(new Error('accepted era'));
    await settle();
    sent.length = 0;

    act(() => writeConsent('rejected'));
    Sentry.setUser({ id: 'u1' });
    Sentry.captureException(new Error('after withdrawing'));
    window.history.pushState({}, '', '/planes');
    hidePage();
    await settle();

    expect(sent).toEqual([]);
  });

  it('never lets breadcrumbs collected while closed ride along in a later marketing event', async () => {
    act(() => writeConsent('accepted'));
    const { unmount } = render(<SentryBrowser dsn={DSN} />);

    unmount();
    Sentry.addBreadcrumb({ category: 'custom', message: 'dashboard-secret' });
    window.history.pushState({}, '', '/dashboard/patients/7');
    render(<SentryBrowser dsn={DSN} />);
    Sentry.captureException(new Error('back on marketing'));
    await settle();

    expect(eventMessages()).toEqual(['back on marketing']);
    const crumbs = breadcrumbMessages().join(' ');
    expect(crumbs).not.toContain('dashboard-secret');
    expect(crumbs).not.toContain('/dashboard');
  });

  it('clears breadcrumbs that were already stored when the gate opens', async () => {
    act(() => writeConsent('accepted'));
    const first = render(<SentryBrowser dsn={DSN} />);
    // Stored while reporting is allowed, then the gate cycles closed and open.
    Sentry.addBreadcrumb({ category: 'custom', message: 'stored-before-cycle' });
    first.unmount();
    render(<SentryBrowser dsn={DSN} />);

    Sentry.captureException(new Error('after cycle'));
    await settle();

    expect(breadcrumbMessages().join(' ')).not.toContain('stored-before-cycle');
  });
});
