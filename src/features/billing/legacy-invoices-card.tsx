'use client';

import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Pagination } from '@/components/ui/pagination';
import { usePagination } from '@/hooks/usePagination';
import { billingApi } from '@/lib/api/endpoints';
import { QUERY_KEYS } from '@/lib/constants';
import { formatDate } from '@/lib/utils';
import type { Invoice } from '@/types';

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
// Document links come from the former invoicing provider; only real web addresses are rendered.
const isWebUrl = (value?: string) => !!value && /^https?:\/\//i.test(value);

/**
 * Receipts issued through the former invoicing provider, read-only. Nothing writes them any
 * more, so the card only appears for a clinic that still has some.
 */
export function LegacyInvoicesCard({ enabled }: { enabled: boolean }) {
  const invoicesQuery = useQuery({ queryKey: INVOICES_KEY, queryFn: () => billingApi.listInvoices(), enabled });
  const invoices = invoicesQuery.data ?? [];
  const pagination = usePagination(invoices);

  if (!enabled || invoicesQuery.isPending) return null;
  if (invoicesQuery.isError) {
    return (
      <div role="alert" className="flex flex-wrap items-center gap-3 text-sm">
        <p>No se pudieron cargar los comprobantes anteriores.</p>
        <Button type="button" variant="outline" size="sm" onClick={() => void invoicesQuery.refetch()}>
          Reintentar
        </Button>
      </div>
    );
  }
  if (invoices.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Comprobantes anteriores</CardTitle>
        <CardDescription>Emitidos con el proveedor de facturación anterior. Solo lectura.</CardDescription>
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
  );
}
