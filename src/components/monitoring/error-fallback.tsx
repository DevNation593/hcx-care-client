'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import { Button } from '@/components/ui/button';

/**
 * `embedded` renders a section for use inside a layout that already provides the page's
 * <main> (e.g. the (marketing) layout); by default it is a full-page <main>.
 */
export function ErrorFallback({
  error,
  reset,
  embedded = false,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  embedded?: boolean;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

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
