'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { describeModule } from '@/features/admin/specialties/module-labels';
import { platformApi } from '@/lib/api/endpoints';
import { QUERY_KEYS } from '@/lib/constants';
import type { PlatformTenantDetail } from '@/types';

export function TenantClinicalModulesCard({ tenantId, detail }: { tenantId: string; detail: PlatformTenantDetail }) {
  const client = useQueryClient();
  const catalog = useQuery({ queryKey: ['platform', 'specialty-catalog'], queryFn: platformApi.getSpecialtyCatalog });
  const saved = detail.specialties.map((specialty) => specialty.code);
  const [draft, setDraft] = useState<string[] | null>(null);
  const selected = draft ?? saved;
  const dirty = selected.length !== saved.length || selected.some((code) => !saved.includes(code));
  const specialties = useMutation({
    mutationFn: (codes: string[]) => platformApi.setSpecialties(tenantId, codes),
    onSuccess: async () => {
      setDraft(null);
      await client.invalidateQueries({ queryKey: QUERY_KEYS.PLATFORM_TENANT(tenantId) });
    },
  });
  const modules = useMutation({
    mutationFn: ({ key, enabled }: { key: string; enabled: boolean }) => platformApi.setClinicalModule(tenantId, key, enabled),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: QUERY_KEYS.PLATFORM_TENANT(tenantId) }); },
  });
  const activeCatalog = (catalog.data ?? []).filter((item) => saved.includes(item.code));
  const inactiveAssigned = catalog.data
    ? detail.specialties.filter((specialty) => !catalog.data.some((item) => item.code === specialty.code))
    : [];
  const hasInactiveSelected = inactiveAssigned.some((specialty) => selected.includes(specialty.code));
  const { basePrice, includedSpecialties, specialtyPrice, currency } = detail.subscription;
  // The plan price plus the specialties beyond the ones it includes.
  const nextExtras = Math.max(0, selected.length - includedSpecialties);
  const estimatedTotal = basePrice + nextExtras * specialtyPrice;
  const formattedTotal = new Intl.NumberFormat('es-EC', { style: 'currency', currency }).format(estimatedTotal);

  return (
    <Card>
      <CardHeader><CardTitle>Especialidades y módulos clínicos</CardTitle></CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-muted-foreground">Selecciona las especialidades contratadas y los módulos que puede usar el consultorio.</p>
        {catalog.isLoading && <p role="status">Cargando especialidades…</p>}
        {catalog.isError && <p role="alert">No se pudo cargar el catálogo de especialidades.</p>}
        {catalog.data && (
          <fieldset className="space-y-2">
            <legend className="font-medium">Especialidades</legend>
            {catalog.data.map((item) => (
              <label key={item.code} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={selected.includes(item.code)} disabled={specialties.isPending} onChange={(event) => setDraft(event.target.checked ? [...selected, item.code] : selected.filter((code) => code !== item.code))} />
                {item.name}
              </label>
            ))}
            {inactiveAssigned.map((specialty) => (
              <label key={specialty.code} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={selected.includes(specialty.code)} disabled={specialties.isPending} onChange={() => setDraft(selected.filter((code) => code !== specialty.code))} />
                {specialty.name} (inactiva)
              </label>
            ))}
          </fieldset>
        )}
        {hasInactiveSelected && <p className="text-sm text-muted-foreground">Retira las especialidades inactivas antes de guardar cambios.</p>}
        {specialties.isError && <p role="alert" className="text-sm text-destructive">{specialties.error.message}</p>}
        {dirty && !hasInactiveSelected && <p className="text-sm font-medium">Total mensual estimado: {formattedTotal}</p>}
        <Button type="button" disabled={!dirty || selected.length === 0 || hasInactiveSelected || specialties.isPending} loading={specialties.isPending} onClick={() => specialties.mutate(selected)}>Guardar especialidades</Button>
        <div className="space-y-3 border-t pt-4">
          <h3 className="font-medium">Módulos de las especialidades asignadas</h3>
          {activeCatalog.length === 0 && <p className="text-sm text-muted-foreground">No hay módulos clínicos asignados.</p>}
          {activeCatalog.map((item) => (
            <div key={item.code} className="space-y-2">
              <p className="text-sm font-medium">{item.name}</p>
              {item.modules.map((module) => {
                const state = detail.modules.find((row) => row.key === module.moduleKey);
                return (
                  <label key={module.moduleKey} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={state?.enabled ?? false} disabled={!state || modules.isPending || dirty} onChange={(event) => modules.mutate({ key: module.moduleKey, enabled: event.target.checked })} />
                    {describeModule(module.moduleKey).name}
                  </label>
                );
              })}
            </div>
          ))}
          {modules.isError && <p role="alert" className="text-sm text-destructive">{modules.error.message}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
