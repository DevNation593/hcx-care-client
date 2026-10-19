'use client';

import Link from 'next/link';
import { Lock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/authStore';
import { canManageSubscription } from '@/types/guards';
import { ROUTES } from '@/lib/constants';
import type { ApiError } from '@/types';

const FEATURE_LOCKED_CODES = ['FEATURE_NOT_AVAILABLE', 'MODULE_NOT_AVAILABLE'];

/**
 * True when the API rejected a request because the tenant's plan or module
 * configuration does not include the feature.
 */
export function isFeatureLockedError(error: unknown): boolean {
  const apiError = error as ApiError | null | undefined;
  return (
    !!apiError &&
    apiError.status === 403 &&
    typeof apiError.code === 'string' &&
    FEATURE_LOCKED_CODES.includes(apiError.code)
  );
}

interface FeatureLockedNoticeProps {
  featureName: string;
}

export function FeatureLockedNotice({ featureName }: FeatureLockedNoticeProps) {
  const user = useAuthStore((state) => state.user);
  const canUpgrade = !!user && canManageSubscription(user);

  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <Lock className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-lg font-medium">{featureName} no está disponible para tu consultorio</p>
        <p className="text-sm text-muted-foreground mt-1">
          {canUpgrade
            ? 'Revisa el plan o solicita al administrador de la plataforma que habilite el módulo.'
            : 'Solicita al titular que revise el plan o contacte al administrador de la plataforma.'}
        </p>
        {canUpgrade && (
          <Button asChild className="mt-4">
            <Link href={ROUTES.ADMIN_SUBSCRIPTION}>Ver planes</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
