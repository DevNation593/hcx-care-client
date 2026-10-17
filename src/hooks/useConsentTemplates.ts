'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { consentTemplatesApi } from '@/lib/api/endpoints';
import { QUERY_KEYS } from '@/lib/constants';
import type { ApiError } from '@/types';
import type { ConsentDraftInput, ConsentTemplateInput } from '@/types/treatments';

export function useConsentTemplates() {
  return useQuery({
    queryKey: QUERY_KEYS.CONSENT_TEMPLATES,
    queryFn: () => consentTemplatesApi.list(),
  });
}

export function useConsentTemplate(id: string) {
  return useQuery({
    queryKey: QUERY_KEYS.CONSENT_TEMPLATE(id),
    queryFn: () => consentTemplatesApi.get(id),
    enabled: Boolean(id),
  });
}

function useConsentTemplateMutation<TInput>(
  mutationFn: (input: TInput) => Promise<unknown>,
  success: string,
) {
  const queryClient = useQueryClient();
  return useMutation<unknown, ApiError, TInput>({
    mutationFn,
    onSuccess: () => {
      // The listing and every template detail share the CONSENT_TEMPLATES prefix.
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.CONSENT_TEMPLATES });
      toast.success(success);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
}

export function useCreateConsentTemplate() {
  return useConsentTemplateMutation(
    (data: ConsentTemplateInput) => consentTemplatesApi.create(data),
    'Plantilla creada',
  );
}

/** Replaces the open draft, or starts the next version as a draft. */
export function useSaveConsentDraft(id: string) {
  return useConsentTemplateMutation(
    (data: ConsentDraftInput) => consentTemplatesApi.saveDraft(id, data),
    'Borrador guardado',
  );
}

export function usePublishConsent(id: string) {
  return useConsentTemplateMutation(() => consentTemplatesApi.publish(id), 'Versión publicada');
}

export function useRetireConsentVersion() {
  return useConsentTemplateMutation(
    (versionId: string) => consentTemplatesApi.retire(versionId),
    'Versión retirada',
  );
}
