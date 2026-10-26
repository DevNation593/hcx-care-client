import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/store/authStore';
import { InventoryPage } from './inventory-page';

const hooks = vi.hoisted(() => ({
  can: vi.fn(),
  adjust: vi.fn(),
  update: vi.fn(),
  setActive: vi.fn(),
  adjustError: undefined as { message: string } | undefined,
}));

vi.mock('@/hooks/usePermissions', () => ({ useMyPermissions: () => ({ can: hooks.can }) }));

const product = {
  id: 'p-1',
  code: 'PROT-01',
  name: 'Protector solar',
  category: 'Piel' as string | null,
  barcode: null as string | null,
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
  useUpdateProduct: () => ({ mutate: hooks.update, isPending: false }),
  useSetProductActive: () => ({ mutate: hooks.setActive, isPending: false }),
  useStockReceipts: () => ({
    data: {
      items: [
        {
          id: 'r-1',
          branch: { id: 'b-1', name: 'Principal' },
          supplierName: 'Distribuidora Sol',
          documentNumber: 'F-001',
          receivedAt: '2026-10-01T10:00:00.000Z',
          note: null,
          createdBy: { id: 'me', firstName: 'Ana', lastName: 'Vega' },
          lines: [{}],
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    },
    isPending: false,
    isError: false,
  }),
  useStockTransfers: () => ({
    data: {
      items: [
        {
          id: 't-1',
          fromBranch: { id: 'b-1', name: 'Principal' },
          toBranch: { id: 'b-2', name: 'Norte' },
          note: null,
          createdAt: '2026-10-02T10:00:00.000Z',
          createdBy: { id: 'me', firstName: 'Ana', lastName: 'Vega' },
          lines: [{}, {}],
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    },
    isPending: false,
    isError: false,
  }),
  useCreateStockReceipt: () => ({ mutate: vi.fn(), isPending: false }),
  useCreateStockTransfer: () => ({ mutate: vi.fn(), isPending: false }),
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

  it('lists the receipts and the transfers on their tabs', () => {
    render(<InventoryPage />);
    fireEvent.click(screen.getByRole('tab', { name: 'Entradas' }));
    const receiptRow = screen.getByText('Distribuidora Sol').closest('tr') as HTMLElement;
    expect(within(receiptRow).getByText('Principal')).toBeInTheDocument();
    expect(within(receiptRow).getByText('Ana Vega')).toBeInTheDocument();
    expect(screen.queryByText('Protector solar')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Traslados' }));
    const transferRow = screen.getByText('Norte').closest('tr') as HTMLElement;
    expect(within(transferRow).getByText('Principal')).toBeInTheDocument();
    expect(within(transferRow).getByText('2')).toBeInTheDocument();
  });

  it('turns a product off with the boolean the API takes', () => {
    render(<InventoryPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Desactivar Protector solar' }));
    expect(hooks.setActive).toHaveBeenCalledWith(false);
  });

  it('clears category and barcode on edit by sending empty strings, and nothing else', () => {
    product.barcode = '7501234567890';
    render(<InventoryPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Editar Protector solar' }));
    fireEvent.change(screen.getByLabelText('Categoría'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Código de barras'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    product.barcode = null;

    expect(hooks.update).toHaveBeenCalledWith({ category: '', barcode: '' }, expect.anything());
  });

  it('does not send blank category or barcode that were already blank', () => {
    product.category = null;
    render(<InventoryPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Editar Protector solar' }));
    fireEvent.change(screen.getByLabelText(/^Nombre/), { target: { value: 'Protector facial' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    product.category = 'Piel';

    expect(hooks.update).toHaveBeenCalledWith({ name: 'Protector facial' }, expect.anything());
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
