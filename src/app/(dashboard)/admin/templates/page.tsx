'use client';

import { SectionGate } from '@/components/layout/section-gate';
import { RestrictedAccess } from '@/components/layout/restricted-access';
import { TemplatesManager } from '@/features/admin/templates/templates-manager';
import { useAuthStore } from '@/store/authStore';
import { isMasterRole } from '@/types/guards';

export default function TemplatesPage() {
  const user = useAuthStore((state) => state.user);
  if (!user) return null;
  // The texts are the clinic's: the account holder writes them, every professional uses them.
  if (!isMasterRole(user.role)) return <RestrictedAccess />;
  return (
    <SectionGate section="core.clinical.templates">
      <TemplatesManager />
    </SectionGate>
  );
}
