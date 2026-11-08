'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Store } from 'lucide-react';
import { toast } from 'sonner';
import type { z } from 'zod';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useClinicProfile, useUpdateClinicProfile } from '@/hooks/useClinicProfile';
import { clinicProfileSchema } from '@/lib/validations/schemas';

type ClinicProfileValues = z.infer<typeof clinicProfileSchema>;

const FIELDS: {
  name: keyof ClinicProfileValues;
  label: string;
  type?: string;
  required?: boolean;
  wide?: boolean;
}[] = [
  { name: 'name', label: 'Nombre del consultorio', required: true },
  { name: 'email', label: 'Correo de contacto', type: 'email', required: true },
  { name: 'phone', label: 'Teléfono', type: 'tel' },
  { name: 'address', label: 'Dirección', wide: true },
];

/** The clinic's own name and contact data, editable by the account holder. */
export function ClinicProfileCard() {
  const profile = useClinicProfile();
  const update = useUpdateClinicProfile();
  const tenant = profile.data;
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ClinicProfileValues>({
    resolver: zodResolver(clinicProfileSchema),
    values: tenant
      ? { name: tenant.name ?? '', email: tenant.email ?? '', phone: tenant.phone ?? '', address: tenant.address ?? '' }
      : undefined,
  });

  const submit = handleSubmit((values) => {
    update.reset();
    update.mutate(values, {
      onSuccess: () => {
        reset(values);
        toast.success('Datos del consultorio actualizados');
      },
    });
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Store className="h-5 w-5" />
          Datos del consultorio
        </CardTitle>
        <CardDescription>
          Nombre y datos de contacto que ven tus pacientes en correos, recordatorios y documentos.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {profile.isError ? (
          <Alert variant="destructive" title="No se pudieron cargar los datos del consultorio">
            <Button variant="outline" size="sm" className="mt-2" onClick={() => void profile.refetch()}>
              Reintentar
            </Button>
          </Alert>
        ) : profile.isPending ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <form onSubmit={(event) => void submit(event)} noValidate className="space-y-4">
            {/* Locked while saving: the form resets to what was sent, so an edit typed meanwhile would be lost. */}
            <fieldset disabled={update.isPending} className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {FIELDS.map(({ name, label, type, required, wide }) => (
                <div key={name} className={wide ? 'md:col-span-2' : undefined}>
                  <Label htmlFor={`clinic-${name}`} required={required}>
                    {label}
                  </Label>
                  <Input
                    id={`clinic-${name}`}
                    type={type ?? 'text'}
                    aria-invalid={!!errors[name]}
                    aria-describedby={errors[name] ? `clinic-${name}-error` : undefined}
                    {...register(name)}
                  />
                  {errors[name] && (
                    <p id={`clinic-${name}-error`} role="alert" className="mt-1 text-sm text-destructive">
                      {errors[name]?.message}
                    </p>
                  )}
                </div>
              ))}
            </fieldset>
            {update.isError && (
              <p role="alert" className="text-sm text-destructive">
                {update.error.message || 'No se pudieron guardar los datos del consultorio'}
              </p>
            )}
            <div className="flex justify-end">
              <Button type="submit" disabled={!isDirty} loading={update.isPending}>
                Guardar datos
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
