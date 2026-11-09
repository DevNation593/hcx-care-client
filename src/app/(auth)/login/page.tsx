'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginFormData } from '@/lib/validations/schemas';
import { useState } from 'react';
import { useLogin, useVerifyMfaLogin } from '@/hooks/useAuth';
import type { ApiError, MfaChallenge } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Logo } from '@/components/brand/logo';
import Link from 'next/link';

/** The second step of a sign-in with two-factor: a code of the app or a recovery code. */
function MfaStep({ challenge, onBack }: { challenge: MfaChallenge; onBack: () => void }) {
  const verify = useVerifyMfaLogin();
  const [useRecovery, setUseRecovery] = useState(false);
  const [value, setValue] = useState('');
  const ready = useRecovery ? value.trim().length >= 8 : value.length === 6;
  const expired = (verify.error as ApiError | null)?.code === 'MFA_CHALLENGE_EXPIRED';

  return (
    <Card>
      <CardHeader className="space-y-1 text-center">
        <div className="flex justify-center mb-4">
          <Logo className="text-xl" markClassName="h-10 w-10" />
        </div>
        <CardTitle className="text-2xl">Verificación en dos pasos</CardTitle>
        <CardDescription>
          {useRecovery
            ? 'Escribe uno de tus códigos de recuperación. Cada uno sirve una sola vez.'
            : 'Escribe el código de 6 dígitos de tu aplicación de autenticación.'}
        </CardDescription>
      </CardHeader>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          verify.mutate(
            useRecovery
              ? { mfaToken: challenge.mfaToken, recoveryCode: value.trim() }
              : { mfaToken: challenge.mfaToken, code: value },
            { onError: () => setValue('') },
          );
        }}
      >
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mfa-login-code" required>
              {useRecovery ? 'Código de recuperación' : 'Código'}
            </Label>
            <Input
              id="mfa-login-code"
              autoFocus
              autoComplete="one-time-code"
              inputMode={useRecovery ? 'text' : 'numeric'}
              value={value}
              onChange={(event) =>
                setValue(useRecovery ? event.target.value : event.target.value.replace(/\D/g, '').slice(0, 6))
              }
              error={verify.error ? (verify.error as ApiError).message || 'El código no es correcto.' : undefined}
            />
          </div>
          <button
            type="button"
            className="text-sm text-primary hover:underline"
            onClick={() => {
              setUseRecovery(!useRecovery);
              setValue('');
            }}
          >
            {useRecovery ? 'Usar el código de la aplicación' : 'No tengo mi teléfono: usar un código de recuperación'}
          </button>
        </CardContent>
        <CardFooter className="flex flex-col space-y-2">
          {expired ? (
            <Button type="button" className="w-full" onClick={onBack}>
              Volver a iniciar sesión
            </Button>
          ) : (
            <Button type="submit" className="w-full" disabled={!ready} loading={verify.isPending}>
              Verificar
            </Button>
          )}
          <Button type="button" variant="ghost" className="w-full" onClick={onBack}>
            Cancelar
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

export default function LoginPage() {
  const [challenge, setChallenge] = useState<MfaChallenge | null>(null);
  const { mutate: login, isPending } = useLogin({ onChallenge: setChallenge });
  
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = (data: LoginFormData) => {
    login(data);
  };

  if (challenge) return <MfaStep challenge={challenge} onBack={() => setChallenge(null)} />;

  return (
    <Card>
      <CardHeader className="space-y-1 text-center">
        <div className="flex justify-center mb-4">
          <Logo className="text-xl" markClassName="h-10 w-10" />
        </div>
        <CardTitle className="text-2xl">Bienvenido</CardTitle>
        <CardDescription>
          Ingresa tus credenciales para acceder a tu clínica
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" required>
              Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="tu@email.com"
              {...register('email')}
              error={errors.email?.message}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" required>
              Contraseña
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              {...register('password')}
              error={errors.password?.message}
            />
          </div>
          <div className="flex items-center justify-end">
            <Link
              href="/forgot-password"
              className="text-sm text-primary hover:underline"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <Button type="submit" className="w-full" loading={isPending}>
            Iniciar Sesión
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
