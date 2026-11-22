'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, Tenant } from '@/types';
import { apiClient } from '@/lib/api/client';
import { authApi } from '@/lib/api/endpoints';

/**
 * A persisted user whose access token is missing or expired gets a new one from the refresh
 * cookie as the app starts. If the API answers 401 the session is over and it is cleared, as
 * any request that fails to refresh does.
 */
async function restoreSession(state: AuthState): Promise<void> {
  if (!state.isAuthenticated || !state.user) return;
  if ((await apiClient.restoreSession()) === 'expired') {
    state.clearAuth();
  }
}

interface AuthState {
  user: User | null;
  tenant: Tenant | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  hasHydrated: boolean;

  // Actions
  setUser: (user: User) => void;
  setTenant: (tenant: Tenant) => void;
  setAuth: (user: User, tenant: Tenant) => void;
  logout: () => void;
  clearAuth: () => void;
  setHasHydrated: (hydrated: boolean) => void;
}


export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      tenant: null,
      isAuthenticated: false,
      isLoading: false,
      hasHydrated: false,

      setUser: (user) => set({ user, isAuthenticated: true }),
      setTenant: (tenant) => set({ tenant }),
      setAuth: (user, tenant) => set({ user, tenant, isAuthenticated: true }),
      logout: async () => {
        try {
          // The API revokes the refresh token of the cookie and clears the cookie.
          await authApi.logout();
        } catch (error) {
          console.error('Logout error:', error);
        } finally {
          apiClient.clearAuthData();
          set({ user: null, tenant: null, isAuthenticated: false });
          if (typeof window !== 'undefined') {
            window.location.href = '/login';
          }
        }
      },
      clearAuth: () => {
        apiClient.clearAuthData();
        set({ user: null, tenant: null, isAuthenticated: false });
      },
      setHasHydrated: (hydrated) => set({ hasHydrated: hydrated }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        tenant: state.tenant,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // The routes wait for `hasHydrated`: it turns true once the session is settled, so
          // their first requests already carry a valid access token.
          void restoreSession(state).finally(() => state.setHasHydrated(true));
        }
      },
    }
  )
);
