'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import { Button } from '@/components/ui/button';

type RenderError = Error & { digest?: string };

// Module-level so its identity is stable and the reporting effect does not re-run on re-renders.
const captureWithSentry = (error: RenderError): void => {
  Sentry.captureException(error);
};

/**
 * `embedded` renders a section for use inside a layout that already provides the page's
 * <main> (e.g. the (marketing) layout); by default it is a full-page <main>.
 *
 * `report` is how the error is reported. The default is a plain `Sentry.captureException`,
 * which the browser reporting gate drops outside the public pages; only the (marketing)
 * boundary overrides it (to also cover errors raised before Sentry is ready).
 */
export function ErrorFallback({
  error,
  reset,
  embedded = false,
  report = captureWithSentry,
}: {
  error: RenderError;
  reset: () => void;
  embedded?: boolean;
  report?: (error: RenderError) => void;
}) {
  useEffect(() => {
    report(error);
  }, [error, report]);

  const Container = embedded ? 'section' : 'main';
  const size = embedded ? 'py-24' : 'min-h-screen';

  return (
    <Container className={`flex ${size} flex-col items-center justify-center px-4 text-center`}>
      <h1 className="text-3xl font-bold">Algo salió mal</h1>
      <p className="mt-3 max-w-md text-muted-foreground">
        Ocurrió un error inesperado. Puedes reintentar; si el problema continúa, contacta a soporte.
      </p>
      <Button type="button" className="mt-8" onClick={() => reset()}>
        Reintentar
      </Button>
    </Container>
  );
}
