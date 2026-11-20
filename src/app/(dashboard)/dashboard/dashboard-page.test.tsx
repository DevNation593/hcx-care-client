import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

describe('Dashboard today count', () => {
  const originalTimeZone = process.env.TZ;

  beforeEach(() => {
    // Friday 20/11 at 20:30 in Ecuador, when the UTC calendar has already moved to Saturday.
    process.env.TZ = 'America/Guayaquil';
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-21T01:30:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env.TZ = originalTimeZone;
  });

  const appointmentRange = (params: { from?: string; to?: string }) => ({ from: params.from, to: params.to });
  const appointment = (id: string, startTime: string) => ({
    id,
    startTime,
    endTime: startTime,
    status: 'SCHEDULED',
    patient: { id: 'patient-1', firstName: 'Jane', lastName: 'Doe' },
  });

  it('counts the appointments of the local calendar day, not the UTC one', async () => {
    http.get.mockImplementation(async (url: string, config?: { params?: { from?: string; to?: string } }) => {
      if (!String(url).endsWith('/appointments')) return [];
      const params = config?.params ?? {};
      if (params.from === '2026-11-20' && params.to === '2026-11-20') {
        return [
          appointment('appointment-1', '2026-11-20T18:00:00.000Z'),
          appointment('appointment-2', '2026-11-20T21:00:00.000Z'),
        ];
      }
      return [];
    });

    renderAs(UserRole.MASTER);

    // The count sits right above the card's "próximas esta semana" line.
    await waitFor(() =>
      expect(screen.getByText(/próximas esta semana/).previousElementSibling).toHaveTextContent(/^2$/),
    );
    const ranges = http.get.mock.calls
      .filter(([url]) => String(url).endsWith('/appointments'))
      .map(([, config]) => appointmentRange(config?.params ?? {}));
    expect(ranges).toContainEqual({ from: '2026-11-20', to: '2026-11-20' });
    expect(ranges).toContainEqual({ from: '2026-11-16', to: '2026-11-22' });
  });
});
