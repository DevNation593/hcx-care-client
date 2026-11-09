'use client';

import { SectionGate } from '@/components/layout/section-gate';
import { RestrictedAccess } from '@/components/layout/restricted-access';
import { ClinicalInboxView } from '@/features/clinical-orders/clinical-inbox';
import { useMyPermissions } from '@/hooks/usePermissions';
import { useAuthStore } from '@/store/authStore';
import { canAccessClinicalNotes } from '@/types/guards';
import { isHealthSpecialtyCode } from '@/hooks/usePatientTerms';

export default function ClinicalPendingPage() {
  const user = useAuthStore((state) => state.user);
  const { can } = useMyPermissions();
  if (!user) return null;
  // Results and follow-ups are clinical content: only an active health care profile reads them.
  if (
    !canAccessClinicalNotes(user) ||
    !isHealthSpecialtyCode(user.professionalProfile?.specialty?.code) ||
    !can('clinical_records.view')
  ) {
    return <RestrictedAccess />;
  }
  return (
    <SectionGate section="core.clinical.specialties">
      <ClinicalInboxView />
    </SectionGate>
  );
}
