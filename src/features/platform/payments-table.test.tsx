import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { platformApi } from '@/lib/api/endpoints';
import type { PlatformPayment } from '@/types';
import { PaymentsTable } from './payments-table';

vi.mock('@/lib/api/endpoints', () => ({
  platformApi: { listPayments: vi.fn(), confirmPayment: vi.fn(), rejectPayment: vi.fn() },
}));

const payment = (overrides: Partial<PlatformPayment> = {}): PlatformPayment => ({
  id: 'p-1',
  kind: 'PLAN_UPGRADE',
  status: 'PENDING',
  amount: '49.90',
  currency: 'USD',
  planId: 'plan_clinic_pro',
  planName: 'Clínica Pro',
  periodStart: null,
  periodEnd: null,
  expiresAt: null,
  createdAt: '2026-09-15T12:00:00.000Z',
  tenant: { id: 't-1', name: 'Clínica Sol', email: 'sol@clinica.com' },
  ...overrides,
});

function renderTable() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PaymentsTable />
    </QueryClientProvider>,
  );
}

const lastStatus = () => {
  const calls = vi.mocked(platformApi.listPayments).mock.calls;
  return calls[calls.length - 1][0];
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PaymentsTable', () => {
  it('lists pending payments by default with clinic, kind, plan, amount and date', async () => {
    vi.mocked(platformApi.listPayments).mockResolvedValue([
      payment(),
      payment({
        id: 'p-2',
        kind: 'RENEWAL',
        planId: 'plan_personal_basic',
        planName: 'Personal Básico',
        amount: 15,
        tenant: { id: 't-2', name: 'Centro Luna', email: 'luna@c.com' },
      }),
    ]);
    renderTable();

    expect(await screen.findByText('Clínica Sol')).toBeInTheDocument();
    expect(lastStatus()).toBe('PENDING');
    expect(screen.getByLabelText('Estado')).toHaveValue('PENDING');
    const first = screen.getByText('Clínica Sol').closest('tr') as HTMLElement;
    expect(first).toHaveTextContent('Mejora de plan');
    expect(first).toHaveTextContent('Clínica Pro');
    expect(first).toHaveTextContent('Pendiente');
    expect(first).toHaveTextContent('49.90');
    expect(first).toHaveTextContent('USD');
    expect(first).toHaveTextContent('2026');
    const second = screen.getByText('Centro Luna').closest('tr') as HTMLElement;
    expect(second).toHaveTextContent('Renovación');
    expect(second).toHaveTextContent('Personal Básico');
  });

  it('requests another status when the filter changes', async () => {
    vi.mocked(platformApi.listPayments).mockResolvedValue([payment()]);
    renderTable();
    await screen.findByText('Clínica Sol');

    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'CONFIRMED' } });
    await waitFor(() => expect(lastStatus()).toBe('CONFIRMED'));

    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: '' } });
    await waitFor(() => expect(lastStatus()).toBeUndefined());
  });

  it('requires a reference to confirm and sends it', async () => {
    vi.mocked(platformApi.listPayments).mockResolvedValue([payment()]);
    vi.mocked(platformApi.confirmPayment).mockResolvedValue(undefined);
    renderTable();
    await screen.findByText('Clínica Sol');

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar pago' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmar pago' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Indica la referencia del pago');
    expect(platformApi.confirmPayment).not.toHaveBeenCalled();

    fireEvent.change(within(dialog).getByLabelText('Referencia'), { target: { value: '  TRF-123  ' } });
    fireEvent.change(within(dialog).getByLabelText('Nota (opcional)'), { target: { value: 'Verificado' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmar pago' }));

    await waitFor(() =>
      expect(platformApi.confirmPayment).toHaveBeenCalledWith('p-1', { reference: 'TRF-123', note: 'Verificado' }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('requires a reason to reject and sends it', async () => {
    vi.mocked(platformApi.listPayments).mockResolvedValue([payment()]);
    vi.mocked(platformApi.rejectPayment).mockResolvedValue(undefined);
    renderTable();
    await screen.findByText('Clínica Sol');

    fireEvent.click(screen.getByRole('button', { name: 'Rechazar' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Rechazar pago' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Indica el motivo del rechazo');
    expect(platformApi.rejectPayment).not.toHaveBeenCalled();

    fireEvent.change(within(dialog).getByLabelText('Motivo del rechazo'), {
      target: { value: ' No llegó la transferencia ' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Rechazar pago' }));

    await waitFor(() => expect(platformApi.rejectPayment).toHaveBeenCalledWith('p-1', 'No llegó la transferencia'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('offers no actions on a payment that is not pending', async () => {
    vi.mocked(platformApi.listPayments).mockResolvedValue([payment({ status: 'CONFIRMED' })]);
    renderTable();

    const row = (await screen.findByText('Clínica Sol')).closest('tr') as HTMLElement;
    expect(row).toHaveTextContent('Confirmado');
    expect(screen.queryByRole('button', { name: 'Confirmar pago' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rechazar' })).not.toBeInTheDocument();
  });

  it('links the clinic name to its detail', async () => {
    vi.mocked(platformApi.listPayments).mockResolvedValue([payment()]);
    renderTable();

    expect(await screen.findByRole('link', { name: 'Clínica Sol' })).toHaveAttribute('href', '/platform/tenants/t-1');
  });

  it('shows the API message when the reference already confirmed another payment', async () => {
    vi.mocked(platformApi.listPayments).mockResolvedValue([payment()]);
    vi.mocked(platformApi.confirmPayment).mockRejectedValue({ message: 'La referencia ya confirmó otro pago' });
    renderTable();
    await screen.findByText('Clínica Sol');

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar pago' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Referencia'), { target: { value: 'TRF-1' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmar pago' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('La referencia ya confirmó otro pago');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('shows an empty state when there are no payments', async () => {
    vi.mocked(platformApi.listPayments).mockResolvedValue([]);
    renderTable();

    expect(await screen.findByText('No hay pagos con este estado')).toBeInTheDocument();
  });

  it('pages a long list twenty payments at a time', async () => {
    vi.mocked(platformApi.listPayments).mockResolvedValue(
      Array.from({ length: 25 }, (_, index) =>
        payment({ id: `p-${index + 1}`, tenant: { id: `t-${index + 1}`, name: `Clínica ${index + 1}`, email: 'c@c.com' } }),
      ),
    );
    renderTable();

    expect(await screen.findByText('Clínica 1')).toBeInTheDocument();
    expect(screen.getByText('Clínica 20')).toBeInTheDocument();
    expect(screen.queryByText('Clínica 21')).not.toBeInTheDocument();
    expect(screen.getByText('Página 1 de 2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(screen.getByText('Clínica 21')).toBeInTheDocument();
    expect(screen.getByText('Clínica 25')).toBeInTheDocument();
    expect(screen.queryByText('Clínica 1')).not.toBeInTheDocument();
    expect(screen.getByText('21–25 de 25')).toBeInTheDocument();
  });
});
