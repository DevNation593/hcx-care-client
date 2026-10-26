import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/store/authStore';
import { InventoryPage } from './inventory-page';

const hooks = vi.hoisted(() => ({
  can: vi.fn(),
  adjust: vi.fn(),
  setActive: vi.fn(),
  adjustError: undefined as { message: string } | undefined,
}));

vi.mock('@/hooks/usePermissions', () => ({ useMyPermissions: () => ({ can: hooks.can }) }));

const product = {
  id: 'p-1',
  code: 'PROT-01',
  name: 'Protector solar',
  category: 'Piel',
  barcode: null,
  price: '25.00',
  taxRatePercent: 15,
  tracksExpiry: true,
  minStock: 5,
  isActive: true,
  createdAt: '',
  updatedAt: '',
  stock: [
    { branchId: 'b-1', branchName: 'Principal', available: 2, belowMin: true },
    { branchId: 'b-2', branchName: 'Norte', available: 9, belowMin: false },
  ],
};

const lots = [
  {
    id: 'lot-1',
    branchId: 'b-1',
    lotNumber: 'L-001',
    expiresAt: '2026-09-01T00:00:00.000Z',
    unitCost: '10.00',
    quantityReceived: 12,
    quantityOnHand: 2,
    receivedAt: '2026-08-01T00:00:00.000Z',
    expired: true,
  },
];

vi.mock('@/hooks/useInventory', () => ({
  useProducts: () => ({
    data: { items: [product], total: 1, page: 1, pageSize: 20 },
    isPending: false,
    isError: false,
  }),
  useProduct: () => ({ data: { ...product, lots }, isError: false }),
  useCreateProduct: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateProduct: () => ({ mutate: vi.fn(), isPending: false }),
  useSetProductActive: () => ({ mutate: hooks.setActive, isPending: false }),
  useAdjustLot: () => ({ mutate: hooks.adjust, isPending: false, error: hooks.adjustError }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  hooks.can.mockReturnValue(true);
  hooks.adjustError = undefined;
  useAuthStore.setState({ user: { id: 'me', role: 'MASTER', firstName: 'Ana', lastName: 'Vega' } as never });
});

describe('InventoryPage', () => {
  it('shows nothing of the inventory without inventory.manage', () => {
    hooks.can.mockReturnValue(false);
    render(<InventoryPage />);

    expect(screen.queryByRole('tab', { name: 'Productos' })).not.toBeInTheDocument();
    expect(screen.queryByText('Protector solar')).not.toBeInTheDocument();
  });

  it('lists the tabs and the products with stock per branch and the below-minimum mark', () => {
    render(<InventoryPage />);

    for (const name of ['Productos', 'Entradas', 'Traslados', 'Por vencer', 'Valorización y margen']) {
      expect(screen.getByRole('tab', { name })).toBeInTheDocument();
    }
    const row = screen.getByText('Protector solar').closest('tr') as HTMLElement;
    expect(within(row).getByText('$25.00')).toBeInTheDocument();
    expect(within(row).getByText('Principal: 2')).toBeInTheDocument();
    expect(within(row).getByText('Bajo mínimo')).toBeInTheDocument();
    expect(within(row).getByText('Norte: 9')).toBeInTheDocument();
  });

  it('shows only the title on the other tabs', () => {
    render(<InventoryPage />);
    fireEvent.click(screen.getByRole('tab', { name: 'Traslados' }));

    expect(screen.getByRole('heading', { name: 'Traslados' })).toBeInTheDocument();
    expect(screen.queryByText('Protector solar')).not.toBeInTheDocument();
  });

  it('turns a product off with the boolean the API takes', () => {
    render(<InventoryPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Desactivar Protector solar' }));
    expect(hooks.setActive).toHaveBeenCalledWith(false);
  });

  it('shows the lots with the expired mark and opens the adjustment', () => {
    render(<InventoryPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Ver lotes de Protector solar' }));

    const lot = screen.getByText('Lote L-001').closest('li') as HTMLElement;
    expect(within(lot).getByText('Vencido')).toBeInTheDocument();
    expect(within(lot).getByText(/Costo \$10\.00 · Recibido 12 · Disponible 2/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ajustar lote L-001' }));
    expect(screen.getByLabelText('Unidades a sumar o restar', { exact: false })).toBeInTheDocument();
  });
});
