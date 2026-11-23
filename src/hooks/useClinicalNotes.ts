'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clinicalNotesApi, extractArray } from '@/lib/api/endpoints';
import { QUERY_KEYS } from '@/lib/constants';
import type { ClinicalNote, ClinicalNoteCorrection } from '@/types';
import { toast } from 'sonner';
import { isFeatureLockedError } from '@/features/subscription/feature-locked-notice';

const retryUnlessLocked = (failureCount: number, error: unknown) =>
  !isFeatureLockedError(error) && failureCount < 1;

export function useClinicalNotes(params?: Parameters<typeof clinicalNotesApi.list>[0]) {
  return useQuery({
    queryKey: [...QUERY_KEYS.PATIENTS, 'clinical-notes', params],
    queryFn: async () => {
      const response = await clinicalNotesApi.list(params);
      return extractArray(response);
    },
    retry: retryUnlessLocked,
  });
}

export function usePatientClinicalNotes(patientId: string, enabled = true) {
  return useQuery({
    queryKey: QUERY_KEYS.PATIENT_CLINICAL_NOTES(patientId),
    queryFn: async () => {
      const response = await clinicalNotesApi.list({ patientId });
      return extractArray(response);
    },
    enabled: !!patientId && enabled,
    retry: retryUnlessLocked,
  });
}

export function useClinicalNote(noteId: string) {
  return useQuery({
    queryKey: ['clinical-notes', noteId],
    queryFn: () => clinicalNotesApi.get(noteId),
    enabled: !!noteId,
    retry: retryUnlessLocked,
  });
}

export function useCreateClinicalNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<ClinicalNote>) => clinicalNotesApi.create(data),
    onSuccess: (_, variables) => {
      if (variables.patientId) {
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.PATIENT_CLINICAL_NOTES(variables.patientId),
        });
      }
      toast.success('Nota clínica creada exitosamente');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Error al crear nota clínica');
    },
  });
}

export function useUpdateClinicalNote(noteId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ClinicalNoteCorrection) => clinicalNotesApi.update(noteId, data),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['clinical-notes', noteId] });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.PATIENT_CLINICAL_NOTES(updated.patientId),
      });
      toast.success('Nota clínica actualizada');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Error al actualizar nota clínica');
    },
  });
}

export function useDeleteClinicalNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ noteId, reason }: { noteId: string; patientId: string; reason: string }) =>
      clinicalNotesApi.delete(noteId, reason),
    onSuccess: (_, { patientId }) => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.PATIENT_CLINICAL_NOTES(patientId),
      });
      toast.success('Nota clínica eliminada');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Error al eliminar nota clínica');
    },
  });
}
