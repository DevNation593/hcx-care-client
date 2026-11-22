'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight, X } from 'lucide-react';
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
import { Label } from '@/components/ui/label';
import { SESSION_STATUS_VARIANTS } from '@/features/treatment-sessions/patient-treatments-tab';
import { useEncounterNoShow, useCreateTreatmentSessions } from '@/hooks/useTreatmentSessions';
import { useTreatments } from '@/hooks/useTreatments';
import { withReturnTab } from '@/lib/patient-tabs';
import type { Encounter } from '@/types/clinical';
import { SESSION_STATUS_LABELS, type TreatmentSessionStatus } from '@/types/treatments';

export const TREATMENT_SESSIONS_SECTION = 'core.treatments.sessions';
export const MAX_TREATMENTS_PER_ENCOUNTER = 10;

/** 'treatments' starts from treatments alone; 'specialties' asks type and reason. */
export type EncounterPanelMode = 'specialties' | 'treatments';

/** Every user-facing string of the panel that names the encounter, by mode: "atención" or "tratamiento". */
export const PANEL_COPY = {
  specialties: {
    title: 'Atención',
    titleOpen: 'Atención en curso',
    descriptionIdle: 'Inicia una atención para agrupar los registros de la consulta de hoy.',
    descriptionOpen: 'Los registros que guardes quedan dentro de esta atención hasta que la cierres.',
    start: 'Iniciar atención',
    close: 'Cerrar atención',
    closeDescription:
      'Al cerrarla firmas la atención y sus registros: no admite más registros y su cita queda como atendida. Después, cada registro solo se corrige con una adenda; el original se conserva tal como se firmó.',
    previous: 'Atenciones anteriores',
    limit: `Máximo ${MAX_TREATMENTS_PER_ENCOUNTER} tratamientos por atención`,
    treatmentList: 'Tratamientos de la atención',
    addDescription: 'Elige los tratamientos que también se realizarán en esta atención.',
    addEmpty: 'No quedan tratamientos activos por añadir a esta atención.',
    noShowDescription:
      'Se marcarán como no asistidos cada tratamiento y la cita de esta atención. Esta acción no se puede deshacer.',
  },
  treatments: {
    title: 'Tratamiento',
    titleOpen: 'Tratamiento en curso',
    descriptionIdle: 'Inicia un tratamiento para la consulta de hoy.',
    descriptionOpen: 'Los registros que guardes quedan dentro de este tratamiento hasta que lo cierres.',
    start: 'Iniciar tratamiento',
    close: 'Cerrar tratamiento',
    closeDescription:
      'Al cerrarlo firmas el tratamiento y sus registros: no admite más registros y su cita queda como atendida. Después, cada registro solo se corrige con una adenda; el original se conserva tal como se firmó.',
    previous: 'Tratamientos anteriores',
    limit: `Máximo ${MAX_TREATMENTS_PER_ENCOUNTER} tratamientos`,
    treatmentList: 'Tratamientos incluidos',
    addDescription: 'Elige los tratamientos que también se realizarán en esta consulta.',
    addEmpty: 'No quedan tratamientos activos por añadir.',
    noShowDescription:
      'Se marcarán como no asistidos todos los tratamientos incluidos y la cita. Esta acción no se puede deshacer.',
  },
} as const satisfies Record<EncounterPanelMode, Record<string, string>>;

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

const PICKER_SELECT_CLASS = 'mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[44px]';

/**
 * Picks treatments from the catalog with a labelled list and shows what was chosen, each with
 * its remove button. `alreadyCounted` are the treatments that already count toward the limit
 * (the live ones of the encounter, in the add dialog); the chosen ones are kept in catalog order.
 */
export function TreatmentPicker({
  options,
  selected,
  onChange,
  alreadyCounted = 0,
  limitText,
  emptyMessage,
}: {
  options: { id: string; name: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
  alreadyCounted?: number;
  limitText: string;
  emptyMessage?: string;
}) {
  const selectId = useId();
  const selectRef = useRef<HTMLSelectElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const refocus = useRef(false);
  const [rawPending, setPending] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const chosen = options.filter((item) => selected.includes(item.id));
  const remaining = options.filter((item) => !selected.includes(item.id));
  // A refetched catalog may drop the pending choice: never act on an id that is not offered.
  const pending = remaining.some((item) => item.id === rawPending) ? rawPending : '';
  const limitReached = alreadyCounted + selected.length >= MAX_TREATMENTS_PER_ENCOUNTER;

  useEffect(() => {
    if (rawPending !== pending) setPending(pending);
  }, [rawPending, pending]);

  // The focused button disables or unmounts when the list changes: keep focus inside the picker.
  useEffect(() => {
    if (!refocus.current) return;
    refocus.current = false;
    const select = selectRef.current;
    if (select && !select.disabled) select.focus();
    else listRef.current?.querySelector<HTMLElement>('li:last-child button')?.focus();
  }, [selected]);

  const add = () => {
    if (!pending || limitReached) return;
    const name = options.find((item) => item.id === pending)?.name ?? '';
    refocus.current = true;
    setAnnouncement(`${name} agregado`);
    onChange([...selected, pending]);
    setPending('');
  };

  const remove = (item: { id: string; name: string }) => {
    refocus.current = true;
    setAnnouncement(`${item.name} quitado`);
    onChange(selected.filter((id) => id !== item.id));
  };

  return (
    <div className="space-y-2">
      {options.length === 0 && emptyMessage && (
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      )}
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <Label htmlFor={selectId}>Tratamiento</Label>
          <select
            id={selectId}
            ref={selectRef}
            value={pending}
            disabled={remaining.length === 0}
            onChange={(event) => setPending(event.target.value)}
            className={PICKER_SELECT_CLASS}
          >
            <option value="">Selecciona un tratamiento</option>
            {remaining.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
        <Button
          type="button"
          variant="outline"
          className="min-h-[44px]"
          disabled={!pending || limitReached}
          onClick={add}
        >
          Agregar
        </Button>
      </div>
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>
      {pending && selected.length === 0 && (
        <p className="text-sm text-muted-foreground">Pulsa Agregar para incluir el tratamiento elegido.</p>
      )}
      {limitReached && (
        <p role="status" className="text-sm text-muted-foreground">
          {limitText}
        </p>
      )}
      {chosen.length > 0 && (
        <ul ref={listRef} aria-label="Tratamientos elegidos" className="divide-y rounded-md border border-input">
          {chosen.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-2 py-1 pl-3 pr-1 text-sm">
              <span className="font-medium">{item.name}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-11 w-11 shrink-0"
                aria-label={`Quitar ${item.name}`}
                onClick={() => remove(item)}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * The treatments of the encounter and their status. `linked` offers to continue each one; it is
 * off while the treatment sessions section is disabled, as their page is not available then.
 */
export function EncounterTreatmentList({
  sessions,
  linked = true,
  mode = 'specialties',
}: {
  sessions: EncounterSessions;
  linked?: boolean;
  mode?: EncounterPanelMode;
}) {
  if (sessions.length === 0) return null;
  return (
    <ul aria-label={PANEL_COPY[mode].treatmentList} className="divide-y rounded-md border border-input">
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
              href={withReturnTab(`/treatment-sessions/${session.id}`, mode)}
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
  mode,
  onClose,
}: {
  patientId: string;
  encounter: Encounter;
  mode: EncounterPanelMode;
  onClose: () => void;
}) {
  const copy = PANEL_COPY[mode];
  const router = useRouter();
  const legendId = useId();
  const create = useCreateTreatmentSessions(patientId);
  const { data: catalog = [] } = useTreatments({ active: true });
  const [treatmentIds, setTreatmentIds] = useState<string[]>([]);

  const present = countedSessions(encounter.treatmentSessions);
  const presentIds = new Set(present.map((session) => session.treatment.id));
  const available = catalog.filter((item) => !presentIds.has(item.id));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (treatmentIds.length === 0 || create.isPending) return;
    try {
      // Keep the catalog order, whatever order they were added in.
      const orderedIds = available.filter((item) => treatmentIds.includes(item.id)).map((item) => item.id);
      const sessions = await create.mutateAsync({ treatmentIds: orderedIds, encounterId: encounter.id });
      onClose();
      if (sessions.length === 1) router.push(withReturnTab(`/treatment-sessions/${sessions[0].id}`, mode));
    } catch {
      // The hook already reported the error; the dialog stays open to retry.
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      {/* The page does not scroll under a dialog: the catalog scrolls inside it, the buttons stay in reach. */}
      <DialogContent
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${legendId}-title`}
        className="flex max-h-[90dvh] flex-col"
      >
        <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-1 flex-col gap-4">
          <DialogHeader>
            <DialogTitle id={`${legendId}-title`}>Añadir tratamiento</DialogTitle>
            <DialogDescription>{copy.addDescription}</DialogDescription>
          </DialogHeader>
          <fieldset aria-labelledby={legendId} className="min-h-0 flex-1 space-y-2 overflow-y-auto">
            <legend id={legendId} className="text-sm font-medium">
              Tratamientos
            </legend>
            {available.length === 0 ? (
              <p className="text-sm text-muted-foreground">{copy.addEmpty}</p>
            ) : (
              <TreatmentPicker
                options={available}
                selected={treatmentIds}
                onChange={setTreatmentIds}
                alreadyCounted={present.length}
                limitText={copy.limit}
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
  mode,
  onClose,
}: {
  patientId: string;
  encounter: Encounter;
  mode: EncounterPanelMode;
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
          <DialogDescription>{PANEL_COPY[mode].noShowDescription}</DialogDescription>
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
