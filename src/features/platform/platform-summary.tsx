'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { usePlatformSummary } from '@/hooks/usePlatform';
import { ROUTES } from '@/lib/constants';
import { formatDate } from '@/lib/utils';

function Counter({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <Card data-testid={`counter-${label}`}>
      <CardContent className="p-4">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-3xl font-bold">{value}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function formatAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat('es', {
    style: 'currency',
    currency,
    currencyDisplay: 'code',
  }).format(amount);
}

export function PlatformSummary() {
  const { data, isPending, isError, refetch } = usePlatformSummary();

  if (isPending) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5" aria-busy="true">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-24" />
        ))}
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="space-y-3">
        <Alert variant="destructive" title="No se pudo cargar el resumen" />
        <Button variant="outline" onClick={() => void refetch()}>
          Reintentar
        </Button>
      </div>
    );
  }

  const { tenants, subscriptions, pendingPayments, trialsEndingSoon, recentTenants } = data;

  if (tenants.active + tenants.suspended === 0 && recentTenants.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
          <p className="font-medium">Aún no hay consultorios registrados</p>
          <Link
            href={ROUTES.PLATFORM_TENANT_NEW}
            className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Nuevo consultorio
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        {tenants.active} consultorios activos y {tenants.suspended} suspendidos
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Counter label="En prueba" value={subscriptions.trialing} />
        <Counter label="Al día" value={subscriptions.active} />
        <Counter label="Vencidos" value={subscriptions.pastDue} />
        <Counter label="Bloqueados" value={subscriptions.blocked} />
        <Link
          href={ROUTES.PLATFORM_PAYMENTS}
          data-testid="counter-pending-payments"
          className="rounded-lg border bg-card p-4 shadow-sm transition-colors hover:bg-muted"
        >
          <p className="text-sm text-muted-foreground">Pagos pendientes</p>
          <p className="text-3xl font-bold">{pendingPayments.count}</p>
          <p className="text-xs text-muted-foreground">
            {formatAmount(pendingPayments.amount, pendingPayments.currency)}
          </p>
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pruebas por terminar</CardTitle>
          </CardHeader>
          <CardContent>
            {trialsEndingSoon.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ninguna prueba termina en los próximos 7 días</p>
            ) : (
              <ul className="space-y-2">
                {trialsEndingSoon.map((trial) => (
                  <li key={trial.id} className="flex items-center justify-between gap-2 text-sm">
                    <Link href={ROUTES.PLATFORM_TENANT_DETAIL(trial.id)} className="font-medium hover:underline">
                      {trial.name}
                    </Link>
                    <span className="text-muted-foreground">{formatDate(trial.trialEndsAt, 'PP')}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Consultorios recientes</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {recentTenants.map((tenant) => (
                <li key={tenant.id} className="flex items-center justify-between gap-2 text-sm">
                  <Link href={ROUTES.PLATFORM_TENANT_DETAIL(tenant.id)} className="font-medium hover:underline">
                    {tenant.name}
                  </Link>
                  <span className="text-muted-foreground">
                    {tenant.planName ?? 'Sin plan'} · {formatDate(tenant.createdAt, 'PP')}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
