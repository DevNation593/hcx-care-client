import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/store/authStore';
import { extractPage } from '@/lib/api/endpoints';
import { useCreatePatient, usePatients, usePatientsPage } from './usePatients';
import { useCreateTask, useTasks, useTasksPage, useTaskSummary } from './useTasks';

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() }));
vi.mock('@/lib/api/client', () => ({ apiClient: http }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const patient = (id: string) => ({ id, firstName: `P${id}`, lastName: 'Paz', isActive: true });
const task = (id: string) => ({ id, title: `T${id}`, status: 'PENDING', priority: 'LOW' });
const meta = (page: number, total = 45) => ({ page, limit: 20, total, totalPages: Math.ceil(total / 20) });

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}
const patientCalls = () => http.get.mock.calls.filter(([url]) => url === '/tenants/tenant-1/patients');
const taskCalls = () => http.get.mock.calls.filter(([url]) => url === '/tenants/tenant-1/tasks');

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  useAuthStore.setState({ tenant: { id: 'tenant-1' } as ReturnType<typeof useAuthStore.getState>['tenant'], user: null });
  http.get.mockResolvedValue([]);
});

afterEach(() => vi.restoreAllMocks());

describe('extractPage', () => {
  it('reads the rows and meta of a page', () => {
    expect(extractPage({ data: [patient('1')], meta: meta(2) } as never, { page: 2, limit: 20 })).toEqual({
      items: [patient('1')],
      meta: meta(2),
    });
  });

  it('never reports zero pages', () => {
    const result = extractPage({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } }, { page: 1, limit: 20 });
    expect(result.meta.totalPages).toBe(1);
  });

  it('cuts the requested page out of a whole list from a server that does not page yet', () => {
    const all = Array.from({ length: 45 }, (_, i) => patient(String(i)));
    const result = extractPage(all as never, { page: 3, limit: 20 });
    expect(result.items.map((p) => (p as { id: string }).id)).toEqual(['40', '41', '42', '43', '44']);
    expect(result.meta).toEqual({ page: 3, limit: 20, total: 45, totalPages: 3 });
  });
});

describe('extractPage: an API that does not page yet', () => {
  it('warns once per session, however many lists it cuts', async () => {
    vi.resetModules();
    const { extractPage: fresh } = await import('@/lib/api/endpoints');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const all = [patient('1'), patient('2'), patient('3')];

    fresh(all as never, { page: 1, limit: 2 });
    fresh(all as never, { page: 2, limit: 2 });
    fresh(all as never, { page: 1, limit: 2 });

    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toMatch(/Deploy the API before the web/);
  });

  it('does not warn for a real page', async () => {
    vi.resetModules();
    const { extractPage: fresh } = await import('@/lib/api/endpoints');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    fresh({ data: [patient('1')], meta: meta(1) } as never, { page: 1, limit: 20 });
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('usePatientsPage', () => {
  it('asks the server for the page, search and status, and reads rows and meta', async () => {
    http.get.mockResolvedValue({ data: [patient('1')], meta: meta(2) });
    const { wrapper } = setup();
    const { result } = renderHook(
      () => usePatientsPage({ search: '  ana ', status: 'active', page: 2 }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(http.get).toHaveBeenCalledWith('/tenants/tenant-1/patients', {
      params: { search: 'ana', status: 'active', page: 2, limit: 20 },
    });
    expect(result.current.data).toEqual({ items: [patient('1')], meta: meta(2) });
  });

  it('leaves an empty search out of the request', async () => {
    http.get.mockResolvedValue({ data: [], meta: meta(1, 0) });
    const { wrapper } = setup();
    renderHook(() => usePatientsPage({ search: '   ', page: 1 }), { wrapper });
    await waitFor(() => expect(http.get).toHaveBeenCalled());
    expect(http.get.mock.calls[0][1].params.search).toBeUndefined();
  });

  it('asks for the next page when the page changes, keeping the previous rows meanwhile', async () => {
    let release: (value: unknown) => void = () => undefined;
    http.get.mockResolvedValueOnce({ data: [patient('1')], meta: meta(1) });
    const { wrapper } = setup();
    const { result, rerender } = renderHook(({ page }) => usePatientsPage({ page }), {
      wrapper,
      initialProps: { page: 1 },
    });
    await waitFor(() => expect(result.current.data?.items).toEqual([patient('1')]));

    http.get.mockReturnValueOnce(new Promise((resolve) => (release = resolve)));
    rerender({ page: 2 });
    await waitFor(() => expect(patientCalls()).toHaveLength(2));
    expect(patientCalls()[1][1].params.page).toBe(2);
    // No flash: the first page stays on screen, flagged as a stand-in, while page 2 loads.
    expect(result.current.isPlaceholderData).toBe(true);
    expect(result.current.data?.items).toEqual([patient('1')]);
    expect(result.current.isLoading).toBe(false);

    await act(async () => release({ data: [patient('21')], meta: meta(2) }));
    await waitFor(() => expect(result.current.data?.items).toEqual([patient('21')]));
    expect(result.current.isPlaceholderData).toBe(false);
  });

  it('keeps the page entry apart from the whole-list entry of the same filters', async () => {
    http.get.mockImplementation(async (_url: string, config?: { params?: { page?: number } }) =>
      config?.params?.page ? { data: [patient('1')], meta: meta(1) } : [patient('1'), patient('2'), patient('3')],
    );
    const { wrapper } = setup();
    const page = renderHook(() => usePatientsPage({ search: 'a', page: 1 }), { wrapper });
    const whole = renderHook(() => usePatients({ search: 'a' }), { wrapper });
    await waitFor(() => expect(page.result.current.data).toBeDefined());
    await waitFor(() => expect(whole.result.current.data).toBeDefined());

    expect(patientCalls()).toHaveLength(2);
    expect(page.result.current.data).toEqual({ items: [patient('1')], meta: meta(1) });
    expect(whole.result.current.data).toHaveLength(3);
  });

  it('keeps usePatients as the whole list, with no page or limit in the request', async () => {
    http.get.mockResolvedValue([patient('1')]);
    const { wrapper } = setup();
    renderHook(() => usePatients(), { wrapper });
    await waitFor(() => expect(http.get).toHaveBeenCalled());
    expect(http.get).toHaveBeenCalledWith('/tenants/tenant-1/patients', { params: undefined });
  });

  it('is refreshed when a patient is created', async () => {
    // useCreatePatient also reads the clinic's specialties (to word the toast): answer them apart.
    http.get.mockImplementation(async (url: string) =>
      url.endsWith('/patients') ? { data: [patient('1')], meta: meta(1) } : [],
    );
    http.post.mockResolvedValue(patient('9'));
    const { wrapper } = setup();
    const list = renderHook(() => usePatientsPage({ page: 1 }), { wrapper });
    const create = renderHook(() => useCreatePatient(), { wrapper });
    await waitFor(() => expect(list.result.current.data).toBeDefined());
    expect(patientCalls()).toHaveLength(1);

    await act(async () => {
      await create.result.current.mutateAsync({ firstName: 'Ana', lastName: 'Paz' });
    });
    await waitFor(() => expect(patientCalls()).toHaveLength(2));
  });
});

describe('usePatientsPage without a tenant', () => {
  it('does not query', () => {
    useAuthStore.setState({ tenant: null, user: null });
    const { wrapper } = setup();
    const { result } = renderHook(() => usePatientsPage({ page: 1 }), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
    expect(http.get).not.toHaveBeenCalled();
  });
});

describe('task page keys carry the tenant', () => {
  it('puts the tenant in the key of every page and summary', async () => {
    http.get.mockImplementation(async (url: string) =>
      url.endsWith('/summary') ? { pending: 1, overdue: 0, completed: 0, cancelled: 0 } : { data: [task('1')], meta: meta(1) },
    );
    const { client, wrapper } = setup();
    renderHook(() => useTasksPage({ page: 1 }), { wrapper });
    renderHook(() => useTaskSummary({}), { wrapper });
    await waitFor(() => expect(http.get).toHaveBeenCalledTimes(2));

    const keys = client.getQueryCache().getAll().map((q) => q.queryKey);
    expect(keys).toContainEqual(['tasks', 'tenant', 'tenant-1', 'page', { page: 1, limit: 20 }]);
    expect(keys).toContainEqual(['tasks', 'tenant', 'tenant-1', 'summary', {}]);
    // Everything still starts with 'tasks', which is what the task mutations invalidate.
    expect(keys.every((key) => key[0] === 'tasks')).toBe(true);
  });

  it('asks again when the tenant changes, not reusing the page of the previous one', async () => {
    http.get.mockResolvedValue({ data: [task('1')], meta: meta(1) });
    const { wrapper } = setup();
    renderHook(() => useTasksPage({ page: 1 }), { wrapper });
    await waitFor(() => expect(taskCalls()).toHaveLength(1));

    act(() => useAuthStore.setState({ tenant: { id: 'tenant-2' } as never, user: null }));
    await waitFor(() => expect(http.get).toHaveBeenCalledTimes(2));
  });

  it('requests the page and the summary of the tenant in the key, not whichever the store holds when the request goes out', async () => {
    http.get.mockResolvedValue({ data: [task('1')], meta: meta(1) });
    // The hooks subscribe to the store; only a direct `getState()` read (what the endpoint would do
    // to resolve the tenant by itself) sees this other tenant.
    vi.spyOn(useAuthStore, 'getState').mockReturnValue({
      tenant: { id: 'tenant-other' },
      user: null,
    } as never);
    const { wrapper } = setup();
    renderHook(() => useTasksPage({ page: 1 }), { wrapper });
    renderHook(() => useTaskSummary({}), { wrapper });
    await waitFor(() => expect(http.get).toHaveBeenCalledTimes(2));

    const urls = http.get.mock.calls.map(([url]) => url);
    expect(urls).toContain('/tenants/tenant-1/tasks');
    expect(urls).toContain('/tenants/tenant-1/tasks/summary');
    expect(urls.some((url) => String(url).includes('tenant-other'))).toBe(false);
  });

  it('does not query without a tenant', () => {
    useAuthStore.setState({ tenant: null, user: null });
    const { wrapper } = setup();
    const page = renderHook(() => useTasksPage({ page: 1 }), { wrapper });
    const summary = renderHook(() => useTaskSummary({}), { wrapper });
    expect(page.result.current.fetchStatus).toBe('idle');
    expect(summary.result.current.fetchStatus).toBe('idle');
    expect(http.get).not.toHaveBeenCalled();
  });
});

describe('useTasksPage', () => {
  it('asks the server for the page and filters, and reads rows and meta', async () => {
    http.get.mockResolvedValue({ data: [task('1')], meta: meta(3, 50) });
    const { wrapper } = setup();
    const { result } = renderHook(
      () => useTasksPage({ search: 'informe', status: 'PENDING', priority: 'HIGH', page: 3 }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(http.get).toHaveBeenCalledWith('/tenants/tenant-1/tasks', {
      params: { search: 'informe', status: 'PENDING', priority: 'HIGH', page: 3, limit: 20 },
    });
    expect(result.current.data).toEqual({ items: [task('1')], meta: meta(3, 50) });
  });

  it('asks for the next page when the page changes, keeping the previous rows meanwhile', async () => {
    http.get.mockResolvedValueOnce({ data: [task('1')], meta: meta(1) });
    const { wrapper } = setup();
    const { result, rerender } = renderHook(({ page }) => useTasksPage({ page }), {
      wrapper,
      initialProps: { page: 1 },
    });
    await waitFor(() => expect(result.current.data?.items).toEqual([task('1')]));

    http.get.mockReturnValueOnce(new Promise(() => undefined));
    rerender({ page: 2 });
    await waitFor(() => expect(taskCalls()).toHaveLength(2));
    expect(taskCalls()[1][1].params.page).toBe(2);
    expect(result.current.isPlaceholderData).toBe(true);
    expect(result.current.data?.items).toEqual([task('1')]);
  });

  it('keeps useTasks as the whole list, with no page or limit in the request', async () => {
    http.get.mockResolvedValue([task('1')]);
    const { wrapper } = setup();
    renderHook(() => useTasks({ patientId: 'p-1' }), { wrapper });
    await waitFor(() => expect(http.get).toHaveBeenCalled());
    expect(http.get).toHaveBeenCalledWith('/tenants/tenant-1/tasks', { params: { patientId: 'p-1' } });
  });

  it('reads the summary with the same search and priority', async () => {
    http.get.mockResolvedValue({ pending: 3, overdue: 1, completed: 2, cancelled: 0 });
    const { wrapper } = setup();
    const { result } = renderHook(() => useTaskSummary({ search: ' x ', priority: 'LOW' }), { wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(http.get).toHaveBeenCalledWith('/tenants/tenant-1/tasks/summary', {
      params: { search: 'x', priority: 'LOW' },
    });
    expect(result.current.data?.overdue).toBe(1);
  });

  it('refreshes the page and the summary when a task is created', async () => {
    http.get.mockImplementation(async (url: string) =>
      url.endsWith('/summary')
        ? { pending: 1, overdue: 0, completed: 0, cancelled: 0 }
        : { data: [task('1')], meta: meta(1) },
    );
    http.post.mockResolvedValue(task('2'));
    const { wrapper } = setup();
    const page = renderHook(() => useTasksPage({ page: 1 }), { wrapper });
    const summary = renderHook(() => useTaskSummary({}), { wrapper });
    const create = renderHook(() => useCreateTask(), { wrapper });
    await waitFor(() => expect(page.result.current.data).toBeDefined());
    await waitFor(() => expect(summary.result.current.data).toBeDefined());
    expect(http.get).toHaveBeenCalledTimes(2);

    await act(async () => {
      await create.result.current.mutateAsync({ title: 'Nueva' });
    });
    await waitFor(() => expect(http.get).toHaveBeenCalledTimes(4));
  });
});
