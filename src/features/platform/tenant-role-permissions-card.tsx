'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { platformApi } from '@/lib/api/endpoints';
import type { ClinicRole } from '@/types';

const roles: { key: ClinicRole; name: string }[] = [
  { key: 'MASTER', name: 'Master' },
  { key: 'PROFESIONAL', name: 'Profesional' },
  { key: 'ASISTENTE', name: 'Asistente' },
];

export function TenantRolePermissionsCard({ tenantId }: { tenantId: string }) {
  const queryClient = useQueryClient();
  const [role, setRole] = useState<ClinicRole>('MASTER');
  const [draft, setDraft] = useState<{ role: ClinicRole; allowed: string[] } | null>(null);
  const queryKey = ['platform', 'tenant', tenantId, 'role', role, 'permissions'];
  const query = useQuery({ queryKey, queryFn: () => platformApi.getRolePermissions(tenantId, role) });
  const save = useMutation({
    mutationFn: (allowed: string[]) => platformApi.setRolePermissions(tenantId, role, allowed),
    onSuccess: (result) => {
      queryClient.setQueryData(queryKey, result);
      setDraft(null);
    },
  });
  const saved = query.data?.permissions.filter((entry) => entry.allowed).map((entry) => entry.key) ?? [];
  const value = draft?.role === role ? draft.allowed : saved;
  const dirty = value.length !== saved.length || value.some((key) => !saved.includes(key));
  const groups = new Map<string, NonNullable<typeof query.data>['permissions']>();
  for (const permission of query.data?.permissions ?? []) {
    groups.set(permission.group, [...(groups.get(permission.group) ?? []), permission]);
  }

  return (
    <Card>
      <CardHeader><CardTitle>Permisos por rol</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">Estos permisos se aplican a todas las cuentas del rol seleccionado en este consultorio.</p>
        <label className="block space-y-1 text-sm font-medium">
          <span>Rol del consultorio</span>
          <select className="block w-full rounded-md border bg-background px-3 py-2 sm:w-64" value={role} disabled={save.isPending} onChange={(event) => { setRole(event.target.value as ClinicRole); setDraft(null); }}>
            {roles.map((item) => <option key={item.key} value={item.key}>{item.name}</option>)}
          </select>
        </label>
        {query.isLoading && <p role="status">Cargando permisos…</p>}
        {query.isError && <p role="alert">No se pudieron cargar los permisos del rol.</p>}
        {[...groups].map(([group, entries]) => (
          <fieldset key={group} className="space-y-2 rounded-md border p-4">
            <legend className="px-1 font-medium">{group}</legend>
            {entries.map((entry) => (
              <label key={entry.key} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={value.includes(entry.key)} disabled={save.isPending} onChange={(event) => setDraft({
                  role,
                  allowed: event.target.checked ? [...value, entry.key] : value.filter((key) => key !== entry.key),
                })} />
                {entry.label}
              </label>
            ))}
          </fieldset>
        ))}
        {save.isError && <p role="alert" className="text-sm text-destructive">{save.error.message}</p>}
        <Button type="button" disabled={!query.data || !dirty || save.isPending} loading={save.isPending} onClick={() => save.mutate(value)}>Guardar permisos del rol</Button>
      </CardContent>
    </Card>
  );
}
