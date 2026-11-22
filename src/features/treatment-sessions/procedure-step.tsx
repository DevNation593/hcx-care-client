'use client';

import { useEffect, useId, useState } from 'react';
import { Play } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
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
import { Textarea } from '@/components/ui/textarea';
import { useSessionCommand } from '@/hooks/useTreatmentSessions';
import type { ApiError } from '@/types';
import {
  MISSING_REQUIREMENT_LABELS,
  SESSION_STATUS_LABELS,
  type SessionCommandName,
  type TreatmentSessionDetail,
  type TreatmentSessionStatus,
} from '@/types/treatments';
import { cn } from '@/lib/utils';
import { ReasonDialog } from './consent-step';
import { NOTES_DRAFT_LABELS, type NotesDraftState } from './use-notes-draft';
import { SignaturePasswordField, signaturePasswordError } from '@/features/patients/signature-password-field';
import { unfinishedSiblings } from './encounter-navigation';

// The limits of the API's DTOs.
const PROCEDURE_NOTES_MAX = 10000;
const ENCOUNTER_SUMMARY_MAX = 5000;
const BEFORE_START: TreatmentSessionStatus[] = ['INTAKE_IN_PROGRESS', 'READY_FOR_CONSENT', 'CONSENTED'];

export interface ProcedureStepProps {
  session: TreatmentSessionDetail;
  /** For someone other than the session's professional: the status is shown, nothing to do. */
  readOnly?: boolean;
  /** The notes being typed; kept by the page so they survive moving between steps. */
  notes: string;
  onNotesChange: (notes: string) => void;
  /** Where the draft of the notes stands, when the page saves it while typing. */
  notesDraft?: NotesDraftState;
  /** Called once the session was completed or cancelled. */
  onDone?: () => void;
}

/**
 * Starts the procedure, takes its notes and completes it (closing the encounter too when it is the
 * last pending treatment), or ends the session by cancelling it. What can be done comes from
 * `allowedCommands`; what is missing for a start or a completion comes from the API's 422.
 */
export function ProcedureStep({
  session,
  readOnly = false,
  notes,
  onNotesChange,
  notesDraft = 'idle',
  onDone,
}: ProcedureStepProps) {
  const commands = useSessionCommand(session.id);
  const [failure, setFailure] = useState<ApiError | null>(null);
  const [cancelling, setCancelling] = useState(false);
  // Completing cannot be undone: it asks first.
  const [confirming, setConfirming] = useState(false);

  const can = (command: SessionCommandName) =>
    !readOnly && session.allowedCommands.includes(command);
  const { status } = session;
  const busy = commands.start.isPending || commands.complete.isPending;

  const run = async (action: () => Promise<unknown>, done?: () => void) => {
    setFailure(null);
    try {
      await action();
      done?.();
    } catch (error) {
      setFailure(error as ApiError);
    }
  };

  const trimmedNotes = notes.trim();
  // Notes left empty are not sent: the API decides whether they were required.
  const notesInput = trimmedNotes ? { procedureNotes: trimmedNotes } : {};
  const lastPending = unfinishedSiblings(session).length === 0;

  // Completes and closes the encounter. A wrong password is answered inside the dialog, which stays
  // open to retry; any other failure is shown by the step.
  const completeAndClose = async (password: string, summary: string): Promise<string | undefined> => {
    setFailure(null);
    try {
      await commands.complete.mutateAsync({
        ...notesInput,
        closeEncounter: true,
        password,
        ...(summary ? { encounterSummary: summary } : {}),
      });
    } catch (error) {
      // The mutation cache keeps the variables of the attempt: drop the password from it.
      commands.complete.reset();
      const passwordMessage = signaturePasswordError(error);
      if (passwordMessage) return passwordMessage;
      setFailure(error as ApiError);
      setConfirming(false);
      return undefined;
    }
    commands.complete.reset();
    setConfirming(false);
    onDone?.();
    return undefined;
  };

  return (
    <div className="space-y-6">
      {failure && <CommandFailure error={failure} />}

      {readOnly && (status === 'IN_PROGRESS' || BEFORE_START.includes(status)) && (
        <p className="text-sm text-muted-foreground">
          {status === 'IN_PROGRESS'
            ? 'El procedimiento está en curso.'
            : 'El procedimiento aún no se ha iniciado.'}
        </p>
      )}

      {!readOnly && BEFORE_START.includes(status) && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {!can('START')
              ? 'El procedimiento se podrá iniciar cuando termines los pasos anteriores.'
              : session.requirements.start.length === 0
                ? 'Todo está listo. Inicia el procedimiento cuando comiences la atención.'
                : 'Revisa los pendientes antes de iniciar.'}
          </p>
          <Button
            size="lg"
            className="w-full sm:w-auto"
            disabled={!can('START') || busy}
            loading={commands.start.isPending}
            onClick={() => run(() => commands.start.mutateAsync())}
          >
            <Play className="h-4 w-4" />
            Iniciar procedimiento
          </Button>
        </div>
      )}

      {!readOnly && status === 'IN_PROGRESS' && (
        <form
          noValidate
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!can('COMPLETE') || busy) return;
            setConfirming(true);
          }}
        >
          <div>
            <Label htmlFor="procedure-notes">
              Notas del procedimiento
              {session.policy.clinicalNotes.requiredForCompletion && (
                <span className="text-destructive"> *</span>
              )}
            </Label>
            <Textarea
              id="procedure-notes"
              rows={8}
              maxLength={PROCEDURE_NOTES_MAX}
              value={notes}
              onChange={(event) => onNotesChange(event.target.value)}
              disabled={commands.complete.isPending}
              aria-describedby="procedure-notes-draft"
            />
            <p
              id="procedure-notes-draft"
              role="status"
              className={cn(
                'mt-1 min-h-5 text-xs',
                notesDraft === 'error' ? 'text-destructive' : 'text-muted-foreground',
              )}
            >
              {notesDraft !== 'idle' && NOTES_DRAFT_LABELS[notesDraft]}
            </p>
          </div>
          <Button
            type="submit"
            size="lg"
            className="w-full sm:w-auto"
            disabled={!can('COMPLETE') || busy}
            loading={commands.complete.isPending}
          >
            Completar tratamiento
          </Button>
        </form>
      )}

      {!BEFORE_START.includes(status) && status !== 'IN_PROGRESS' && (
        <p className="text-sm text-muted-foreground">
          {SESSION_STATUS_LABELS[status]}: este tratamiento ya no admite cambios.
        </p>
      )}

      {can('CANCEL') && (
        <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row">
          <Button
            type="button"
            size="lg"
            variant="outline"
            disabled={busy}
            onClick={() => setCancelling(true)}
          >
            Cancelar tratamiento
          </Button>
        </div>
      )}

      {confirming && !lastPending && (
        <ConfirmDialog
          title="Completar tratamiento"
          description="Se registran las notas y el tratamiento queda completado. La atención sigue abierta. No se puede deshacer."
          confirmLabel="Completar"
          onConfirm={() => void run(() => commands.complete.mutateAsync(notesInput), onDone)}
          onClose={() => setConfirming(false)}
        />
      )}

      {confirming && lastPending && (
        <LastPendingDialog
          busy={busy}
          onCompleteAndStay={() => {
            setConfirming(false);
            void run(() => commands.complete.mutateAsync(notesInput), onDone);
          }}
          onCompleteAndClose={completeAndClose}
          onClose={() => setConfirming(false)}
        />
      )}

      {cancelling && (
        <ReasonDialog
          title="Cancelar tratamiento"
          description="El tratamiento termina y el motivo queda registrado. La atención sigue abierta."
          confirmLabel="Confirmar cancelación"
          onConfirm={async (reason) => {
            await commands.cancel.mutateAsync(reason);
            onDone?.();
          }}
          onClose={() => setCancelling(false)}
        />
      )}
    </div>
  );
}

/** Asks before an irreversible action; the step shows how the action went. */
function ConfirmDialog({
  title,
  description,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const titleId = useId();
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <DialogHeader>
          <DialogTitle id={titleId}>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button type="button" size="lg" variant="outline" onClick={onClose}>
            Volver
          </Button>
          <Button
            type="button"
            size="lg"
            onClick={() => {
              onClose();
              onConfirm();
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The three buttons of the last-pending dialog do not fit in one row of the modal: each takes the
 * full width on a phone, and its label wraps instead of sticking out when even that is not enough.
 */
const FOOTER_BUTTON = 'h-auto min-h-11 w-full whitespace-normal py-2 text-center sm:w-auto';

/**
 * Completing the last pending treatment of an encounter: close the encounter too (it signs, so it
 * asks the password again) or complete the treatment and stay in the encounter.
 */
function LastPendingDialog({
  busy,
  onCompleteAndStay,
  onCompleteAndClose,
  onClose,
}: {
  busy: boolean;
  onCompleteAndStay: () => void;
  onCompleteAndClose: (password: string, summary: string) => Promise<string | undefined>;
  onClose: () => void;
}) {
  const titleId = useId();
  const summaryId = useId();
  const passwordId = useId();
  const [summary, setSummary] = useState('');
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | undefined>();

  // A refused password sends the user back to retype it.
  useEffect(() => {
    if (passwordError && !busy) document.getElementById(passwordId)?.focus();
  }, [passwordError, busy, passwordId]);

  const closeEncounter = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || !password) return;
    setPasswordError(undefined);
    const error = await onCompleteAndClose(password, summary.trim());
    // Typed again for every attempt: the password is never kept.
    setPassword('');
    setPasswordError(error);
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <form onSubmit={(event) => void closeEncounter(event)} noValidate className="space-y-4">
          <DialogHeader>
            <DialogTitle id={titleId}>Completar tratamiento</DialogTitle>
            <DialogDescription>
              Es el último tratamiento pendiente de la atención. Puedes cerrar la atención ahora o
              completar solo el tratamiento y seguir en ella. No se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor={summaryId}>Resumen de la atención</Label>
              <Textarea
                id={summaryId}
                rows={3}
                maxLength={ENCOUNTER_SUMMARY_MAX}
                value={summary}
                disabled={busy}
                onChange={(event) => setSummary(event.target.value)}
              />
            </div>
            <SignaturePasswordField
              id={passwordId}
              value={password}
              onChange={setPassword}
              error={passwordError}
              disabled={busy}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" size="lg" variant="outline" className={FOOTER_BUTTON} onClick={onClose}>
              Volver
            </Button>
            <Button
              type="button"
              size="lg"
              variant="outline"
              className={FOOTER_BUTTON}
              disabled={busy}
              onClick={onCompleteAndStay}
            >
              Completar y seguir en la atención
            </Button>
            <Button
              type="submit"
              size="lg"
              className={FOOTER_BUTTON}
              disabled={busy || !password}
              loading={busy}
            >
              Completar y cerrar atención
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** A 422 lists what is missing; any other failure shows the message of the API. */
function CommandFailure({ error }: { error: ApiError }) {
  if (error.missing?.length) {
    return (
      <Alert variant="warning" title="Todavía no se puede continuar">
        <ul className="list-disc pl-5">
          {error.missing.map((code) => (
            <li key={code}>{MISSING_REQUIREMENT_LABELS[code] ?? code}</li>
          ))}
        </ul>
      </Alert>
    );
  }
  return (
    <Alert variant="destructive" title="No se pudo completar la acción">
      {error.message}
    </Alert>
  );
}
