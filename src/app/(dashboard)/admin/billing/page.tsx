'use client';

import { useState } from 'react';
import { FileText } from 'lucide-react';
import { SectionGate } from '@/components/layout/section-gate';
import { Label } from '@/components/ui/label';
import { LegacyInvoicesCard } from '@/features/billing/legacy-invoices-card';
import { InvoicesTab } from '@/features/cash/invoices-tab';
import { useBranches } from '@/hooks/useBranches';
import { useInvoicingPermissions } from '@/hooks/useInvoicing';

/** Billing › Issued invoices: every invoice requested to the SRI, across the clinic's branches. */
function IssuedInvoicesContent() {
  const { view } = useInvoicingPermissions();
  const { data: branches = [] } = useBranches();
  const [branchId, setBranchId] = useState('');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold">
            <FileText className="h-7 w-7" />
            Facturas emitidas
          </h1>
          <p className="mt-1 text-muted-foreground">
            Facturas electrónicas de este consultorio y su estado ante el SRI. Se emiten desde las
            órdenes pagadas en Caja.
          </p>
        </div>
        {view && branches.length > 1 && (
          <div>
            <Label htmlFor="issued-branch">Sucursal</Label>
            <select
              id="issued-branch"
              value={branchId}
              onChange={(event) => setBranchId(event.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Todas</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      <InvoicesTab key={branchId} branchId={branchId || undefined} />
      <LegacyInvoicesCard enabled={view} />
    </div>
  );
}

export default function IssuedInvoicesPage() {
  return (
    <SectionGate section="core.billing.invoicing">
      <IssuedInvoicesContent />
    </SectionGate>
  );
}
