'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useProduct } from '@/hooks/useInventory';
import type { Branch } from '@/types/clinical';
import type { CreateStockTransferInput, ProductSummary } from '@/types/inventory';

const MAX_LINES = 100;
const SELECT_CLASS = 'mt-1 h-11 w-full rounded-md border border-input bg-background px-3 text-sm';

interface TransferFormProps {
  branches: Branch[];
  products: ProductSummary[];
  submitting?: boolean;
  /** The `message` the API answered. */
  error?: string | null;
  onSubmit: (data: CreateStockTransferInput) => void;
}

interface LineState {
  key: number;
  productId: string;
  lotId: string;
  /** Balance of the chosen lot, captured when it is picked. */
  available: number;
  quantity: string;
}

type LineErrors = Partial<Record<'productId' | 'lotId' | 'quantity', string>>;

const newLine = (key: number): LineState => ({ key, productId: '', lotId: '', available: 0, quantity: '' });

interface LineRowProps {
  id: string;
  index: number;
  fromBranchId: string;
  products: ProductSummary[];
  line: LineState;
  errors: LineErrors;
  canRemove: boolean;
  onChange: (patch: Partial<LineState>) => void;
  onRemove: () => void;
}

function LineRow({ id, index, fromBranchId, products, line, errors, canRemove, onChange, onRemove }: LineRowProps) {
  const product = useProduct(line.productId);
  // Only sellable stock is offered: lots of the origin branch with a balance that have not expired.
  const lots = (product.data?.lots ?? []).filter(
    (lot) => lot.branchId === fromBranchId && lot.quantityOnHand > 0 && !lot.expired,
  );

  return (
    <div className="space-y-3 rounded-md border border-input p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Línea {index + 1}</p>
        {canRemove && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-[44px]"
            aria-label={`Quitar línea ${index + 1}`}
            onClick={onRemove}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div>
          <Label htmlFor={`${id}-product`} required>
            Producto
          </Label>
          <select
            id={`${id}-product`}
            value={line.productId}
            onChange={(event) => onChange({ productId: event.target.value, lotId: '', available: 0, quantity: '' })}
            className={SELECT_CLASS}
          >
            <option value="">Elige un producto</option>
            {products.map((item) => (
              <option key={item.id} value={item.id}>
                {item.code} · {item.name}
              </option>
            ))}
          </select>
          {errors.productId && <p className="mt-1 text-sm text-destructive">{errors.productId}</p>}
        </div>
        <div>
          <Label htmlFor={`${id}-lot`} required>
            Lote
          </Label>
          <select
            id={`${id}-lot`}
            value={line.lotId}
            disabled={!line.productId || product.isPending}
            onChange={(event) => {
              const lot = lots.find((item) => item.id === event.target.value);
              onChange({ lotId: event.target.value, available: lot?.quantityOnHand ?? 0, quantity: '' });
            }}
            className={SELECT_CLASS}
          >
            <option value="">{product.isPending && line.productId ? 'Cargando lotes…' : 'Elige un lote'}</option>
            {lots.map((lot) => (
              <option key={lot.id} value={lot.id}>
                {lot.lotNumber ?? 'Sin número'}
                {lot.expiresAt ? ` · vence ${lot.expiresAt.slice(0, 10)}` : ''} · disponible {lot.quantityOnHand}
              </option>
            ))}
          </select>
          {errors.lotId && <p className="mt-1 text-sm text-destructive">{errors.lotId}</p>}
          {line.productId && !product.isPending && lots.length === 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              Este producto no tiene lotes con saldo en la sede de origen.
            </p>
          )}
        </div>
        <div>
          <Label htmlFor={`${id}-quantity`} required>
            Cantidad
          </Label>
          <Input
            id={`${id}-quantity`}
            className="h-11"
            type="number"
            min={1}
            max={line.available || undefined}
            step={1}
            value={line.quantity}
            error={errors.quantity}
            onChange={(event) => onChange({ quantity: event.target.value })}
          />
        </div>
      </div>
    </div>
  );
}

export function TransferForm({ branches, products, submitting, error, onSubmit }: TransferFormProps) {
  const [fromBranchId, setFromBranchId] = useState('');
  const [toBranchId, setToBranchId] = useState('');
  const [note, setNote] = useState('');
  const [lines, setLines] = useState<LineState[]>([newLine(0)]);
  const [nextKey, setNextKey] = useState(1);
  const [branchErrors, setBranchErrors] = useState<{ from?: string; to?: string }>({});
  const [lineErrors, setLineErrors] = useState<Record<number, LineErrors>>({});

  // Products with stock in the origin branch; their lots are loaded per line.
  const originProducts = products.filter((product) =>
    product.stock.some((row) => row.branchId === fromBranchId && row.available > 0),
  );

  const changeFrom = (value: string) => {
    setFromBranchId(value);
    // The destination cannot equal the origin, and the lots belonged to the old origin.
    if (value === toBranchId) setToBranchId('');
    setLines([newLine(nextKey)]);
    setNextKey((key) => key + 1);
    setLineErrors({});
  };

  const patchLine = (key: number, patch: Partial<LineState>) =>
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const found: Record<number, LineErrors> = {};
    const seen = new Set<string>();

    for (const line of lines) {
      const quantity = Number(line.quantity);
      const errors: LineErrors = {
        ...(line.productId ? {} : { productId: 'Elige un producto' }),
        ...(!line.lotId
          ? { lotId: 'Elige un lote' }
          : seen.has(line.lotId)
            ? { lotId: 'Este lote ya está en otra línea' }
            : {}),
        ...(line.quantity.trim() === '' || !Number.isInteger(quantity) || quantity < 1
          ? { quantity: 'Ingresa un entero, 1 o más' }
          : line.lotId && quantity > line.available
            ? { quantity: `Solo hay ${line.available} disponibles en este lote` }
            : {}),
      };
      if (line.lotId) seen.add(line.lotId);
      if (Object.keys(errors).length > 0) found[line.key] = errors;
    }

    const branchFound = {
      ...(fromBranchId ? {} : { from: 'Elige la sede de origen' }),
      ...(!toBranchId
        ? { to: 'Elige la sede de destino' }
        : toBranchId === fromBranchId
          ? { to: 'El destino debe ser distinto del origen' }
          : {}),
    };
    setBranchErrors(branchFound);
    setLineErrors(found);
    if (Object.keys(branchFound).length > 0 || Object.keys(found).length > 0) return;

    onSubmit({
      fromBranchId,
      toBranchId,
      ...(note.trim() ? { note: note.trim() } : {}),
      lines: lines.map((line) => ({ lotId: line.lotId, quantity: Number(line.quantity) })),
    });
  };

  return (
    <form className="space-y-4" onSubmit={submit} noValidate>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="transfer-from" required>
            Sede de origen
          </Label>
          <select
            id="transfer-from"
            value={fromBranchId}
            onChange={(event) => changeFrom(event.target.value)}
            className={SELECT_CLASS}
          >
            <option value="">Elige la sede de origen</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
          {branchErrors.from && <p className="mt-1 text-sm text-destructive">{branchErrors.from}</p>}
        </div>
        <div>
          <Label htmlFor="transfer-to" required>
            Sede de destino
          </Label>
          <select
            id="transfer-to"
            value={toBranchId}
            onChange={(event) => setToBranchId(event.target.value)}
            className={SELECT_CLASS}
          >
            <option value="">Elige la sede de destino</option>
            {branches
              .filter((branch) => branch.id !== fromBranchId)
              .map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
          </select>
          {branchErrors.to && <p className="mt-1 text-sm text-destructive">{branchErrors.to}</p>}
        </div>
      </div>
      <div>
        <Label htmlFor="transfer-note">Nota</Label>
        <Textarea id="transfer-note" value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} />
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold">Productos a trasladar</legend>
        {!fromBranchId ? (
          <p className="text-sm text-muted-foreground">Elige la sede de origen para ver sus lotes.</p>
        ) : (
          <>
            {lines.map((line, index) => (
              <LineRow
                key={line.key}
                id={`transfer-line-${line.key}`}
                index={index}
                fromBranchId={fromBranchId}
                products={originProducts}
                line={line}
                errors={lineErrors[line.key] ?? {}}
                canRemove={lines.length > 1}
                onChange={(patch) => patchLine(line.key, patch)}
                onRemove={() => setLines((current) => current.filter((item) => item.key !== line.key))}
              />
            ))}
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px]"
              disabled={lines.length >= MAX_LINES}
              onClick={() => {
                setLines((current) => [...current, newLine(nextKey)]);
                setNextKey((key) => key + 1);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Agregar producto
            </Button>
          </>
        )}
      </fieldset>

      {error && (
        <Alert variant="destructive" title="No se pudo registrar el traslado">
          {error}
        </Alert>
      )}
      <div className="flex justify-end">
        <Button type="submit" className="min-h-[44px]" disabled={submitting}>
          Registrar traslado
        </Button>
      </div>
    </form>
  );
}
