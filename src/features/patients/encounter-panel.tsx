'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Play, Plus, Trash2, UserX } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAppointments } from '@/hooks/useAppointments';
import { useBranches } from '@/hooks/useBranches';
import { useCloseEncounter, useRemoveEncounter, useStartEncounter } from '@/hooks/useEncounters';
import { useSections } from '@/hooks/useSections';
import { useCreateTreatmentSessions } from '@/hooks/useTreatmentSessions';
import { useTreatments } from '@/hooks/useTreatments';
import { formatDate } from '@/lib/utils';
import {
  AddTreatmentDialog,
  canRecordNoShow,
  countedSessions,
  EncounterTreatmentList,
  MAX_TREATMENTS_PER_ENCOUNTER,
  NoShowDialog,
  PANEL_COPY,
  TREATMENT_SESSIONS_SECTION,
  TreatmentPicker,
  unfinishedSessions,
  type EncounterPanelMode,
} from './encounter-treatments';
import { SignaturePasswordField, signaturePasswordError } from './signature-password-field';
import { useAuthStore } from '@/store/authStore';
import { AppointmentStatus } from '@/types';
import {
  ENCOUNTER_TYPE_LABELS,
  ENCOUNTER_TYPES,
  type Encounter,
  type EncounterType,
} from '@/types/clinical';

const SELECT_CLASS = 'mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm';
const ATTENDABLE = [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED, AppointmentStatus.IN_PROGRESS];
const DAY_MS = 24 * 60 * 60 * 1000;

export type { EncounterPanelMode };

export function describeEncounter(encounter: Pick<Encounter, 'encounterType' | 'startedAt'>): string {
  const type = ENCOUNTER_TYPE_LABELS[encounter.encounterType as EncounterType] ?? encounter.encounterType;
  return `${type} · ${formatDate(encounter.startedAt, 'dd/MM/yyyy')}`;
}

export interface EncounterPanelProps {
  patientId: string;
  encounters: Encounter[];
  /** The open encounter of the signed-in professional with this patient, if any. */
  openEncounter?: Encounter;
  /** Arriving from the agenda: the start form opens with this appointment chosen. */
  initialAppointmentId?: string;
  /** 'treatments' starts from treatments alone; 'specialties' asks type and reason. */
  mode: EncounterPanelMode;
}

/** Starts, shows and closes the attention in course, and lists the previous ones. */
export function EncounterPanel({
  patientId,
  encounters,
  openEncounter,
  initialAppointmentId,
  mode,
}: EncounterPanelProps) {
  const [starting, setStarting] = useState(Boolean(initialAppointmentId));
  const [closing, setClosing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [markingNoShow, setMarkingNoShow] = useState(false);
  const { isEnabled } = useSections();
  const previous = encounters.filter((encounter) => encounter.id !== openEncounter?.id);
  const sessions = openEncounter?.treatmentSessions ?? [];
  const unfinished = unfinishedSessions(sessions);
  const closeBlocked = unfinished.length > 0;
  const addLimitReached = countedSessions(sessions).length >= MAX_TREATMENTS_PER_ENCOUNTER;
  const copy = PANEL_COPY[mode];

  return (
    <Card className={openEncounter ? 'border-primary/50' : undefined}>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>{openEncounter ? copy.titleOpen : copy.title}</CardTitle>
            <CardDescription>
              {openEncounter ? copy.descriptionOpen : copy.descriptionIdle}
            </CardDescription>
          </div>
          {!openEncounter && !starting && (
            <Button onClick={() => setStarting(true)}>
              <Play className="mr-2 h-4 w-4" />
              {copy.start}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {openEncounter && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{ENCOUNTER_TYPE_LABELS[openEncounter.encounterType]}</Badge>
              <span className="text-sm text-muted-foreground">
                {[
                  `Iniciada el ${formatDate(openEncounter.startedAt, 'dd/MM/yyyy HH:mm')}`,
                  openEncounter.branch?.name,
                  `${openEncounter.recordCount} ${openEncounter.recordCount === 1 ? 'registro' : 'registros'}`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </div>
            <p className="whitespace-pre-wrap text-sm">{openEncounter.reason}</p>
            <EncounterTreatmentList
              sessions={sessions}
              linked={isEnabled(TREATMENT_SESSIONS_SECTION)}
              mode={mode}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => setClosing(true)}
                disabled={closeBlocked}
                aria-describedby={closeBlocked ? 'close-blocked-hint' : undefined}
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                {copy.close}
              </Button>
              {isEnabled(TREATMENT_SESSIONS_SECTION) && (
                <Button variant="outline" onClick={() => setAdding(true)} disabled={addLimitReached}>
                  <Plus className="mr-2 h-4 w-4" />
                  Añadir tratamiento
                </Button>
              )}
              {isEnabled(TREATMENT_SESSIONS_SECTION) && addLimitReached && (
                <span className="self-center text-sm text-muted-foreground">{copy.limit}</span>
              )}
              {isEnabled(TREATMENT_SESSIONS_SECTION) && canRecordNoShow(sessions) && (
                <Button variant="outline" onClick={() => setMarkingNoShow(true)}>
                  <UserX className="mr-2 h-4 w-4" />
                  No asistió
                </Button>
              )}
              {mode !== 'treatments' && openEncounter.recordCount === 0 && sessions.length === 0 && (
                <Button variant="outline" onClick={() => setRemoving(true)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Eliminar atención
                </Button>
              )}
            </div>
            {closeBlocked && (
              <p id="close-blocked-hint" className="text-sm text-muted-foreground">
                Termina o cancela: {unfinished.map((session) => session.treatment.name).join(', ')}
              </p>
            )}
          </div>
        )}

        {starting && !openEncounter && (
          <StartEncounterForm
            patientId={patientId}
            initialAppointmentId={initialAppointmentId}
            mode={mode}
            onDone={() => setStarting(false)}
          />
        )}

        {previous.length > 0 && (
          <details className="rounded-md border border-input">
            <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
              {copy.previous} ({previous.length})
            </summary>
            <ul className="divide-y border-t">
              {previous.map((encounter) => (
                <li key={encounter.id} className="space-y-1 px-3 py-2 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{describeEncounter(encounter)}</span>
                    <Badge variant={encounter.status === 'OPEN' ? 'warning' : 'secondary'}>
                      {encounter.status === 'OPEN' ? 'Abierta' : encounter.signedAt ? 'Firmada' : 'Cerrada'}
                    </Badge>
                    <span className="text-muted-foreground">
                      {[
                        encounter.professional &&
                          `${encounter.professional.firstName} ${encounter.professional.lastName}`,
                        encounter.specialty?.name,
                        encounter.branch?.name,
                        `${encounter.recordCount} ${encounter.recordCount === 1 ? 'registro' : 'registros'}`,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap">{encounter.reason}</p>
                  {(encounter.treatmentSessions?.length ?? 0) > 0 && (
                    <p className="text-muted-foreground">
                      Tratamientos: {encounter.treatmentSessions?.map((item) => item.treatment.name).join(', ')}
                    </p>
                  )}
                  {encounter.status === 'CLOSED' && (
                    <p className="text-xs text-muted-foreground">
                      {encounter.signedAt
                        ? `Firmada el ${formatDate(encounter.signedAt, 'dd/MM/yyyy HH:mm')}${
                            encounter.contentHash ? ` · huella ${encounter.contentHash.slice(3, 15)}` : ''
                          }`
                        : 'Cerrada antes de la firma digital: sus registros son definitivos.'}
                    </p>
                  )}
                  {encounter.summary && (
                    <p className="whitespace-pre-wrap text-muted-foreground">{encounter.summary}</p>
                  )}
                </li>
              ))}
            </ul>
          </details>
        )}
      </CardContent>

      {closing && openEncounter && (
        <CloseEncounterDialog
          patientId={patientId}
          encounter={openEncounter}
          mode={mode}
          onClose={() => setClosing(false)}
        />
      )}
      {adding && openEncounter && (
        <AddTreatmentDialog
          patientId={patientId}
          encounter={openEncounter}
          mode={mode}
          onClose={() => setAdding(false)}
        />
      )}
      {markingNoShow && openEncounter && (
        <NoShowDialog
          patientId={patientId}
          encounter={openEncounter}
          mode={mode}
          onClose={() => setMarkingNoShow(false)}
        />
      )}
      {removing && openEncounter && (
        <RemoveEncounterDialog
          patientId={patientId}
          encounter={openEncounter}
          onClose={() => setRemoving(false)}
        />
      )}
    </Card>
  );
}

function StartEncounterForm({
  patientId,
  initialAppointmentId = '',
  mode,
  onDone,
}: {
  patientId: string;
  initialAppointmentId?: string;
  mode: EncounterPanelMode;
  onDone: () => void;
}) {
  const router = useRouter();
  const { isEnabled } = useSections();
  const userId = useAuthStore((state) => state.user?.id);
  const start = useStartEncounter(patientId);
  const create = useCreateTreatmentSessions(patientId);
  const { data: branches = [] } = useBranches();
  const { data: appointments = [] } = useAppointments({ patientId });
  const [encounterType, setEncounterType] = useState<EncounterType>('FIRST_VISIT');
  const [reason, setReason] = useState('');
  const [appointmentId, setAppointmentId] = useState(initialAppointmentId);
  const [branchId, setBranchId] = useState('');
  const [treatmentIds, setTreatmentIds] = useState<string[]>([]);

  const treatmentsMode = mode === 'treatments';
  const catalogVisible = treatmentsMode || isEnabled(TREATMENT_SESSIONS_SECTION);
  // The catalog is read only when it will be shown.
  const { data: catalog = [] } = useTreatments({ active: true }, { enabled: catalogVisible });
  const showTreatments = treatmentsMode || (catalogVisible && catalog.length > 0);
  const copy = PANEL_COPY[mode];
  const canSubmit = treatmentsMode ? treatmentIds.length > 0 : Boolean(reason.trim());
  const pending = start.isPending || create.isPending;

  const activeBranches = branches.filter((branch) => branch.isActive);
  // Own appointments of the last week that are still to be attended.
  const attendable = appointments.filter(
    (appointment) =>
      appointment.professionalId === userId &&
      ATTENDABLE.includes(appointment.status) &&
      Math.abs(new Date(appointment.startTime).getTime() - Date.now()) <= 7 * DAY_MS,
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit || pending) return;
    const context = {
      ...(appointmentId ? { appointmentId } : {}),
      ...(branchId ? { branchId } : {}),
    };
    try {
      if (treatmentIds.length === 0) {
        await start.mutateAsync({ encounterType, reason: reason.trim(), ...context });
        onDone();
        return;
      }
      // Keep the catalog order, whatever order they were added in.
      const orderedIds = catalog.filter((item) => treatmentIds.includes(item.id)).map((item) => item.id);
      const sessions = await create.mutateAsync({
        treatmentIds: orderedIds,
        ...(treatmentsMode ? {} : { encounterType, reason: reason.trim() }),
        ...context,
      });
      onDone();
      if (sessions.length === 1) router.push(`/treatment-sessions/${sessions[0].id}`);
    } catch {
      // The hook already reported the error; the form stays to retry.
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4 rounded-md border border-input p-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {!treatmentsMode && (
          <div>
            <Label htmlFor="encounter-type">Tipo de atención</Label>
            <select
              id="encounter-type"
              value={encounterType}
              onChange={(event) => setEncounterType(event.target.value as EncounterType)}
              className={SELECT_CLASS}
            >
              {ENCOUNTER_TYPES.map((type) => (
                <option key={type} value={type}>
                  {ENCOUNTER_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </div>
        )}
        {attendable.length > 0 && (
          <div>
            <Label htmlFor="encounter-appointment">Cita que se atiende</Label>
            <select
              id="encounter-appointment"
              value={appointmentId}
              onChange={(event) => setAppointmentId(event.target.value)}
              className={SELECT_CLASS}
            >
              <option value="">Sin cita</option>
              {attendable.map((appointment) => (
                <option key={appointment.id} value={appointment.id}>
                  {formatDate(appointment.startTime, 'dd/MM/yyyy HH:mm')} · {appointment.title}
                </option>
              ))}
            </select>
          </div>
        )}
        {activeBranches.length > 0 && (
          <div>
            <Label htmlFor="encounter-branch">Sede</Label>
            <select
              id="encounter-branch"
              value={branchId}
              onChange={(event) => setBranchId(event.target.value)}
              className={SELECT_CLASS}
            >
              <option value="">Selecciona una sede</option>
              {activeBranches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      {showTreatments && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">
            {treatmentsMode ? (
              <>
                Tratamientos<span className="text-destructive"> *</span>
              </>
            ) : (
              'Tratamientos (opcional)'
            )}
          </legend>
          <TreatmentPicker
            options={catalog}
            selected={treatmentIds}
            onChange={setTreatmentIds}
            limitText={copy.limit}
            emptyMessage="No hay tratamientos activos en el catálogo."
          />
        </fieldset>
      )}
      {!treatmentsMode && (
        <div>
          <Label htmlFor="encounter-reason">
            Motivo de consulta<span className="text-destructive"> *</span>
          </Label>
          <Textarea
            id="encounter-reason"
            rows={3}
            maxLength={2000}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </div>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!canSubmit} loading={pending}>
          {copy.start}
        </Button>
      </div>
    </form>
  );
}

function CloseEncounterDialog({
  patientId,
  encounter,
  mode,
  onClose,
}: {
  patientId: string;
  encounter: Encounter;
  mode: EncounterPanelMode;
  onClose: () => void;
}) {
  const copy = PANEL_COPY[mode];
  const close = useCloseEncounter(patientId);
  const [summary, setSummary] = useState('');
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string>();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (close.isPending || !password) return;
    setPasswordError(undefined);
    try {
      await close.mutateAsync({
        encounterId: encounter.id,
        summary: summary.trim() || undefined,
        password,
      });
      onClose();
    } catch (error) {
      // The hook already reported the error; the dialog stays open to retry.
      setPasswordError(signaturePasswordError(error));
    } finally {
      // Typed again for every attempt: it is never kept.
      setPassword('');
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <DialogHeader>
            <DialogTitle>{copy.close}</DialogTitle>
            <DialogDescription>{copy.closeDescription}</DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="encounter-summary">Resumen o indicaciones de cierre</Label>
            <Textarea
              id="encounter-summary"
              rows={3}
              maxLength={5000}
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
            />
          </div>
          <SignaturePasswordField
            id="close-password"
            value={password}
            onChange={setPassword}
            error={passwordError}
          />
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!password} loading={close.isPending}>
              Cerrar y firmar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RemoveEncounterDialog({
  patientId,
  encounter,
  onClose,
}: {
  patientId: string;
  encounter: Encounter;
  onClose: () => void;
}) {
  const remove = useRemoveEncounter(patientId);
  const [reason, setReason] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!reason.trim() || remove.isPending) return;
    try {
      await remove.mutateAsync({ encounterId: encounter.id, reason: reason.trim() });
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
            <DialogTitle>Eliminar atención</DialogTitle>
            <DialogDescription>
              Para una atención iniciada por error. Se conserva en la auditoría con el motivo que
              indiques y su cita vuelve a quedar pendiente.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="encounter-remove-reason">
              Motivo<span className="text-destructive"> *</span>
            </Label>
            <Textarea
              id="encounter-remove-reason"
              rows={2}
              maxLength={500}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" variant="destructive" disabled={!reason.trim()} loading={remove.isPending}>
              Eliminar atención
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
