'use client';

import { SectionGate } from '@/components/layout/section-gate';
import { InventoryPage } from '@/features/inventory/inventory-page';

export default function InventoryRoute() {
  return (
    <SectionGate section="core.billing.inventory">
      <InventoryPage />
    </SectionGate>
  );
}
