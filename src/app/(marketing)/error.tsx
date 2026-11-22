'use client';

import { ErrorFallback } from '@/components/monitoring/error-fallback';
import { reportMarketingError } from '@/features/marketing/consent/pending-browser-errors';

/**
 * Render errors on public pages are caught here, inside the (marketing) layout, so the layout
 * (and the consent-gated Sentry browser SDK mounted in it) stays alive and the error is reported.
 * The root app/error.tsx sits above the layout and would unmount it first.
 *
 * Unlike the root boundary, this one reports through `reportMarketingError`: a page that fails
 * on its first render raises the error before `SentryBrowser` has initialized the SDK, so the
 * error is held until it is ready (only if consent was already accepted).
 */
export default function MarketingError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorFallback error={error} reset={reset} embedded report={reportMarketingError} />;
}
