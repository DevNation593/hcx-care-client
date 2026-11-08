'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { tenantsApi } from '@/lib/api/endpoints';
import { QUERY_KEYS } from '@/lib/constants';
import { useAuthStore } from '@/store/authStore';
import type { Tenant } from '@/types';
import { useTenantId } from './useTenantScope';

export type ClinicProfileInput = Pick<Tenant, 'name' | 'email' | 'phone' | 'address'>;

const clinicProfileKey = (tenantId: string | null) => [...QUERY_KEYS.TENANT, 'profile', tenantId];

/** The clinic's own contact data, as the admin panel edits it. */
export function useClinicProfile() {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: clinicProfileKey(tenantId),
    queryFn: () => tenantsApi.get(tenantId!),
    enabled: !!tenantId,
  });
}

/** Saves the clinic's contact data and refreshes the name the rest of the app shows. */
export function useUpdateClinicProfile() {
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    // The tenant is captured when the mutation starts: a session switch mid-flight cannot redirect it.
    mutationFn: (input: ClinicProfileInput) => {
      if (!tenantId) throw new Error('No hay un consultorio en la sesión');
      return tenantsApi.update(input, tenantId).then((tenant) => ({ tenant, tenantId }));
    },
    onSuccess: ({ tenant, tenantId: savedId }, input) => {
      queryClient.setQueryData(clinicProfileKey(savedId), tenant);
      const { tenant: current, setTenant } = useAuthStore.getState();
      if (current?.id === savedId) {
        setTenant({
          ...current,
          name: tenant.name ?? input.name,
          email: tenant.email ?? input.email,
          phone: tenant.phone ?? undefined,
          address: tenant.address ?? undefined,
        });
      }
    },
  });
}
