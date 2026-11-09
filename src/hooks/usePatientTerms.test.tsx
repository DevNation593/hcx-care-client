import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/store/authStore';
import type { User } from '@/types';
import { usePatientTerms } from './usePatientTerms';

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn() }));
vi.mock('@/lib/api/client', () => ({ apiClient: http }));

type Tenant = ReturnType<typeof useAuthStore.getState>['tenant'];

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function signIn(specialtyCode?: string) {
  const user = {
    id: 'user-1',
    tenantId: 'tenant-1',
    professionalProfile: specialtyCode
      ? { isActive: true, specialty: { id: 's-1', code: specialtyCode, name: specialtyCode, isActive: true } }
      : undefined,
  } as unknown as User;
  useAuthStore.setState({ user, tenant: { id: 'tenant-1' } as Tenant });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('usePatientTerms', () => {
  it('calls clients the people an aesthetic profile attends, without asking the clinic', () => {
    signIn('AESTHETICS');
    const { result } = renderHook(() => usePatientTerms(), { wrapper });
    expect(result.current).toMatchObject({ Many: 'Clientes', one: 'cliente', isClient: true });
    expect(http.get).not.toHaveBeenCalled();
  });

  it('keeps patients for a clinical profile, even in a clinic that also does aesthetics', () => {
    signIn('PSYCHOLOGY');
    const { result } = renderHook(() => usePatientTerms(), { wrapper });
    expect(result.current).toMatchObject({ Many: 'Pacientes', one: 'paciente', isClient: false });
  });

  it('follows the clinic for an account without a profile: clients when every specialty is aesthetic', async () => {
    signIn();
    http.get.mockResolvedValue([{ code: 'AESTHETICS' }]);
    const { result } = renderHook(() => usePatientTerms(), { wrapper });
    await waitFor(() => expect(result.current.Many).toBe('Clientes'));
    expect(http.get).toHaveBeenCalledWith('/tenants/tenant-1/specialties');
  });

  it('keeps patients for an account without a profile in a clinic with a clinical specialty', async () => {
    signIn();
    http.get.mockResolvedValue([{ code: 'AESTHETICS' }, { code: 'GYNECOLOGY' }]);
    const { result } = renderHook(() => usePatientTerms(), { wrapper });
    await waitFor(() => expect(http.get).toHaveBeenCalled());
    expect(result.current.Many).toBe('Pacientes');
  });
});
