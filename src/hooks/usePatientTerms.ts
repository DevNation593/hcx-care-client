'use client';

import { useTenantSpecialties } from '@/hooks/useSpecialties';
import { useAuthStore } from '@/store/authStore';

/** Specialties that are not health care; mirrors AESTHETIC_SPECIALTY_CODES of the API. */
export const NON_HEALTH_SPECIALTY_CODES: readonly string[] = ['AESTHETICS'];

export function isHealthSpecialtyCode(code: string | null | undefined): boolean {
  return !NON_HEALTH_SPECIALTY_CODES.includes(code ?? '');
}

/** How the people a practice attends are called: patients in health care, clients in aesthetics. */
export interface PatientTerms {
  /** "paciente" or "cliente" */
  one: string;
  /** "pacientes" or "clientes" */
  many: string;
  /** "Paciente" or "Cliente" */
  One: string;
  /** "Pacientes" or "Clientes" */
  Many: string;
  isClient: boolean;
}

const PATIENT_TERMS: PatientTerms = {
  one: 'paciente',
  many: 'pacientes',
  One: 'Paciente',
  Many: 'Pacientes',
  isClient: false,
};

const CLIENT_TERMS: PatientTerms = {
  one: 'cliente',
  many: 'clientes',
  One: 'Cliente',
  Many: 'Clientes',
  isClient: true,
};

export function patientTerms(isClient: boolean): PatientTerms {
  return isClient ? CLIENT_TERMS : PATIENT_TERMS;
}

/**
 * A professional is named by the specialty of their own profile: an aesthetic profile attends
 * clients, a clinical one patients. An account without a profile (owner, reception, cashier)
 * follows the clinic: clients only when every enabled specialty is aesthetic.
 */
export function usePatientTerms(): PatientTerms {
  const profileCode = useAuthStore((state) => state.user?.professionalProfile?.specialty?.code);
  const hasProfile = Boolean(profileCode);
  const specialties = useTenantSpecialties(!hasProfile);

  if (hasProfile) return patientTerms(!isHealthSpecialtyCode(profileCode));

  const codes = (specialties.data ?? []).map((specialty) => specialty.code);
  return patientTerms(codes.length > 0 && codes.every((code) => !isHealthSpecialtyCode(code)));
}
