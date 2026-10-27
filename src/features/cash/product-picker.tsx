'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useProductsForSale } from '@/hooks/useInventory';
import { productsApi } from '@/lib/api/endpoints';
import { QUERY_KEYS } from '@/lib/constants';
import type { ProductForSale } from '@/types/inventory';
import { formatMoney } from './money';

interface ProductPickerProps {
  branchId: string;
  disabled: boolean;
  onAdd: (productId: string, quantity: number) => Promise<void>;
}

function ProductRow({
  product,
  disabled,
  onAdd,
}: {
  product: ProductForSale;
  disabled: boolean;
  onAdd: ProductPickerProps['onAdd'];
}) {
  const [quantity, setQuantity] = useState('1');
  const units = /^\d+$/.test(quantity) ? Number(quantity) : 0;
  const soldOut = product.available <= 0;

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <span>
        <span className="font-medium">{product.name}</span> · {product.code} · {formatMoney(product.price)} ·{' '}
        <span>{product.available} disponibles</span>
      </span>
      <span className="flex items-center gap-1">
        <Input
          aria-label={`Cantidad de ${product.name}`}
          inputMode="numeric"
          className="h-8 w-16 text-right"
          value={quantity}
          disabled={disabled || soldOut}
          onChange={(event) => setQuantity(event.target.value)}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          aria-label={`Agregar ${product.name}`}
          disabled={disabled || soldOut || units < 1}
          onClick={() => onAdd(product.id, units)}
        >
          {soldOut ? 'Sin stock en esta sede' : 'Agregar'}
        </Button>
      </span>
    </li>
  );
}

/** Search by name or code, or scan a barcode and press Enter to add one unit. */
export function ProductPicker({ branchId, disabled, onAdd }: ProductPickerProps) {
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const [scanning, setScanning] = useState(false);
  const { data, isPending, isFetching } = useProductsForSale(branchId, text);
  const term = text.trim();

  // The API matches `search` on name and code only; a barcode has its own exact parameter.
  const addByBarcode = async () => {
    if (!term || scanning || disabled) return;
    setScanning(true);
    try {
      const matches = await queryClient.fetchQuery({
        queryKey: [...QUERY_KEYS.PRODUCTS, 'for-sale', branchId, 'barcode', term],
        queryFn: () => productsApi.forSale(branchId, '', term),
        staleTime: 0,
      });
      if (matches.length === 1) {
        await onAdd(matches[0].id, 1);
        setText('');
      }
    } catch {
      // A failed lookup leaves the search results as they are.
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="space-y-2 rounded-md border p-3">
      <Input
        aria-label="Buscar producto o código de barras"
        placeholder="Nombre, código o código de barras"
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return;
          event.preventDefault();
          void addByBarcode();
        }}
      />
      {term === '' ? null : isPending && isFetching ? (
        <p className="text-sm text-muted-foreground">Buscando productos…</p>
      ) : (data ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay productos que coincidan.</p>
      ) : (
        <ul className="space-y-2">
          {(data ?? []).map((product) => (
            <ProductRow key={product.id} product={product} disabled={disabled} onAdd={onAdd} />
          ))}
        </ul>
      )}
    </div>
  );
}
