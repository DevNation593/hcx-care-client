'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert } from '@/components/ui/alert';
import {
  ClinicalModuleForm,
  initialModuleValues,
} from '@/features/clinical-forms/clinical-module-form';
import { issuesByField, toRecordData, type FormValues } from '@/features/clinical-forms/form-values';
import type { ApiError } from '@/types';
import type { ClinicalModuleDefinition, ClinicalRecordInput } from '@/types/clinical';
import { SignaturePasswordField, signaturePasswordError } from './signature-password-field';

const GROUP_LABELS: Record<ClinicalModuleDefinition['scope'], string> = {
  GENERAL: 'Generales',
  SPECIALTY: 'De mi especialidad',
  CUSTOM: 'Formularios del consultorio',
};
const GROUP_ORDER: ClinicalModuleDefinition['scope'][] = ['SPECIALTY', 'GENERAL', 'CUSTOM'];

export interface SpecialtyRecordEntryFormProps {
  tenantId: string | null;
  patientId: string;
  configurationStatus: 'loading' | 'error' | 'ready';
  configurationError?: string;
  /** The module versions the signed-in professional may record. */
  modules: ClinicalModuleDefinition[];
  isSaving: boolean;
  /** Saved outside any encounter, the record is signed at once: the password is asked. */
  signsOnSave?: boolean;
  onSubmit: (payload: ClinicalRecordInput) => void | Promise<unknown>;
  /**
   * Extra tools for the chosen module, e.g. the templates of the clinic. `fill` writes into the
   * fields of the form that exist under those keys.
   */
  renderTools?: (
    moduleKey: string,
    fill: (values: Record<string, string>) => void,
  ) => React.ReactNode;
}

export function SpecialtyRecordEntryForm(props: SpecialtyRecordEntryFormProps) {
  // Unsaved clinical data never survives a change of clinic or patient.
  const stateKey = `${props.tenantId ?? 'no-tenant'}:${props.patientId}`;
  return <SpecialtyRecordEntryFormState key={stateKey} {...props} />;
}

function SpecialtyRecordEntryFormState({
  tenantId,
  configurationStatus,
  configurationError,
  modules,
  isSaving,
  signsOnSave = false,
  onSubmit,
  renderTools,
}: SpecialtyRecordEntryFormProps) {
  const [selectedKey, setSelectedKey] = useState('');
  const [values, setValues] = useState<FormValues>({});
  const [notes, setNotes] = useState('');
  const [issues, setIssues] = useState<Record<string, string>>({});
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string>();

  const selected = modules.find((module) => module.moduleKey === selectedKey);
  const configurationReady = configurationStatus === 'ready' && Boolean(tenantId);

  const handleModuleChange = (moduleKey: string) => {
    const next = modules.find((module) => module.moduleKey === moduleKey);
    setSelectedKey(moduleKey);
    setValues(next ? initialModuleValues(next) : {});
    setIssues({});
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!configurationReady || isSaving || !selected) return;
    if (signsOnSave && !password) return;
    setIssues({});
    setPasswordError(undefined);
    try {
      await onSubmit({
        moduleKey: selected.moduleKey,
        schemaVersion: selected.schemaVersion,
        data: toRecordData(selected.schema, values),
        notes: notes.trim() || undefined,
        ...(signsOnSave ? { password } : {}),
      });
      setValues(initialModuleValues(selected));
      setNotes('');
    } catch (error) {
      // Keep the attempted values for correction; the API says which fields to fix.
      setIssues(issuesByField((error as ApiError | undefined)?.issues));
      setPasswordError(signaturePasswordError(error));
    } finally {
      // Typed again for every signature: it is never kept.
      setPassword('');
    }
  };

  const issueCount = Object.keys(issues).length;
  const fill = (fields: Record<string, string>) =>
    setValues((current) => ({
      ...current,
      ...Object.fromEntries(Object.entries(fields).filter(([key]) => key in current)),
    }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nuevo registro clínico</CardTitle>
        <CardDescription>
          Signos vitales, diagnósticos, evaluaciones, planes y formularios del consultorio.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {configurationStatus === 'loading' && (
            <p role="status" className="text-sm text-muted-foreground">
              Cargando los módulos clínicos del consultorio…
            </p>
          )}
          {configurationStatus === 'error' && (
            <Alert variant="destructive" title="No se pudo cargar la configuración">
              {configurationError || 'Intenta nuevamente cuando la configuración esté disponible.'}
            </Alert>
          )}
          <div>
            <Label htmlFor="specialty-module">Tipo de registro</Label>
            <select
              id="specialty-module"
              value={selectedKey}
              onChange={(event) => handleModuleChange(event.target.value)}
              disabled={!configurationReady}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Selecciona un tipo de registro</option>
              {GROUP_ORDER.map((scope) => {
                const group = modules.filter((module) => module.scope === scope);
                if (group.length === 0) return null;
                return (
                  <optgroup key={scope} label={GROUP_LABELS[scope]}>
                    {group.map((module) => (
                      <option key={module.moduleKey} value={module.moduleKey}>
                        {module.name}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
            {selected?.description && (
              <p className="mt-1 text-xs text-muted-foreground">{selected.description}</p>
            )}
          </div>

          {selected && (
            <>
              {renderTools?.(selected.moduleKey, fill)}
              <ClinicalModuleForm
                definition={selected}
                values={values}
                onChange={setValues}
                issues={issues}
                disabled={!configurationReady}
                idPrefix="record"
              />
              <div>
                <Label htmlFor="specialty-notes">Notas adicionales</Label>
                <Textarea
                  id="specialty-notes"
                  disabled={!configurationReady}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={3}
                  placeholder="Indicaciones, observaciones o seguimiento..."
                />
              </div>
              {issueCount > 0 && (
                <Alert variant="destructive" title="Revisa los campos marcados">
                  {issueCount === 1
                    ? 'Hay 1 campo por corregir antes de guardar.'
                    : `Hay ${issueCount} campos por corregir antes de guardar.`}
                </Alert>
              )}
              {signsOnSave && (
                <SignaturePasswordField
                  id="record-password"
                  value={password}
                  onChange={setPassword}
                  error={passwordError}
                  disabled={!configurationReady}
                />
              )}
              <Button
                type="submit"
                disabled={!configurationReady || isSaving || (signsOnSave && !password)}
                loading={isSaving}
              >
                {signsOnSave ? 'Guardar y firmar' : 'Guardar registro'}
              </Button>
            </>
          )}

          {modules.length === 0 && configurationStatus === 'ready' && (
            <p className="text-sm text-muted-foreground">
              No tienes módulos clínicos disponibles para registrar. Solo un profesional con perfil
              activo puede crear registros.
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
