import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/store/authStore';
import { QUERY_KEYS } from '@/lib/constants';
import { useCreateStockReceipt, useProductsForSale } from './useInventory';

const http = vi.hoisted(() => ({
  get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn(), upload: vi.fn(),
}));
vi.mock('@/lib/api/client', () => ({ apiClient: http }));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, wrapper };
}

const stale = (client: QueryClient, key: readonly unknown[]) =>
  client.getQueryState(key)?.isInvalidated;

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ tenant: { id: 'tenant-1' } as ReturnType<typeof useAuthStore.getState>['tenant'], user: null });
});

describe('useProductsForSale', () => {
  it('does not query without a branch or with an empty search', () => {
    const { wrapper } = setup();
    renderHook(() => useProductsForSale('', 'prot'), { wrapper });
    renderHook(() => useProductsForSale('branch-1', '  '), { wrapper });

    expect(http.get).not.toHaveBeenCalled();
  });

  it('queries the products of the branch that match the search', async () => {
    http.get.mockResolvedValue([{ id: 'product-1' }]);
    const { wrapper } = setup();
    const { result } = renderHook(() => useProductsForSale('branch-1', 'prot'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(http.get).toHaveBeenCalledWith('/tenants/tenant-1/products/for-sale', {
      params: { branchId: 'branch-1', search: 'prot' },
    });
  });

  it('queries by exact barcode without a search text', async () => {
    http.get.mockResolvedValue([{ id: 'product-1' }]);
    const { wrapper } = setup();
    const { result } = renderHook(() => useProductsForSale('branch-1', '', ' 7501 '), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(http.get).toHaveBeenCalledWith('/tenants/tenant-1/products/for-sale', {
      params: { branchId: 'branch-1', barcode: '7501' },
    });
  });
});

describe('useCreateStockReceipt', () => {
  it('refreshes the products and the reports when the receipt is saved, without the generic error toast', async () => {
    http.post.mockResolvedValue({ id: 'receipt-1' });
    const { client, wrapper } = setup();
    const productsKey = [...QUERY_KEYS.PRODUCTS, 'list', null];
    const reportKey = [...QUERY_KEYS.INVENTORY_REPORTS, 'valuation', null];
    client.setQueryData(productsKey, { items: [] });
    client.setQueryData(reportKey, { branches: [] });
    const { result } = renderHook(() => useCreateStockReceipt(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        branchId: 'branch-1',
        lines: [{ productId: 'product-1', quantity: 2, unitCost: '1.50' }],
      });
    });

    expect(http.post).toHaveBeenCalledWith('/tenants/tenant-1/stock-receipts', expect.objectContaining({ branchId: 'branch-1' }));
    expect(stale(client, productsKey)).toBe(true);
    expect(stale(client, reportKey)).toBe(true);
  });

  it('shows no toast when the API rejects the receipt', async () => {
    http.post.mockRejectedValue({ statusCode: 422, code: 'LOT_EXPIRY_REQUIRED', message: 'Falta la fecha' });
    const { wrapper } = setup();
    const { result } = renderHook(() => useCreateStockReceipt(), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync({ branchId: 'b', lines: [] })).rejects.toBeDefined();
    });

    expect(toast.error).not.toHaveBeenCalled();
  });
});
