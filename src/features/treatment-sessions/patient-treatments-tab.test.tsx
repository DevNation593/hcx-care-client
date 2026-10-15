import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/store/authStore';
import { AppointmentStatus } from '@/types';
import { PatientTreatmentsTab } from './patient-treatments-tab';

const hooks = vi.hoisted(() => ({
  sessions: { data: [] as unknown[], isPending: false, isError: false, refetch: vi.fn() },
  treatments: [] as unknown[],
  appointments: [] as unknown[],
  create: vi.fn(),
  push: vi.fn(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: hooks.push }) }));
vi.mock('@/hooks/useTreatmentSessions', () => ({
  usePatientTreatmentSessions: () => hooks.sessions,
  useCreateTreatmentSession: () => ({ mutateAsync: hooks.create, isPending: false }),
}));
vi.mock('@/hooks/useTreatments', () => ({
  useTreatments: () => ({ data: hooks.treatments }),
}));
vi.mock('@/hooks/useAppointments', () => ({
  useAppointments: () => ({ data: hooks.appointments }),
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
  hooks.treatments = [
    { id: 'tr-1', name: 'Toxina botulínica', isActive: true },
    { id: 'tr-2', name: 'Peeling químico', isActive: true },
  ];
  hooks.appointments = [];
  hooks.create.mockResolvedValue({ id: 'session-9' });
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

  it('opens a new session of the chosen treatment and goes to it', async () => {
    render(<PatientTreatmentsTab patientId="patient-1" />);

    fireEvent.click(screen.getByRole('button', { name: 'Nueva atención' }));
    const dialog = screen.getByRole('dialog');
    const start = within(dialog).getByRole('button', { name: 'Iniciar atención' });
    expect(start).toBeDisabled();

    fireEvent.change(within(dialog).getByLabelText(/Tratamiento/), { target: { value: 'tr-2' } });
    await act(async () => fireEvent.click(start));

    expect(hooks.create).toHaveBeenCalledWith({ treatmentId: 'tr-2' });
    expect(hooks.push).toHaveBeenCalledWith('/treatment-sessions/session-9');
  });

  it('offers the own pending appointments of the patient', async () => {
    hooks.appointments = [
      { id: 'a-1', professionalId: 'me', status: AppointmentStatus.CONFIRMED, startTime: '2026-10-15T15:00:00.000Z', title: 'Toxina' },
      { id: 'a-2', professionalId: 'me', status: AppointmentStatus.COMPLETED, startTime: '2026-10-01T15:00:00.000Z', title: 'Pasada' },
      { id: 'a-3', professionalId: 'other', status: AppointmentStatus.SCHEDULED, startTime: '2026-10-16T15:00:00.000Z', title: 'Ajena' },
    ];
    render(<PatientTreatmentsTab patientId="patient-1" />);

    fireEvent.click(screen.getByRole('button', { name: 'Nueva atención' }));
    const dialog = screen.getByRole('dialog');
    const appointment = within(dialog).getByLabelText('Cita (opcional)');
    expect(within(appointment).getAllByRole('option')).toHaveLength(2);

    fireEvent.change(within(dialog).getByLabelText(/Tratamiento/), { target: { value: 'tr-1' } });
    fireEvent.change(appointment, { target: { value: 'a-1' } });
    await act(async () =>
      fireEvent.click(within(dialog).getByRole('button', { name: 'Iniciar atención' })),
    );

    expect(hooks.create).toHaveBeenCalledWith({ treatmentId: 'tr-1', appointmentId: 'a-1' });
  });

  it('shows why the session could not be opened and stays', async () => {
    hooks.create.mockRejectedValue({
      status: 409,
      code: 'ENCOUNTER_ALREADY_OPEN',
      message: 'Ya tienes una atención abierta con este paciente. Ciérrala antes de iniciar otra.',
    });
    render(<PatientTreatmentsTab patientId="patient-1" />);

    fireEvent.click(screen.getByRole('button', { name: 'Nueva atención' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/Tratamiento/), { target: { value: 'tr-1' } });
    await act(async () =>
      fireEvent.click(within(dialog).getByRole('button', { name: 'Iniciar atención' })),
    );

    expect(within(dialog).getByText(/Ya tienes una atención abierta con este paciente/)).toBeInTheDocument();
    expect(hooks.push).not.toHaveBeenCalled();
  });

  it('says so when the patient has no sessions', () => {
    hooks.sessions = { ...hooks.sessions, data: [] };
    render(<PatientTreatmentsTab patientId="patient-1" />);

    expect(screen.getByText('Este paciente aún no tiene atenciones de tratamiento.')).toBeInTheDocument();
  });
});
