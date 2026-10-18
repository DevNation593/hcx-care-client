import { apiClient } from './client';
import type {
  ConnectionTest,
  EmissionPoint,
  InvoiceFilters,
  InvoicePage,
  InvoiceReceipt,
  InvoiceRequest,
  InvoicingConnection,
  InvoicingOptions,
  SaveConnectionInput,
} from '@/types/invoicing';
const root = (tenantId: string) => `/tenants/${tenantId}`;
export const invoicingApi = {
  connection: (tenantId: string) =>
    apiClient.get<InvoicingConnection | null>(`${root(tenantId)}/invoicing/connection`),
  test: (tenantId: string, apiKey?: string) =>
    apiClient.post<ConnectionTest>(`${root(tenantId)}/invoicing/test`, apiKey ? { apiKey } : {}),
  options: (tenantId: string) =>
    apiClient.get<InvoicingOptions>(`${root(tenantId)}/invoicing/options`),
  save: (tenantId: string, input: SaveConnectionInput) =>
    apiClient.put<InvoicingConnection>(`${root(tenantId)}/invoicing/connection`, input),
  savePoint: (
    tenantId: string,
    branchId: string,
    input: { establishmentId: string; emissionPointId: string },
  ) => apiClient.put<EmissionPoint>(`${root(tenantId)}/branches/${branchId}/emission-point`, input),
  request: (tenantId: string, orderId: string, idempotencyKey: string) =>
    apiClient.post<InvoiceReceipt>(
      `${root(tenantId)}/orders/${orderId}/invoice-requests`,
      undefined,
      { headers: { 'Idempotency-Key': idempotencyKey } },
    ),
  list: (tenantId: string, filters: InvoiceFilters) =>
    apiClient.get<InvoicePage>(`${root(tenantId)}/invoice-requests`, { params: filters }),
  detail: (tenantId: string, id: string) =>
    apiClient.get<InvoiceRequest>(`${root(tenantId)}/invoice-requests/${id}`),
  download: async (tenantId: string, request: InvoiceRequest, kind: 'xml' | 'ride') => {
    const blob = await apiClient.get<Blob>(
      `${root(tenantId)}/invoice-requests/${request.id}/${kind}`,
      { responseType: 'blob' },
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    try {
      anchor.href = url;
      anchor.download = `${request.number || request.id}.${kind === 'ride' ? 'pdf' : 'xml'}`;
      document.body.appendChild(anchor);
      anchor.click();
    } finally {
      anchor.remove();
      URL.revokeObjectURL(url);
    }
  },
};
