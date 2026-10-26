'use client';

import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { centsToAmount, parseCents } from '@/features/cash/money';
import type { CreateProductInput, ProductSummary } from '@/types/inventory';

// Same rule as the API: a code the invoicing provider accepts.
const CODE_PATTERN = /^[A-Z0-9][A-Z0-9._-]{0,19}$/;
const TAX_RATES = [0, 5, 15];

interface ProductFormProps {
  /** Present when editing. */
  product?: ProductSummary;
  /** The product has lots: whether it tracks expiry can no longer change. */
  hasLots?: boolean;
  submitting?: boolean;
  /** The `message` the API answered (409, 422). */
  error?: string | null;
  onSubmit: (data: CreateProductInput) => void;
}

type Errors = Partial<Record<'code' | 'name' | 'price' | 'minStock', string>>;

export function ProductForm({ product, hasLots = false, submitting, error, onSubmit }: ProductFormProps) {
  const [code, setCode] = useState(product?.code ?? '');
  const [name, setName] = useState(product?.name ?? '');
  const [category, setCategory] = useState(product?.category ?? '');
  const [barcode, setBarcode] = useState(product?.barcode ?? '');
  const [price, setPrice] = useState(product?.price ?? '');
  const [taxRate, setTaxRate] = useState(String(product?.taxRatePercent ?? 15));
  const [tracksExpiry, setTracksExpiry] = useState(product?.tracksExpiry ?? false);
  const [minStock, setMinStock] = useState(String(product?.minStock ?? 0));
  const [errors, setErrors] = useState<Errors>({});

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const cents = parseCents(price);
    const min = Number(minStock);
    const found: Errors = {
      ...(CODE_PATTERN.test(code.trim())
        ? {}
        : { code: 'El código debe tener de 1 a 20 letras, números, punto, guion o guion bajo' }),
      ...(name.trim().length >= 2 ? {} : { name: 'El nombre debe tener al menos 2 caracteres' }),
      ...(cents !== null && cents > 0 ? {} : { price: 'Ingresa un precio mayor que 0, con hasta 2 decimales' }),
      ...(Number.isInteger(min) && min >= 0 ? {} : { minStock: 'Ingresa un número entero, 0 o más' }),
    };
    setErrors(found);
    if (Object.keys(found).length > 0 || cents === null) return;

    onSubmit({
      code: code.trim(),
      name: name.trim(),
      // When editing, a blank is sent as '' so the API clears the field.
      ...(product || category.trim() ? { category: category.trim() } : {}),
      ...(product || barcode.trim() ? { barcode: barcode.trim() } : {}),
      price: centsToAmount(cents),
      taxRatePercent: Number(taxRate),
      tracksExpiry,
      minStock: min,
    });
  };

  return (
    <form className="space-y-4" onSubmit={submit} noValidate>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="product-code" required>
            Código
          </Label>
          <Input
            id="product-code"
            className="h-11 font-mono"
            value={code}
            maxLength={20}
            error={errors.code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
          />
        </div>
        <div>
          <Label htmlFor="product-name" required>
            Nombre
          </Label>
          <Input
            id="product-name"
            className="h-11"
            value={name}
            maxLength={120}
            error={errors.name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="product-category">Categoría</Label>
          <Input
            id="product-category"
            className="h-11"
            value={category}
            maxLength={120}
            onChange={(event) => setCategory(event.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="product-barcode">Código de barras</Label>
          <Input
            id="product-barcode"
            className="h-11"
            value={barcode}
            maxLength={64}
            onChange={(event) => setBarcode(event.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="product-price" required>
            Precio
          </Label>
          <Input
            id="product-price"
            className="h-11"
            inputMode="decimal"
            value={price}
            error={errors.price}
            onChange={(event) => setPrice(event.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="product-tax" required>
            IVA
          </Label>
          <select
            id="product-tax"
            value={taxRate}
            onChange={(event) => setTaxRate(event.target.value)}
            className="mt-1 h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {TAX_RATES.map((rate) => (
              <option key={rate} value={rate}>
                {rate}%
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="product-min-stock">Stock mínimo</Label>
          <Input
            id="product-min-stock"
            className="h-11"
            type="number"
            min={0}
            step={1}
            value={minStock}
            error={errors.minStock}
            onChange={(event) => setMinStock(event.target.value)}
          />
        </div>
        <div className="flex flex-col justify-end">
          <label className="flex min-h-[44px] items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={tracksExpiry}
              disabled={hasLots}
              onChange={(event) => setTracksExpiry(event.target.checked)}
            />
            Lleva vencimiento
          </label>
          {hasLots && (
            <p className="text-xs text-muted-foreground">
              No se puede cambiar mientras el producto tenga lotes.
            </p>
          )}
        </div>
      </div>
      {error && (
        <Alert variant="destructive" title="No se pudo guardar el producto">
          {error}
        </Alert>
      )}
      <div className="flex justify-end">
        <Button type="submit" className="min-h-[44px]" disabled={submitting}>
          {product ? 'Guardar cambios' : 'Crear producto'}
        </Button>
      </div>
    </form>
  );
}
