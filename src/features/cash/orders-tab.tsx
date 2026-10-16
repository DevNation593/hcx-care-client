'use client';

import { useRouter } from 'next/navigation';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
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

export function OrdersTab({ branchId }: { branchId: string }) {
  const router = useRouter();
  const { data, isPending, isError } = useOrders({ branchId });

  if (isPending) return <p className="text-sm text-muted-foreground">Cargando órdenes…</p>;
  if (isError) return <Alert variant="destructive">No se pudieron cargar las órdenes</Alert>;
  if (data.items.length === 0) return <p className="text-sm text-muted-foreground">No hay órdenes.</p>;

  return (
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
  );
}
