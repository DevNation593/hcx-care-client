'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useChangeTenantPlan } from '@/hooks/usePlatform';
import { changePlatformPlanSchema } from '@/lib/validations/schemas';
import { TenantType, type ApiPlanType, type PlatformTenantDetail } from '@/types';
import { PLAN_LABELS } from './labels';

const PLANS_BY_TYPE: Record<TenantType, ApiPlanType[]> = {
  [TenantType.PERSONAL]: ['TRIAL', 'PERSONAL_BASIC', 'PERSONAL_PRO'],
  [TenantType.CLINIC]: ['TRIAL', 'CLINIC_BASIC', 'CLINIC_PRO', 'CLINIC_ENTERPRISE'],
};

interface TenantPlanCardProps {
  tenantId: string;
  tenantType: TenantType;
  subscription: PlatformTenantDetail['subscription'];
  usage: PlatformTenantDetail['usage'];
}

type FieldErrors = Partial<Record<'seatsPsychologistsMax' | 'maxActivePatients' | 'reason', string>>;

/** Blank means "keep the limit of the plan"; anything else must be a whole number. */
const parseLimit = (raw: string) => (raw.trim() === '' ? undefined : Number(raw));

export function TenantPlanCard({ tenantId, tenantType, subscription, usage }: TenantPlanCardProps) {
  const changePlan = useChangeTenantPlan(tenantId);
  const [open, setOpen] = useState(false);
  const [planType, setPlanType] = useState<ApiPlanType>(subscription.planType);
  const [seats, setSeats] = useState('');
  const [patients, setPatients] = useState('');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  function openDialog() {
    setPlanType(subscription.planType);
    setSeats('');
    setPatients('');
    setReason('');
    setErrors({});
    setSubmitError(null);
    setOpen(true);
  }

  async function submit() {
    const parsed = changePlatformPlanSchema.safeParse({
      planType,
      seatsPsychologistsMax: parseLimit(seats),
      maxActivePatients: parseLimit(patients),
      reason,
    });
    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FieldErrors;
        next[key] ??= issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setSubmitError(null);
    try {
      await changePlan.mutateAsync(parsed.data);
      setOpen(false);
    } catch (failure) {
      const message = (failure as { message?: unknown } | null)?.message;
      setSubmitError(typeof message === 'string' && message ? message : 'No se pudo cambiar el plan');
    }
  }

  const fieldError = (key: keyof FieldErrors) =>
    errors[key] && <p id={`plan-${key}-error`} role="alert" className="text-sm text-destructive">{errors[key]}</p>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Plan y uso</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl>
          <div>
            <dt className="font-semibold">Plan</dt>
            <dd>{PLAN_LABELS[subscription.planType]}</dd>
          </div>
        </dl>

        <div role="group" aria-labelledby="usage-heading" className="space-y-2">
          <h3 id="usage-heading" className="sr-only">Uso</h3>
          <dl className="grid gap-3 sm:grid-cols-3">
            <div>
              <dt className="font-semibold">Profesionales en uso</dt>
              <dd>{usage.seatsPsychologistsUsed} de {subscription.seatsPsychologistsMax}</dd>
            </div>
            <div>
              <dt className="font-semibold">Pacientes activos</dt>
              <dd>{usage.activePatientsCount} de {subscription.maxActivePatients}</dd>
            </div>
            <div>
              <dt className="font-semibold">Notificaciones del mes</dt>
              <dd>{usage.monthlyNotificationsSent}</dd>
            </div>
          </dl>
        </div>

        <Button type="button" variant="outline" onClick={openDialog}>Cambiar plan</Button>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cambiar plan</DialogTitle>
            <DialogDescription>Deja los límites en blanco para usar los del plan. El cambio queda registrado con su motivo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="plan-type">Plan</Label>
              <select id="plan-type" className="h-10 w-full rounded-md border px-3" value={planType} onChange={(event) => setPlanType(event.target.value as ApiPlanType)}>
                {PLANS_BY_TYPE[tenantType].map((plan) => <option key={plan} value={plan}>{PLAN_LABELS[plan]}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="plan-seats">Cupos de profesionales</Label>
              <Input id="plan-seats" type="number" min={1} placeholder="Según el plan" value={seats} onChange={(event) => setSeats(event.target.value)} aria-invalid={!!errors.seatsPsychologistsMax} aria-describedby={errors.seatsPsychologistsMax ? 'plan-seatsPsychologistsMax-error' : undefined} />
              {fieldError('seatsPsychologistsMax')}
            </div>
            <div className="space-y-2">
              <Label htmlFor="plan-patients">Pacientes activos máximos</Label>
              <Input id="plan-patients" type="number" min={1} placeholder="Según el plan" value={patients} onChange={(event) => setPatients(event.target.value)} aria-invalid={!!errors.maxActivePatients} aria-describedby={errors.maxActivePatients ? 'plan-maxActivePatients-error' : undefined} />
              {fieldError('maxActivePatients')}
            </div>
            <div className="space-y-2">
              <Label htmlFor="plan-reason">Motivo del cambio</Label>
              <Input id="plan-reason" value={reason} onChange={(event) => setReason(event.target.value)} aria-invalid={!!errors.reason} aria-describedby={errors.reason ? 'plan-reason-error' : undefined} />
              {fieldError('reason')}
            </div>
            {submitError && <p role="alert" className="text-sm text-destructive">{submitError}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="button" loading={changePlan.isPending} onClick={() => void submit()}>Aplicar cambio</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
