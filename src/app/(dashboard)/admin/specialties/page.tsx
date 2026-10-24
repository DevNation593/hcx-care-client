'use client';

import { SectionGate } from '@/components/layout/section-gate';
import { RestrictedAccess } from '@/components/layout/restricted-access';
import { SpecialtyManager } from '@/features/admin/specialties/specialty-manager';
import { useCanManageAccount } from '@/hooks/useCanManageAccount';
import { useAuthStore } from '@/store/authStore';

export default function SpecialtiesPage() {
  const user = useAuthStore((state) => state.user);
  const canManage = useCanManageAccount();
  if (!user) return null;
  // The menu entry is hidden for other roles; this covers direct navigation.
  if (!canManage) return <RestrictedAccess />;
  return (
    <SectionGate section="core.clinical.specialties">
      <SpecialtyManager />
    </SectionGate>
  );
}
