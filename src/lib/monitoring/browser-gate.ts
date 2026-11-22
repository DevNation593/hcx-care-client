/**
 * Switch that decides whether the browser Sentry SDK may send events (SEC-WEB-09).
 *
 * The SDK is only initialized on the public (marketing) pages after cookie consent, but once
 * initialized it survives client-side navigation into the dashboard, platform and auth areas.
 * This gate stays closed unless `SentryBrowser` is mounted with accepted consent, so events
 * raised anywhere else are discarded in `beforeSend`. It is module state on purpose: it is
 * read from the SDK hook, outside React.
 */
let allowed = false;

export function setBrowserReportingAllowed(next: boolean): void {
  allowed = next;
}

export function isBrowserReportingAllowed(): boolean {
  return allowed;
}
