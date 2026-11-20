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
  create: vi.fn(),
  noShow: vi.fn(),
  push: vi.fn(),
  sessionsOn: true,
  treatments: [] as unknown[],
  catalogCalls: [] as (boolean | undefined)[],
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: hooks.push }) }));
vi.mock('@/hooks/useSections', () => ({
  useSections: () => ({
    isEnabled: (key: string) => key !== 'core.treatments.sessions' || hooks.sessionsOn,
  }),
}));
vi.mock('@/hooks/useTreatments', () => ({
  useTreatments: (_filters: unknown, options?: { enabled?: boolean }) => {
    hooks.catalogCalls.push(options?.enabled);
    return { data: hooks.treatments };
  },
}));
vi.mock('@/hooks/useTreatmentSessions', () => ({
  useCreateTreatmentSessions: () => ({ mutateAsync: hooks.create, isPending: false }),
  useEncounterNoShow: () => ({ mutateAsync: hooks.noShow, isPending: false }),
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
  hooks.sessionsOn = true;
  hooks.treatments = [];
  hooks.catalogCalls = [];
  hooks.create.mockResolvedValue([{ id: 's1' }]);
  hooks.noShow.mockResolvedValue([]);
  useAuthStore.setState({ user: { id: 'me', tenantId: 'tenant-1' } as never });
});

const submit = (name: string) => act(async () => fireEvent.click(screen.getByRole('button', { name })));

describe('EncounterPanel', () => {
  it('starts an encounter with its type and reason', async () => {
    render(<EncounterPanel patientId="patient-1" encounters={[]} mode="specialties" />);

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
    render(<EncounterPanel patientId="patient-1" encounters={[]} mode="specialties" />);
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
    render(<EncounterPanel patientId="patient-1" encounters={[]} mode="specialties" />);
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
    render(<EncounterPanel patientId="patient-1" encounters={[]} initialAppointmentId="appointment-1" mode="specialties" />);

    expect(screen.getByLabelText('Cita que se atiende')).toHaveValue('appointment-1');
    fireEvent.change(screen.getByLabelText(/Motivo de consulta/), { target: { value: 'Control' } });
    await submit('Iniciar atención');

    expect(hooks.start).toHaveBeenCalledWith({
      encounterType: 'FIRST_VISIT',
      reason: 'Control',
      appointmentId: 'appointment-1',
    });
  });

  describe('treatments', () => {
    const catalog = (count: number) =>
      Array.from({ length: count }, (_, index) => ({
        id: `t${index + 1}`,
        name: `Tratamiento ${index + 1}`,
        isActive: true,
      }));
    const open = (mode: 'specialties' | 'treatments') => {
      render(<EncounterPanel patientId="patient-1" encounters={[]} mode={mode} />);
      fireEvent.click(screen.getByRole('button', { name: 'Iniciar atención' }));
    };
    const check = (name: string) => fireEvent.click(screen.getByRole('checkbox', { name }));
    const startButton = () => screen.getAllByRole('button', { name: 'Iniciar atención' }).at(-1)!;

    it('starts a plain encounter when no treatment is checked', async () => {
      hooks.treatments = catalog(3);
      open('specialties');

      expect(screen.getByRole('group', { name: 'Tratamientos (opcional)' })).toBeInTheDocument();
      fireEvent.change(screen.getByLabelText(/Motivo de consulta/), { target: { value: 'Control' } });
      await act(async () => fireEvent.click(startButton()));

      expect(hooks.start).toHaveBeenCalledWith({ encounterType: 'FIRST_VISIT', reason: 'Control' });
      expect(hooks.create).not.toHaveBeenCalled();
    });

    it('creates the sessions in catalog order and stays when several are checked', async () => {
      hooks.treatments = catalog(3);
      hooks.create.mockResolvedValueOnce([{ id: 's1' }, { id: 's2' }]);
      open('specialties');

      check('Tratamiento 3');
      check('Tratamiento 1');
      fireEvent.change(screen.getByLabelText(/Motivo de consulta/), { target: { value: 'Control' } });
      await act(async () => fireEvent.click(startButton()));

      expect(hooks.create).toHaveBeenCalledWith({
        treatmentIds: ['t1', 't3'],
        encounterType: 'FIRST_VISIT',
        reason: 'Control',
      });
      expect(hooks.start).not.toHaveBeenCalled();
      expect(hooks.push).not.toHaveBeenCalled();
      expect(screen.queryByLabelText('Tipo de atención')).not.toBeInTheDocument();
    });

    it('opens the session when exactly one treatment is checked', async () => {
      hooks.treatments = catalog(3);
      open('specialties');

      check('Tratamiento 2');
      fireEvent.change(screen.getByLabelText(/Motivo de consulta/), { target: { value: 'Control' } });
      await act(async () => fireEvent.click(startButton()));

      expect(hooks.push).toHaveBeenCalledWith('/treatment-sessions/s1');
    });

    it('offers no treatments when the sessions section is off', () => {
      hooks.sessionsOn = false;
      hooks.treatments = catalog(3);
      open('specialties');

      expect(screen.queryByRole('group', { name: 'Tratamientos (opcional)' })).not.toBeInTheDocument();
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
      // The catalog is not even requested while its section is off.
      expect(hooks.catalogCalls.length).toBeGreaterThan(0);
      expect(hooks.catalogCalls.every((enabled) => enabled === false)).toBe(true);
    });

    it('requests the catalog when the sessions section is on', () => {
      hooks.treatments = catalog(1);
      open('specialties');

      expect(hooks.catalogCalls.every((enabled) => enabled === true)).toBe(true);
    });

    it('asks only for treatments in treatments mode', async () => {
      hooks.treatments = catalog(2);
      open('treatments');

      expect(screen.queryByLabelText('Tipo de atención')).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/Motivo de consulta/)).not.toBeInTheDocument();
      expect(startButton()).toBeDisabled();

      check('Tratamiento 2');
      expect(startButton()).toBeEnabled();
      await act(async () => fireEvent.click(startButton()));

      expect(hooks.create).toHaveBeenCalledWith({ treatmentIds: ['t2'] });
      expect(hooks.push).toHaveBeenCalledWith('/treatment-sessions/s1');
    });

    it('prevents the eleventh treatment and says why', () => {
      hooks.treatments = catalog(11);
      open('specialties');

      expect(screen.queryByText('Máximo 10 tratamientos por atención')).not.toBeInTheDocument();
      for (let index = 1; index <= 10; index += 1) check(`Tratamiento ${index}`);

      expect(screen.getByRole('checkbox', { name: 'Tratamiento 11' })).toBeDisabled();
      expect(screen.getByRole('checkbox', { name: 'Tratamiento 1' })).toBeEnabled();
      expect(screen.getByText('Máximo 10 tratamientos por atención')).toBeInTheDocument();
    });
  });

  it('shows the encounter in course instead of the start button', () => {
    const open = encounter({ recordCount: 2, branch: { id: 'north', name: 'Sede Norte' } });
    render(<EncounterPanel patientId="patient-1" encounters={[open]} openEncounter={open} mode="specialties" />);

    expect(screen.getByText('Atención en curso')).toBeInTheDocument();
    expect(screen.getByText('Dolor lumbar de dos semanas')).toBeInTheDocument();
    expect(screen.getByText(/Sede Norte · 2 registros/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Iniciar atención' })).not.toBeInTheDocument();
    // An encounter that already holds records cannot be removed.
    expect(screen.queryByRole('button', { name: 'Eliminar atención' })).not.toBeInTheDocument();
  });

  describe('treatments of the encounter in course', () => {
    const session = (id: string, name: string, status: string) => ({
      id,
      status,
      treatment: { id: `t-${id}`, name },
    });
    const withSessions = (sessions: unknown[], overrides: Partial<Encounter> = {}) =>
      encounter({ treatmentSessions: sessions as Encounter['treatmentSessions'], ...overrides });
    const renderOpen = (open: Encounter, mode: 'specialties' | 'treatments' = 'specialties') =>
      render(<EncounterPanel patientId="patient-1" encounters={[open]} openEncounter={open} mode={mode} />);

    it('lists each treatment with its status and a link to continue it', () => {
      renderOpen(
        withSessions([
          session('s1', 'Toxina', 'INTAKE_IN_PROGRESS'),
          session('s2', 'Peeling', 'CLINICAL_COMPLETE'),
        ]),
      );

      const list = screen.getByRole('list', { name: 'Tratamientos de la atención' });
      const items = within(list).getAllByRole('listitem');
      expect(items).toHaveLength(2);
      expect(within(items[0]).getByText('Toxina')).toBeInTheDocument();
      expect(within(items[0]).getByText('Ficha en curso')).toBeInTheDocument();
      expect(within(items[1]).getByText('Cerrada')).toBeInTheDocument();
      expect(within(items[0]).getByRole('link', { name: 'Continuar Toxina' })).toHaveAttribute(
        'href',
        '/treatment-sessions/s1',
      );
    });

    it('keeps the statuses but offers no links while the sessions section is off', () => {
      hooks.sessionsOn = false;
      renderOpen(withSessions([session('s1', 'Toxina', 'INTAKE_IN_PROGRESS')]));

      const list = screen.getByRole('list', { name: 'Tratamientos de la atención' });
      expect(within(list).getByText('Ficha en curso')).toBeInTheDocument();
      expect(within(list).queryByRole('link')).not.toBeInTheDocument();
    });

    it('limits the add-treatment dialog to the screen and scrolls the catalog, not the buttons', () => {
      hooks.treatments = Array.from({ length: 20 }, (_, index) => ({
        id: `c${index}`,
        name: `Tratamiento ${index}`,
        isActive: true,
      }));
      renderOpen(withSessions([session('s1', 'Toxina', 'INTAKE_IN_PROGRESS')]));

      fireEvent.click(screen.getByRole('button', { name: 'Añadir tratamiento' }));
      const dialog = screen.getByRole('dialog', { name: 'Añadir tratamiento' });

      expect(dialog).toHaveClass('max-h-[90dvh]');
      const catalog = within(dialog).getByRole('group', { name: 'Tratamientos' });
      expect(catalog).toHaveClass('overflow-y-auto');
      // The actions are outside the scrolling area.
      expect(catalog).not.toContainElement(within(dialog).getByRole('button', { name: 'Añadir' }));
    });

    it('blocks closing while a treatment is unfinished and names it', () => {
      renderOpen(
        withSessions([
          session('s1', 'Toxina', 'IN_PROGRESS'),
          session('s2', 'Peeling', 'CLINICAL_COMPLETE'),
          session('s3', 'Relleno', 'CANCELLED'),
        ]),
      );

      expect(screen.getByRole('button', { name: 'Cerrar atención' })).toBeDisabled();
      expect(screen.getByText('Termina o cancela: Toxina')).toBeInTheDocument();
    });

    it('joins the names of several unfinished treatments', () => {
      renderOpen(
        withSessions([session('s1', 'Toxina', 'CONSENTED'), session('s2', 'Peeling', 'READY_FOR_CONSENT')]),
      );

      expect(screen.getByText('Termina o cancela: Toxina, Peeling')).toBeInTheDocument();
    });

    it('allows closing when every treatment is finished', () => {
      renderOpen(withSessions([session('s1', 'Toxina', 'CLINICAL_COMPLETE')]));

      expect(screen.getByRole('button', { name: 'Cerrar atención' })).toBeEnabled();
      expect(screen.queryByText(/Termina o cancela/)).not.toBeInTheDocument();
    });

    it('adds treatments not already in the encounter and sends the encounter id', async () => {
      hooks.treatments = [
        { id: 't-s1', name: 'Toxina', isActive: true },
        { id: 't2', name: 'Peeling', isActive: true },
        { id: 't3', name: 'Relleno', isActive: true },
      ];
      hooks.create.mockResolvedValueOnce([{ id: 'n1' }, { id: 'n2' }]);
      renderOpen(withSessions([session('s1', 'Toxina', 'INTAKE_IN_PROGRESS')]));

      fireEvent.click(screen.getByRole('button', { name: 'Añadir tratamiento' }));
      const dialog = screen.getByRole('dialog', { name: 'Añadir tratamiento' });
      expect(within(dialog).queryByRole('checkbox', { name: 'Toxina' })).not.toBeInTheDocument();
      fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Relleno' }));
      fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Peeling' }));
      await act(async () => fireEvent.click(within(dialog).getByRole('button', { name: 'Añadir' })));

      expect(hooks.create).toHaveBeenCalledWith({ treatmentIds: ['t2', 't3'], encounterId: 'encounter-1' });
      expect(hooks.push).not.toHaveBeenCalled();
      expect(screen.queryByRole('dialog', { name: 'Añadir tratamiento' })).not.toBeInTheDocument();
    });

    it('opens the wizard when exactly one treatment is added', async () => {
      hooks.treatments = [{ id: 't2', name: 'Peeling', isActive: true }];
      hooks.create.mockResolvedValueOnce([{ id: 'n1' }]);
      renderOpen(withSessions([]));

      fireEvent.click(screen.getByRole('button', { name: 'Añadir tratamiento' }));
      fireEvent.click(screen.getByRole('checkbox', { name: 'Peeling' }));
      await act(async () =>
        fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Añadir' })),
      );

      expect(hooks.push).toHaveBeenCalledWith('/treatment-sessions/n1');
    });

    it('counts the treatments already present against the limit of ten', () => {
      hooks.treatments = Array.from({ length: 5 }, (_, index) => ({
        id: `c${index + 1}`,
        name: `Catálogo ${index + 1}`,
        isActive: true,
      }));
      const present = Array.from({ length: 8 }, (_, index) =>
        session(`s${index}`, `Presente ${index}`, 'CLINICAL_COMPLETE'),
      );
      renderOpen(withSessions(present));

      fireEvent.click(screen.getByRole('button', { name: 'Añadir tratamiento' }));
      fireEvent.click(screen.getByRole('checkbox', { name: 'Catálogo 1' }));
      fireEvent.click(screen.getByRole('checkbox', { name: 'Catálogo 2' }));

      expect(screen.getByRole('checkbox', { name: 'Catálogo 3' })).toBeDisabled();
      expect(screen.getByText('Máximo 10 tratamientos por atención')).toBeInTheDocument();
    });

    it('offers again a treatment whose session was cancelled and does not count it', () => {
      hooks.treatments = [
        { id: 't-s1', name: 'Toxina', isActive: true },
        { id: 't-s2', name: 'Peeling', isActive: true },
        { id: 'c1', name: 'Catálogo 1', isActive: true },
        { id: 'c2', name: 'Catálogo 2', isActive: true },
      ];
      const counted = Array.from({ length: 7 }, (_, index) =>
        session(`k${index}`, `Presente ${index}`, 'CLINICAL_COMPLETE'),
      );
      renderOpen(
        withSessions([
          session('s1', 'Toxina', 'CANCELLED'),
          session('s2', 'Peeling', 'NO_SHOW'),
          ...counted,
        ]),
      );

      fireEvent.click(screen.getByRole('button', { name: 'Añadir tratamiento' }));
      const dialog = screen.getByRole('dialog', { name: 'Añadir tratamiento' });
      expect(within(dialog).getByRole('checkbox', { name: 'Toxina' })).toBeInTheDocument();
      expect(within(dialog).getByRole('checkbox', { name: 'Peeling' })).toBeInTheDocument();
      // 7 counted: three more fit, so the fourth box is the first one refused.
      fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Toxina' }));
      fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Peeling' }));
      expect(within(dialog).getByRole('checkbox', { name: 'Catálogo 1' })).toBeEnabled();
      fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Catálogo 1' }));
      expect(within(dialog).getByRole('checkbox', { name: 'Catálogo 2' })).toBeDisabled();
    });

    it('disables "Añadir tratamiento" and says why when ten treatments are already counted', () => {
      const ten = Array.from({ length: 10 }, (_, index) =>
        session(`k${index}`, `Presente ${index}`, 'CLINICAL_COMPLETE'),
      );
      renderOpen(withSessions([...ten, session('x', 'Cancelado', 'CANCELLED')]));

      expect(screen.getByRole('button', { name: 'Añadir tratamiento' })).toBeDisabled();
      expect(screen.getByText('Máximo 10 tratamientos por atención')).toBeInTheDocument();
    });

    it('keeps "Añadir tratamiento" enabled when cancelled sessions are the ones over ten', () => {
      const nine = Array.from({ length: 9 }, (_, index) =>
        session(`k${index}`, `Presente ${index}`, 'CLINICAL_COMPLETE'),
      );
      renderOpen(withSessions([...nine, session('x', 'Cancelado', 'CANCELLED')]));

      expect(screen.getByRole('button', { name: 'Añadir tratamiento' })).toBeEnabled();
      expect(screen.queryByText('Máximo 10 tratamientos por atención')).not.toBeInTheDocument();
    });

    it('hides "Añadir tratamiento" when the sessions section is off', () => {
      hooks.sessionsOn = false;
      hooks.treatments = [{ id: 't2', name: 'Peeling', isActive: true }];
      renderOpen(withSessions([session('s1', 'Toxina', 'INTAKE_IN_PROGRESS')]));

      expect(screen.queryByRole('button', { name: 'Añadir tratamiento' })).not.toBeInTheDocument();
    });

    it('records a no-show after confirmation', async () => {
      renderOpen(
        withSessions([session('s1', 'Toxina', 'INTAKE_IN_PROGRESS'), session('s2', 'Peeling', 'CONSENTED')]),
      );

      fireEvent.click(screen.getByRole('button', { name: 'No asistió' }));
      const dialog = screen.getByRole('dialog', { name: 'Registrar inasistencia' });
      expect(dialog).toHaveTextContent(/no se puede deshacer/);
      expect(dialog).toHaveTextContent(/cada tratamiento y la cita/);
      expect(hooks.noShow).not.toHaveBeenCalled();
      await act(async () =>
        fireEvent.click(within(dialog).getByRole('button', { name: 'Registrar inasistencia' })),
      );

      expect(hooks.noShow).toHaveBeenCalledWith('encounter-1');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('shows the API message when the no-show is refused', async () => {
      hooks.noShow.mockRejectedValueOnce({
        status: 409,
        code: 'ENCOUNTER_HAS_ACTIVITY',
        message: 'La atención ya tiene actividad clínica.',
      });
      renderOpen(withSessions([session('s1', 'Toxina', 'INTAKE_IN_PROGRESS')]));

      fireEvent.click(screen.getByRole('button', { name: 'No asistió' }));
      await act(async () =>
        fireEvent.click(
          within(screen.getByRole('dialog')).getByRole('button', { name: 'Registrar inasistencia' }),
        ),
      );

      expect(screen.getByRole('alert')).toHaveTextContent('La atención ya tiene actividad clínica.');
    });

    it.each([
      ['there is a treatment already in procedure', [session('s1', 'Toxina', 'IN_PROGRESS')]],
      ['there is a finished treatment', [session('s1', 'Toxina', 'CLINICAL_COMPLETE')]],
      ['there are no treatments', []],
    ])('does not offer "No asistió" when %s', (_label, sessions) => {
      renderOpen(withSessions(sessions));

      expect(screen.queryByRole('button', { name: 'No asistió' })).not.toBeInTheDocument();
    });

    it('does not offer "No asistió" when the sessions section is off', () => {
      hooks.sessionsOn = false;
      renderOpen(withSessions([session('s1', 'Toxina', 'INTAKE_IN_PROGRESS')]));

      expect(screen.queryByRole('button', { name: 'No asistió' })).not.toBeInTheDocument();
    });

    it('offers "No asistió" when the rest of the treatments were cancelled or did not attend', () => {
      renderOpen(
        withSessions([
          session('s1', 'Toxina', 'CONSENTED'),
          session('s2', 'Peeling', 'CANCELLED'),
          session('s3', 'Relleno', 'NO_SHOW'),
        ]),
      );

      expect(screen.getByRole('button', { name: 'No asistió' })).toBeInTheDocument();
    });

    it('does not offer "No asistió" when only cancelled treatments are left', () => {
      renderOpen(withSessions([session('s1', 'Toxina', 'CANCELLED')]));

      expect(screen.queryByRole('button', { name: 'No asistió' })).not.toBeInTheDocument();
    });

    it('does not offer to remove an encounter that has treatments, even with no records', () => {
      renderOpen(withSessions([session('s1', 'Toxina', 'INTAKE_IN_PROGRESS')]), 'specialties');

      expect(screen.queryByRole('button', { name: 'Eliminar atención' })).not.toBeInTheDocument();
    });

    it('does not offer to remove the encounter in treatments mode', () => {
      renderOpen(withSessions([session('s1', 'Toxina', 'INTAKE_IN_PROGRESS')]), 'treatments');

      expect(screen.queryByRole('button', { name: 'Eliminar atención' })).not.toBeInTheDocument();
    });
  });

  it('closes the encounter with an optional summary', async () => {
    const open = encounter();
    render(<EncounterPanel patientId="patient-1" encounters={[open]} openEncounter={open} mode="specialties" />);

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar atención' }));
    fireEvent.change(screen.getByLabelText('Resumen o indicaciones de cierre'), {
      target: { value: ' Control en 7 días ' },
    });
    // Closing signs: nothing is sent until the professional types their password.
    expect(screen.getByRole('button', { name: 'Cerrar y firmar' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Tu contraseña para firmar/), { target: { value: 'Clave-1' } });
    await submit('Cerrar y firmar');

    expect(hooks.close).toHaveBeenCalledWith({
      encounterId: 'encounter-1',
      summary: 'Control en 7 días',
      password: 'Clave-1',
    });
    expect(screen.queryByRole('button', { name: 'Cerrar y firmar' })).not.toBeInTheDocument();
  });

  it('keeps the dialog open with the reason when the password is refused, and forgets it', async () => {
    hooks.close.mockRejectedValueOnce({
      code: 'SIGNATURE_PASSWORD_INVALID',
      message: 'La contraseña no es correcta. Escríbela de nuevo para firmar.',
    });
    const open = encounter();
    render(<EncounterPanel patientId="patient-1" encounters={[open]} openEncounter={open} mode="specialties" />);

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar atención' }));
    const field = screen.getByLabelText(/Tu contraseña para firmar/);
    fireEvent.change(field, { target: { value: 'equivocada' } });
    await submit('Cerrar y firmar');

    expect(screen.getByRole('alert')).toHaveTextContent('La contraseña no es correcta');
    expect(field).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Cerrar y firmar' })).toBeDisabled();
  });

  it('removes an empty encounter only with a reason', async () => {
    const open = encounter();
    render(<EncounterPanel patientId="patient-1" encounters={[open]} openEncounter={open} mode="specialties" />);

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
    render(<EncounterPanel patientId="patient-1" encounters={[closed]} mode="specialties" />);

    expect(screen.getByText('Atenciones anteriores (1)')).toBeInTheDocument();
    expect(screen.getByText('Control · 03/10/2026')).toBeInTheDocument();
    expect(screen.getByText('Cerrada')).toBeInTheDocument();
    expect(screen.getByText('Sofía Ruiz · Fisioterapia · 1 registro')).toBeInTheDocument();
    expect(screen.getByText('Alta de fisioterapia')).toBeInTheDocument();
    // Closed before signatures existed: as final, without a fingerprint.
    expect(screen.getByText(/Cerrada antes de la firma digital/)).toBeInTheDocument();
  });

  it('shows when a closed encounter was signed and the start of its fingerprint', () => {
    const signed = encounter({
      id: 'encounter-0',
      status: 'CLOSED',
      signedAt: '2026-10-03T16:45:00.000Z',
      contentHash: 'v1:0123456789abcdef0123',
    });
    render(<EncounterPanel patientId="patient-1" encounters={[signed]} mode="specialties" />);

    expect(screen.getByText('Firmada')).toBeInTheDocument();
    expect(screen.getByText(/^Firmada el \d{2}\/10\/2026 \d{2}:\d{2} · huella 0123456789ab$/)).toBeInTheDocument();
  });
});
