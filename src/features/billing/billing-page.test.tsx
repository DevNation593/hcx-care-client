import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BillingPage from '@/app/(dashboard)/admin/billing/page';
import { useAuthStore } from '@/store/authStore';
import { UserRole, type Invoice, type User } from '@/types';

const api = vi.hoisted(() => ({ listInvoices: vi.fn(), issuer: vi.fn(), list: vi.fn(), view: true, branches: [] as unknown[] }));
vi.mock('@/lib/api/invoicing-api', () => ({ invoicingApi: { issuer: api.issuer, list: api.list } }));
vi.mock('@/hooks/usePermissions', () => ({ useMyPermissions: () => ({ can: () => api.view }) }));
vi.mock('@/hooks/useBranches', () => ({ useBranches: () => ({ data: api.branches }) }));
vi.mock('@/lib/api/endpoints', () => ({
  billingApi: { listInvoices: api.listInvoices },
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

function invoice(overrides: Partial<Invoice>): Invoice {
  return {
    id: 'invoice-1', status: 'ISSUED', issueDate: '2026-10-01T15:00:00.000Z',
    customerName: 'Rosa Mora', customerEmail: 'rosa@payer.test', customerTaxIdType: 'CEDULA',
    customerTaxId: '0912345678', description: 'Consulta', subtotal: 100, tax: 15, total: 115,
    patient: { id: 'patient-2', firstName: 'Niño', lastName: 'Mora' },
    ...overrides,
  };
}

const request = (overrides = {}) => ({
  id: 'req-1',
  orderId: 'order-1',
  orderNumber: 12,
  status: 'AUTHORIZED',
  sequential: 1,
  emailedAt: null,
  artifacts: { xml: true, ride: true },
  lastError: null,
  number: '001-001-000000001',
  requestedAt: '2026-10-17T12:00:00Z',
  ...overrides,
});

function renderPage(role: UserRole = UserRole.MASTER) {
  useAuthStore.setState({ user: { id: 'user-1', role, tenantId: 'tenant-1' } as User });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><BillingPage /></QueryClientProvider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  api.listInvoices.mockResolvedValue([]);
  api.issuer.mockResolvedValue(null);
  api.list.mockResolvedValue({ items: [], total: 0 });
  api.view = true;
  api.branches = [];
});

describe('BillingPage history', () => {
  it('shows the patient and the payer of each invoice', async () => {
    api.listInvoices.mockResolvedValue([invoice({})]);
    renderPage();
    const row = (await screen.findByText('Rosa Mora')).closest('tr')!;
    expect(within(row).getByText('Niño Mora')).toBeInTheDocument();
    expect(within(row).getByText('CEDULA 0912345678')).toBeInTheDocument();
  });

  it('shows a dash for invoices issued before patients were linked', async () => {
    api.listInvoices.mockResolvedValue([invoice({ patient: null, customerName: 'Consultorio Demo' })]);
    renderPage();
    const row = (await screen.findByText('Consultorio Demo')).closest('tr')!;
    expect(within(row).getAllByRole('cell')[1]).toHaveTextContent('—');
  });

  it('keeps the failure reason and the document links', async () => {
    api.listInvoices.mockResolvedValue([
      invoice({ status: 'FAILED', errorMessage: 'El proveedor rechazó el comprobante' }),
      invoice({ id: 'b', pdfUrl: 'https://files.example.com/a.pdf', xmlUrl: 'javascript:alert(1)' }),
    ]);
    renderPage();
    expect(await screen.findByText('El proveedor rechazó el comprobante')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'PDF' })).toHaveAttribute('href', 'https://files.example.com/a.pdf');
    expect(screen.queryByRole('link', { name: 'XML' })).not.toBeInTheDocument();
  });

  it('shows no former-provider card while the clinic has none of those receipts', async () => {
    renderPage();
    expect(await screen.findByText('No hay facturas para estos filtros.')).toBeInTheDocument();
    await waitFor(() => expect(api.listInvoices).toHaveBeenCalled());
    expect(screen.queryByText('Comprobantes anteriores')).not.toBeInTheDocument();
  });
});

describe('BillingPage issued invoices', () => {
  it('lists the invoices requested to the SRI across every branch', async () => {
    api.list.mockResolvedValue({ items: [request()], total: 1, page: 1, pageSize: 20 });
    renderPage();
    expect(await screen.findByText('Orden #12')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Facturas emitidas/ })).toBeInTheDocument();
    expect(api.list).toHaveBeenCalledWith('tenant-1', expect.not.objectContaining({ branchId: expect.anything() }));
  });

  it('filters by branch when the clinic has more than one', async () => {
    api.branches = [
      { id: 'main', name: 'Sede principal', isActive: true },
      { id: 'north', name: 'Sede Norte', isActive: false },
    ];
    renderPage();
    fireEvent.change(await screen.findByLabelText('Sucursal'), { target: { value: 'north' } });
    await waitFor(() =>
      expect(api.list).toHaveBeenLastCalledWith('tenant-1', expect.objectContaining({ branchId: 'north' })),
    );
  });

  it('holds no billing settings: they live in their own submodule', async () => {
    renderPage();
    await screen.findByText('No hay facturas para estos filtros.');
    expect(api.issuer).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('RUC')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('API key')).not.toBeInTheDocument();
    expect(screen.queryByText(/Faktur/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Emitir factura' })).not.toBeInTheDocument();
  });
});

it('shows the invoices to an assistant with billing access', async () => {
  api.list.mockResolvedValue({ items: [request()], total: 1, page: 1, pageSize: 20 });
  renderPage(UserRole.ASISTENTE);
  expect(await screen.findByText('Orden #12')).toBeInTheDocument();
});
it('does not load invoice history without billing.view', () => {
  api.view = false;
  renderPage(UserRole.ASISTENTE);
  expect(screen.getByText('No tienes permiso para consultar facturas.')).toBeInTheDocument();
  expect(api.listInvoices).not.toHaveBeenCalled();
  expect(api.list).not.toHaveBeenCalled();
});
