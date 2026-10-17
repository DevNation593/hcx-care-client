'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BillingProfilePicker } from '@/features/cash/billing-profile-picker';
import {
  useLinkBillingProfile,
  usePatientBillingProfiles,
  useUnlinkBillingProfile,
} from '@/hooks/useBillingProfiles';
import { useMyPermissions } from '@/hooks/usePermissions';
import { useAuthStore } from '@/store/authStore';
import { isMasterRole } from '@/types/guards';
import { SRI_ID_TYPE_LABELS } from '@/types/cash';

/** Who receives the invoices of a patient: the linked billing profiles, one of them the default. */
export function PatientBillingProfiles({ patientId }: { patientId: string }) {
  const user = useAuthStore((state) => state.user);
  const { can } = useMyPermissions();
  const canManage = can('billing.create', !!user && isMasterRole(user.role));
  const { data, isPending, isError } = usePatientBillingProfiles(patientId);
  const link = useLinkBillingProfile(patientId);
  const unlink = useUnlinkBillingProfile(patientId);
  const [adding, setAdding] = useState(false);
  const busy = link.isPending || unlink.isPending;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Perfiles de facturación</CardTitle>
        {canManage && !adding && (
          <Button type="button" size="sm" variant="outline" onClick={() => setAdding(true)}>
            Agregar
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {isPending ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : isError || !data ? (
          <p className="text-sm text-destructive">No se pudieron cargar los perfiles de facturación.</p>
        ) : data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin datos de facturación vinculados.</p>
        ) : (
          <ul className="space-y-2">
            {data.map((profile) => (
              <li
                key={profile.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
              >
                <div>
                  <p className="flex items-center gap-2 font-medium">
                    {profile.legalName}
                    {profile.isDefault && <Badge variant="success">Predeterminado</Badge>}
                  </p>
                  <p className="text-muted-foreground">
                    {SRI_ID_TYPE_LABELS[profile.idType]} {profile.idNumber}
                  </p>
                </div>
                {canManage && (
                  <div className="flex gap-2">
                    {!profile.isDefault && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        aria-label={`Marcar como predeterminado ${profile.legalName}`}
                        onClick={() => link.mutate({ billingProfileId: profile.id, isDefault: true })}
                      >
                        Marcar como predeterminado
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      aria-label={`Desvincular ${profile.legalName}`}
                      onClick={() => unlink.mutate(profile.id)}
                    >
                      Desvincular
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {canManage && adding && (
          <div className="space-y-3 rounded-md border p-3">
            <BillingProfilePicker
              disabled={link.isPending}
              onSelect={(profile) =>
                link.mutate({ billingProfileId: profile.id }, { onSuccess: () => setAdding(false) })
              }
            />
            <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)}>
              Cancelar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
