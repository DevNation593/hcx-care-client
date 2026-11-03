import { apiClient } from './client';
import type {
  EmissionPoint,
  InvoiceFilters,
  InvoicePage,
  InvoiceReceipt,
  InvoiceRequest,
  InvoicingIssuer,
  IssuerTest,
  SaveEmissionPointInput,
  SaveIssuerInput,
} from '@/types/invoicing';
const root = (tenantId: string) => `/tenants/${tenantId}`;
export const invoicingApi = {
  issuer: (tenantId: string) =>
    apiClient.get<InvoicingIssuer | null>(`${root(tenantId)}/invoicing/issuer`),
  saveIssuer: (tenantId: string, input: SaveIssuerInput) =>
    apiClient.put<InvoicingIssuer>(`${root(tenantId)}/invoicing/issuer`, input),
  uploadCertificate: (tenantId: string, file: File, password: string) => {
    const body = new FormData();
    body.append('file', file);
    body.append('password', password);
    return apiClient.put<InvoicingIssuer>(`${root(tenantId)}/invoicing/issuer/certificate`, body, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  test: (tenantId: string) => apiClient.post<IssuerTest>(`${root(tenantId)}/invoicing/test`),
  savePoint: (tenantId: string, branchId: string, input: SaveEmissionPointInput) =>
    apiClient.put<EmissionPoint>(`${root(tenantId)}/branches/${branchId}/emission-point`, input),
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
