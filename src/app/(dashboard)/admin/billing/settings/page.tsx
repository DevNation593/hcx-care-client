'use client';

import { Settings } from 'lucide-react';
import { RestrictedAccess } from '@/components/layout/restricted-access';
import { SectionGate } from '@/components/layout/section-gate';
import { InvoicingSettings } from '@/features/billing/invoicing-settings';
import { useAuthStore } from '@/store/authStore';
import { isMasterRole } from '@/types/guards';

/** Billing › Settings: the SRI issuer, signature and emission points. Account holder only. */
function BillingSettingsContent() {
  const user = useAuthStore((state) => state.user);
  if (!user || !isMasterRole(user.role)) return <RestrictedAccess />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold">
          <Settings className="h-7 w-7" />
          Configuración de facturación
        </h1>
        <p className="mt-1 text-muted-foreground">
          Datos del emisor, firma electrónica y puntos de emisión para facturar ante el SRI.
        </p>
      </div>
      <InvoicingSettings />
    </div>
  );
}

export default function BillingSettingsPage() {
  return (
    <SectionGate section="core.billing.invoicing">
      <BillingSettingsContent />
    </SectionGate>
  );
}
