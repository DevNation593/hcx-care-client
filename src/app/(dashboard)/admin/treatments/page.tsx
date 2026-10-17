'use client';

import { SectionGate } from '@/components/layout/section-gate';
import { TreatmentsPage } from '@/features/admin/treatments/treatments-page';
import { useMyPermissions } from '@/hooks/usePermissions';
import { useAuthStore } from '@/store/authStore';
import { isMasterRole } from '@/types/guards';

export default function TreatmentsAdminPage() {
  const user = useAuthStore((state) => state.user);
  const { can } = useMyPermissions();
  if (!user) return null;
  // Everyone who works with the clinic's catalog reads it; only who may manage it sees the actions.
  return (
    <SectionGate section="core.specialties">
      <TreatmentsPage canManage={can('treatments.manage', isMasterRole(user.role))} />
    </SectionGate>
  );
}
