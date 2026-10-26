'use client';

import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useBranches } from '@/hooks/useBranches';
import { useInventoryReport } from '@/hooks/useInventory';
import { formatMoney } from '@/features/cash/money';
import type { ExpiringLot } from '@/types/inventory';

const SELECT_CLASS = 'mt-1 h-11 w-full rounded-md border border-input bg-background px-3 text-sm';
const WINDOWS = [30, 60, 90] as const;

function LotsSection({ id, title, lots, empty }: { id: string; title: string; lots: ExpiringLot[]; empty: string }) {
  return (
    <section aria-labelledby={id} className="space-y-2">
      <h2 id={id} className="text-lg font-semibold">
        {title}
      </h2>
      {lots.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead>Sede</TableHead>
              <TableHead>Lote</TableHead>
              <TableHead>Vence</TableHead>
              <TableHead>Unidades</TableHead>
              <TableHead>Valor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lots.map((lot) => (
              <TableRow key={lot.lotId}>
                <TableCell>{lot.product.name}</TableCell>
                <TableCell>{lot.branch.name}</TableCell>
                <TableCell>{lot.lotNumber ?? 'Sin lote'}</TableCell>
                <TableCell>{new Date(lot.expiresAt).toLocaleDateString('es-EC', { timeZone: 'UTC' })}</TableCell>
                <TableCell>{lot.quantityOnHand}</TableCell>
                <TableCell>{formatMoney(lot.value)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}

export function ExpiringTab() {
  const [days, setDays] = useState<(typeof WINDOWS)[number]>(30);
  const [branchId, setBranchId] = useState('');
  const branches = useBranches();
  const report = useInventoryReport('expiring', { days, branchId: branchId || undefined });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div>
          <Label htmlFor="expiring-days">Ventana</Label>
          <select
            id="expiring-days"
            value={days}
            onChange={(event) => setDays(Number(event.target.value) as (typeof WINDOWS)[number])}
            className={SELECT_CLASS}
          >
            {WINDOWS.map((value) => (
              <option key={value} value={value}>
                Próximos {value} días
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="expiring-branch">Sede</Label>
          <select
            id="expiring-branch"
            value={branchId}
            onChange={(event) => setBranchId(event.target.value)}
            className={SELECT_CLASS}
          >
            <option value="">Todas las sedes</option>
            {(branches.data ?? [])
              .filter((branch) => branch.isActive)
              .map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
          </select>
        </div>
      </div>

      {report.isError ? (
        <Alert variant="destructive" title={report.error?.message ?? 'No se pudo cargar el reporte'}>
          <Button variant="outline" size="sm" className="mt-2 min-h-[44px]" onClick={() => report.refetch()}>
            Reintentar
          </Button>
        </Alert>
      ) : report.isPending ? (
        <Skeleton className="h-32 w-full" />
      ) : (
        <>
          <LotsSection
            id="expiring-expired"
            title="Vencidos"
            lots={report.data.expired}
            empty="No hay lotes vencidos con saldo."
          />
          <LotsSection
            id="expiring-soon"
            title="Por vencer"
            lots={report.data.expiring}
            empty={`No hay lotes que venzan en los próximos ${days} días.`}
          />
        </>
      )}
    </div>
  );
}
