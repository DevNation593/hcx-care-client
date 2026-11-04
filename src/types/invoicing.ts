export type InvoiceStatus = 'REQUESTED' | 'PROCESSING' | 'AUTHORIZED' | 'REJECTED' | 'FAILED';
export type InvoicingEnvironment = '1' | '2';
export type RimpeRegime = 'NONE' | 'EMPRENDEDOR' | 'NEGOCIO_POPULAR';
export interface IssuerCertificate {
  subject: string;
  serial: string;
  validTo: string;
  sha256: string;
  rucVerified: boolean;
}
export interface EmissionPoint {
  branchId: string;
  establishmentCode: string;
  emissionPointCode: string;
  establishmentAddress: string;
  nextSequential: number;
}
export interface InvoicingIssuer {
  id: string;
  ruc: string;
  legalName: string;
  tradeName: string | null;
  headOfficeAddress: string;
  accountingRequired: boolean;
  specialTaxpayerCode: string | null;
  withholdingAgentCode: string | null;
  rimpeRegime: RimpeRegime;
  environment: InvoicingEnvironment;
  active: boolean;
  revision: number;
  certificate: IssuerCertificate | null;
  points: EmissionPoint[];
}
export interface SaveIssuerInput {
  ruc: string;
  legalName: string;
  tradeName?: string | null;
  headOfficeAddress: string;
  accountingRequired: boolean;
  specialTaxpayerCode?: string | null;
  withholdingAgentCode?: string | null;
  rimpeRegime: RimpeRegime;
  environment: InvoicingEnvironment;
  active?: boolean;
  revision?: number;
}
export interface SaveEmissionPointInput {
  establishmentCode: string;
  emissionPointCode: string;
  establishmentAddress: string;
  nextSequential?: number;
}
export interface IssuerTest {
  certificateValid: boolean;
  certificateError: string | null;
  rucVerified: boolean;
  sriReachable: boolean;
}
export interface SriMessage {
  identifier: string | null;
  message: string | null;
  additionalInfo: string | null;
  type: string | null;
}
export interface InvoiceEvent {
  id: string;
  type: string;
  source: string;
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
  replacesInvoiceRequestId: string | null;
  externalState: string | null;
  number: string | null;
  sequential: number | null;
  accessKey: string | null;
  authorizationNumber: string | null;
  authorizedAt: string | null;
  artifacts: { xml: boolean; ride: boolean };
  emailedAt: string | null;
  attempts: number;
  lastError: null | { code: string; message: string; messages?: SriMessage[] };
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
