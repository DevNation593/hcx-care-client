'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';

/**
 * Atribuye los eventos de Sentry al usuario autenticado.
 * Privacidad: solo se envía el id del usuario y el tenantId como tag
 * (nunca email ni nombre).
 */
export function SentryUserSync(): null {
  const userId = useAuthStore((state) => state.user?.id);
  const tenantId = useAuthStore((state) => state.user?.tenantId);

  useEffect(() => {
    if (userId) {
      Sentry.setUser({ id: userId });
      Sentry.setTag('tenantId', tenantId);
    } else {
      Sentry.setUser(null);
      Sentry.setTag('tenantId', undefined);
    }
  }, [userId, tenantId]);

  return null;
}
