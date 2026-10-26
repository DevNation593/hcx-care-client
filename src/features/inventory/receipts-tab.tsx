'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useBranches } from '@/hooks/useBranches';
import { useCreateStockReceipt, useProducts, useStockReceipts } from '@/hooks/useInventory';
import { ReceiptForm } from './receipt-form';

const PAGE_SIZE = 20;
// The API caps a page at 100 products; the form offers the first 100 active ones.
const PRODUCT_OPTIONS = 100;

function CreateReceiptDialog({ onClose }: { onClose: () => void }) {
  const create = useCreateStockReceipt();
  const branches = useBranches();
  const products = useProducts({ active: true, pageSize: PRODUCT_OPTIONS });
  const activeBranches = (branches.data ?? []).filter((branch) => branch.isActive);

  return (
    <Dialog open onOpenChange={(open) => !open && !create.isPending && onClose()}>
      <DialogContent
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-receipt-title"
        className="max-h-[90vh] max-w-3xl overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle id="create-receipt-title">Registrar entrada de mercadería</DialogTitle>
          <DialogDescription>Cada línea crea un lote con su costo y, si el producto lo lleva, su vencimiento.</DialogDescription>
        </DialogHeader>
        {branches.isError || products.isError ? (
          <Alert variant="destructive" title="No se pudieron cargar las sedes o los productos" />
        ) : branches.isPending || products.isPending ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <ReceiptForm
            branches={activeBranches}
            products={products.data.items}
            submitting={create.isPending}
            error={create.error?.message}
            onSubmit={(data) => create.mutate(data, { onSuccess: onClose })}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

export function ReceiptsTab() {
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const receipts = useStockReceipts({ page, pageSize: PAGE_SIZE });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button className="min-h-[44px]" onClick={() => setCreating(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Registrar entrada
        </Button>
      </div>

      {receipts.isError ? (
        <Alert variant="destructive" title="No se pudieron cargar las entradas">
          <Button variant="outline" size="sm" className="mt-2 min-h-[44px]" onClick={() => receipts.refetch()}>
            Reintentar
          </Button>
        </Alert>
      ) : receipts.isPending ? (
        <Skeleton className="h-32 w-full" />
      ) : receipts.data.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía no hay entradas registradas.</p>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Sede</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead>Documento</TableHead>
                <TableHead>Líneas</TableHead>
                <TableHead>Registrada por</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {receipts.data.items.map((receipt) => (
                <TableRow key={receipt.id}>
                  <TableCell>{new Date(receipt.receivedAt).toLocaleDateString('es-EC')}</TableCell>
                  <TableCell>{receipt.branch.name}</TableCell>
                  <TableCell>{receipt.supplierName ?? '—'}</TableCell>
                  <TableCell>{receipt.documentNumber ?? '—'}</TableCell>
                  <TableCell>{receipt.lines.length}</TableCell>
                  <TableCell>
                    {receipt.createdBy.firstName} {receipt.createdBy.lastName}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination
            page={receipts.data.page}
            totalPages={Math.max(1, Math.ceil(receipts.data.total / PAGE_SIZE))}
            total={receipts.data.total}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </>
      )}

      {creating && <CreateReceiptDialog onClose={() => setCreating(false)} />}
    </div>
  );
}
