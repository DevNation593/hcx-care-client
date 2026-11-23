import { readFileSync } from 'node:fs';
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
  const config = read('sentry.client.config.ts');

  it('sentry.client.config.ts picks the Web Vitals options on the literal process.env expression', () => {
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
