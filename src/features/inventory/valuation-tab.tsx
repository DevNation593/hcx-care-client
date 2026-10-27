'use client';

import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useBranches } from '@/hooks/useBranches';
import { useInventoryReport } from '@/hooks/useInventory';
import { formatMoney } from '@/features/cash/money';

const SELECT_CLASS = 'mt-1 h-11 w-full rounded-md border border-input bg-background px-3 text-sm';

function isoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Current month so far, in local time. */
function currentMonth(): { from: string; to: string } {
  const today = new Date();
  return { from: isoDate(new Date(today.getFullYear(), today.getMonth(), 1)), to: isoDate(today) };
}

function BranchSelect({ id, value, onChange }: { id: string; value: string; onChange: (value: string) => void }) {
  const branches = useBranches();
  return (
    <div>
      <Label htmlFor={id}>Sede</Label>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)} className={SELECT_CLASS}>
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
  );
}

function ValueSection() {
  const [branchId, setBranchId] = useState('');
  const report = useInventoryReport('valuation', { branchId: branchId || undefined });

  return (
    <section aria-labelledby="valuation-title" className="space-y-3">
      <h2 id="valuation-title" className="text-lg font-semibold">
        Valor del inventario
      </h2>
      <div className="max-w-xs">
        <BranchSelect id="valuation-branch" value={branchId} onChange={setBranchId} />
      </div>
      {report.isError ? (
        <Alert variant="destructive" title={report.error?.message ?? 'No se pudo cargar la valorización'} />
      ) : report.isPending ? (
        <Skeleton className="h-32 w-full" />
      ) : report.data.branches.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay existencias valorizadas.</p>
      ) : (
        <>
          <p className="text-sm">
            Valor total: <strong>{formatMoney(report.data.totalValue)}</strong>
          </p>
          {report.data.branches.map((branch) => (
            <div key={branch.branchId} className="space-y-1">
              <h3 className="font-medium">
                {branch.branchName} · {branch.units} unidades · {formatMoney(branch.value)}
              </h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead>Unidades</TableHead>
                    <TableHead>Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {branch.products.map((product) => (
                    <TableRow key={product.productId}>
                      <TableCell>
                        {product.code} · {product.name}
                      </TableCell>
                      <TableCell>{product.units}</TableCell>
                      <TableCell>{formatMoney(product.value)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ))}
        </>
      )}
    </section>
  );
}

function MarginSection() {
  const [period, setPeriod] = useState(currentMonth);
  const [branchId, setBranchId] = useState('');
  // The API needs both dates: while one is cleared, the last complete period stays requested.
  const [applied, setApplied] = useState(period);
  if (period.from && period.to && (applied.from !== period.from || applied.to !== period.to)) {
    setApplied(period);
  }
  const report = useInventoryReport('margin', {
    from: applied.from,
    to: applied.to,
    branchId: branchId || undefined,
  });

  return (
    <section aria-labelledby="margin-title" className="space-y-3">
      <h2 id="margin-title" className="text-lg font-semibold">
        Margen del período
      </h2>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div>
          <Label htmlFor="margin-from">Desde</Label>
          <Input
            id="margin-from"
            type="date"
            value={period.from}
            max={period.to || undefined}
            onChange={(event) => setPeriod({ ...period, from: event.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="margin-to">Hasta</Label>
          <Input
            id="margin-to"
            type="date"
            value={period.to}
            min={period.from || undefined}
            onChange={(event) => setPeriod({ ...period, to: event.target.value })}
          />
        </div>
        <BranchSelect id="margin-branch" value={branchId} onChange={setBranchId} />
      </div>
      {report.isError ? (
        <Alert variant="destructive" title={report.error?.message ?? 'No se pudo cargar el margen'} />
      ) : report.isPending ? (
        <Skeleton className="h-32 w-full" />
      ) : (
        <>
          <dl className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Venta</dt>
              <dd className="text-lg font-semibold">{formatMoney(report.data.revenue)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Costo</dt>
              <dd className="text-lg font-semibold">{formatMoney(report.data.cost)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Margen</dt>
              <dd className="text-lg font-semibold">{formatMoney(report.data.margin)}</dd>
            </div>
          </dl>
          {report.data.products.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hubo ventas de productos en el período.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>Unidades</TableHead>
                  <TableHead>Venta</TableHead>
                  <TableHead>Costo</TableHead>
                  <TableHead>Margen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.data.products.map((product) => (
                  <TableRow key={product.productId}>
                    <TableCell>
                      {product.code} · {product.name}
                    </TableCell>
                    <TableCell>{product.units}</TableCell>
                    <TableCell>{formatMoney(product.revenue)}</TableCell>
                    <TableCell>{formatMoney(product.cost)}</TableCell>
                    <TableCell>{formatMoney(product.margin)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </>
      )}
    </section>
  );
}

export function ValuationTab() {
  return (
    <div className="space-y-8">
      <ValueSection />
      <MarginSection />
    </div>
  );
}
