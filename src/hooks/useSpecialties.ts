'use client';

import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/lib/constants';
import { specialtyCatalogApi, tenantModulesApi, tenantSpecialtiesApi } from '@/lib/api/endpoints';
import { useAuthStore } from '@/store/authStore';

function useTenantId(): string | null {
  return useAuthStore((state) => state.tenant?.id ?? state.user?.tenantId ?? null);
}

function requireTenantId(tenantId: string | null): string {
  if (!tenantId) throw new Error('No tenant ID available. User must be authenticated.');
  return tenantId;
}

export function useSpecialtyCatalog() {
  return useQuery({ queryKey: QUERY_KEYS.SPECIALTY_CATALOG, queryFn: specialtyCatalogApi.list });
}

export function useTenantSpecialties(enabled = true) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: QUERY_KEYS.TENANT_SPECIALTIES_SCOPED(tenantId ?? ''),
    queryFn: () => tenantSpecialtiesApi.list(requireTenantId(tenantId)),
    enabled: !!tenantId && enabled,
  });
}

export function useTenantModules() {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: QUERY_KEYS.TENANT_MODULES_SCOPED(tenantId ?? ''),
    queryFn: () => tenantModulesApi.list(requireTenantId(tenantId)),
    enabled: !!tenantId,
  });
}
