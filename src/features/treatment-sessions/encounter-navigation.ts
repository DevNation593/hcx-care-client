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

/** Where "back to the encounter" leads: the specialties tab when that section is on, else treatments. */
export function encounterBackHref(patientId: string, specialtiesEnabled: boolean): string {
  return `/patients/${patientId}?tab=${specialtiesEnabled ? 'specialties' : 'treatments'}`;
}
