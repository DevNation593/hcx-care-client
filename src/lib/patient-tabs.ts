/**
 * The tabs of a patient's page and the way a screen opened from one of them leads back to it.
 *
 * A screen reached from a tab (a treatment session, a printed record) carries `?from=<tab>`.
 * Its "back" link is built from that tab id alone, checked against this list, and from the
 * patient of the screen itself: nothing else of the URL is ever followed, so a crafted `from`
 * cannot take the user anywhere but to a tab of that patient.
 */
export const PATIENT_TAB_IDS = [
  'overview',
  'team',
  'clinical',
  'specialties',
  'orders',
  'treatments',
  'files',
  'appointments',
  'tasks',
  'session-plan',
  'billing',
] as const;

export type PatientTabId = (typeof PATIENT_TAB_IDS)[number];

/** Query parameter that names the tab a screen was opened from. */
export const RETURN_TAB_PARAM = 'from';

/** The tab a query value names, or undefined when it is missing or not one of the tabs. */
export function parsePatientTab(value: unknown): PatientTabId | undefined {
  return typeof value === 'string' && (PATIENT_TAB_IDS as readonly string[]).includes(value)
    ? (value as PatientTabId)
    : undefined;
}

/** The patient's page open on a tab. */
export function patientTabHref(patientId: string, tab: PatientTabId): string {
  return `/patients/${encodeURIComponent(patientId)}?tab=${tab}`;
}

/** An internal link that remembers the tab it is followed from, so that "back" returns to it. */
export function withReturnTab(href: string, tab: PatientTabId | undefined): string {
  if (!tab) return href;
  return `${href}${href.includes('?') ? '&' : '?'}${RETURN_TAB_PARAM}=${tab}`;
}
