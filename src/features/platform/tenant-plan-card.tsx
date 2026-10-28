'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useChangeTenantPlan, usePlatformPlans, useSetPlanOverrides } from '@/hooks/usePlatform';
import { changePlatformPlanSchema } from '@/lib/validations/schemas';
import { formatDate } from '@/lib/utils';
import type { PlanValueField, PlatformTenantDetail, TenantType } from '@/types';
import { PLAN_VALUE_LABELS, formatMoney } from './labels';

interface TenantPlanCardProps {
  tenantId: string;
  tenantType: TenantType;
  subscription: PlatformTenantDetail['subscription'];
  usage: PlatformTenantDetail['usage'];
}

const VALUE_FIELDS: PlanValueField[] = [
  'basePrice',
  'pricePerSeat',
  'specialtyPrice',
  'seatsPsychologistsMax',
  'maxActivePatients',
  'storageGB',
  'monthlyElectronicInvoicesLimit',
  'includedSpecialties',
  'maxBranches',
];
const MONEY_FIELDS: PlanValueField[] = ['basePrice', 'pricePerSeat', 'specialtyPrice'];

const errorMessage = (failure: unknown, fallback: string) => {
  const message = (failure as { message?: unknown } | null)?.message;
  return typeof message === 'string' && message ? message : fallback;
};

export function TenantPlanCard({ tenantId, tenantType, subscription, usage }: TenantPlanCardProps) {
  const [changing, setChanging] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const overridden = new Set(subscription.overriddenFields);
  const show = (field: PlanValueField) => {
    const value = subscription[field] as number;
    return MONEY_FIELDS.includes(field) ? formatMoney(value, subscription.currency) : value;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Plan y uso</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="font-semibold">Plan</dt>
            <dd>{subscription.plan.name}</dd>
          </div>
          <div>
            <dt className="font-semibold">Total mensual</dt>
            <dd>{formatMoney(subscription.monthlyTotal, subscription.currency)}</dd>
          </div>
          {subscription.status === 'TRIALING' && subscription.trialEndsAt && (
            <div>
              <dt className="font-semibold">Prueba hasta</dt>
              <dd>{formatDate(subscription.trialEndsAt, 'PP')}</dd>
            </div>
          )}
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

        <div role="group" aria-labelledby="values-heading" className="space-y-2 border-t pt-4">
          <h3 id="values-heading" className="font-medium">Valores del plan para este consultorio</h3>
          <dl className="grid gap-2 text-sm">
            {VALUE_FIELDS.map((field) => (
              <div key={field} className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">{PLAN_VALUE_LABELS[field]}</dt>
                <dd className="flex items-center gap-2 font-medium">
                  {show(field)}
                  {overridden.has(field) && <Badge variant="warning">Ajustado</Badge>}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => setChanging(true)}>Cambiar plan</Button>
          <Button type="button" variant="outline" onClick={() => setAdjusting(true)}>Ajustar valores</Button>
        </div>
      </CardContent>

      {changing && (
        <ChangePlanDialog
          tenantId={tenantId}
          tenantType={tenantType}
          subscription={subscription}
          onClose={() => setChanging(false)}
        />
      )}
      {adjusting && (
        <AdjustValuesDialog tenantId={tenantId} subscription={subscription} onClose={() => setAdjusting(false)} />
      )}
    </Card>
  );
}

type ChangeErrors = Partial<Record<'planId' | 'trialDays' | 'reason', string>>;

function ChangePlanDialog({
  tenantId,
  tenantType,
  subscription,
  onClose,
}: {
  tenantId: string;
  tenantType: TenantType;
  subscription: PlatformTenantDetail['subscription'];
  onClose: () => void;
}) {
  const plans = usePlatformPlans();
  const changePlan = useChangeTenantPlan(tenantId);
  const [planId, setPlanId] = useState(subscription.plan.id);
  const [trial, setTrial] = useState('');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<ChangeErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const options = (plans.data ?? []).filter(
    (plan) => plan.tenantType === tenantType && (!plan.archivedAt || plan.id === subscription.plan.id),
  );

  async function submit() {
    const parsed = changePlatformPlanSchema.safeParse({
      planId,
      trialDays: trial.trim() === '' ? undefined : Number(trial),
      reason,
    });
    if (!parsed.success) {
      const next: ChangeErrors = {};
      for (const issue of parsed.error.issues) next[issue.path[0] as keyof ChangeErrors] ??= issue.message;
      setErrors(next);
      return;
    }
    setErrors({});
    setSubmitError(null);
    try {
      await changePlan.mutateAsync(parsed.data);
      onClose();
    } catch (failure) {
      setSubmitError(errorMessage(failure, 'No se pudo cambiar el plan'));
    }
  }

  const fieldError = (key: keyof ChangeErrors) =>
    errors[key] && <p id={`plan-${key}-error`} role="alert" className="text-sm text-destructive">{errors[key]}</p>;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cambiar plan</DialogTitle>
          <DialogDescription>
            El consultorio toma el precio, los límites y los módulos del plan. Se descartan los ajustes que tenga. El cambio queda registrado con su motivo.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="plan-id">Plan</Label>
            {plans.isLoading && <p role="status">Cargando planes…</p>}
            {plans.isError && <p role="alert">No se pudieron cargar los planes.</p>}
            <select id="plan-id" className="h-10 w-full rounded-md border px-3" value={planId} onChange={(event) => setPlanId(event.target.value)} aria-invalid={!!errors.planId}>
              {options.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name} · {formatMoney(plan.basePrice, plan.currency)}/mes
                </option>
              ))}
            </select>
            {fieldError('planId')}
          </div>
          <div className="space-y-2">
            <Label htmlFor="plan-trial">Días de prueba</Label>
            <Input id="plan-trial" type="number" min={1} placeholder="Sin prueba: se cobra desde hoy" value={trial} onChange={(event) => setTrial(event.target.value)} aria-invalid={!!errors.trialDays} aria-describedby={errors.trialDays ? 'plan-trialDays-error' : undefined} />
            {fieldError('trialDays')}
          </div>
          <div className="space-y-2">
            <Label htmlFor="plan-reason">Motivo del cambio</Label>
            <Input id="plan-reason" value={reason} onChange={(event) => setReason(event.target.value)} aria-invalid={!!errors.reason} aria-describedby={errors.reason ? 'plan-reason-error' : undefined} />
            {fieldError('reason')}
          </div>
          {submitError && <p role="alert" className="text-sm text-destructive">{submitError}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="button" loading={changePlan.isPending} onClick={() => void submit()}>Aplicar cambio</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AdjustValuesDialog({
  tenantId,
  subscription,
  onClose,
}: {
  tenantId: string;
  subscription: PlatformTenantDetail['subscription'];
  onClose: () => void;
}) {
  const setOverrides = useSetPlanOverrides(tenantId);
  const initiallyOverridden = new Set(subscription.overriddenFields);
  // A field that follows the plan shows its value disabled; unticking it sets the clinic's own.
  const [own, setOwn] = useState<Set<PlanValueField>>(new Set(initiallyOverridden));
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(VALUE_FIELDS.map((field) => [field, String(subscription[field])])),
  );
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  function toggle(field: PlanValueField, followsPlan: boolean) {
    const next = new Set(own);
    if (followsPlan) next.delete(field);
    else next.add(field);
    setOwn(next);
  }

  async function submit() {
    if (!reason.trim()) {
      setError('Indica el motivo del ajuste');
      return;
    }
    const changed: Partial<Record<PlanValueField, number>> = {};
    for (const field of own) {
      const value = Number(values[field]);
      if (values[field].trim() === '' || Number.isNaN(value)) {
        setError(`Ingresa un número para ${PLAN_VALUE_LABELS[field]}`);
        return;
      }
      if (!initiallyOverridden.has(field) || value !== subscription[field]) changed[field] = value;
    }
    const reset = [...initiallyOverridden].filter((field) => !own.has(field));
    if (Object.keys(changed).length === 0 && reset.length === 0) {
      onClose();
      return;
    }
    setError(null);
    try {
      await setOverrides.mutateAsync({ values: changed, reset, reason: reason.trim() });
      onClose();
    } catch (failure) {
      setError(errorMessage(failure, 'No se pudieron guardar los ajustes'));
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajustar valores para este consultorio</DialogTitle>
          <DialogDescription>
            Un valor propio se mantiene aunque edites el plan. Marca «Del plan» para que vuelva a seguirlo.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {VALUE_FIELDS.map((field) => {
            const followsPlan = !own.has(field);
            return (
              <div key={field} role="group" aria-label={PLAN_VALUE_LABELS[field]} className="grid grid-cols-[1fr_7rem_auto] items-center gap-2">
                <Label htmlFor={`value-${field}`}>{PLAN_VALUE_LABELS[field]}</Label>
                <Input
                  id={`value-${field}`}
                  type="number"
                  min={0}
                  step={MONEY_FIELDS.includes(field) ? '0.01' : '1'}
                  value={values[field]}
                  disabled={followsPlan}
                  onChange={(event) => setValues({ ...values, [field]: event.target.value })}
                />
                <label className="flex items-center gap-1 text-xs text-muted-foreground">
                  <input type="checkbox" checked={followsPlan} onChange={(event) => toggle(field, event.target.checked)} />
                  Del plan
                </label>
              </div>
            );
          })}
          <div className="space-y-2">
            <Label htmlFor="adjust-reason">Motivo del ajuste</Label>
            <Input id="adjust-reason" value={reason} onChange={(event) => setReason(event.target.value)} />
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="button" loading={setOverrides.isPending} onClick={() => void submit()}>Guardar ajustes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
