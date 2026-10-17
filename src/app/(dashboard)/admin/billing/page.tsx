'use client';

import { InvoicingSettings } from '@/features/billing/invoicing-settings';
import { useInvoicingPermissions } from '@/hooks/useInvoicing';
import { SectionGate } from '@/components/layout/section-gate';
import { useQuery } from '@tanstack/react-query';
import { FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Pagination } from '@/components/ui/pagination';
import { usePagination } from '@/hooks/usePagination';
import { billingApi } from '@/lib/api/endpoints';
import { QUERY_KEYS } from '@/lib/constants';
import { Invoice } from '@/types';
import { formatDate } from '@/lib/utils';

const STATUS_LABELS: Record<Invoice['status'], string> = {
  PENDING: 'Pendiente',
  ISSUED: 'Emitida',
  FAILED: 'Fallida',
  VOIDED: 'Anulada',
};
const STATUS_VARIANTS: Record<Invoice['status'], 'default' | 'outline' | 'destructive' | 'secondary'> = {
  PENDING: 'secondary',
  ISSUED: 'default',
  FAILED: 'destructive',
  VOIDED: 'outline',
};
const INVOICES_KEY = [...QUERY_KEYS.TENANT, 'billing', 'invoices'];

const money = (value: number | string) => `$${Number(value).toFixed(2)}`;
// Document links come from the invoicing provider; only real web addresses are rendered.
const isWebUrl = (value?: string) => !!value && /^https?:\/\//i.test(value);

function BillingPageContent() {
  const { view } = useInvoicingPermissions();
  const invoicesQuery = useQuery({ queryKey: INVOICES_KEY, queryFn: () => billingApi.listInvoices(), enabled: view });
  const invoices = invoicesQuery.data ?? [];
  const pagination = usePagination(invoices);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold">
            <FileText className="h-7 w-7" />
            Facturación
          </h1>
          <p className="mt-1 text-muted-foreground">
            Consulta el historial de comprobantes electrónicos de este consultorio.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Emite facturas desde las órdenes pagadas en Caja.
          </p>
        </div>
      </div>

      <InvoicingSettings />
      {view && <Card>
        <CardHeader>
          <CardTitle>Comprobantes electrónicos</CardTitle>
          <CardDescription>
            Historial de este consultorio, solo lectura.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {invoicesQuery.isLoading ? (
            <p role="status" className="text-sm text-muted-foreground">Cargando comprobantes...</p>
          ) : invoicesQuery.isError ? (
            <div role="alert" className="flex flex-col items-center gap-3 py-10 text-sm">
              <p>No se pudieron cargar los comprobantes.</p>
              <Button type="button" variant="outline" size="sm" onClick={() => void invoicesQuery.refetch()}>
                Reintentar
              </Button>
            </div>
          ) : invoices.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Aún no hay comprobantes emitidos.
            </div>
          ) : (
            <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th scope="col" className="p-3 font-medium">Fecha</th>
                    <th scope="col" className="p-3 font-medium">Paciente</th>
                    <th scope="col" className="p-3 font-medium">Facturado a</th>
                    <th scope="col" className="p-3 font-medium">Emisor</th>
                    <th scope="col" className="p-3 font-medium">Descripción</th>
                    <th scope="col" className="p-3 text-right font-medium">Total</th>
                    <th scope="col" className="p-3 font-medium">Estado</th>
                    <th scope="col" className="p-3 font-medium">Documentos</th>
                  </tr>
                </thead>
                <tbody>
                  {pagination.pageItems.map((invoice) => (
                    <tr key={invoice.id} className="border-b align-top last:border-0">
                      <td className="whitespace-nowrap p-3">{formatDate(invoice.issueDate, 'dd/MM/yyyy')}</td>
                      <td className="p-3">
                        {invoice.patient ? `${invoice.patient.firstName} ${invoice.patient.lastName}` : '—'}
                      </td>
                      <td className="p-3">
                        <span className="block">{invoice.customerName}</span>
                        {invoice.customerTaxId && (
                          <span className="block text-xs text-muted-foreground">
                            {invoice.customerTaxIdType} {invoice.customerTaxId}
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        {invoice.issuer ? `${invoice.issuer.firstName} ${invoice.issuer.lastName}` : '—'}
                      </td>
                      <td className="p-3">{invoice.description}</td>
                      <td className="whitespace-nowrap p-3 text-right">{money(invoice.total)}</td>
                      <td className="p-3">
                        <Badge variant={STATUS_VARIANTS[invoice.status] ?? 'outline'}>
                          {STATUS_LABELS[invoice.status] ?? invoice.status}
                        </Badge>
                        {invoice.status === 'FAILED' && invoice.errorMessage && (
                          <p className="mt-1 max-w-xs text-xs text-destructive">{invoice.errorMessage}</p>
                        )}
                      </td>
                      <td className="whitespace-nowrap p-3">
                        {isWebUrl(invoice.pdfUrl) || isWebUrl(invoice.xmlUrl) ? (
                          <span className="flex gap-3">
                            {isWebUrl(invoice.pdfUrl) && (
                              <a href={invoice.pdfUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                                PDF
                              </a>
                            )}
                            {isWebUrl(invoice.xmlUrl) && (
                              <a href={invoice.xmlUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                                XML
                              </a>
                            )}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              className="mt-4"
              page={pagination.page}
              totalPages={pagination.totalPages}
              total={pagination.total}
              pageSize={pagination.pageSize}
              onPageChange={pagination.setPage}
            />
            </>
          )}
        </CardContent>
      </Card>}
    </div>
  );
}

export default function BillingPage() {
  return (
    <SectionGate section="core.billing">
      <BillingPageContent />
    </SectionGate>
  );
}
