import { makeFetchTransport } from '@sentry/nextjs';
import type { BrowserOptions } from '@sentry/nextjs';
import { isBrowserReportingAllowed } from './browser-gate';
import { buildSentryOptions } from './sentry-options';

/**
 * Options for the browser SDK only (SEC-WEB-09). On top of the shared minimum-data options:
 *
 * - The transport is gated: `beforeSend` only sees events, but sessions and client reports
 *   reach the transport without passing through it, so nothing leaves the browser unless
 *   reporting is currently allowed.
 * - Release-health sessions (BrowserSession, which would send the user id and user agent on
 *   every navigation) and client reports are switched off altogether.
 *
 * Server and edge keep using `buildSentryOptions` unchanged.
 */
export function buildBrowserSentryOptions(env: {
  dsn?: string;
  environment?: string;
}): BrowserOptions | null {
  const options = buildSentryOptions(env);
  if (!options) return null;

  return {
    ...options,
    sendClientReports: false,
    integrations: (defaults) => defaults.filter((integration) => integration.name !== 'BrowserSession'),
    transport: (transportOptions) => gateTransport(makeFetchTransport(transportOptions)),
  };
}

type BrowserTransport = ReturnType<NonNullable<BrowserOptions['transport']>>;

function gateTransport(inner: BrowserTransport): BrowserTransport {
  return {
    // Resolving without a status code makes the SDK treat the envelope as handled and drop it.
    send: (envelope) => (isBrowserReportingAllowed() ? inner.send(envelope) : Promise.resolve({})),
    flush: (timeout) => inner.flush(timeout),
  };
}
