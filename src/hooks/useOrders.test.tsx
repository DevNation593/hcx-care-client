import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/store/authStore';
import { QUERY_KEYS } from '@/lib/constants';
import { useAddOrderItem, useCancelOrder, useCreateOrder, useRemoveOrderItem, useRecordPayment, useRefundPayment } from './useOrders';

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

describe('useCreateOrder', () => {
  it('refreshes cached patient receivers when the order can create and link a billing profile', async () => {
    const { client, wrapper } = setup();
    const profilesKey = [...QUERY_KEYS.BILLING_PROFILES, 'patient', 'patient-1'];
    client.setQueryData(profilesKey, []);
    const { result } = renderHook(() => useCreateOrder(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ treatmentSessionIds: ['session-1'] });
    });

    expect(stale(client, profilesKey)).toBe(true);
  });
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

describe('stock availability after order mutations', () => {
  const stockKeys = () => [
    [...QUERY_KEYS.PRODUCTS, 'for-sale', 'b-1', 'x'],
    [...QUERY_KEYS.INVENTORY_REPORTS, 'valuation'],
    [...QUERY_KEYS.STOCK_MOVEMENTS, 'list'],
  ];
  const seed = (client: QueryClient) => stockKeys().forEach((key) => client.setQueryData(key, []));

  it.each<[string, () => { mutateAsync: (v: never) => Promise<unknown> }, unknown]>([
    ['adding an item', () => useAddOrderItem('order-1'), { productId: 'p-1', quantity: 1, version: 1 }],
    ['removing an item', () => useRemoveOrderItem('order-1'), { itemId: 'i-1', version: 1 }],
    ['cancelling the order', () => useCancelOrder('order-1'), { version: 1, reason: 'Error' }],
  ])('marks products, reports and movements stale after %s', async (_name, hook, input) => {
    http.delete.mockResolvedValue({ id: 'order-1' });
    const { client, wrapper } = setup();
    seed(client);
    const { result } = renderHook(hook, { wrapper });

    await act(async () => {
      await result.current.mutateAsync(input as never);
    });

    for (const key of stockKeys()) expect(stale(client, key)).toBe(true);
  });

  it('refreshes the stock views when adding fails with INSUFFICIENT_STOCK', async () => {
    http.post.mockRejectedValue({ message: 'Solo hay 1', status: 409, code: 'INSUFFICIENT_STOCK' });
    const { client, wrapper } = setup();
    seed(client);
    const { result } = renderHook(() => useAddOrderItem('order-1'), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ productId: 'p-1', quantity: 5, version: 1 } as never).catch(() => undefined);
    });

    for (const key of stockKeys()) expect(stale(client, key)).toBe(true);
  });
});
