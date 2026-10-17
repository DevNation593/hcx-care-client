'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pagination } from '@/components/ui/pagination';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useOrders } from '@/hooks/useOrders';
import type { OrderStatus } from '@/types/cash';
import { formatMoney } from './money';

const STATUS_LABELS: Record<OrderStatus, string> = {
  OPEN: 'Abierta',
  PAID: 'Pagada',
  INVOICED: 'Facturada',
  CANCELLED: 'Cancelada',
};

type StatusFilter = OrderStatus | 'ALL';

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'OPEN', label: 'Abiertas' },
  { value: 'PAID', label: 'Pagadas' },
  { value: 'INVOICED', label: 'Facturadas' },
  { value: 'CANCELLED', label: 'Canceladas' },
  { value: 'ALL', label: 'Todas' },
];

const PAGE_SIZE = 20;

export function OrdersTab({ branchId }: { branchId: string }) {
  const router = useRouter();
  // Open orders first: an old order with a balance must stay reachable.
  const [status, setStatus] = useState<StatusFilter>('OPEN');
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [q, setQ] = useState('');
  const { data, isPending, isError } = useOrders({
    branchId,
    page,
    pageSize: PAGE_SIZE,
    ...(status !== 'ALL' ? { status } : {}),
    ...(q ? { q } : {}),
  });

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    setQ(searchInput.trim());
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label htmlFor="orders-status">Estado</Label>
          <select
            id="orders-status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as StatusFilter);
              setPage(1);
            }}
            className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {STATUS_FILTERS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
        <form onSubmit={handleSearch} className="flex items-end gap-2">
          <div>
            <Label htmlFor="orders-search">Buscar</Label>
            <Input
              id="orders-search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Folio, receptor o paciente"
            />
          </div>
          <Button type="submit" variant="outline">
            Buscar
          </Button>
        </form>
      </div>
      {isPending ? (
        <p className="text-sm text-muted-foreground">Cargando órdenes…</p>
      ) : isError ? (
        <Alert variant="destructive">No se pudieron cargar las órdenes</Alert>
      ) : data.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay órdenes.</p>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Folio</TableHead>
                <TableHead>Receptor</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((order) => (
                <TableRow
                  key={order.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/cash/orders/${order.id}`)}
                >
                  <TableCell>#{order.number}</TableCell>
                  <TableCell>{order.billingProfile?.legalName ?? 'Sin receptor'}</TableCell>
                  <TableCell className="text-right">{formatMoney(order.total)}</TableCell>
                  <TableCell className="text-right">{formatMoney(order.balance)}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{STATUS_LABELS[order.status]}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination
            page={page}
            totalPages={Math.max(1, Math.ceil(data.total / PAGE_SIZE))}
            onPageChange={setPage}
            total={data.total}
            pageSize={PAGE_SIZE}
          />
        </>
      )}
    </div>
  );
}
