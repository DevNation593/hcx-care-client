'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCreatePlatformTenant, useSectionCatalog } from '@/hooks/usePlatform';
import { useSpecialtyCatalog } from '@/hooks/useSpecialties';
import { ROUTES } from '@/lib/constants';
import { createPlatformTenantSchema } from '@/lib/validations/schemas';
import { TenantBusinessKind, TenantType, type ApiPlanType, type CreatePlatformTenantInput, type SectionKey } from '@/types';
import { generatePassword } from './generate-password';
import { PLAN_LABELS } from './labels';
import { SectionChecklist } from './section-checklist';
import { TemporaryPasswordNotice } from './temporary-password-notice';

const PLANS_BY_TYPE: Record<TenantType, ApiPlanType[]> = {
  [TenantType.PERSONAL]: ['TRIAL', 'PERSONAL_BASIC', 'PERSONAL_PRO'],
  [TenantType.CLINIC]: ['TRIAL', 'CLINIC_BASIC', 'CLINIC_PRO', 'CLINIC_ENTERPRISE'],
};

const TYPE_LABELS: Record<TenantType, string> = {
  [TenantType.PERSONAL]: 'Personal',
  [TenantType.CLINIC]: 'Consultorio',
};

const DEFAULT_VALUES: CreatePlatformTenantInput = {
  name: '',
  email: '',
  phone: '',
  address: '',
  tenantType: TenantType.CLINIC,
  businessKind: TenantBusinessKind.MEDICAL,
  timezone: 'America/Guayaquil',
  locale: 'es',
  masterFirstName: '',
  masterLastName: '',
  masterEmail: '',
  temporaryPassword: '',
  planType: 'TRIAL',
  specialtyCodes: [],
  sections: [],
};

const sameKeys = (a: SectionKey[], b: SectionKey[]) => a.length === b.length && a.every((key) => b.includes(key));

type FieldName = Exclude<keyof CreatePlatformTenantInput, 'specialtyCodes' | 'sections'>;

/** The temporary password lives only here, in component state, until the admin leaves the notice. */
interface CreatedTenant {
  id: string;
  email: string;
  password: string;
}

export function CreateTenantForm() {
  const router = useRouter();
  const sectionCatalog = useSectionCatalog();
  const specialties = useSpecialtyCatalog();
  const createTenant = useCreatePlatformTenant();
  const [created, setCreated] = useState<CreatedTenant | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [pendingDefaults, setPendingDefaults] = useState<SectionKey[] | null>(null);
  // True once the admin ticks a box by hand: plan changes then ask before replacing it.
  const sectionsEdited = useRef(false);
  const preselected = useRef(false);

  const { register, watch, setValue, reset, handleSubmit, formState: { errors } } = useForm<CreatePlatformTenantInput>({
    resolver: zodResolver(createPlatformTenantSchema),
    defaultValues: DEFAULT_VALUES,
  });
  const tenantType = watch('tenantType');
  const businessKind = watch('businessKind');
  const planType = watch('planType');
  const sections = watch('sections') ?? [];
  const specialtyCodes = watch('specialtyCodes');

  const defaultsFor = (type: TenantType, plan: ApiPlanType, kind: TenantBusinessKind): SectionKey[] =>
    sectionCatalog.data?.defaults.find((entry) =>
      entry.tenantType === type && entry.planType === plan && (entry.businessKind ?? TenantBusinessKind.MEDICAL) === kind,
    )?.sections ?? [];

  useEffect(() => {
    if (!sectionCatalog.data || preselected.current) return;
    preselected.current = true;
    setValue('sections', defaultsFor(DEFAULT_VALUES.tenantType, DEFAULT_VALUES.planType, DEFAULT_VALUES.businessKind));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionCatalog.data, setValue]);

  function applySections(next: SectionKey[]) {
    setValue('sections', next);
    sectionsEdited.current = false;
    setPendingDefaults(null);
  }

  function changePlan(type: TenantType, plan: ApiPlanType) {
    setValue('tenantType', type);
    setValue('planType', plan);
    const defaults = defaultsFor(type, plan, businessKind);
    if (!sectionsEdited.current) applySections(defaults);
    else if (!sameKeys(defaults, sections)) setPendingDefaults(defaults);
  }

  function changeType(type: TenantType) {
    changePlan(type, PLANS_BY_TYPE[type].includes(planType) ? planType : 'TRIAL');
  }

  function changeBusinessKind(kind: TenantBusinessKind) {
    setValue('businessKind', kind);
    setValue('specialtyCodes', [], { shouldValidate: true });
    applySections(defaultsFor(tenantType, planType, kind));
  }

  function toggleSpecialty(code: string, checked: boolean) {
    const next = checked ? [...specialtyCodes, code] : specialtyCodes.filter((value) => value !== code);
    setValue('specialtyCodes', next, { shouldValidate: true });
  }

  const submit = handleSubmit(async (values) => {
    setSubmitError(null);
    const { phone, address, ...rest } = values;
    const payload: CreatePlatformTenantInput = {
      ...rest,
      ...(phone ? { phone } : {}),
      ...(address ? { address } : {}),
    };
    try {
      const result = await createTenant.mutateAsync(payload);
      setCreated({ id: result.tenant.id, email: payload.masterEmail, password: payload.temporaryPassword });
      createTenant.reset(); // drops the mutation (and its variables) from the mutation cache
      setShowPassword(false);
      sectionsEdited.current = false;
      reset({ ...DEFAULT_VALUES, sections: defaultsFor(DEFAULT_VALUES.tenantType, DEFAULT_VALUES.planType, DEFAULT_VALUES.businessKind) });
    } catch (error) {
      const message = (error as { message?: unknown } | null)?.message;
      createTenant.reset(); // a failed mutation would keep the password in its variables
      setSubmitError(typeof message === 'string' && message ? message : 'No se pudo crear el consultorio');
    }
  });

  if (created) {
    return (
      <TemporaryPasswordNotice
        email={created.email}
        password={created.password}
        onDone={() => {
          const { id } = created;
          setCreated(null);
          router.push(ROUTES.PLATFORM_TENANT_DETAIL(id));
        }}
      />
    );
  }

  const field = (name: FieldName, label: string, type = 'text') => (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} type={type} aria-invalid={!!errors[name]} aria-describedby={errors[name] ? `${name}-error` : undefined} {...register(name)} />
      {errors[name] && <p id={`${name}-error`} role="alert" className="text-sm text-destructive">{errors[name]?.message}</p>}
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Datos del consultorio</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={(event) => void submit(event)} className="space-y-6" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            {field('name', 'Nombre del consultorio')}
            {field('email', 'Correo del consultorio', 'email')}
            {field('phone', 'Teléfono', 'tel')}
            {field('address', 'Dirección')}
            {field('timezone', 'Zona horaria')}
            <div className="space-y-2">
              <Label htmlFor="locale">Idioma</Label>
              <select id="locale" className="h-10 w-full rounded-md border px-3" {...register('locale')}>
                <option value="es">Español</option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="businessKind">Tipo de negocio</Label>
              <select id="businessKind" className="h-10 w-full rounded-md border px-3" value={businessKind} onChange={(event) => changeBusinessKind(event.target.value as TenantBusinessKind)}>
                <option value={TenantBusinessKind.MEDICAL}>Consultorio médico</option>
                <option value={TenantBusinessKind.AESTHETIC_STUDIO}>Estudio estético</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tenantType">Tipo de consultorio</Label>
              <select id="tenantType" className="h-10 w-full rounded-md border px-3" value={tenantType} onChange={(event) => changeType(event.target.value as TenantType)}>
                {Object.values(TenantType).map((type) => <option key={type} value={type}>{TYPE_LABELS[type]}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="planType">Plan</Label>
              <select id="planType" className="h-10 w-full rounded-md border px-3" value={planType} onChange={(event) => changePlan(tenantType, event.target.value as ApiPlanType)}>
                {PLANS_BY_TYPE[tenantType].map((plan) => <option key={plan} value={plan}>{PLAN_LABELS[plan]}</option>)}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {field('masterFirstName', 'Nombre del titular')}
            {field('masterLastName', 'Apellido del titular')}
            {field('masterEmail', 'Correo del titular', 'email')}
            <div className="space-y-2">
              <Label htmlFor="temporaryPassword">Contraseña temporal</Label>
              <div className="flex gap-2">
                <Input
                  id="temporaryPassword"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  aria-invalid={!!errors.temporaryPassword}
                  aria-describedby={errors.temporaryPassword ? 'temporaryPassword-error' : undefined}
                  {...register('temporaryPassword')}
                />
                <Button type="button" variant="outline" onClick={() => setValue('temporaryPassword', generatePassword(), { shouldValidate: true })}>Generar</Button>
                <Button type="button" variant="outline" onClick={() => setShowPassword((shown) => !shown)}>{showPassword ? 'Ocultar' : 'Mostrar'}</Button>
              </div>
              {errors.temporaryPassword && <p id="temporaryPassword-error" role="alert" className="text-sm text-destructive">{errors.temporaryPassword.message}</p>}
            </div>
          </div>

          {businessKind === TenantBusinessKind.MEDICAL && <fieldset className="space-y-2" aria-describedby={errors.specialtyCodes ? 'specialtyCodes-error' : undefined}>
            <legend className="font-medium">Especialidades</legend>
            {specialties.isLoading && <p role="status">Cargando especialidades…</p>}
            {specialties.isError && <p role="alert">No se pudieron cargar las especialidades.</p>}
            {specialties.data?.map((item) => (
              <label key={item.id} className="flex cursor-pointer items-center gap-3 rounded-md border p-3">
                <input type="checkbox" checked={specialtyCodes.includes(item.code)} onChange={(event) => toggleSpecialty(item.code, event.target.checked)} />
                {item.name}
              </label>
            ))}
            {errors.specialtyCodes && <p id="specialtyCodes-error" role="alert" className="text-sm text-destructive">{errors.specialtyCodes.message}</p>}
          </fieldset>}

          {sectionCatalog.isLoading && <p role="status">Cargando secciones…</p>}
          {sectionCatalog.isError && <p role="alert">No se pudo cargar el catálogo de secciones.</p>}
          {sectionCatalog.data && (
            <SectionChecklist
              catalog={sectionCatalog.data.sections.filter((section) => businessKind === TenantBusinessKind.AESTHETIC_STUDIO
                ? ['core.aesthetics', 'core.team'].includes(section.key)
                : section.key !== 'core.aesthetics')}
              value={sections}
              onChange={(next) => {
                sectionsEdited.current = true;
                setValue('sections', next);
              }}
              disabled={createTenant.isPending}
            />
          )}

          {submitError && <p role="alert" className="text-sm text-destructive">{submitError}</p>}

          <Button type="submit" loading={createTenant.isPending} disabled={!sectionCatalog.data}>Crear consultorio</Button>
        </form>
      </CardContent>

      <Dialog open={pendingDefaults !== null} onOpenChange={(open) => { if (!open) setPendingDefaults(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Reemplazar la selección de secciones?</DialogTitle>
            <DialogDescription>Editaste las secciones a mano. El plan elegido trae otra selección por defecto.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPendingDefaults(null)}>Conservar mi selección</Button>
            <Button type="button" onClick={() => pendingDefaults && applySections(pendingDefaults)}>Reemplazar selección</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
