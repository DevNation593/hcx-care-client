'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import { setBrowserReportingAllowed } from '@/lib/monitoring/browser-gate';
import { buildBrowserSentryOptions } from '@/lib/monitoring/browser-options';
import { useConsent } from './consent';

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
    return () => {
      setBrowserReportingAllowed(false);
      clearBreadcrumbs();
    };
  }, [active, dsn, environment]);

  return null;
}
