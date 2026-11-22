'use client';

import { useState } from 'react';
import { FilePlus2, Pencil, Trash2 } from 'lucide-react';
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
import { ClinicalModuleForm, initialModuleValues } from '@/features/clinical-forms/clinical-module-form';
import { issuesByField, toRecordData, type FormValues } from '@/features/clinical-forms/form-values';
import { LEGACY_ORDER_MODULE_KEY } from '@/types/clinical-orders';
import { ProcedureConsents } from './procedure-consents';
import { usePatientEncounters } from '@/hooks/useEncounters';
import { useSections } from '@/hooks/useSections';
import {
  useCorrectSpecialtyRecord,
  useCreateSpecialtyRecord,
  usePatientSpecialtyRecords,
  useRemoveSpecialtyRecord,
} from '@/hooks/useSpecialtyRecords';
import { STALE_RECORD_CODES } from '@/lib/clinical-record-errors';
import { formatDate } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import type { ApiError, SpecialtyRecord } from '@/types';
import type { ClinicalModuleDefinition } from '@/types/clinical';
import { EncounterNotes } from './encounter-notes';
import { EncounterPanel } from './encounter-panel';
import { RecordCard, useRecordDefinitions } from './record-card';
import { TREATMENT_SESSIONS_SECTION } from './encounter-treatments';
import { SignaturePasswordField, signaturePasswordError } from './signature-password-field';
import { SpecialtyRecordEntryForm } from './specialty-record-entry-form';
import { hasTemplates, TemplatePicker } from './template-picker';
import { isHealthSpecialtyCode, usePatientTerms } from '@/hooks/usePatientTerms';

function errorMessage(error: unknown): string | undefined {
  return error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
    ? error.message
    : undefined;
}

export function ClinicalRecordsTab({
  patientId,
  startAppointmentId,
  onOpenTreatments,
  historyInTimeline = false,
  canWriteNotes = false,
  onOpenHistory,
}: {
  patientId: string;
  /** Arriving from the agenda to attend this appointment. */
  startAppointmentId?: string;
  /** Opens the Tratamientos tab: the page owns which tab is active, a link would only change the URL. */
  onOpenTreatments: () => void;
  /**
   * The clinic has the Historia clínica tab: it holds the chronology (previous attentions and
   * records, notes, procedures), so this tab keeps only the work in course and does not list it.
   * Without it (a clinic with no clinical notes) this tab still is the history.
   */
  historyInTimeline?: boolean;
  /** The signed-in account may write clinical notes: an active health professional. */
  canWriteNotes?: boolean;
  /** Opens the Historia clínica tab. */
  onOpenHistory?: () => void;
}) {
  const { data: records = [], isLoading } = usePatientSpecialtyRecords(patientId);
  const { modulesQuery, definitionOf, nameOf } = useRecordDefinitions();
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
  // With treatment sessions the encounter is started and closed from the Tratamientos tab.
  const { isEnabled } = useSections();
  const treatmentsOwnEncounter = isEnabled(TREATMENT_SESSIONS_SECTION);
  // One open encounter per professional and patient: new records go into it.
  const openEncounter = encounters.find(
    (encounter) => encounter.status === 'OPEN' && encounter.professionalId === userId,
  );

  const [moduleFilter, setModuleFilter] = useState('');
  const [correcting, setCorrecting] = useState<SpecialtyRecord | null>(null);
  const [amending, setAmending] = useState<SpecialtyRecord | null>(null);
  const [removing, setRemoving] = useState<SpecialtyRecord | null>(null);

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
  // With the history tab, only the records of the attention in course are worked on here.
  const listed = historyInTimeline
    ? records.filter((record) => !!openEncounter && record.encounterId === openEncounter.id)
    : records;
  const visible = moduleFilter ? listed.filter((record) => record.moduleKey === moduleFilter) : listed;
  // A signed record is corrected by its author with an addendum, which is a new record: it is
  // offered here, where records are written, since the history tab only reads.
  const amendable = historyInTimeline
    ? records.filter(
        (record) =>
          !!userId &&
          record.professionalId === userId &&
          record.signed === true &&
          !record.amendedBy &&
          !!latestRecordable(record.moduleKey),
      )
    : [];
  const showNotes = canWriteNotes && isEnabled('core.clinical.notes');

  return (
    <div className="space-y-6">
      {treatmentsOwnEncounter ? (
        <p className="text-sm text-muted-foreground">
          Inicia y cierra los tratamientos en la pestaña{' '}
          <button
            type="button"
            onClick={onOpenTreatments}
            className="font-medium text-primary hover:underline"
          >
            Tratamientos
          </button>
          .
        </p>
      ) : (
        <EncounterPanel
          patientId={patientId}
          encounters={encounters}
          openEncounter={openEncounter}
          initialAppointmentId={startAppointmentId}
          mode="specialties"
          showPrevious={!historyInTimeline}
        />
      )}

      {healthProfile && (
        <ProcedureConsents patientId={patientId} openEncounterId={openEncounter?.id} />
      )}

      {showNotes && (
        <EncounterNotes
          patientId={patientId}
          openEncounter={openEncounter}
          startHint={
            treatmentsOwnEncounter ? (
              <>
                Inicia un tratamiento en la pestaña{' '}
                <button
                  type="button"
                  onClick={onOpenTreatments}
                  className="font-medium text-primary hover:underline"
                >
                  Tratamientos
                </button>
                .
              </>
            ) : (
              'Pulsa «Iniciar atención» en el panel de arriba.'
            )
          }
        />
      )}

      {!openEncounter && recordable.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {treatmentsOwnEncounter ? 'No tienes un tratamiento en curso' : 'No tienes una atención abierta'} con
          este {terms.one}: lo que guardes queda firmado al instante y después solo se corrige con una
          adenda.
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
          <h3 className="text-lg font-semibold">
            {historyInTimeline ? 'Registros de esta atención' : 'Historial de registros'}
          </h3>
          {!historyInTimeline && recordedModules.length > 1 && (
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

        {historyInTimeline && (
          <p className="text-sm text-muted-foreground">
            Aquí solo están los registros de la atención en curso, para completarlos o corregirlos. El
            historial completo se lee en{' '}
            {onOpenHistory ? (
              <button
                type="button"
                onClick={onOpenHistory}
                className="font-medium text-primary hover:underline"
              >
                Historia clínica
              </button>
            ) : (
              'Historia clínica'
            )}
            .
          </p>
        )}

        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : visible.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              {historyInTimeline
                ? openEncounter
                  ? 'Aún no hay registros en esta atención.'
                  : 'No hay una atención abierta.'
                : `Aún no hay registros clínicos de este ${terms.one}.`}
            </CardContent>
          </Card>
        ) : (
          visible.map((record) => {
            const isAuthor = !!userId && record.professionalId === userId;
            const signed = record.signed === true;
            const amendWith = signed && !record.amendedBy ? latestRecordable(record.moduleKey) : undefined;
            return (
              <RecordCard
                key={record.id}
                record={record}
                name={nameOf(record)}
                definition={definitionOf(record)}
                from="specialties"
                actions={
                  <>
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
                  </>
                }
              />
            );
          })
        )}

        {amendable.length > 0 && (
          <details className="rounded-md border border-input">
            <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
              Corregir un registro firmado con una adenda ({amendable.length})
            </summary>
            <ul className="divide-y border-t">
              {amendable.map((record) => (
                <li
                  key={record.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
                >
                  <span>
                    {nameOf(record)} · {formatDate(record.recordDate, 'dd/MM/yyyy')}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setAmending(record)}
                    aria-label={`Corregir con adenda ${nameOf(record)}`}
                  >
                    <FilePlus2 className="mr-1 h-4 w-4" />
                    Agregar adenda
                  </Button>
                </li>
              ))}
            </ul>
          </details>
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
