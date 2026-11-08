'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { specialtyRecordsApi } from '@/lib/api/endpoints';
import { STALE_RECORD_CODES } from '@/lib/clinical-record-errors';
import { QUERY_KEYS } from '@/lib/constants';
import { toast } from 'sonner';
import type { ApiError } from '@/types';
import type { ClinicalRecordCorrection, ClinicalRecordInput } from '@/types/clinical';

export function usePatientSpecialtyRecords(patientId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.PATIENT_SPECIALTY_RECORDS(patientId),
    queryFn: () => specialtyRecordsApi.list(patientId),
    enabled: Boolean(patientId),
  });
}

/** One record, for printing it as a document. */
export function usePatientSpecialtyRecord(patientId: string, recordId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.PATIENT_SPECIALTY_RECORD(patientId, recordId),
    queryFn: () => specialtyRecordsApi.get(patientId, recordId),
    enabled: Boolean(patientId && recordId),
  });
}

/** Alerts raised by the patient's allergies and by the latest record of each other module. */
export function usePatientClinicalAlerts(patientId: string, enabled = true) {
  return useQuery({
    queryKey: QUERY_KEYS.PATIENT_CLINICAL_ALERTS(patientId),
    queryFn: () => specialtyRecordsApi.alerts(patientId),
    enabled: Boolean(patientId) && enabled,
  });
}

function useRecordsInvalidation(patientId: string) {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PATIENT_SPECIALTY_RECORDS(patientId) });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PATIENT_CLINICAL_ALERTS(patientId) });
    // Encounters show how many records they hold.
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PATIENT_ENCOUNTERS(patientId) });
  };
}

// A rejected record carries one issue per field; the form shows those instead of a toast.
const notifyUnlessFieldIssues = (fallback: string) => (error: ApiError) => {
  if (!error.issues?.length) toast.error(error.message || fallback);
};

export function useCreateSpecialtyRecord(patientId: string) {
  const invalidate = useRecordsInvalidation(patientId);

  return useMutation({
    mutationFn: (data: ClinicalRecordInput) => specialtyRecordsApi.create(patientId, data),
    onSuccess: () => {
      invalidate();
      toast.success('Registro guardado');
    },
    onError: notifyUnlessFieldIssues('No fue posible guardar el registro'),
  });
}

export function useCorrectSpecialtyRecord(patientId: string) {
  const invalidate = useRecordsInvalidation(patientId);

  return useMutation({
    mutationFn: ({ recordId, data }: { recordId: string; data: ClinicalRecordCorrection }) =>
      specialtyRecordsApi.update(patientId, recordId, data),
    onSuccess: () => {
      invalidate();
      toast.success('Registro corregido');
    },
    onError: (error: ApiError) => {
      if (error.code && STALE_RECORD_CODES.includes(error.code)) invalidate();
      notifyUnlessFieldIssues('No fue posible corregir el registro')(error);
    },
  });
}

export function useRemoveSpecialtyRecord(patientId: string) {
  const invalidate = useRecordsInvalidation(patientId);

  return useMutation({
    mutationFn: ({ recordId, reason }: { recordId: string; reason: string }) =>
      specialtyRecordsApi.remove(patientId, recordId, reason),
    onSuccess: () => {
      invalidate();
      toast.success('Registro eliminado');
    },
    onError: (error: ApiError) => {
      if (error.code && STALE_RECORD_CODES.includes(error.code)) invalidate();
      toast.error(error.message || 'No fue posible eliminar el registro');
    },
  });
}
