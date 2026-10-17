'use client';
import { useRef, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  useInvoiceRequest,
  useInvoiceRequests,
  useInvoicingPermissions,
  useRequestInvoice,
} from '@/hooks/useInvoicing';
import type { ApiError } from '@/types';
import type { BillingEligibility, Order } from '@/types/cash';
import type { InvoiceReceipt } from '@/types/invoicing';
import { EligibilityChecklist } from './eligibility-checklist';
import { InvoiceSummary } from './invoice-summary';

export function InvoiceRequestPanel({
  order,
  eligibility,
}: {
  order: Order;
  eligibility?: BillingEligibility;
}) {
  const { view, create } = useInvoicingPermissions();
  const list = useInvoiceRequests({ orderId: order.id, page: 1, pageSize: 1 });
  const [receipt, setReceipt] = useState<InvoiceReceipt>();
  const idempotencyKey = useRef<string>();
  const [error, setError] = useState<ApiError>();
  const mutation = useRequestInvoice(order.id);
  const selected = receipt ?? list.data?.items[0];
  const detail = useInvoiceRequest(selected?.id);
  const request = detail.data ?? selected;
  const safeFinal =
    !!request &&
    !request.requiresReconciliation &&
    (request.status === 'REJECTED' || request.status === 'FAILED');
  const uncertainRetry =
    !!error &&
    !!idempotencyKey.current &&
    (!error.status || error.status >= 500) &&
    (!request || (!safeFinal && request.status !== 'AUTHORIZED'));
  const canStart = !!eligibility?.eligible && order.status === 'PAID';
  const checklist = error?.billingEligibility ?? eligibility;
  async function submit(fresh = false) {
    if (mutation.isPending) return;
    if (fresh) idempotencyKey.current = undefined;
    idempotencyKey.current ??= crypto.randomUUID();
    setError(undefined);
    try {
      setReceipt(await mutation.mutateAsync(idempotencyKey.current));
    } catch (error) {
      setError(error as ApiError);
    }
  }
  return (
    <div className="space-y-3">
      {checklist ? (
        <EligibilityChecklist eligibility={checklist} order={order} />
      ) : (
        <p className="text-sm text-muted-foreground">Revisando requisitos…</p>
      )}
      {request && <InvoiceSummary request={request} canView={view} />}
      {view && (list.isError || detail.isError) && (
        <Alert variant="warning">
          No se pudo actualizar la factura. Conservamos el último estado conocido.
          <Button
            type="button"
            variant="link"
            size="sm"
            onClick={() => {
              void list.refetch();
              if (selected) void detail.refetch();
            }}
          >
            Actualizar factura
          </Button>
        </Alert>
      )}
      {error && <Alert variant="destructive">{error.message}</Alert>}
      {create && (!request || safeFinal || uncertainRetry) && (
        <Button
          type="button"
          disabled={mutation.isPending || (!uncertainRetry && !canStart)}
          onClick={() => void submit(safeFinal && !uncertainRetry)}
        >
          {mutation.isPending
            ? 'Solicitando…'
            : uncertainRetry
              ? 'Reintentar emisión'
              : safeFinal
                ? 'Volver a emitir'
                : 'Emitir factura'}
        </Button>
      )}
      {!view && receipt && (
        <p className="text-sm text-muted-foreground">
          Solicitud recibida. Se necesita billing.view para consultar el resultado y descargar
          documentos.
        </p>
      )}
    </div>
  );
}
