import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QUERY_KEYS } from '@/lib/constants';
import { useAuthStore } from '@/store/authStore';
import { useBillAsPatient } from './useBillingProfiles';

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() }));
vi.mock('@/lib/api/client', () => ({ apiClient: http }));

type Tenant = ReturnType<typeof useAuthStore.getState>['tenant'];

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ tenant: { id: 'tenant-1' } as Tenant, user: null });
  http.post.mockResolvedValue({ id: 'bp-1', isDefault: true });
});

describe('useBillAsPatient', () => {
  it('refreshes the patient detail and the patient lists the completed data shows in', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const list = ['patients', 'tenant', 'tenant-1', { search: '' }];
    const detail = QUERY_KEYS.PATIENT_DETAIL_SCOPED('tenant-1', 'patient-1');
    client.setQueryData(list, []);
    client.setQueryData(detail, {});
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useBillAsPatient('patient-1'), { wrapper });

    await act(() => result.current.mutateAsync({ email: 'ana@example.test' }));

    expect(http.post).toHaveBeenCalledWith('/tenants/tenant-1/patients/patient-1/billing-profiles/own', {
      email: 'ana@example.test',
    });
    expect(client.getQueryState(list)?.isInvalidated).toBe(true);
    expect(client.getQueryState(detail)?.isInvalidated).toBe(true);
  });
});
