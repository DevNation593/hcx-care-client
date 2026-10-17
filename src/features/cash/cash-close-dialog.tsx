'use client';

import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCashRegister, useCloseCashRegister } from '@/hooks/useCashRegisters';
import { PAYMENT_METHOD_LABELS, type CashRegister, type PaymentMethod } from '@/types/cash';
import { centsToAmount, formatMoney, parseCents } from './money';

interface CashCloseDialogProps {
  register: CashRegister;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CashCloseDialog({ register, open, onOpenChange }: CashCloseDialogProps) {
  const titleId = useId();
  const { data: detail } = useCashRegister(register.id);
  const close = useCloseCashRegister();
  const [counted, setCounted] = useState('');
  const [note, setNote] = useState('');

  const summary = detail?.summary;
  const countedCents = parseCents(counted);
  const expectedCents = summary ? parseCents(summary.expectedCash) : null;
  const difference =
    countedCents !== null && expectedCents !== null ? centsToAmount(countedCents - expectedCents) : null;
  const differs = difference !== null && difference !== '0.00';
  const canSubmit =
    countedCents !== null && countedCents >= 0 && difference !== null && (!differs || note.trim() !== '');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit || countedCents === null) return;
    try {
      await close.mutateAsync({
        id: register.id,
        data: {
          countedCash: centsToAmount(countedCents),
          ...(differs ? { closingNote: note.trim() } : {}),
        },
      });
      onOpenChange(false);
    } catch {
      // The hook already showed the error; the form keeps what was typed.
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <DialogHeader>
            <DialogTitle id={titleId}>Cerrar caja</DialogTitle>
            <DialogDescription>Cuenta el efectivo y compáralo con lo esperado.</DialogDescription>
          </DialogHeader>
          {summary ? (
            <div className="space-y-1 text-sm">
              {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((method) => (
                <div key={method} className="flex justify-between">
                  <span>{PAYMENT_METHOD_LABELS[method]}</span>
                  <span>
                    {formatMoney(summary.byMethod[method].received)}
                    <span className="ml-2 text-muted-foreground">
                      Devuelto {formatMoney(summary.byMethod[method].refunded)}
                    </span>
                  </span>
                </div>
              ))}
              <div className="flex justify-between border-t pt-1 font-medium">
                <span>Efectivo esperado</span>
                <span>{formatMoney(summary.expectedCash)}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Cargando el resumen de la caja…</p>
          )}
          <div>
            <Label htmlFor="cash-counted">
              Efectivo contado<span className="text-destructive"> *</span>
            </Label>
            <Input
              id="cash-counted"
              inputMode="decimal"
              value={counted}
              onChange={(event) => setCounted(event.target.value)}
              placeholder="0.00"
            />
            {difference !== null && (
              <p className="mt-1 text-sm">
                Diferencia: <span className="font-medium">{formatMoney(difference)}</span>
              </p>
            )}
          </div>
          {differs && (
            <div>
              <Label htmlFor="cash-note">
                Nota<span className="text-destructive"> *</span>
              </Label>
              <Textarea
                id="cash-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Explica la diferencia"
              />
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!canSubmit || close.isPending}>
              Cerrar caja
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
