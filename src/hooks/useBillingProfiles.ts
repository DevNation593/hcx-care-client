'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { billingProfilesApi } from '@/lib/api/endpoints';
import { QUERY_KEYS } from '@/lib/constants';
import type { ApiError } from '@/types';
import type {
  BillingProfile,
  BillingProfileInput,
  BillingProfileUpdate,
  LinkBillingProfileInput,
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

export function useUnlinkBillingProfile(patientId: string) {
  return useProfileMutation(
    (profileId: string) => billingProfilesApi.unlink(patientId, profileId),
    'Datos de facturación desvinculados',
  );
}
