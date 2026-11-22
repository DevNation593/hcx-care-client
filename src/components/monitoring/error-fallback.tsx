'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import { Button } from '@/components/ui/button';

export function ErrorFallback({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <h1 className="text-3xl font-bold">Algo salió mal</h1>
      <p className="mt-3 max-w-md text-muted-foreground">
        Ocurrió un error inesperado. Puedes reintentar; si el problema continúa, contacta a soporte.
      </p>
      <Button type="button" className="mt-8" onClick={() => reset()}>
        Reintentar
      </Button>
    </main>
  );
}
