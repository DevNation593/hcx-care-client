'use client';

import { Alert } from '@/components/ui/alert';
import {
  SESSION_STATUS_LABELS,
  type ConsentDocumentSummary,
  type TreatmentSessionDetail,
} from '@/types/treatments';
import { DOCUMENT_STATUS_LABELS, formatSignedAt } from './consent-step';

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
  const count = (phase: 'BEFORE' | 'AFTER') =>
    session.media.filter((media) => media.phase === phase).length;
  const times: [string, string | null][] = [
    ['Inicio', session.startedAt],
    ['Cierre', session.completedAt],
    ['Cancelación', session.cancelledAt],
  ];

  return (
    <div className="space-y-4">
      {session.status !== 'CLINICAL_COMPLETE' && (
        <Alert variant="default">
          Este resumen es de solo lectura y se completa al cerrar la atención.
        </Alert>
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
    </div>
  );
}
