'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { clinicalOrdersApi } from '@/lib/api/endpoints';
import { QUERY_KEYS } from '@/lib/constants';
import type { ApiError } from '@/types';
import type { InboxScope } from '@/types/clinical-orders';

export function usePatientClinicalOrders(patientId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.PATIENT_CLINICAL_ORDERS(patientId),
    queryFn: () => clinicalOrdersApi.list(patientId),
    enabled: Boolean(patientId),
  });
}

export function usePatientClinicalFollowUps(patientId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.PATIENT_CLINICAL_FOLLOW_UPS(patientId),
    queryFn: () => clinicalOrdersApi.listFollowUps(patientId),
    enabled: Boolean(patientId),
  });
}

export function useClinicalInbox(scope: InboxScope) {
  return useQuery({
    queryKey: QUERY_KEYS.CLINICAL_INBOX(scope),
    queryFn: () => clinicalOrdersApi.inbox(scope),
  });
}

/** Messages the API sends for a stale version: the list is reloaded so the user sees the change. */
const VERSION_CONFLICTS = ['CLINICAL_ORDER_VERSION_CONFLICT', 'CLINICAL_FOLLOW_UP_VERSION_CONFLICT'];

/**
 * Every change to an order, a result or a follow-up refreshes the patient's orders, their
 * follow-ups and the inbox, which all show the same items. `patientId` may be unknown (the inbox
 * acts on several patients): then every patient's orders are refreshed.
 */
function useOrderMutation<TInput, TOutput>(
  patientId: string | undefined,
  mutationFn: (input: TInput) => Promise<TOutput>,
  messages: { success: string; error: string },
  options: { quietErrors?: string[] } = {},
) {
  const queryClient = useQueryClient();
  const refresh = () => {
    if (patientId) {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PATIENT_CLINICAL_ORDERS(patientId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PATIENT_CLINICAL_FOLLOW_UPS(patientId) });
    } else {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
    }
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.CLINICAL_INBOX_ALL });
  };
  return useMutation({
    mutationFn,
    onSuccess: () => {
      refresh();
      toast.success(messages.success);
    },
    onError: (error: ApiError) => {
      if (VERSION_CONFLICTS.includes(error.code ?? '')) refresh();
      // The form shows these next to the field that caused them.
      if (options.quietErrors?.includes(error.code ?? '')) return;
      toast.error(error.message || messages.error);
    },
  });
}

export function useCreateClinicalOrder(patientId: string) {
  return useOrderMutation(
    patientId,
    (data: Parameters<typeof clinicalOrdersApi.create>[1]) => clinicalOrdersApi.create(patientId, data),
    { success: 'Orden registrada', error: 'No fue posible registrar la orden' },
    { quietErrors: ['SIGNATURE_PASSWORD_INVALID'] },
  );
}

export function useCollectSample(patientId?: string) {
  return useOrderMutation(
    patientId,
    ({ orderId, ...data }: { orderId: string; version: number; notes?: string }) =>
      clinicalOrdersApi.collectSample(orderId, data),
    { success: 'Toma de muestra registrada', error: 'No fue posible registrar la muestra' },
  );
}

export function useSendToLab(patientId?: string) {
  return useOrderMutation(
    patientId,
    ({
      orderId,
      ...data
    }: { orderId: string; version: number; provider?: string; externalReference?: string }) =>
      clinicalOrdersApi.sendToLab(orderId, data),
    { success: 'Envío registrado', error: 'No fue posible registrar el envío' },
  );
}

export function useAddClinicalResult(patientId?: string) {
  return useOrderMutation(
    patientId,
    ({ orderId, ...data }: { orderId: string } & Parameters<typeof clinicalOrdersApi.addResult>[1]) =>
      clinicalOrdersApi.addResult(orderId, data),
    { success: 'Resultado registrado: queda pendiente de revisión', error: 'No fue posible registrar el resultado' },
  );
}

export function useReviewClinicalResult(patientId?: string) {
  return useOrderMutation(
    patientId,
    ({ resultId, ...data }: { resultId: string } & Parameters<typeof clinicalOrdersApi.review>[1]) =>
      clinicalOrdersApi.review(resultId, data),
    { success: 'Revisión registrada', error: 'No fue posible registrar la revisión' },
  );
}

export function useCommunicateClinicalResult(patientId?: string) {
  return useOrderMutation(
    patientId,
    ({
      resultId,
      ...data
    }: { resultId: string } & Parameters<typeof clinicalOrdersApi.communicate>[1]) =>
      clinicalOrdersApi.communicate(resultId, data),
    { success: 'Comunicación registrada', error: 'No fue posible registrar la comunicación' },
  );
}

export function useCompleteClinicalOrder(patientId?: string) {
  return useOrderMutation(
    patientId,
    ({ orderId, ...data }: { orderId: string; version: number; note?: string }) =>
      clinicalOrdersApi.complete(orderId, data),
    { success: 'Orden cerrada', error: 'No fue posible cerrar la orden' },
  );
}

export function useCancelClinicalOrder(patientId?: string) {
  return useOrderMutation(
    patientId,
    ({ orderId, ...data }: { orderId: string } & Parameters<typeof clinicalOrdersApi.cancel>[1]) =>
      clinicalOrdersApi.cancel(orderId, data),
    { success: 'Orden anulada', error: 'No fue posible anular la orden' },
  );
}

export function useCreateClinicalFollowUp(patientId: string) {
  return useOrderMutation(
    patientId,
    (data: Parameters<typeof clinicalOrdersApi.createFollowUp>[1]) =>
      clinicalOrdersApi.createFollowUp(patientId, data),
    { success: 'Seguimiento creado', error: 'No fue posible crear el seguimiento' },
  );
}

export function useCloseClinicalFollowUp(patientId?: string) {
  return useOrderMutation(
    patientId,
    ({
      followUpId,
      ...data
    }: { followUpId: string } & Parameters<typeof clinicalOrdersApi.closeFollowUp>[1]) =>
      clinicalOrdersApi.closeFollowUp(followUpId, data),
    { success: 'Seguimiento cerrado', error: 'No fue posible cerrar el seguimiento' },
  );
}
