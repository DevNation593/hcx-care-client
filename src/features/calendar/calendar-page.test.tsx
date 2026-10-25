import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppointmentStatus, UserRole, type Appointment, type User } from '@/types';
import { useAuthStore } from '@/store/authStore';
import CalendarPage from '@/app/(dashboard)/calendar/page';
import { toast } from 'sonner';

const mocks = vi.hoisted(() => ({
  appointments: undefined as Appointment[] | undefined,
  isLoading: true,
  search: '',
  update: vi.fn(),
  updateHookIds: [] as string[],
  branches: [] as { id: string; name: string; isMain: boolean; isActive: boolean }[],
  appointmentFilters: [] as unknown[],
  appointmentOptions: [] as ({ enabled?: boolean } | undefined)[],
  professionals: [] as { id: string; firstName: string; lastName: string }[],
  deepLinked: undefined as Appointment | undefined,
  detailIds: [] as string[],
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(mocks.search),
}));
vi.mock('next/dynamic', () => ({
  default: () => function CalendarMock(props: {
    events: Appointment[];
    onEventClick: (appointment: Appointment) => void;
    onEventDrop?: (id: string, start: string, end: string) => void;
  }) {
    return (
      <div>
        {props.events.map((appointment) => (
          <button key={appointment.id} onClick={() => props.onEventClick(appointment)}>
            Seleccionar {appointment.id}
          </button>
        ))}
        {props.events[0] && (
          <button onClick={() => props.onEventDrop?.(
            props.events[0].id,
            '2026-10-02T15:00:00.000Z',
            '2026-10-02T16:00:00.000Z',
          )}>
            Mover primera cita
          </button>
        )}
      </div>
    );
  },
}));
vi.mock('@/hooks/useSpecialties', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/useSpecialties')>()),
  useTenantModules: () => ({
    data: [
      'core.agenda', 'core.agenda.calendar', 'core.agenda.tasks', 'core.agenda.notifications',
      'core.patients', 'core.patients.records', 'core.patients.team', 'core.patients.files',
      'core.clinical', 'core.clinical.notes', 'core.clinical.nextSession',
      'core.clinical.timeline', 'core.clinical.specialties', 'core.clinical.forms',
      'core.clinical.templates', 'core.treatments', 'core.treatments.catalog',
      'core.treatments.sessions', 'core.treatments.consents', 'core.billing',
      'core.billing.profiles', 'core.billing.orders', 'core.billing.cash',
      'core.billing.invoicing', 'core.admin', 'core.admin.team', 'core.admin.branches',
      'core.admin.reports',
    ].map((moduleKey) => ({ moduleKey, enabled: true })),
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));
vi.mock('@/hooks/useAppointments', () => ({
  useAppointments: (filters?: unknown, options?: { enabled?: boolean }) => {
    mocks.appointmentFilters.push(filters);
    mocks.appointmentOptions.push(options);
    return { data: mocks.appointments, isLoading: mocks.isLoading };
  },
  useAppointment: (id: string) => {
    mocks.detailIds.push(id);
    return { data: id ? mocks.deepLinked : undefined };
  },
  useUpdateAppointment: (id: string) => {
    mocks.updateHookIds.push(id);
    return { mutate: mocks.update, isPending: false };
  },
}));
vi.mock('@/hooks/useBranches', () => ({
  useBranches: () => ({ data: mocks.branches }),
  useClinicProfessionals: () => ({ data: mocks.professionals, isLoading: false }),
}));
vi.mock('@/hooks/useTenantSettings', () => ({
  useTenantSettings: () => ({ data: undefined }),
}));
vi.mock('./appointment-dialog', () => ({
  AppointmentDialog: () => null,
}));
vi.mock('./appointment-details-dialog', () => ({
  AppointmentDetailsDialog: ({ open, appointment, onOpenChange }: {
    open: boolean;
    appointment: Appointment | null;
    onOpenChange: (open: boolean) => void;
  }) =>
    open && appointment ? (
      <div>
        <div data-testid="selected-appointment">{appointment.id}</div>
        <button onClick={() => onOpenChange(false)}>Cerrar detalle</button>
      </div>
    ) : null,
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function appointment(id: string, professionalId: string): Appointment {
  return {
    id,
    tenantId: 'tenant-1',
    patientId: 'patient-1',
    patient: { id: 'patient-1', firstName: 'Ana', lastName: 'Vega', email: null, phone: null },
    professionalId,
    professional: { id: professionalId, firstName: 'Noa', lastName: 'Paz', email: 'noa@example.com' },
    specialtyId: 'nutrition',
    specialty: { id: 'nutrition', code: 'NUTRITION', name: 'Nutrición' },
    psychologistId: professionalId,
    psychologist: null,
    title: 'Consulta',
    description: null,
    startTime: '2026-10-01T15:00:00.000Z',
    endTime: '2026-10-01T16:00:00.000Z',
    duration: 60,
    status: AppointmentStatus.SCHEDULED,
    location: null,
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
  };
}

const first = appointment('appointment-1', 'professional-1');
const second = appointment('appointment-2', 'professional-2');

beforeEach(() => {
  vi.clearAllMocks();
  mocks.appointments = undefined;
  mocks.isLoading = true;
  mocks.search = '';
  mocks.updateHookIds.length = 0;
  mocks.branches = [];
  mocks.appointmentFilters.length = 0;
  mocks.appointmentOptions.length = 0;
  mocks.professionals = [];
  mocks.deepLinked = undefined;
  mocks.detailIds.length = 0;
  useAuthStore.setState({
    user: { id: 'admin-1', role: UserRole.MASTER, tenantId: 'tenant-1' } as User,
  });
});

describe('CalendarPage branch filter', () => {
  const main = { id: 'main', name: 'Sede principal', isMain: true, isActive: true };
  const north = { id: 'north', name: 'Sede Norte', isMain: false, isActive: true };
  const closed = { id: 'closed', name: 'Sede cerrada', isMain: false, isActive: false };

  it('is not shown to a clinic with a single active branch', () => {
    mocks.branches = [main, closed];
    render(<CalendarPage />);

    expect(screen.queryByLabelText('Filtrar por sede')).not.toBeInTheDocument();
    expect(mocks.appointmentFilters.at(-1)).toBeUndefined();
  });

  it('asks the API for the appointments of the chosen branch', () => {
    mocks.branches = [main, north, closed];
    render(<CalendarPage />);

    const filter = screen.getByLabelText('Filtrar por sede');
    expect(screen.queryByRole('option', { name: 'Sede cerrada' })).not.toBeInTheDocument();
    fireEvent.change(filter, { target: { value: 'north' } });
    expect(mocks.appointmentFilters.at(-1)).toEqual({ branchId: 'north' });

    fireEvent.change(filter, { target: { value: '' } });
    expect(mocks.appointmentFilters.at(-1)).toBeUndefined();
  });
});

describe('CalendarPage professional scope', () => {
  const ana = { id: 'professional-1', firstName: 'Ana', lastName: 'Paz' };
  const leo = { id: 'professional-2', firstName: 'Leo', lastName: 'Ruiz' };
  const signInAs = (role: UserRole, id = 'user-1') =>
    useAuthStore.setState({ user: { id, role, tenantId: 'tenant-1' } as User });
  const professionalFilter = () => screen.queryByLabelText('Filtrar por profesional');

  beforeEach(() => {
    // The API lists the newest account first; the filter lists them by name.
    mocks.professionals = [leo, ana];
  });

  it('shows the master every professional and lets them narrow to one', () => {
    render(<CalendarPage />);

    expect(professionalFilter()).toHaveValue('');
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Todos los profesionales',
      'Ana Paz',
      'Leo Ruiz',
    ]);
    expect(mocks.appointmentFilters.at(-1)).toBeUndefined();

    fireEvent.change(professionalFilter()!, { target: { value: 'professional-2' } });
    expect(mocks.appointmentFilters.at(-1)).toEqual({ professionalId: 'professional-2' });
  });

  it('shows a professional their own calendar without a professional filter', () => {
    signInAs(UserRole.PROFESIONAL, 'professional-1');
    render(<CalendarPage />);

    expect(professionalFilter()).not.toBeInTheDocument();
    expect(mocks.appointmentFilters.at(-1)).toBeUndefined();
    expect(mocks.appointmentOptions.at(-1)).toEqual({ enabled: true });
  });

  it('shows an assistant one professional at a time, never all of them', () => {
    signInAs(UserRole.ASISTENTE);
    render(<CalendarPage />);

    expect(professionalFilter()).toHaveValue('professional-1');
    expect(screen.queryByRole('option', { name: 'Todos los profesionales' })).not.toBeInTheDocument();
    expect(mocks.appointmentFilters.at(-1)).toEqual({ professionalId: 'professional-1' });

    fireEvent.change(professionalFilter()!, { target: { value: 'professional-2' } });
    expect(mocks.appointmentFilters.at(-1)).toEqual({ professionalId: 'professional-2' });
  });

  it('does not ask for appointments while an assistant has no professional to choose', () => {
    signInAs(UserRole.ASISTENTE);
    mocks.professionals = [];
    mocks.isLoading = false;
    render(<CalendarPage />);

    expect(mocks.appointmentOptions.at(-1)).toEqual({ enabled: false });
    expect(screen.getByText('No hay profesionales con un perfil activo.')).toBeInTheDocument();
  });

  it('opens a linked appointment for an assistant in the calendar of its professional', async () => {
    signInAs(UserRole.ASISTENTE);
    mocks.search = 'appointmentId=appointment-2';
    mocks.deepLinked = second;
    mocks.appointments = [second];
    mocks.isLoading = false;
    render(<CalendarPage />);

    await waitFor(() => expect(professionalFilter()).toHaveValue('professional-2'));
    expect(mocks.appointmentFilters.at(-1)).toEqual({ professionalId: 'professional-2' });
    expect(await screen.findByTestId('selected-appointment')).toHaveTextContent('appointment-2');
  });

  it('does not fetch a linked appointment apart for the master, who already lists every professional', () => {
    mocks.search = 'appointmentId=appointment-2';
    render(<CalendarPage />);

    expect(mocks.detailIds.every((id) => id === '')).toBe(true);
  });
});

describe('CalendarPage scoped interactions', () => {
  it('selects a matching deep-linked appointment only after the scoped list loads', async () => {
    mocks.search = 'appointmentId=appointment-1';
    const view = render(<CalendarPage />);
    expect(screen.queryByTestId('selected-appointment')).not.toBeInTheDocument();

    mocks.appointments = [first, second];
    mocks.isLoading = false;
    view.rerender(<CalendarPage />);

    expect(await screen.findByTestId('selected-appointment')).toHaveTextContent('appointment-1');
  });

  it('does not clear an unrelated selection when the deep link is unknown', async () => {
    mocks.appointments = [first, second];
    mocks.isLoading = false;
    const view = render(<CalendarPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Seleccionar appointment-2' }));
    expect(screen.getByTestId('selected-appointment')).toHaveTextContent('appointment-2');

    mocks.search = 'appointmentId=unknown';
    view.rerender(<CalendarPage />);

    expect(screen.getByTestId('selected-appointment')).toHaveTextContent('appointment-2');
  });

  it('does not reopen a dismissed deep-linked appointment when the list refreshes', async () => {
    mocks.search = 'appointmentId=appointment-1';
    mocks.appointments = [first, second];
    mocks.isLoading = false;
    const view = render(<CalendarPage />);
    expect(await screen.findByTestId('selected-appointment')).toHaveTextContent('appointment-1');

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar detalle' }));
    expect(screen.queryByTestId('selected-appointment')).not.toBeInTheDocument();

    mocks.appointments = [first, second];
    view.rerender(<CalendarPage />);

    expect(screen.queryByTestId('selected-appointment')).not.toBeInTheDocument();
  });

  it('leaves reschedule error feedback to the update hook', async () => {
    mocks.appointments = [first, second];
    mocks.isLoading = false;
    render(<CalendarPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Mover primera cita' }));

    await waitFor(() => expect(mocks.update).toHaveBeenCalled());
    mocks.update.mock.calls[0][1]?.onError?.(new Error('conflict'));

    expect(toast.error).not.toHaveBeenCalled();
  });

  it('rechecks permission and reschedules through the scoped update hook with canonical fields', async () => {
    mocks.appointments = [first, second];
    mocks.isLoading = false;
    useAuthStore.setState({
      user: { id: 'professional-2', role: UserRole.PROFESIONAL, tenantId: 'tenant-1' } as User,
    });
    const denied = render(<CalendarPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Mover primera cita' }));
    expect(mocks.update).not.toHaveBeenCalled();
    denied.unmount();

    useAuthStore.setState({
      user: { id: 'professional-1', role: UserRole.PROFESIONAL, tenantId: 'tenant-1' } as User,
    });
    render(<CalendarPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Mover primera cita' }));

    await waitFor(() => expect(mocks.updateHookIds).toContain('appointment-1'));
    await waitFor(() => expect(mocks.update).toHaveBeenCalled());
    expect(mocks.update.mock.calls[0][0]).toEqual({ startTime: '2026-10-02T15:00:00.000Z', duration: 60 });
    expect(mocks.update.mock.calls[0][0]).not.toHaveProperty('psychologistId');
  });
});
