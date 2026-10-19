import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QUERY_KEYS } from '@/lib/constants';
import { useAuthStore } from '@/store/authStore';
import { specialtyCatalogApi, tenantModulesApi, tenantSpecialtiesApi } from '@/lib/api/endpoints';
import { useSpecialtyCatalog, useTenantModules, useTenantSpecialties } from './useSpecialties';

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn() }));
vi.mock('@/lib/api/client', () => ({ apiClient: http }));

function createWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, wrapper };
}

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ tenant: { id: 'tenant-1' } as ReturnType<typeof useAuthStore.getState>['tenant'], user: null });
  http.get.mockResolvedValue([]);
});

describe('specialty read APIs', () => {
  it('reads the public catalog and the current clinic selection', async () => {
    await specialtyCatalogApi.list();
    await tenantSpecialtiesApi.list();
    await tenantModulesApi.list();
    expect(http.get).toHaveBeenCalledWith('/specialties');
    expect(http.get).toHaveBeenCalledWith('/tenants/tenant-1/specialties');
    expect(http.get).toHaveBeenCalledWith('/tenants/tenant-1/modules');
  });

  it('keeps clinic data isolated in the query cache', async () => {
    http.get.mockImplementation((url: string) => Promise.resolve(url.includes('tenant-2') ? [{ code: 'NUTRITION' }] : [{ code: 'PSYCHOLOGY' }]));
    const { client, wrapper } = createWrapper();
    const specialties = renderHook(() => useTenantSpecialties(), { wrapper });
    await waitFor(() => expect(specialties.result.current.data).toEqual([{ code: 'PSYCHOLOGY' }]));
    act(() => useAuthStore.setState({ tenant: { id: 'tenant-2' } as ReturnType<typeof useAuthStore.getState>['tenant'] }));
    await waitFor(() => expect(specialties.result.current.data).toEqual([{ code: 'NUTRITION' }]));
    expect(client.getQueryData(QUERY_KEYS.TENANT_SPECIALTIES_SCOPED('tenant-1'))).toEqual([{ code: 'PSYCHOLOGY' }]);
  });

  it('does not request clinic data without a clinic', () => {
    useAuthStore.setState({ tenant: null, user: null });
    const { wrapper } = createWrapper();
    const specialties = renderHook(() => useTenantSpecialties(), { wrapper });
    const modules = renderHook(() => useTenantModules(), { wrapper });
    expect(specialties.result.current.fetchStatus).toBe('idle');
    expect(modules.result.current.fetchStatus).toBe('idle');
    expect(http.get).not.toHaveBeenCalled();
  });

  it('loads the catalog through its stable query key', async () => {
    const { client, wrapper } = createWrapper();
    const catalog = renderHook(() => useSpecialtyCatalog(), { wrapper });
    await waitFor(() => expect(catalog.result.current.isSuccess).toBe(true));
    expect(client.getQueryData(QUERY_KEYS.SPECIALTY_CATALOG)).toEqual([]);
  });
});
