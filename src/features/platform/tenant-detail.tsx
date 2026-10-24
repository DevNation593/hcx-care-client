'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePlatformTenant } from '@/hooks/usePlatform';
import { ROUTES } from '@/lib/constants';
import type { ApiError } from '@/types';
import { TenantAccountCard } from './tenant-account-card';
import { TenantMasterCard } from './tenant-master-card';
import { TenantPlanCard } from './tenant-plan-card';
import { TenantSectionsCard } from './tenant-sections-card';
import { TenantStatusCard } from './tenant-status-card';
import { TenantRolePermissionsCard } from './tenant-role-permissions-card';
import { TenantClinicalModulesCard } from './tenant-clinical-modules-card';

const backLink = (
  <Link href={ROUTES.PLATFORM_TENANTS} className="text-sm underline">
    Volver a consultorios
  </Link>
);

export function TenantDetail({ tenantId }: { tenantId: string }) {
  const { data, isLoading, isError, error, refetch } = usePlatformTenant(tenantId);

  if (isLoading) return <p role="status">Cargando consultorio…</p>;

  if (isError || !data) {
    if ((error as ApiError | null)?.status === 404) {
      return (
        <Card>
          <CardHeader>
            <CardTitle>Consultorio no encontrado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p>El consultorio que buscas no existe.</p>
            {backLink}
          </CardContent>
        </Card>
      );
    }
    return (
      <div className="space-y-3">
        <p role="alert">No se pudo cargar el consultorio.</p>
        <Button type="button" variant="outline" onClick={() => void refetch()}>Reintentar</Button>
        <div>{backLink}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        {backLink}
        <h1 className="text-2xl font-bold">{data.tenant.name}</h1>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <TenantAccountCard tenant={data.tenant} />
        <TenantMasterCard tenantId={tenantId} master={data.master} />
        <TenantPlanCard tenantId={tenantId} tenantType={data.tenant.tenantType} subscription={data.subscription} usage={data.usage} />
        <TenantStatusCard tenantId={tenantId} tenant={data.tenant} status={data.subscription.status} />
      </div>
      <TenantSectionsCard
        key={`${tenantId}:sections`}
        tenantId={tenantId}
        planId={data.subscription.plan.id}
        specialtyCodes={data.specialties.map((specialty) => specialty.code)}
        sections={data.sections}
      />
      <TenantRolePermissionsCard key={`${tenantId}:roles`} tenantId={tenantId} />
      <TenantClinicalModulesCard key={`${tenantId}:clinical`} tenantId={tenantId} detail={data} />
    </div>
  );
}
