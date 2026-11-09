'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, KeyRound, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiClient } from '@/lib/api/client';
import { authApi } from '@/lib/api/endpoints';
import { QUERY_KEYS } from '@/lib/constants';
import { useAuthStore } from '@/store/authStore';
import type { ApiError, MfaSetup } from '@/types';

const errorMessage = (error: unknown, fallback: string) =>
  (error as ApiError | undefined)?.message || fallback;

/** Six digits, the way authenticator apps show them, spaces allowed. */
const cleanCode = (value: string) => value.replace(/\D/g, '').slice(0, 6);

export function RecoveryCodes({ codes }: { codes: string[] }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(codes.join('\n'));
      toast.success('Códigos copiados');
    } catch {
      toast.error('No se pudieron copiar: anótalos a mano.');
    }
  };
  return (
    <div className="space-y-3 rounded-md border border-amber-400/60 bg-amber-50 p-4 dark:bg-amber-950/30">
      <p className="text-sm font-medium">
        Guarda estos códigos de recuperación en un lugar seguro. Cada uno sirve una sola vez si pierdes el teléfono, y no se
        vuelven a mostrar.
      </p>
      <ul aria-label="Códigos de recuperación" className="grid grid-cols-2 gap-2 font-mono text-sm sm:grid-cols-5">
        {codes.map((code) => (
          <li key={code} className="rounded bg-background px-2 py-1 text-center">
            {code}
          </li>
        ))}
      </ul>
      <Button type="button" variant="outline" size="sm" onClick={copy}>
        <Copy className="h-4 w-4" /> Copiar códigos
      </Button>
    </div>
  );
}

/**
 * Sets up two-factor sign-in: the password, then the QR code for the authenticator app, then a
 * code from it to confirm, and the recovery codes shown once. `onEnabled` runs after the codes
 * were acknowledged.
 */
export function TwoFactorEnrollment({ onEnabled }: { onEnabled?: () => void }) {
  const queryClient = useQueryClient();
  const [password, setPassword] = useState('');
  const [setup, setSetup] = useState<MfaSetup | null>(null);
  const [code, setCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);

  const start = useMutation({ mutationFn: () => authApi.setupMfa(password) });
  const confirm = useMutation({
    mutationFn: () => authApi.enableMfa(code),
    onSuccess: ({ accessToken, refreshToken }) => {
      // Enabling ended every session opened with the password alone, this one included: keep the
      // new one at once, so a reload before the codes are acknowledged stays signed in.
      apiClient.setTokens(accessToken, refreshToken);
      const { user, setUser } = useAuthStore.getState();
      if (user) setUser({ ...user, mfaEnabled: true, mfaEnrollmentRequired: false });
    },
  });

  if (recoveryCodes) {
    return (
      <div className="space-y-4">
        <Alert variant="success">La verificación en dos pasos está activa.</Alert>
        <RecoveryCodes codes={recoveryCodes} />
        <Button
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MFA_STATUS });
            onEnabled?.();
          }}
        >
          Ya guardé los códigos
        </Button>
      </div>
    );
  }

  if (!setup) {
    return (
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          start.mutate(undefined, {
            onSuccess: setSetup,
            // The password lives only in this form.
            onSettled: () => setPassword(''),
          });
        }}
      >
        <div>
          <Label htmlFor="mfa-password">Tu contraseña</Label>
          <Input
            id="mfa-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        {start.error && <Alert variant="destructive">{errorMessage(start.error, 'No se pudo iniciar la configuración.')}</Alert>}
        <Button type="submit" disabled={!password} loading={start.isPending}>
          Continuar
        </Button>
      </form>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        confirm.mutate(undefined, { onSuccess: (result) => setRecoveryCodes(result.recoveryCodes) });
      }}
    >
      <ol className="list-decimal space-y-1 pl-5 text-sm">
        <li>Abre una aplicación de autenticación (Google Authenticator, Microsoft Authenticator, 1Password…).</li>
        <li>Escanea el código QR o escribe la clave.</li>
        <li>Escribe el código de 6 dígitos que muestra la aplicación.</li>
      </ol>
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={setup.qrCodeDataUrl} alt="Código QR para la aplicación de autenticación" className="h-44 w-44 rounded border" />
        <div className="space-y-1 text-sm">
          <p className="text-muted-foreground">Clave para escribir a mano:</p>
          <p className="break-all font-mono">{setup.secret.match(/.{1,4}/g)?.join(' ')}</p>
        </div>
      </div>
      <div className="max-w-xs">
        <Label htmlFor="mfa-code">Código de la aplicación</Label>
        <Input
          id="mfa-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={(event) => setCode(cleanCode(event.target.value))}
        />
      </div>
      {confirm.error && <Alert variant="destructive">{errorMessage(confirm.error, 'El código no es correcto.')}</Alert>}
      <Button type="submit" disabled={code.length !== 6} loading={confirm.isPending}>
        Activar verificación en dos pasos
      </Button>
    </form>
  );
}

/** The profile card: status, setup, new recovery codes and turning it off. */
export function TwoFactorCard() {
  const queryClient = useQueryClient();
  const status = useQuery({ queryKey: QUERY_KEYS.MFA_STATUS, queryFn: () => authApi.mfaStatus() });
  const [mode, setMode] = useState<'idle' | 'enrol' | 'disable' | 'codes'>('idle');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [newCodes, setNewCodes] = useState<string[] | null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MFA_STATUS });
  const disable = useMutation({
    mutationFn: () => authApi.disableMfa({ password, code }),
    onSuccess: () => {
      toast.success('Verificación en dos pasos desactivada');
      setMode('idle');
      refresh();
    },
    onSettled: () => {
      setPassword('');
      setCode('');
    },
  });
  const regenerate = useMutation({
    mutationFn: () => authApi.regenerateRecoveryCodes(code),
    onSuccess: (result) => {
      setNewCodes(result.recoveryCodes);
      refresh();
    },
    onSettled: () => setCode(''),
  });

  const data = status.data;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" /> Verificación en dos pasos
          {data && (
            <Badge variant={data.enabled ? 'success' : 'secondary'}>{data.enabled ? 'Activa' : 'Inactiva'}</Badge>
          )}
        </CardTitle>
        <CardDescription>
          Además de la contraseña, al iniciar sesión se pide un código de una aplicación de autenticación en tu teléfono.
          {data?.required && ' Tu consultorio la exige.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {status.isError && <Alert variant="destructive">No se pudo consultar la verificación en dos pasos.</Alert>}
        {data && !data.enabled && (mode === 'enrol' ? (
          <TwoFactorEnrollment onEnabled={() => setMode('idle')} />
        ) : (
          <Button onClick={() => setMode('enrol')}>
            <KeyRound className="h-4 w-4" /> Configurar
          </Button>
        ))}

        {data?.enabled && (
          <>
            <p className="text-sm text-muted-foreground">
              Te quedan {data.recoveryCodesLeft} códigos de recuperación.
            </p>
            {newCodes && <RecoveryCodes codes={newCodes} />}
            {mode === 'idle' && (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => { setNewCodes(null); setMode('codes'); }}>
                  Nuevos códigos de recuperación
                </Button>
                {!data.required && (
                  <Button variant="outline" onClick={() => setMode('disable')}>
                    Desactivar
                  </Button>
                )}
              </div>
            )}
            {mode !== 'idle' && mode !== 'enrol' && (
              <form
                className="max-w-sm space-y-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (mode === 'disable') disable.mutate();
                  else regenerate.mutate(undefined, { onSuccess: () => setMode('idle') });
                }}
              >
                {mode === 'disable' && (
                  <div>
                    <Label htmlFor="mfa-disable-password">Tu contraseña</Label>
                    <Input
                      id="mfa-disable-password"
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                    />
                  </div>
                )}
                <div>
                  <Label htmlFor="mfa-current-code">Código actual de la aplicación</Label>
                  <Input
                    id="mfa-current-code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={code}
                    onChange={(event) => setCode(cleanCode(event.target.value))}
                  />
                </div>
                {(disable.error || regenerate.error) && (
                  <Alert variant="destructive">
                    {errorMessage(disable.error ?? regenerate.error, 'No se pudo completar la acción.')}
                  </Alert>
                )}
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setMode('idle')}>
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    variant={mode === 'disable' ? 'destructive' : 'default'}
                    disabled={code.length !== 6 || (mode === 'disable' && !password)}
                    loading={disable.isPending || regenerate.isPending}
                  >
                    {mode === 'disable' ? 'Desactivar' : 'Generar códigos'}
                  </Button>
                </div>
              </form>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
