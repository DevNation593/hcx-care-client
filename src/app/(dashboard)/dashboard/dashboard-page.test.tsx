import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DashboardPage from './page';
import { useAuthStore } from '@/store/authStore';
import { UserRole, type User } from '@/types';

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }));
vi.mock('@/lib/api/client', () => ({ apiClient: http }));
vi.mock('@/hooks/useSpecialties', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/useSpecialties')>()),
  useTenantModules: () => ({
    data: ['core.agenda', 'core.agenda.calendar', 'core.agenda.tasks', 'core.patients', 'core.patients.records'].map((moduleKey) => ({ moduleKey, enabled: true })),
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function renderAs(role: UserRole) {
  useAuthStore.setState({
    user: { id: 'user-1', role, tenantId: 'tenant-1' } as User,
    tenant: { id: 'tenant-1' } as ReturnType<typeof useAuthStore.getState>['tenant'],
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><DashboardPage /></QueryClientProvider>);
}

const requestedAppointments = () =>
  http.get.mock.calls.some(([url]) => String(url).endsWith('/appointments'));

beforeEach(() => {
  vi.clearAllMocks();
  http.get.mockResolvedValue([]);
});

describe('Dashboard appointments', () => {
  it.each([UserRole.MASTER, UserRole.PROFESIONAL])('summarizes the appointments a %s can see', async (role) => {
    renderAs(role);

    expect(await screen.findByText('Citas de Hoy')).toBeInTheDocument();
    expect(await screen.findByText('Citas Hoy')).toBeInTheDocument();
    expect(requestedAppointments()).toBe(true);
  });

  it('does not summarize every calendar for an assistant, who works one professional at a time', async () => {
    renderAs(UserRole.ASISTENTE);

    expect(await screen.findByText('Actividades Vencidas')).toBeInTheDocument();
    expect(await screen.findByText('Pacientes Activos')).toBeInTheDocument();
    expect(screen.queryByText('Citas de Hoy')).not.toBeInTheDocument();
    expect(screen.queryByText('Citas Hoy')).not.toBeInTheDocument();
    expect(screen.queryByText('Citas Completadas')).not.toBeInTheDocument();
    expect(requestedAppointments()).toBe(false);
    expect(screen.getByRole('link', { name: 'Nueva Cita' })).toHaveAttribute('href', '/calendar');
  });
});
