'use client';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { invoicingApi } from '@/lib/api/invoicing-api';
import { requireTenantId, useTenantId } from '@/hooks/useTenantScope';
import { INVOICE_STATUS_LABELS, type InvoiceRequest } from '@/types/invoicing';
import type { ApiError } from '@/types';

export function InvoiceSummary({
  request,
  canView,
}: {
  request: InvoiceRequest;
  canView: boolean;
}) {
  const tenantId = useTenantId();
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);
  async function download(kind: 'xml' | 'ride') {
    setError('');
    setDownloading(true);
    try {
      await invoicingApi.download(requireTenantId(tenantId), request, kind);
    } catch (error) {
      setError((error as ApiError).message || 'No se pudo descargar el documento.');
    } finally {
      setDownloading(false);
    }
  }
  return (
    <div className="space-y-3 text-sm">
      <Badge
        variant={
          request.status === 'AUTHORIZED'
            ? 'default'
            : request.status === 'REJECTED' || request.status === 'FAILED'
              ? 'destructive'
              : 'secondary'
        }
      >
        {INVOICE_STATUS_LABELS[request.status]}
      </Badge>
      {request.requiresReconciliation && (
        <Alert variant="warning">
          Conciliación pendiente: espera la confirmación antes de volver a emitir o devolver pagos.
        </Alert>
      )}
      {request.status === 'AUTHORIZED' && (
        <p>Factura autorizada. La anulación no está disponible en HCX.</p>
      )}
      {request.number && <p>Número: {request.number}</p>}
      {request.accessKey && <p className="break-all">Clave de acceso: {request.accessKey}</p>}
      {request.authorizationNumber && (
        <p className="break-all">Autorización: {request.authorizationNumber}</p>
      )}
      {request.authorizedAt && (
        <p>Fecha de autorización: {new Date(request.authorizedAt).toLocaleString('es-EC')}</p>
      )}
      {canView && request.lastError && (
        <Alert variant="destructive">
          <p>{request.lastError.message}</p>
          {request.lastError.code === 'CUSTOMER_SYNC_REQUIRED' && (
            <p>Corrige los datos fiscales del receptor en emite-facil.</p>
          )}
          {request.lastError.code === 'SIGNATURE_FAILED' && (
            <p>Corrige la firma y reintenta el mismo documento en emite-facil.</p>
          )}
          {request.lastError.attempts?.map((attempt) => (
            <div key={attempt.id} className="mt-2">
              {attempt.sriStatus && (
                <p>
                  {attempt.operation === 'RECEPTION' ? 'Recepción' : 'Autorización'}:{' '}
                  {attempt.sriStatus}
                </p>
              )}
              {attempt.messages.map((message, index) => (
                <p key={index}>
                  {[message.identifier, message.message, message.additionalInfo, message.type]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              ))}
            </div>
          ))}
        </Alert>
      )}
      {canView && (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!request.artifacts.xml || downloading}
            onClick={() => void download('xml')}
          >
            Descargar XML
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!request.artifacts.ride || downloading}
            onClick={() => void download('ride')}
          >
            Descargar RIDE
          </Button>
          {request.status === 'AUTHORIZED' &&
            (!request.artifacts.xml || !request.artifacts.ride) && (
              <p className="w-full text-muted-foreground">
                Preparando documentos. Se actualizarán automáticamente.
              </p>
            )}
        </div>
      )}
      {error && <Alert variant="destructive">{error}</Alert>}
    </div>
  );
}
