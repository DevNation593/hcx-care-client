'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useBillableSessions, useCreateOrder } from '@/hooks/useOrders';
import { formatDate } from '@/lib/utils';
import { formatMoney } from './money';

export function BillableSessionsTab({ branchId }: { branchId: string }) {
  const router = useRouter();
  const { data: sessions, isPending, isError } = useBillableSessions({ branchId });
  const createOrder = useCreateOrder();
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (id: string) =>
    setSelected((ids) => (ids.includes(id) ? ids.filter((current) => current !== id) : [...ids, id]));

  const handleCharge = async () => {
    try {
      const order = await createOrder.mutateAsync({ branchId, treatmentSessionIds: selected });
      router.push(`/cash/orders/${order.id}`);
    } catch {
      // The hook already showed the error; the selection stays.
    }
  };

  if (isPending) return <p className="text-sm text-muted-foreground">Cargando sesiones…</p>;
  if (isError) return <Alert variant="destructive">No se pudieron cargar las sesiones por cobrar</Alert>;

  return (
    <div className="space-y-3">
      {sessions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay sesiones por cobrar.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10" />
              <TableHead>Paciente</TableHead>
              <TableHead>Tratamiento</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead className="text-right">Precio</TableHead>
              <TableHead>Documentación</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sessions.map((session) => {
              const patient = `${session.patient.firstName} ${session.patient.lastName}`;
              return (
                <TableRow key={session.id}>
                  <TableCell>
                    <input
                      type="checkbox"
                      aria-label={`Seleccionar sesión de ${patient}`}
                      checked={selected.includes(session.id)}
                      onChange={() => toggle(session.id)}
                    />
                  </TableCell>
                  <TableCell>{patient}</TableCell>
                  <TableCell>{session.treatment.name}</TableCell>
                  <TableCell>{formatDate(session.completedAt ?? session.createdAt, 'dd/MM/yyyy')}</TableCell>
                  <TableCell className="text-right">{formatMoney(session.price)}</TableCell>
                  <TableCell>
                    <Badge variant={session.compliant ? 'success' : 'warning'}>
                      {session.compliant ? 'Completa' : 'Falta documentación'}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
      <Button onClick={handleCharge} disabled={selected.length === 0 || createOrder.isPending}>
        Cobrar
      </Button>
    </div>
  );
}
