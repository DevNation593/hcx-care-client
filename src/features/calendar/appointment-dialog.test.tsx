import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserRole, type Appointment, type User } from '@/types';
import { useAuthStore } from '@/store/authStore';
import { AppointmentDialog } from './appointment-dialog';

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  updateHook: vi.fn(),
  eligibleHook: vi.fn(),
  pending: false,
  branches: [] as {
    id: string;
    name: string;
    isMain: boolean;
    isActive: boolean;
    professionalIds?: string[];
  }[],
}));

vi.mock('@/hooks/useAppointments', () => ({
  useCreateAppointment: () => ({ mutate: mocks.create, isPending: mocks.pending }),
  useUpdateAppointment: (id: string) => {
    mocks.updateHook(id);
    return { mutate: mocks.update, isPending: mocks.pending };
  },
}));
vi.mock('@/hooks/useBranches', () => ({
  useBranches: () => ({ data: mocks.branches }),
}));
vi.mock('@/hooks/usePatients', () => ({
  usePatients: () => ({
    data: [
      { id: 'patient-1', firstName: 'Ana', lastName: 'Vega' },
      { id: 'patient-2', firstName: 'Luis', lastName: 'Paz' },
    ],
    isLoading: false,
    isError: false,
  }),
}));
vi.mock('@/hooks/useSpecialties', () => ({
  useTenantSpecialties: () => ({
    data: [
      { id: 'nutrition', code: 'NUTRITION', name: 'Nutrición', isActive: true, modules: [] },
      { id: 'psychology', code: 'PSYCHOLOGY', name: 'Psicología', isActive: true, modules: [] },
      { id: 'historical-specialty', code: 'HISTORICAL', name: 'Especialidad histórica', isActive: false, modules: [] },
    ],
    isLoading: false,
    isError: false,
  }),
}));
vi.mock('@/hooks/usePatientTeam', () => ({
  useEligiblePatientProfessionals: (patientId: string, specialtyId: string) =>
    mocks.eligibleHook(patientId, specialtyId),
}));

const candidates = {
  nutrition: [
    {
      id: 'nutrition-1',
      firstName: 'Noa',
      lastName: 'Nutrición',
      professionalTitle: 'Nutricionista',
      licenseNumber: null,
      specialty: { id: 'nutrition', code: 'NUTRITION', name: 'Nutrición' },
      isAssigned: true,
    },
    {
      id: 'admin-clinical',
      firstName: 'Ada',
      lastName: 'Clínica',
      professionalTitle: 'Dra.',
      licenseNumber: null,
      specialty: { id: 'nutrition', code: 'NUTRITION', name: 'Nutrición' },
      isAssigned: false,
    },
  ],
  psychology: [
    {
      id: 'psychology-1',
      firstName: 'Paz',
      lastName: 'Psicología',
      professionalTitle: 'Psicóloga',
      licenseNumber: null,
      specialty: { id: 'psychology', code: 'PSYCHOLOGY', name: 'Psicología' },
      isAssigned: true,
    },
  ],
};

function appointment(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: 'appointment-1',
    tenantId: 'tenant-1',
    patientId: 'patient-1',
    patient: { id: 'patient-1', firstName: 'Ana', lastName: 'Vega', email: null, phone: null },
    professionalId: 'nutrition-1',
    professional: { id: 'nutrition-1', firstName: 'Noa', lastName: 'Nutrición', email: 'noa@example.com' },
    specialtyId: 'nutrition',
    specialty: { id: 'nutrition', code: 'NUTRITION', name: 'Nutrición' },
    psychologistId: 'nutrition-1',
    psychologist: null,
    title: 'Consulta inicial',
    description: 'Historia inicial',
    startTime: '2026-10-01T15:00:00.000Z',
    endTime: '2026-10-01T16:00:00.000Z',
    duration: 60,
    status: 'SCHEDULED',
    location: 'Consultorio 2',
    isOnline: false,
    meetingUrl: null,
    cancelledAt: null,
    cancelledBy: null,
    cancellationReason: null,
    reminderSent24h: false,
    reminderSent2h: false,
    lastReminderSentAt: null,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  } as Appointment;
}

function renderDialog({
  currentAppointment = null,
  role = UserRole.MASTER,
  actorId = 'admin-1',
  onOpenChange = vi.fn(),
}: {
  currentAppointment?: Appointment | null;
  role?: UserRole;
  actorId?: string;
  onOpenChange?: ReturnType<typeof vi.fn>;
} = {}) {
  useAuthStore.setState({ user: { id: actorId, role, tenantId: 'tenant-1' } as User });
  return {
    onOpenChange,
    ...render(
      <AppointmentDialog
        open
        onOpenChange={onOpenChange}
        appointment={currentAppointment}
        initialDate={new Date('2026-10-03T14:30:00')}
      />,
    ),
  };
}

function select(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function completeCreateForm() {
  select('Paciente', 'patient-1');
  select('Especialidad', 'nutrition');
  select('Profesional', 'nutrition-1');
  fireEvent.change(screen.getByLabelText('Título de la cita'), { target: { value: 'Consulta nutricional' } });
  fireEvent.submit(screen.getByRole('button', { name: 'Crear cita' }).closest('form')!);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.pending = false;
  mocks.branches = [];
  mocks.eligibleHook.mockImplementation((_patientId: string, specialtyId: string) => ({
    data: candidates[specialtyId as keyof typeof candidates] ?? [],
    isLoading: false,
    isError: false,
  }));
});

describe('AppointmentDialog canonical cascade', () => {
  it('loads professionals only after patient and specialty are selected', () => {
    renderDialog();
    expect(mocks.eligibleHook).toHaveBeenLastCalledWith('', '');

    select('Paciente', 'patient-1');
    expect(mocks.eligibleHook).toHaveBeenLastCalledWith('patient-1', '');
    select('Especialidad', 'nutrition');

    expect(mocks.eligibleHook).toHaveBeenLastCalledWith('patient-1', 'nutrition');
    expect(screen.getByRole('option', { name: 'Noa Nutrición' })).toBeInTheDocument();
  });

  it('clears a selected professional only after the user changes a parent selection', () => {
    renderDialog();
    select('Paciente', 'patient-1');
    select('Especialidad', 'nutrition');
    select('Profesional', 'nutrition-1');

    select('Especialidad', 'psychology');

    expect(screen.getByLabelText('Profesional')).toHaveValue('');
  });

  it('submits professionalId and specialtyId without psychologistId', async () => {
    renderDialog();
    completeCreateForm();

    await waitFor(() => expect(mocks.create).toHaveBeenCalled());
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        patientId: 'patient-1',
        specialtyId: 'nutrition',
        professionalId: 'nutrition-1',
      }),
      expect.any(Object),
    );
    expect(mocks.create.mock.calls[0][0]).not.toHaveProperty('psychologistId');
  });

  it('submits the local start time as an absolute instant', async () => {
    renderDialog();
    completeCreateForm();

    await waitFor(() => expect(mocks.create).toHaveBeenCalled());
    expect(mocks.create.mock.calls[0][0].startTime).toBe(new Date('2026-10-03T14:30:00').toISOString());
  });

  it('keeps the stored start instant on a title-only edit', async () => {
    renderDialog({ currentAppointment: appointment() });
    fireEvent.change(screen.getByLabelText('Título de la cita'), { target: { value: 'Seguimiento' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(mocks.update).toHaveBeenCalled());
    expect(mocks.update.mock.calls[0][0].startTime).toBe('2026-10-01T15:00:00.000Z');
  });

  it('reassigns an existing appointment with matching canonical identifiers', async () => {
    renderDialog({ currentAppointment: appointment() });
    select('Especialidad', 'psychology');
    select('Profesional', 'psychology-1');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(mocks.update).toHaveBeenCalled());
    expect(mocks.updateHook).toHaveBeenLastCalledWith('appointment-1');
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        specialtyId: 'psychology',
        professionalId: 'psychology-1',
        previousPatientId: 'patient-1',
      }),
      expect.any(Object),
    );
    expect(mocks.update.mock.calls[0][0]).not.toHaveProperty('psychologistId');
  });

  it('preserves disabled historical selections during hydration and a title-only save', async () => {
    const historical = appointment({
      professionalId: 'historical-1',
      professional: { id: 'historical-1', firstName: 'Hugo', lastName: 'Histórico', email: 'hugo@example.com' },
      specialtyId: 'historical-specialty',
      specialty: { id: 'historical-specialty', code: 'HISTORICAL', name: 'Especialidad histórica' },
    });
    renderDialog({ currentAppointment: historical });

    const specialtyOption = screen.getByRole('option', { name: 'Especialidad histórica (actual/histórica)' });
    const professionalOption = screen.getByRole('option', { name: 'Hugo Histórico (actual/histórico)' });
    expect(specialtyOption).toBeDisabled();
    expect(professionalOption).toBeDisabled();
    expect(screen.getByLabelText('Especialidad')).toHaveValue('historical-specialty');
    expect(screen.getByLabelText('Profesional')).toHaveValue('historical-1');

    fireEvent.change(screen.getByLabelText('Título de la cita'), { target: { value: 'Seguimiento histórico' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(mocks.update).toHaveBeenCalled());
    expect(mocks.update.mock.calls[0][0]).toMatchObject({
      title: 'Seguimiento histórico',
      specialtyId: 'historical-specialty',
      professionalId: 'historical-1',
    });
  });

  it.each([
    [UserRole.MASTER, 'admin-1', ['Noa Nutrición', 'Ada Clínica']],
    [UserRole.ASISTENTE, 'assistant-1', ['Noa Nutrición', 'Ada Clínica']],
    [UserRole.PROFESIONAL, 'nutrition-1', ['Noa Nutrición']],
    [UserRole.PROFESIONAL, 'nutrition-1', ['Noa Nutrición']],
  ] as const)('filters eligible professionals for actor role %s', (role, actorId, visibleNames) => {
    renderDialog({ role, actorId });
    select('Paciente', 'patient-1');
    select('Especialidad', 'nutrition');

    const options = within(screen.getByLabelText('Profesional')).getAllByRole('option').map((option) => option.textContent);
    for (const name of visibleNames) expect(options).toContain(name);
    expect(options.includes('Ada Clínica')).toBe(role === UserRole.MASTER || role === UserRole.ASISTENTE);
  });

  it('keeps values and the dialog open when the server rejects the create', async () => {
    mocks.create.mockImplementation((_data, options) => {
      options.onError({
        code: 'APPOINTMENT_CONFLICT',
        status: 409,
        message: 'Este horario tiene conflicto con cita(s) existente(s)',
      });
    });
    const { onOpenChange } = renderDialog();
    completeCreateForm();

    expect(await screen.findByRole('alert')).toHaveTextContent('Este horario tiene conflicto con cita(s) existente(s)');
    expect(screen.getByLabelText('Profesional')).toHaveValue('nutrition-1');
    expect(screen.getByLabelText('Título de la cita')).toHaveValue('Consulta nutricional');
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('disables form actions while a create or update is in flight', () => {
    mocks.pending = true;
    renderDialog();

    expect(screen.getByRole('button', { name: 'Crear cita' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cerrar' })).toBeDisabled();
  });
});

describe('AppointmentDialog branch', () => {
  const main = { id: 'main', name: 'Sede principal', isMain: true, isActive: true };
  const north = { id: 'north', name: 'Sede Norte', isMain: false, isActive: true };
  const closed = { id: 'closed', name: 'Sede cerrada', isMain: false, isActive: false };

  it('sends no branch when the clinic has none', async () => {
    renderDialog();
    completeCreateForm();

    await waitFor(() => expect(mocks.create).toHaveBeenCalled());
    expect(mocks.create.mock.calls[0][0]).not.toHaveProperty('branchId');
    expect(screen.queryByLabelText('Sede')).not.toBeInTheDocument();
  });

  it('books in the only active branch without asking', async () => {
    mocks.branches = [main, closed];
    renderDialog();
    expect(screen.queryByLabelText('Sede')).not.toBeInTheDocument();
    completeCreateForm();

    await waitFor(() => expect(mocks.create).toHaveBeenCalled());
    expect(mocks.create.mock.calls[0][0].branchId).toBe('main');
  });

  it('defaults to the main branch and lets another active one be chosen', async () => {
    mocks.branches = [north, main, closed];
    renderDialog();

    expect(screen.getByLabelText('Sede')).toHaveValue('main');
    expect(screen.queryByRole('option', { name: 'Sede cerrada' })).not.toBeInTheDocument();
    select('Sede', 'north');
    completeCreateForm();

    await waitFor(() => expect(mocks.create).toHaveBeenCalled());
    expect(mocks.create.mock.calls[0][0].branchId).toBe('north');
  });

  it('offers only the branches the chosen professional is tied to', async () => {
    const south = { id: 'south', name: 'Sede Sur', isMain: false, isActive: true, professionalIds: [] };
    mocks.branches = [
      { ...main, professionalIds: [] },
      { ...north, professionalIds: ['nutrition-1'] },
      south,
    ];
    renderDialog();
    // Before a professional is chosen every active branch is offered.
    expect(screen.getByRole('option', { name: 'Sede Sur' })).toBeInTheDocument();

    completeCreateForm();

    await waitFor(() => expect(mocks.create).toHaveBeenCalled());
    // Tied to one branch only: the select disappears and the appointment goes there.
    expect(screen.queryByLabelText('Sede')).not.toBeInTheDocument();
    expect(mocks.create.mock.calls[0][0].branchId).toBe('north');
  });

  it('keeps an existing appointment without a branch as it is, and can take its branch away', async () => {
    mocks.branches = [main, north];
    const view = renderDialog({ currentAppointment: appointment() });
    expect(screen.getByLabelText('Sede')).toHaveValue('');
    fireEvent.submit(screen.getByLabelText('Título de la cita').closest('form')!);
    await waitFor(() => expect(mocks.update).toHaveBeenCalled());
    expect(mocks.update.mock.calls[0][0]).not.toHaveProperty('branchId');
    view.unmount();

    mocks.update.mockClear();
    renderDialog({ currentAppointment: { ...appointment(), branchId: 'north' } });
    expect(screen.getByLabelText('Sede')).toHaveValue('north');
    select('Sede', '');
    fireEvent.submit(screen.getByLabelText('Título de la cita').closest('form')!);
    await waitFor(() => expect(mocks.update).toHaveBeenCalled());
    expect(mocks.update.mock.calls[0][0].branchId).toBeNull();
  });
});
