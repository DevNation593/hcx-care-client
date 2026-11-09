'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ApiError } from '@/types';

/** The API asks the password again for every signature: closing, an addendum, a loose record. */
export const SIGNATURE_PASSWORD_INVALID = 'SIGNATURE_PASSWORD_INVALID';

/** The message to show by the field when the API refused the password, or undefined. */
export function signaturePasswordError(error: unknown): string | undefined {
  const apiError = error as ApiError | undefined;
  return apiError?.code === SIGNATURE_PASSWORD_INVALID
    ? apiError.message || 'La contraseña no es correcta.'
    : undefined;
}

/**
 * The password of the professional, typed again to sign. It lives only in the state of the form
 * that shows it, is sent once with the signature and is never stored.
 */
export function SignaturePasswordField({
  id,
  value,
  onChange,
  error,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <Label htmlFor={id}>
        Tu contraseña para firmar<span className="text-destructive"> *</span>
      </Label>
      <Input
        id={id}
        type="password"
        autoComplete="current-password"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : `${id}-help`}
      />
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1 text-sm text-destructive">
          {error}
        </p>
      ) : (
        <p id={`${id}-help`} className="mt-1 text-xs text-muted-foreground">
          Firmar confirma que eres tú: se verifica y no se guarda.
        </p>
      )}
    </div>
  );
}
