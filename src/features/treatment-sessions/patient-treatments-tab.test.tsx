import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/store/authStore';
import { PatientTreatmentsTab } from './patient-treatments-tab';

// Rendered without a QueryClient: name people as in a clinical practice.
vi.mock('@/hooks/usePatientTerms', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/usePatientTerms')>();
  return { ...actual, usePatientTerms: () => actual.patientTerms(false) };
});

const hooks = vi.hoisted(() => ({
  sessions: { data: [] as unknown[], isPending: false, isError: false, refetch: vi.fn() },
  encounters: [] as unknown[],
  encountersState: { isPending: false, isError: false, refetch: vi.fn() },
  enabled: new Set<string>(),
}));

vi.mock('@/hooks/useTreatmentSessions', () => ({
  usePatientTreatmentSessions: () => hooks.sessions,
}));
vi.mock('@/hooks/useEncounters', () => ({
  usePatientEncounters: () => ({
    data: hooks.encountersState.isError || hooks.encountersState.isPending ? undefined : hooks.encounters,
    ...hooks.encountersState,
  }),
}));
vi.mock('@/hooks/useSections', () => ({
  useSections: () => ({ isEnabled: (key: string) => hooks.enabled.has(key) }),
}));
// The panel has its own tests; here only which mode it gets, and with what, matters.
vi.mock('@/features/patients/encounter-panel', () => ({
  EncounterPanel: (props: {
    mode: string;
    initialAppointmentId?: string;
    openEncounter?: { id: string };
  }) => (
    <div
      data-testid="encounter-panel"
      data-mode={props.mode}
      data-appointment={props.initialAppointmentId ?? ''}
      data-open={props.openEncounter?.id ?? ''}
    />
  ),
}));

const summary = (id: string, name: string, status: string, createdAt: string) => ({
  id,
  status,
  createdAt,
  treatment: { id: `tr-${id}`, name, version: 1 },
  professional: { id: 'me', firstName: 'Sofía', lastName: 'Ruiz' },
});

beforeEach(() => {
  vi.clearAllMocks();
  hooks.sessions = {
    data: [
      summary('s-2', 'Toxina botulínica', 'CONSENTED', '2026-10-15T15:00:00.000Z'),
      summary('s-1', 'Peeling químico', 'CLINICAL_COMPLETE', '2026-09-01T15:00:00.000Z'),
    ],
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  };
  hooks.encounters = [];
  hooks.encountersState = { isPending: false, isError: false, refetch: vi.fn() };
  hooks.enabled = new Set(['core.treatments.sessions']);
  useAuthStore.setState({ user: { id: 'me', tenantId: 'tenant-1' } as never });
});

describe('PatientTreatmentsTab', () => {
  it('lists the sessions with their status in Spanish', () => {
    render(<PatientTreatmentsTab patientId="patient-1" />);

    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText('Toxina botulínica')).toBeInTheDocument();
    expect(within(rows[0]).getByText('Consentimiento firmado')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Peeling químico')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Cerrada')).toBeInTheDocument();
    expect(within(rows[0]).getByRole('link')).toHaveAttribute('href', '/treatment-sessions/s-2');
  });

  it('no longer has its own "Nueva atención" button', () => {
    render(<PatientTreatmentsTab patientId="patient-1" />);

    expect(screen.queryByRole('button', { name: 'Nueva atención' })).not.toBeInTheDocument();
  });

  it('shows the encounter panel in treatments mode without the specialties section', () => {
    render(<PatientTreatmentsTab patientId="patient-1" />);

    expect(screen.getByTestId('encounter-panel')).toHaveAttribute('data-mode', 'treatments');
  });

  it('shows the encounter panel in treatments mode also with the specialties section', () => {
    hooks.enabled.add('core.clinical.specialties');
    render(<PatientTreatmentsTab patientId="patient-1" />);

    expect(screen.getByTestId('encounter-panel')).toHaveAttribute('data-mode', 'treatments');
  });

  it('passes the appointment to attend and the own open encounter to the panel', () => {
    hooks.encounters = [
      { id: 'e-other', status: 'OPEN', professionalId: 'other' },
      { id: 'e-closed', status: 'CLOSED', professionalId: 'me' },
      { id: 'e-mine', status: 'OPEN', professionalId: 'me' },
    ];
    render(<PatientTreatmentsTab patientId="patient-1" initialAppointmentId="appointment-1" />);

    const panel = screen.getByTestId('encounter-panel');
    expect(panel).toHaveAttribute('data-appointment', 'appointment-1');
    expect(panel).toHaveAttribute('data-open', 'e-mine');
  });

  it('shows an error with retry, and no panel, when the encounters cannot be read', () => {
    hooks.encountersState = { isPending: false, isError: true, refetch: vi.fn() };
    render(<PatientTreatmentsTab patientId="patient-1" />);

    expect(screen.getByText('No se pudo cargar el tratamiento')).toBeInTheDocument();
    expect(screen.queryByTestId('encounter-panel')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(hooks.encountersState.refetch).toHaveBeenCalledTimes(1);
  });

  it('shows no panel while the encounters load', () => {
    hooks.encountersState = { isPending: true, isError: false, refetch: vi.fn() };
    render(<PatientTreatmentsTab patientId="patient-1" />);

    expect(screen.getByText('Cargando el tratamiento…')).toBeInTheDocument();
    expect(screen.queryByTestId('encounter-panel')).not.toBeInTheDocument();
  });

  it('renders no panel when the treatment sessions section is off', () => {
    hooks.enabled = new Set(['core.clinical.specialties']);
    render(<PatientTreatmentsTab patientId="patient-1" />);

    expect(screen.queryByTestId('encounter-panel')).not.toBeInTheDocument();
  });

  it('says so when the patient has no sessions', () => {
    hooks.sessions = { ...hooks.sessions, data: [] };
    render(<PatientTreatmentsTab patientId="patient-1" />);

    expect(screen.getByText('Este paciente aún no tiene tratamientos.')).toBeInTheDocument();
  });
});
