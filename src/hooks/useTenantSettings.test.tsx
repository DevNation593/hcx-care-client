import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { QUERY_KEYS } from '@/lib/constants';
import { useUpdateTenantSettings } from './useTenantSettings';

const mocks = vi.hoisted(() => ({ update: vi.fn() }));

vi.mock('@/lib/api/endpoints', () => ({ tenantSettingsApi: { update: mocks.update } }));
vi.mock('@/store/authStore', () => ({ useAuthStore: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe('useUpdateTenantSettings', () => {
  it('refreshes the clinical inbox, which shows the alert thresholds and what is overdue', async () => {
    mocks.update.mockResolvedValue({ resultReviewAlertDays: 5 });
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useUpdateTenantSettings(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ resultReviewAlertDays: 5 });
    });

    expect(invalidate).toHaveBeenCalledWith({ queryKey: QUERY_KEYS.TENANT_SETTINGS });
    // Every scope and page of the inbox.
    expect(invalidate).toHaveBeenCalledWith({ queryKey: QUERY_KEYS.CLINICAL_INBOX_ALL });
  });
});
