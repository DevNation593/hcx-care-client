'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import { setBrowserReportingAllowed } from '@/lib/monitoring/browser-gate';
import { buildBrowserSentryOptions } from '@/lib/monitoring/browser-options';
import { useConsent } from './consent';
import { clearPendingBrowserErrors, flushPendingBrowserErrors } from './pending-browser-errors';

/** Breadcrumbs gathered while reporting was not allowed must never ride along in a later event. */
function clearBreadcrumbs(): void {
  Sentry.getIsolationScope().clearBreadcrumbs();
  Sentry.getCurrentScope().clearBreadcrumbs();
  Sentry.getGlobalScope().clearBreadcrumbs();
}

/**
 * Browser error reporting for the public site only (SEC-WEB-09). The SDK is initialized after
 * the visitor accepts cookies, and the reporting gate is open only while this component is
 * mounted, i.e. inside the (marketing) layout. After a client-side navigation out of it, or
 * when consent is withdrawn, the SDK stays loaded in memory but the gate closes and nothing is
 * sent (events, sessions or client reports). Mount exactly one instance.
 */
export function SentryBrowser({ dsn, environment }: { dsn: string | undefined; environment?: string }) {
  const consent = useConsent();
  const active = consent === 'accepted' && !!dsn?.trim();

  useEffect(() => {
    if (!active) return;
    if (!Sentry.getClient()) {
      const options = buildBrowserSentryOptions({ dsn, environment });
      if (!options) return;
      Sentry.init(options);
    }
    clearBreadcrumbs();
    setBrowserReportingAllowed(true);
    // Render errors raised before the SDK was ready (see pending-browser-errors.ts).
    flushPendingBrowserErrors();
    return () => {
      setBrowserReportingAllowed(false);
      clearBreadcrumbs();
      clearPendingBrowserErrors();
    };
  }, [active, dsn, environment]);

  // Withdrawn consent: whatever was waiting must never be sent, even if accepted again later.
  // ('unset' is not cleared: during hydration it is the transient server value.)
  useEffect(() => {
    if (consent === 'rejected') clearPendingBrowserErrors();
  }, [consent]);

  // Leaving the public pages: the queue is dropped even if the SDK never became active.
  useEffect(() => clearPendingBrowserErrors, []);

  return null;
}
