import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import type { Breadcrumb, ErrorEvent } from '@sentry/nextjs';
import { describe, expect, it } from 'vitest';
import { buildSentryOptions, scrubEvent } from './sentry-options';
import {
  parametrizePath,
  parametrizedFrameFile,
  parametrizedLocation,
  parametrizedTransactionName,
} from './sentry-route';

const DSN = 'https://public@o0.ingest.sentry.io/1';
/** The shape of a code printed on a clinical document: 16 characters of the Crockford alphabet. */
const CODE = 'ABCDEFGHJKMNPQRS';
const CODE_LOWER = 'abcdefghjkmnpqrs';
const PATIENT_ID = '3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b';
const ORIGIN = 'https://app.example.com';

const SECRETS = [CODE, CODE_LOWER, PATIENT_ID, 'Ana', 'secret-fragment', 'x=1'];

function expectNoSecret(value: unknown): void {
  const text = JSON.stringify(value);
  for (const secret of SECRETS) expect(text).not.toContain(secret);
}

function breadcrumbs(): Breadcrumb[] {
  return [
    { category: 'navigation', data: { from: `/verify/${CODE}?x=1`, to: `/patients/${PATIENT_ID}#f` } },
    { category: 'navigation', data: { from: `${ORIGIN}/verify/${CODE_LOWER}`, to: '/patients' } },
    { category: 'fetch', data: { url: `${ORIGIN}/api/verify/${CODE}`, method: 'GET' } },
    { category: 'xhr', data: { url: `/v1/patients/${PATIENT_ID}` } },
    { category: 'ui.click', message: `a[href="/verify/${CODE}"]` },
    { category: 'app.custom', data: { url: `${ORIGIN}/patients/${PATIENT_ID}?q=Ana#secret-fragment` } },
  ];
}

describe('parametrizePath: every dynamic route of the app', () => {
  it('always replaces the segment of /verify/<code>, whatever the code looks like', () => {
    for (const code of [CODE, CODE_LOWER, 'abcd', 'abcd-efgh-jkmn-pqrs', 'ABCD-EFGH-JKMN-PQRS', '0123456789ABCDEF']) {
      expect(parametrizePath(`/verify/${code}`)).toBe('/verify/:param');
    }
    expect(parametrizePath('/verify')).toBe('/verify');
  });

  it('replaces the id of the patients, orders, sessions and tenants, even when it looks like a word', () => {
    expect(parametrizePath('/patients/anamaria')).toBe('/patients/:param');
    expect(parametrizePath('/patients/anamaria/edit')).toBe('/patients/:param/edit');
    expect(parametrizePath('/patients/anamaria/records/recordone/print')).toBe(
      '/patients/:param/records/:param/print',
    );
    expect(parametrizePath('/cash/orders/anamaria')).toBe('/cash/orders/:param');
    expect(parametrizePath('/treatment-sessions/anamaria')).toBe('/treatment-sessions/:param');
    expect(parametrizePath('/platform/tenants/clinicaone')).toBe('/platform/tenants/:param');
  });

  it('keeps the static pages that share a position with a dynamic route, and the route parameters', () => {
    expect(parametrizePath('/patients/new')).toBe('/patients/new');
    expect(parametrizePath('/platform/tenants/new')).toBe('/platform/tenants/new');
    expect(parametrizePath('/patients')).toBe('/patients');
    expect(parametrizePath('/cash')).toBe('/cash');
    expect(parametrizePath('/patients/[id]/records/[recordId]/print')).toBe(
      '/patients/[id]/records/[recordId]/print',
    );
    expect(parametrizePath('/verify/:code')).toBe('/verify/:code');
  });

  /** Every `[param]` directory of the app router must be covered, so a new route cannot leak. */
  it('covers every [param] directory of src/app', () => {
    const appDir = path.join(process.cwd(), 'src', 'app');
    const routes: string[] = [];
    const walk = (dir: string, segments: string[]): void => {
      for (const name of readdirSync(dir)) {
        const full = path.join(dir, name);
        if (!statSync(full).isDirectory()) continue;
        // Private folders `_x` are not routes, and intercepted routes `(.)x`, `(..)x` and `(...)x`
        // show another route under its own URL: both are skipped. Route groups `(x)` and parallel
        // route slots `@x` add no segment to the URL, but what they hold does.
        if (name.startsWith('_') || /^\(\.{1,3}\)/.test(name)) continue;
        if (name.startsWith('@') || /^\(.*\)$/.test(name)) {
          walk(full, segments);
          continue;
        }
        walk(full, [...segments, name]);
      }
      if (segments.some((segment) => segment.startsWith('['))) routes.push('/' + segments.join('/'));
    };
    walk(appDir, []);

    expect(routes.length).toBeGreaterThan(0);
    for (const route of new Set(routes)) {
      // A value made of lowercase letters is the worst case: it looks like a route word.
      const url = route.replace(/\[[^\]]+\]/g, 'abcdefghjkmnpqrs');
      const expected = route.replace(/\[[^\]]+\]/g, ':param');
      expect(parametrizePath(url), route).toBe(expected);
    }
  });
});

describe('API URLs', () => {
  it('parametrizes the public verification endpoint, with a prefix and in any case', () => {
    for (const code of [CODE, CODE_LOWER]) {
      expect(parametrizePath(`/public/documents/${code}`)).toBe('/public/documents/:param');
      expect(parametrizePath(`/api/public/documents/${code}`)).toBe(
        '/api/public/documents/:param',
      );
      expect(parametrizedLocation(`${ORIGIN}/api/public/documents/${code}?x=1`)).toBe(
        `${ORIGIN}/api/public/documents/:param`,
      );
    }
  });

  it('documented limit: another API URL with an id written in lowercase letters is not covered', () => {
    // Only the shape heuristic and DYNAMIC_ROUTES apply. These URLs do not reach Sentry because
    // `http`, `fetch` and `xhr` breadcrumbs are dropped and API errors are not reported by the web.
    expect(parametrizePath('/api/appointments/anamaria')).toBe('/api/appointments/anamaria');
    expect(parametrizePath(`/api/appointments/${PATIENT_ID}`)).toBe(
      '/api/appointments/:param',
    );
  });
});

describe('parametrizedFrameFile', () => {
  it('parametrizes the page URL of a frame, as app:/// or with an origin', () => {
    expect(parametrizedFrameFile(`app:///verify/${CODE}?x=1`)).toBe('app:///verify/:param');
    expect(parametrizedFrameFile(`${ORIGIN}/verify/${CODE}#f`)).toBe(`${ORIGIN}/verify/:param`);
    expect(parametrizedFrameFile(`https://u:pw@app.example.com/patients/${PATIENT_ID}`)).toBe(
      `${ORIGIN}/patients/:param`,
    );
  });

  it('leaves the files of the build untouched: source maps are looked up by that name', () => {
    for (const file of [
      'app:///_next/static/chunks/app/verify/[code]/page-0123abcd.js',
      'app:///_next/static/chunks/main-app-4f6e.js',
      `${ORIGIN}/_next/static/chunks/webpack-1a2b.js`,
      'webpack-internal:///(app-pages-browser)/./src/app/verify/[code]/page.tsx',
      '/var/task/.next/server/chunks/123.js',
      '<anonymous>',
    ]) {
      expect(parametrizedFrameFile(file)).toBe(file);
    }
  });
});

describe('parametrizedLocation and parametrizedTransactionName', () => {
  it('keeps the origin, drops credentials, query and fragment, and parametrizes the path', () => {
    expect(parametrizedLocation(`https://user:pw@app.example.com/verify/${CODE}?x=1#f`)).toBe(
      `${ORIGIN}/verify/:param`,
    );
    expect(parametrizedLocation(`/verify/${CODE}?x=1#f`)).toBe('/verify/:param');
    expect(parametrizedLocation(`verify/${CODE}`)).toBe('<unmatched route>');
  });

  it('parametrizes route names with and without a method', () => {
    expect(parametrizedTransactionName(`/verify/${CODE}`)).toBe('/verify/:param');
    expect(parametrizedTransactionName(`${ORIGIN}/verify/${CODE}?x=1`)).toBe('/verify/:param');
    expect(parametrizedTransactionName('GET /patients/[id]')).toBe('GET /patients/[id]');
    expect(parametrizedTransactionName(`GET /patients/${PATIENT_ID}`)).toBe('GET /patients/:param');
    expect(parametrizedTransactionName('something odd')).toBe('<unmatched route>');
  });
});

describe('error events do not carry the code of /verify/<code> nor a patient id', () => {
  const buildEvent = (): ErrorEvent =>
    ({
      type: undefined,
      message: 'boom',
      transaction: `/verify/${CODE}`,
      tags: { transaction: `GET /verify/${CODE_LOWER}` },
      request: { url: `${ORIGIN}/verify/${CODE}?x=1#secret-fragment`, method: 'GET' },
      breadcrumbs: breadcrumbs(),
    }) as unknown as ErrorEvent;

  it('scrubEvent parametrizes request.url, transaction and the breadcrumbs of the event', () => {
    const result = scrubEvent(buildEvent());

    expect(result?.request?.url).toBe(`${ORIGIN}/verify/:param`);
    expect(result?.transaction).toBe('/verify/:param');
    expect(result?.tags?.transaction).toBe('GET /verify/:param');
    expect(result?.breadcrumbs).toEqual([
      { category: 'navigation', data: { from: '/verify/:param', to: '/patients/:param' } },
      { category: 'navigation', data: { from: `${ORIGIN}/verify/:param`, to: '/patients' } },
      { category: 'app.custom', data: { url: `${ORIGIN}/patients/:param` } },
    ]);
    expectNoSecret(result);
  });

  it('parametrizes a patient page the same way', () => {
    const event = {
      transaction: `/patients/${PATIENT_ID}`,
      request: { url: `${ORIGIN}/patients/${PATIENT_ID}/edit?tab=Ana` },
    } as unknown as ErrorEvent;

    const result = scrubEvent(event);

    expect(result?.request?.url).toBe(`${ORIGIN}/patients/:param/edit`);
    expect(result?.transaction).toBe('/patients/:param');
    expectNoSecret(result);
  });

  it('beforeBreadcrumb parametrizes the locations when the breadcrumb is recorded', () => {
    const before = buildSentryOptions({ dsn: DSN })?.beforeBreadcrumb;
    const kept = breadcrumbs()
      .map((breadcrumb) => before?.(breadcrumb, undefined))
      .filter(Boolean);

    expect(kept).toHaveLength(3);
    expectNoSecret(kept);
  });

  it('through beforeSend of buildSentryOptions, which every runtime uses', () => {
    const beforeSend = buildSentryOptions({ dsn: DSN })?.beforeSend as (e: ErrorEvent) => ErrorEvent | null;

    expectNoSecret(beforeSend(buildEvent()));
  });

  const frameFiles = (result: ErrorEvent | null): string[] =>
    [...(result?.exception?.values ?? []), ...(result?.threads?.values ?? [])].flatMap((entry) =>
      (entry.stacktrace?.frames ?? []).flatMap((frame) => [frame.filename ?? '', frame.abs_path ?? '']),
    );

  const BUILD_FILE = 'app:///_next/static/chunks/app/verify/[code]/page-0123abcd.js';
  const withFrames = (): ErrorEvent =>
    ({
      exception: {
        values: [
          {
            type: 'Error',
            stacktrace: {
              frames: [
                { filename: `app:///verify/${CODE}?x=1`, abs_path: `${ORIGIN}/verify/${CODE}#f`, vars: { a: 1 } },
                { filename: BUILD_FILE, abs_path: BUILD_FILE },
              ],
            },
          },
          // The cause of a chained exception is one more entry.
          { type: 'Error', stacktrace: { frames: [{ filename: `${ORIGIN}/verify/${CODE_LOWER}#f` }] } },
        ],
      },
      threads: {
        values: [{ stacktrace: { frames: [{ filename: `app:///patients/${PATIENT_ID}?q=Ana` }] } }],
      },
    }) as unknown as ErrorEvent;

  it('parametrizes the page URL of the frames of exceptions, causes and threads', () => {
    const result = scrubEvent(withFrames());

    expect(frameFiles(result)).toEqual([
      'app:///verify/:param',
      `${ORIGIN}/verify/:param`,
      BUILD_FILE,
      BUILD_FILE,
      `${ORIGIN}/verify/:param`,
      '',
      'app:///patients/:param',
      '',
    ]);
    expect(result?.exception?.values?.[0].stacktrace?.frames?.[0]).not.toHaveProperty('vars');
    expectNoSecret(result);
  });

  it('keeps the frames of the build identical', () => {
    const result = scrubEvent(withFrames());
    const frame = result?.exception?.values?.[0].stacktrace?.frames?.[1];

    expect(frame).toEqual({ filename: BUILD_FILE, abs_path: BUILD_FILE });
  });

  it('parametrizes contexts.nextjs.request_path of onRequestError, and drops it when scrubbing fails', () => {
    const nextjs = { request_path: `/verify/${CODE_LOWER}?x=1`, router_path: '/verify/[code]' };
    const result = scrubEvent({ contexts: { nextjs } } as unknown as ErrorEvent);

    expect(result?.contexts?.nextjs).toEqual({
      request_path: '/verify/:param',
      router_path: '/verify/[code]',
    });

    const failing = { contexts: { nextjs: { request_path: `/verify/${CODE}` } } } as unknown as ErrorEvent;
    Object.defineProperty(failing, 'request', {
      configurable: true,
      get() {
        throw new Error('boom');
      },
    });
    expectNoSecret(scrubEvent(failing));
  });

  it('fails closed: when scrubbing fails the route, tags and breadcrumbs are dropped', () => {
    const event = buildEvent();
    Object.defineProperty(event, 'request', {
      configurable: true,
      get() {
        throw new Error('boom');
      },
    });

    const result = scrubEvent(event);

    expect(result).not.toBeNull();
    expectNoSecret({ ...result, request: undefined });
  });
});
