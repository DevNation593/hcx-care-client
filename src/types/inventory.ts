// Mirrors the API JSON of the product catalog and its lot-based stock.
// Dates are ISO strings; money fields are strings with 2 decimals, shown as they come.

export type StockAdjustmentReason = 'COUNT' | 'DAMAGE' | 'EXPIRED' | 'INTERNAL_USE' | 'OTHER';

export type StockMovementKind =
  | 'RECEIPT'
  | 'SALE'
  | 'SALE_RELEASE'
  | 'ADJUSTMENT'
  | 'TRANSFER_OUT'
  | 'TRANSFER_IN';

export type InventoryReportKind = 'valuation' | 'expiring' | 'low-stock' | 'margin';

interface PersonName {
  id: string;
  firstName: string;
  lastName: string;
}

interface ProductRef {
  id: string;
  code: string;
  name: string;
}

interface BranchRef {
  id: string;
  name: string;
}

// ==========================================
// PRODUCTS
// ==========================================

/** What the cash register sees: never the cost. */
export interface ProductForSale {
  id: string;
  code: string;
  name: string;
  barcode: string | null;
  price: string;
  taxRatePercent: number;
  available: number;
}

export interface ProductBranchStock {
  branchId: string;
  branchName: string;
  available: number;
  belowMin: boolean;
}

export interface ProductSummary {
  id: string;
  code: string;
  name: string;
  category: string | null;
  barcode: string | null;
  price: string;
  taxRatePercent: number;
  tracksExpiry: boolean;
  minStock: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  stock: ProductBranchStock[];
}

export interface StockLotView {
  id: string;
  branchId: string;
  lotNumber: string | null;
  expiresAt: string | null;
  unitCost: string;
  quantityReceived: number;
  quantityOnHand: number;
  receivedAt: string;
  expired: boolean;
}

export interface ProductDetail extends ProductSummary {
  lots: StockLotView[];
}

export interface CreateProductInput {
  code: string;
  name: string;
  category?: string;
  barcode?: string;
  price: string;
  /** 0, 5 or 15. */
  taxRatePercent: number;
  tracksExpiry: boolean;
  minStock?: number;
}

export type UpdateProductInput = Partial<CreateProductInput>;

export interface ProductFilters {
  search?: string;
  active?: boolean;
  page?: number;
  pageSize?: number;
}

// ==========================================
// RECEIPTS
// ==========================================

export interface StockReceiptLine {
  lotId: string;
  product: ProductRef;
  quantity: number;
  unitCost: string;
  lotNumber: string | null;
  expiresAt: string | null;
}

export interface StockReceipt {
  id: string;
  branch: BranchRef;
  supplierName: string | null;
  documentNumber: string | null;
  receivedAt: string;
  note: string | null;
  createdBy: PersonName;
  lines: StockReceiptLine[];
}

export interface CreateStockReceiptLineInput {
  productId: string;
  quantity: number;
  unitCost: string;
  lotNumber?: string;
  /** YYYY-MM-DD; required when the product tracks expiry. */
  expiresAt?: string;
}

export interface CreateStockReceiptInput {
  branchId: string;
  supplierName?: string;
  documentNumber?: string;
  receivedAt?: string;
  note?: string;
  lines: CreateStockReceiptLineInput[];
}

export interface StockReceiptFilters {
  branchId?: string;
  page?: number;
  pageSize?: number;
}

// ==========================================
// ADJUSTMENTS
// ==========================================

/** Exactly one of `delta` or `countedQuantity`. */
export interface CreateStockAdjustmentInput {
  delta?: number;
  countedQuantity?: number;
  reason: StockAdjustmentReason;
  /** Required with reason OTHER. */
  note?: string;
}

// ==========================================
// TRANSFERS
// ==========================================

export interface StockTransferLine {
  sourceLotId: string | null;
  lotId: string;
  product: ProductRef;
  quantity: number;
  unitCost: string;
  lotNumber: string | null;
  expiresAt: string | null;
}

export interface StockTransfer {
  id: string;
  fromBranch: BranchRef;
  toBranch: BranchRef;
  note: string | null;
  createdAt: string;
  createdBy: PersonName;
  lines: StockTransferLine[];
}

export interface CreateStockTransferInput {
  fromBranchId: string;
  toBranchId: string;
  note?: string;
  lines: { lotId: string; quantity: number }[];
}

export interface StockTransferFilters {
  branchId?: string;
  page?: number;
  pageSize?: number;
}

// ==========================================
// MOVEMENTS
// ==========================================

export interface StockMovement {
  id: string;
  kind: StockMovementKind;
  product: ProductRef;
  branch: BranchRef;
  lotId: string;
  lotNumber: string | null;
  /** Signed units. */
  quantity: number;
  unitCost: string;
  adjustmentReason: StockAdjustmentReason | null;
  note: string | null;
  receiptId: string | null;
  transferId: string | null;
  orderItemId: string | null;
  createdBy: PersonName;
  createdAt: string;
}

export interface StockMovementFilters {
  productId?: string;
  branchId?: string;
  kind?: StockMovementKind;
  /** ISO date-time, inclusive. */
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

// ==========================================
// REPORTS
// ==========================================

export interface ValuationReport {
  branches: {
    branchId: string;
    branchName: string;
    units: number;
    value: string;
    products: { productId: string; code: string; name: string; units: number; value: string }[];
  }[];
  totalValue: string;
}

export interface ExpiringLot {
  lotId: string;
  product: ProductRef;
  branch: BranchRef;
  lotNumber: string | null;
  expiresAt: string;
  quantityOnHand: number;
  value: string;
}

export interface ExpiringReport {
  expired: ExpiringLot[];
  expiring: ExpiringLot[];
}

export interface LowStockRow {
  productId: string;
  code: string;
  name: string;
  branchId: string;
  branchName: string;
  available: number;
  minStock: number;
}

export interface MarginReport {
  revenue: string;
  cost: string;
  margin: string;
  products: {
    productId: string;
    code: string;
    name: string;
    units: number;
    revenue: string;
    cost: string;
    margin: string;
  }[];
}

export interface InventoryReportParams {
  branchId?: string;
  /** Expiring report window: 30, 60 or 90 days. */
  days?: 30 | 60 | 90;
  /** Margin report period, YYYY-MM-DD, both inclusive. */
  from?: string;
  to?: string;
}

export interface InventoryReportMap {
  valuation: ValuationReport;
  expiring: ExpiringReport;
  'low-stock': LowStockRow[];
  margin: MarginReport;
}
