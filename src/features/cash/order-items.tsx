'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  useAddOrderItem,
  useBillableSessions,
  useRemoveOrderItem,
  useUpdateOrderItem,
} from '@/hooks/useOrders';
import { useMyPermissions } from '@/hooks/usePermissions';
import type { ApiError } from '@/types';
import type { Order, OrderItem } from '@/types/cash';
import { centsToAmount, formatMoney, parseCents } from './money';

interface OrderItemsProps {
  order: Order;
  /** Why the items cannot change, or null when they can. */
  lockedReason: string | null;
  onConflict: () => void;
}

const FREE_TAX_RATES = [0, 5, 15];

function personName(person: { firstName: string; lastName: string } | null): string {
  return person ? `${person.firstName} ${person.lastName}` : '';
}

function AddSessionPanel({
  order,
  onAdd,
}: {
  order: Order;
  onAdd: (treatmentSessionId: string) => Promise<void>;
}) {
  const { data, isPending } = useBillableSessions({ branchId: order.branchId });
  const inOrder = new Set(order.items.map((item) => item.treatmentSessionId));
  const sessions = (data ?? []).filter((session) => !inOrder.has(session.id));

  return (
    <div className="space-y-2 rounded-md border p-3">
      {isPending ? (
        <p className="text-sm text-muted-foreground">Cargando sesiones…</p>
      ) : sessions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay sesiones por cobrar en esta sucursal.</p>
      ) : (
        <ul className="space-y-2">
          {sessions.map((session) => {
            const patient = personName(session.patient);
            return (
              <li key={session.id} className="flex items-center justify-between gap-2 text-sm">
                <span>
                  {patient} · {session.treatment.name} · {formatMoney(session.price)}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  aria-label={`Agregar ${session.treatment.name} de ${patient}`}
                  onClick={() => onAdd(session.id)}
                >
                  Agregar
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function FreeConceptForm({
  onAdd,
}: {
  onAdd: (concept: { description: string; quantity: string; unitPrice: string; taxRatePercent: number }) => Promise<boolean>;
}) {
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState('');
  const [taxRate, setTaxRate] = useState('15');

  const quantityCents = parseCents(quantity);
  const priceCents = parseCents(unitPrice);
  const valid =
    description.trim() !== '' &&
    quantityCents !== null &&
    quantityCents > 0 &&
    priceCents !== null &&
    priceCents >= 0;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!valid || quantityCents === null || priceCents === null) return;
    const added = await onAdd({
      description: description.trim(),
      quantity: centsToAmount(quantityCents),
      unitPrice: centsToAmount(priceCents),
      taxRatePercent: Number(taxRate),
    });
    if (added) {
      setDescription('');
      setQuantity('1');
      setUnitPrice('');
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-3 rounded-md border p-3 sm:grid-cols-4">
      <div className="sm:col-span-4">
        <Label htmlFor="free-description">Descripción</Label>
        <Input id="free-description" value={description} onChange={(event) => setDescription(event.target.value)} />
      </div>
      <div>
        <Label htmlFor="free-quantity">Cantidad</Label>
        <Input
          id="free-quantity"
          inputMode="decimal"
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="free-price">Precio</Label>
        <Input
          id="free-price"
          inputMode="decimal"
          placeholder="0.00"
          value={unitPrice}
          onChange={(event) => setUnitPrice(event.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="free-tax">IVA</Label>
        <select
          id="free-tax"
          value={taxRate}
          onChange={(event) => setTaxRate(event.target.value)}
          className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          {FREE_TAX_RATES.map((rate) => (
            <option key={rate} value={rate}>
              {rate}%
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-end">
        <Button type="submit" disabled={!valid}>
          Agregar concepto
        </Button>
      </div>
    </form>
  );
}

function DiscountEditor({
  item,
  disabled,
  onApply,
}: {
  item: OrderItem;
  disabled: boolean;
  onApply: (item: OrderItem, discount: string) => Promise<void>;
}) {
  const [value, setValue] = useState(item.discount);
  const cents = parseCents(value);
  return (
    <div className="flex items-center justify-end gap-1">
      <Input
        aria-label={`Descuento de ${item.description}`}
        inputMode="decimal"
        className="h-8 w-20 text-right"
        value={value}
        disabled={disabled}
        onChange={(event) => setValue(event.target.value)}
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={disabled || cents === null || cents < 0 || centsToAmount(cents) === item.discount}
        aria-label={`Aplicar descuento a ${item.description}`}
        onClick={() => cents !== null && onApply(item, centsToAmount(cents))}
      >
        Aplicar
      </Button>
    </div>
  );
}

export function OrderItems({ order, lockedReason, onConflict }: OrderItemsProps) {
  const { can } = useMyPermissions();
  const canEdit = can('billing.create');
  const canAdjust = can('billing.adjust');
  const addItem = useAddOrderItem(order.id);
  const removeItem = useRemoveOrderItem(order.id);
  const updateItem = useUpdateOrderItem(order.id);
  const [panel, setPanel] = useState<'session' | 'free' | null>(null);
  const locked = lockedReason !== null;

  // The hooks already toast the server's message; a stale version also shows the order notice.
  const run = async (action: () => Promise<unknown>): Promise<boolean> => {
    try {
      await action();
      return true;
    } catch (error) {
      if ((error as ApiError)?.code === 'ORDER_VERSION_CONFLICT') onConflict();
      return false;
    }
  };

  const togglePanel = (next: 'session' | 'free') => setPanel((current) => (current === next ? null : next));

  return (
    <div className="space-y-3">
      {lockedReason && <p className="text-sm text-muted-foreground">{lockedReason}</p>}
      {order.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">La orden no tiene ítems.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Paciente</TableHead>
              <TableHead>Concepto</TableHead>
              <TableHead className="text-right">Cant.</TableHead>
              <TableHead className="text-right">Precio</TableHead>
              <TableHead className="text-right">Descuento</TableHead>
              <TableHead className="text-right">IVA</TableHead>
              <TableHead className="text-right">Subtotal</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {order.items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{personName(item.patient)}</TableCell>
                <TableCell>{item.description}</TableCell>
                <TableCell className="text-right">{item.quantity}</TableCell>
                <TableCell className="text-right">{formatMoney(item.unitPrice)}</TableCell>
                <TableCell className="text-right">
                  {canAdjust && canEdit ? (
                    <DiscountEditor
                      key={`${item.id}-${item.discount}`}
                      item={item}
                      disabled={locked}
                      onApply={(target, discount) =>
                        run(() =>
                          updateItem.mutateAsync({
                            itemId: target.id,
                            data: { version: order.version, discount },
                          }),
                        ).then(() => undefined)
                      }
                    />
                  ) : (
                    formatMoney(item.discount)
                  )}
                </TableCell>
                <TableCell className="text-right">{formatMoney(item.lineTax)}</TableCell>
                <TableCell className="text-right">{formatMoney(item.lineSubtotal)}</TableCell>
                <TableCell className="text-right">
                  {canEdit && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={locked}
                      aria-label={`Quitar ${item.description}`}
                      onClick={() =>
                        run(() => removeItem.mutateAsync({ itemId: item.id, version: order.version }))
                      }
                    >
                      Quitar
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {canEdit && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={locked} onClick={() => togglePanel('session')}>
            Agregar sesión
          </Button>
          {canAdjust && (
            <Button type="button" variant="outline" disabled={locked} onClick={() => togglePanel('free')}>
              Concepto libre
            </Button>
          )}
        </div>
      )}
      {!locked && panel === 'session' && (
        <AddSessionPanel
          order={order}
          onAdd={async (treatmentSessionId) => {
            await run(() =>
              addItem.mutateAsync({ version: order.version, kind: 'TREATMENT_SESSION', treatmentSessionId }),
            );
          }}
        />
      )}
      {!locked && panel === 'free' && canAdjust && (
        <FreeConceptForm
          onAdd={(concept) =>
            run(() => addItem.mutateAsync({ version: order.version, kind: 'FREE', ...concept }))
          }
        />
      )}
    </div>
  );
}
