'use client';

import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  ClinicalModuleForm,
  initialModuleValues,
} from '@/features/clinical-forms/clinical-module-form';
import { issuesByField, toRecordData, type FormValues } from '@/features/clinical-forms/form-values';
import { useSessionCommand } from '@/hooks/useTreatmentSessions';
import type { ApiError } from '@/types';
import type { TreatmentSessionDetail } from '@/types/treatments';

export interface FormStepProps {
  session: TreatmentSessionDetail;
  /** For someone other than the session's professional: the answers are only shown. */
  readOnly?: boolean;
  /** Called once the server stored the answers. */
  onSaved?: () => void;
}

/** The medical form pinned by the treatment, filled from the answers saved so far. */
export function FormStep({ session, readOnly = false, onSaved }: FormStepProps) {
  const { saveForm } = useSessionCommand(session.id);
  const form = session.form;
  const [values, setValues] = useState<FormValues>(() =>
    form ? initialModuleValues({ renderer: 'FORM', schema: form.schema }, form.data ?? {}) : {},
  );
  const [issues, setIssues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  if (!form) {
    return (
      <Alert variant="warning" title="Ficha no disponible">
        No se encontró la versión de la ficha que exige el tratamiento.
      </Alert>
    );
  }

  const editable = !readOnly && session.allowedCommands.includes('SAVE_FORM');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editable || saveForm.isPending) return;
    setIssues({});
    setError(null);
    try {
      await saveForm.mutateAsync(toRecordData(form.schema, values));
      onSaved?.();
    } catch (failure) {
      // The answers stay for correction; the API says which fields to fix.
      const apiError = failure as ApiError | undefined;
      setIssues(issuesByField(apiError?.issues));
      setError(apiError?.message || 'No se pudo guardar la ficha.');
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold">{form.name}</h3>
        <p className="text-sm text-muted-foreground">
          Versión {form.formVersion}
          {!editable && !readOnly && ' · La ficha ya no se puede modificar en esta atención.'}
        </p>
      </div>
      <ClinicalModuleForm
        definition={{ renderer: 'FORM', schema: form.schema }}
        values={values}
        onChange={setValues}
        issues={issues}
        disabled={!editable || saveForm.isPending}
        idPrefix="session-form"
      />
      {error && (
        <Alert variant="destructive" title="No se guardó la ficha">
          {error}
        </Alert>
      )}
      {editable && (
        <Button type="submit" size="lg" className="w-full sm:w-auto" loading={saveForm.isPending}>
          Guardar ficha
        </Button>
      )}
    </form>
  );
}
