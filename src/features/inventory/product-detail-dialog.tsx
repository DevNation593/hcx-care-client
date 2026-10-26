'use client';

import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { formatMoney } from '@/features/cash/money';
import { useProduct } from '@/hooks/useInventory';
import { formatDate } from '@/lib/utils';
import type { ProductSummary, StockLotView } from '@/types/inventory';
import { AdjustLotForm } from './adjust-lot-form';

export function ProductDetailDialog({ product, onClose }: { product: ProductSummary; onClose: () => void }) {
  const detail = useProduct(product.id);
  const [adjustingId, setAdjustingId] = useState<string | null>(null);

  const branchName = (branchId: string) =>
    product.stock.find((row) => row.branchId === branchId)?.branchName ?? branchId;

  // Lots grouped by branch, in the order the API sent them.
  const byBranch = new Map<string, StockLotView[]>();
  for (const lot of detail.data?.lots ?? []) {
    byBranch.set(lot.branchId, [...(byBranch.get(lot.branchId) ?? []), lot]);
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-detail-title"
        className="max-h-[90vh] max-w-3xl overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle id="product-detail-title">Lotes de {product.name}</DialogTitle>
          <DialogDescription>Existencias por sede. Un ajuste corrige el saldo de un lote.</DialogDescription>
        </DialogHeader>
        {detail.isError ? (
          <Alert variant="destructive" title="No se pudieron cargar los lotes">
            <Button variant="outline" size="sm" className="mt-2 min-h-[44px]" onClick={() => detail.refetch()}>
              Reintentar
            </Button>
          </Alert>
        ) : !detail.data ? (
          <Skeleton className="h-24 w-full" />
        ) : byBranch.size === 0 ? (
          <p className="text-sm text-muted-foreground">Este producto no tiene lotes con existencias.</p>
        ) : (
          <div className="space-y-5">
            {Array.from(byBranch, ([branchId, lots]) => (
              <section key={branchId} aria-label={branchName(branchId)} className="space-y-2">
                <h3 className="font-medium">{branchName(branchId)}</h3>
                <ul className="divide-y rounded-md border border-input">
                  {lots.map((lot) => (
                    <li key={lot.id} className="space-y-2 p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">Lote {lot.lotNumber ?? 'sin número'}</span>
                            {lot.expiresAt && (
                              <span className="text-muted-foreground">
                                Vence {formatDate(lot.expiresAt, 'dd/MM/yyyy')}
                              </span>
                            )}
                            {lot.expired && <Badge variant="destructive">Vencido</Badge>}
                          </div>
                          <p className="text-muted-foreground">
                            Costo {formatMoney(lot.unitCost)} · Recibido {lot.quantityReceived} · Disponible{' '}
                            {lot.quantityOnHand}
                          </p>
                        </div>
                        {adjustingId !== lot.id && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="min-h-[44px]"
                            aria-label={`Ajustar lote ${lot.lotNumber ?? 'sin número'}`}
                            onClick={() => setAdjustingId(lot.id)}
                          >
                            Ajustar
                          </Button>
                        )}
                      </div>
                      {adjustingId === lot.id && (
                        <AdjustLotForm productId={product.id} lot={lot} onDone={() => setAdjustingId(null)} />
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
