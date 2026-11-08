'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ContactInfo } from '@/content/site';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { demoRequestApi } from '@/lib/api/endpoints';
import type { ApiError } from '@/types';
import { TEAM_SIZES, demoRequestSchema, type DemoRequest } from './demo-request';

function submitError(failure: unknown): string {
  if ((failure as ApiError | null)?.status === 429) {
    return 'Recibimos varias solicitudes desde tu conexión. Intenta de nuevo en unos minutos.';
  }
  return 'No pudimos enviar tu solicitud. Revisa tu conexión e inténtalo otra vez.';
}

export function DemoRequestForm({ contact }: { contact: ContactInfo }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<DemoRequest>({
    resolver: zodResolver(demoRequestSchema),
    defaultValues: {
      name: '', clinic: '', email: '', phone: '', teamSize: '', message: '', acceptPrivacy: false, website: '',
    },
  });

  const onSubmit = async ({ message, website, ...data }: DemoRequest) => {
    setError(null);
    try {
      await demoRequestApi.create({
        ...data,
        ...(message ? { message } : {}),
        ...(website ? { website } : {}),
      });
      router.push('/gracias');
    } catch (failure) {
      // The typed form stays as it is so the visitor can try again.
      setError(submitError(failure));
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="demo-name">Nombre</Label>
          <Input id="demo-name" autoComplete="name" maxLength={120} {...register('name')} error={errors.name?.message} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="demo-clinic">Consultorio o clínica</Label>
          <Input id="demo-clinic" autoComplete="organization" maxLength={160} {...register('clinic')} error={errors.clinic?.message} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="demo-email">Correo electrónico</Label>
          <Input id="demo-email" type="email" autoComplete="email" maxLength={254} {...register('email')} error={errors.email?.message} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="demo-phone">Teléfono</Label>
          <Input id="demo-phone" type="tel" autoComplete="tel" maxLength={30} {...register('phone')} error={errors.phone?.message} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="demo-team">Tamaño del equipo</Label>
        <select
          id="demo-team"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          aria-invalid={!!errors.teamSize}
          {...register('teamSize')}
        >
          <option value="">Seleccionar</option>
          {TEAM_SIZES.map((size) => (
            <option key={size} value={size}>
              {size === '1' ? '1 profesional' : `${size} profesionales`}
            </option>
          ))}
        </select>
        {errors.teamSize && <p role="alert" className="text-sm text-destructive">{errors.teamSize.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="demo-message">Mensaje (opcional)</Label>
        <Textarea
          id="demo-message"
          maxLength={500}
          placeholder="Cuéntanos qué especialidades atienden o qué te gustaría ver en la demo"
          {...register('message')}
        />
        {errors.message && <p role="alert" className="text-sm text-destructive">{errors.message.message}</p>}
      </div>

      {/* Honeypot: off-screen and out of the tab order, so only bots fill it in. */}
      <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
        <label htmlFor="demo-website">Sitio web</label>
        <input id="demo-website" type="text" tabIndex={-1} autoComplete="off" {...register('website')} />
      </div>

      <div className="space-y-1">
        <div className="flex items-start gap-2">
          <input id="demo-privacy" type="checkbox" className="mt-1 h-4 w-4 rounded border-input" {...register('acceptPrivacy')} />
          <label htmlFor="demo-privacy" className="text-sm">
            Acepto la{' '}
            {/* Opens in a new tab so the typed form is not lost. */}
            <Link href="/privacidad" target="_blank" className="text-primary underline">política de privacidad</Link>
          </label>
        </div>
        {errors.acceptPrivacy && <p role="alert" className="text-sm text-destructive">{errors.acceptPrivacy.message}</p>}
      </div>

      {error && (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
          {error}
        </p>
      )}

      <Button type="submit" size="lg" className="w-full sm:w-auto" loading={isSubmitting}>
        Solicitar demo
      </Button>
      <p className="text-sm text-muted-foreground">{contact.responseTime}</p>
    </form>
  );
}
