import { AxiosError } from 'axios';
import type { Breadcrumb, ErrorEvent } from '@sentry/nextjs';
import { describe, expect, it } from 'vitest';
import { markApiError } from './api-error-marker';
import { buildSentryOptions, scrubEvent } from './sentry-options';

const DSN = 'https://public@o0.ingest.sentry.io/1';

describe('buildSentryOptions', () => {
  it('returns null without dsn', () => {
    expect(buildSentryOptions({})).toBeNull();
    expect(buildSentryOptions({ dsn: '' })).toBeNull();
    expect(buildSentryOptions({ dsn: '   ' })).toBeNull();
  });

  it('sets dsn and environment; disables tracing, replay and default PII', () => {
    const options = buildSentryOptions({ dsn: DSN, environment: 'production' });

    expect(options).not.toBeNull();
    expect(options?.dsn).toBe(DSN);
    expect(options?.environment).toBe('production');
    expect(options?.tracesSampleRate).toBe(0);
    expect(options?.replaysSessionSampleRate).toBe(0);
    expect(options?.replaysOnErrorSampleRate).toBe(0);
    expect(options?.sendDefaultPii).toBe(false);
    expect(options?.beforeSend).toBe(scrubEvent);
  });

  it('beforeBreadcrumb drops every ui.* category, http, fetch, xhr and console, keeps navigation', () => {
    const before = buildSentryOptions({ dsn: DSN })?.beforeBreadcrumb;
    expect(before).toBeDefined();

    for (const category of ['ui.input', 'ui.click', 'ui.keydown', 'http', 'fetch', 'xhr', 'console']) {
      expect(before?.({ category, message: 'x' }, undefined)).toBeNull();
    }
    const navigation: Breadcrumb = { category: 'navigation', data: { from: '/a', to: '/b' } };
    expect(before?.(navigation, undefined)).toEqual(navigation);
  });

  it('beforeBreadcrumb drops a ui.click whose selector carries an aria-label with patient data', () => {
    const before = buildSentryOptions({ dsn: DSN })?.beforeBreadcrumb;

    const click: Breadcrumb = {
      category: 'ui.click',
      message: 'input[type="radio"][aria-label="Consumo de sustancias: Sí"]',
    };

    expect(before?.(click, undefined)).toBeNull();
  });

  it('beforeBreadcrumb strips query string and fragment from navigation urls', () => {
    const before = buildSentryOptions({ dsn: DSN })?.beforeBreadcrumb;

    const result = before?.(
      { category: 'navigation', data: { from: '/patients?search=Ana', to: '/patients/1#notes' } },
      undefined,
    );

    expect(result?.data).toEqual({ from: '/patients', to: '/patients/1' });
  });
});

describe('scrubEvent', () => {
  it('drops events whose original exception is an AxiosError', () => {
    const event = { message: 'Network Error' } as ErrorEvent;

    expect(scrubEvent(event, { originalException: new AxiosError('Network Error') })).toBeNull();
  });

  it('keeps events whose original exception is not an AxiosError', () => {
    const event = { message: 'boom' } as ErrorEvent;

    expect(scrubEvent(event, { originalException: new Error('boom') })).toBe(event);
  });

  it('removes request body, cookies, headers and query string', () => {
    const event = {
      request: {
        url: 'https://x/patients?search=Ana',
        method: 'POST',
        data: { name: 'Ana' },
        cookies: { session: 'abc' },
        headers: { Authorization: 'Bearer t', Referer: 'https://x/a?q=1' },
        query_string: 'search=Ana',
      },
    } as unknown as ErrorEvent;

    const result = scrubEvent(event);

    expect(result?.request?.url).toBe('https://x/patients');
    expect(result?.request?.data).toBeUndefined();
    expect(result?.request?.cookies).toBeUndefined();
    expect(result?.request?.headers).toBeUndefined();
    expect(result?.request?.query_string).toBeUndefined();
  });

  it('strips the fragment from request.url', () => {
    const event = { request: { url: 'https://x/patients#token=abc' } } as ErrorEvent;

    expect(scrubEvent(event)?.request?.url).toBe('https://x/patients');
  });

  it('keeps only user.id', () => {
    const event = {
      user: { id: 'u1', email: 'a@b.c', username: 'ana', ip_address: '1.2.3.4', tenantId: 't1' },
    } as unknown as ErrorEvent;

    expect(scrubEvent(event)?.user).toEqual({ id: 'u1' });
  });

  it('removes the user when it has no id', () => {
    const event = { user: { email: 'a@b.c' } } as ErrorEvent;

    expect(scrubEvent(event)?.user).toBeUndefined();
  });

  it('removes extra', () => {
    const event = { extra: { __serialized__: { name: 'Ana' } } } as unknown as ErrorEvent;

    expect(scrubEvent(event)?.extra).toBeUndefined();
  });

  it('does not throw on an event without request or user', () => {
    expect(() => scrubEvent({} as ErrorEvent)).not.toThrow();
    expect(scrubEvent({} as ErrorEvent)).toEqual({});
  });

  it('drops an event whose original exception is a marked API error', () => {
    const rejected = markApiError({ code: 'NETWORK_ERROR', message: 'Sin conexion', status: 500 });

    expect(scrubEvent({ message: 'x' } as ErrorEvent, { originalException: rejected })).toBeNull();
  });

  it('keeps an event whose original exception is an unmarked plain object', () => {
    const event = { message: 'x' } as ErrorEvent;
    const thrown = { code: 'NETWORK_ERROR', message: 'Sin conexion', status: 500 };

    expect(scrubEvent(event, { originalException: thrown })).toBe(event);
  });

  it('removes vars from every stack frame', () => {
    const event = {
      exception: {
        values: [
          { type: 'Error', stacktrace: { frames: [{ vars: { name: 'Ana' } }, { filename: 'a.js' }] } },
          { type: 'Error', stacktrace: { frames: [{ vars: { dni: '1' } }] } },
        ],
      },
    } as unknown as ErrorEvent;

    const result = scrubEvent(event);

    for (const value of result?.exception?.values ?? []) {
      for (const frame of value.stacktrace?.frames ?? []) expect(frame).not.toHaveProperty('vars');
    }
  });

  it('still removes vars when scrubbing fails midway', () => {
    const event = {
      exception: { values: [{ type: 'Error', stacktrace: { frames: [{ vars: { name: 'Ana' } }] } }] },
    } as unknown as ErrorEvent;
    Object.defineProperty(event, 'request', {
      configurable: true,
      get() {
        throw new Error('boom');
      },
    });

    const result = scrubEvent(event);

    expect(result?.exception?.values?.[0].stacktrace?.frames?.[0]).not.toHaveProperty('vars');
  });

  it('drops request, user and extra instead of throwing when scrubbing fails', () => {
    const event = {
      user: { id: 'u1', email: 'a@b.c' },
      extra: { secret: 1 },
    } as unknown as ErrorEvent;
    Object.defineProperty(event, 'request', {
      configurable: true,
      get() {
        throw new Error('boom');
      },
    });

    let result: ErrorEvent | null = null;
    expect(() => {
      result = scrubEvent(event);
    }).not.toThrow();
    expect(result).not.toBeNull();
    expect((result as unknown as ErrorEvent).user).toBeUndefined();
    expect((result as unknown as ErrorEvent).extra).toBeUndefined();
  });
});
