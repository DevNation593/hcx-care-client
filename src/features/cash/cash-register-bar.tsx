'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCurrentCashRegister, useOpenCashRegister } from '@/hooks/useCashRegisters';
import { useMyPermissions } from '@/hooks/usePermissions';
import { formatDate } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import { isMasterRole } from '@/types/guards';
import { CashCloseDialog } from './cash-close-dialog';
import { centsToAmount, parseCents } from './money';

export function CashRegisterBar({ branchId }: { branchId: string }) {
  const user = useAuthStore((state) => state.user);
  const { can } = useMyPermissions();
  const { data: register, isError, isFetching, refetch } = useCurrentCashRegister(branchId);
  const openRegister = useOpenCashRegister();
  const [opening, setOpening] = useState(false);
  const [openingCash, setOpeningCash] = useState('');
  const [closing, setClosing] = useState(false);

  // Without a readable register the state is unknown: never claim it is closed, nor offer to open or close it.
  const canManage = can('cash.manage', !!user && isMasterRole(user.role)) && !isError;
  const openingCents = parseCents(openingCash);

  const handleOpen = async (event: React.FormEvent) => {
    event.preventDefault();
    if (openingCents === null || openingCents < 0) return;
    try {
      await openRegister.mutateAsync({ branchId, openingCash: centsToAmount(openingCents) });
      setOpening(false);
      setOpeningCash('');
    } catch {
      // The hook already showed the error; the form keeps what was typed.
    }
  };

  // The register only carries the id of who opened it: the name is known for the signed-in user.
  const openedBy = register && user && register.openedById === user.id ? ` por ${user.firstName} ${user.lastName}` : '';

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
        {isError ? (
          <>
            <p role="alert" className="text-sm font-medium text-destructive">
              No se pudo leer el estado de la caja
            </p>
            <Button variant="outline" disabled={isFetching} onClick={() => refetch()}>
              Reintentar
            </Button>
          </>
        ) : (
          <p className="text-sm font-medium">
            {register ? `Caja abierta desde ${formatDate(register.openedAt, 'HH:mm')}${openedBy}` : 'Caja cerrada'}
          </p>
        )}
        {canManage && register && (
          <>
            <Button variant="outline" onClick={() => setClosing(true)}>
              Cerrar caja
            </Button>
            {closing && <CashCloseDialog register={register} open onOpenChange={setClosing} />}
          </>
        )}
        {canManage && !register && !opening && <Button onClick={() => setOpening(true)}>Abrir caja</Button>}
        {canManage && !register && opening && (
          <form onSubmit={handleOpen} noValidate className="flex items-end gap-2">
            <div>
              <Label htmlFor="cash-opening">Monto inicial</Label>
              <Input
                id="cash-opening"
                inputMode="decimal"
                value={openingCash}
                onChange={(event) => setOpeningCash(event.target.value)}
                placeholder="0.00"
              />
            </div>
            <Button type="submit" disabled={openingCents === null || openingCents < 0 || openRegister.isPending}>
              Abrir
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpening(false)}>
              Cancelar
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
