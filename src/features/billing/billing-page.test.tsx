import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BillingPage from '@/app/(dashboard)/admin/billing/page';
import { useAuthStore } from '@/store/authStore';
import { UserRole, type Invoice, type User } from '@/types';

const api = vi.hoisted(() => ({ listInvoices: vi.fn(), connection: vi.fn(), list: vi.fn(), view: true }));
vi.mock('@/lib/api/invoicing-api', () => ({ invoicingApi: { connection: api.connection, list: api.list } }));
vi.mock('@/hooks/usePermissions', () => ({ useMyPermissions: () => ({ can: () => api.view }) }));
vi.mock('@/hooks/useBranches', () => ({ useBranches: () => ({ data: [] }) }));
vi.mock('@/lib/api/endpoints', () => ({
  billingApi: { listInvoices: api.listInvoices },
}));
vi.mock('@/hooks/useSpecialties', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/useSpecialties')>()),
  useTenantModules: () => ({
    data: [
      'core.calendar', 'core.patients', 'core.tasks', 'core.clinicalNotes',
      'core.specialties', 'core.billing', 'core.team', 'core.storage',
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

function renderPage(role: UserRole = UserRole.MASTER) {
  useAuthStore.setState({ user: { id: 'user-1', role, tenantId: 'tenant-1' } as User });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><BillingPage /></QueryClientProvider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  api.listInvoices.mockResolvedValue([]);
  api.connection.mockResolvedValue(null);
  api.list.mockResolvedValue({ items: [], total: 0 });
  api.view = true;
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

  it('keeps history read-only and enables B2 configuration without Faktur controls', async () => {
    renderPage();
    expect(await screen.findByText('Aún no hay comprobantes emitidos.')).toBeInTheDocument();
    expect(await screen.findByLabelText('API key')).toHaveValue('');
    expect(screen.queryByText(/próximamente/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Configurar Faktur' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Emitir factura' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Paciente')).not.toBeInTheDocument();
    expect(screen.queryByText(/Faktur/)).not.toBeInTheDocument();
  });
});

it('does not mount MASTER settings for an assistant with billing access', async () => {
  renderPage(UserRole.ASISTENTE);
  await screen.findByText('Aún no hay comprobantes emitidos.');
  expect(api.connection).not.toHaveBeenCalled();
  expect(screen.queryByLabelText('API key')).not.toBeInTheDocument();
});
it('does not load invoice history without billing.view', () => {
  api.view = false;
  renderPage(UserRole.ASISTENTE);
  expect(api.listInvoices).not.toHaveBeenCalled();
  expect(api.list).not.toHaveBeenCalled();
});
