import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BillingPage from '@/app/(dashboard)/admin/billing/page';
import { useAuthStore } from '@/store/authStore';
import { UserRole, type Invoice, type User } from '@/types';

const api = vi.hoisted(() => ({ listInvoices: vi.fn() }));
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

  it('is read-only: shows the emite-facil note and no Faktur configuration or emission form', async () => {
    renderPage();
    expect(await screen.findByText('Aún no hay comprobantes emitidos.')).toBeInTheDocument();
    expect(screen.getByText('La facturación electrónica se conectará con emite-facil próximamente.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Configurar Faktur' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Emitir factura' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Paciente')).not.toBeInTheDocument();
    expect(screen.queryByText(/Faktur/)).not.toBeInTheDocument();
  });
});
