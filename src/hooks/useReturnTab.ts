'use client';

import { useSearchParams } from 'next/navigation';
import { parsePatientTab, RETURN_TAB_PARAM, type PatientTabId } from '@/lib/patient-tabs';

/** The tab of the patient's page this screen was opened from (`?from=`), if it names a real one. */
export function useReturnTab(): PatientTabId | undefined {
  const searchParams = useSearchParams();
  return parsePatientTab(searchParams?.get(RETURN_TAB_PARAM));
}
