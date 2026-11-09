'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi, usersApi, tenantsApi } from '@/lib/api/endpoints';
import { useAuthStore } from '@/store/authStore';
import { QUERY_KEYS } from '@/lib/constants';
import { isMfaChallenge, type AuthResponse, type LoginCredentials, type MfaChallenge } from '@/types';
import { apiClient } from '@/lib/api/client';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { isPlatformAdmin } from '@/types/guards';
import { postLoginRoute } from '@/lib/post-login-route';

/** Opens the session the API granted: tokens, user, tenant, and the first page to show. */
function useOpenSession() {
  const setAuth = useAuthStore((state) => state.setAuth);
  const setUser = useAuthStore((state) => state.setUser);
  const router = useRouter();

  return async (response: AuthResponse) => {
    const { accessToken, refreshToken, user } = response;
    apiClient.setTokens(accessToken, refreshToken);
    // Set user immediately so getTenantId() works
    setUser(user);

    // The platform admin has no clinic (PLATFORM_ONLY), and a temporary password or a pending
    // two-factor setup blocks every request but its own: the tenant loads after them.
    if (!isPlatformAdmin(user) && !user.mustChangePassword && !user.mfaEnrollmentRequired) {
      try {
        const tenant = await tenantsApi.get(user.tenantId);
        setAuth(user, tenant);
      } catch {
        // If tenant fetch fails, user is still authenticated
        console.warn('Could not fetch tenant details');
      }
    }

    router.push(postLoginRoute(user));
    toast.success('¡Bienvenido!');
  };
}

/**
 * The first step of a sign-in. An account with two-factor sign-in gets a challenge: the caller
 * shows the code step and finishes with `useVerifyMfaLogin`.
 */
export function useLogin(options: { onChallenge?: (challenge: MfaChallenge) => void } = {}) {
  const openSession = useOpenSession();

  return useMutation({
    mutationFn: (credentials: LoginCredentials) => authApi.login(credentials),
    onSuccess: async (response) => {
      if (isMfaChallenge(response)) {
        options.onChallenge?.(response);
        return;
      }
      await openSession(response);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Error al iniciar sesión');
    },
  });
}

/** The second step of a sign-in: a code of the authenticator app or a recovery code. */
export function useVerifyMfaLogin() {
  const openSession = useOpenSession();

  return useMutation({
    mutationFn: (input: { mfaToken: string; code?: string; recoveryCode?: string }) =>
      authApi.verifyMfa(input),
    onSuccess: openSession,
  });
}

export function useLogout() {
  const logout = useAuthStore((state) => state.logout);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await logout();
    },
    onSuccess: () => {
      queryClient.clear();
      toast.success('Sesión cerrada');
    },
  });
}

export function useCurrentUser() {
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return useQuery({
    queryKey: QUERY_KEYS.ME,
    queryFn: async () => {
      if (!user?.id) throw new Error('No user ID');
      const response = await usersApi.get(user.id);
      return response;
    },
    enabled: isAuthenticated && !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
