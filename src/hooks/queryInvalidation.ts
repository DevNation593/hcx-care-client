import type { QueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/lib/constants';

/** What closing an encounter signs: its records, the alerts and the procedure consents of the patient. */
export function invalidateSignedEncounter(client: QueryClient, patientId: string) {
  client.invalidateQueries({ queryKey: QUERY_KEYS.PATIENT_ENCOUNTERS(patientId) });
  client.invalidateQueries({ queryKey: QUERY_KEYS.PATIENT_SPECIALTY_RECORDS(patientId) });
  client.invalidateQueries({ queryKey: QUERY_KEYS.PATIENT_CLINICAL_ALERTS(patientId) });
  client.invalidateQueries({ queryKey: QUERY_KEYS.PATIENT_PROCEDURE_CONSENTS(patientId) });
}

/**
 * The details of the sessions of an encounter list their siblings and the encounter status: adding,
 * completing, cancelling or closing refreshes the ones already visited, which would otherwise be
 * served from the cache for its stale time.
 */
export function invalidateEncounterSessions(client: QueryClient, encounterId: string) {
  client.invalidateQueries({
    predicate: ({ queryKey, state }) =>
      queryKey[0] === 'treatment-sessions' &&
      queryKey.length === 2 &&
      (state.data as { encounterId?: string } | undefined)?.encounterId === encounterId,
  });
}

// List variants use an object (or undefined) at index 3; details use an ID.
export function invalidateScopedLists(client: QueryClient, resource: 'patients' | 'appointments', tenantId: string) {
  return client.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey;
      return key[0] === resource && key[1] === 'tenant' && key[2] === tenantId
        && key.length === 4 && typeof key[3] !== 'string';
    },
  });
}
