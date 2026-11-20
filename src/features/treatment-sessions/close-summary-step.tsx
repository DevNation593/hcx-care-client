'use client';

import Link from 'next/link';
import { Alert } from '@/components/ui/alert';
import {
  SESSION_STATUS_LABELS,
  type ConsentDocumentSummary,
  type TreatmentSessionDetail,
  type TreatmentSessionStatus,
} from '@/types/treatments';
import { DOCUMENT_STATUS_LABELS, formatSignedAt } from './consent-step';
import { usePatientTerms } from '@/hooks/usePatientTerms';
import { useSections } from '@/hooks/useSections';
import { encounterBackHref, unfinishedSiblings } from './encounter-navigation';

// Statuses that end a session without closing it clinically.
const ENDED_NOTICES: Partial<Record<TreatmentSessionStatus, string>> = {
  CANCELLED: 'El tratamiento fue cancelado.',
  NO_SHOW: 'El {one} no asistió.',
  CONSENT_REFUSED: 'Consentimiento rechazado.',
  CONSENT_REVOKED: 'Consentimiento revocado.',
};

function consentState(session: TreatmentSessionDetail): string {
  if (!session.policy.informedConsent.required) return 'No requerido';
  const documents = session.consentDocuments;
  const document: ConsentDocumentSummary | undefined =
    documents.find((item) => item.id === session.consentDocumentId) ??
    documents.find((item) => item.status === 'SIGNED') ??
    documents.at(-1);
  if (!document) return 'Pendiente';
  const label = DOCUMENT_STATUS_LABELS[document.status];
  return document.status === 'SIGNED' && document.signedAt
    ? `${label} el ${formatSignedAt(document.signedAt, session.timezone)}`
    : label;
}

/** A read-only summary of how the session stands; it changes nothing. */
export function CloseSummaryStep({ session }: { session: TreatmentSessionDetail }) {
  const terms = usePatientTerms();
  const { isEnabled } = useSections();
  // Only an open encounter has a next treatment to go to.
  const nextSession =
    session.encounterStatus === 'OPEN' ? unfinishedSiblings(session)[0] : undefined;
  const count = (phase: 'BEFORE' | 'AFTER') =>
    session.media.filter((media) => media.phase === phase).length;
  const times: [string, string | null][] = [
    ['Inicio', session.startedAt],
    ['Cierre', session.completedAt],
    ['Cancelación', session.cancelledAt],
  ];

  return (
    <div className="space-y-4">
      {ENDED_NOTICES[session.status] ? (
        <Alert variant="default">{ENDED_NOTICES[session.status]?.replace('{one}', terms.one)}</Alert>
      ) : (
        !['CLINICAL_COMPLETE', 'BILLING_PENDING', 'BILLED', 'BILLING_FAILED'].includes(session.status) && (
          <Alert variant="default">
            Este resumen es de solo lectura y se completa al terminar el tratamiento.
          </Alert>
        )
      )}
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
        <dt className="text-muted-foreground">Estado</dt>
        <dd>{SESSION_STATUS_LABELS[session.status]}</dd>
        {times.map(
          ([label, value]) =>
            value && (
              <div key={label} className="contents">
                <dt className="text-muted-foreground">{label}</dt>
                <dd>{formatSignedAt(value, session.timezone)}</dd>
              </div>
            ),
        )}
        <dt className="text-muted-foreground">Consentimiento</dt>
        <dd>{consentState(session)}</dd>
        <dt className="text-muted-foreground">Fotos antes</dt>
        <dd>{count('BEFORE')}</dd>
        <dt className="text-muted-foreground">Fotos después</dt>
        <dd>{count('AFTER')}</dd>
        <dt className="text-muted-foreground">Notas del procedimiento</dt>
        <dd>
          {session.procedureNotes ? (
            <p className="whitespace-pre-wrap">{session.procedureNotes}</p>
          ) : (
            <span className="text-muted-foreground">Sin notas</span>
          )}
        </dd>
      </dl>
      <div className="flex flex-col gap-2 border-t pt-4 text-sm sm:flex-row sm:items-center">
        {nextSession && (
          <Link
            href={`/treatment-sessions/${nextSession.id}`}
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-4 font-medium text-primary-foreground hover:bg-primary/90"
          >
            Siguiente tratamiento: {nextSession.treatmentName}
          </Link>
        )}
        <Link
          href={encounterBackHref(session.patientId, isEnabled('core.clinical.specialties'))}
          className="inline-flex min-h-11 items-center justify-center rounded-md border border-input px-4 font-medium hover:bg-accent"
        >
          Volver a la atención
        </Link>
      </div>
    </div>
  );
}
