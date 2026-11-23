import path from 'node:path';
import * as Sentry from '@sentry/nextjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setBrowserReportingAllowed } from './browser-gate';
import { buildBrowserSentryOptions } from './sentry-browser-options';
import { buildSentryOptions } from './sentry-options';

// Under Node, `@sentry/nextjs` resolves to its server build. The client build is what runs in the
// browser and what `SentryBrowser` configures: the real one, with Next's own
// `browserTracingIntegration`, in jsdom.
vi.mock('@sentry/nextjs', async () => {
  const clientEntry = path.resolve(
    process.cwd(),
    'node_modules/@sentry/nextjs/build/cjs/index.client.js',
  );
  return await import(/* @vite-ignore */ clientEntry);
});

const PATIENT_ID = '3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b';
const DSN = 'https://public@o0.ingest.sentry.io/1';

type Envelope = [Record<string, any>, Array<[Record<string, any>, Record<string, any>]>];

/**
 * The real SDK in jsdom with an in-memory transport (nothing is sent): what really leaves the
 * browser, including the `trace` header of every envelope, which the SDK computes from the live span
 * and which `beforeSendTransaction` / `beforeSendSpan` never see.
 */
function initWithTransport(
  tracesSampleRate: string | undefined,
  { pageLoadIntegration = false } = {},
): Envelope[] {
  const sent: Envelope[] = [];
  const options = buildBrowserSentryOptions({ dsn: DSN, environment: 'test', tracesSampleRate })!;
  Sentry.init({
    ...options,
    // Page load and navigation spans of Next's integration are only under test where asked.
    integrations: (defaults) =>
      [...defaults, ...((options.integrations as never[] | undefined) ?? [])].filter(
        (integration) => pageLoadIntegration || integration.name !== 'BrowserTracing',
      ),
    transport: (() => ({
      send: async (envelope: Envelope) => {
        sent.push(envelope);
        return {};
      },
      flush: async () => true,
    })) as never,
  });
  return sent;
}

const itemsOf = (sent: Envelope[], type: string) =>
  sent.flatMap((e) => e[1]).filter(([header]) => header.type === type);

/** What the SDK does for the INP of an interaction: a standalone span named after the element. */
function startInpSpan() {
  const span = Sentry.startInactiveSpan({
    name: 'body > div > button[aria-label="Ana Pérez"][name="cedula"]',
    attributes: {
      'sentry.origin': 'auto.http.browser.inp',
      'sentry.op': 'ui.interaction.click',
      transaction: `/patients/${PATIENT_ID}?search=Ana`,
      release: 'r',
      environment: 'test',
    },
    experimental: { standalone: true },
  } as never);
  span.end();
}

describe('real client SDK of Next, in memory', () => {
  // These tests are about what the SDK sends (and how it is scrubbed) when reporting is allowed. In the
  // app the browser gate is open only on the public pages after consent (browser-gate.ts); the gated
  // transport is covered in sentry-browser.tracing.integration.test.tsx.
  beforeEach(() => setBrowserReportingAllowed(true));

  afterEach(async () => {
    setBrowserReportingAllowed(false);
    document.head
      .querySelectorAll('meta[name="sentry-trace"], meta[name="baggage"]')
      .forEach((m) => m.remove());
    vi.restoreAllMocks();
    await Sentry.getClient()?.close(0);
  });

  it('sends a scrubbed, parametrized transaction at rate 1', async () => {
    const sent = initWithTransport('1');

    Sentry.startSpan(
      {
        name: `/patients/${PATIENT_ID}?search=Ana`,
        op: 'pageload',
        attributes: {
          'sentry.source': 'url',
          'url.full': `http://localhost/patients/${PATIENT_ID}?search=Ana`,
        },
      },
      () => {
        Sentry.setMeasurement('lcp', 2400, 'millisecond');
        Sentry.setUser({ id: 'u1', email: 'ana@example.com' });
        Sentry.setTag('search', 'Ana Pérez');
        Sentry.startSpan(
          { name: `GET http://api/patients/${PATIENT_ID}`, op: 'http.client' },
          () => {},
        );
      },
    );
    await Sentry.flush(1000);

    const transactions = itemsOf(sent, 'transaction');
    expect(transactions).toHaveLength(1);
    const payload = transactions[0][1];
    expect(payload.transaction).toBe('/patients/:param');
    expect(payload.measurements).toEqual({ lcp: { value: 2400, unit: 'millisecond' } });
    // The whole envelope, header included.
    const text = JSON.stringify(sent);
    for (const leak of [PATIENT_ID, 'search', 'Ana', 'ana@example.com']) {
      expect(text).not.toContain(leak);
    }
    // The page the SDK read from `window.location`: origin and parametrized path only.
    expect(payload.request).toEqual({ url: 'http://localhost:3000/' });
    expect(payload.spans).toEqual([]);
  });

  it('sends nothing at rate 0 (the default)', async () => {
    const sent = initWithTransport(undefined);

    Sentry.startSpan({ name: '/patients/abc', op: 'pageload' }, () => {});
    await Sentry.flush(1000);

    expect(itemsOf(sent, 'transaction')).toHaveLength(0);
  });

  it('an error captured during a sampled page load has no route in the envelope trace header', async () => {
    const sent = initWithTransport('1');

    Sentry.startSpan({ name: `/patients/${PATIENT_ID}?x=1`, op: 'pageload' }, () => {
      Sentry.captureException(new Error('render failed'));
    });
    await Sentry.flush(1000);

    const errorEnvelope = sent.find((e) => e[1].some(([h]) => h.type === 'event'))!;
    expect(errorEnvelope).toBeDefined();
    expect(errorEnvelope[0].trace).toBeDefined();
    expect(errorEnvelope[0].trace).not.toHaveProperty('transaction');
    expect(JSON.stringify(errorEnvelope)).not.toContain(PATIENT_ID);
  });

  it('the INP span carries no element in its name, in the span or in the envelope trace header', async () => {
    const sent = initWithTransport('1');

    startInpSpan();
    await Sentry.flush(1000);

    const spanEnvelope = sent.find((e) => e[1].some(([h]) => h.type === 'span'))!;
    expect(spanEnvelope).toBeDefined();
    const text = JSON.stringify(spanEnvelope);
    for (const leak of ['Ana', 'aria-label', 'cedula', 'button', PATIENT_ID, 'search']) {
      expect(text).not.toContain(leak);
    }
    expect(spanEnvelope[0].trace).not.toHaveProperty('transaction');
    expect(spanEnvelope[0].trace).toMatchObject({ public_key: 'public', sampled: 'true' });
    const [, span] = spanEnvelope[1][0];
    expect(span.description).toBe('ui.interaction.click');
    expect(span.data.transaction).toBe('/patients/:param');
  });

  it('with the default rate nothing is sampled, not even with a forced <meta name="sentry-trace">', async () => {
    const meta = (name: string, content: string) => {
      const element = document.createElement('meta');
      element.name = name;
      element.content = content;
      document.head.appendChild(element);
    };
    meta('sentry-trace', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-bbbbbbbbbbbbbbbb-1');
    meta('baggage', 'sentry-sample_rand=0,sentry-sampled=true');
    const sent = initWithTransport(undefined, { pageLoadIntegration: true });

    // The page load span of the integration ends by itself after its idle timeout.
    await new Promise((resolve) => setTimeout(resolve, 2500));
    await Sentry.flush(1000);

    expect(itemsOf(sent, 'transaction')).toHaveLength(0);
  }, 15_000);

  it('with tracing on, the incoming trace and its sample_rand do not decide: Math.random does', async () => {
    const sent = initWithTransport('0.05');
    const continued = () =>
      Sentry.continueTrace(
        {
          sentryTrace: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-bbbbbbbbbbbbbbbb-1',
          baggage: 'sentry-sample_rand=0,sentry-sampled=true,sentry-sample_rate=1',
        },
        () => Sentry.startSpan({ name: '/patients', op: 'navigation' }, () => {}),
      );

    const random = vi.spyOn(Math, 'random').mockReturnValue(0.9);
    continued();
    await Sentry.flush(1000);
    expect(itemsOf(sent, 'transaction')).toHaveLength(0);

    random.mockReturnValue(0.01);
    continued();
    await Sentry.flush(1000);
    expect(itemsOf(sent, 'transaction')).toHaveLength(1);
  });

  it('buildSentryOptions alone (rate 0 in browser, server and edge) is what SentryBrowser uses when no rate is defined', () => {
    expect(buildSentryOptions({ dsn: DSN })?.tracesSampleRate).toBe(0);
  });
});
