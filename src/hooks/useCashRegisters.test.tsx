import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/store/authStore';
import { QUERY_KEYS } from '@/lib/constants';
import { useCloseCashRegister } from './useCashRegisters';

const http = vi.hoisted(() => ({
  get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn(), upload: vi.fn(),
}));
vi.mock('@/lib/api/client', () => ({ apiClient: http }));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  client.setQueryData([...QUERY_KEYS.CASH_REGISTERS, 'reg-1'], { id: 'reg-1' });
  return { client, wrapper };
}

const stale = (client: QueryClient, key: readonly unknown[]) => client.getQueryState(key)?.isInvalidated;

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ tenant: { id: 'tenant-1' } as ReturnType<typeof useAuthStore.getState>['tenant'], user: null });
});

describe('useCloseCashRegister', () => {
  it('re-reads the register when the server requires a closing note', async () => {
    http.post.mockRejectedValue({ message: 'Falta la nota', status: 422, code: 'CASH_CLOSING_NOTE_REQUIRED' });
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useCloseCashRegister(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: 'reg-1', data: { countedCash: '10.00' } }).catch(() => undefined);
    });

    expect(stale(client, [...QUERY_KEYS.CASH_REGISTERS, 'reg-1'])).toBe(true);
    expect(toast.error).toHaveBeenCalledWith('Falta la nota');
  });

  it('does not re-read the register on other errors', async () => {
    http.post.mockRejectedValue({ message: 'Error', status: 500, code: 'INTERNAL' });
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useCloseCashRegister(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: 'reg-1', data: { countedCash: '10.00' } }).catch(() => undefined);
    });

    expect(stale(client, [...QUERY_KEYS.CASH_REGISTERS, 'reg-1'])).toBeFalsy();
  });
});
