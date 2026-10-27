'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatMoney } from '@/features/cash/money';
import {
  useCreateProduct,
  useProduct,
  useProducts,
  useSetProductActive,
  useUpdateProduct,
} from '@/hooks/useInventory';
import type { CreateProductInput, ProductSummary, UpdateProductInput } from '@/types/inventory';
import { ProductDetailDialog } from './product-detail-dialog';
import { ProductForm } from './product-form';

const PAGE_SIZE = 20;

type Dialogs = null | { mode: 'create' } | { mode: 'edit' | 'lots'; product: ProductSummary };

function CreateProductDialog({ onClose }: { onClose: () => void }) {
  const create = useCreateProduct();
  return (
    <Dialog open onOpenChange={(open) => !open && !create.isPending && onClose()}>
      <DialogContent
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-product-title"
        className="max-h-[90vh] max-w-2xl overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle id="create-product-title">Nuevo producto</DialogTitle>
          <DialogDescription>El stock se registra después, con una entrada de mercadería.</DialogDescription>
        </DialogHeader>
        <ProductForm
          submitting={create.isPending}
          error={create.error?.message}
          onSubmit={(data) => create.mutate(data, { onSuccess: onClose })}
        />
      </DialogContent>
    </Dialog>
  );
}

function EditProductDialog({ product, onClose }: { product: ProductSummary; onClose: () => void }) {
  const update = useUpdateProduct(product.id);
  const detail = useProduct(product.id);
  // The API lists only lots with a balance (plus expired ones with a balance), so units in the
  // stock rows also count; the API still answers 409 PRODUCT_HAS_STOCK if this misses a case.
  const hasLots = (detail.data?.lots.length ?? 0) > 0 || product.stock.some((row) => row.available > 0);

  const submit = (data: CreateProductInput) => {
    // Only what changed, so an untouched field never trips over a rule.
    const changes: UpdateProductInput = {};
    if (data.code !== product.code) changes.code = data.code;
    if (data.name !== product.name) changes.name = data.name;
    // null and '' are the same blank; an emptied field is sent as '' to clear it.
    if ((data.category ?? '') !== (product.category ?? '')) changes.category = data.category ?? '';
    if ((data.barcode ?? '') !== (product.barcode ?? '')) changes.barcode = data.barcode ?? '';
    if (data.price !== product.price) changes.price = data.price;
    if (data.taxRatePercent !== product.taxRatePercent) changes.taxRatePercent = data.taxRatePercent;
    if (data.tracksExpiry !== product.tracksExpiry) changes.tracksExpiry = data.tracksExpiry;
    if (data.minStock !== product.minStock) changes.minStock = data.minStock;
    if (Object.keys(changes).length === 0) {
      onClose();
      return;
    }
    update.mutate(changes, { onSuccess: onClose });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !update.isPending && onClose()}>
      <DialogContent
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-product-title"
        className="max-h-[90vh] max-w-2xl overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle id="edit-product-title">Editar {product.name}</DialogTitle>
          <DialogDescription>Un precio nuevo se aplica a las ventas que se hagan desde ahora.</DialogDescription>
        </DialogHeader>
        <ProductForm
          product={product}
          hasLots={hasLots}
          submitting={update.isPending}
          error={update.error?.message}
          onSubmit={submit}
        />
      </DialogContent>
    </Dialog>
  );
}

function ActiveToggle({ product }: { product: ProductSummary }) {
  const setActive = useSetProductActive(product.id);
  return (
    <div>
      <Button
        variant="outline"
        size="sm"
        className="min-h-[44px]"
        disabled={setActive.isPending}
        aria-label={`${product.isActive ? 'Desactivar' : 'Activar'} ${product.name}`}
        onClick={() => setActive.mutate(!product.isActive)}
      >
        {product.isActive ? 'Desactivar' : 'Activar'}
      </Button>
      {setActive.error && (
        <p role="alert" className="mt-1 max-w-48 text-xs text-destructive">
          {setActive.error.message}
        </p>
      )}
    </div>
  );
}

export function ProductsTab() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<Dialogs>(null);
  const products = useProducts({ search: search.trim() || undefined, page, pageSize: PAGE_SIZE });
  const close = () => setDialog(null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="w-full max-w-sm">
          <Label htmlFor="product-search">Buscar producto</Label>
          <Input
            id="product-search"
            className="mt-1 h-11"
            value={search}
            placeholder="Nombre, código o código de barras"
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </div>
        <Button className="min-h-[44px]" onClick={() => setDialog({ mode: 'create' })}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo producto
        </Button>
      </div>

      {products.isError ? (
        <Alert variant="destructive" title="No se pudieron cargar los productos">
          <Button variant="outline" size="sm" className="mt-2 min-h-[44px]" onClick={() => products.refetch()}>
            Reintentar
          </Button>
        </Alert>
      ) : products.isPending ? (
        <Skeleton className="h-32 w-full" />
      ) : products.data.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay productos que mostrar.</p>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Precio</TableHead>
                <TableHead>Stock por sede</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.data.items.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-mono">{product.code}</TableCell>
                  <TableCell>
                    <span className="font-medium">{product.name}</span>
                    {!product.isActive && (
                      <Badge variant="secondary" className="ml-2">
                        Inactivo
                      </Badge>
                    )}
                    {product.category && <p className="text-xs text-muted-foreground">{product.category}</p>}
                  </TableCell>
                  <TableCell>{formatMoney(product.price)}</TableCell>
                  <TableCell>
                    <ul className="space-y-1">
                      {product.stock.map((row) => (
                        <li key={row.branchId} className="flex flex-wrap items-center gap-2">
                          <span>
                            {row.branchName}: {row.available}
                          </span>
                          {row.belowMin && <Badge variant="warning">Bajo mínimo</Badge>}
                        </li>
                      ))}
                    </ul>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-start gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="min-h-[44px]"
                        aria-label={`Ver lotes de ${product.name}`}
                        onClick={() => setDialog({ mode: 'lots', product })}
                      >
                        Lotes
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="min-h-[44px]"
                        aria-label={`Editar ${product.name}`}
                        onClick={() => setDialog({ mode: 'edit', product })}
                      >
                        Editar
                      </Button>
                      <ActiveToggle product={product} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination
            page={products.data.page}
            totalPages={Math.max(1, Math.ceil(products.data.total / PAGE_SIZE))}
            total={products.data.total}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </>
      )}

      {dialog?.mode === 'create' && <CreateProductDialog onClose={close} />}
      {dialog?.mode === 'edit' && <EditProductDialog product={dialog.product} onClose={close} />}
      {dialog?.mode === 'lots' && <ProductDetailDialog product={dialog.product} onClose={close} />}
    </div>
  );
}
