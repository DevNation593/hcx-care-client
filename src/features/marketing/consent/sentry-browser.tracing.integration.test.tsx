import path from 'node:path';
import { act, render } from '@testing-library/react';
import * as Sentry from '@sentry/nextjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setBrowserReportingAllowed } from '@/lib/monitoring/browser-gate';
import { resetConsent, writeConsent } from './consent';
import { SentryBrowser } from './sentry-browser';

type Envelope = [Record<string, any>, Array<[Record<string, any>, Record<string, any>]>];
const sent = vi.hoisted(() => [] as unknown[]);

/**
 * The REAL client build of `@sentry/nextjs` (the one the browser runs, with Next's own
 * `browserTracingIntegration`) initialized through `SentryBrowser`, with Web Vitals configured by
 * NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE. Only the network leaf is replaced: `makeFetchTransport`
 * records every envelope that gets past the app's gated transport.
 */
vi.mock('@sentry/nextjs', async () => {
  const entry = path.resolve(process.cwd(), 'node_modules/@sentry/nextjs/build/cjs/index.client.js');
  const real = await import(/* @vite-ignore */ entry);
  return {
    ...real,
    makeFetchTransport: () => ({
      send: async (envelope: unknown) => {
        sent.push(envelope);
        return {};
      },
      flush: async () => true,
    }),
  };
});

const DSN = 'https://public@o0.ingest.sentry.io/1';
const PATIENT_ID = '3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b';

const items = () => (sent as Envelope[]).flatMap((envelope) => envelope[1]);
const itemsOf = (type: string) => items().filter(([header]) => header.type === type);
const integrationNames = () =>
  (Sentry.getClient()?.getOptions().integrations ?? []).map((integration) => integration.name);

/**
 * A root transaction (like a page load) with the route of the page and a measurement. Next's own
 * integration keeps a page load span active, so a plain `startSpan` would only add a child to it.
 */
function sampledTransaction() {
  Sentry.withActiveSpan(null, () => rootTransaction());
}

function rootTransaction() {
  Sentry.startSpan(
    {
      name: `/patients/${PATIENT_ID}?search=Ana`,
      op: 'pageload',
      attributes: { 'sentry.source': 'url' },
    },
    () => {
      Sentry.setMeasurement('lcp', 2400, 'millisecond');
    },
  );
}

/** What the SDK does for the INP of an interaction: a standalone span named after the element. */
function inpSpan() {
  const span = Sentry.startInactiveSpan({
    name: 'body > div > button[aria-label="Ana Pérez"]',
    attributes: { 'sentry.origin': 'auto.http.browser.inp', 'sentry.op': 'ui.interaction.click' },
    experimental: { standalone: true },
  } as never);
  span.end();
}

function mount() {
  act(() => writeConsent('accepted'));
  return render(<SentryBrowser dsn={DSN} environment="test" />);
}

beforeEach(() => {
  window.localStorage.clear();
  act(() => resetConsent());
  setBrowserReportingAllowed(false);
  sent.length = 0;
  (window as unknown as { SENTRY_RELEASE?: { id: string } }).SENTRY_RELEASE = { id: 'test-release' };
  vi.stubEnv('NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE', '1');
});

afterEach(async () => {
  vi.unstubAllEnvs();
  setBrowserReportingAllowed(false);
  await Sentry.getClient()?.close(0);
  Sentry.getCurrentScope().setClient(undefined);
  Sentry.getCurrentScope().clear();
  Sentry.getIsolationScope().clear();
  Sentry.getGlobalScope().clear();
});

describe('Web Vitals through SentryBrowser, with the real SDK', () => {
  it('installs the tracing integrations and neither BrowserSession nor propagation targets', () => {
    mount();

    expect(integrationNames()).toEqual(expect.arrayContaining(['BrowserTracing', 'EnvelopeTraceScrub']));
    expect(integrationNames()).not.toContain('BrowserSession');
    const options = Sentry.getClient()?.getOptions();
    expect(options?.sendClientReports).toBe(false);
    expect(options?.tracePropagationTargets).toEqual([]);
  });

  it('with the gate open (public page, consent) a transaction goes through the gated transport, scrubbed', async () => {
    mount();

    sampledTransaction();
    await Sentry.flush(1000);

    const transaction = itemsOf('transaction').find(([, payload]) => payload.transaction === '/patients/:param');
    expect(transaction).toBeDefined();
    expect(transaction?.[1].measurements).toEqual({ lcp: { value: 2400, unit: 'millisecond' } });
    const text = JSON.stringify(sent);
    for (const leak of [PATIENT_ID, 'search', 'Ana']) expect(text).not.toContain(leak);
  });

  it('with the gate open the INP span carries no element, in the span or in the envelope header', async () => {
    mount();

    inpSpan();
    await Sentry.flush(1000);

    const spanEnvelope = (sent as Envelope[]).find((envelope) => envelope[1].some(([h]) => h.type === 'span'));
    expect(spanEnvelope).toBeDefined();
    const text = JSON.stringify(spanEnvelope);
    for (const leak of ['Ana', 'aria-label', 'button']) expect(text).not.toContain(leak);
    expect(spanEnvelope?.[0].trace).not.toHaveProperty('transaction');
  });

  it('after leaving the public pages (gate closed) no transaction, span or error leaves the browser', async () => {
    const view = mount();
    view.unmount();

    sampledTransaction();
    inpSpan();
    Sentry.captureException(new Error('inside the dashboard'));
    await Sentry.flush(1000);
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(sent).toEqual([]);
  });

  it('after consent is withdrawn on the same page nothing leaves the browser either', async () => {
    mount();
    sampledTransaction();
    await Sentry.flush(1000);
    expect(itemsOf('transaction').length).toBeGreaterThan(0);
    sent.length = 0;

    act(() => writeConsent('rejected'));
    sampledTransaction();
    inpSpan();
    await Sentry.flush(1000);

    expect(sent).toEqual([]);
  });
});

describe('without NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE', () => {
  it('installs no tracing scrubbers and sends no transaction, even with the gate open', async () => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE', '');
    mount();

    sampledTransaction();
    await Sentry.flush(1000);

    expect(integrationNames()).not.toContain('EnvelopeTraceScrub');
    expect(integrationNames()).not.toContain('BrowserSession');
    expect(Sentry.getClient()?.getOptions().tracePropagationTargets).toEqual([]);
    expect(itemsOf('transaction')).toEqual([]);
  });
});
