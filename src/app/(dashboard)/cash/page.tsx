'use client';

import { SectionGate } from '@/components/layout/section-gate';
import { CashPage } from '@/features/cash/cash-page';

export default function CashRoute() {
  return (
    <SectionGate section="core.billing.cash">
      <CashPage />
    </SectionGate>
  );
}
