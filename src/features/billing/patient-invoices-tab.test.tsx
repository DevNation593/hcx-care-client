import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Invoice } from '@/types';
import { PatientInvoicesTab } from './patient-invoices-tab';

const api = vi.hoisted(() => ({ listInvoices: vi.fn() }));
vi.mock('@/lib/api/endpoints', () => ({ billingApi: { listInvoices: api.listInvoices } }));

const invoice = (overrides: Partial<Invoice>): Invoice => ({
  id: 'invoice-1', status: 'ISSUED', issueDate: '2026-10-01T15:00:00.000Z',
  customerName: 'Rosa Mora', customerEmail: 'rosa@payer.test', customerTaxIdType: 'CEDULA',
  customerTaxId: '0912345678', description: 'Consulta', subtotal: 100, tax: 15, total: 115,
  ...overrides,
});

function renderTab() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><PatientInvoicesTab patientId="patient-2" /></QueryClientProvider>);
}

beforeEach(() => vi.clearAllMocks());

describe('PatientInvoicesTab', () => {
  it('requests only this patient invoices and lists them with their payer and documents', async () => {
    api.listInvoices.mockResolvedValue([
      invoice({ pdfUrl: 'https://files.example.com/a.pdf' }),
      invoice({ id: 'b', status: 'FAILED', description: 'Paquete', total: 230, errorMessage: 'Servicio no disponible' }),
    ]);
    renderTab();

    expect(await screen.findByText('Consulta')).toBeInTheDocument();
    expect(api.listInvoices).toHaveBeenCalledWith({ patientId: 'patient-2' });
    expect(screen.getAllByText('Rosa Mora')).toHaveLength(2);
    expect(screen.getByText('$115.00')).toBeInTheDocument();
    expect(screen.getByText('$230.00')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'PDF' })).toHaveAttribute('href', 'https://files.example.com/a.pdf');
    expect(screen.getByText('Servicio no disponible')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Cobrar en caja' })).toHaveAttribute('href', '/cash');
    expect(screen.queryByRole('button', { name: /Facturar|Emitir/ })).not.toBeInTheDocument();
  });

  it('says so when the patient has no invoices and links to billing', async () => {
    api.listInvoices.mockResolvedValue([]);
    renderTab();
    expect(await screen.findByText('Este paciente aún no tiene facturas.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ir a Facturación' })).toHaveAttribute('href', '/admin/billing');
  });

  it('offers a retry when loading fails', async () => {
    api.listInvoices.mockRejectedValueOnce(new Error('sin conexión'));
    renderTab();
    fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(api.listInvoices).toHaveBeenCalledTimes(2));
  });
});
