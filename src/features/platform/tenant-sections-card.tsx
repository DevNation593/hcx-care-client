'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSectionCatalog, useSetTenantSections } from '@/hooks/usePlatform';
import { TenantBusinessKind, type PlatformTenantDetail, type SectionKey } from '@/types';
import { SectionChecklist } from './section-checklist';

const sameKeys = (a: SectionKey[], b: SectionKey[]) => a.length === b.length && a.every((key) => b.includes(key));

interface TenantSectionsCardProps {
  tenantId: string;
  sections: PlatformTenantDetail['sections'];
  businessKind?: TenantBusinessKind;
}

export function TenantSectionsCard({ tenantId, sections, businessKind = TenantBusinessKind.MEDICAL }: TenantSectionsCardProps) {
  const catalog = useSectionCatalog();
  const setSections = useSetTenantSections(tenantId);
  const allowed = (key: SectionKey) => businessKind === TenantBusinessKind.AESTHETIC_STUDIO
    ? key === 'core.aesthetics' || key === 'core.team'
    : key !== 'core.aesthetics';
  // null until the admin edits: the saved selection is then shown as it comes from the API.
  const [draft, setDraft] = useState<SectionKey[] | null>(null);
  const saved = sections.filter((section) => section.enabled && allowed(section.key)).map((section) => section.key);
  const hasInvalidEnabled = sections.some((section) => section.enabled && !allowed(section.key));
  const value = draft ?? saved;
  const dirty = hasInvalidEnabled || (draft !== null && !sameKeys(draft, saved));

  async function save() {
    try {
      await setSections.mutateAsync(value);
      setDraft(null);
    } catch {
      // The error is shown below; the draft stays so nothing is lost.
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Secciones</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {catalog.isLoading && <p role="status">Cargando secciones…</p>}
        {catalog.isError && <p role="alert">No se pudo cargar el catálogo de secciones.</p>}
        {catalog.data && (
          <SectionChecklist catalog={catalog.data.sections.filter((section) => allowed(section.key))} value={value} onChange={setDraft} disabled={setSections.isPending} />
        )}
        {setSections.isError && <p role="alert" className="text-sm text-destructive">{setSections.error.message}</p>}
        {hasInvalidEnabled && <p role="alert" className="text-sm text-destructive">Hay secciones incompatibles activadas. Guarda para corregirlas.</p>}
        <Button type="button" disabled={!dirty} loading={setSections.isPending} onClick={() => void save()}>Guardar cambios</Button>
      </CardContent>
    </Card>
  );
}
