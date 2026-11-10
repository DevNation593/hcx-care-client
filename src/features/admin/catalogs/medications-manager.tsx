'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Pencil, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useMedications, useSaveMedication } from '@/hooks/useCatalogs';
import type { Medication, MedicationInput } from '@/types/clinical';
import { getErrorMessage } from '@/lib/api/error-messages';

type Editing = null | 'new' | Medication;

const FIELDS: { key: keyof MedicationInput; label: string; placeholder?: string }[] = [
  { key: 'commercialName', label: 'Nombre comercial' },
  { key: 'activeIngredient', label: 'Principio activo' },
  { key: 'concentration', label: 'Concentración', placeholder: '400 mg' },
  { key: 'presentation', label: 'Presentación', placeholder: 'Caja de 20 tabletas' },
  { key: 'pharmaceuticalForm', label: 'Forma farmacéutica', placeholder: 'Tableta' },
];

function MedicationForm({ medication, onDone }: { medication?: Medication; onDone: () => void }) {
  const save = useSaveMedication();
  const [form, setForm] = useState<Record<keyof MedicationInput, string>>({
    commercialName: medication?.commercialName ?? '',
    activeIngredient: medication?.activeIngredient ?? '',
    concentration: medication?.concentration ?? '',
    presentation: medication?.presentation ?? '',
    pharmaceuticalForm: medication?.pharmaceuticalForm ?? '',
  });
  const valid = form.commercialName.trim().length >= 2;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!valid || save.isPending) return;
    try {
      await save.mutateAsync({
        medicationId: medication?.id,
        data: Object.fromEntries(
          Object.entries(form).map(([key, value]) => [key, value.trim()]),
        ) as unknown as MedicationInput,
      });
      toast.success(medication ? 'Medicamento actualizado' : 'Medicamento agregado');
      onDone();
    } catch {
      // The hook already reported the error; the form stays to retry.
    }
  };

  const prefix = medication ? `medication-${medication.id}` : 'medication-new';
  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4 rounded-md border border-input p-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {FIELDS.map(({ key, label, placeholder }) => (
          <div key={key}>
            <Label htmlFor={`${prefix}-${key}`} required={key === 'commercialName'}>
              {label}
            </Label>
            <Input
              id={`${prefix}-${key}`}
              value={form[key]}
              placeholder={placeholder}
              maxLength={200}
              onChange={(event) => setForm({ ...form, [key]: event.target.value })}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!valid} loading={save.isPending}>
          {medication ? 'Guardar medicamento' : 'Agregar medicamento'}
        </Button>
      </div>
    </form>
  );
}

/** The medication catalog of the clinic, offered as suggestions when prescribing. */
export function MedicationsManager() {
  const medicationsQuery = useMedications();
  const save = useSaveMedication();
  const [editing, setEditing] = useState<Editing>(null);
  const [filter, setFilter] = useState('');

  const term = filter.trim().toLowerCase();
  const medications = (medicationsQuery.data ?? []).filter(
    (medication) =>
      !term ||
      medication.commercialName.toLowerCase().includes(term) ||
      (medication.activeIngredient ?? '').toLowerCase().includes(term),
  );

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/forms">
          <Button variant="ghost" size="sm" className="mb-2">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Formularios
          </Button>
        </Link>
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-3xl font-bold">Medicamentos</h1>
            <p className="mt-1 text-muted-foreground">
              Catálogo del consultorio. Aparece como sugerencia al escribir una receta.
            </p>
          </div>
          {editing === null && (
            <Button onClick={() => setEditing('new')}>
              <Plus className="mr-2 h-4 w-4" />
              Agregar medicamento
            </Button>
          )}
        </div>
      </div>

      {editing === 'new' && <MedicationForm onDone={() => setEditing(null)} />}

      <div className="max-w-sm">
        <Label htmlFor="medication-filter">Buscar en el catálogo</Label>
        <Input
          id="medication-filter"
          value={filter}
          placeholder="Nombre o principio activo"
          onChange={(event) => setFilter(event.target.value)}
        />
      </div>

      {medicationsQuery.isError ? (
        <Alert variant="destructive" title="No se pudo cargar el catálogo" description={getErrorMessage(medicationsQuery.error, 'Intenta de nuevo.')}>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => medicationsQuery.refetch()}>
            Reintentar
          </Button>
        </Alert>
      ) : medicationsQuery.isPending ? (
        <Skeleton className="h-32 w-full" />
      ) : medications.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {term
              ? 'Ningún medicamento coincide con la búsqueda.'
              : 'El catálogo está vacío. Agrega los medicamentos que más recetas.'}
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {medications.map((medication) =>
            editing !== null && editing !== 'new' && editing.id === medication.id ? (
              <li key={medication.id}>
                <MedicationForm medication={medication} onDone={() => setEditing(null)} />
              </li>
            ) : (
              <li
                key={medication.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-input p-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">
                      {[medication.commercialName, medication.concentration].filter(Boolean).join(' ')}
                    </p>
                    {!medication.isActive && <Badge variant="secondary">Fuera de uso</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {[medication.activeIngredient, medication.pharmaceuticalForm, medication.presentation]
                      .filter(Boolean)
                      .join(' · ') || 'Sin más datos'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditing(medication)}
                    aria-label={`Editar ${medication.commercialName}`}
                  >
                    <Pencil className="mr-1 h-4 w-4" />
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={save.isPending}
                    onClick={() =>
                      save.mutate(
                        { medicationId: medication.id, data: { isActive: !medication.isActive } },
                        {
                          onSuccess: () =>
                            toast.success(
                              medication.isActive ? 'Medicamento fuera de uso' : 'Medicamento en uso',
                            ),
                        },
                      )
                    }
                    aria-label={`${medication.isActive ? 'Retirar' : 'Reactivar'} ${medication.commercialName}`}
                  >
                    {medication.isActive ? 'Retirar' : 'Reactivar'}
                  </Button>
                </div>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}
