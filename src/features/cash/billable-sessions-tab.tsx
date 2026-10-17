'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useBillableSessions, useCreateOrder } from '@/hooks/useOrders';
import { useMyPermissions } from '@/hooks/usePermissions';
import { formatDate } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import { isMasterRole } from '@/types/guards';
import { formatMoney } from './money';

export function BillableSessionsTab({ branchId }: { branchId: string }) {
  const router = useRouter();
  const { data: sessions, isPending, isError } = useBillableSessions({ branchId });
  const createOrder = useCreateOrder();
  const user = useAuthStore((state) => state.user);
  const { can } = useMyPermissions();
  // Charging creates an order, which needs billing.create; viewing the list does not.
  const canCharge = can('billing.create', !!user && isMasterRole(user.role));
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (id: string) =>
    setSelected((ids) => (ids.includes(id) ? ids.filter((current) => current !== id) : [...ids, id]));

  const handleCharge = async () => {
    // Only ids still listed: another order may have consumed a ticked session since.
    const listed = new Set(sessions?.map((session) => session.id));
    const treatmentSessionIds = selected.filter((id) => listed.has(id));
    if (treatmentSessionIds.length === 0) return;
    try {
      const order = await createOrder.mutateAsync({ branchId, treatmentSessionIds });
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
              {canCharge && <TableHead className="w-10" />}
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
                  {canCharge && (
                    <TableCell>
                      <input
                        type="checkbox"
                        aria-label={`Seleccionar sesión de ${patient}`}
                        checked={selected.includes(session.id)}
                        onChange={() => toggle(session.id)}
                      />
                    </TableCell>
                  )}
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
      {canCharge && (
        <Button onClick={handleCharge} disabled={selected.length === 0 || createOrder.isPending}>
          Cobrar
        </Button>
      )}
    </div>
  );
}
