import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { platformApi } from '@/lib/api/endpoints';
import { TenantType, type PlatformTenantRow } from '@/types';
import { TenantsTable } from './tenants-table';

vi.mock('@/lib/api/endpoints', () => ({
  platformApi: {
    listTenants: vi.fn(),
    listPlans: vi.fn(async () => [
      { id: 'plan_clinic_pro', code: 'CLINIC_PRO', name: 'Clínica Pro', tenantType: 'CLINIC' },
      { id: 'plan_personal_basic', code: 'PERSONAL_BASIC', name: 'Personal Básico', tenantType: 'PERSONAL' },
    ]),
  },
}));

const row = (overrides: Partial<PlatformTenantRow> = {}): PlatformTenantRow => ({
  id: 't-1',
  name: 'Clínica Sol',
  tenantType: TenantType.CLINIC,
  isActive: true,
  createdAt: '2026-09-01T00:00:00.000Z',
  master: { firstName: 'Rosa', lastName: 'Paz', email: 'rosa@sol.com' },
  plan: { id: 'plan_clinic_pro', code: 'CLINIC_PRO', name: 'Clínica Pro' },
  status: 'ACTIVE',
  seatsPsychologistsUsed: 2,
  seatsPsychologistsMax: 5,
  activePatientsCount: 12,
  maxActivePatients: 100,
  ...overrides,
});

const page = (items: PlatformTenantRow[], total = items.length, pageNumber = 1) => ({
  items,
  total,
  page: pageNumber,
  pageSize: 20,
});

function renderTable() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <TenantsTable />
    </QueryClientProvider>,
  );
}

const lastParams = () => {
  const calls = vi.mocked(platformApi.listTenants).mock.calls;
  return calls[calls.length - 1][0];
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('TenantsTable', () => {
  it('renders one row per clinic with master, plan, status and usage', async () => {
    vi.mocked(platformApi.listTenants).mockResolvedValue(
      page([
        row(),
        row({ id: 't-2', name: 'Centro Luna', status: 'PAST_DUE', plan: { id: 'plan_personal_basic', code: 'PERSONAL_BASIC', name: 'Personal Básico' } }),
      ]),
    );
    renderTable();

    expect(await screen.findByText('Clínica Sol')).toBeInTheDocument();
    expect(screen.getByText('Centro Luna')).toBeInTheDocument();
    // header row + 2 body rows
    expect(screen.getAllByRole('row')).toHaveLength(3);
    const first = screen.getByText('Clínica Sol').closest('tr') as HTMLElement;
    expect(first).toHaveTextContent('Rosa Paz');
    expect(first).toHaveTextContent('rosa@sol.com');
    expect(first).toHaveTextContent('Clínica Pro');
    expect(first).toHaveTextContent('Al día');
    expect(first).toHaveTextContent('2 / 5');
    expect(first).toHaveTextContent('12 / 100');
    expect(screen.getByText('Centro Luna').closest('tr')).toHaveTextContent('Vencido');
  });

  it('labels an inactive clinic as Suspendido', async () => {
    vi.mocked(platformApi.listTenants).mockResolvedValue(
      page([row({ isActive: false, status: 'ACTIVE' })]),
    );
    renderTable();
    const tr = (await screen.findByText('Clínica Sol')).closest('tr') as HTMLElement;
    expect(tr).toHaveTextContent('Suspendido');
    expect(tr).not.toHaveTextContent('Al día');
  });

  it('sends search, plan and status filters to the query and resets to page 1', async () => {
    vi.mocked(platformApi.listTenants).mockResolvedValue(page([row()], 45, 1));
    renderTable();
    await screen.findByText('Clínica Sol');
    expect(lastParams()).toMatchObject({ page: 1 });

    // go to page 2 first, so a filter change has something to reset
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    await waitFor(() => expect(lastParams()).toMatchObject({ page: 2 }));

    fireEvent.change(screen.getByLabelText('Buscar consultorio'), { target: { value: 'sol' } });
    await waitFor(() => expect(lastParams()).toMatchObject({ search: 'sol', page: 1 }));

    await screen.findByRole('option', { name: 'Clínica Pro' });
    fireEvent.change(screen.getByLabelText('Plan'), { target: { value: 'plan_clinic_pro' } });
    await waitFor(() =>
      expect(lastParams()).toMatchObject({ search: 'sol', planId: 'plan_clinic_pro', page: 1 }),
    );

    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'PAST_DUE' } });
    await waitFor(() =>
      expect(lastParams()).toMatchObject({
        search: 'sol',
        planId: 'plan_clinic_pro',
        status: 'PAST_DUE',
        page: 1,
      }),
    );
  });

  it('waits 300 ms before applying the search', async () => {
    vi.mocked(platformApi.listTenants).mockResolvedValue(page([row()]));
    renderTable();
    await screen.findByText('Clínica Sol');
    const callsBefore = vi.mocked(platformApi.listTenants).mock.calls.length;

    vi.useFakeTimers();
    try {
      fireEvent.change(screen.getByLabelText('Buscar consultorio'), { target: { value: 'so' } });
      vi.advanceTimersByTime(299);
      expect(vi.mocked(platformApi.listTenants).mock.calls.length).toBe(callsBefore);
      act(() => {
        vi.advanceTimersByTime(2);
      });
    } finally {
      vi.useRealTimers();
    }
    await waitFor(() => expect(lastParams()).toMatchObject({ search: 'so' }));
  });

  it('sends isActive=false when filtering by Suspendido', async () => {
    vi.mocked(platformApi.listTenants).mockResolvedValue(page([row()]));
    renderTable();
    await screen.findByText('Clínica Sol');
    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'SUSPENDED' } });
    await waitFor(() => expect(lastParams()).toMatchObject({ isActive: false, page: 1 }));
    expect(lastParams()?.status).toBeUndefined();
  });

  it('links each row to its detail and offers Nuevo consultorio', async () => {
    vi.mocked(platformApi.listTenants).mockResolvedValue(page([row()]));
    renderTable();
    const link = await screen.findByRole('link', { name: 'Clínica Sol' });
    expect(link).toHaveAttribute('href', '/platform/tenants/t-1');
    expect(screen.getByRole('link', { name: /Nuevo consultorio/ })).toHaveAttribute(
      'href',
      '/platform/tenants/new',
    );
  });
});
