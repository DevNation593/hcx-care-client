'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, FilePlus2, Pencil, Printer, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  ClinicalModuleForm,
  initialModuleValues,
  RecordDataView,
} from '@/features/clinical-forms/clinical-module-form';
import { issuesByField, toRecordData, type FormValues } from '@/features/clinical-forms/form-values';
import { describeModule } from '@/features/admin/specialties/module-labels';
import { useClinicalModules } from '@/hooks/useClinicalModules';
import { LEGACY_ORDER_MODULE_KEY } from '@/types/clinical-orders';
import { ProcedureConsents } from './procedure-consents';
import { usePatientEncounters } from '@/hooks/useEncounters';
import {
  useCorrectSpecialtyRecord,
  useCreateSpecialtyRecord,
  usePatientSpecialtyRecords,
  useRemoveSpecialtyRecord,
} from '@/hooks/useSpecialtyRecords';
import { STALE_RECORD_CODES } from '@/lib/clinical-record-errors';
import { cn, formatDate } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import type { ApiError, SpecialtyRecord } from '@/types';
import type { ClinicalModuleDefinition, FormAlertLevel } from '@/types/clinical';
import { describeEncounter, EncounterPanel } from './encounter-panel';
import { SignaturePasswordField, signaturePasswordError } from './signature-password-field';
import { SpecialtyRecordEntryForm } from './specialty-record-entry-form';
import { hasTemplates, TemplatePicker } from './template-picker';
import type { Encounter } from '@/types/clinical';
import { isHealthSpecialtyCode, usePatientTerms } from '@/hooks/usePatientTerms';

export const ALERT_STYLES: Record<FormAlertLevel, string> = {
  critical: 'border-red-300 bg-red-50 text-red-900',
  warning: 'border-orange-300 bg-orange-50 text-orange-900',
  info: 'border-sky-300 bg-sky-50 text-sky-900',
};

const definitionKey = (moduleKey: string, schemaVersion: number) => `${moduleKey}@${schemaVersion}`;

function errorMessage(error: unknown): string | undefined {
  return error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
    ? error.message
    : undefined;
}

export function ClinicalRecordsTab({
  patientId,
  startAppointmentId,
}: {
  patientId: string;
  /** Arriving from the agenda to attend this appointment. */
  startAppointmentId?: string;
}) {
  const { data: records = [], isLoading } = usePatientSpecialtyRecords(patientId);
  const modulesQuery = useClinicalModules();
  const createRecord = useCreateSpecialtyRecord(patientId);
  const tenantId = useAuthStore((state) => state.tenant?.id ?? state.user?.tenantId ?? null);
  const userId = useAuthStore((state) => state.user?.id);
  // Procedure consents are health care (the API answers HEALTH_SPECIALTY_REQUIRED otherwise);
  // an aesthetic professional takes consents inside a treatment session instead.
  const terms = usePatientTerms();
  const healthProfile = useAuthStore((state) =>
    isHealthSpecialtyCode(state.user?.professionalProfile?.specialty?.code),
  );
  const { data: encounters = [] } = usePatientEncounters(patientId);
  // One open encounter per professional and patient: new records go into it.
  const openEncounter = encounters.find(
    (encounter) => encounter.status === 'OPEN' && encounter.professionalId === userId,
  );

  const [moduleFilter, setModuleFilter] = useState('');
  const [correcting, setCorrecting] = useState<SpecialtyRecord | null>(null);
  const [amending, setAmending] = useState<SpecialtyRecord | null>(null);
  const [removing, setRemoving] = useState<SpecialtyRecord | null>(null);

  const definitions = useMemo(
    () =>
      new Map(
        (modulesQuery.data ?? []).map((definition) => [
          definitionKey(definition.moduleKey, definition.schemaVersion),
          definition,
        ]),
      ),
    [modulesQuery.data],
  );
  const definitionOf = (record: SpecialtyRecord) =>
    definitions.get(definitionKey(record.moduleKey, record.schemaVersion ?? 1));
  const nameOf = (record: SpecialtyRecord) =>
    definitionOf(record)?.name ?? describeModule(record.moduleKey).name;

  const recordable = (modulesQuery.data ?? []).filter((definition) => definition.canRecord);
  // An addendum is written with the current version of the form the record used.
  const latestRecordable = (moduleKey: string) =>
    recordable
      .filter((definition) => definition.moduleKey === moduleKey && !definition.legacy)
      .sort((a, b) => b.schemaVersion - a.schemaVersion)[0];
  const configurationStatus = modulesQuery.isError
    ? 'error'
    : !tenantId || modulesQuery.isPending
      ? 'loading'
      : 'ready';

  const recordedModules = [...new Map(records.map((record) => [record.moduleKey, nameOf(record)]))];
  const visible = moduleFilter ? records.filter((record) => record.moduleKey === moduleFilter) : records;

  return (
    <div className="space-y-6">
      <EncounterPanel
        patientId={patientId}
        encounters={encounters}
        openEncounter={openEncounter}
        initialAppointmentId={startAppointmentId}
      />

      {healthProfile && (
        <ProcedureConsents patientId={patientId} openEncounterId={openEncounter?.id} />
      )}

      {!openEncounter && recordable.length > 0 && (
        <p className="text-sm text-muted-foreground">
          No tienes una atención abierta con este {terms.one}: lo que guardes queda firmado al instante
          y después solo se corrige con una adenda.
        </p>
      )}
      <SpecialtyRecordEntryForm
        tenantId={tenantId}
        patientId={patientId}
        configurationStatus={configurationStatus}
        configurationError={errorMessage(modulesQuery.error)}
        // Orders are placed from their own tab, with results and review; old order records keep
        // their addenda through `latestRecordable`.
        modules={recordable.filter((definition) => definition.moduleKey !== LEGACY_ORDER_MODULE_KEY)}
        isSaving={createRecord.isPending}
        signsOnSave={!openEncounter}
        onSubmit={(payload) =>
          createRecord.mutateAsync({
            ...payload,
            ...(openEncounter ? { encounterId: openEncounter.id } : {}),
          })
        }
        renderTools={(moduleKey, fill) =>
          hasTemplates(moduleKey) ? (
            <TemplatePicker moduleKey={moduleKey} patientId={patientId} onApply={fill} />
          ) : null
        }
      />

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold">Historial de registros</h3>
          {recordedModules.length > 1 && (
            <div className="flex items-center gap-2">
              <Label htmlFor="record-filter" className="text-sm text-muted-foreground">
                Mostrar
              </Label>
              <select
                id="record-filter"
                value={moduleFilter}
                onChange={(event) => setModuleFilter(event.target.value)}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Todos los registros</option>
                {recordedModules.map(([moduleKey, name]) => (
                  <option key={moduleKey} value={moduleKey}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : visible.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Aún no hay registros clínicos de este {terms.one}.
            </CardContent>
          </Card>
        ) : (
          visible.map((record) => {
            const definition = definitionOf(record);
            const isAuthor = !!userId && record.professionalId === userId;
            // A signed record is final: its author corrects it with an addendum, once.
            const signed = record.signed === true;
            const superseded = !!record.amendedBy;
            const amendWith = signed && !superseded ? latestRecordable(record.moduleKey) : undefined;
            return (
              <Card key={record.id} className={cn(superseded && 'opacity-75')}>
                <CardContent className="space-y-3 pt-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{nameOf(record)}</p>
                      <p className="text-sm text-muted-foreground">
                        {[
                          record.professional &&
                            `${record.professional.firstName} ${record.professional.lastName}`,
                          record.specialty?.name,
                          formatDate(record.recordDate, 'dd/MM/yyyy'),
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                      {record.encounter && (
                        <p className="text-xs text-muted-foreground">
                          Atención: {describeEncounter(record.encounter as Pick<Encounter, 'encounterType' | 'startedAt'>)}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {record.amendsRecordId && <Badge>Adenda</Badge>}
                      {signed && <Badge variant="secondary">Firmado</Badge>}
                      {superseded ? (
                        <Badge variant="outline">Corregido por adenda</Badge>
                      ) : (
                        (record.version ?? 1) > 1 && <Badge variant="outline">Corregido</Badge>
                      )}
                      <Link
                        href={`/patients/${patientId}/records/${record.id}/print`}
                        aria-label={`Imprimir ${nameOf(record)}`}
                        className="inline-flex h-9 items-center justify-center rounded-md px-3 hover:bg-accent"
                      >
                        <Printer className="h-4 w-4" />
                      </Link>
                      {isAuthor && amendWith && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setAmending(record)}
                          aria-label={`Corregir con adenda ${nameOf(record)}`}
                        >
                          <FilePlus2 className="mr-1 h-4 w-4" />
                          Agregar adenda
                        </Button>
                      )}
                      {isAuthor && !signed && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setCorrecting(record)}
                            aria-label={`Corregir ${nameOf(record)}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setRemoving(record)}
                            aria-label={`Eliminar ${nameOf(record)}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {record.alerts?.map((alert) => (
                    <p
                      key={alert.message}
                      role="alert"
                      className={cn(
                        'flex items-start gap-2 rounded-md border px-3 py-2 text-sm',
                        ALERT_STYLES[alert.level],
                      )}
                    >
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                      {alert.message}
                    </p>
                  ))}

                  {record.amendsRecordId && record.amendmentReason && (
                    <p className="rounded-md border border-input px-3 py-2 text-sm">
                      <span className="font-medium">Motivo de la adenda:</span>{' '}
                      {record.amendmentReason}
                    </p>
                  )}
                  {superseded && record.amendedBy && (
                    <p className="text-sm text-muted-foreground">
                      Corregido por una adenda del{' '}
                      {formatDate(record.amendedBy.createdAt, 'dd/MM/yyyy HH:mm')}. Se conserva tal
                      como se firmó.
                    </p>
                  )}

                  <RecordDataView definition={definition} data={record.data} />
                  {record.notes && (
                    <p className="whitespace-pre-wrap border-t pt-3 text-sm">{record.notes}</p>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {correcting && (
        <CorrectRecordDialog
          patientId={patientId}
          record={correcting}
          definition={definitionOf(correcting)}
          title={nameOf(correcting)}
          onClose={() => setCorrecting(null)}
        />
      )}
      {amending && latestRecordable(amending.moduleKey) && (
        <AmendRecordDialog
          patientId={patientId}
          record={amending}
          definition={latestRecordable(amending.moduleKey)!}
          title={nameOf(amending)}
          onClose={() => setAmending(null)}
        />
      )}
      {removing && (
        <RemoveRecordDialog
          patientId={patientId}
          record={removing}
          title={nameOf(removing)}
          onClose={() => setRemoving(null)}
        />
      )}
    </div>
  );
}

function ReasonField({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <Label htmlFor={id}>
        Motivo<span className="text-destructive"> *</span>
      </Label>
      <Textarea
        id={id}
        rows={2}
        maxLength={500}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Queda guardado en la auditoría del registro."
      />
    </div>
  );
}

function CorrectRecordDialog({
  patientId,
  record,
  definition,
  title,
  onClose,
}: {
  patientId: string;
  record: SpecialtyRecord;
  definition?: ClinicalModuleDefinition;
  title: string;
  onClose: () => void;
}) {
  const correct = useCorrectSpecialtyRecord(patientId);
  const [values, setValues] = useState<FormValues>(() =>
    definition ? initialModuleValues(definition, record.data) : {},
  );
  const [notes, setNotes] = useState(record.notes ?? '');
  const [reason, setReason] = useState('');
  const [issues, setIssues] = useState<Record<string, string>>({});
  // Records in the pre-definition format keep their data; only their notes can be corrected.
  const editable = !!definition && !definition.legacy;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!reason.trim() || correct.isPending) return;
    setIssues({});
    try {
      await correct.mutateAsync({
        recordId: record.id,
        data: {
          ...(editable ? { data: toRecordData(definition.schema, values) } : {}),
          notes: notes.trim() || null,
          changeReason: reason.trim(),
          ...(record.version ? { version: record.version } : {}),
        },
      });
      onClose();
    } catch (error) {
      const apiError = error as ApiError | undefined;
      // Saved by someone else or signed meanwhile: the history reloads and the edit is not sent.
      if (apiError?.code && STALE_RECORD_CODES.includes(apiError.code)) {
        onClose();
        return;
      }
      setIssues(issuesByField(apiError?.issues));
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <DialogHeader>
            <DialogTitle>Corregir {title}</DialogTitle>
            <DialogDescription>
              La versión anterior se conserva en la auditoría junto con el motivo de la corrección.
            </DialogDescription>
          </DialogHeader>
          {editable ? (
            <ClinicalModuleForm
              definition={definition}
              values={values}
              onChange={setValues}
              issues={issues}
              idPrefix="correct"
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Este registro usa un formato anterior: solo se pueden corregir sus notas.
            </p>
          )}
          <div>
            <Label htmlFor="correct-notes">Notas adicionales</Label>
            <Textarea
              id="correct-notes"
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>
          <ReasonField id="correct-reason" value={reason} onChange={setReason} />
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!reason.trim()} loading={correct.isPending}>
              Guardar corrección
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The correction of a signed record: a new record of the same form, with its reason, that stays
 * next to the original. It starts from the data of the original, in the current version of the form.
 */
function AmendRecordDialog({
  patientId,
  record,
  definition,
  title,
  onClose,
}: {
  patientId: string;
  record: SpecialtyRecord;
  definition: ClinicalModuleDefinition;
  title: string;
  onClose: () => void;
}) {
  const create = useCreateSpecialtyRecord(patientId);
  const [values, setValues] = useState<FormValues>(() => initialModuleValues(definition, record.data));
  const [notes, setNotes] = useState(record.notes ?? '');
  const [reason, setReason] = useState('');
  const [issues, setIssues] = useState<Record<string, string>>({});
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string>();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!reason.trim() || !password || create.isPending) return;
    setIssues({});
    setPasswordError(undefined);
    try {
      await create.mutateAsync({
        moduleKey: record.moduleKey,
        schemaVersion: definition.schemaVersion,
        data: toRecordData(definition.schema, values),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        amendsRecordId: record.id,
        amendmentReason: reason.trim(),
        password,
      });
      onClose();
    } catch (error) {
      setIssues(issuesByField((error as ApiError | undefined)?.issues));
      setPasswordError(signaturePasswordError(error));
    } finally {
      // Typed again for every signature: it is never kept.
      setPassword('');
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <DialogHeader>
            <DialogTitle>Adenda a {title}</DialogTitle>
            <DialogDescription>
              El registro firmado del {formatDate(record.recordDate, 'dd/MM/yyyy')} se conserva tal
              como se firmó. La adenda queda junto a él, firmada, con el motivo que indiques.
            </DialogDescription>
          </DialogHeader>
          <ClinicalModuleForm
            definition={definition}
            values={values}
            onChange={setValues}
            issues={issues}
            idPrefix="amend"
          />
          <div>
            <Label htmlFor="amend-notes">Notas adicionales</Label>
            <Textarea
              id="amend-notes"
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>
          <ReasonField id="amend-reason" value={reason} onChange={setReason} />
          <SignaturePasswordField
            id="amend-password"
            value={password}
            onChange={setPassword}
            error={passwordError}
          />
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={!reason.trim() || !password}
              loading={create.isPending}
            >
              Guardar adenda
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RemoveRecordDialog({
  patientId,
  record,
  title,
  onClose,
}: {
  patientId: string;
  record: SpecialtyRecord;
  title: string;
  onClose: () => void;
}) {
  const remove = useRemoveSpecialtyRecord(patientId);
  const [reason, setReason] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!reason.trim() || remove.isPending) return;
    try {
      await remove.mutateAsync({ recordId: record.id, reason: reason.trim() });
      onClose();
    } catch {
      // The hook already reported the error; the dialog stays open to retry.
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <DialogHeader>
            <DialogTitle>Eliminar {title}</DialogTitle>
            <DialogDescription>
              El registro del {formatDate(record.recordDate, 'dd/MM/yyyy')} dejará de mostrarse en
              la historia del paciente. Se conserva en la auditoría con el motivo que indiques.
            </DialogDescription>
          </DialogHeader>
          <ReasonField id="remove-reason" value={reason} onChange={setReason} />
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={!reason.trim()}
              loading={remove.isPending}
            >
              Eliminar registro
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
