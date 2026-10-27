import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render as rtlRender, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ordersApi, productsApi } from '@/lib/api/endpoints';
import type { Order } from '@/types/cash';
import { OrderDetail } from './order-detail';

function render(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return rtlRender(ui, { wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> });
}

const hooks = vi.hoisted(() => ({
  can: vi.fn(),
  order: { data: undefined as unknown, isPending: false, isError: false, isFetching: false, refetch: vi.fn() },
  eligibility: { data: undefined as unknown },
  recordPayment: vi.fn(),
  refetchOrder: vi.fn(),
  refundPayment: vi.fn(),
  addItem: vi.fn(),
  removeItem: vi.fn(),
  updateItem: vi.fn(),
  setProfile: vi.fn(),
  billable: { data: [] as unknown[] },
  patientProfiles: { data: [] as unknown[], isPending: false },
  createProfile: vi.fn(),
  inventory: true,
  toastError: vi.fn(),
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: hooks.toastError } }));
vi.mock('@/hooks/useSections', () => ({ useSections: () => ({ isEnabled: () => hooks.inventory }) }));

vi.mock('@/hooks/usePermissions', () => ({ useMyPermissions: () => ({ can: hooks.can }) }));
vi.mock('@/hooks/useOrders', async (importOriginal) => ({
  // The real add-item mutation, so the API error reaches the user through its own toast.
  useAddOrderItem: (await importOriginal<typeof import('@/hooks/useOrders')>()).useAddOrderItem,
  useOrder: () => hooks.order,
  useOrderEligibility: () => hooks.eligibility,
  useBillableSessions: () => hooks.billable,
  useRemoveOrderItem: () => ({ mutateAsync: hooks.removeItem, isPending: false }),
  useUpdateOrderItem: () => ({ mutateAsync: hooks.updateItem, isPending: false }),
  useSetOrderBillingProfile: () => ({ mutateAsync: hooks.setProfile, isPending: false }),
  useRecordPayment: () => ({ mutateAsync: hooks.recordPayment, isPending: false }),
  useRefundPayment: () => ({ mutateAsync: hooks.refundPayment, isPending: false }),
}));
vi.mock('@/hooks/useBillingProfiles', () => ({
  useBillingProfiles: () => ({ data: { items: [] }, isPending: false }),
  usePatientBillingProfiles: () => hooks.patientProfiles,
  useCreateBillingProfile: () => ({ mutateAsync: hooks.createProfile, isPending: false }),
  useLinkBillingProfile: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

const person = { id: 'p-1', firstName: 'Ana', lastName: 'Paz' };

const linked = {
  id: 'bp-9',
  kind: 'PERSON',
  idType: '05',
  idNumber: '1710034065',
  legalName: 'Ana Paz',
  email: 'ana@example.com',
  isDefault: true,
};

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
  hooks.order = { data: order, isPending: false, isError: false, isFetching: false, refetch: hooks.refetchOrder };
}

beforeEach(() => {
  vi.clearAllMocks();
  hooks.can.mockReturnValue(true);
  hooks.inventory = true;
  hooks.eligibility = { data: { eligible: false, missing: ['BILLING_PROFILE'], items: [] } };
  hooks.billable = { data: [] };
  hooks.patientProfiles = { data: [linked], isPending: false };
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

  it('shows the API message when a product has no stock left', async () => {
    const whey = { id: 'prod-1', code: 'WHEY', name: 'Proteína', barcode: '7501', price: '25.00', taxRatePercent: 15, available: 5 };
    vi.spyOn(productsApi, 'forSale').mockResolvedValue([whey]);
    const message = 'Solo hay 1 unidades disponibles en esta sede.';
    const addItem = vi
      .spyOn(ordersApi, 'addItem')
      .mockRejectedValue({ statusCode: 409, code: 'INSUFFICIENT_STOCK', message });
    render(<OrderDetail orderId="o-1" />);

    fireEvent.change(screen.getByLabelText('Buscar producto o código de barras'), { target: { value: 'prot' } });
    fireEvent.change(await screen.findByLabelText('Cantidad de Proteína'), { target: { value: '2' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Agregar Proteína' })));

    expect(addItem).toHaveBeenCalledWith('o-1', { version: 3, kind: 'PRODUCT', productId: 'prod-1', quantity: '2' });
    expect(hooks.toastError).toHaveBeenCalledWith(message);
  });

  it('has no product search without the inventory section', () => {
    hooks.inventory = false;
    render(<OrderDetail orderId="o-1" />);

    expect(screen.queryByLabelText('Buscar producto o código de barras')).not.toBeInTheDocument();
  });

  it('prefills the payment amount with the balance', () => {
    render(<OrderDetail orderId="o-1" />);

    expect(screen.getByLabelText(/Monto/)).toHaveValue('46.00');
  });

  it('records the payment with an idempotency key', async () => {
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

    // Editing the amount after the lost response keeps the key: the server decides.
    fireEvent.change(screen.getByLabelText(/Monto/), { target: { value: '20.00' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Registrar pago' })));
    // After the success the next payment of the same form has a new key.
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Registrar pago' })));

    const keys = hooks.recordPayment.mock.calls.map(([input]) => input.idempotencyKey);
    expect(keys[0]).toBe(keys[1]);
    expect(keys[2]).not.toBe(keys[1]);
  });

  it('keeps the key when a refetch changes the order and the form stays open', async () => {
    hooks.recordPayment.mockRejectedValueOnce({ message: 'Sin conexión' }).mockResolvedValue({});
    const { rerender } = render(<OrderDetail orderId="o-1" />);

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Registrar pago' })));
    // The lost response had landed: a refetch brings a new version and balance.
    setOrder(makeOrder({ version: 4, balance: '36.00', paidTotal: '10.00' }));
    rerender(<OrderDetail orderId="o-1" />);
    expect(screen.getByLabelText(/Monto/)).toHaveValue('36.00');
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Registrar pago' })));

    const keys = hooks.recordPayment.mock.calls.map(([input]) => input.idempotencyKey);
    expect(keys).toHaveLength(2);
    expect(keys[1]).toBe(keys[0]);
  });

  it('keeps the form mounted and the key when a background refetch fails', async () => {
    hooks.recordPayment.mockRejectedValueOnce({ message: 'Sin conexión' }).mockResolvedValue({});
    const { rerender } = render(<OrderDetail orderId="o-1" />);

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Registrar pago' })));
    hooks.order = { ...hooks.order, isError: true };
    rerender(<OrderDetail orderId="o-1" />);

    expect(screen.queryByText('No se pudo cargar la orden')).not.toBeInTheDocument();
    expect(screen.getByText(/No se pudo actualizar la orden/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(hooks.refetchOrder).toHaveBeenCalled();

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Registrar pago' })));
    const keys = hooks.recordPayment.mock.calls.map(([input]) => input.idempotencyKey);
    expect(keys).toHaveLength(2);
    expect(keys[1]).toBe(keys[0]);
  });

  it('shows the error page only when there is no order to show', () => {
    hooks.order = { data: undefined, isPending: false, isError: true, isFetching: false, refetch: vi.fn() };
    render(<OrderDetail orderId="o-1" />);

    expect(screen.getByText('No se pudo cargar la orden')).toBeInTheDocument();
  });

  it('keeps an amount typed by the user when the balance changes', () => {
    const { rerender } = render(<OrderDetail orderId="o-1" />);

    fireEvent.change(screen.getByLabelText(/Monto/), { target: { value: '5.00' } });
    setOrder(makeOrder({ version: 4, balance: '36.00' }));
    rerender(<OrderDetail orderId="o-1" />);

    expect(screen.getByLabelText(/Monto/)).toHaveValue('5.00');
  });

  it('shows a reused-key conflict and issues a fresh key', async () => {
    hooks.recordPayment
      .mockRejectedValueOnce({ code: 'IDEMPOTENCY_KEY_REUSED', message: 'Clave ya usada' })
      .mockResolvedValue({});
    render(<OrderDetail orderId="o-1" />);

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Registrar pago' })));
    expect(screen.getByText('Clave ya usada')).toBeInTheDocument();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Registrar pago' })));

    const keys = hooks.recordPayment.mock.calls.map(([input]) => input.idempotencyKey);
    expect(keys[1]).not.toBe(keys[0]);
  });

  it('sets the billing profile linked to the patient with the order version', async () => {
    hooks.setProfile.mockResolvedValue({});
    render(<OrderDetail orderId="o-1" />);

    fireEvent.click(screen.getByRole('button', { name: 'Elegir receptor' }));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Elegir Ana Paz' })));

    expect(hooks.setProfile).toHaveBeenCalledWith({ version: 3, billingProfileId: 'bp-9' });
  });

  it('selects a newly created profile', async () => {
    hooks.setProfile.mockResolvedValue({});
    hooks.createProfile.mockResolvedValue({ ...linked, id: 'bp-new', legalName: 'Luis Mora' });
    render(<OrderDetail orderId="o-1" />);

    fireEvent.click(screen.getByRole('button', { name: 'Elegir receptor' }));
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo receptor' }));
    fireEvent.change(screen.getByLabelText(/Identificación/), { target: { value: '1710034065' } });
    fireEvent.change(screen.getByLabelText(/Nombre o razón social/), { target: { value: 'Luis Mora' } });
    fireEvent.change(screen.getByLabelText(/Correo/), { target: { value: 'luis@example.com' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Guardar' })));

    expect(hooks.setProfile).toHaveBeenCalledWith({ version: 3, billingProfileId: 'bp-new' });
  });

  it('shows the version conflict when setting the profile', async () => {
    hooks.setProfile.mockRejectedValue({ code: 'ORDER_VERSION_CONFLICT', message: 'x' });
    render(<OrderDetail orderId="o-1" />);

    fireEvent.click(screen.getByRole('button', { name: 'Elegir receptor' }));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Elegir Ana Paz' })));

    expect(screen.getByText('La orden cambió; revisa y vuelve a intentar')).toBeInTheDocument();
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

  it('offers emission for an eligible paid order in B2', () => {
    hooks.eligibility = { data: { eligible: true, missing: [], items: [] } };
    setOrder(makeOrder({ status: 'PAID' }));
    render(<OrderDetail orderId="o-1" />);

    expect(screen.getByText('Lista para facturar')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Emitir factura' })).toBeEnabled();
  });
});
