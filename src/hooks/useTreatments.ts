'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { treatmentsApi } from '@/lib/api/endpoints';
import { QUERY_KEYS } from '@/lib/constants';
import type { ApiError } from '@/types';
import type {
  TreatmentFilters,
  TreatmentInput,
  TreatmentUpdate,
  TreatmentVersionInput,
} from '@/types/treatments';

export function useTreatments(filters?: TreatmentFilters) {
  return useQuery({
    queryKey: [...QUERY_KEYS.TREATMENTS, 'list', filters ?? null],
    queryFn: () => treatmentsApi.list(filters),
  });
}

export function useTreatment(id: string) {
  return useQuery({
    queryKey: QUERY_KEYS.TREATMENT(id),
    queryFn: () => treatmentsApi.get(id),
    enabled: Boolean(id),
  });
}

function useTreatmentMutation<TInput>(
  mutationFn: (input: TInput) => Promise<unknown>,
  success: string,
) {
  const queryClient = useQueryClient();
  return useMutation<unknown, ApiError, TInput>({
    mutationFn,
    onSuccess: () => {
      // Lists and details share the TREATMENTS prefix.
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TREATMENTS });
      toast.success(success);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
}

export function useCreateTreatment() {
  return useTreatmentMutation((data: TreatmentInput) => treatmentsApi.create(data), 'Tratamiento creado');
}

export function useUpdateTreatment() {
  return useTreatmentMutation(
    ({ id, data }: { id: string; data: TreatmentUpdate }) => treatmentsApi.update(id, data),
    'Tratamiento actualizado',
  );
}

/** A change of price or requirements is a new version, which becomes the current one. */
export function useAddTreatmentVersion(id: string) {
  return useTreatmentMutation(
    (data: TreatmentVersionInput) => treatmentsApi.addVersion(id, data),
    'Nueva versión guardada',
  );
}
