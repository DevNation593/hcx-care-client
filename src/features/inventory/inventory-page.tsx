'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useMyPermissions } from '@/hooks/usePermissions';
import { isMasterRole } from '@/types/guards';
import { useAuthStore } from '@/store/authStore';
import { ExpiringTab } from './expiring-tab';
import { ProductsTab } from './products-tab';
import { ReceiptsTab } from './receipts-tab';
import { TransfersTab } from './transfers-tab';
import { ValuationTab } from './valuation-tab';

const TABS = [
  { id: 'products', label: 'Productos' },
  { id: 'receipts', label: 'Entradas' },
  { id: 'transfers', label: 'Traslados' },
  { id: 'expiring', label: 'Por vencer' },
  { id: 'valuation', label: 'Valorización y margen' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export function InventoryPage() {
  const user = useAuthStore((state) => state.user);
  const { can } = useMyPermissions();
  const [tab, setTab] = useState<TabId>('products');

  if (!can('inventory.manage', !!user && isMasterRole(user.role))) {
    return (
      <p role="alert" className="text-sm text-muted-foreground">
        No tienes permiso para administrar el inventario.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Inventario</h1>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Secciones del inventario">
        {TABS.map((item) => (
          <Button
            key={item.id}
            role="tab"
            aria-selected={tab === item.id}
            variant={tab === item.id ? 'default' : 'outline'}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </Button>
        ))}
      </div>
      {tab === 'products' ? (
        <ProductsTab />
      ) : tab === 'receipts' ? (
        <ReceiptsTab />
      ) : tab === 'transfers' ? (
        <TransfersTab />
      ) : tab === 'expiring' ? (
        <ExpiringTab />
      ) : (
        <ValuationTab />
      )}
    </div>
  );
}
