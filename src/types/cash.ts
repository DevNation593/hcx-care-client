import type { TreatmentSessionStatus } from './treatments';

// Mirrors the API JSON of the cash desk: billing profiles, cash registers, orders and payments.
// Dates are ISO strings; money fields are strings with 2 decimals, shown as they come.

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// ==========================================
// BILLING PROFILES
// ==========================================

export type BillingProfileKind = 'PERSON' | 'COMPANY';
/** SRI identification code: 04 RUC, 05 cédula, 06 passport, 07 final consumer. */
export type SriIdType = '04' | '05' | '06' | '07';

export const SRI_ID_TYPE_LABELS: Record<SriIdType, string> = {
  '04': 'RUC',
  '05': 'Cédula',
  '06': 'Pasaporte',
  '07': 'Consumidor final',
};

export interface BillingProfile {
  id: string;
  tenantId: string;
  kind: BillingProfileKind;
  idType: SriIdType;
  idNumber: string;
  legalName: string;
  email: string | null;
  address: string | null;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** A profile linked to a patient. */
export interface LinkedBillingProfile extends BillingProfile {
  isDefault: boolean;
}

export interface BillingProfileInput {
  kind: BillingProfileKind;
  idType: SriIdType;
  idNumber: string;
  legalName: string;
  /** Required unless `idType` is 07. */
  email?: string;
  address?: string;
  phone?: string;
}

/** `idType` and `idNumber` never change; `null` clears an optional field. */
export interface BillingProfileUpdate {
  legalName?: string;
  email?: string | null;
  address?: string | null;
  phone?: string | null;
  isActive?: boolean;
}

export interface BillingProfileFilters {
  q?: string;
  active?: boolean;
  page?: number;
  pageSize?: number;
}

export interface LinkBillingProfileInput {
  billingProfileId: string;
  isDefault?: boolean;
}

// ==========================================
// CASH REGISTERS
// ==========================================

export type PaymentMethod = 'CASH' | 'DEBIT_CARD' | 'CREDIT_CARD' | 'TRANSFER' | 'OTHER';

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Efectivo',
  DEBIT_CARD: 'Tarjeta de débito',
  CREDIT_CARD: 'Tarjeta de crédito',
  TRANSFER: 'Transferencia',
  OTHER: 'Otro',
};

export type CashRegisterStatus = 'OPEN' | 'CLOSED';

export interface CashRegister {
  id: string;
  tenantId: string;
  branchId: string;
  status: CashRegisterStatus;
  openedById: string;
  openedAt: string;
  openingCash: string;
  closedById: string | null;
  closedAt: string | null;
  /** Count taken when closing; null while the register is open. */
  expectedCash: string | null;
  countedCash: string | null;
  difference: string | null;
  closingNote: string | null;
}

/** The cash count: expected cash and what was received and refunded by method. */
export interface CashCount {
  expectedCash: string;
  byMethod: Record<PaymentMethod, { received: string; refunded: string }>;
}

export interface CashRegisterDetail extends CashRegister {
  summary: CashCount;
}

export interface CashRegisterFilters {
  branchId?: string;
  status?: CashRegisterStatus;
  page?: number;
  pageSize?: number;
}

export interface OpenCashRegisterInput {
  branchId: string;
  openingCash: string;
}

export interface CloseCashRegisterInput {
  countedCash: string;
  /** Required when the count differs from the expected cash. */
  closingNote?: string;
}

// ==========================================
// ORDERS AND PAYMENTS
// ==========================================

export type OrderStatus = 'OPEN' | 'PAID' | 'INVOICED' | 'CANCELLED';
export type OrderItemKind = 'TREATMENT_SESSION' | 'FREE' | 'PRODUCT';
export type PaymentStatus = 'RECORDED' | 'REFUNDED';

interface PersonName {
  id: string;
  firstName: string;
  lastName: string;
}

export interface OrderItem {
  id: string;
  kind: OrderItemKind;
  treatmentSessionId: string | null;
  productId: string | null;
  patient: PersonName | null;
  description: string;
  quantity: string;
  unitPrice: string;
  discount: string;
  taxRatePercent: string;
  lineSubtotal: string;
  lineTax: string;
}

export interface Payment {
  id: string;
  method: PaymentMethod;
  amount: string;
  reference: string | null;
  status: PaymentStatus;
  receivedAt: string;
  receivedBy: PersonName;
  refundedAt: string | null;
  refundReason: string | null;
}

export interface Order {
  id: string;
  number: number;
  status: OrderStatus;
  branchId: string;
  /** Sent with every edit; a stale one answers 409 ORDER_VERSION_CONFLICT. */
  version: number;
  billingProfile: {
    id: string;
    kind: BillingProfileKind;
    idType: SriIdType;
    idNumber: string;
    legalName: string;
    email: string | null;
  } | null;
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  total: string;
  paidTotal: string;
  balance: string;
  items: OrderItem[];
  payments: Payment[];
  createdAt: string;
}

export interface OrderFilters {
  status?: OrderStatus;
  branchId?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}

export interface CreateOrderInput {
  branchId?: string;
  treatmentSessionIds?: string[];
  billingProfileId?: string;
}

export interface AddOrderItemInput {
  version: number;
  kind: OrderItemKind;
  /** TREATMENT_SESSION only. */
  treatmentSessionId?: string;
  /** PRODUCT only; `quantity` is the units sold. */
  productId?: string;
  /** FREE only. */
  description?: string;
  quantity?: string;
  unitPrice?: string;
  /** FREE only: 0, 5 or 15. */
  taxRatePercent?: number;
  patientId?: string;
  discount?: string;
}

export interface UpdateOrderItemInput {
  version: number;
  discount: string;
}

export interface SetOrderBillingProfileInput {
  version: number;
  billingProfileId: string;
}

export interface CancelOrderInput {
  version: number;
  reason: string;
}

export interface RecordPaymentInput {
  method: PaymentMethod;
  amount: string;
  reference?: string;
}

export interface RefundPaymentInput {
  reason: string;
}

// ==========================================
// BILLABLE SESSIONS AND ELIGIBILITY
// ==========================================

/** A session the cash desk may still add to an order; it carries no clinical content. */
export interface BillableSession {
  id: string;
  status: TreatmentSessionStatus;
  createdAt: string;
  completedAt: string | null;
  branchId: string | null;
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    identificationNumber: string | null;
  };
  treatment: { id: string; name: string; version: number };
  price: string;
  taxRatePercent: string;
  /** Whether the clinical documentation is complete, without detail. */
  compliant: boolean;
}

export interface BillableSessionFilters {
  branchId?: string;
  patientId?: string;
}

export type ClinicalBillingCode =
  | 'FINALIZED_MEDICAL_FORM'
  | 'SIGNED_APPLICABLE_CONSENT'
  | 'CLINICAL_COMPLETION'
  | 'SESSION_NOT_BILLABLE';

export type CashBillingCode =
  | 'BILLING_PROFILE'
  | 'INVOICE_ITEMS'
  | 'BALANCE_DUE'
  | 'INVOICING_NOT_CONFIGURED';

export type BillingCode = ClinicalBillingCode | CashBillingCode;

/** What still stands between an order and its invoice. */
export interface BillingEligibility {
  eligible: boolean;
  missing: BillingCode[];
  items: { itemId: string; patientName: string; codes: ClinicalBillingCode[] }[];
}
