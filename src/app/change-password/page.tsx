'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { AlertTriangle, Lock } from 'lucide-react';
import { LogoMark } from '@/components/brand/logo';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authApi, tenantsApi } from '@/lib/api/endpoints';
import { APP_NAME, PASSWORD_MIN_LENGTH, ROUTES } from '@/lib/constants';
import { postLoginRoute } from '@/lib/post-login-route';
import { useAuthStore } from '@/store/authStore';
import { isPlatformAdmin } from '@/types/guards';

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'La contraseña actual es requerida'),
    newPassword: z
      .string()
      .min(PASSWORD_MIN_LENGTH, `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: 'La nueva contraseña debe ser distinta de la actual',
    path: ['newPassword'],
  });

type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;

export default function ChangePasswordPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const setUser = useAuthStore((state) => state.setUser);
  const setAuth = useAuthStore((state) => state.setAuth);
  const logout = useAuthStore((state) => state.logout);

  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordFormData>({ resolver: zodResolver(changePasswordSchema) });

  useEffect(() => {
    if (hasHydrated && (!isAuthenticated || !user)) {
      router.replace(ROUTES.LOGIN);
    }
  }, [hasHydrated, isAuthenticated, user, router]);

  if (!hasHydrated || !isAuthenticated || !user) return null;

  const onSubmit = async (data: ChangePasswordFormData) => {
    setError(null);
    try {
      await authApi.changePassword({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      const updated = { ...user, mustChangePassword: false };
      setUser(updated);
      // The tenant was not loaded at login because the temporary password blocked it.
      if (!isPlatformAdmin(updated)) {
        try {
          setAuth(updated, await tenantsApi.get(updated.tenantId));
        } catch {
          // Still signed in; the tenant loads on the next session refresh.
          console.warn('Could not fetch tenant details');
        }
      }
      toast.success('Contraseña actualizada');
      router.replace(postLoginRoute(updated));
    } catch (err) {
      const message =
        (err as { message?: string })?.message || 'No se pudo cambiar la contraseña';
      setError(message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader className="text-center">
            <LogoMark className="mx-auto mb-4 h-12 w-12" title={APP_NAME} />
            <CardTitle>Cambia tu contraseña</CardTitle>
            <CardDescription>
              Tu contraseña es temporal. Elige una nueva para continuar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {error && (
                <div
                  role="alert"
                  className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm flex items-center gap-2"
                >
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              <div>
                <Label htmlFor="currentPassword">
                  <Lock className="h-4 w-4 inline mr-1" />
                  Contraseña actual
                </Label>
                <Input
                  id="currentPassword"
                  type="password"
                  autoComplete="current-password"
                  {...register('currentPassword')}
                  error={errors.currentPassword?.message}
                  autoFocus
                />
              </div>

              <div>
                <Label htmlFor="newPassword">
                  <Lock className="h-4 w-4 inline mr-1" />
                  Nueva contraseña
                </Label>
                <Input
                  id="newPassword"
                  type="password"
                  autoComplete="new-password"
                  {...register('newPassword')}
                  error={errors.newPassword?.message}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Mínimo {PASSWORD_MIN_LENGTH} caracteres.
                </p>
              </div>

              <div>
                <Label htmlFor="confirmPassword">
                  <Lock className="h-4 w-4 inline mr-1" />
                  Confirmar contraseña
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  {...register('confirmPassword')}
                  error={errors.confirmPassword?.message}
                />
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting} loading={isSubmitting}>
                Guardar contraseña
              </Button>

              <Button type="button" variant="ghost" className="w-full" onClick={() => logout()}>
                Cerrar sesión
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
