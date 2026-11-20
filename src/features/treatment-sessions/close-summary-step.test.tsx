import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionMedia, TreatmentSessionDetail } from '@/types/treatments';
import { CloseSummaryStep } from './close-summary-step';

const sections = vi.hoisted(() => ({ enabled: new Set<string>() }));
vi.mock('@/hooks/useSections', () => ({
  useSections: () => ({ isEnabled: (key: string) => sections.enabled.has(key) }),
}));

// Rendered without a QueryClient: name people as in a clinical practice.
vi.mock('@/hooks/usePatientTerms', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/usePatientTerms')>();
  return { ...actual, usePatientTerms: () => actual.patientTerms(false) };
});

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
    patientId: 'patient-1',
    encounterStatus: 'OPEN',
    encounterSessions: [],
    ...overrides,
  }) as TreatmentSessionDetail;

beforeEach(() => sections.enabled.clear());

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
    expect(screen.getByText('El tratamiento fue cancelado.')).toBeInTheDocument();
    expect(screen.queryByText(/se completa al terminar el tratamiento/)).not.toBeInTheDocument();
  });

  it.each([
    ['CANCELLED', 'El tratamiento fue cancelado.'],
    ['NO_SHOW', 'El paciente no asistió.'],
    ['CONSENT_REFUSED', 'Consentimiento rechazado.'],
    ['CONSENT_REVOKED', 'Consentimiento revocado.'],
  ] as const)('says what happened to a %s session instead of promising a close', (status, text) => {
    render(<CloseSummaryStep session={session({ status })} />);

    expect(screen.getByText(text)).toBeInTheDocument();
    expect(screen.queryByText(/se completa al terminar el tratamiento/)).not.toBeInTheDocument();
  });

  it.each(['IN_PROGRESS', 'CONSENTED'] as const)(
    'explains that the summary completes when the %s session is closed',
    (status) => {
      render(<CloseSummaryStep session={session({ status, completedAt: null })} />);

      expect(screen.getByText(/solo lectura y se completa al terminar el tratamiento/)).toBeInTheDocument();
    },
  );

  it('shows no pending notice for a closed session', () => {
    render(<CloseSummaryStep session={session()} />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
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

  describe('moving on', () => {
    const pending = [
      { id: 'session-2', status: 'CONSENTED', treatmentName: 'Relleno' },
      { id: 'session-3', status: 'READY_FOR_CONSENT', treatmentName: 'Peeling' },
    ] as TreatmentSessionDetail['encounterSessions'];

    it('links to the first unfinished treatment of an open encounter', () => {
      render(<CloseSummaryStep session={session({ encounterSessions: pending })} />);

      expect(screen.getByRole('link', { name: 'Siguiente tratamiento: Relleno' })).toHaveAttribute(
        'href',
        '/treatment-sessions/session-2',
      );
    });

    it('skips the siblings that are already finished', () => {
      render(
        <CloseSummaryStep
          session={session({
            encounterSessions: [
              { id: 's2', status: 'CLINICAL_COMPLETE', treatmentName: 'Hecho' },
              ...pending,
            ] as TreatmentSessionDetail['encounterSessions'],
          })}
        />,
      );

      expect(screen.getByRole('link', { name: 'Siguiente tratamiento: Relleno' })).toBeInTheDocument();
    });

    it('offers no next treatment when none is pending', () => {
      render(
        <CloseSummaryStep
          session={session({
            encounterSessions: [
              { id: 's2', status: 'CANCELLED', treatmentName: 'Relleno' },
            ] as TreatmentSessionDetail['encounterSessions'],
          })}
        />,
      );

      expect(screen.queryByRole('link', { name: /Siguiente tratamiento/ })).not.toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Volver a la atención' })).toBeInTheDocument();
    });

    it('offers no next treatment once the encounter is closed', () => {
      render(
        <CloseSummaryStep session={session({ encounterStatus: 'CLOSED', encounterSessions: pending })} />,
      );

      expect(screen.queryByRole('link', { name: /Siguiente tratamiento/ })).not.toBeInTheDocument();
    });

    it('goes back to the treatments tab without the specialties section', () => {
      render(<CloseSummaryStep session={session()} />);

      expect(screen.getByRole('link', { name: 'Volver a la atención' })).toHaveAttribute(
        'href',
        '/patients/patient-1?tab=treatments',
      );
    });

    it('goes back to the specialties tab with the specialties section', () => {
      sections.enabled.add('core.clinical.specialties');
      render(<CloseSummaryStep session={session()} />);

      expect(screen.getByRole('link', { name: 'Volver a la atención' })).toHaveAttribute(
        'href',
        '/patients/patient-1?tab=specialties',
      );
    });
  });
});
