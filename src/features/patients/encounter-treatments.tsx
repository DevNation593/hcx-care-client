'use client';

import { useId, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SESSION_STATUS_VARIANTS } from '@/features/treatment-sessions/patient-treatments-tab';
import { useEncounterNoShow, useCreateTreatmentSessions } from '@/hooks/useTreatmentSessions';
import { useTreatments } from '@/hooks/useTreatments';
import type { Encounter } from '@/types/clinical';
import { SESSION_STATUS_LABELS, type TreatmentSessionStatus } from '@/types/treatments';

export const TREATMENT_SESSIONS_SECTION = 'core.treatments.sessions';
export const MAX_TREATMENTS_PER_ENCOUNTER = 10;

/** A session in these statuses still has clinical work pending: the encounter cannot be closed. */
const UNFINISHED: TreatmentSessionStatus[] = [
  'INTAKE_IN_PROGRESS',
  'READY_FOR_CONSENT',
  'CONSENTED',
  'IN_PROGRESS',
];
/** Before the procedure starts: the only moment a no-show of the whole encounter makes sense. */
const BEFORE_PROCEDURE: TreatmentSessionStatus[] = ['INTAKE_IN_PROGRESS', 'READY_FOR_CONSENT', 'CONSENTED'];

type EncounterSessions = NonNullable<Encounter['treatmentSessions']>;

/** Cancelled and no-show sessions neither count toward the limit nor block re-adding their treatment. */
export function countedSessions(sessions: EncounterSessions = []): EncounterSessions {
  return sessions.filter((session) => session.status !== 'CANCELLED' && session.status !== 'NO_SHOW');
}

export function unfinishedSessions(sessions: EncounterSessions = []): EncounterSessions {
  return sessions.filter((session) => UNFINISHED.includes(session.status));
}

/**
 * The API decides; this only hides the button when it evidently does not apply: at least one
 * session still waits, and every other one was cancelled or did not attend.
 */
export function canRecordNoShow(sessions: EncounterSessions = []): boolean {
  const waiting = (session: EncounterSessions[number]) => BEFORE_PROCEDURE.includes(session.status);
  return (
    sessions.some(waiting) &&
    sessions.every((session) => waiting(session) || session.status === 'CANCELLED' || session.status === 'NO_SHOW')
  );
}

export function TreatmentCheckboxes({
  options,
  selected,
  limitReached,
  onToggle,
}: {
  options: { id: string; name: string }[];
  selected: string[];
  limitReached: boolean;
  onToggle: (id: string, checked: boolean) => void;
}) {
  return (
    <>
      <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
        {options.map((item) => {
          const checked = selected.includes(item.id);
          const disabled = !checked && limitReached;
          return (
            <label
              key={item.id}
              className={`flex min-h-[44px] items-center gap-2 rounded-md border border-input px-3 py-2 text-sm ${
                disabled ? 'opacity-50' : 'cursor-pointer'
              }`}
            >
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={checked}
                disabled={disabled}
                onChange={(event) => onToggle(item.id, event.target.checked)}
              />
              {item.name}
            </label>
          );
        })}
      </div>
      {limitReached && (
        <p className="text-sm text-muted-foreground">
          Máximo {MAX_TREATMENTS_PER_ENCOUNTER} tratamientos por atención
        </p>
      )}
    </>
  );
}

/**
 * The treatments of the encounter and their status. `linked` offers to continue each one; it is
 * off while the treatment sessions section is disabled, as their page is not available then.
 */
export function EncounterTreatmentList({
  sessions,
  linked = true,
}: {
  sessions: EncounterSessions;
  linked?: boolean;
}) {
  if (sessions.length === 0) return null;
  return (
    <ul aria-label="Tratamientos de la atención" className="divide-y rounded-md border border-input">
      {sessions.map((session) => (
        <li key={session.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{session.treatment.name}</span>
            <Badge variant={SESSION_STATUS_VARIANTS[session.status]}>
              {SESSION_STATUS_LABELS[session.status]}
            </Badge>
          </div>
          {linked && (
            <Link
              href={`/treatment-sessions/${session.id}`}
              aria-label={`Continuar ${session.treatment.name}`}
              className="inline-flex min-h-[44px] items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              Continuar
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}

export function AddTreatmentDialog({
  patientId,
  encounter,
  onClose,
}: {
  patientId: string;
  encounter: Encounter;
  onClose: () => void;
}) {
  const router = useRouter();
  const legendId = useId();
  const create = useCreateTreatmentSessions(patientId);
  const { data: catalog = [] } = useTreatments({ active: true });
  const [treatmentIds, setTreatmentIds] = useState<string[]>([]);

  const present = countedSessions(encounter.treatmentSessions);
  const presentIds = new Set(present.map((session) => session.treatment.id));
  const available = catalog.filter((item) => !presentIds.has(item.id));
  const limitReached = present.length + treatmentIds.length >= MAX_TREATMENTS_PER_ENCOUNTER;

  const toggle = (id: string, checked: boolean) =>
    setTreatmentIds((current) => (checked ? [...current, id] : current.filter((item) => item !== id)));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (treatmentIds.length === 0 || create.isPending) return;
    try {
      // Keep the catalog order, whatever order the boxes were checked in.
      const orderedIds = available.filter((item) => treatmentIds.includes(item.id)).map((item) => item.id);
      const sessions = await create.mutateAsync({ treatmentIds: orderedIds, encounterId: encounter.id });
      onClose();
      if (sessions.length === 1) router.push(`/treatment-sessions/${sessions[0].id}`);
    } catch {
      // The hook already reported the error; the dialog stays open to retry.
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent role="dialog" aria-modal="true" aria-labelledby={`${legendId}-title`}>
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <DialogHeader>
            <DialogTitle id={`${legendId}-title`}>Añadir tratamiento</DialogTitle>
            <DialogDescription>
              Elige los tratamientos que también se realizarán en esta atención.
            </DialogDescription>
          </DialogHeader>
          <fieldset aria-labelledby={legendId} className="space-y-2">
            <legend id={legendId} className="text-sm font-medium">
              Tratamientos
            </legend>
            {available.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No quedan tratamientos activos por añadir a esta atención.
              </p>
            ) : (
              <TreatmentCheckboxes
                options={available}
                selected={treatmentIds}
                limitReached={limitReached}
                onToggle={toggle}
              />
            )}
          </fieldset>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={treatmentIds.length === 0} loading={create.isPending}>
              Añadir
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function NoShowDialog({
  patientId,
  encounter,
  onClose,
}: {
  patientId: string;
  encounter: Encounter;
  onClose: () => void;
}) {
  const noShow = useEncounterNoShow(patientId);
  const [error, setError] = useState<string>();

  const handleConfirm = async () => {
    if (noShow.isPending) return;
    setError(undefined);
    try {
      await noShow.mutateAsync(encounter.id);
      onClose();
    } catch (caught) {
      // The hook already toasted; the dialog also keeps the reason the API gave (e.g. 409).
      setError((caught as { message?: string })?.message || 'No fue posible registrar la inasistencia');
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent role="dialog" aria-modal="true" aria-labelledby="no-show-title">
        <DialogHeader>
          <DialogTitle id="no-show-title">Registrar inasistencia</DialogTitle>
          <DialogDescription>
            Se marcarán como no asistidos cada tratamiento y la cita de esta atención. Esta acción no se
            puede deshacer.
          </DialogDescription>
        </DialogHeader>
        {error && <Alert variant="destructive">{error}</Alert>}
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" variant="destructive" onClick={handleConfirm} loading={noShow.isPending}>
            Registrar inasistencia
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
