'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { clinicalModulesApi, formDefinitionsApi } from '@/lib/api/endpoints';
import { QUERY_KEYS } from '@/lib/constants';
import { requireTenantId, useTenantId } from '@/hooks/useTenantScope';
import type { ApiError } from '@/types';
import type { FormDefinitionInput, FormDefinitionUpdate } from '@/types/clinical';

/** Every version of the platform modules and of the clinic's own forms. */
export function useClinicalModules(enabled = true) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: QUERY_KEYS.CLINICAL_MODULES(tenantId ?? ''),
    queryFn: () => clinicalModulesApi.list(requireTenantId(tenantId)),
    enabled: !!tenantId && enabled,
  });
}

export function useFormDefinitions() {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: QUERY_KEYS.FORM_DEFINITIONS(tenantId ?? ''),
    queryFn: () => formDefinitionsApi.list(requireTenantId(tenantId)),
    enabled: !!tenantId,
  });
}

/** Creates a form, or updates it when `formId` is given. Field issues stay on the returned error. */
export function useSaveFormDefinition() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();

  return useMutation({
    mutationFn: ({ formId, data }: { formId?: string; data: FormDefinitionInput | FormDefinitionUpdate }) =>
      formId
        ? formDefinitionsApi.update(requireTenantId(tenantId), formId, data)
        : formDefinitionsApi.create(requireTenantId(tenantId), data as FormDefinitionInput),
    onSuccess: () => {
      if (!tenantId) return;
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.FORM_DEFINITIONS(tenantId) });
      // The forms are also served as modules to the patient record.
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.CLINICAL_MODULES(tenantId) });
    },
    onError: (error: ApiError) => {
      toast.error(error.message || 'No fue posible guardar el formulario');
    },
  });
}
