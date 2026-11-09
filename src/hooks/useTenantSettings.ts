'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tenantSettingsApi } from '@/lib/api/endpoints';
import { useAuthStore } from '@/store/authStore';
import { QUERY_KEYS } from '@/lib/constants';
import { TenantSettings } from '@/types';
import { toast } from 'sonner';

export function useTenantSettings() {
  const tenant = useAuthStore((state) => state.tenant);

  return useQuery({
    queryKey: QUERY_KEYS.TENANT_SETTINGS,
    queryFn: async () => {
      if (!tenant?.id) throw new Error('No tenant');
      return tenantSettingsApi.get();
    },
    enabled: !!tenant?.id,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateTenantSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (settings: Partial<TenantSettings>) => {
      return tenantSettingsApi.update(settings);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TENANT_SETTINGS });
      // The clinical inbox carries the alert thresholds and the overdue marks computed from them.
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.CLINICAL_INBOX_ALL });
      toast.success('Configuración actualizada');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Error al actualizar configuración');
    },
  });
}
