'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSavePlatformPlan, useSectionCatalog } from '@/hooks/usePlatform';
import { platformPlanSchema } from '@/lib/validations/schemas';
import { TenantType, type PlatformPlan, type PlatformPlanInput, type SectionKey } from '@/types';
import { TENANT_TYPE_LABELS } from './labels';
import { SectionChecklist } from './section-checklist';

type NumberField =
  | 'basePrice'
  | 'pricePerSeat'
  | 'specialtyPrice'
  | 'seatsIncluded'
  | 'maxActivePatients'
  | 'storageGB'
  | 'monthlyElectronicInvoicesLimit'
  | 'includedSpecialties'
  | 'trialDays'
  | 'sortOrder';

const NUMBER_FIELDS: { name: NumberField; label: string; step?: string }[] = [
  { name: 'basePrice', label: 'Precio mensual (USD)', step: '0.01' },
  { name: 'pricePerSeat', label: 'Precio por profesional adicional', step: '0.01' },
  { name: 'specialtyPrice', label: 'Precio por especialidad adicional', step: '0.01' },
  { name: 'seatsIncluded', label: 'Profesionales incluidos' },
  { name: 'maxActivePatients', label: 'Pacientes activos' },
  { name: 'storageGB', label: 'Almacenamiento (GB)' },
  { name: 'monthlyElectronicInvoicesLimit', label: 'Facturas electrónicas al mes' },
  { name: 'includedSpecialties', label: 'Especialidades incluidas' },
  { name: 'trialDays', label: 'Días de prueba sugeridos' },
  { name: 'sortOrder', label: 'Orden en las listas' },
];

const blank: Record<NumberField, string> = {
  basePrice: '',
  pricePerSeat: '0',
  specialtyPrice: '15',
  seatsIncluded: '1',
  maxActivePatients: '',
  storageGB: '',
  monthlyElectronicInvoicesLimit: '50',
  includedSpecialties: '1',
  trialDays: '14',
  sortOrder: '0',
};

type Errors = Partial<Record<keyof PlatformPlanInput, string>>;

interface PlanFormDialogProps {
  /** Absent: a new plan. */
  plan?: PlatformPlan;
  onClose: () => void;
}

export function PlanFormDialog({ plan, onClose }: PlanFormDialogProps) {
  const catalog = useSectionCatalog();
  const save = useSavePlatformPlan();
  const [code, setCode] = useState(plan?.code ?? '');
  const [name, setName] = useState(plan?.name ?? '');
  const [description, setDescription] = useState(plan?.description ?? '');
  const [tenantType, setTenantType] = useState<TenantType>(plan?.tenantType ?? TenantType.CLINIC);
  const [numbers, setNumbers] = useState<Record<NumberField, string>>(
    plan
      ? (Object.fromEntries(NUMBER_FIELDS.map(({ name: field }) => [field, String(plan[field])])) as Record<NumberField, string>)
      : blank,
  );
  // null until the admin ticks a box: a new plan starts with the whole catalog once it loads.
  const [chosen, setChosen] = useState<SectionKey[] | null>(plan?.modules ?? null);
  const modules = chosen ?? catalog.data?.sections.map((section) => section.key) ?? [];
  const [errors, setErrors] = useState<Errors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const inUse = (plan?.clinicsCount ?? 0) > 0;

  async function submit() {
    const toNumber = (raw: string) => (raw.trim() === '' ? undefined : Number(raw));
    const parsed = platformPlanSchema.safeParse({
      ...(plan ? {} : { code }),
      name,
      ...(description.trim() ? { description } : {}),
      tenantType,
      ...Object.fromEntries(NUMBER_FIELDS.map(({ name: field }) => [field, toNumber(numbers[field])])),
      modules,
    });
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) next[issue.path[0] as keyof Errors] ??= issue.message;
      setErrors(next);
      return;
    }
    setErrors({});
    setSubmitError(null);
    try {
      await save.mutateAsync({ id: plan?.id, input: parsed.data as PlatformPlanInput });
      onClose();
    } catch (failure) {
      const message = (failure as { message?: unknown } | null)?.message;
      setSubmitError(typeof message === 'string' && message ? message : 'No se pudo guardar el plan');
    }
  }

  const error = (field: keyof Errors) =>
    errors[field] && <p id={`plan-form-${field}-error`} role="alert" className="text-sm text-destructive">{errors[field]}</p>;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{plan ? `Editar ${plan.name}` : 'Nuevo plan'}</DialogTitle>
          <DialogDescription>
            {inUse
              ? `Los cambios se aplican de inmediato a los ${plan!.clinicsCount} consultorio(s) con este plan, salvo los valores y módulos ajustados en cada uno.`
              : 'El plan queda disponible para asignarlo a consultorios del tipo elegido.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="plan-form-code">Código</Label>
              <Input id="plan-form-code" value={code} disabled={!!plan} onChange={(event) => setCode(event.target.value)} placeholder="CLINIC_PRO" aria-invalid={!!errors.code} aria-describedby={errors.code ? 'plan-form-code-error' : undefined} />
              {error('code')}
            </div>
            <div className="space-y-2">
              <Label htmlFor="plan-form-name">Nombre</Label>
              <Input id="plan-form-name" value={name} onChange={(event) => setName(event.target.value)} aria-invalid={!!errors.name} aria-describedby={errors.name ? 'plan-form-name-error' : undefined} />
              {error('name')}
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="plan-form-description">Descripción</Label>
              <Input id="plan-form-description" value={description} onChange={(event) => setDescription(event.target.value)} />
              {error('description')}
            </div>
            <div className="space-y-2">
              <Label htmlFor="plan-form-type">Tipo de consultorio</Label>
              <select id="plan-form-type" className="h-10 w-full rounded-md border px-3" value={tenantType} disabled={inUse} onChange={(event) => setTenantType(event.target.value as TenantType)}>
                {Object.values(TenantType).map((type) => <option key={type} value={type}>{TENANT_TYPE_LABELS[type]}</option>)}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {NUMBER_FIELDS.map(({ name: field, label, step }) => (
              <div key={field} className="space-y-2">
                <Label htmlFor={`plan-form-${field}`}>{label}</Label>
                <Input
                  id={`plan-form-${field}`}
                  type="number"
                  min={0}
                  step={step ?? '1'}
                  value={numbers[field]}
                  onChange={(event) => setNumbers({ ...numbers, [field]: event.target.value })}
                  aria-invalid={!!errors[field]}
                  aria-describedby={errors[field] ? `plan-form-${field}-error` : undefined}
                />
                {error(field)}
              </div>
            ))}
          </div>

          {catalog.isLoading && <p role="status">Cargando módulos…</p>}
          {catalog.isError && <p role="alert">No se pudo cargar el catálogo de módulos.</p>}
          {catalog.data && (
            <SectionChecklist
              catalog={catalog.data.sections}
              value={modules}
              onChange={setChosen}
              disabled={save.isPending}
              legend="Módulos que incluye"
            />
          )}
          {error('modules')}
          {submitError && <p role="alert" className="text-sm text-destructive">{submitError}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="button" loading={save.isPending} onClick={() => void submit()}>
            {plan ? 'Guardar y aplicar' : 'Crear plan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
