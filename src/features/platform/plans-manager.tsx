'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { usePlatformPlans, useSetPlanArchived } from '@/hooks/usePlatform';
import { TenantType, type PlatformPlan } from '@/types';
import { TENANT_TYPE_LABELS, formatMoney } from './labels';
import { PlanFormDialog } from './plan-form-dialog';

/** 999 seats and 999999 patients read as "no practical limit", as in the default plans. */
const limit = (value: number, unlimitedFrom: number) => (value >= unlimitedFrom ? 'Sin límite' : value);

export function PlansManager() {
  const plans = usePlatformPlans();
  const archive = useSetPlanArchived();
  // undefined: no dialog; null: a new plan.
  const [editing, setEditing] = useState<PlatformPlan | null | undefined>(undefined);

  if (plans.isLoading) return <p role="status">Cargando planes…</p>;
  if (plans.isError) {
    return (
      <div className="space-y-3">
        <p role="alert">No se pudieron cargar los planes.</p>
        <Button type="button" variant="outline" onClick={() => void plans.refetch()}>Reintentar</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Al editar un plan, todos sus consultorios toman el nuevo precio, límites y módulos al instante, salvo lo ajustado en cada uno.
        </p>
        <Button type="button" onClick={() => setEditing(null)}>Nuevo plan</Button>
      </div>
      {archive.isError && <p role="alert" className="text-sm text-destructive">{archive.error.message}</p>}

      {Object.values(TenantType).map((type) => {
        const rows = (plans.data ?? []).filter((plan) => plan.tenantType === type);
        return (
          <Card key={type}>
            <CardHeader>
              <CardTitle>Planes {TENANT_TYPE_LABELS[type]}</CardTitle>
            </CardHeader>
            <CardContent>
              {rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin planes de este tipo.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Plan</TableHead>
                      <TableHead>Precio</TableHead>
                      <TableHead>Profesionales</TableHead>
                      <TableHead>Pacientes</TableHead>
                      <TableHead>GB</TableHead>
                      <TableHead>Módulos</TableHead>
                      <TableHead>Consultorios</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((plan) => (
                      <TableRow key={plan.id} className={plan.archivedAt ? 'opacity-60' : undefined}>
                        <TableCell>
                          <p className="font-medium">{plan.name}</p>
                          <p className="text-xs text-muted-foreground">{plan.code}</p>
                          {plan.archivedAt && <Badge variant="secondary">Archivado</Badge>}
                        </TableCell>
                        <TableCell>{plan.basePrice > 0 ? `${formatMoney(plan.basePrice, plan.currency)}/mes` : 'A medida'}</TableCell>
                        <TableCell>{limit(plan.seatsIncluded, 999)}</TableCell>
                        <TableCell>{limit(plan.maxActivePatients, 999999)}</TableCell>
                        <TableCell>{plan.storageGB}</TableCell>
                        <TableCell>{plan.modules.length}</TableCell>
                        <TableCell>{plan.clinicsCount}</TableCell>
                        <TableCell className="space-x-2 text-right">
                          <Button type="button" variant="outline" size="sm" onClick={() => setEditing(plan)} aria-label={`Editar ${plan.name}`}>Editar</Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={archive.isPending}
                            onClick={() => archive.mutate({ id: plan.id, archived: !plan.archivedAt })}
                            aria-label={`${plan.archivedAt ? 'Restaurar' : 'Archivar'} ${plan.name}`}
                          >
                            {plan.archivedAt ? 'Restaurar' : 'Archivar'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        );
      })}

      {editing !== undefined && (
        <PlanFormDialog key={editing?.id ?? 'new'} plan={editing ?? undefined} onClose={() => setEditing(undefined)} />
      )}
    </div>
  );
}
