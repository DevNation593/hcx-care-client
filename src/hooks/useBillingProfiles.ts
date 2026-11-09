'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { billingProfilesApi } from '@/lib/api/endpoints';
import { QUERY_KEYS } from '@/lib/constants';
import { useTenantId } from '@/hooks/useTenantScope';
import { invalidateScopedLists } from '@/hooks/queryInvalidation';
import type { ApiError } from '@/types';
import type {
  BillAsPatientInput,
  BillingProfile,
  BillingProfileInput,
  BillingProfileUpdate,
  LinkBillingProfileInput,
  LinkedBillingProfile,
} from '@/types/cash';

export function useBillingProfiles(q?: string, active?: boolean) {
  const search = q?.trim() || undefined;
  return useQuery({
    queryKey: [...QUERY_KEYS.BILLING_PROFILES, 'list', search ?? null, active ?? null],
    queryFn: () => billingProfilesApi.list({ q: search, active }),
  });
}

export function usePatientBillingProfiles(patientId: string) {
  return useQuery({
    queryKey: [...QUERY_KEYS.BILLING_PROFILES, 'patient', patientId],
    queryFn: () => billingProfilesApi.forPatient(patientId),
    enabled: Boolean(patientId),
  });
}

function useProfileMutation<TInput, TResult>(
  mutationFn: (input: TInput) => Promise<TResult>,
  success: string,
) {
  const queryClient = useQueryClient();
  return useMutation<TResult, ApiError, TInput>({
    mutationFn,
    onSuccess: () => {
      // Lists, searches and the per-patient links share the BILLING_PROFILES prefix.
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.BILLING_PROFILES });
      toast.success(success);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
}

export function useCreateBillingProfile() {
  return useProfileMutation<BillingProfileInput, BillingProfile>(
    (data) => billingProfilesApi.create(data),
    'Datos de facturación creados',
  );
}

export function useUpdateBillingProfile() {
  return useProfileMutation<{ id: string; data: BillingProfileUpdate }, BillingProfile>(
    ({ id, data }) => billingProfilesApi.update(id, data),
    'Datos de facturación actualizados',
  );
}

export function useLinkBillingProfile(patientId: string) {
  return useProfileMutation(
    (data: LinkBillingProfileInput) => billingProfilesApi.link(patientId, data),
    'Datos de facturación vinculados',
  );
}

/**
 * Bills in the patient's own name. Errors are left to the caller: a 422 lists the data to
 * complete, which the caller asks for instead of a toast.
 */
export function useBillAsPatient(patientId: string) {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();
  return useMutation<LinkedBillingProfile, ApiError, BillAsPatientInput | undefined>({
    mutationFn: (data) => billingProfilesApi.billAsPatient(patientId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.BILLING_PROFILES });
      // Completed data was written to the patient record, shown in its detail and the lists.
      if (tenantId) {
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.PATIENT_DETAIL_SCOPED(tenantId, patientId),
          exact: true,
        });
        invalidateScopedLists(queryClient, 'patients', tenantId);
      }
    },
  });
}

export function useUnlinkBillingProfile(patientId: string) {
  return useProfileMutation(
    (profileId: string) => billingProfilesApi.unlink(patientId, profileId),
    'Datos de facturación desvinculados',
  );
}
