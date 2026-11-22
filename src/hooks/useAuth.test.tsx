import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authApi, tenantsApi } from '@/lib/api/endpoints';
import { useAuthStore } from '@/store/authStore';
import { UserRole, type Tenant, type User } from '@/types';
import { useLogin } from './useAuth';

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));

vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/api/endpoints', () => ({
  authApi: { login: vi.fn() },
  usersApi: {},
  tenantsApi: { get: vi.fn() },
}));

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

const login = async (user: Partial<User>) => {
  vi.mocked(authApi.login).mockResolvedValue({
    accessToken: 'a',
    user: { id: 'user-1', tenantId: 'tenant-1', ...user } as User,
  } as Awaited<ReturnType<typeof authApi.login>>);
  const { result } = renderHook(() => useLogin(), { wrapper });
  await act(async () => {
    result.current.mutate({ email: 'a@b.c', password: 'secret' });
  });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  useAuthStore.setState({ user: null, tenant: null, isAuthenticated: false });
});

describe('useLogin', () => {
  it('keeps only the access token in localStorage and removes a legacy refresh token', async () => {
    localStorage.setItem('refresh_token', 'legacy.refresh.jwt');
    vi.mocked(tenantsApi.get).mockResolvedValue({ id: 'tenant-1' } as Tenant);

    await login({ role: UserRole.MASTER, mustChangePassword: false });

    expect(localStorage.getItem('access_token')).toBe('a');
    expect(localStorage.getItem('refresh_token')).toBeNull();
  });

  it('does not request the tenant when an ADMIN logs in and reports no error', async () => {
    await login({ role: UserRole.ADMIN });
    expect(tenantsApi.get).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith('/platform');
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('loads the tenant and goes to the dashboard for a regular user', async () => {
    vi.mocked(tenantsApi.get).mockResolvedValue({ id: 'tenant-1' } as Tenant);
    await login({ role: UserRole.MASTER, mustChangePassword: false });
    expect(tenantsApi.get).toHaveBeenCalledWith('tenant-1');
    expect(router.push).toHaveBeenCalledWith('/dashboard');
  });

  it('goes to /change-password when the password is temporary', async () => {
    vi.mocked(tenantsApi.get).mockResolvedValue({ id: 'tenant-1' } as Tenant);
    await login({ role: UserRole.MASTER, mustChangePassword: true });
    expect(tenantsApi.get).not.toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith('/change-password');
  });
});
