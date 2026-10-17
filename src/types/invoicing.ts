export type InvoiceStatus = 'REQUESTED' | 'PROCESSING' | 'AUTHORIZED' | 'REJECTED' | 'FAILED';
export type InvoicingEnvironment = '1' | '2';
export interface EmissionPoint {
  branchId: string;
  establishmentId: string;
  emissionPointId: string;
  establishmentCode: string;
  emissionPointCode: string;
}
export interface InvoicingConnection {
  id: string;
  active: boolean;
  externalTenantId: string;
  taxpayerId: string;
  taxpayerName: string;
  taxpayerRuc: string;
  environment: InvoicingEnvironment;
  hasApiKey: true;
  hasWebhookSecret: boolean;
  revision: number;
  validatedAt: string;
  webhookUrl: string | null;
  points: EmissionPoint[];
}
export interface ProviderTenant {
  id: string;
  name: string;
  status: 'ACTIVE' | 'SUSPENDED';
  role: 'OWNER' | 'ADMIN' | 'BILLER' | 'AUDITOR';
}
export interface Taxpayer {
  id: string;
  ruc: string;
  legalName: string;
  tradeName: string | null;
  headOfficeAddress: string;
  defaultEnvironment: InvoicingEnvironment;
  accountingRequired: boolean;
  specialTaxpayerCode: string | null;
  withholdingAgentCode: string | null;
  rimpeRegime: 'NONE' | 'EMPRENDEDOR' | 'NEGOCIO_POPULAR';
  productionEnabledAt: string | null;
}
export interface Establishment {
  id: string;
  taxpayerId: string;
  code: string;
  address: string;
  emissionPoints: { id: string; establishmentId: string; code: string; enabled: boolean }[];
}
export interface InvoicingOptions {
  tenant: ProviderTenant;
  taxpayers: (Taxpayer & { establishments: Establishment[] })[];
}
export interface ConnectionTest {
  tenant: ProviderTenant;
  taxpayers: Taxpayer[];
}
export interface SaveConnectionInput {
  taxpayerId: string;
  apiKey?: string;
  active?: boolean;
  webhookSecret?: string;
}
export interface SriAttempt {
  id: string;
  operation: 'RECEPTION' | 'AUTHORIZATION';
  outcome: string | null;
  sriStatus: string | null;
  httpStatus: number | null;
  startedAt: string;
  completedAt: string | null;
  messages: {
    identifier: string | null;
    message: string | null;
    additionalInfo: string | null;
    type: string | null;
  }[];
}
export interface InvoiceEvent {
  id: string;
  type: string;
  source: 'API' | 'DISPATCHER' | 'RECONCILER' | 'WEBHOOK';
  detail: Record<string, unknown>;
  createdAt: string;
}
export interface InvoiceRequest {
  id: string;
  orderId: string;
  orderNumber: number | null;
  branchId: string | null;
  billingProfileId: string;
  status: InvoiceStatus;
  requiresReconciliation: boolean;
  replacesInvoiceRequestId: string | null;
  externalDocumentId: string | null;
  externalState: string | null;
  number: string | null;
  accessKey: string | null;
  authorizationNumber: string | null;
  authorizedAt: string | null;
  artifacts: { xml: boolean; ride: boolean };
  attempts: number;
  lastError: null | { code: string; message: string; attempts?: SriAttempt[] };
  requestedAt: string;
  finishedAt: string | null;
  events?: InvoiceEvent[];
}
/** Durable acceptance only; protected SRI explanations are read through GET. */
export type InvoiceReceipt = Omit<InvoiceRequest, 'lastError'> & { lastError: null };
export interface InvoiceFilters {
  status?: InvoiceStatus;
  branchId?: string;
  orderId?: string;
  patientId?: string;
  page?: number;
  pageSize?: number;
}
export interface InvoicePage {
  items: InvoiceRequest[];
  total: number;
  page: number;
  pageSize: number;
}
export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  REQUESTED: 'Solicitada',
  PROCESSING: 'En proceso',
  AUTHORIZED: 'Autorizada',
  REJECTED: 'Rechazada',
  FAILED: 'Fallida',
};
