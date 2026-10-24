'use client';

import { SectionGate } from '@/components/layout/section-gate';
import { RestrictedAccess } from '@/components/layout/restricted-access';
import { ActivityReport } from '@/features/admin/reports/activity-report';
import { useAuthStore } from '@/store/authStore';
import { isMasterRole } from '@/types/guards';

export default function ReportsPage() {
  const user = useAuthStore((state) => state.user);
  if (!user) return null;
  // The report covers the whole clinic: it is for the account holder.
  if (!isMasterRole(user.role)) return <RestrictedAccess />;
  return (
    <SectionGate section="core.admin.reports">
      <ActivityReport />
    </SectionGate>
  );
}
