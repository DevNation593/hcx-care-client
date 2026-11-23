import { patientTabHref, type PatientTabId } from '@/lib/patient-tabs';
import type { TreatmentSessionDetail, TreatmentSessionStatus } from '@/types/treatments';

/** A session in these statuses still has clinical work pending. */
const UNFINISHED: TreatmentSessionStatus[] = [
  'INTAKE_IN_PROGRESS',
  'READY_FOR_CONSENT',
  'CONSENTED',
  'IN_PROGRESS',
];

type SiblingSession = TreatmentSessionDetail['encounterSessions'][number];

/** The other sessions of the encounter that are not finished yet (none for older payloads). */
export function unfinishedSiblings(session: Pick<TreatmentSessionDetail, 'encounterSessions'>): SiblingSession[] {
  return (session.encounterSessions ?? []).filter((sibling) => UNFINISHED.includes(sibling.status));
}

/**
 * Where "back" leads: the tab the screen was opened from (`?from=`), so that coming from the
 * clinical history returns to it. Without it, the specialties tab when that section is on, else
 * treatments.
 */
export function encounterBackHref(
  patientId: string,
  specialtiesEnabled: boolean,
  from?: PatientTabId,
): string {
  return patientTabHref(patientId, from ?? (specialtiesEnabled ? 'specialties' : 'treatments'));
}

/** What the back link says, naming the clinical history when that is where it leads. */
export function encounterBackLabel(from?: PatientTabId): string {
  return from === 'clinical' ? 'Volver a la historia clínica' : 'Volver a la atención';
}
