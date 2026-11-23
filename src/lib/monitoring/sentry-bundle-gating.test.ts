import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');

/**
 * With NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE undefined the Web Vitals code must not reach the bundle
 * (+4 kB of shared JS on every route otherwise, measured with `next build`). It takes two things: a
 * condition on the LITERAL `process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` expression, and
 * `next.config.mjs` always defining that variable (empty when it is not set), so the condition is a
 * constant at build time and webpack removes the dead branch. Without the definition the variable is
 * not inlined, the condition stays dynamic and the module stays in the bundle.
 */
describe('Web Vitals code stays out of the bundle when the rate is not defined', () => {
  const config = read('src/features/marketing/consent/sentry-browser.tsx');

  it('SentryBrowser (the only browser init) picks the Web Vitals options on the literal process.env expression', () => {
    expect(config).toMatch(
      /process\.env\.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE\s*\?\s*buildBrowserSentryOptions\(/,
    );
    expect(config).toMatch(/:\s*buildSentryOptions\(env\)/);
  });

  it('next.config.mjs always defines the variable, empty when it is not set', () => {
    expect(read('next.config.mjs')).toMatch(
      /NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE:\s*process\.env\.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE \?\? ''/,
    );
  });

  it('the options shared by browser, server and edge do not import the tracing code', () => {
    const shared = read('src/lib/monitoring/sentry-options.ts');

    expect(shared).not.toMatch(/sentry-tracing|sentry-browser-options/);
    expect(shared).toMatch(/from '\.\/sentry-envelope'/);
    // The route parametrization is a separate small module precisely so it can be shared.
    expect(shared).toMatch(/from '\.\/sentry-route'/);
  });
});

/**
 * SEC-WEB-09: analytics and third-party scripts load only in (marketing), after cookie consent.
 * `sentry.client.config.ts` (or `instrumentation-client.ts`) is injected into every page's bundle by
 * `withSentryConfig`, so the browser SDK is initialized by `SentryBrowser` instead and neither file may exist.
 */
describe('there is no global browser initialization of Sentry', () => {
  it.each(['sentry.client.config.ts', 'sentry.client.config.js', 'instrumentation-client.ts', 'src/instrumentation-client.ts'])(
    '%s does not exist',
    (file) => {
      expect(existsSync(path.join(root, file))).toBe(false);
    },
  );

  it('SentryBrowser is mounted in the (marketing) layout', () => {
    expect(read('src/app/(marketing)/layout.tsx')).toMatch(/<SentryBrowser/);
  });
});
