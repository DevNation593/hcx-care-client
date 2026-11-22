/**
 * Switch that decides whether the browser Sentry SDK may send anything (SEC-WEB-09).
 *
 * The SDK is initialized on a public (marketing) page after cookie consent, but a client-side
 * navigation into the dashboard, platform or auth areas does not unload it: it stays in memory.
 * What keeps those areas out is this gate, which is closed unless `SentryBrowser` is mounted
 * with accepted consent. It is read by the SDK's transport, `beforeSend` and `beforeBreadcrumb`
 * (outside React), hence plain module state.
 *
 * It is a boolean, not a counter: exactly one `SentryBrowser` instance is supported, the one in
 * the (marketing) layout. A second instance unmounting would close the gate for the first.
 */
let allowed = false;

export function setBrowserReportingAllowed(next: boolean): void {
  allowed = next;
}

export function isBrowserReportingAllowed(): boolean {
  return allowed;
}
