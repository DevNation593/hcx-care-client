'use client';

import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ordersApi } from '@/lib/api/endpoints';
import { QUERY_KEYS } from '@/lib/constants';
import type { ApiError } from '@/types';
import type {
  AddOrderItemInput,
  BillableSessionFilters,
  CancelOrderInput,
  CreateOrderInput,
  Order,
  OrderFilters,
  RecordPaymentInput,
  RefundPaymentInput,
  SetOrderBillingProfileInput,
  UpdateOrderItemInput,
} from '@/types/cash';

export function useOrders(filters?: OrderFilters) {
  return useQuery({
    queryKey: [...QUERY_KEYS.ORDERS, 'list', filters ?? null],
    queryFn: () => ordersApi.list(filters),
  });
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: QUERY_KEYS.ORDER(id),
    queryFn: () => ordersApi.get(id),
    enabled: Boolean(id),
  });
}

export function useOrderEligibility(id: string) {
  return useQuery({
    queryKey: QUERY_KEYS.ORDER_ELIGIBILITY(id),
    queryFn: () => ordersApi.eligibility(id),
    enabled: Boolean(id),
  });
}

export function useBillableSessions(filters?: BillableSessionFilters) {
  return useQuery({
    queryKey: [...QUERY_KEYS.BILLABLE_SESSIONS, filters ?? null],
    queryFn: () => ordersApi.billableSessions(filters),
  });
}

/** Taking or returning units moves what the order picker and /inventory show as available. */
function refreshStock(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PRODUCTS });
  queryClient.invalidateQueries({ queryKey: QUERY_KEYS.INVENTORY_REPORTS });
  queryClient.invalidateQueries({ queryKey: QUERY_KEYS.STOCK_MOVEMENTS });
}

function refreshOrder(queryClient: QueryClient, orderId: string) {
  queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ORDER(orderId) });
  queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ORDER_ELIGIBILITY(orderId) });
  queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ORDERS });
  queryClient.invalidateQueries({ queryKey: QUERY_KEYS.BILLABLE_SESSIONS });
  refreshStock(queryClient);
}

/** An order mutation: refreshes what the order feeds, and re-reads it on a stale version. */
function useOrderMutation<TInput>(
  orderId: string,
  mutationFn: (input: TInput) => Promise<unknown>,
  success: string,
  { cash = false }: { cash?: boolean } = {},
) {
  const queryClient = useQueryClient();
  return useMutation<unknown, ApiError, TInput>({
    mutationFn,
    onSuccess: () => {
      refreshOrder(queryClient, orderId);
      // A payment or a refund moves the cash count of the register.
      if (cash) queryClient.invalidateQueries({ queryKey: QUERY_KEYS.CASH_REGISTERS });
      toast.success(success);
    },
    onError: (error) => {
      // Someone else edited the order: read it again so the next attempt has the new version.
      // A payment that failed (a lost response, a closed order) may still have landed: re-read the order
      // and the lists so the balance reflects the server.
      if (error.code === 'ORDER_VERSION_CONFLICT' || cash) {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ORDER(orderId) });
      }
      if (cash) queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ORDERS });
      // The shown availability was stale: read the real one again.
      if (error.code === 'INSUFFICIENT_STOCK') refreshStock(queryClient);
      toast.error(error.message);
    },
  });
}

/** Creates an order; the new order is not known yet, so only the lists refresh. */
export function useCreateOrder() {
  const queryClient = useQueryClient();
  return useMutation<Order, ApiError, CreateOrderInput>({
    mutationFn: (data) => ordersApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ORDERS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.BILLABLE_SESSIONS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.BILLING_PROFILES });
      toast.success('Orden creada');
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
}

export function useAddOrderItem(id: string) {
  return useOrderMutation(id, (data: AddOrderItemInput) => ordersApi.addItem(id, data), 'Ítem agregado');
}

export function useRemoveOrderItem(id: string) {
  return useOrderMutation(
    id,
    ({ itemId, version }: { itemId: string; version: number }) =>
      ordersApi.removeItem(id, itemId, version),
    'Ítem quitado',
  );
}

export function useUpdateOrderItem(id: string) {
  return useOrderMutation(
    id,
    ({ itemId, data }: { itemId: string; data: UpdateOrderItemInput }) =>
      ordersApi.updateItem(id, itemId, data),
    'Descuento actualizado',
  );
}

export function useSetOrderBillingProfile(id: string) {
  return useOrderMutation(
    id,
    (data: SetOrderBillingProfileInput) => ordersApi.setBillingProfile(id, data),
    'Datos de facturación actualizados',
  );
}

export function useCancelOrder(id: string) {
  return useOrderMutation(id, (data: CancelOrderInput) => ordersApi.cancel(id, data), 'Orden cancelada');
}

/**
 * Records a payment. The component owns the idempotency key: it generates one
 * (`crypto.randomUUID()`) per open form and sends the same one again when the request is
 * retried after a network error, so a lost response never records the payment twice.
 */
export function useRecordPayment(id: string) {
  return useOrderMutation(
    id,
    ({ data, idempotencyKey }: { data: RecordPaymentInput; idempotencyKey: string }) =>
      ordersApi.recordPayment(id, data, idempotencyKey),
    'Pago registrado',
    { cash: true },
  );
}

export function useRefundPayment(orderId: string) {
  return useOrderMutation(
    orderId,
    ({ paymentId, data }: { paymentId: string; data: RefundPaymentInput }) =>
      ordersApi.refundPayment(paymentId, data),
    'Pago reembolsado',
    { cash: true },
  );
}
