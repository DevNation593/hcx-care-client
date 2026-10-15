'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useTreatmentSession } from '@/hooks/useTreatmentSessions';
import { cn } from '@/lib/utils';
import type { ApiError } from '@/types';
import {
  MISSING_REQUIREMENT_LABELS,
  SESSION_STATUS_LABELS,
  type TreatmentSessionDetail,
  type TreatmentSessionStatus,
} from '@/types/treatments';
import { CloseSummaryStep } from './close-summary-step';
import { ConsentStep, type ConsentOutcome } from './consent-step';
import { FormStep } from './form-step';
import { SESSION_STATUS_VARIANTS } from './patient-treatments-tab';
import { PhotosStep } from './photos-step';
import { ProcedureStep } from './procedure-step';
import { buildSessionSteps, type SessionStep, type SessionStepId } from './session-steps';

const STATE_LABELS: Record<SessionStep['state'], string> = {
  done: 'Completado',
  current: 'En curso',
  pending: 'Pendiente',
  skipped: 'No requerido',
  blocked: 'Detenido',
};

/** The tablet page of a treatment session: header, stepper and the chosen step. */
export function SessionWorkflow({ id }: { id: string }) {
  const { data: session, isPending, isError, error, refetch } = useTreatmentSession(id);
  // A step picked to review; otherwise the page follows the current one.
  const [selected, setSelected] = useState<SessionStepId | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const shownStep = useRef<SessionStepId | null>(null);
  const chosenByUser = useRef(false);
  // The status a refusal or revocation left behind, until the refetched session reports the new one.
  const awaitingStatusFrom = useRef<TreatmentSessionStatus | null>(null);
  const [announcement, setAnnouncement] = useState('');
  // The procedure notes being typed; null until the user types, so the saved ones show meanwhile.
  const [typedNotes, setTypedNotes] = useState<string | null>(null);

  const steps = session ? buildSessionSteps(session) : [];
  const reachable = steps.filter((step) => step.state !== 'skipped');
  const current =
    steps.find((step) => step.state === 'current' || step.state === 'blocked') ?? reachable.at(-1);
  const active = reachable.find((step) => step.id === selected) ?? current;

  // When the session moves on by itself (a saved form, a signature, a refusal) the focus
  // follows the new step and its name is announced; a step the user picked keeps the focus.
  const activeId = active?.id;
  const activeLabel = active?.label;
  useEffect(() => {
    if (!activeId) return;
    const previous = shownStep.current;
    shownStep.current = activeId;
    if (previous === null || previous === activeId) return;
    // A refusal or revocation is announced with its status once the server reports it.
    if (awaitingStatusFrom.current) return;
    if (chosenByUser.current) {
      chosenByUser.current = false;
      return;
    }
    headingRef.current?.focus();
    setAnnouncement(`Paso actual: ${activeLabel}`);
  }, [activeId, activeLabel]);

  // A refusal or revocation may leave the same step on screen (now blocked) while the button that
  // triggered it is gone: once the new status arrives, the focus returns to the step and the
  // status is announced, whether or not the step changed.
  const status = session?.status;
  useEffect(() => {
    const from = awaitingStatusFrom.current;
    if (!from || !status || status === from) return;
    awaitingStatusFrom.current = null;
    headingRef.current?.focus();
    setAnnouncement(`${SESSION_STATUS_LABELS[status]}. Paso actual: ${activeLabel}`);
  }, [status, activeLabel]);

  const choose = (id: SessionStepId) => {
    if (id === activeId) return;
    awaitingStatusFrom.current = null;
    chosenByUser.current = true;
    setSelected(id);
  };
  const followSession = () => setSelected(null);
  const consentDone = (outcome: ConsentOutcome) => {
    if (outcome !== 'signed' && status) awaitingStatusFrom.current = status;
    followSession();
  };
  // A closed, cancelled or absent session ends at the summary; the focus follows like any new step.
  const showClose = () => setSelected('close');

  if (isPending) {
    return (
      <div className="space-y-4" role="status" aria-label="Cargando la atención">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (isError || !session || !active) {
    return (
      <Alert variant="destructive" title="No se pudo cargar la atención">
        {(error as ApiError | null)?.message}
        <div>
          <Button variant="outline" size="lg" className="mt-2" onClick={() => refetch()}>
            Reintentar
          </Button>
        </div>
      </Alert>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <SessionHeader session={session} />
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {session.cancellationReason && (
        <Alert variant="warning" title={SESSION_STATUS_LABELS[session.status]}>
          {session.cancellationReason}
        </Alert>
      )}

      <nav aria-label="Pasos de la atención">
        <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {steps.map((step, index) => (
            <li key={step.id}>
              <button
                type="button"
                disabled={step.state === 'skipped'}
                aria-current={step.id === current?.id ? 'step' : undefined}
                aria-pressed={step.id === active.id}
                onClick={() => choose(step.id)}
                className={cn(
                  'flex min-h-14 w-full items-center gap-3 rounded-md border px-3 py-2 text-left text-sm transition-colors',
                  step.id === active.id ? 'border-primary bg-primary/5' : 'border-input hover:bg-accent',
                  step.state === 'skipped' && 'cursor-not-allowed opacity-50',
                  step.state === 'blocked' && 'border-destructive/60',
                )}
              >
                <span
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
                    step.state === 'done' && 'border-green-600 bg-green-600 text-white',
                    step.state === 'current' && 'border-primary text-primary',
                  )}
                  aria-hidden
                >
                  {step.state === 'done' ? <Check className="h-4 w-4" /> : index + 1}
                </span>
                <span className="min-w-0">
                  <span className="block font-medium">{step.label}</span>
                  <span className="block text-xs text-muted-foreground">{STATE_LABELS[step.state]}</span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <Card>
        <CardHeader>
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="text-2xl font-semibold leading-none tracking-tight focus:outline-none"
          >
            {active.label}
          </h2>
        </CardHeader>
        <CardContent className="space-y-6">
          {active.missing.length > 0 && (
            <Alert variant="warning" title="Falta para continuar">
              <ul className="list-disc pl-5">
                {active.missing.map((code) => (
                  <li key={code}>{MISSING_REQUIREMENT_LABELS[code]}</li>
                ))}
              </ul>
            </Alert>
          )}
          {active.id === 'form' && (
            <FormStep key={session.formRecordId ?? 'new'} session={session} onSaved={followSession} />
          )}
          {active.id === 'consent' && <ConsentStep session={session} onDone={consentDone} />}
          {active.id === 'before' && <PhotosStep session={session} phase="BEFORE" />}
          {active.id === 'procedure' && (
            <ProcedureStep
              session={session}
              notes={typedNotes ?? session.procedureNotes ?? ''}
              onNotesChange={setTypedNotes}
              onDone={showClose}
            />
          )}
          {active.id === 'after' && <PhotosStep session={session} phase="AFTER" />}
          {active.id === 'close' && <CloseSummaryStep session={session} />}
        </CardContent>
      </Card>
    </div>
  );
}

function SessionHeader({ session }: { session: TreatmentSessionDetail }) {
  const { patient, treatment } = session;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Link
        href={`/patients/${session.patientId}?tab=treatments`}
        aria-label="Volver al paciente"
        className="inline-flex h-11 w-11 items-center justify-center rounded-md hover:bg-accent"
      >
        <ArrowLeft className="h-5 w-5" />
      </Link>
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-bold">
          {patient.firstName} {patient.lastName}
        </h1>
        <p className="text-sm text-muted-foreground">
          {treatment.name} · versión {treatment.version}
        </p>
      </div>
      <Badge variant={SESSION_STATUS_VARIANTS[session.status]} className="text-sm">
        {SESSION_STATUS_LABELS[session.status]}
      </Badge>
    </div>
  );
}
