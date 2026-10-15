'use client';

import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useFormDefinitions } from '@/hooks/useClinicalModules';
import { useConsentTemplates } from '@/hooks/useConsentTemplates';
import {
  useAddTreatmentVersion,
  useCreateTreatment,
  useTreatments,
  useUpdateTreatment,
} from '@/hooks/useTreatments';
import type { TreatmentVersionInput, TreatmentWithCurrent } from '@/types/treatments';
import { TreatmentVersionForm } from './treatment-version-form';

type Dialogs = null | { mode: 'create' } | { mode: 'version'; treatment: TreatmentWithCurrent };

const money = new Intl.NumberFormat('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function requirementsSummary({ requirements: r }: TreatmentWithCurrent['current']): string {
  return [
    r.medicalForm.required && 'Ficha',
    r.informedConsent.required &&
      (r.informedConsent.validityDays
        ? `Consentimiento (${r.informedConsent.validityDays} días)`
        : 'Consentimiento'),
    r.photos.minimumBefore > 0 && `${r.photos.minimumBefore} foto(s) antes`,
    r.photos.minimumAfter > 0 && `${r.photos.minimumAfter} foto(s) después`,
    r.clinicalNotes.requiredForCompletion && 'Notas para cerrar',
  ]
    .filter(Boolean)
    .join(' · ');
}

interface FormChoices {
  forms: React.ComponentProps<typeof TreatmentVersionForm>['forms'];
  consentVersions: React.ComponentProps<typeof TreatmentVersionForm>['consentVersions'];
}

function CreateTreatmentDialog({
  choices,
  onClose,
}: {
  choices: FormChoices;
  onClose: () => void;
}) {
  const create = useCreateTreatment();
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);

  const submit = (version: TreatmentVersionInput) => {
    if (name.trim().length < 2) {
      setNameError('El nombre debe tener al menos 2 caracteres');
      return;
    }
    create.mutate(
      { name: name.trim(), ...(category.trim() ? { category: category.trim() } : {}), version },
      { onSuccess: onClose },
    );
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !create.isPending && onClose()}>
      <DialogContent
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-treatment-title"
        className="max-h-[90vh] max-w-2xl overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle id="create-treatment-title">Nuevo tratamiento</DialogTitle>
          <DialogDescription>El precio y los requisitos quedan en la versión 1.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="treatment-name" required>
              Nombre
            </Label>
            <Input
              id="treatment-name"
              className="h-11"
              value={name}
              maxLength={120}
              error={nameError ?? undefined}
              onChange={(event) => {
                setName(event.target.value);
                setNameError(null);
              }}
            />
          </div>
          <div>
            <Label htmlFor="treatment-category">Categoría (opcional)</Label>
            <Input
              id="treatment-category"
              className="h-11"
              value={category}
              maxLength={120}
              onChange={(event) => setCategory(event.target.value)}
            />
          </div>
        </div>
        <TreatmentVersionForm
          {...choices}
          issues={create.error?.issues?.map((issue) => issue.message)}
          submitting={create.isPending}
          onSubmit={submit}
        />
      </DialogContent>
    </Dialog>
  );
}

function NewVersionDialog({
  treatment,
  choices,
  onClose,
}: {
  treatment: TreatmentWithCurrent;
  choices: FormChoices;
  onClose: () => void;
}) {
  const addVersion = useAddTreatmentVersion(treatment.id);

  return (
    <Dialog open onOpenChange={(open) => !open && !addVersion.isPending && onClose()}>
      <DialogContent
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-version-title"
        className="max-h-[90vh] max-w-2xl overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle id="new-version-title">Nueva versión de {treatment.name}</DialogTitle>
          <DialogDescription>
            Las sesiones ya abiertas conservan la versión {treatment.currentVersion}; esta será la que usen
            las nuevas.
          </DialogDescription>
        </DialogHeader>
        <TreatmentVersionForm
          {...choices}
          initial={treatment.current}
          issues={addVersion.error?.issues?.map((issue) => issue.message)}
          submitting={addVersion.isPending}
          onSubmit={(version) => addVersion.mutate(version, { onSuccess: onClose })}
        />
      </DialogContent>
    </Dialog>
  );
}

/** The clinic's treatment catalog; price and requirements change through new versions. */
export function TreatmentsPage({ canManage }: { canManage: boolean }) {
  const treatmentsQuery = useTreatments();
  const formsQuery = useFormDefinitions();
  const templatesQuery = useConsentTemplates();
  const update = useUpdateTreatment();
  const [dialog, setDialog] = useState<Dialogs>(null);

  const choices = useMemo<FormChoices>(
    () => ({
      forms: (formsQuery.data ?? [])
        .filter((form) => form.isActive)
        .map((form) => ({
          id: form.id,
          name: form.name,
          versions: form.versions.length
            ? form.versions.map((version) => version.version)
            : Array.from({ length: form.currentVersion }, (_, index) => index + 1),
        })),
      consentVersions: (templatesQuery.data ?? [])
        .filter((template) => template.isActive)
        .flatMap((template) =>
          template.versions
            .filter((version) => version.status === 'PUBLISHED')
            .map((version) => ({ id: version.id, label: `${template.name} · v${version.version}` })),
        ),
    }),
    [formsQuery.data, templatesQuery.data],
  );

  const treatments = treatmentsQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-bold">Tratamientos</h1>
          <p className="mt-1 text-muted-foreground">
            Catálogo de tratamientos con su precio y los requisitos de cada sesión.
          </p>
        </div>
        {canManage && (
          <Button className="min-h-[44px]" onClick={() => setDialog({ mode: 'create' })}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo tratamiento
          </Button>
        )}
      </div>

      {treatmentsQuery.isError ? (
        <Alert variant="destructive" title="No se pudieron cargar los tratamientos">
          <Button variant="outline" size="sm" className="mt-2" onClick={() => treatmentsQuery.refetch()}>
            Reintentar
          </Button>
        </Alert>
      ) : treatmentsQuery.isPending ? (
        <Skeleton className="h-32 w-full" />
      ) : treatments.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Aún no hay tratamientos en el catálogo.
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {treatments.map((treatment) => (
            <li key={treatment.id}>
              <Card>
                <CardContent className="flex flex-col gap-4 py-4 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{treatment.name}</p>
                      <Badge variant={treatment.isActive ? 'success' : 'secondary'}>
                        {treatment.isActive ? 'Activo' : 'Inactivo'}
                      </Badge>
                      <Badge variant="outline">Versión {treatment.currentVersion}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {[
                        treatment.category,
                        `Precio ${money.format(treatment.current.price)}`,
                        `Impuesto ${treatment.current.taxRatePercent}%`,
                        `${treatment.current.durationMinutes} min`,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                    <p className="mt-1 text-sm">
                      {requirementsSummary(treatment.current) || 'Sin requisitos'}
                    </p>
                  </div>
                  {canManage && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        className="min-h-[44px]"
                        onClick={() => setDialog({ mode: 'version', treatment })}
                        aria-label={`Nueva versión de ${treatment.name}`}
                      >
                        Nueva versión
                      </Button>
                      <Button
                        variant="ghost"
                        className="min-h-[44px]"
                        disabled={update.isPending}
                        onClick={() =>
                          update.mutate({ id: treatment.id, data: { isActive: !treatment.isActive } })
                        }
                        aria-label={`${treatment.isActive ? 'Desactivar' : 'Activar'} ${treatment.name}`}
                      >
                        {treatment.isActive ? 'Desactivar' : 'Activar'}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {canManage && dialog?.mode === 'create' && (
        <CreateTreatmentDialog choices={choices} onClose={() => setDialog(null)} />
      )}
      {canManage && dialog?.mode === 'version' && (
        <NewVersionDialog treatment={dialog.treatment} choices={choices} onClose={() => setDialog(null)} />
      )}
    </div>
  );
}
