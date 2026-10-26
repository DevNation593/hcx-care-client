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
import { useCreateStockTransfer, useProducts, useStockTransfers } from '@/hooks/useInventory';
import { TransferForm } from './transfer-form';

const PAGE_SIZE = 20;
// The API caps a page at 100 products; the form offers the first 100 active ones.
const PRODUCT_OPTIONS = 100;

function CreateTransferDialog({ onClose }: { onClose: () => void }) {
  const create = useCreateStockTransfer();
  const branches = useBranches();
  const products = useProducts({ active: true, pageSize: PRODUCT_OPTIONS });
  const activeBranches = (branches.data ?? []).filter((branch) => branch.isActive);

  return (
    <Dialog open onOpenChange={(open) => !open && !create.isPending && onClose()}>
      <DialogContent
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-transfer-title"
        className="max-h-[90vh] max-w-3xl overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle id="create-transfer-title">Registrar traslado entre sedes</DialogTitle>
          <DialogDescription>Se ofrecen los lotes vigentes con saldo en la sede de origen.</DialogDescription>
        </DialogHeader>
        {branches.isError || products.isError ? (
          <Alert variant="destructive" title="No se pudieron cargar las sedes o los productos" />
        ) : branches.isPending || products.isPending ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <TransferForm
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

export function TransfersTab() {
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const transfers = useStockTransfers({ page, pageSize: PAGE_SIZE });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button className="min-h-[44px]" onClick={() => setCreating(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Registrar traslado
        </Button>
      </div>

      {transfers.isError ? (
        <Alert variant="destructive" title="No se pudieron cargar los traslados">
          <Button variant="outline" size="sm" className="mt-2 min-h-[44px]" onClick={() => transfers.refetch()}>
            Reintentar
          </Button>
        </Alert>
      ) : transfers.isPending ? (
        <Skeleton className="h-32 w-full" />
      ) : transfers.data.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía no hay traslados registrados.</p>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Origen</TableHead>
                <TableHead>Destino</TableHead>
                <TableHead>Líneas</TableHead>
                <TableHead>Registrado por</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transfers.data.items.map((transfer) => (
                <TableRow key={transfer.id}>
                  <TableCell>{new Date(transfer.createdAt).toLocaleDateString('es-EC')}</TableCell>
                  <TableCell>{transfer.fromBranch.name}</TableCell>
                  <TableCell>{transfer.toBranch.name}</TableCell>
                  <TableCell>{transfer.lines.length}</TableCell>
                  <TableCell>
                    {transfer.createdBy.firstName} {transfer.createdBy.lastName}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination
            page={transfers.data.page}
            totalPages={Math.max(1, Math.ceil(transfers.data.total / PAGE_SIZE))}
            total={transfers.data.total}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </>
      )}

      {creating && <CreateTransferDialog onClose={() => setCreating(false)} />}
    </div>
  );
}
