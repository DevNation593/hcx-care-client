import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/store/authStore';
import TasksPage from './page';

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() }));
vi.mock('@/lib/api/client', () => ({ apiClient: http }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/components/layout/section-gate', () => ({
  SectionGate: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

type Params = { search?: string; status?: string; priority?: string; page?: number; limit?: number };

const SUMMARY = { pending: 30, overdue: 4, completed: 12, cancelled: 3 };
const task = (n: number, status = 'PENDING') => ({
  id: `task-${n}`,
  tenantId: 'tenant-1',
  title: `Actividad ${n}`,
  status,
  priority: 'MEDIUM',
  dueDate: '2099-01-01T00:00:00.000Z',
  patient: { id: 'p-1', firstName: 'Ana', lastName: 'Paz' },
  assignedTo: null,
  createdAt: '2026-01-01T00:00:00.000Z',
});
const pageOf = (page: number, total = 45) => ({
  data: Array.from({ length: Math.min(20, Math.max(0, total - (page - 1) * 20)) }, (_, i) => task((page - 1) * 20 + i + 1)),
  meta: { page, limit: 20, total, totalPages: Math.max(1, Math.ceil(total / 20)) },
});
const listRequests = (): Params[] =>
  http.get.mock.calls.filter(([url]) => url === '/tenants/tenant-1/tasks').map(([, config]) => config.params);
const summaryRequests = (): Params[] =>
  http.get.mock.calls.filter(([url]) => url === '/tenants/tenant-1/tasks/summary').map(([, config]) => config.params);

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <TasksPage />
    </QueryClientProvider>,
  );
}
const typeInSearch = (value: string) =>
  fireEvent.change(screen.getByPlaceholderText('Buscar actividades...'), { target: { value } });
const sleep = (ms: number) => act(() => new Promise<void>((resolve) => setTimeout(resolve, ms)));

beforeEach(() => {
  vi.clearAllMocks();
  // The master has a profile too, so the page does not fetch the clinic's specialties (usePatientTerms)
  // and the first request of every test is the task list.
  useAuthStore.setState({
    tenant: { id: 'tenant-1' } as never,
    user: { id: 'user-1', role: 'MASTER', professionalProfile: { specialty: { code: 'PSYCHOLOGY' } } } as never,
  });
  http.get.mockImplementation(async (url: string, config: { params: Params }) =>
    url.endsWith('/summary') ? SUMMARY : pageOf(config.params.page ?? 1),
  );
});

describe('tasks page: server-side list', () => {
  it('shows the skeleton first, then one page of tasks with the pager', async () => {
    let release: (value: unknown) => void = () => undefined;
    http.get.mockImplementationOnce(() => new Promise((resolve) => (release = resolve)));
    const { container } = renderPage();

    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
    await act(async () => release(pageOf(1)));

    expect(await screen.findByText('Actividad 1')).toBeInTheDocument();
    expect(screen.getAllByText(/^Actividad \d+$/)).toHaveLength(20);
    expect(screen.getByText('Página 1 de 3')).toBeInTheDocument();
    expect(listRequests()).toEqual([{ page: 1, limit: 20 }]);
  });

  it('takes the counters and headings of the whole list from the summary, not from the page', async () => {
    renderPage();
    await screen.findByText('Actividad 1');

    await waitFor(() => expect(screen.getByText('30')).toBeInTheDocument());
    expect(screen.getByText('4')).toBeInTheDocument(); // overdue
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('3', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByText('Activas (30)')).toBeInTheDocument();
    expect(summaryRequests()).toEqual([{}]);
  });

  it('sends ONE list request and ONE summary request once typing pauses for 300 ms', async () => {
    renderPage();
    await screen.findByText('Actividad 1');
    await waitFor(() => expect(summaryRequests()).toHaveLength(1));

    for (const typed of ['i', 'in', 'inf', 'info', 'informe']) typeInSearch(typed);
    expect(screen.getByPlaceholderText('Buscar actividades...')).toHaveValue('informe');
    expect(listRequests()).toHaveLength(1);
    expect(summaryRequests()).toHaveLength(1);

    await waitFor(() => expect(listRequests()).toHaveLength(2), { timeout: 3000 });
    await sleep(500);
    expect(listRequests()).toEqual([{ page: 1, limit: 20 }, { search: 'informe', page: 1, limit: 20 }]);
    expect(summaryRequests()).toEqual([{}, { search: 'informe' }]);
  });

  it('asks the server for the next page without asking for the summary again', async () => {
    renderPage();
    await screen.findByText('Actividad 1');
    await waitFor(() => expect(summaryRequests()).toHaveLength(1));

    let release: (value: unknown) => void = () => undefined;
    http.get.mockImplementationOnce(() => new Promise((resolve) => (release = resolve)));
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));

    await waitFor(() => expect(listRequests()).toHaveLength(2));
    expect(listRequests()[1]).toEqual({ page: 2, limit: 20 });
    // Same rows on screen while page 2 loads: no skeleton, no empty message.
    expect(screen.getByText('Actividad 1')).toBeInTheDocument();
    expect(screen.queryByText('No hay actividades')).not.toBeInTheDocument();

    await act(async () => release(pageOf(2)));
    expect(await screen.findByText('Actividad 21')).toBeInTheDocument();
    expect(screen.getByText('Página 2 de 3')).toBeInTheDocument();
    expect(summaryRequests()).toHaveLength(1);
  });

  it('filters by state and priority on the server and starts again on page 1', async () => {
    renderPage();
    await screen.findByText('Actividad 1');
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    await screen.findByText('Actividad 21');

    fireEvent.click(screen.getByRole('button', { name: /Filtros/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Pendiente' }));
    await waitFor(() => expect(listRequests().some((r) => r.status === 'PENDING')).toBe(true));
    expect(listRequests().find((r) => r.status === 'PENDING')).toEqual({ status: 'PENDING', page: 1, limit: 20 });

    fireEvent.click(screen.getByRole('button', { name: 'Alta' }));
    await waitFor(() => expect(listRequests().some((r) => r.priority === 'HIGH')).toBe(true));
    expect(listRequests().find((r) => r.priority === 'HIGH')).toMatchObject({ status: 'PENDING', priority: 'HIGH', page: 1 });
    // The summary follows the priority, but not the state: it is what counts the states.
    await waitFor(() => expect(summaryRequests().some((r) => r.priority === 'HIGH')).toBe(true));
    expect(summaryRequests().every((r) => !('status' in r))).toBe(true);
  });

  it('shows the empty message when nothing matches', async () => {
    http.get.mockImplementation(async (url: string) =>
      url.endsWith('/summary')
        ? { pending: 0, overdue: 0, completed: 0, cancelled: 0 }
        : { data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } },
    );
    renderPage();
    expect(await screen.findByText('No hay actividades')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Paginación' })).not.toBeInTheDocument();
  });
});
