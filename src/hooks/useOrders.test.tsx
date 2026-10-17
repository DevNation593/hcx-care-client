import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/store/authStore';
import { QUERY_KEYS } from '@/lib/constants';
import { useCancelOrder, useRecordPayment, useRefundPayment } from './useOrders';

const http = vi.hoisted(() => ({
  get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn(), upload: vi.fn(),
}));
vi.mock('@/lib/api/client', () => ({ apiClient: http }));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  // Seed every key an order mutation may refresh so invalidation can be observed.
  client.setQueryData(QUERY_KEYS.ORDER('order-1'), { id: 'order-1' });
  client.setQueryData(QUERY_KEYS.ORDER_ELIGIBILITY('order-1'), { eligible: false });
  client.setQueryData([...QUERY_KEYS.ORDERS, 'list', null], { items: [] });
  client.setQueryData([...QUERY_KEYS.BILLABLE_SESSIONS, null], []);
  client.setQueryData([...QUERY_KEYS.CASH_REGISTERS, 'list', null], { items: [] });
  return { client, wrapper };
}

const stale = (client: QueryClient, key: readonly unknown[]) =>
  client.getQueryState(key)?.isInvalidated;

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ tenant: { id: 'tenant-1' } as ReturnType<typeof useAuthStore.getState>['tenant'], user: null });
  http.post.mockResolvedValue({ id: 'order-1' });
});

describe('useRecordPayment', () => {
  it('sends the idempotency key it receives and refreshes the order, the lists and the registers', async () => {
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useRecordPayment('order-1'), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        data: { method: 'CASH', amount: '20.00' },
        idempotencyKey: 'key-1',
      });
    });

    expect(http.post).toHaveBeenCalledWith(
      '/tenants/tenant-1/orders/order-1/payments',
      { method: 'CASH', amount: '20.00' },
      { headers: { 'Idempotency-Key': 'key-1' } },
    );
    expect(stale(client, QUERY_KEYS.ORDER('order-1'))).toBe(true);
    expect(stale(client, QUERY_KEYS.ORDER_ELIGIBILITY('order-1'))).toBe(true);
    expect(stale(client, [...QUERY_KEYS.ORDERS, 'list', null])).toBe(true);
    expect(stale(client, [...QUERY_KEYS.BILLABLE_SESSIONS, null])).toBe(true);
    expect(stale(client, [...QUERY_KEYS.CASH_REGISTERS, 'list', null])).toBe(true);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('reuses the same key when the request is retried after a network error', async () => {
    http.post.mockRejectedValueOnce({ message: 'Sin conexión', code: 'NETWORK_ERROR' });
    const { wrapper } = setup();
    const { result } = renderHook(() => useRecordPayment('order-1'), { wrapper });
    const variables = { data: { method: 'CASH' as const, amount: '20.00' }, idempotencyKey: 'key-1' };

    await act(async () => {
      await result.current.mutateAsync(variables).catch(() => undefined);
    });
    expect(toast.error).toHaveBeenCalledWith('Sin conexión');
    await act(async () => { await result.current.mutateAsync(variables); });

    const keys = http.post.mock.calls.map((call) => call[2].headers['Idempotency-Key']);
    expect(keys).toEqual(['key-1', 'key-1']);
  });
});

describe('order version conflict', () => {
  it('refreshes the order to read it again on a 409 ORDER_VERSION_CONFLICT', async () => {
    http.post.mockRejectedValue({ message: 'La orden cambió', status: 409, code: 'ORDER_VERSION_CONFLICT' });
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useCancelOrder('order-1'), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ version: 1, reason: 'Error' }).catch(() => undefined);
    });

    expect(stale(client, QUERY_KEYS.ORDER('order-1'))).toBe(true);
    expect(toast.error).toHaveBeenCalledWith('La orden cambió');
  });

  it('does not refresh anything on other errors', async () => {
    http.post.mockRejectedValue({ message: 'No se puede', status: 409, code: 'ORDER_HAS_PAYMENTS' });
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useCancelOrder('order-1'), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ version: 1, reason: 'Error' }).catch(() => undefined);
    });

    expect(stale(client, QUERY_KEYS.ORDER('order-1'))).toBeFalsy();
  });
});

describe('useRefundPayment', () => {
  it('posts the refund and refreshes the order and the registers', async () => {
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useRefundPayment('order-1'), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ paymentId: 'pay-1', data: { reason: 'Error de cobro' } });
    });

    expect(http.post).toHaveBeenCalledWith('/tenants/tenant-1/payments/pay-1/refund', { reason: 'Error de cobro' });
    expect(stale(client, QUERY_KEYS.ORDER('order-1'))).toBe(true);
    expect(stale(client, [...QUERY_KEYS.CASH_REGISTERS, 'list', null])).toBe(true);
  });
});

describe('payment errors', () => {
  it('re-reads the order and the lists when recording a payment fails, keeping the idempotency key rules to the caller', async () => {
    http.post.mockRejectedValue({ message: 'Sin conexión', code: 'NETWORK_ERROR' });
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useRecordPayment('order-1'), { wrapper });

    await act(async () => {
      await result.current
        .mutateAsync({ data: { method: 'CASH', amount: '20.00' }, idempotencyKey: 'key-1' })
        .catch(() => undefined);
    });

    expect(stale(client, QUERY_KEYS.ORDER('order-1'))).toBe(true);
    expect(stale(client, [...QUERY_KEYS.ORDERS, 'list', null])).toBe(true);
  });
});
