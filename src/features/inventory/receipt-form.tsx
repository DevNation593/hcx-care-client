'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { centsToAmount, parseCents } from '@/features/cash/money';
import type { Branch } from '@/types/clinical';
import type { CreateStockReceiptInput, ProductSummary } from '@/types/inventory';

const MAX_LINES = 100;
const SELECT_CLASS = 'mt-1 h-11 w-full rounded-md border border-input bg-background px-3 text-sm';

interface ReceiptFormProps {
  branches: Branch[];
  products: ProductSummary[];
  submitting?: boolean;
  /** The `message` the API answered. */
  error?: string | null;
  onSubmit: (data: CreateStockReceiptInput) => void;
}

interface LineState {
  key: number;
  productId: string;
  quantity: string;
  unitCost: string;
  lotNumber: string;
  expiresAt: string;
}

type LineErrors = Partial<Record<'productId' | 'quantity' | 'unitCost' | 'expiresAt', string>>;

const newLine = (key: number): LineState => ({
  key,
  productId: '',
  quantity: '',
  unitCost: '',
  lotNumber: '',
  expiresAt: '',
});

export function ReceiptForm({ branches, products, submitting, error, onSubmit }: ReceiptFormProps) {
  const [branchId, setBranchId] = useState(branches[0]?.id ?? '');
  const [supplierName, setSupplierName] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [receivedAt, setReceivedAt] = useState('');
  const [note, setNote] = useState('');
  const [lines, setLines] = useState<LineState[]>([newLine(0)]);
  const [nextKey, setNextKey] = useState(1);
  const [branchError, setBranchError] = useState<string>();
  const [lineErrors, setLineErrors] = useState<Record<number, LineErrors>>({});

  const patchLine = (key: number, patch: Partial<LineState>) =>
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));

  const addLine = () => {
    setLines((current) => [...current, newLine(nextKey)]);
    setNextKey((key) => key + 1);
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const byId = new Map(products.map((product) => [product.id, product]));
    const found: Record<number, LineErrors> = {};
    const payload: CreateStockReceiptInput['lines'] = [];

    for (const line of lines) {
      const product = byId.get(line.productId);
      const quantity = Number(line.quantity);
      const cents = parseCents(line.unitCost);
      const errors: LineErrors = {
        ...(product ? {} : { productId: 'Elige un producto' }),
        ...(line.quantity.trim() !== '' && Number.isInteger(quantity) && quantity >= 1
          ? {}
          : { quantity: 'Ingresa un entero, 1 o más' }),
        ...(cents !== null && cents >= 0 ? {} : { unitCost: 'Ingresa un costo, con hasta 2 decimales' }),
        ...(product?.tracksExpiry && !line.expiresAt
          ? { expiresAt: 'Este producto lleva vencimiento: indica la fecha' }
          : {}),
      };
      if (Object.keys(errors).length > 0) {
        found[line.key] = errors;
        continue;
      }
      payload.push({
        productId: line.productId,
        quantity,
        unitCost: centsToAmount(cents as number),
        ...(line.lotNumber.trim() ? { lotNumber: line.lotNumber.trim() } : {}),
        ...(line.expiresAt ? { expiresAt: line.expiresAt } : {}),
      });
    }

    const missingBranch = branchId ? undefined : 'Elige la sede que recibe';
    setBranchError(missingBranch);
    setLineErrors(found);
    if (missingBranch || Object.keys(found).length > 0) return;

    onSubmit({
      branchId,
      ...(supplierName.trim() ? { supplierName: supplierName.trim() } : {}),
      ...(documentNumber.trim() ? { documentNumber: documentNumber.trim() } : {}),
      ...(receivedAt ? { receivedAt } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
      lines: payload,
    });
  };

  return (
    <form className="space-y-4" onSubmit={submit} noValidate>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="receipt-branch" required>
            Sede
          </Label>
          <select
            id="receipt-branch"
            value={branchId}
            onChange={(event) => setBranchId(event.target.value)}
            className={SELECT_CLASS}
          >
            <option value="">Elige una sede</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
          {branchError && <p className="mt-1 text-sm text-destructive">{branchError}</p>}
        </div>
        <div>
          <Label htmlFor="receipt-supplier">Proveedor</Label>
          <Input
            id="receipt-supplier"
            className="h-11"
            value={supplierName}
            maxLength={120}
            onChange={(event) => setSupplierName(event.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="receipt-document">Número de documento</Label>
          <Input
            id="receipt-document"
            className="h-11"
            value={documentNumber}
            maxLength={60}
            onChange={(event) => setDocumentNumber(event.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="receipt-date">Fecha de recepción</Label>
          <Input
            id="receipt-date"
            className="h-11"
            type="date"
            value={receivedAt}
            onChange={(event) => setReceivedAt(event.target.value)}
          />
          <p className="mt-1 text-xs text-muted-foreground">Si la dejas vacía se usa el momento actual.</p>
        </div>
      </div>
      <div>
        <Label htmlFor="receipt-note">Nota</Label>
        <Textarea id="receipt-note" value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} />
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold">Productos recibidos</legend>
        {lines.map((line, index) => {
          const errors = lineErrors[line.key] ?? {};
          const tracksExpiry = products.find((product) => product.id === line.productId)?.tracksExpiry ?? false;
          const id = `receipt-line-${line.key}`;
          return (
            <div key={line.key} className="space-y-3 rounded-md border border-input p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Línea {index + 1}</p>
                {lines.length > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-[44px]"
                    aria-label={`Quitar línea ${index + 1}`}
                    onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="md:col-span-2">
                  <Label htmlFor={`${id}-product`} required>
                    Producto
                  </Label>
                  <select
                    id={`${id}-product`}
                    value={line.productId}
                    onChange={(event) => patchLine(line.key, { productId: event.target.value })}
                    className={SELECT_CLASS}
                  >
                    <option value="">Elige un producto</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.code} · {product.name}
                      </option>
                    ))}
                  </select>
                  {errors.productId && <p className="mt-1 text-sm text-destructive">{errors.productId}</p>}
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
                    step={1}
                    value={line.quantity}
                    error={errors.quantity}
                    onChange={(event) => patchLine(line.key, { quantity: event.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor={`${id}-cost`} required>
                    Costo unitario
                  </Label>
                  <Input
                    id={`${id}-cost`}
                    className="h-11"
                    inputMode="decimal"
                    value={line.unitCost}
                    error={errors.unitCost}
                    onChange={(event) => patchLine(line.key, { unitCost: event.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor={`${id}-lot`}>Lote</Label>
                  <Input
                    id={`${id}-lot`}
                    className="h-11"
                    value={line.lotNumber}
                    maxLength={60}
                    onChange={(event) => patchLine(line.key, { lotNumber: event.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor={`${id}-expiry`} required={tracksExpiry}>
                    Vencimiento
                  </Label>
                  <Input
                    id={`${id}-expiry`}
                    className="h-11"
                    type="date"
                    value={line.expiresAt}
                    error={errors.expiresAt}
                    onChange={(event) => patchLine(line.key, { expiresAt: event.target.value })}
                  />
                </div>
              </div>
            </div>
          );
        })}
        <Button
          type="button"
          variant="outline"
          className="min-h-[44px]"
          disabled={lines.length >= MAX_LINES}
          onClick={addLine}
        >
          <Plus className="mr-2 h-4 w-4" />
          Agregar producto
        </Button>
      </fieldset>

      {error && (
        <Alert variant="destructive" title="No se pudo registrar la entrada">
          {error}
        </Alert>
      )}
      <div className="flex justify-end">
        <Button type="submit" className="min-h-[44px]" disabled={submitting}>
          Registrar entrada
        </Button>
      </div>
    </form>
  );
}
