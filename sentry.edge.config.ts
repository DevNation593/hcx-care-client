import * as Sentry from '@sentry/nextjs';
import { buildSentryOptions } from '@/lib/monitoring/sentry-options';

const options = buildSentryOptions({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
});

if (options) Sentry.init(options);
