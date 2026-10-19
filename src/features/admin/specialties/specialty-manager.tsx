'use client';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSpecialtyCatalog, useTenantModules, useTenantSpecialties } from '@/hooks/useSpecialties';
import { describeModule } from './module-labels';

export function SpecialtyManager() {
  const catalog = useSpecialtyCatalog();
  const specialties = useTenantSpecialties();
  const modules = useTenantModules();
  const selected = specialties.data ?? [];

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Módulos clínicos</h1>
        <p className="mt-1 text-muted-foreground">Consulta las especialidades y módulos asignados a tu consultorio. Su disponibilidad la administra el dueño del software.</p>
      </div>
      {(catalog.isLoading || specialties.isLoading || modules.isLoading) && <p role="status">Cargando módulos del consultorio…</p>}
      {(catalog.isError || specialties.isError || modules.isError) && (
        <Alert variant="destructive" title="No se pudieron cargar los módulos">
          Intenta actualizar la página para consultar la configuración del consultorio.
        </Alert>
      )}
      {catalog.data && specialties.data && modules.data && (
        <Card>
          <CardHeader><CardTitle>Especialidades del consultorio</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            {selected.length === 0 && <p className="text-sm text-muted-foreground">No hay especialidades asignadas.</p>}
            {selected.map((specialty) => {
              const catalogEntry = catalog.data.find((item) => item.code === specialty.code);
              return (
                <section key={specialty.code} className="space-y-2 rounded-lg border p-4" aria-label={specialty.name}>
                  <h2 className="font-semibold">{specialty.name}</h2>
                  {catalogEntry?.modules.map(({ moduleKey }) => {
                    const enabled = modules.data.some((item) => item.moduleKey === moduleKey && item.enabled);
                    return (
                      <div key={moduleKey} className="flex items-center justify-between gap-3 text-sm">
                        <span>{describeModule(moduleKey).name}</span>
                        <Badge variant={enabled ? 'default' : 'outline'}>{enabled ? 'Activo' : 'Inactivo'}</Badge>
                      </div>
                    );
                  })}
                </section>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
