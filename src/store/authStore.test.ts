import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionRestoreResult } from '@/lib/api/client';

const mocks = vi.hoisted(() => ({
  restoreSession: vi.fn(),
  clearAuthData: vi.fn(),
  logout: vi.fn(),
}));

vi.mock('@/lib/api/client', () => ({
  apiClient: { restoreSession: mocks.restoreSession, clearAuthData: mocks.clearAuthData },
}));
vi.mock('@/lib/api/endpoints', () => ({ authApi: { logout: mocks.logout } }));

const persisted = (state: Record<string, unknown>) =>
  localStorage.setItem('auth-storage', JSON.stringify({ state, version: 0 }));

const signedIn = { user: { id: 'u1', tenantId: 't1' }, tenant: null, isAuthenticated: true };

/** A fresh store, as when the page loads and reads what the previous visit persisted. */
const start = async () => {
  vi.resetModules();
  const { useAuthStore } = await import('./authStore');
  await vi.waitFor(() => expect(useAuthStore.getState().hasHydrated).toBe(true));
  return useAuthStore;
};

describe('authStore session at start-up', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('refreshes through the cookie for a persisted user and keeps the session', async () => {
    persisted(signedIn);
    mocks.restoreSession.mockResolvedValue('active' satisfies SessionRestoreResult);

    const store = await start();

    expect(mocks.restoreSession).toHaveBeenCalledTimes(1);
    expect(store.getState()).toMatchObject({ isAuthenticated: true, user: { id: 'u1' } });
    expect(mocks.clearAuthData).not.toHaveBeenCalled();
  });

  it('clears the session when the refresh cookie is refused with 401', async () => {
    persisted(signedIn);
    mocks.restoreSession.mockResolvedValue('expired' satisfies SessionRestoreResult);

    const store = await start();

    expect(store.getState()).toMatchObject({ isAuthenticated: false, user: null, tenant: null });
    expect(mocks.clearAuthData).toHaveBeenCalled();
  });

  it('keeps the session when the API cannot be reached', async () => {
    persisted(signedIn);
    mocks.restoreSession.mockResolvedValue('unavailable' satisfies SessionRestoreResult);

    const store = await start();

    expect(store.getState().isAuthenticated).toBe(true);
    expect(mocks.clearAuthData).not.toHaveBeenCalled();
  });

  it('does not call the API when there is no persisted user', async () => {
    const store = await start();

    expect(mocks.restoreSession).not.toHaveBeenCalled();
    expect(store.getState().isAuthenticated).toBe(false);
  });

  it('holds the routes back (hasHydrated false) until the refresh has answered', async () => {
    persisted(signedIn);
    let answer!: (result: SessionRestoreResult) => void;
    mocks.restoreSession.mockReturnValue(new Promise((resolve) => (answer = resolve)));

    vi.resetModules();
    const { useAuthStore } = await import('./authStore');
    expect(useAuthStore.getState().hasHydrated).toBe(false);
    answer('active');
    await vi.waitFor(() => expect(useAuthStore.getState().hasHydrated).toBe(true));
  });

  it('never persists any token, only the user and the tenant', async () => {
    persisted(signedIn);
    mocks.restoreSession.mockResolvedValue('active');
    const store = await start();

    store.getState().setUser({ id: 'u1', tenantId: 't1' } as never);

    const stored = JSON.parse(localStorage.getItem('auth-storage')!);
    expect(Object.keys(stored.state).sort()).toEqual(['isAuthenticated', 'tenant', 'user']);
  });
});

describe('authStore logout', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { pathname: '/dashboard', href: '/dashboard' },
    });
  });

  it('asks the API to end the session without sending any token, then clears it locally', async () => {
    persisted(signedIn);
    mocks.restoreSession.mockResolvedValue('active');
    mocks.logout.mockResolvedValue(undefined);
    const store = await start();

    await store.getState().logout();

    expect(mocks.logout).toHaveBeenCalledWith();
    expect(mocks.clearAuthData).toHaveBeenCalled();
    expect(store.getState()).toMatchObject({ isAuthenticated: false, user: null });
    expect(window.location.href).toBe('/login');
  });

  it('clears the session even when the API call fails', async () => {
    persisted(signedIn);
    mocks.restoreSession.mockResolvedValue('active');
    mocks.logout.mockRejectedValue(new Error('offline'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const store = await start();

    await store.getState().logout();

    expect(store.getState().isAuthenticated).toBe(false);
    expect(mocks.clearAuthData).toHaveBeenCalled();
  });
});
