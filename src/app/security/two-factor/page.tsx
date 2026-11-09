'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LogoMark } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TwoFactorEnrollment } from '@/features/security/two-factor-setup';
import { tenantsApi } from '@/lib/api/endpoints';
import { APP_NAME, ROUTES } from '@/lib/constants';
import { postLoginRoute } from '@/lib/post-login-route';
import { useAuthStore } from '@/store/authStore';
import { isPlatformAdmin } from '@/types/guards';

/**
 * The clinic requires two-factor sign-in and this account has not set it up: nothing else is
 * reachable until it does (the API answers 403 MFA_ENROLLMENT_REQUIRED elsewhere).
 */
export default function TwoFactorEnrollmentPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const setUser = useAuthStore((state) => state.setUser);
  const setAuth = useAuthStore((state) => state.setAuth);
  const logout = useAuthStore((state) => state.logout);

  useEffect(() => {
    if (hasHydrated && (!isAuthenticated || !user)) router.replace(ROUTES.LOGIN);
  }, [hasHydrated, isAuthenticated, user, router]);

  if (!hasHydrated || !isAuthenticated || !user) return null;

  const done = async () => {
    const updated = { ...user, mfaEnabled: true, mfaEnrollmentRequired: false };
    setUser(updated);
    // The tenant was not loaded at sign-in because the pending setup blocked it.
    if (!isPlatformAdmin(updated)) {
      try {
        setAuth(updated, await tenantsApi.get(updated.tenantId));
      } catch {
        console.warn('Could not fetch tenant details');
      }
    }
    router.replace(postLoginRoute(updated));
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-lg">
        <Card>
          <CardHeader className="text-center">
            <LogoMark className="mx-auto mb-4 h-12 w-12" title={APP_NAME} />
            <CardTitle>Configura la verificación en dos pasos</CardTitle>
            <CardDescription>
              Tu consultorio la exige para proteger las historias clínicas. Desde ahora, además de la contraseña, se te pedirá
              un código de tu teléfono al iniciar sesión.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <TwoFactorEnrollment onEnabled={done} />
            <Button variant="ghost" className="w-full" onClick={() => logout()}>
              Cerrar sesión
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
