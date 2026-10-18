'use client';

import { useState } from 'react';
import { CheckCircle2, Play, Trash2 } from 'lucide-react';
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
import { formatDate } from '@/lib/utils';
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
}

/** Starts, shows and closes the attention in course, and lists the previous ones. */
export function EncounterPanel({
  patientId,
  encounters,
  openEncounter,
  initialAppointmentId,
}: EncounterPanelProps) {
  const [starting, setStarting] = useState(Boolean(initialAppointmentId));
  const [closing, setClosing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const previous = encounters.filter((encounter) => encounter.id !== openEncounter?.id);

  return (
    <Card className={openEncounter ? 'border-primary/50' : undefined}>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>{openEncounter ? 'Atención en curso' : 'Atención'}</CardTitle>
            <CardDescription>
              {openEncounter
                ? 'Los registros que guardes quedan dentro de esta atención hasta que la cierres.'
                : 'Inicia una atención para agrupar los registros de la consulta de hoy.'}
            </CardDescription>
          </div>
          {!openEncounter && !starting && (
            <Button onClick={() => setStarting(true)}>
              <Play className="mr-2 h-4 w-4" />
              Iniciar atención
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
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setClosing(true)}>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Cerrar atención
              </Button>
              {openEncounter.recordCount === 0 && (
                <Button variant="outline" onClick={() => setRemoving(true)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Eliminar atención
                </Button>
              )}
            </div>
          </div>
        )}

        {starting && !openEncounter && (
          <StartEncounterForm
            patientId={patientId}
            initialAppointmentId={initialAppointmentId}
            onDone={() => setStarting(false)}
          />
        )}

        {previous.length > 0 && (
          <details className="rounded-md border border-input">
            <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
              Atenciones anteriores ({previous.length})
            </summary>
            <ul className="divide-y border-t">
              {previous.map((encounter) => (
                <li key={encounter.id} className="space-y-1 px-3 py-2 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{describeEncounter(encounter)}</span>
                    <Badge variant={encounter.status === 'OPEN' ? 'warning' : 'secondary'}>
                      {encounter.status === 'OPEN' ? 'Abierta' : 'Cerrada'}
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
          onClose={() => setClosing(false)}
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
  onDone,
}: {
  patientId: string;
  initialAppointmentId?: string;
  onDone: () => void;
}) {
  const userId = useAuthStore((state) => state.user?.id);
  const start = useStartEncounter(patientId);
  const { data: branches = [] } = useBranches();
  const { data: appointments = [] } = useAppointments({ patientId });
  const [encounterType, setEncounterType] = useState<EncounterType>('FIRST_VISIT');
  const [reason, setReason] = useState('');
  const [appointmentId, setAppointmentId] = useState(initialAppointmentId);
  const [branchId, setBranchId] = useState('');

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
    if (!reason.trim() || start.isPending) return;
    try {
      await start.mutateAsync({
        encounterType,
        reason: reason.trim(),
        ...(appointmentId ? { appointmentId } : {}),
        ...(branchId ? { branchId } : {}),
      });
      onDone();
    } catch {
      // The hook already reported the error; the form stays to retry.
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4 rounded-md border border-input p-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!reason.trim()} loading={start.isPending}>
          Iniciar atención
        </Button>
      </div>
    </form>
  );
}

function CloseEncounterDialog({
  patientId,
  encounter,
  onClose,
}: {
  patientId: string;
  encounter: Encounter;
  onClose: () => void;
}) {
  const close = useCloseEncounter(patientId);
  const [summary, setSummary] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (close.isPending) return;
    try {
      await close.mutateAsync({ encounterId: encounter.id, summary: summary.trim() || undefined });
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
            <DialogTitle>Cerrar atención</DialogTitle>
            <DialogDescription>
              Al cerrarla firmas la atención: no admite más registros y su cita queda como atendida.
              Los registros ya guardados se pueden corregir con motivo.
            </DialogDescription>
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
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={close.isPending}>
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
