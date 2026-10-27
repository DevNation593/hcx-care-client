'use client';

import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAdjustLot } from '@/hooks/useInventory';
import type { CreateStockAdjustmentInput, StockAdjustmentReason, StockLotView } from '@/types/inventory';

export const ADJUSTMENT_REASONS: { value: StockAdjustmentReason; label: string }[] = [
  { value: 'COUNT', label: 'Conteo físico' },
  { value: 'DAMAGE', label: 'Daño' },
  { value: 'EXPIRED', label: 'Vencido' },
  { value: 'INTERNAL_USE', label: 'Uso interno' },
  { value: 'OTHER', label: 'Otro' },
];

type Mode = 'delta' | 'counted';

interface AdjustLotFormProps {
  productId: string;
  lot: StockLotView;
  onDone: () => void;
}

export function AdjustLotForm({ productId, lot, onDone }: AdjustLotFormProps) {
  const adjust = useAdjustLot(productId);
  const [mode, setMode] = useState<Mode>('delta');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState<StockAdjustmentReason>('COUNT');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<{ amount?: string; note?: string }>({});

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const value = Number(amount);
    const valid = amount.trim() !== '' && Number.isInteger(value);
    const found = {
      ...(!valid
        ? { amount: 'Ingresa un número entero' }
        : mode === 'delta' && value === 0
          ? { amount: 'La diferencia no puede ser 0' }
          : mode === 'counted' && value < 0
            ? { amount: 'La cantidad contada no puede ser negativa' }
            : {}),
      ...(reason === 'OTHER' && !note.trim() ? { note: 'Escribe una nota para el motivo «Otro»' } : {}),
    };
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const data: CreateStockAdjustmentInput = {
      ...(mode === 'delta' ? { delta: value } : { countedQuantity: value }),
      reason,
      ...(note.trim() ? { note: note.trim() } : {}),
    };
    adjust.mutate({ lotId: lot.id, data }, { onSuccess: onDone });
  };

  const prefix = `adjust-${lot.id}`;

  return (
    <form className="space-y-3 rounded-md border border-input p-3" onSubmit={submit} noValidate>
      <fieldset className="flex flex-wrap gap-4 text-sm">
        <legend className="sr-only">Tipo de ajuste</legend>
        <label className="flex items-center gap-2">
          <input type="radio" name={`${prefix}-mode`} checked={mode === 'delta'} onChange={() => setMode('delta')} />
          Diferencia
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name={`${prefix}-mode`}
            checked={mode === 'counted'}
            onChange={() => setMode('counted')}
          />
          Cantidad contada
        </label>
      </fieldset>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <Label htmlFor={`${prefix}-amount`} required>
            {mode === 'delta' ? 'Unidades a sumar o restar' : 'Unidades contadas'}
          </Label>
          <Input
            id={`${prefix}-amount`}
            type="number"
            step={1}
            className="h-11"
            value={amount}
            error={errors.amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </div>
        <div>
          <Label htmlFor={`${prefix}-reason`} required>
            Motivo
          </Label>
          <select
            id={`${prefix}-reason`}
            value={reason}
            onChange={(event) => setReason(event.target.value as StockAdjustmentReason)}
            className="mt-1 h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {ADJUSTMENT_REASONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <Label htmlFor={`${prefix}-note`} required={reason === 'OTHER'}>
          Nota
        </Label>
        <Textarea
          id={`${prefix}-note`}
          value={note}
          maxLength={500}
          onChange={(event) => setNote(event.target.value)}
        />
        {errors.note && <p className="mt-1 text-sm text-destructive">{errors.note}</p>}
      </div>
      {adjust.error && (
        <Alert variant="destructive" title="No se pudo registrar el ajuste">
          {adjust.error.message}
        </Alert>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" className="min-h-[44px]" onClick={onDone} disabled={adjust.isPending}>
          Cancelar
        </Button>
        <Button type="submit" className="min-h-[44px]" disabled={adjust.isPending}>
          Registrar ajuste
        </Button>
      </div>
    </form>
  );
}
