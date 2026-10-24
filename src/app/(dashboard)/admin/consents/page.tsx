'use client';

import { SectionGate } from '@/components/layout/section-gate';
import { ConsentsPage } from '@/features/admin/consents/consents-page';
import { useMyPermissions } from '@/hooks/usePermissions';
import { useAuthStore } from '@/store/authStore';
import { isMasterRole } from '@/types/guards';

export default function ConsentsAdminPage() {
  const user = useAuthStore((state) => state.user);
  const { can } = useMyPermissions();
  if (!user) return null;
  // Everyone who works with the clinic's consents reads them; only who may manage them sees the actions.
  return (
    <SectionGate section="core.treatments.consents">
      <ConsentsPage canManage={can('treatments.manage', isMasterRole(user.role))} />
    </SectionGate>
  );
}
