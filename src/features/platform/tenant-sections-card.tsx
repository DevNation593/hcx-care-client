'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePlatformPlans, useSectionCatalog, useSetTenantSections } from '@/hooks/usePlatform';
import type { PlatformTenantDetail, SectionKey } from '@/types';
import { planDefaults } from './plan-defaults';
import { SectionChecklist } from './section-checklist';

const sameKeys = (a: SectionKey[], b: SectionKey[]) => a.length === b.length && a.every((key) => b.includes(key));

interface TenantSectionsCardProps {
  tenantId: string;
  planId: string;
  specialtyCodes: string[];
  sections: PlatformTenantDetail['sections'];
}

export function TenantSectionsCard({ tenantId, planId, specialtyCodes, sections }: TenantSectionsCardProps) {
  const catalog = useSectionCatalog();
  const plans = usePlatformPlans();
  const setSections = useSetTenantSections(tenantId);
  // null until the admin edits: the saved selection is then shown as it comes from the API.
  const [draft, setDraft] = useState<SectionKey[] | null>(null);
  const saved = sections.filter((section) => section.enabled).map((section) => section.key);
  const value = draft ?? saved;
  const dirty = draft !== null && !sameKeys(draft, saved);
  const overridden = sections.filter((section) => section.source === 'OVERRIDE').map((section) => section.key);
  const planModules = plans.data?.find((plan) => plan.id === planId)?.modules;
  const defaults = catalog.data && planModules ? planDefaults(planModules, catalog.data, specialtyCodes) : null;

  async function save(next: SectionKey[]) {
    try {
      await setSections.mutateAsync(next);
      setDraft(null);
    } catch {
      // The error is shown below; the draft stays so nothing is lost.
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Módulos y submódulos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Siguen al plan del consultorio. Lo que cambies aquí queda como ajuste de este consultorio y se mantiene aunque edites el plan.
        </p>
        {catalog.isLoading && <p role="status">Cargando módulos…</p>}
        {catalog.isError && <p role="alert">No se pudo cargar el catálogo de módulos.</p>}
        {catalog.data && (
          <SectionChecklist
            catalog={catalog.data.sections}
            value={value}
            onChange={setDraft}
            disabled={setSections.isPending}
            overridden={draft === null ? overridden : undefined}
          />
        )}
        {setSections.isError && <p role="alert" className="text-sm text-destructive">{setSections.error.message}</p>}
        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={!dirty} loading={setSections.isPending} onClick={() => void save(value)}>Guardar cambios</Button>
          {overridden.length > 0 && defaults && (
            <Button type="button" variant="outline" disabled={setSections.isPending} onClick={() => void save(defaults)}>
              Volver al plan
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
