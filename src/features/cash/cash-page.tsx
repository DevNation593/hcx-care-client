'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useBranches } from '@/hooks/useBranches';
import { BillableSessionsTab } from './billable-sessions-tab';
import { CashRegisterBar } from './cash-register-bar';
import { OrdersTab } from './orders-tab';
import { InvoicesTab } from './invoices-tab';
import { useInvoicingPermissions } from '@/hooks/useInvoicing';

type Tab = 'billable' | 'orders' | 'invoices';

export function CashPage() {
  const { view } = useInvoicingPermissions();
  const { data: branches = [] } = useBranches();
  const [chosenBranchId, setChosenBranchId] = useState('');
  const [tab, setTab] = useState<Tab>('billable');

  const active = branches.filter((branch) => branch.isActive);
  // The main branch is the default until the user picks another one.
  const branchId = chosenBranchId || (active.find((branch) => branch.isMain) ?? active[0])?.id || '';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold">Caja</h1>
        <div>
          <Label htmlFor="cash-branch">Sucursal</Label>
          <select
            id="cash-branch"
            value={branchId}
            onChange={(event) => setChosenBranchId(event.target.value)}
            className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {active.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      {branchId && (
        <>
          <CashRegisterBar branchId={branchId} />
          <div className="flex flex-wrap gap-2">
            <Button variant={tab === 'billable' ? 'default' : 'outline'} onClick={() => setTab('billable')}>
              Por cobrar
            </Button>
            <Button variant={tab === 'orders' ? 'default' : 'outline'} onClick={() => setTab('orders')}>
              Órdenes
            </Button>
            {view && (
              <Button variant={tab === 'invoices' ? 'default' : 'outline'} onClick={() => setTab('invoices')}>
                Facturas
              </Button>
            )}
          </div>
          {tab === 'invoices' && view ? (
            <InvoicesTab key={branchId} branchId={branchId} />
          ) : tab === 'billable' ? (
            <BillableSessionsTab key={branchId} branchId={branchId} />
          ) : (
            <OrdersTab branchId={branchId} />
          )}
        </>
      )}
    </div>
  );
}
