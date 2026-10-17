'use client';
import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Pagination } from '@/components/ui/pagination';
import { useInvoiceRequests, useInvoicingPermissions } from '@/hooks/useInvoicing';
import { INVOICE_STATUS_LABELS, type InvoiceStatus } from '@/types/invoicing';
import { InvoiceSummary } from './invoice-summary';

export function InvoicesTab({ branchId, patientId }: { branchId?: string; patientId?: string }) {
  const { view } = useInvoicingPermissions();
  const [status, setStatus] = useState<InvoiceStatus | ''>('');
  const [page, setPage] = useState(1);
  const invoices = useInvoiceRequests({
    ...(branchId ? { branchId } : {}),
    ...(patientId ? { patientId } : {}),
    page,
    pageSize: 20,
    ...(status ? { status } : {}),
  });
  if (!view)
    return (
      <p className="text-sm text-muted-foreground">No tienes permiso para consultar facturas.</p>
    );
  return (
    <div className="space-y-4">
      <div className="max-w-xs">
        <Label htmlFor="invoice-status">Estado de factura</Label>
        <select
          id="invoice-status"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as InvoiceStatus | '');
            setPage(1);
          }}
          className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Todas</option>
          {Object.entries(INVOICE_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      {invoices.isPending && (
        <p role="status" className="text-sm text-muted-foreground">
          Cargando facturas…
        </p>
      )}
      {invoices.isError && (
        <Alert variant="destructive">
          No se pudieron actualizar las facturas.{' '}
          <Button type="button" variant="link" onClick={() => void invoices.refetch()}>
            Reintentar facturas
          </Button>
        </Alert>
      )}
      {invoices.data?.items.length === 0 && (
        <p className="text-sm text-muted-foreground">No hay facturas para estos filtros.</p>
      )}
      {invoices.data?.items.map((request) => (
        <Card key={request.id}>
          <CardContent className="space-y-3 pt-4">
            <p className="font-medium">
              Orden {request.orderNumber ? `#${request.orderNumber}` : request.orderId}
            </p>
            <p className="text-sm text-muted-foreground">
              Solicitada: {new Date(request.requestedAt).toLocaleString('es-EC')}
            </p>
            <InvoiceSummary request={request} canView={view} />
          </CardContent>
        </Card>
      ))}
      {invoices.data && (
        <Pagination
          page={page}
          totalPages={Math.max(1, Math.ceil(invoices.data.total / 20))}
          total={invoices.data.total}
          pageSize={20}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
