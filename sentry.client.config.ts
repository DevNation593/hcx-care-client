import * as Sentry from '@sentry/nextjs';
import { buildBrowserSentryOptions } from '@/lib/monitoring/sentry-browser-options';
import { buildSentryOptions } from '@/lib/monitoring/sentry-options';

const env = {
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
};

// NEXT_PUBLIC_* is inlined at build time, and next.config.mjs always defines this one (empty when it is
// not set). Without a sample rate the condition below is the constant `''`: the Web Vitals branch is
// dead code and nothing of `sentry-browser-options` (scrubbers, tracing integration options) reaches the
// bundle. The condition must stay the literal `process.env.NEXT_PUBLIC_...` expression and next.config.mjs
// must keep defining it: without the definition the branch is not constant and the bundle grows by 4 kB.
// An invalid value still means rate 0.
const options = process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE
  ? buildBrowserSentryOptions({
      ...env,
      tracesSampleRate: process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE,
    })
  : buildSentryOptions(env);

if (options) Sentry.init(options);
