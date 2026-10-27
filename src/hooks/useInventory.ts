'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { inventoryApi, productsApi } from '@/lib/api/endpoints';
import { QUERY_KEYS } from '@/lib/constants';
import type { ApiError } from '@/types';
import type {
  CreateProductInput,
  CreateStockAdjustmentInput,
  CreateStockReceiptInput,
  CreateStockTransferInput,
  InventoryReportKind,
  InventoryReportParams,
  ProductFilters,
  StockReceiptFilters,
  StockTransferFilters,
  UpdateProductInput,
} from '@/types/inventory';

/**
 * Products for the cash register: needs a branch (its stock) and something typed, or an exact
 * barcode.
 */
export function useProductsForSale(branchId: string | undefined, search: string, barcode?: string) {
  const term = search.trim();
  const code = barcode?.trim() ?? '';
  return useQuery({
    queryKey: [...QUERY_KEYS.PRODUCTS, 'for-sale', branchId ?? null, term, code],
    queryFn: () => productsApi.forSale(branchId as string, term, code || undefined),
    enabled: Boolean(branchId) && (term.length > 0 || code.length > 0),
  });
}

export function useProducts(query?: ProductFilters) {
  return useQuery({
    queryKey: [...QUERY_KEYS.PRODUCTS, 'list', query ?? null],
    queryFn: () => productsApi.list(query),
  });
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: QUERY_KEYS.PRODUCT(id),
    queryFn: () => productsApi.get(id),
    enabled: Boolean(id),
  });
}

export function useStockReceipts(query?: StockReceiptFilters) {
  return useQuery({
    queryKey: [...QUERY_KEYS.STOCK_RECEIPTS, 'list', query ?? null],
    queryFn: () => inventoryApi.receipts(query),
  });
}

export function useStockTransfers(query?: StockTransferFilters) {
  return useQuery({
    queryKey: [...QUERY_KEYS.STOCK_TRANSFERS, 'list', query ?? null],
    queryFn: () => inventoryApi.transfers(query),
  });
}

export function useInventoryReport<K extends InventoryReportKind>(
  kind: K,
  params?: InventoryReportParams,
) {
  return useQuery({
    queryKey: [...QUERY_KEYS.INVENTORY_REPORTS, kind, params ?? null],
    queryFn: () => inventoryApi.report(kind, params),
  });
}

/**
 * A stock mutation: refreshes the catalog (stock per branch, lots), the reports and the movement
 * ledger, plus the lists it feeds. There is no generic error toast; the form shows the `message`
 * the API sends.
 */
function useInventoryMutation<TInput, TResult>(
  mutationFn: (input: TInput) => Promise<TResult>,
  success: string,
  also: readonly (readonly string[])[] = [],
) {
  const queryClient = useQueryClient();
  return useMutation<TResult, ApiError, TInput>({
    mutationFn,
    onSuccess: () => {
      for (const queryKey of [
        QUERY_KEYS.PRODUCTS,
        QUERY_KEYS.INVENTORY_REPORTS,
        QUERY_KEYS.STOCK_MOVEMENTS,
        ...also,
      ]) {
        queryClient.invalidateQueries({ queryKey });
      }
      toast.success(success);
    },
  });
}

export function useCreateProduct() {
  return useInventoryMutation(
    (data: CreateProductInput) => productsApi.create(data),
    'Producto creado',
  );
}

export function useUpdateProduct(id: string) {
  return useInventoryMutation(
    (data: UpdateProductInput) => productsApi.update(id, data),
    'Producto actualizado',
  );
}

export function useSetProductActive(id: string) {
  return useInventoryMutation(
    (isActive: boolean) => productsApi.setActive(id, isActive),
    'Producto actualizado',
  );
}

export function useCreateStockReceipt() {
  return useInventoryMutation(
    (data: CreateStockReceiptInput) => inventoryApi.createReceipt(data),
    'Ingreso registrado',
    [QUERY_KEYS.STOCK_RECEIPTS],
  );
}

export function useAdjustLot(productId: string) {
  return useInventoryMutation(
    ({ lotId, data }: { lotId: string; data: CreateStockAdjustmentInput }) =>
      inventoryApi.adjustLot(lotId, data),
    'Ajuste registrado',
    [QUERY_KEYS.PRODUCT(productId)],
  );
}

export function useCreateStockTransfer() {
  return useInventoryMutation(
    (data: CreateStockTransferInput) => inventoryApi.createTransfer(data),
    'Transferencia registrada',
    [QUERY_KEYS.STOCK_TRANSFERS],
  );
}
