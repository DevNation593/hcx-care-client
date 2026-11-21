'use client';

import './globals.css';
import { ErrorFallback } from '@/components/monitoring/error-fallback';

// Replaces the root layout when it fails, so it must render its own <html>/<body>.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="es">
      <body>
        <ErrorFallback error={error} reset={reset} />
      </body>
    </html>
  );
}
