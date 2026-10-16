import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Order } from '@/types/cash';
import { OrderDetail } from './order-detail';

const hooks = vi.hoisted(() => ({
  can: vi.fn(),
  order: { data: undefined as unknown, isPending: false, isError: false },
  eligibility: { data: undefined as unknown },
  recordPayment: vi.fn(),
  refundPayment: vi.fn(),
  addItem: vi.fn(),
  removeItem: vi.fn(),
  updateItem: vi.fn(),
  setProfile: vi.fn(),
  billable: { data: [] as unknown[] },
}));

vi.mock('@/hooks/usePermissions', () => ({ useMyPermissions: () => ({ can: hooks.can }) }));
vi.mock('@/hooks/useOrders', () => ({
  useOrder: () => hooks.order,
  useOrderEligibility: () => hooks.eligibility,
  useBillableSessions: () => hooks.billable,
  useAddOrderItem: () => ({ mutateAsync: hooks.addItem, isPending: false }),
  useRemoveOrderItem: () => ({ mutateAsync: hooks.removeItem, isPending: false }),
  useUpdateOrderItem: () => ({ mutateAsync: hooks.updateItem, isPending: false }),
  useSetOrderBillingProfile: () => ({ mutateAsync: hooks.setProfile, isPending: false }),
  useRecordPayment: () => ({ mutateAsync: hooks.recordPayment, isPending: false }),
  useRefundPayment: () => ({ mutateAsync: hooks.refundPayment, isPending: false }),
}));
vi.mock('@/hooks/useBillingProfiles', () => ({
  useBillingProfiles: () => ({ data: { items: [] }, isPending: false }),
  usePatientBillingProfiles: () => ({ data: [], isPending: false }),
  useCreateBillingProfile: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useLinkBillingProfile: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

const person = { id: 'p-1', firstName: 'Ana', lastName: 'Paz' };

const payment = {
  id: 'pay-1',
  method: 'CASH',
  amount: '10.00',
  reference: null,
  status: 'RECORDED',
  receivedAt: '2026-10-15T15:00:00.000Z',
  receivedBy: { id: 'u-1', firstName: 'Sofía', lastName: 'Ruiz' },
  refundedAt: null,
  refundReason: null,
};

const makeOrder = (overrides: Partial<Order> = {}): Order =>
  ({
    id: 'o-1',
    number: 7,
    status: 'OPEN',
    branchId: 'b-1',
    version: 3,
    billingProfile: null,
    subtotal: '40.00',
    discountTotal: '0.00',
    taxTotal: '6.00',
    total: '46.00',
    paidTotal: '0.00',
    balance: '46.00',
    items: [
      {
        id: 'i-1',
        kind: 'TREATMENT_SESSION',
        treatmentSessionId: 's-1',
        patient: person,
        description: 'Peeling químico',
        quantity: '1.00',
        unitPrice: '40.00',
        discount: '0.00',
        taxRatePercent: '15.00',
        lineSubtotal: '40.00',
        lineTax: '6.00',
      },
    ],
    payments: [],
    createdAt: '2026-10-15T14:00:00.000Z',
    ...overrides,
  }) as Order;

function setOrder(order: Order) {
  hooks.order = { data: order, isPending: false, isError: false };
}

beforeEach(() => {
  vi.clearAllMocks();
  hooks.can.mockReturnValue(true);
  hooks.eligibility = { data: { eligible: false, missing: ['BILLING_PROFILE'], items: [] } };
  hooks.billable = { data: [] };
  setOrder(makeOrder());
  let n = 0;
  vi.stubGlobal('crypto', { randomUUID: () => `key-${++n}` });
});

describe('OrderDetail', () => {
  it('locks the items when a payment is recorded and says why', () => {
    setOrder(makeOrder({ paidTotal: '10.00', balance: '36.00', payments: [payment as never] }));
    render(<OrderDetail orderId="o-1" />);

    expect(screen.getByRole('button', { name: 'Agregar sesión' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Concepto libre' })).toBeDisabled();
    expect(screen.getByText(/Los ítems no se pueden cambiar/)).toBeInTheDocument();
  });

  it('offers the items editing while the order is open without payments', () => {
    render(<OrderDetail orderId="o-1" />);

    expect(screen.getByRole('button', { name: 'Agregar sesión' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Concepto libre' })).toBeEnabled();
  });

  it('hides the free concept without billing.adjust', () => {
    hooks.can.mockImplementation((permission: string) => permission !== 'billing.adjust');
    render(<OrderDetail orderId="o-1" />);

    expect(screen.queryByRole('button', { name: 'Concepto libre' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Agregar sesión' })).toBeInTheDocument();
  });

  it('prefills the payment amount with the balance', () => {
    render(<OrderDetail orderId="o-1" />);

    expect(screen.getByLabelText(/Monto/)).toHaveValue('46.00');
  });

  it('records the payment with the order version and an idempotency key', async () => {
    hooks.recordPayment.mockResolvedValue({});
    render(<OrderDetail orderId="o-1" />);

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Registrar pago' })));

    expect(hooks.recordPayment).toHaveBeenCalledWith({
      data: { method: 'CASH', amount: '46.00' },
      idempotencyKey: 'key-1',
    });
  });

  it('does not list the payment after a network failure and retries with the same key', async () => {
    hooks.recordPayment.mockRejectedValueOnce({ message: 'Sin conexión' }).mockResolvedValue({});
    render(<OrderDetail orderId="o-1" />);

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Registrar pago' })));

    expect(screen.getByText('Sin conexión')).toBeInTheDocument();
    expect(screen.getByText('Sin pagos registrados.')).toBeInTheDocument();
    expect(screen.getByLabelText(/Monto/)).toHaveValue('46.00');

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Registrar pago' })));

    const keys = hooks.recordPayment.mock.calls.map(([input]) => input.idempotencyKey);
    expect(keys).toEqual(['key-1', 'key-1']);
  });

  it('refunds a payment with a reason when billing.adjust allows it', async () => {
    hooks.refundPayment.mockResolvedValue({});
    setOrder(makeOrder({ paidTotal: '10.00', balance: '36.00', payments: [payment as never] }));
    render(<OrderDetail orderId="o-1" />);

    fireEvent.click(screen.getByRole('button', { name: 'Devolver' }));
    fireEvent.change(screen.getByLabelText(/Motivo/), { target: { value: 'Error de cobro' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Confirmar devolución' })));

    expect(hooks.refundPayment).toHaveBeenCalledWith({
      paymentId: 'pay-1',
      data: { reason: 'Error de cobro' },
    });
  });

  it('shows the version conflict message', async () => {
    hooks.removeItem.mockRejectedValue({ code: 'ORDER_VERSION_CONFLICT', message: 'x' });
    render(<OrderDetail orderId="o-1" />);

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Quitar Peeling químico' })));

    expect(hooks.removeItem).toHaveBeenCalledWith({ itemId: 'i-1', version: 3 });
    expect(screen.getByText('La orden cambió; revisa y vuelve a intentar')).toBeInTheDocument();
  });

  it('has no emit button in B1', () => {
    hooks.eligibility = { data: { eligible: true, missing: [], items: [] } };
    render(<OrderDetail orderId="o-1" />);

    expect(screen.getByText('Lista para facturar')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Emitir|Facturar/ })).not.toBeInTheDocument();
  });
});
