import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { SessionMedia, TreatmentSessionDetail } from '@/types/treatments';
import { CloseSummaryStep } from './close-summary-step';

const photo = (id: string, phase: SessionMedia['phase']) => ({ id, phase }) as SessionMedia;

const session = (overrides: Partial<TreatmentSessionDetail> = {}): TreatmentSessionDetail =>
  ({
    id: 'session-1',
    status: 'CLINICAL_COMPLETE',
    startedAt: '2026-10-15T15:00:00.000Z',
    completedAt: '2026-10-15T16:30:00.000Z',
    cancelledAt: null,
    procedureNotes: 'Se aplicaron 20 unidades.\nSin incidentes.',
    consentDocumentId: 'doc-1',
    consentDocuments: [
      { id: 'doc-1', status: 'SIGNED', signedAt: '2026-10-15T14:50:00.000Z' },
    ] as TreatmentSessionDetail['consentDocuments'],
    policy: {
      medicalForm: { required: true },
      informedConsent: { required: true, validityDays: null },
      photos: { minimumBefore: 1, minimumAfter: 1 },
      clinicalNotes: { requiredForCompletion: true },
    },
    media: [photo('1', 'BEFORE'), photo('2', 'BEFORE'), photo('3', 'AFTER'), photo('4', 'OTHER')],
    timezone: 'America/Guayaquil',
    ...overrides,
  }) as TreatmentSessionDetail;

const value = (term: string) => screen.getByText(term).nextElementSibling;

describe('CloseSummaryStep', () => {
  it('summarises a closed session in the clinic zone, read only', () => {
    render(<CloseSummaryStep session={session()} />);

    expect(value('Estado')).toHaveTextContent('Cerrada');
    expect(value('Inicio')).toHaveTextContent(/10:00.*America\/Guayaquil/);
    expect(value('Cierre')).toHaveTextContent(/11:30.*America\/Guayaquil/);
    expect(value('Consentimiento')).toHaveTextContent(/Firmado el .*9:50.*America\/Guayaquil/);
    expect(value('Fotos antes')).toHaveTextContent('2');
    expect(value('Fotos después')).toHaveTextContent('1');
    expect(value('Notas del procedimiento')).toHaveTextContent('Se aplicaron 20 unidades.');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('shows what a session that was not closed has so far', () => {
    render(
      <CloseSummaryStep
        session={session({
          status: 'CANCELLED',
          startedAt: null,
          completedAt: null,
          cancelledAt: '2026-10-15T15:20:00.000Z',
          procedureNotes: null,
          consentDocumentId: null,
          consentDocuments: [],
          media: [],
        })}
      />,
    );

    expect(value('Estado')).toHaveTextContent('Cancelada');
    expect(screen.queryByText('Inicio')).not.toBeInTheDocument();
    expect(screen.queryByText('Cierre')).not.toBeInTheDocument();
    expect(value('Cancelación')).toHaveTextContent(/10:20.*America\/Guayaquil/);
    expect(value('Consentimiento')).toHaveTextContent('Pendiente');
    expect(value('Fotos antes')).toHaveTextContent('0');
    expect(value('Notas del procedimiento')).toHaveTextContent('Sin notas');
    expect(screen.getByText(/solo lectura/)).toBeInTheDocument();
  });

  it('says the consent was not required when the treatment asks for none', () => {
    render(
      <CloseSummaryStep
        session={session({
          consentDocuments: [],
          consentDocumentId: null,
          policy: {
            ...session().policy,
            informedConsent: { required: false, validityDays: null },
          },
        })}
      />,
    );

    expect(value('Consentimiento')).toHaveTextContent('No requerido');
  });
});
