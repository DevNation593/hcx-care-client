import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/store/authStore';
import { CashPage } from './cash-page';

const hooks = vi.hoisted(() => ({
  can: vi.fn(),
  push: vi.fn(),
  createOrder: vi.fn(),
  useOrders: vi.fn(),
  refetchCurrent: vi.fn(),
  openRegister: vi.fn(),
  current: { data: null as unknown, isError: false, isFetching: false, refetch: vi.fn() } as Record<string, unknown>,
  billable: { data: [] as unknown[], isPending: false, isError: false },
  orders: { data: { items: [] as unknown[] }, isPending: false, isError: false } as Record<string, unknown>,
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: hooks.push }) }));
vi.mock('@/hooks/usePermissions', () => ({ useMyPermissions: () => ({ can: hooks.can }) }));
vi.mock('@/hooks/useBranches', () => ({
  useBranches: () => ({
    data: [
      { id: 'b-2', name: 'Norte', isMain: false, isActive: true },
      { id: 'b-1', name: 'Principal', isMain: true, isActive: true },
    ],
  }),
}));
vi.mock('@/hooks/useCashRegisters', () => ({
  useCurrentCashRegister: () => hooks.current,
  useOpenCashRegister: () => ({ mutateAsync: hooks.openRegister, isPending: false }),
  useCashRegister: () => ({ data: undefined }),
  useCloseCashRegister: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('@/hooks/useOrders', () => ({
  useBillableSessions: () => hooks.billable,
  useOrders: (filters: unknown) => hooks.useOrders(filters),
  useCreateOrder: () => ({ mutateAsync: hooks.createOrder, isPending: false }),
}));

const billable = (id: string, compliant: boolean) => ({
  id,
  status: 'CLINICAL_COMPLETE',
  createdAt: '2026-10-15T15:00:00.000Z',
  completedAt: '2026-10-15T16:00:00.000Z',
  branchId: 'b-1',
  patient: { id: `p-${id}`, firstName: 'Ana', lastName: `Paz ${id}`, identificationNumber: null },
  treatment: { id: 't-1', name: 'Peeling químico', version: 1 },
  price: '40.00',
  taxRatePercent: '15.00',
  compliant,
});

beforeEach(() => {
  vi.clearAllMocks();
  hooks.can.mockReturnValue(true);
  hooks.current = { data: null, isError: false, isFetching: false, refetch: hooks.refetchCurrent };
  hooks.billable = { data: [billable('s1', true), billable('s2', false)], isPending: false, isError: false };
  hooks.orders = { data: { items: [], total: 0, page: 1, pageSize: 20 }, isPending: false, isError: false };
  hooks.useOrders.mockImplementation(() => hooks.orders);
  hooks.createOrder.mockResolvedValue({ id: 'order-7' });
  useAuthStore.setState({ user: { id: 'me', role: 'ASISTENTE', firstName: 'Sofía', lastName: 'Ruiz' } as never });
});

describe('CashPage', () => {
  it('hides opening the register without cash.manage', () => {
    hooks.can.mockImplementation((permission: string) => permission !== 'cash.manage');
    render(<CashPage />);

    expect(screen.getByText('Caja cerrada')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Abrir caja' })).not.toBeInTheDocument();
  });

  it('shows an error with a retry, not a closed register, when the register cannot be read', () => {
    hooks.current = { data: undefined, isError: true, isFetching: false, refetch: hooks.refetchCurrent };
    render(<CashPage />);

    expect(screen.getByText('No se pudo leer el estado de la caja')).toBeInTheDocument();
    expect(screen.queryByText('Caja cerrada')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Abrir caja' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cerrar caja' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(hooks.refetchCurrent).toHaveBeenCalled();
  });

  it('opens the register with the opening cash of the main branch', async () => {
    hooks.openRegister.mockResolvedValue({});
    render(<CashPage />);

    expect(screen.getByLabelText('Sucursal')).toHaveValue('b-1');
    fireEvent.click(screen.getByRole('button', { name: 'Abrir caja' }));
    fireEvent.change(screen.getByLabelText(/Monto inicial/), { target: { value: '10' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Abrir' })));

    expect(hooks.openRegister).toHaveBeenCalledWith({ branchId: 'b-1', openingCash: '10.00' });
  });

  it('shows who opened the register and offers to close it', () => {
    hooks.current = {
      data: { id: 'reg-1', status: 'OPEN', openedById: 'me', openedAt: '2026-10-15T15:30:00.000Z' },
      isError: false,
    };
    render(<CashPage />);

    expect(screen.getByText(/Caja abierta desde \d{2}:\d{2} por Sofía Ruiz/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cerrar caja' })).toBeInTheDocument();
  });

  it('charges the ticked sessions in one order and opens it', async () => {
    render(<CashPage />);

    fireEvent.click(screen.getByLabelText(/Paz s1/));
    fireEvent.click(screen.getByLabelText(/Paz s2/));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Cobrar' })));

    expect(hooks.createOrder).toHaveBeenCalledWith({
      branchId: 'b-1',
      treatmentSessionIds: ['s1', 's2'],
    });
    expect(hooks.push).toHaveBeenCalledWith('/cash/orders/order-7');
  });

  it('clears the selection when the branch changes', () => {
    render(<CashPage />);

    fireEvent.click(screen.getByLabelText(/Paz s1/));
    expect(screen.getByRole('button', { name: 'Cobrar' })).toBeEnabled();
    fireEvent.change(screen.getByLabelText('Sucursal'), { target: { value: 'b-2' } });

    expect(screen.getByLabelText(/Paz s1/)).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Cobrar' })).toBeDisabled();
  });

  it('sends only the ticked sessions that are still listed', async () => {
    const { rerender } = render(<CashPage />);

    fireEvent.click(screen.getByLabelText(/Paz s1/));
    fireEvent.click(screen.getByLabelText(/Paz s2/));
    // Another order consumed s2 and the list refetched.
    hooks.billable = { data: [billable('s1', true)], isPending: false, isError: false };
    rerender(<CashPage />);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Cobrar' })));

    expect(hooks.createOrder).toHaveBeenCalledWith({ branchId: 'b-1', treatmentSessionIds: ['s1'] });
  });

  it('offers no charging with billing.view alone', () => {
    hooks.can.mockImplementation((permission: string) => permission !== 'billing.create');
    render(<CashPage />);

    expect(screen.queryByRole('button', { name: 'Cobrar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.getByText('Falta documentación')).toBeInTheDocument();
  });

  it('disables charging until a session is ticked', () => {
    render(<CashPage />);
    expect(screen.getByRole('button', { name: 'Cobrar' })).toBeDisabled();
  });

  it('marks the documentation state without any clinical detail', () => {
    render(<CashPage />);

    const rows = screen.getAllByRole('row');
    expect(within(rows[1]).getByText('Completa')).toBeInTheDocument();
    expect(within(rows[2]).getByText('Falta documentación')).toBeInTheDocument();
    expect(within(rows[2]).getByText('$40.00')).toBeInTheDocument();
  });

  it('lists the orders and opens one', () => {
    hooks.orders = {
      data: {
        items: [
          {
            id: 'o-1',
            number: 12,
            status: 'OPEN',
            billingProfile: { legalName: 'Clínica Sol' },
            total: '40.00',
            balance: '40.00',
          },
        ],
      },
      isPending: false,
      isError: false,
    };
    render(<CashPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Órdenes' }));
    fireEvent.click(screen.getByText('Clínica Sol'));

    expect(hooks.push).toHaveBeenCalledWith('/cash/orders/o-1');
  });

  describe('orders tab', () => {
    const manyOrders = (total: number) => ({
      data: {
        items: [{ id: 'o-1', number: 12, status: 'OPEN', billingProfile: null, total: '40.00', balance: '40.00' }],
        total,
        page: 1,
        pageSize: 20,
      },
      isPending: false,
      isError: false,
    });
    const lastFilters = () => hooks.useOrders.mock.calls.at(-1)?.[0];

    it('lists only open orders of the branch by default', () => {
      render(<CashPage />);
      fireEvent.click(screen.getByRole('button', { name: 'Órdenes' }));

      expect(lastFilters()).toEqual({ branchId: 'b-1', page: 1, pageSize: 20, status: 'OPEN' });
    });

    it('filters by status, and Todas sends no status', () => {
      render(<CashPage />);
      fireEvent.click(screen.getByRole('button', { name: 'Órdenes' }));

      fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'PAID' } });
      expect(lastFilters()).toMatchObject({ status: 'PAID', page: 1 });
      fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'ALL' } });
      expect(lastFilters()).not.toHaveProperty('status');
    });

    it('pages with the API total and goes back to the first page when searching', () => {
      hooks.orders = manyOrders(45);
      render(<CashPage />);
      fireEvent.click(screen.getByRole('button', { name: 'Órdenes' }));

      expect(screen.getByText('Página 1 de 3')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
      expect(lastFilters()).toMatchObject({ page: 2, pageSize: 20 });

      fireEvent.change(screen.getByLabelText('Buscar'), { target: { value: '  Clínica Sol ' } });
      fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
      expect(lastFilters()).toMatchObject({ page: 1, q: 'Clínica Sol' });
    });
  });
});
