import type { Event } from '@sentry/nextjs';
import { describe, expect, it } from 'vitest';
import {
  parametrizePath,
  parseTracesSampleRate,
  scrubSpan,
  scrubTransaction,
} from './sentry-tracing';

type SpanJson = NonNullable<Event['spans']>[number];

const PATIENT_ID = '3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b';
const EMAIL = 'ana.perez@example.com';
const CEDULA = '0912345678';
const SENSITIVE = [
  PATIENT_ID,
  EMAIL,
  CEDULA,
  'Ana Pérez',
  'Ana%20P',
  'secret-token',
  'secret-cookie',
  'authorization',
  'cookie',
  'Mozilla',
  'referer',
  'search=',
  'aria-label',
  'avatar.png',
  '203.0.113.9',
  'fragment-note',
];

/** What the browser SDK builds for a page load of a patient, plus everything that must not leave. */
function pageLoad(overrides: Partial<Event> = {}): Event {
  return {
    type: 'transaction',
    event_id: 'evt1',
    platform: 'javascript',
    release: 'abc123',
    environment: 'production',
    start_timestamp: 1000,
    timestamp: 1003.2,
    transaction: '/patients/:id',
    transaction_info: { source: 'route' },
    user: { id: 'u1', email: EMAIL, ip_address: '203.0.113.9' },
    tags: { tenantId: 't1', search: 'Ana Pérez' },
    extra: { form: { name: 'Ana Pérez', cedula: CEDULA } },
    breadcrumbs: [{ category: 'ui.click', message: 'button[aria-label="Ana Pérez"]' }],
    modules: { next: '14' },
    request: {
      url: `https://app.example.com/patients/${PATIENT_ID}?search=Ana%20P&token=secret-token#fragment-note`,
      query_string: 'search=Ana%20P&token=secret-token',
      cookies: { refresh: 'secret-cookie' },
      headers: {
        Referer: `https://app.example.com/patients?search=Ana%20P`,
        'User-Agent': 'Mozilla/5.0',
        authorization: 'Bearer x',
        cookie: 'refresh=secret-cookie',
      },
      data: { name: 'Ana Pérez' },
    },
    contexts: {
      trace: {
        trace_id: 'a'.repeat(32),
        span_id: 'b'.repeat(16),
        op: 'pageload',
        status: 'ok',
        origin: 'auto.pageload.nextjs.app_router_instrumentation',
        data: {
          'sentry.op': 'pageload',
          'sentry.source': 'route',
          'sentry.sample_rate': 0.1,
          'sentry.origin': 'auto.pageload.nextjs.app_router_instrumentation',
          'url.template': '/patients/:id',
          'url.full': `https://app.example.com/patients/${PATIENT_ID}?search=Ana%20P`,
          'url.path': `/patients/${PATIENT_ID}`,
          'lcp.element': 'img[alt="Ana Pérez"]',
          'lcp.url': 'https://cdn.example.com/avatar.png',
          'browser.web_vital.lcp.element': 'h1.patient-name',
          'browser.web_vital.cls.source.1': 'div > button[aria-label="Ana Pérez"]',
          'browser.web_vital.lcp.value': 2400,
          'browser.web_vital.cls.value': 0.05,
        },
      },
      device: { screen_width_pixels: 1920 },
      browser: { name: 'Chrome' },
    },
    measurements: {
      lcp: { value: 2400, unit: 'millisecond' },
      fcp: { value: 900, unit: 'millisecond' },
      cls: { value: 0.05, unit: '' },
      ttfb: { value: 180, unit: 'millisecond' },
      broken: { value: Number.NaN, unit: 'none' },
    },
    sdkProcessingMetadata: {
      dynamicSamplingContext: {
        trace_id: 'a'.repeat(32),
        public_key: 'pk',
        sample_rate: '0.1',
        sampled: 'true',
        transaction: `/patients/${PATIENT_ID}`,
        user_segment: EMAIL,
      },
    },
    spans: [
      {
        span_id: 'c'.repeat(16),
        trace_id: 'a'.repeat(32),
        parent_span_id: 'b'.repeat(16),
        start_timestamp: 1000,
        timestamp: 1000.4,
        op: 'browser.request',
        origin: 'auto.ui.browser.metrics',
        description: `https://app.example.com/patients/${PATIENT_ID}`,
        data: {
          'sentry.op': 'browser.request',
          'http.url': `https://x/patients/${PATIENT_ID}`,
        },
      },
      {
        span_id: 'd'.repeat(16),
        trace_id: 'a'.repeat(32),
        parent_span_id: 'b'.repeat(16),
        start_timestamp: 1000.5,
        timestamp: 1001,
        op: 'resource.fetch',
        description: `GET https://api.example.com/api/v1/patients/${PATIENT_ID}?search=Ana%20P`,
        data: {},
      },
      {
        span_id: 'e'.repeat(16),
        trace_id: 'a'.repeat(32),
        parent_span_id: 'b'.repeat(16),
        start_timestamp: 1000.5,
        timestamp: 1001,
        op: 'resource.img',
        description: 'https://cdn.example.com/avatar.png',
        data: {},
      },
      {
        span_id: 'f'.repeat(16),
        trace_id: 'a'.repeat(32),
        parent_span_id: 'b'.repeat(16),
        start_timestamp: 1001,
        timestamp: 1001.1,
        op: 'ui.action.click',
        description: 'button[aria-label="Ana Pérez"]',
        data: {},
      },
      {
        span_id: '1'.repeat(16),
        trace_id: 'a'.repeat(32),
        start_timestamp: 1001,
        timestamp: 1001.1,
        description: 'no op at all',
        data: {},
      },
    ],
    ...overrides,
  } as Event;
}

describe('parseTracesSampleRate', () => {
  it.each([
    ['0.1', 0.1],
    ['0.05', 0.05],
    [' 0.5 ', 0.5],
    ['1', 1],
    ['.25', 0.25],
  ])('accepts %p', (raw, expected) => {
    expect(parseTracesSampleRate(raw)).toBe(expected);
  });

  it.each([
    undefined,
    '',
    '   ',
    '0',
    'abc',
    '-0.1',
    '1.5',
    '10',
    'NaN',
    'Infinity',
    '1e-1',
    '0x1',
    '5%',
    '0,1',
  ])('turns %p into 0 (tracing off)', (raw) => {
    expect(parseTracesSampleRate(raw)).toBe(0);
  });
});

describe('parametrizePath', () => {
  it('keeps the words of a route and its parameters', () => {
    expect(parametrizePath('/patients/:id')).toBe('/patients/:id');
    expect(parametrizePath('/platform/tenants/:tenantId/edit')).toBe(
      '/platform/tenants/:tenantId/edit',
    );
    expect(parametrizePath('/como-funciona')).toBe('/como-funciona');
    expect(parametrizePath('/')).toBe('/');
    expect(parametrizePath('/docs/:slug*')).toBe('/docs/:slug*');
  });

  it('replaces ids, codes and numbers with :param', () => {
    expect(parametrizePath(`/patients/${PATIENT_ID}`)).toBe('/patients/:param');
    expect(parametrizePath(`/patients/${PATIENT_ID}/records/9/print`)).toBe(
      '/patients/:param/records/:param/print',
    );
    expect(parametrizePath('/verify/ABC123')).toBe('/verify/:param');
    expect(parametrizePath(`/x/${CEDULA}/${EMAIL}`)).toBe('/x/:param/:param');
    expect(parametrizePath('/patients/Ana%20P%C3%A9rez')).toBe('/patients/:param');
  });

  it('treats a verification code written in lowercase words and hyphens as a parameter', () => {
    expect(parametrizePath('/verify/abcd-efgh-jkmn-pqrs')).toBe('/verify/:param');
    expect(parametrizePath('/verify/abcd-efgh-jkmn')).toBe('/verify/:param');
    expect(parametrizePath('/patients/ana-maria-perez-lopez/edit')).toBe('/patients/:param/edit');
  });

  it('keeps the static pages of the app, even with two or more hyphens', () => {
    expect(parametrizePath('/casos-de-exito')).toBe('/casos-de-exito');
    expect(parametrizePath('/tratamiento-de-datos')).toBe('/tratamiento-de-datos');
    expect(parametrizePath('/como-funciona')).toBe('/como-funciona');
    expect(parametrizePath('/forgot-password')).toBe('/forgot-password');
    expect(parametrizePath('/admin/demo-requests')).toBe('/admin/demo-requests');
  });

  it('keeps the dynamic segments of Next routes: [id], [...slug], [[...slug]] and the manifest forms', () => {
    expect(parametrizePath('/patients/[id]/edit')).toBe('/patients/[id]/edit');
    expect(parametrizePath('/docs/[...slug]')).toBe('/docs/[...slug]');
    expect(parametrizePath('/docs/[[...slug]]')).toBe('/docs/[[...slug]]');
    expect(parametrizePath('/docs/:slug*')).toBe('/docs/:slug*');
    // A trailing `?` of an optional catch-all is read as the start of a query string.
    expect(parametrizePath('/docs/:slug*?')).toBe('/docs/:slug*');
    // A bracket that is not a route parameter is still a value.
    expect(parametrizePath('/docs/[ana perez]')).toBe('/docs/:param');
    expect(parametrizePath('/docs/[1234]')).toBe('/docs/:param');
  });

  it('removes query string and fragment', () => {
    expect(parametrizePath('/patients?search=Ana#notes')).toBe('/patients');
    expect(parametrizePath('/patients/:id?x=1')).toBe('/patients/:id');
  });
});

describe('scrubTransaction', () => {
  it('keeps no sensitive value anywhere in the transaction', () => {
    const text = JSON.stringify(scrubTransaction(pageLoad()));

    for (const value of SENSITIVE) expect(text).not.toContain(value);
  });

  it('keeps the parametrized route, durations and the vitals', () => {
    const result = scrubTransaction(pageLoad())!;

    expect(result.transaction).toBe('/patients/:id');
    expect(result.transaction_info).toEqual({ source: 'route' });
    expect([result.start_timestamp, result.timestamp]).toEqual([1000, 1003.2]);
    expect(result.release).toBe('abc123');
    expect(result.environment).toBe('production');
    expect(result.measurements).toEqual({
      lcp: { value: 2400, unit: 'millisecond' },
      fcp: { value: 900, unit: 'millisecond' },
      cls: { value: 0.05, unit: '' },
      ttfb: { value: 180, unit: 'millisecond' },
    });
    expect(result.contexts?.trace).toMatchObject({
      op: 'pageload',
      status: 'ok',
    });
    expect(result.contexts?.trace?.data).toEqual({
      'sentry.op': 'pageload',
      'sentry.source': 'route',
      'sentry.sample_rate': 0.1,
      'sentry.origin': 'auto.pageload.nextjs.app_router_instrumentation',
      'browser.web_vital.lcp.value': 2400,
      'browser.web_vital.cls.value': 0.05,
    });
  });

  it('reduces the page URL to origin and parametrized path, and drops the rest of request', () => {
    const result = scrubTransaction(pageLoad())!;

    expect(result.request).toEqual({
      url: 'https://app.example.com/patients/:param',
    });
  });

  it('removes user, tags, extra, breadcrumbs, modules and the other contexts', () => {
    const result = scrubTransaction(pageLoad())! as Record<string, unknown>;

    for (const key of ['user', 'tags', 'extra', 'breadcrumbs', 'modules']) {
      expect(result[key]).toBeUndefined();
    }
    expect(Object.keys(result.contexts as object)).toEqual(['trace']);
  });

  it('keeps the dynamic sampling context without the transaction name', () => {
    expect(scrubTransaction(pageLoad())!.sdkProcessingMetadata).toEqual({
      dynamicSamplingContext: {
        trace_id: 'a'.repeat(32),
        public_key: 'pk',
        sample_rate: '0.1',
        sampled: 'true',
      },
    });
  });

  it('keeps only the browser phase spans, named by their op', () => {
    const spans = scrubTransaction(pageLoad())!.spans!;

    expect(spans).toHaveLength(1);
    expect(spans[0]).toMatchObject({
      op: 'browser.request',
      description: 'browser.request',
      origin: 'auto.ui.browser.metrics',
      start_timestamp: 1000,
      timestamp: 1000.4,
      data: { 'sentry.op': 'browser.request' },
    });
  });

  describe('transaction name', () => {
    it('never keeps an id of a raw path that no route matched', () => {
      const result = scrubTransaction(
        pageLoad({
          transaction: `/patients/${PATIENT_ID}/edit`,
          transaction_info: { source: 'url' },
        }),
      )!;

      expect(result.transaction).toBe('/patients/:param/edit');
    });

    it('keeps the path of a static page and drops its query and fragment', () => {
      const result = scrubTransaction(
        pageLoad({
          transaction: '/patients?search=Ana#x',
          transaction_info: { source: 'url' },
        }),
      )!;

      expect(result.transaction).toBe('/patients');
    });

    it('accepts a full URL as a name', () => {
      const result = scrubTransaction(
        pageLoad({
          transaction: `https://app.example.com/patients/${PATIENT_ID}?x=1`,
        }),
      )!;

      expect(result.transaction).toBe('/patients/:param');
    });

    it.each([undefined, '', 'something odd', 'GET /patients/[id]'])(
      'falls back to a generic name for %p',
      (name) => {
        expect(scrubTransaction(pageLoad({ transaction: name }))!.transaction).toBe(
          '<unmatched route>',
        );
      },
    );
  });

  it('handles a transaction without spans, contexts, request or measurements', () => {
    const result = scrubTransaction({
      type: 'transaction',
      transaction: '/dashboard',
    } as Event)!;

    expect(result.transaction).toBe('/dashboard');
    expect(result.spans).toBeUndefined();
    expect(result.request).toBeUndefined();
    expect(result.measurements).toBeUndefined();
    expect(result.contexts).toEqual({});
  });

  it('drops the transaction when scrubbing fails instead of sending it untouched', () => {
    const event = pageLoad();
    Object.defineProperty(event, 'spans', {
      get() {
        throw new Error('boom');
      },
      configurable: true,
    });

    expect(scrubTransaction(event)).toBeNull();
  });
});

describe('scrubSpan', () => {
  /** The standalone span of an INP interaction: named after the element that was clicked. */
  const inpSpan = (): SpanJson =>
    ({
      span_id: 'a'.repeat(16),
      trace_id: 'b'.repeat(32),
      start_timestamp: 1000,
      timestamp: 1000.25,
      op: 'ui.interaction.click',
      origin: 'auto.http.browser.inp',
      exclusive_time: 250,
      description: 'body > div > button[aria-label="Ana Pérez"][name="cedula"]',
      data: {
        'sentry.op': 'ui.interaction.click',
        'sentry.origin': 'auto.http.browser.inp',
        'sentry.exclusive_time': 250,
        transaction: `/patients/${PATIENT_ID}`,
        release: 'abc123',
        environment: 'production',
        user: EMAIL,
        replay_id: 'r1',
        'user_agent.original': 'Mozilla/5.0',
        'client.address': '203.0.113.9',
      },
      measurements: { inp: { value: 250, unit: 'millisecond' } },
    }) as SpanJson;

  it('removes the element from the INP span but keeps the value and the page', () => {
    const result = scrubSpan(inpSpan());
    const text = JSON.stringify(result);

    for (const value of [
      'Ana',
      'aria-label',
      'cedula',
      EMAIL,
      'Mozilla',
      '203.0.113.9',
      PATIENT_ID,
    ]) {
      expect(text).not.toContain(value);
    }
    expect(result.description).toBe('ui.interaction.click');
    expect(result.op).toBe('ui.interaction.click');
    expect(result.measurements).toEqual({
      inp: { value: 250, unit: 'millisecond' },
    });
    expect(result.exclusive_time).toBe(250);
    expect(result.data).toEqual({
      'sentry.op': 'ui.interaction.click',
      'sentry.origin': 'auto.http.browser.inp',
      'sentry.exclusive_time': 250,
      transaction: '/patients/:param',
      release: 'abc123',
      environment: 'production',
    });
  });

  it('keeps the parametrized route as the name of the root span of a page load or navigation', () => {
    const root = (op: string): SpanJson =>
      ({
        span_id: 'a'.repeat(16),
        trace_id: 'b'.repeat(32),
        start_timestamp: 1000,
        timestamp: 1002,
        op,
        description: `/patients/${PATIENT_ID}?search=Ana`,
        is_segment: true,
        data: {
          'sentry.op': op,
          'url.full': `https://app.example.com/patients/${PATIENT_ID}`,
        },
      }) as SpanJson;

    for (const op of ['pageload', 'navigation']) {
      const result = scrubSpan(root(op));

      expect(result.description).toBe('/patients/:param');
      expect(result.is_segment).toBe(true);
      expect(result.data).toEqual({ 'sentry.op': op });
    }
  });

  it('reduces a span that cannot be scrubbed to its op', () => {
    const span = inpSpan();
    Object.defineProperty(span, 'data', {
      get() {
        throw new Error('boom');
      },
      configurable: true,
    });

    const result = scrubSpan(span);

    expect(result.description).toBe('ui.interaction.click');
    expect(result.data).toEqual({});
    expect(JSON.stringify(result)).not.toContain('Ana');
  });
});
