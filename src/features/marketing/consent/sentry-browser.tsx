'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import { setBrowserReportingAllowed } from '@/lib/monitoring/browser-gate';
import { buildSentryOptions } from '@/lib/monitoring/sentry-options';
import { useConsent } from './consent';

/**
 * Browser error reporting for the public site only (SEC-WEB-09): it is initialized after the
 * visitor accepts cookies and is only allowed to send while this component is mounted, i.e.
 * inside the (marketing) layout. Leaving it, or withdrawing consent, closes the gate.
 */
export function SentryBrowser({ dsn, environment }: { dsn: string | undefined; environment?: string }) {
  const consent = useConsent();
  const active = consent === 'accepted' && !!dsn?.trim();

  useEffect(() => {
    if (!active) return;
    if (!Sentry.getClient()) {
      const options = buildSentryOptions({ dsn, environment });
      if (!options) return;
      Sentry.init(options);
    }
    setBrowserReportingAllowed(true);
    return () => setBrowserReportingAllowed(false);
  }, [active, dsn, environment]);

  return null;
}
