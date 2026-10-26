import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExpiringTab } from './expiring-tab';
import { ValuationTab } from './valuation-tab';

const hooks = vi.hoisted(() => ({ report: vi.fn() }));

vi.mock('@/hooks/useBranches', () => ({
  useBranches: () => ({
    data: [
      { id: 'b-1', name: 'Principal', isActive: true },
      { id: 'b-2', name: 'Norte', isActive: true },
    ],
    isPending: false,
    isError: false,
  }),
}));
vi.mock('@/hooks/useInventory', () => ({
  useInventoryReport: (kind: string, params: unknown) => hooks.report(kind, params),
}));

const lot = (patch: Record<string, unknown>) => ({
  lotId: 'lot-1',
  product: { id: 'p-1', code: 'PROT-01', name: 'Protector solar' },
  branch: { id: 'b-1', name: 'Principal' },
  lotNumber: 'L-001',
  expiresAt: '2026-11-10T00:00:00.000Z',
  quantityOnHand: 3,
  value: '30.00',
  ...patch,
});

const ok = (data: unknown) => ({ data, isPending: false, isError: false, error: null });

beforeEach(() => {
  hooks.report.mockReset();
});

describe('ExpiringTab', () => {
  it('asks again with days 60 when the window changes', () => {
    hooks.report.mockReturnValue(ok({ expired: [], expiring: [lot({})] }));
    render(<ExpiringTab />);
    expect(hooks.report).toHaveBeenLastCalledWith('expiring', { days: 30, branchId: undefined });
    fireEvent.change(screen.getByLabelText('Ventana'), { target: { value: '60' } });
    expect(hooks.report).toHaveBeenLastCalledWith('expiring', { days: 60, branchId: undefined });
    fireEvent.change(screen.getByLabelText('Sede'), { target: { value: 'b-2' } });
    expect(hooks.report).toHaveBeenLastCalledWith('expiring', { days: 60, branchId: 'b-2' });
  });

  it('lists expired and expiring lots with their value', () => {
    hooks.report.mockReturnValue(
      ok({
        expired: [lot({ lotId: 'old', lotNumber: 'VIEJO', value: '12.50' })],
        expiring: [lot({})],
      }),
    );
    render(<ExpiringTab />);
    const expired = screen.getByRole('region', { name: 'Vencidos' });
    expect(within(expired).getByText('VIEJO')).toBeInTheDocument();
    expect(within(expired).getByText('$12.50')).toBeInTheDocument();
    const expiring = screen.getByRole('region', { name: 'Por vencer' });
    expect(within(expiring).getByText('Protector solar')).toBeInTheDocument();
    expect(within(expiring).getByText('$30.00')).toBeInTheDocument();
  });

  it('shows the API message when the report fails', () => {
    hooks.report.mockReturnValue({ data: undefined, isPending: false, isError: true, error: { message: 'Ventana inválida' } });
    render(<ExpiringTab />);
    expect(screen.getByRole('alert')).toHaveTextContent('Ventana inválida');
  });
});

describe('ValuationTab', () => {
  beforeEach(() => {
    hooks.report.mockImplementation((kind: string) =>
      kind === 'valuation'
        ? ok({
            totalValue: '150.00',
            branches: [
              {
                branchId: 'b-1',
                branchName: 'Principal',
                units: 15,
                value: '150.00',
                products: [{ productId: 'p-1', code: 'PROT-01', name: 'Protector solar', units: 15, value: '150.00' }],
              },
            ],
          })
        : ok({
            revenue: '200.00',
            cost: '120.00',
            margin: '80.00',
            products: [
              {
                productId: 'p-1',
                code: 'PROT-01',
                name: 'Protector solar',
                units: 8,
                revenue: '200.00',
                cost: '120.00',
                margin: '80.00',
              },
            ],
          }),
    );
  });

  it('shows revenue, cost and margin formatted', () => {
    render(<ValuationTab />);
    const margin = screen.getByRole('region', { name: 'Margen del período' });
    expect(within(margin).getAllByText('$200.00').length).toBeGreaterThan(0);
    expect(within(margin).getAllByText('$120.00').length).toBeGreaterThan(0);
    expect(within(margin).getAllByText('$80.00').length).toBeGreaterThan(0);
    const value = screen.getByRole('region', { name: 'Valor del inventario' });
    expect(within(value).getAllByText('$150.00').length).toBeGreaterThan(0);
  });

  it('passes the period and branch to the margin report', () => {
    render(<ValuationTab />);
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-10-05' } });
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-10-20' } });
    fireEvent.change(screen.getAllByLabelText('Sede')[1], { target: { value: 'b-2' } });
    expect(hooks.report).toHaveBeenLastCalledWith('margin', {
      from: '2026-10-05',
      to: '2026-10-20',
      branchId: 'b-2',
    });
  });
});
