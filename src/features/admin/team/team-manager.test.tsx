import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/store/authStore';
import { UserRole, type TenantSpecialty, type UsageMetrics, type User } from '@/types';
import { TeamManager } from './team-manager';

const api = vi.hoisted(() => ({
  listUsers: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  deleteUser: vi.fn(),
  activateUser: vi.fn(),
  listSpecialties: vi.fn(),
  getSubscription: vi.fn(),
  getUsage: vi.fn(),
  listCatalog: vi.fn(),
  listModules: vi.fn(),
}));

vi.mock('@/lib/api/endpoints', () => ({
  usersApi: {
    list: api.listUsers,
    create: api.createUser,
    update: api.updateUser,
    delete: api.deleteUser,
    activate: api.activateUser,
  },
  tenantSpecialtiesApi: { list: api.listSpecialties },
  subscriptionApi: { getCurrent: api.getSubscription, getUsage: api.getUsage },
  specialtyCatalogApi: { list: api.listCatalog },
  tenantModulesApi: { list: api.listModules, setEnabled: vi.fn() },
  extractArray: (response: User[] | { data?: User[] }) => Array.isArray(response) ? response : (response.data ?? []),
}));

const psychology: TenantSpecialty = {
  id: 'specialty-psychology',
  code: 'PSYCHOLOGY',
  name: 'Psicología',
  description: null,
  isActive: true,
  modules: [],
};

function makeUser(overrides: Partial<User> = {}): User {
  const id = overrides.id ?? 'user-1';
  return {
    id,
    email: `${id}@example.com`,
    firstName: 'Ana',
    lastName: 'Vega',
    role: UserRole.PROFESIONAL,
    tenantId: 'tenant-1',
    isActive: true,
    emailVerified: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    professionalProfile: {
      userId: id,
      specialtyId: psychology.id,
      specialty: { id: psychology.id, code: psychology.code, name: psychology.name, isActive: true },
      professionalTitle: 'Psicóloga clínica',
      licenseNumber: 'LIC-8',
      bio: 'Consulta clínica',
      isActive: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    ...overrides,
  };
}

function makeUsage(overrides: Partial<UsageMetrics['users']['professionals']> = {}): UsageMetrics {
  const professionals = {
    total: 3,
    active: 3,
    inactive: 0,
    limit: 7,
    percentUsed: 42.8,
    ...overrides,
  };
  return {
    tenantId: 'tenant-1',
    period: { start: '2026-09-01T00:00:00.000Z', end: '2026-10-01T00:00:00.000Z' },
    users: {
      admins: { total: 1, active: 1 },
      professionals,
      psychologists: { ...professionals, limit: 2 },
      assistants: { total: 0, active: 0, limit: null },
    },
    patients: { total: 0, active: 0, archived: 0, limit: 10, percentUsed: 0 },
    storage: {
      usedGB: 0, limitGB: 5, percentUsed: 0,
      breakdown: { attachments: 0, avatars: 0, exports: 0 },
    },
    notifications: {
      email: { sent: 0, limit: 0, percentUsed: 0 },
      push: { sent: 0, limit: 0, percentUsed: 0 },
      sms: { sent: 0, limit: 0, percentUsed: 0 },
    },
    appointments: { total: 0, completed: 0, upcoming: 0, canceled: 0 },
    api: { requests: 0, limit: null },
  };
}

function renderManager(users: User[] | { data: User[]; total: number; page: number; limit: number } = []) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  api.listUsers.mockResolvedValue(users);
  const view = render(<TeamManager />, { wrapper });
  return { ...view, client };
}

function expectCoreInvalidations(client: QueryClient) {
  const keys = vi.mocked(client.invalidateQueries).mock.calls.map(([filters]) => filters?.queryKey);
  expect(keys).toContainEqual(['users']);
  expect(keys).toContainEqual(['subscription']);
  expect(keys).toContainEqual(['subscription', 'usage']);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('confirm', vi.fn(() => true));
  useAuthStore.setState({
    tenant: {
      id: 'tenant-1',
      tenantType: 'CLINIC',
      subscription: { plan: { limits: { maxPsychologists: 99 } } },
    } as ReturnType<typeof useAuthStore.getState>['tenant'],
    user: { id: 'admin-1', role: UserRole.MASTER, tenantId: 'tenant-1' } as User,
  });
  api.listUsers.mockResolvedValue([]);
  api.createUser.mockImplementation(async (input: unknown) => input);
  api.updateUser.mockImplementation(async (_userId: string, input: unknown) => input);
  api.deleteUser.mockResolvedValue({ message: 'Usuario desactivado exitosamente' });
  api.activateUser.mockResolvedValue(undefined);
  api.listSpecialties.mockResolvedValue([psychology]);
  api.getSubscription.mockResolvedValue({ id: 'subscription-1' });
  api.getUsage.mockResolvedValue(makeUsage());
  api.listCatalog.mockResolvedValue([]);
  api.listModules.mockResolvedValue([]);
});

afterEach(() => vi.unstubAllGlobals());

describe('TeamManager', () => {
  it('does not offer permission assignment to the clinic master', async () => {
    renderManager([makeUser({ firstName: 'Ana', lastName: 'Vega' })]);
    expect(await screen.findByText('Ana Vega')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Permisos de Ana Vega' })).not.toBeInTheDocument();
  });
  it.each(['array', 'paginated'])('shows only account holder, professional and assistant rows for a %s response', async (shape) => {
    const rows = [
      makeUser({ id: 'holder-row', firstName: 'Tina', lastName: 'Titular', role: UserRole.MASTER, professionalProfile: undefined }),
      makeUser({ id: 'professional-row', firstName: 'Pablo', lastName: 'Profesional', role: UserRole.PROFESIONAL }),
      makeUser({ id: 'assistant', firstName: 'Team', lastName: 'Assistant', role: UserRole.ASISTENTE, professionalProfile: undefined }),
      makeUser({ id: 'patient', firstName: 'Patient', lastName: 'Outside', role: UserRole.PACIENTE }),
      makeUser({ id: 'support', firstName: 'Support', lastName: 'Outside', role: UserRole.SOPORTE }),
    ];
    const response = shape === 'array'
      ? rows
      : { data: rows, total: rows.length, page: 1, limit: rows.length };
    renderManager(response);

    expect(await screen.findByText('Tina Titular')).toBeInTheDocument();
    expect(screen.getByText('Pablo Profesional')).toBeInTheDocument();
    expect(screen.getByText('Team Assistant')).toBeInTheDocument();
    expect(screen.queryByText('Patient Outside')).not.toBeInTheDocument();
    expect(screen.queryByText('Support Outside')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editar Patient Outside' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Desactivar cuenta de Support Outside' })).not.toBeInTheDocument();
  });

  it('renders array and paginated user results with separate account and clinical states', async () => {
    const manager = makeUser({
      firstName: 'Ana', lastName: 'Vega', role: UserRole.MASTER,
      professionalProfile: undefined,
    });
    const professional = makeUser({
      id: 'professional-1', firstName: 'Luis', lastName: 'Paz',
      isActive: false,
      professionalProfile: {
        ...makeUser().professionalProfile!,
        isActive: false,
        userId: 'professional-1',
        specialty: undefined as unknown as NonNullable<User['professionalProfile']>['specialty'],
      },
    });
    const { unmount } = renderManager([manager, professional]);

    expect(await screen.findByText('Ana Vega')).toBeInTheDocument();
    expect(screen.getByText('Luis Paz')).toBeInTheDocument();
    expect(screen.getByText('Titular de la cuenta')).toBeInTheDocument();
    expect(screen.getAllByText('Sin perfil clínico')).toHaveLength(1);
    expect(screen.getByText('Cuenta activa')).toBeInTheDocument();
    expect(screen.getByText('Cuenta inactiva')).toBeInTheDocument();
    expect(screen.getByText('No aplica')).toBeInTheDocument();
    expect(screen.getByText('Atención clínica inactiva')).toBeInTheDocument();
    expect(screen.getByText('Psicología')).toBeInTheDocument();
    unmount();

    renderManager({ data: [manager], total: 12, page: 1, limit: 1 });
    expect(await screen.findByText('Ana Vega')).toBeInTheDocument();
  });

  it('uses the API professionals usage limit rather than plan or legacy psychologist limits', async () => {
    api.getUsage.mockResolvedValue(makeUsage({ active: 3, limit: 7 }));
    api.listUsers.mockResolvedValue({ data: [makeUser()], total: 30, page: 1, limit: 1 });
    renderManager();

    expect(await screen.findByText('3 de 7 perfiles clínicos activos')).toBeInTheDocument();
    expect(screen.queryByText(/99|de 2/)).not.toBeInTheDocument();
  });

  it('falls back to active-profile counting only when the user result is complete', async () => {
    api.getUsage.mockRejectedValueOnce(new Error('Usage unavailable'));
    const { unmount } = renderManager([
      makeUser({ id: 'active-professional' }),
      makeUser({ id: 'inactive-professional', professionalProfile: { ...makeUser().professionalProfile!, isActive: false } }),
      makeUser({ id: 'assistant', role: UserRole.ASISTENTE, professionalProfile: undefined }),
      makeUser({ id: 'patient-with-profile', role: UserRole.PACIENTE }),
      makeUser({ id: 'support-with-profile', role: UserRole.SOPORTE }),
    ]);

    expect(await screen.findByText('1 perfiles clínicos activos')).toBeInTheDocument();
    expect(screen.getByText(/no se pudo confirmar el uso ni el límite/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar uso de perfiles clínicos' })).toBeInTheDocument();
    expect(screen.queryByText(/1 de \d+ perfiles clínicos activos/)).not.toBeInTheDocument();
    unmount();

    api.getUsage.mockRejectedValueOnce(new Error('Usage unavailable'));
    api.listUsers.mockResolvedValue({ data: [makeUser()], total: 100, page: 1, limit: 1 });
    renderManager({ data: [makeUser()], total: 100, page: 1, limit: 1 });

    expect(await screen.findByText('No se pudo consultar el uso de perfiles clínicos.')).toBeInTheDocument();
    expect(screen.queryByText(/perfiles clínicos activos$/)).not.toBeInTheDocument();
  });

  it.each([
    {
      resultKind: 'complete array',
      users: [
        makeUser({ id: 'active-after-usage-error' }),
        makeUser({ id: 'inactive-after-usage-error', professionalProfile: { ...makeUser().professionalProfile!, isActive: false } }),
      ],
      expectedLocalCount: '1 perfiles clínicos activos',
    },
    {
      resultKind: 'paginated page',
      users: { data: [makeUser({ id: 'page-user' })], total: 40, page: 1, limit: 1 },
      expectedLocalCount: null,
    },
  ])('ignores cached usage after a failed refetch with a $resultKind user result', async ({ users, expectedLocalCount }) => {
    api.getUsage.mockResolvedValueOnce(makeUsage({ active: 4, limit: 8 }));
    const { client } = renderManager(users);
    expect(await screen.findByText('4 de 8 perfiles clínicos activos')).toBeInTheDocument();

    api.getUsage.mockRejectedValueOnce(new Error('Usage refresh failed'));
    await act(async () => {
      await client.refetchQueries({ queryKey: ['subscription', 'usage'] });
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Reintentar uso de perfiles clínicos' })).toBeInTheDocument();
    });
    expect(api.getUsage).toHaveBeenCalledTimes(2);
    expect(screen.queryByText('4 de 8 perfiles clínicos activos')).not.toBeInTheDocument();
    expect(screen.queryByText(/de 8 perfiles clínicos activos/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar uso de perfiles clínicos' })).toBeInTheDocument();
    if (expectedLocalCount) {
      expect(screen.getByText(expectedLocalCount)).toBeInTheDocument();
      expect(screen.getByText(/no se pudo confirmar el uso ni el límite/i)).toBeInTheDocument();
    } else {
      expect(screen.getByText('No se pudo consultar el uso de perfiles clínicos.')).toBeInTheDocument();
      expect(screen.queryByText(/perfiles clínicos activos/)).not.toBeInTheDocument();
    }
  });

  it('creates and edits through the narrow clients and invalidates users, subscription, and usage', async () => {
    const user = makeUser({ id: 'edit-1', firstName: 'Luis', lastName: 'Paz' });
    const { client } = renderManager([user]);
    const invalidate = vi.spyOn(client, 'invalidateQueries');

    fireEvent.click(await screen.findByRole('button', { name: 'Agregar miembro' }));
    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'nuevo@example.com' } });
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Nora' } });
    fireEvent.change(screen.getByLabelText('Apellido'), { target: { value: 'Ríos' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'Secret123' } });
    fireEvent.change(screen.getByLabelText('Rol'), { target: { value: UserRole.ASISTENTE } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear miembro' }));

    await waitFor(() => expect(api.createUser).toHaveBeenCalledWith({
      email: 'nuevo@example.com',
      password: 'Secret123',
      firstName: 'Nora',
      lastName: 'Ríos',
      role: UserRole.ASISTENTE,
    }, 'tenant-1'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expectCoreInvalidations(client);

    invalidate.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Editar Luis Paz' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(api.updateUser).toHaveBeenCalledWith('edit-1', {
      email: 'edit-1@example.com',
      firstName: 'Luis',
      lastName: 'Paz',
      role: UserRole.PROFESIONAL,
      professionalProfile: {
        specialtyId: psychology.id,
        professionalTitle: 'Psicóloga clínica',
        licenseNumber: 'LIC-8',
        bio: 'Consulta clínica',
        isActive: true,
      },
    }, 'tenant-1'));
    expectCoreInvalidations(client);
  });

  it('disables only clinical care with the existing profile and leaves account state untouched', async () => {
    const user = makeUser({ firstName: 'Luis', lastName: 'Paz' });
    const { client } = renderManager([user]);
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    fireEvent.click(await screen.findByRole('button', { name: 'Desactivar atención clínica de Luis Paz' }));

    await waitFor(() => expect(api.updateUser).toHaveBeenCalledWith('user-1', {
      professionalProfile: {
        specialtyId: psychology.id,
        professionalTitle: 'Psicóloga clínica',
        licenseNumber: 'LIC-8',
        bio: 'Consulta clínica',
        isActive: false,
      },
    }, 'tenant-1'));
    expect(api.deleteUser).not.toHaveBeenCalled();
    expect(await screen.findByText('Cuenta activa')).toBeInTheDocument();
    expectCoreInvalidations(client);
    expect(invalidate).toHaveBeenCalled();
  });

  it('surfaces an API rejection (MASTER_IMMUTABLE) and keeps the row', async () => {
    const user = makeUser({ id: 'pro-9', firstName: 'Elena', lastName: 'Ríos' });
    api.updateUser.mockRejectedValueOnce({
      code: 'MASTER_IMMUTABLE',
      message: 'El titular de la cuenta no puede cambiar de rol ni desactivarse.',
    });
    renderManager([user]);
    fireEvent.click(await screen.findByRole('button', { name: 'Desactivar atención clínica de Elena Ríos' }));

    const message = await screen.findByText('El titular de la cuenta no puede cambiar de rol ni desactivarse.');
    expect(message.closest('[role="alert"]')).toBeInTheDocument();
    expect(screen.getByText('Elena Ríos')).toBeInTheDocument();
    expect(screen.getByText('Cuenta activa')).toBeInTheDocument();
  });

  it('invalidates the team and subscription data after a successful account deactivation', async () => {
    const user = makeUser({ id: 'deactivate-1', firstName: 'Marta', lastName: 'Sol' });
    const { client } = renderManager([user]);
    vi.spyOn(client, 'invalidateQueries');
    fireEvent.click(await screen.findByRole('button', { name: 'Desactivar cuenta de Marta Sol' }));

    await waitFor(() => expect(api.deleteUser).toHaveBeenCalledWith('deactivate-1', 'tenant-1'));
    expectCoreInvalidations(client);
    expect(await screen.findByText('Marta Sol')).toBeInTheDocument();
  });

  it('reactivates an account with PATCH isActive true rather than the legacy password activation route', async () => {
    const user = makeUser({
      id: 'inactive-1', firstName: 'María', lastName: 'Sol', isActive: false,
    });
    const { client } = renderManager([user]);
    vi.spyOn(client, 'invalidateQueries');
    fireEvent.click(await screen.findByRole('button', { name: 'Reactivar cuenta de María Sol' }));

    await waitFor(() => expect(api.updateUser).toHaveBeenCalledWith('inactive-1', { isActive: true }, 'tenant-1'));
    expect(api.activateUser).not.toHaveBeenCalled();
    expectCoreInvalidations(client);
  });

  it('keeps ordinary actions available for provider-managed rows', async () => {
    const managed = makeUser({
      id: 'managed-1',
      firstName: 'Equipo',
      lastName: 'Proveedor',
      isActive: false,
      managedByProvider: true,
    });
    renderManager([managed]);

    expect(await screen.findByRole('button', { name: 'Editar Equipo Proveedor' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Reactivar cuenta de Equipo Proveedor' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Desactivar atención clínica de Equipo Proveedor' })).toBeEnabled();
  });

  it('shows a retryable user-list error without replacing the page with an empty state', async () => {
    api.listUsers.mockRejectedValueOnce(new Error('No se pudo cargar el equipo.'));
    renderManager();

    const readErrorMessage = await screen.findByText('No se pudo cargar el equipo.');
    expect(readErrorMessage.closest('[role="alert"]')).toHaveTextContent('No se pudo cargar el equipo.');
    expect(screen.getByRole('button', { name: 'Reintentar miembros' })).toBeInTheDocument();
  });

  it('keeps the clinic-plan unavailable state and skips team requests for personal plans', async () => {
    useAuthStore.setState({
      tenant: { ...useAuthStore.getState().tenant!, tenantType: 'PERSONAL' } as ReturnType<typeof useAuthStore.getState>['tenant'],
    });
    renderManager();

    expect(await screen.findByText('Módulo de Equipo no disponible')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver Planes de Clínica' })).toHaveAttribute('href', '/admin/subscription');
    expect(api.listUsers).not.toHaveBeenCalled();
    expect(api.listSpecialties).not.toHaveBeenCalled();
  });

  it('renders a read-only table for users who are not the account holder', async () => {
    useAuthStore.setState({ user: { id: 'professional-actor', role: UserRole.PROFESIONAL, tenantId: 'tenant-1' } as User });
    renderManager([makeUser()]);

    expect(await screen.findByText('Ana Vega')).toBeInTheDocument();
    expect(screen.getByText('Vista de solo lectura')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editar Ana Vega' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Agregar miembro' })).not.toBeInTheDocument();
  });

  it('does not surface a stale mutation error after the active tenant changes', async () => {
    let reject!: (error: unknown) => void;
    api.updateUser.mockImplementationOnce(() => new Promise((_resolve, rej) => { reject = rej; }));
    const user = makeUser({ id: 'tenant-a-user', firstName: 'A', lastName: 'User' });
    renderManager([user]);
    fireEvent.click(await screen.findByRole('button', { name: 'Desactivar atención clínica de A User' }));
    await waitFor(() => expect(api.updateUser).toHaveBeenCalledWith(
      'tenant-a-user',
      expect.objectContaining({ professionalProfile: expect.objectContaining({ isActive: false }) }),
      'tenant-1',
    ));

    act(() => useAuthStore.setState({
      tenant: { ...useAuthStore.getState().tenant!, id: 'tenant-2' } as ReturnType<typeof useAuthStore.getState>['tenant'],
      user: { id: 'admin-2', role: UserRole.MASTER, tenantId: 'tenant-2' } as User,
    }));
    await waitFor(() => expect(api.listUsers).toHaveBeenCalledWith(undefined, 'tenant-2'));
    await act(async () => reject(new Error('Tenant A request failed')));

    expect(screen.queryByText('Tenant A request failed')).not.toBeInTheDocument();
    expect(screen.queryByText('No se pudo actualizar el equipo')).not.toBeInTheDocument();
  });

  it('prevents duplicate account actions while a server mutation is pending', async () => {
    let resolve!: () => void;
    api.deleteUser.mockImplementationOnce(() => new Promise<void>((res) => { resolve = res; }));
    const user = makeUser({ id: 'pending-1', firstName: 'Paz', lastName: 'Luz' });
    renderManager([user]);
    const deactivate = await screen.findByRole('button', { name: 'Desactivar cuenta de Paz Luz' });
    fireEvent.click(deactivate);
    fireEvent.click(deactivate);

    await waitFor(() => expect(api.deleteUser).toHaveBeenCalledTimes(1));
    expect(deactivate).toBeDisabled();
    resolve();
  });
});

describe('TeamManager account holder row', () => {
  const holder = makeUser({
    id: 'master-1', firstName: 'Tina', lastName: 'Titular', role: UserRole.MASTER,
    professionalProfile: undefined,
  });
  const assistant = makeUser({
    id: 'assistant-1', firstName: 'Abel', lastName: 'Asistente', role: UserRole.ASISTENTE,
    professionalProfile: undefined,
  });

  it('labels the account holder and offers no deactivation for that row', async () => {
    useAuthStore.setState({ user: holder });
    renderManager([holder, assistant]);

    expect(await screen.findByText('Titular de la cuenta')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Editar Tina Titular' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Desactivar cuenta de Tina Titular' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Desactivar cuenta de Abel Asistente' }),
    ).toBeInTheDocument();
  });
});
