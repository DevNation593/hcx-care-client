'use client';

import { useState } from 'react';
import { Play } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
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
import { ReasonDialog } from './consent-step';

// The limit of the API's DTO.
const PROCEDURE_NOTES_MAX = 10000;
const BEFORE_START: TreatmentSessionStatus[] = ['INTAKE_IN_PROGRESS', 'READY_FOR_CONSENT', 'CONSENTED'];

export interface ProcedureStepProps {
  session: TreatmentSessionDetail;
  /** Called once the session was closed, cancelled or marked as a no-show. */
  onDone?: () => void;
}

/**
 * Starts the procedure, takes its notes and closes it, or ends the session by cancelling it or
 * marking the patient as absent. What can be done comes from `allowedCommands`; what is missing
 * for a start or a close comes from the API's 422.
 */
export function ProcedureStep({ session, onDone }: ProcedureStepProps) {
  const commands = useSessionCommand(session.id);
  const [notes, setNotes] = useState(session.procedureNotes ?? '');
  const [failure, setFailure] = useState<ApiError | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const can = (command: SessionCommandName) =>
    session.allowedCommands.includes(command);
  const { status } = session;
  const busy = commands.start.isPending || commands.complete.isPending || commands.noShow.isPending;

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

  return (
    <div className="space-y-6">
      {failure && <CommandFailure error={failure} />}

      {BEFORE_START.includes(status) && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {can('START')
              ? 'Todo está listo. Inicia el procedimiento cuando comiences la atención.'
              : 'El procedimiento se podrá iniciar cuando termines los pasos anteriores.'}
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

      {status === 'IN_PROGRESS' && (
        <form
          noValidate
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!can('COMPLETE') || busy) return;
            // Notes left empty are not sent: the API decides whether they were required.
            void run(
              () => commands.complete.mutateAsync(trimmedNotes ? trimmedNotes : undefined),
              onDone,
            );
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
              onChange={(event) => setNotes(event.target.value)}
              disabled={commands.complete.isPending}
            />
          </div>
          <Button
            type="submit"
            size="lg"
            className="w-full sm:w-auto"
            disabled={!can('COMPLETE') || busy}
            loading={commands.complete.isPending}
          >
            Cerrar atención
          </Button>
        </form>
      )}

      {!BEFORE_START.includes(status) && status !== 'IN_PROGRESS' && (
        <p className="text-sm text-muted-foreground">
          {SESSION_STATUS_LABELS[status]}: esta atención ya no admite cambios.
        </p>
      )}

      {(can('CANCEL') || can('NO_SHOW')) && (
        <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row">
          {can('CANCEL') && (
            <Button
              type="button"
              size="lg"
              variant="outline"
              disabled={busy}
              onClick={() => setCancelling(true)}
            >
              Cancelar atención
            </Button>
          )}
          {can('NO_SHOW') && (
            <Button
              type="button"
              size="lg"
              variant="outline"
              disabled={busy}
              loading={commands.noShow.isPending}
              onClick={() => run(() => commands.noShow.mutateAsync(), onDone)}
            >
              No asistió
            </Button>
          )}
        </div>
      )}

      {cancelling && (
        <ReasonDialog
          title="Cancelar atención"
          description="La atención termina y el motivo queda registrado. No se puede deshacer."
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
