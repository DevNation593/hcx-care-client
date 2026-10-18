'use client';

import Link from 'next/link';
import { InvoicesTab } from '@/features/cash/invoices-tab';
import { useInvoicingPermissions } from '@/hooks/useInvoicing';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Pagination } from '@/components/ui/pagination';
import { usePagination } from '@/hooks/usePagination';
import { billingApi } from '@/lib/api/endpoints';
import { QUERY_KEYS } from '@/lib/constants';
import { formatDate } from '@/lib/utils';
import type { Invoice } from '@/types';

const STATUS_LABELS: Record<Invoice['status'], string> = {
  PENDING: 'Pendiente', ISSUED: 'Emitida', FAILED: 'Fallida', VOIDED: 'Anulada',
};
const isWebUrl = (value?: string) => !!value && /^https?:\/\//i.test(value);

function HistoricalPatientInvoices({ patientId }: { patientId: string }) {
  const invoices = useQuery({
    queryKey: [...QUERY_KEYS.TENANT, 'billing', 'invoices', { patientId }],
    queryFn: () => billingApi.listInvoices({ patientId }),
    enabled: !!patientId,
  });
  const items = invoices.data ?? [];
  const pagination = usePagination(items, { resetKey: patientId });

  if (invoices.isLoading) return <p role="status" className="text-sm text-muted-foreground">Cargando facturas...</p>;
  if (invoices.isError) {
    return (
      <div role="alert" className="space-y-3 text-sm">
        <p>No se pudieron cargar las facturas.</p>
        <Button type="button" variant="outline" size="sm" onClick={() => void invoices.refetch()}>Reintentar</Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end gap-4">
        <Link href="/cash" className="text-sm text-primary underline">Cobrar en caja</Link>
        <Link href="/admin/billing" className="text-sm text-primary underline">Ir a Facturación</Link>
      </div>
      {items.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Este paciente aún no tiene facturas.</CardContent></Card>
      ) : pagination.pageItems.map((invoice) => (
        <Card key={invoice.id}>
          <CardContent className="flex flex-wrap items-start justify-between gap-3 pt-4">
            <div>
              <p className="font-medium">{invoice.description}</p>
              <p className="text-sm text-muted-foreground">
                {formatDate(invoice.issueDate, 'dd/MM/yyyy')} · Facturado a <span>{invoice.customerName}</span>
              </p>
              {invoice.status === 'FAILED' && invoice.errorMessage && (
                <p className="mt-1 text-xs text-destructive">{invoice.errorMessage}</p>
              )}
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="font-semibold">${Number(invoice.total).toFixed(2)}</span>
              <Badge variant={invoice.status === 'ISSUED' ? 'default' : invoice.status === 'FAILED' ? 'destructive' : 'outline'}>
                {STATUS_LABELS[invoice.status] ?? invoice.status}
              </Badge>
              {isWebUrl(invoice.pdfUrl) && <a href={invoice.pdfUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">PDF</a>}
              {isWebUrl(invoice.xmlUrl) && <a href={invoice.xmlUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">XML</a>}
            </div>
          </CardContent>
        </Card>
      ))}
      <Pagination
        page={pagination.page}
        totalPages={pagination.totalPages}
        total={pagination.total}
        pageSize={pagination.pageSize}
        onPageChange={pagination.setPage}
      />
    </div>
  );
}

export function PatientInvoicesTab({ patientId }: { patientId: string }) {
  const { view } = useInvoicingPermissions();
  if (!view) return <p className="text-sm text-muted-foreground">No tienes permiso para consultar facturas.</p>;
  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h3 className="font-semibold">Facturas de órdenes</h3>
        <InvoicesTab key={patientId} patientId={patientId} />
      </section>
      <section className="space-y-3">
        <h3 className="font-semibold">Comprobantes históricos</h3>
        <HistoricalPatientInvoices patientId={patientId} />
      </section>
    </div>
  );
}
