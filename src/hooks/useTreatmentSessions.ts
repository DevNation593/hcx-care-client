'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { treatmentSessionsApi } from '@/lib/api/endpoints';
import { QUERY_KEYS } from '@/lib/constants';
import type { ApiError } from '@/types';
import type {
  ConsentDocument,
  SessionMediaPhase,
  SignConsentInput,
  TreatmentSessionDetail,
  TreatmentSessionInput,
} from '@/types/treatments';

export function usePatientTreatmentSessions(patientId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.PATIENT_TREATMENT_SESSIONS(patientId),
    queryFn: () => treatmentSessionsApi.listForPatient(patientId),
    enabled: Boolean(patientId),
  });
}

export function useTreatmentSession(id: string) {
  return useQuery({
    queryKey: QUERY_KEYS.TREATMENT_SESSION(id),
    queryFn: () => treatmentSessionsApi.get(id),
    enabled: Boolean(id),
  });
}

/** Opens a session of a treatment on a new procedure encounter of the patient. */
export function useCreateTreatmentSession(patientId: string) {
  const queryClient = useQueryClient();
  return useMutation<Awaited<ReturnType<typeof treatmentSessionsApi.create>>, ApiError, TreatmentSessionInput>({
    mutationFn: (data) => treatmentSessionsApi.create(patientId, data),
    onSuccess: (session) => {
      queryClient.setQueryData(QUERY_KEYS.TREATMENT_SESSION(session.id), session);
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PATIENT_TREATMENT_SESSIONS(patientId) });
      // The session opens an encounter and moves its appointment along.
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PATIENT_ENCOUNTERS(patientId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.APPOINTMENTS });
      toast.success('Atención de tratamiento iniciada');
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
}

/**
 * A command of a session. It refreshes the session and the patients' lists of sessions. A 422
 * that blocks a start or a completion keeps its `missing` list on the error and shows no toast:
 * the step shows what is missing.
 */
function useSessionMutation<TInput, TResult>(
  id: string,
  mutationFn: (input: TInput) => Promise<TResult>,
  success: string,
  onDone?: () => void,
) {
  const queryClient = useQueryClient();
  return useMutation<TResult, ApiError, TInput>({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TREATMENT_SESSION(id) });
      // The hook knows the session, not its patient: refresh the lists of every patient.
      queryClient.invalidateQueries({
        predicate: ({ queryKey }) =>
          queryKey[0] === 'patients' && queryKey[2] === 'treatment-sessions',
      });
      // A transition moves the encounter and the appointment of the session.
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.APPOINTMENTS });
      onDone?.();
      toast.success(success);
    },
    onError: (error) => {
      if (error.missing?.length) return;
      toast.error(error.message);
    },
  });
}

/** One mutation per command of the session: form, consent, photos and transitions. */
export function useSessionCommand(id: string) {
  const queryClient = useQueryClient();
  // Photos count against the storage of the plan.
  const refreshStorage = () => {
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.STORAGE_FILES });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.STORAGE_BREAKDOWN });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SUBSCRIPTION_USAGE });
  };

  return {
    saveForm: useSessionMutation(
      id,
      (data: Record<string, unknown>) => treatmentSessionsApi.saveForm(id, data),
      'Ficha guardada',
    ),
    presentConsent: useSessionMutation<void, ConsentDocument>(
      id,
      () => treatmentSessionsApi.presentConsent(id),
      'Consentimiento presentado',
    ),
    signConsent: useSessionMutation(
      id,
      ({ documentId, input }: { documentId: string; input: SignConsentInput }) =>
        treatmentSessionsApi.signConsent(documentId, input),
      'Consentimiento firmado',
    ),
    refuseConsent: useSessionMutation(
      id,
      ({ documentId, reason }: { documentId: string; reason: string }) =>
        treatmentSessionsApi.refuseConsent(documentId, reason),
      'Consentimiento rechazado',
    ),
    revokeConsent: useSessionMutation(
      id,
      ({ documentId, reason }: { documentId: string; reason: string }) =>
        treatmentSessionsApi.revokeConsent(documentId, reason),
      'Consentimiento revocado',
    ),
    uploadMedia: useSessionMutation(
      id,
      ({ file, phase, description }: { file: File; phase: SessionMediaPhase; description?: string }) =>
        treatmentSessionsApi.uploadMedia(id, file, phase, description),
      'Foto guardada',
      refreshStorage,
    ),
    start: useSessionMutation<void, TreatmentSessionDetail>(
      id,
      () => treatmentSessionsApi.start(id),
      'Procedimiento iniciado',
    ),
    complete: useSessionMutation(
      id,
      (procedureNotes?: string) => treatmentSessionsApi.complete(id, procedureNotes),
      'Atención cerrada',
    ),
    cancel: useSessionMutation(
      id,
      (reason: string) => treatmentSessionsApi.cancel(id, reason),
      'Atención cancelada',
    ),
    noShow: useSessionMutation<void, TreatmentSessionDetail>(
      id,
      () => treatmentSessionsApi.noShow(id),
      'Inasistencia registrada',
    ),
  };
}
