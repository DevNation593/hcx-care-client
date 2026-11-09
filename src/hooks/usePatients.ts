'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { patientsApi, extractArray } from '@/lib/api/endpoints';
import { QUERY_KEYS } from '@/lib/constants';
import { PatientInput } from '@/types';
import { toast } from 'sonner';
import { invalidateScopedLists } from './queryInvalidation';
import { requireTenantId, useTenantId } from './useTenantScope';
import { useTenantMutation } from './useTenantMutation';
import { usePatientTerms } from '@/hooks/usePatientTerms';

export function usePatients(params?: Parameters<typeof patientsApi.list>[0]) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: QUERY_KEYS.PATIENTS_SCOPED(tenantId ?? '', params),
    queryFn: async () => extractArray(await patientsApi.list(params, requireTenantId(tenantId))),
    enabled: !!tenantId,
  });
}

export function usePatient(id: string) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: QUERY_KEYS.PATIENT_DETAIL_SCOPED(tenantId ?? '', id),
    queryFn: () => patientsApi.get(id, requireTenantId(tenantId)),
    enabled: !!tenantId && !!id,
  });
}

export function useCreatePatient() {
  const terms = usePatientTerms();
  const client = useQueryClient();
  return useTenantMutation({
    mutationFn: (data: Partial<PatientInput>, tenantId: string) => patientsApi.create(data, tenantId),
    onSuccess: async (_result, _data, tenantId) => {
      await invalidateScopedLists(client, 'patients', tenantId);
      toast.success(`${terms.One} creado exitosamente`);
    },
    onError: (error: Error) => toast.error(error.message || `Error al crear ${terms.one}`),
  });
}

export function useUpdatePatient(id: string) {
  const terms = usePatientTerms();
  const client = useQueryClient();
  return useTenantMutation({
    captureResource: () => id,
    mutationFn: (data: Partial<PatientInput>, tenantId: string, capturedId: string) =>
      patientsApi.update(capturedId, data, tenantId),
    onSuccess: async (_result, _data, scopedTenant, capturedId) => {
      await Promise.all([
        client.invalidateQueries({ queryKey: QUERY_KEYS.PATIENT_DETAIL_SCOPED(scopedTenant, capturedId), exact: true }),
        invalidateScopedLists(client, 'patients', scopedTenant),
      ]);
      toast.success(`${terms.One} actualizado exitosamente`);
    },
    onError: (error: Error) => toast.error(error.message || `Error al actualizar ${terms.one}`),
  });
}

export function useDeletePatient() {
  const terms = usePatientTerms();
  const client = useQueryClient();
  return useTenantMutation({
    mutationFn: (id: string, tenantId: string) => patientsApi.delete(id, tenantId),
    onSuccess: async (_result, id, scopedTenant) => {
      await Promise.all([
        client.invalidateQueries({ queryKey: QUERY_KEYS.PATIENT_DETAIL_SCOPED(scopedTenant, id), exact: true }),
        invalidateScopedLists(client, 'patients', scopedTenant),
      ]);
      toast.success(`${terms.One} eliminado`);
    },
    onError: (error: Error) => toast.error(error.message || `Error al eliminar ${terms.one}`),
  });
}
