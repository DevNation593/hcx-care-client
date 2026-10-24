'use client';

import { SectionGate } from '@/components/layout/section-gate';
import { RestrictedAccess } from '@/components/layout/restricted-access';
import { MedicationsManager } from '@/features/admin/catalogs/medications-manager';
import { useAuthStore } from '@/store/authStore';
import { canAccessClinicalNotes, isMasterRole } from '@/types/guards';

export default function MedicationsPage() {
  const user = useAuthStore((state) => state.user);
  if (!user) return null;
  // The account holder manages the catalog; so does any professional who prescribes from it.
  if (!isMasterRole(user.role) && !canAccessClinicalNotes(user)) return <RestrictedAccess />;
  return (
    <SectionGate section="core.clinical.specialties">
      <MedicationsManager />
    </SectionGate>
  );
}
