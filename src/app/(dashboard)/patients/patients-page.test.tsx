import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/store/authStore';
import PatientsPage from './page';

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() }));
vi.mock('@/lib/api/client', () => ({ apiClient: http }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/components/layout/section-gate', () => ({
  SectionGate: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

type Params = { search?: string; status?: string; page: number; limit: number };

const patient = (n: number) => ({
  id: `patient-${n}`,
  tenantId: 'tenant-1',
  firstName: `Nombre${n}`,
  lastName: 'Paz',
  email: `p${n}@example.test`,
  phone: null,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  assignedPsychologist: null,
});
const pageOf = (page: number, total = 45) => ({
  data: Array.from({ length: Math.min(20, Math.max(0, total - (page - 1) * 20)) }, (_, i) => patient((page - 1) * 20 + i + 1)),
  meta: { page, limit: 20, total, totalPages: Math.max(1, Math.ceil(total / 20)) },
});
const requests = (): Params[] =>
  http.get.mock.calls.filter(([url]) => url === '/tenants/tenant-1/patients').map(([, config]) => config.params);

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PatientsPage />
    </QueryClientProvider>,
  );
}
const typeInSearch = (value: string) =>
  fireEvent.change(screen.getByLabelText('Buscar pacientes'), { target: { value } });
const sleep = (ms: number) => act(() => new Promise<void>((resolve) => setTimeout(resolve, ms)));

beforeEach(() => {
  vi.clearAllMocks();
  // A professional with a profile is worded by it, so the page does not fetch the clinic's specialties
  // (usePatientTerms) and the first request of every test is the patient list.
  useAuthStore.setState({
    tenant: { id: 'tenant-1' } as ReturnType<typeof useAuthStore.getState>['tenant'],
    user: { id: 'user-1', role: 'PROFESIONAL', professionalProfile: { specialty: { code: 'PSYCHOLOGY' } } } as never,
  });
  http.get.mockImplementation(async (_url: string, config: { params: Params }) => pageOf(config.params.page));
});

describe('patients page: server-side list', () => {
  it('shows the skeleton while the first page loads, then the rows and the pager', async () => {
    let release: (value: unknown) => void = () => undefined;
    http.get.mockReturnValueOnce(new Promise((resolve) => (release = resolve)));
    const { container } = renderPage();

    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    await act(async () => release(pageOf(1)));
    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(container.querySelector('.animate-pulse')).not.toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(21); // header + 20
    expect(screen.getByText('Página 1 de 3')).toBeInTheDocument();
    expect(screen.getByText('1–20 de 45')).toBeInTheDocument();
    expect(requests()).toEqual([{ status: 'active', page: 1, limit: 20 }]);
  });

  it('answers every keystroke at once but sends ONE request once typing pauses for 300 ms', async () => {
    renderPage();
    await screen.findByRole('table');
    expect(requests()).toHaveLength(1);

    for (const typed of ['m', 'ma', 'mar', 'mari', 'maria']) typeInSearch(typed);

    // The input is immediate, the request is not.
    expect(screen.getByLabelText('Buscar pacientes')).toHaveValue('maria');
    expect(requests()).toHaveLength(1);

    await waitFor(() => expect(requests()).toHaveLength(2), { timeout: 3000 });
    await sleep(500);
    expect(requests()).toHaveLength(2);
    expect(requests()[1]).toEqual({ search: 'maria', status: 'active', page: 1, limit: 20 });
  });

  it('sends one request exactly 300 ms after the last keystroke (fake timers)', async () => {
    renderPage();
    await screen.findByRole('table');
    vi.useFakeTimers();
    try {
      for (const typed of ['j', 'ju', 'jua', 'juan']) {
        typeInSearch(typed);
        await act(async () => { await vi.advanceTimersByTimeAsync(100); });
      }
      expect(screen.getByLabelText('Buscar pacientes')).toHaveValue('juan');
      expect(requests()).toHaveLength(1);

      await act(async () => { await vi.advanceTimersByTimeAsync(199); });
      expect(requests()).toHaveLength(1);
      await act(async () => { await vi.advanceTimersByTimeAsync(1); });
      expect(requests()).toHaveLength(2);
      expect(requests()[1]).toEqual({ search: 'juan', status: 'active', page: 1, limit: 20 });

      await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
      expect(requests()).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not search before the 300 ms are over', async () => {
    renderPage();
    await screen.findByRole('table');
    typeInSearch('ana');
    await sleep(150);
    expect(requests()).toHaveLength(1);
    await sleep(300);
    expect(requests()).toHaveLength(2);
  });

  it('asks the server for the next page, and keeps the rows on screen while it loads', async () => {
    renderPage();
    await screen.findByRole('table');

    let release: (value: unknown) => void = () => undefined;
    http.get.mockReturnValueOnce(new Promise((resolve) => (release = resolve)));
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));

    await waitFor(() => expect(requests()).toHaveLength(2));
    expect(requests()[1]).toEqual({ status: 'active', page: 2, limit: 20 });
    // No flicker: still the first page, not the skeleton nor the empty message.
    expect(screen.getByText('Nombre1 Paz')).toBeInTheDocument();
    expect(screen.queryByText('No se encontraron pacientes')).not.toBeInTheDocument();

    await act(async () => release(pageOf(2)));
    expect(await screen.findByText('Nombre21 Paz')).toBeInTheDocument();
    expect(screen.queryByText('Nombre1 Paz')).not.toBeInTheDocument();
    expect(screen.getByText('Página 2 de 3')).toBeInTheDocument();
    expect(screen.getByText('21–40 de 45')).toBeInTheDocument();
  });

  it('goes back to page 1 when the search changes', async () => {
    renderPage();
    await screen.findByRole('table');
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    await screen.findByText('Nombre21 Paz');

    typeInSearch('paz');
    await waitFor(() => expect(requests().some((r) => r.search === 'paz')).toBe(true), { timeout: 3000 });
    expect(requests().find((r) => r.search === 'paz')).toEqual({ search: 'paz', status: 'active', page: 1, limit: 20 });
  });

  it('goes back to page 1 and filters on the server when the status changes', async () => {
    renderPage();
    await screen.findByRole('table');
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    await screen.findByText('Nombre21 Paz');

    fireEvent.click(screen.getByRole('button', { name: /Filtros/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Todos' }));
    await waitFor(() => expect(requests().some((r) => r.status === 'all')).toBe(true));
    expect(requests().find((r) => r.status === 'all')).toEqual({ status: 'all', page: 1, limit: 20 });

    fireEvent.click(screen.getByRole('button', { name: 'Inactivos' }));
    await waitFor(() => expect(requests().some((r) => r.status === 'inactive')).toBe(true));
    expect(requests().find((r) => r.status === 'inactive')?.page).toBe(1);
  });

  it('starts on the active patients, and archived ones are one click away', async () => {
    renderPage();
    await screen.findByRole('table');
    expect(requests()[0].status).toBe('active');

    fireEvent.click(screen.getByRole('button', { name: /Filtros/ }));
    // "Activos" is the current view, so there is nothing to clear.
    expect(screen.queryByRole('button', { name: /Limpiar/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Inactivos' }));
    await waitFor(() => expect(requests().some((r) => r.status === 'inactive')).toBe(true));
    expect(requests().find((r) => r.status === 'inactive')).toEqual({ status: 'inactive', page: 1, limit: 20 });

    fireEvent.click(screen.getByRole('button', { name: /Limpiar/ }));
    await waitFor(() => expect(requests().at(-1)?.status).toBe('active'));
  });

  it('does not bring back the page of an earlier filter when returning to it', async () => {
    renderPage();
    await screen.findByRole('table');
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    await screen.findByText('Nombre21 Paz');

    fireEvent.click(screen.getByRole('button', { name: /Filtros/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Todos' }));
    await waitFor(() => expect(requests().some((r) => r.status === 'all')).toBe(true));
    fireEvent.click(screen.getByRole('button', { name: 'Activos' }));

    await waitFor(() => expect(requests().at(-1)).toEqual({ status: 'active', page: 1, limit: 20 }));
    expect(await screen.findByText('Página 1 de 3')).toBeInTheDocument();
  });

  it('shows the empty message when nothing matches, and no pager', async () => {
    http.get.mockResolvedValue(pageOf(1, 0));
    renderPage();
    expect(await screen.findByText('No se encontraron pacientes')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Paginación' })).not.toBeInTheDocument();
  });

  it('steps back to the last page when the page it was on no longer exists', async () => {
    renderPage();
    await screen.findByRole('table');
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    await screen.findByText('Nombre21 Paz');
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    await screen.findByText('Nombre41 Paz');

    // The rows of the last page were deleted meanwhile: the server now has 2 pages, and page 3 is empty.
    http.get.mockImplementation(async (_url: string, config: { params: Params }) => ({
      data: config.params.page > 2 ? [] : pageOf(config.params.page, 40).data,
      meta: { page: config.params.page, limit: 20, total: 40, totalPages: 2 },
    }));
    fireEvent.click(screen.getByRole('button', { name: 'Anterior' }));
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));

    await waitFor(() => expect(requests().at(-1)?.page).toBe(2));
    expect(await screen.findByText('Página 2 de 2')).toBeInTheDocument();
  });
});
