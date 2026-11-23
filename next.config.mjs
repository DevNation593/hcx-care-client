import { withSentryConfig } from '@sentry/nextjs/config';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  experimental: {
    // Next 14 only loads src/instrumentation.ts with this flag.
    instrumentationHook: true,
  },
  env: {
    // Always defined (empty when not set) so that `if (process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE)`
    // in SentryBrowser (src/features/marketing/consent/sentry-browser.tsx) is a constant and the Web Vitals code leaves the bundle at rate 0.
    NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE: process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? '',
  },
  images: {
    domains: [],
    formats: ['image/avif', 'image/webp'],
  },
  // Enable PWA support
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Service-Worker-Allowed',
            value: '/',
          },
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
        ],
      },
    ];
  },
};

const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN;

// Build-time only: SENTRY_* are never NEXT_PUBLIC. Without the token the build still
// succeeds and source maps are neither generated for Sentry nor uploaded.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: sentryAuthToken,
  // Uploaded maps are deleted from the build output afterwards, so they are never served.
  sourcemaps: {
    disable: !sentryAuthToken,
    deleteSourcemapsAfterUpload: true,
  },
  widenClientFileUpload: true,
  telemetry: false,
});
