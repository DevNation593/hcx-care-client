import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/store/authStore';
import { AppointmentStatus } from '@/types';
import type { Encounter } from '@/types/clinical';
import { EncounterPanel } from './encounter-panel';

const hooks = vi.hoisted(() => ({
  start: vi.fn(),
  close: vi.fn(),
  remove: vi.fn(),
  branches: [] as unknown[],
  appointments: [] as unknown[],
}));

vi.mock('@/hooks/useEncounters', () => ({
  useStartEncounter: () => ({ mutateAsync: hooks.start, isPending: false }),
  useCloseEncounter: () => ({ mutateAsync: hooks.close, isPending: false }),
  useRemoveEncounter: () => ({ mutateAsync: hooks.remove, isPending: false }),
}));
vi.mock('@/hooks/useBranches', () => ({ useBranches: () => ({ data: hooks.branches }) }));
vi.mock('@/hooks/useAppointments', () => ({
  useAppointments: () => ({ data: hooks.appointments }),
}));

const encounter = (overrides: Partial<Encounter> = {}): Encounter => ({
  id: 'encounter-1',
  patientId: 'patient-1',
  professionalId: 'me',
  specialtyId: 'physio',
  appointmentId: null,
  branchId: null,
  encounterType: 'FIRST_VISIT',
  status: 'OPEN',
  reason: 'Dolor lumbar de dos semanas',
  summary: null,
  startedAt: '2026-10-03T15:00:00.000Z',
  closedAt: null,
  recordCount: 0,
  professional: { id: 'me', firstName: 'Sofía', lastName: 'Ruiz' },
  specialty: { id: 'physio', code: 'PHYSIOTHERAPY', name: 'Fisioterapia' },
  ...overrides,
});

const appointment = (overrides = {}) => ({
  id: 'appointment-1',
  professionalId: 'me',
  status: AppointmentStatus.CONFIRMED,
  startTime: new Date().toISOString(),
  title: 'Sesión de fisioterapia',
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  hooks.branches = [];
  hooks.appointments = [];
  hooks.start.mockResolvedValue(undefined);
  hooks.close.mockResolvedValue(undefined);
  hooks.remove.mockResolvedValue(undefined);
  useAuthStore.setState({ user: { id: 'me', tenantId: 'tenant-1' } as never });
});

const submit = (name: string) => act(async () => fireEvent.click(screen.getByRole('button', { name })));

describe('EncounterPanel', () => {
  it('starts an encounter with its type and reason', async () => {
    render(<EncounterPanel patientId="patient-1" encounters={[]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Iniciar atención' }));
    const start = screen.getAllByRole('button', { name: 'Iniciar atención' }).at(-1)!;
    // The reason is mandatory.
    expect(start).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Tipo de atención'), { target: { value: 'CONTROL' } });
    fireEvent.change(screen.getByLabelText(/Motivo de consulta/), { target: { value: ' Control mensual ' } });
    await act(async () => fireEvent.click(start));

    expect(hooks.start).toHaveBeenCalledWith({ encounterType: 'CONTROL', reason: 'Control mensual' });
    expect(screen.queryByLabelText('Tipo de atención')).not.toBeInTheDocument();
  });

  it('keeps the only active branch unselected until the user chooses it', async () => {
    hooks.branches = [
      { id: 'main', name: 'Sede principal', isMain: true, isActive: true },
      { id: 'closed', name: 'Sede cerrada', isMain: false, isActive: false },
    ];
    render(<EncounterPanel patientId="patient-1" encounters={[]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar atención' }));

    const branch = screen.getByLabelText('Sede');
    expect(branch).toHaveValue('');
    expect(within(branch).getAllByRole('option').map((option) => option.getAttribute('value'))).toEqual([
      '',
      'main',
    ]);

    fireEvent.change(branch, { target: { value: 'main' } });
    fireEvent.change(screen.getByLabelText(/Motivo de consulta/), { target: { value: 'Control' } });
    await submit('Iniciar atención');

    expect(hooks.start).toHaveBeenCalledWith({
      encounterType: 'FIRST_VISIT',
      reason: 'Control',
      branchId: 'main',
    });
  });

  it('offers the professional’s own pending appointments and the active branches', async () => {
    hooks.appointments = [
      appointment(),
      appointment({ id: 'other-professional', professionalId: 'someone', title: 'De otro' }),
      appointment({ id: 'cancelled', status: AppointmentStatus.CANCELLED, title: 'Cancelada' }),
      appointment({ id: 'old', startTime: '2020-01-01T10:00:00.000Z', title: 'Antigua' }),
    ];
    hooks.branches = [
      { id: 'main', name: 'Sede principal', isMain: true, isActive: true },
      { id: 'north', name: 'Sede Norte', isMain: false, isActive: true },
      { id: 'closed', name: 'Sede cerrada', isMain: false, isActive: false },
    ];
    render(<EncounterPanel patientId="patient-1" encounters={[]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar atención' }));

    const appointments = within(screen.getByLabelText('Cita que se atiende')).getAllByRole('option');
    expect(appointments.map((option) => option.getAttribute('value'))).toEqual(['', 'appointment-1']);
    const branches = within(screen.getByLabelText('Sede')).getAllByRole('option');
    expect(branches.map((option) => option.getAttribute('value'))).toEqual(['', 'main', 'north']);

    fireEvent.change(screen.getByLabelText('Cita que se atiende'), { target: { value: 'appointment-1' } });
    fireEvent.change(screen.getByLabelText('Sede'), { target: { value: 'north' } });
    fireEvent.change(screen.getByLabelText(/Motivo de consulta/), { target: { value: 'Dolor' } });
    await act(async () =>
      fireEvent.click(screen.getAllByRole('button', { name: 'Iniciar atención' }).at(-1)!),
    );

    expect(hooks.start).toHaveBeenCalledWith({
      encounterType: 'FIRST_VISIT',
      reason: 'Dolor',
      appointmentId: 'appointment-1',
      branchId: 'north',
    });
  });

  it('opens ready to attend the appointment chosen in the agenda', async () => {
    hooks.appointments = [appointment()];
    render(<EncounterPanel patientId="patient-1" encounters={[]} initialAppointmentId="appointment-1" />);

    expect(screen.getByLabelText('Cita que se atiende')).toHaveValue('appointment-1');
    fireEvent.change(screen.getByLabelText(/Motivo de consulta/), { target: { value: 'Control' } });
    await submit('Iniciar atención');

    expect(hooks.start).toHaveBeenCalledWith({
      encounterType: 'FIRST_VISIT',
      reason: 'Control',
      appointmentId: 'appointment-1',
    });
  });

  it('shows the encounter in course instead of the start button', () => {
    const open = encounter({ recordCount: 2, branch: { id: 'north', name: 'Sede Norte' } });
    render(<EncounterPanel patientId="patient-1" encounters={[open]} openEncounter={open} />);

    expect(screen.getByText('Atención en curso')).toBeInTheDocument();
    expect(screen.getByText('Dolor lumbar de dos semanas')).toBeInTheDocument();
    expect(screen.getByText(/Sede Norte · 2 registros/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Iniciar atención' })).not.toBeInTheDocument();
    // An encounter that already holds records cannot be removed.
    expect(screen.queryByRole('button', { name: 'Eliminar atención' })).not.toBeInTheDocument();
  });

  it('closes the encounter with an optional summary', async () => {
    const open = encounter();
    render(<EncounterPanel patientId="patient-1" encounters={[open]} openEncounter={open} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar atención' }));
    fireEvent.change(screen.getByLabelText('Resumen o indicaciones de cierre'), {
      target: { value: ' Control en 7 días ' },
    });
    await submit('Cerrar y firmar');

    expect(hooks.close).toHaveBeenCalledWith({ encounterId: 'encounter-1', summary: 'Control en 7 días' });
    expect(screen.queryByRole('button', { name: 'Cerrar y firmar' })).not.toBeInTheDocument();
  });

  it('removes an empty encounter only with a reason', async () => {
    const open = encounter();
    render(<EncounterPanel patientId="patient-1" encounters={[open]} openEncounter={open} />);

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar atención' }));
    const confirm = screen.getAllByRole('button', { name: 'Eliminar atención' }).at(-1)!;
    expect(confirm).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Motivo/), { target: { value: 'Paciente equivocado' } });
    await act(async () => fireEvent.click(confirm));

    expect(hooks.remove).toHaveBeenCalledWith({ encounterId: 'encounter-1', reason: 'Paciente equivocado' });
  });

  it('lists the previous encounters with who attended and how they ended', () => {
    const closed = encounter({
      id: 'encounter-0',
      status: 'CLOSED',
      encounterType: 'CONTROL',
      recordCount: 1,
      summary: 'Alta de fisioterapia',
    });
    render(<EncounterPanel patientId="patient-1" encounters={[closed]} />);

    expect(screen.getByText('Atenciones anteriores (1)')).toBeInTheDocument();
    expect(screen.getByText('Control · 03/10/2026')).toBeInTheDocument();
    expect(screen.getByText('Cerrada')).toBeInTheDocument();
    expect(screen.getByText('Sofía Ruiz · Fisioterapia · 1 registro')).toBeInTheDocument();
    expect(screen.getByText('Alta de fisioterapia')).toBeInTheDocument();
  });
});
