'use client';

import { ErrorFallback } from '@/components/monitoring/error-fallback';

/**
 * Render errors on public pages are caught here, inside the (marketing) layout, so the layout
 * (and the consent-gated Sentry browser SDK mounted in it) stays alive and the error is reported.
 * The root app/error.tsx sits above the layout and would unmount it first.
 */
export default function MarketingError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorFallback error={error} reset={reset} embedded />;
}
