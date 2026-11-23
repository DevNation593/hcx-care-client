import { makeFetchTransport } from '@sentry/nextjs';
import type { BrowserOptions } from '@sentry/nextjs';
import { isBrowserReportingAllowed } from './browser-gate';

type BrowserTransport = ReturnType<NonNullable<BrowserOptions['transport']>>;
type IntegrationsOption = BrowserOptions['integrations'];

/**
 * Wraps browser SDK options (`buildSentryOptions`, or `buildBrowserSentryOptions` when Web Vitals
 * are on) with what SEC-WEB-09 requires of the browser SDK, which only `SentryBrowser` initializes:
 *
 * - The transport is gated. `beforeSend` only sees error events; transactions, spans (Web Vitals,
 *   INP), sessions and client reports reach the transport without it. Nothing leaves the browser
 *   unless reporting is currently allowed (public pages, cookie consent).
 * - Release-health sessions (BrowserSession, which would send the user id and user agent on every
 *   navigation) and client reports are switched off altogether.
 *
 * Server and edge never use this: they keep `buildSentryOptions` unchanged.
 */
export function applyBrowserReportingGate(options: BrowserOptions | null): BrowserOptions | null {
  if (!options) return null;

  return {
    ...options,
    sendClientReports: false,
    integrations: withoutBrowserSession(options.integrations),
    transport: (transportOptions) => gateTransport(makeFetchTransport(transportOptions)),
  };
}

/**
 * `integrations` is either an array (added to the defaults, like the tracing integrations of
 * `buildBrowserSentryOptions`) or a function of the defaults. Both become one function that first
 * removes BrowserSession from the defaults, so the SDK resolves them the way it did before.
 */
function withoutBrowserSession(integrations: IntegrationsOption): Exclude<IntegrationsOption, unknown[] | undefined> {
  return (defaults) => {
    const kept = defaults.filter((integration) => integration.name !== 'BrowserSession');
    if (typeof integrations === 'function') return integrations(kept);
    return [...kept, ...(integrations ?? [])];
  };
}

function gateTransport(inner: BrowserTransport): BrowserTransport {
  return {
    // Resolving without a status code makes the SDK treat the envelope as handled and drop it.
    send: (envelope) => (isBrowserReportingAllowed() ? inner.send(envelope) : Promise.resolve({})),
    flush: (timeout) => inner.flush(timeout),
  };
}
