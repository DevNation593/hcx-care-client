'use client';
import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { isMasterRole } from '@/types/guards';
import type { ApiError } from '@/types';
import type { InvoiceFilters, InvoiceReceipt, InvoiceRequest } from '@/types/invoicing';
import { invoicingApi } from '@/lib/api/invoicing-api';
import { QUERY_KEYS } from '@/lib/constants';
import { useMyPermissions } from './usePermissions';
import { requireTenantId, useTenantId } from './useTenantScope';

export const invoicingKeys = {
  all: (tenantId: string | null) => ['tenant', tenantId, 'invoicing'] as const,
  connection: (tenantId: string | null) => [...invoicingKeys.all(tenantId), 'connection'] as const,
  options: (tenantId: string | null) => [...invoicingKeys.all(tenantId), 'options'] as const,
};
export function useInvoicingPermissions() {
  const user = useAuthStore((state) => state.user);
  const master = !!user && isMasterRole(user.role);
  const { can } = useMyPermissions();
  return { master, view: can('billing.view', master), create: can('billing.create', master) };
}
export function invoiceNeedsPolling(request?: InvoiceRequest) {
  return (
    !request ||
    request.status === 'REQUESTED' ||
    request.status === 'PROCESSING' ||
    request.requiresReconciliation ||
    (request.status === 'AUTHORIZED' && (!request.artifacts.xml || !request.artifacts.ride))
  );
}
function refreshInvoiceOrder(client: QueryClient, orderId?: string) {
  if (orderId) {
    void client.invalidateQueries({ queryKey: QUERY_KEYS.ORDER(orderId) });
    void client.invalidateQueries({ queryKey: QUERY_KEYS.ORDER_ELIGIBILITY(orderId) });
  }
  void client.invalidateQueries({ queryKey: QUERY_KEYS.ORDERS });
  void client.invalidateQueries({ queryKey: QUERY_KEYS.BILLABLE_SESSIONS });
  void client.invalidateQueries({ queryKey: QUERY_KEYS.TREATMENT_SESSIONS });
  void client.invalidateQueries({ queryKey: ['patients'] });
}
function refreshInvoicing(client: QueryClient, tenantId: string | null, orderId: string) {
  void client.invalidateQueries({ queryKey: invoicingKeys.all(tenantId) });
  refreshInvoiceOrder(client, orderId);
}
export function useInvoiceRequests(filters: InvoiceFilters, enabled = true) {
  const tenantId = useTenantId();
  const { view } = useInvoicingPermissions();
  return useQuery({
    queryKey: [...invoicingKeys.all(tenantId), 'list', filters],
    queryFn: () => invoicingApi.list(requireTenantId(tenantId), filters),
    enabled: !!tenantId && view && enabled,
    refetchInterval: (query) =>
      !query.state.data || query.state.data.items.some(invoiceNeedsPolling) ? 5000 : false,
  });
}
export function useInvoiceRequest(id?: string) {
  const tenantId = useTenantId();
  const client = useQueryClient();
  const { view } = useInvoicingPermissions();
  const query = useQuery({
    queryKey: [...invoicingKeys.all(tenantId), 'detail', id],
    queryFn: () => invoicingApi.detail(requireTenantId(tenantId), id!),
    enabled: !!tenantId && view && !!id,
    refetchInterval: (query) => (invoiceNeedsPolling(query.state.data) ? 5000 : false),
  });
  const status = query.data?.status;
  const uncertain = query.data?.requiresReconciliation;
  const orderId = query.data?.orderId;
  useEffect(() => {
    if (
      view &&
      orderId &&
      !uncertain &&
      (status === 'AUTHORIZED' || status === 'REJECTED' || status === 'FAILED')
    ) {
      refreshInvoiceOrder(client, orderId);
    }
  }, [client, id, view, status, uncertain, orderId]);
  return query;
}
export function useRequestInvoice(orderId: string) {
  const client = useQueryClient();
  const tenantId = useTenantId();
  return useMutation<InvoiceReceipt, ApiError, string>({
    mutationFn: (key) => invoicingApi.request(requireTenantId(tenantId), orderId, key),
    // Background refresh cannot turn a durable receipt into a failed mutation.
    onSuccess: () => {
      refreshInvoicing(client, tenantId, orderId);
    },
    onError: () => {
      refreshInvoicing(client, tenantId, orderId);
    },
  });
}
