import { StrictMode } from 'react';
import { act, render } from '@testing-library/react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import * as Sentry from '@sentry/nextjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorFallback } from '@/components/monitoring/error-fallback';
import { resetConsent, writeConsent } from '@/features/marketing/consent/consent';
import { clearPendingBrowserErrors } from '@/features/marketing/consent/pending-browser-errors';
import { SentryBrowser } from '@/features/marketing/consent/sentry-browser';
import { setBrowserReportingAllowed } from '@/lib/monitoring/browser-gate';
import MarketingError from './error';

/**
 * Render errors on public pages, with the real browser SDK, real consent store, real gate and
 * real boundary components. Only the network leaf is replaced (`makeFetchTransport` records
 * envelopes) and `@sentry/nextjs` is mapped to `@sentry/browser`, for the same reasons as in
 * sentry-browser.integration.test.tsx.
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

function eventMessages(): string[] {
  return items()
    .filter(([header]) => header.type === 'event')
    .map(([, payload]) => (payload as { exception?: { values?: { value?: string }[] } }).exception?.values?.[0]?.value ?? '');
}

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
    await Sentry.flush(100);
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

const DSN = 'https://key@o0.ingest.sentry.io/1';
const noop = () => {};

/** Same order as the (marketing) layout: the page (here the boundary) first, SentryBrowser after. */
function MarketingTree({ error, dsn = DSN }: { error?: Error; dsn?: string }) {
  return (
    <>
      {error && <MarketingError error={error} reset={noop} />}
      <SentryBrowser dsn={dsn} environment="test" />
    </>
  );
}

beforeEach(() => {
  window.localStorage.clear();
  act(() => resetConsent());
  setBrowserReportingAllowed(false);
  clearPendingBrowserErrors();
  sent.length = 0;
  (window as unknown as { SENTRY_RELEASE?: { id: string } }).SENTRY_RELEASE = { id: 'test-release' };
});

afterEach(async () => {
  expect(items().map(([header]) => header.type).filter((type) => type !== 'event')).toEqual([]);
  setBrowserReportingAllowed(false);
  clearPendingBrowserErrors();
  await Sentry.getClient()?.close(0);
  Sentry.getCurrentScope().setClient(undefined);
  Sentry.getCurrentScope().clear();
  Sentry.getIsolationScope().clear();
  Sentry.getGlobalScope().clear();
});

describe('a public page failing on its first render', () => {
  it('reports the initial error exactly once when consent was already accepted', async () => {
    act(() => writeConsent('accepted'));

    render(<MarketingTree error={new Error('first render boom')} />);
    await settle();

    expect(eventMessages()).toEqual(['first render boom']);
  });

  it('reports it exactly once when the page is hydrated (consent reads unset during hydration)', async () => {
    act(() => writeConsent('accepted'));
    const container = document.createElement('div');
    document.body.appendChild(container);
    const error = new Error('hydration boom');
    container.innerHTML = renderToString(<MarketingTree error={error} />);

    let root: ReturnType<typeof hydrateRoot> | undefined;
    await act(async () => {
      root = hydrateRoot(container, <MarketingTree error={error} />);
    });
    await settle();

    // Unmount before asserting: a root left mounted would keep reacting to later consent changes.
    act(() => root?.unmount());
    container.remove();

    expect(eventMessages()).toEqual(['hydration boom']);
  });

  it('reports it exactly once under React StrictMode (double effects)', async () => {
    act(() => writeConsent('accepted'));

    render(
      <StrictMode>
        <MarketingTree error={new Error('strict boom')} />
      </StrictMode>,
    );
    await settle();

    expect(eventMessages()).toEqual(['strict boom']);
  });

  it('sends an error raised after SentryBrowser is already initialized immediately, once', async () => {
    act(() => writeConsent('accepted'));
    const view = render(<MarketingTree />);
    expect(Sentry.getClient()).toBeDefined();

    view.rerender(<MarketingTree error={new Error('late boom')} />);
    await settle();

    expect(eventMessages()).toEqual(['late boom']);
  });

  it.each(['rejected', 'unset'] as const)(
    'never reports an error that happened while consent was %s, not even after the visitor accepts later',
    async (state) => {
      if (state === 'rejected') act(() => writeConsent('rejected'));
      render(<MarketingTree error={new Error('before consent')} />);

      act(() => writeConsent('accepted'));
      await settle();

      expect(Sentry.getClient()).toBeDefined();
      expect(eventMessages()).toEqual([]);
    },
  );

  it('drops the queued error when consent is withdrawn before Sentry is ready (no dsn), even if accepted again', async () => {
    act(() => writeConsent('accepted'));
    const view = render(<MarketingTree error={new Error('queued then withdrawn')} dsn="" />);
    act(() => writeConsent('rejected'));
    act(() => writeConsent('accepted'));
    // Sentry becomes ready (a dsn shows up) and the failing page is gone.
    view.rerender(<MarketingTree />);
    await settle();

    expect(eventMessages()).toEqual([]);
  });

  it('clears the queue when the public layout unmounts, so it cannot be sent from a later visit', async () => {
    act(() => writeConsent('accepted'));
    const first = render(<MarketingTree error={new Error('queued, then left')} dsn="" />);
    first.unmount();

    render(<SentryBrowser dsn={DSN} environment="test" />);
    await settle();

    expect(eventMessages()).toEqual([]);
  });
});

describe('errors outside the public pages (root error.tsx and global-error.tsx)', () => {
  it('never queues an error that is later sent from a marketing page', async () => {
    act(() => writeConsent('accepted'));
    const root = render(<ErrorFallback error={new Error('dashboard boom')} reset={noop} />);
    await settle();
    root.unmount();

    // The visitor then navigates to a public page.
    render(<SentryBrowser dsn={DSN} environment="test" />);
    await settle();

    expect(eventMessages()).toEqual([]);
  });

  it('is dropped while the SDK is alive but the gate is closed (after leaving the marketing layout)', async () => {
    act(() => writeConsent('accepted'));
    const marketing = render(<SentryBrowser dsn={DSN} environment="test" />);
    marketing.unmount();

    render(<ErrorFallback error={new Error('dashboard boom 2')} reset={noop} />);
    await settle();
    render(<SentryBrowser dsn={DSN} environment="test" />);
    await settle();

    expect(eventMessages()).toEqual([]);
  });
});
