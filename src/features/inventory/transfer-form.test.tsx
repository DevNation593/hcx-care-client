import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Branch } from '@/types/clinical';
import type { ProductSummary, StockLotView } from '@/types/inventory';
import { TransferForm } from './transfer-form';

const onSubmit = vi.fn();

const lot = (patch: Partial<StockLotView>): StockLotView => ({
  id: 'lot',
  branchId: 'b-1',
  lotNumber: null,
  expiresAt: null,
  unitCost: '10.00',
  quantityReceived: 10,
  quantityOnHand: 10,
  receivedAt: '2026-08-01T00:00:00.000Z',
  expired: false,
  ...patch,
});

const lots: StockLotView[] = [
  lot({ id: 'lot-a', lotNumber: 'A-1', quantityOnHand: 4 }),
  lot({ id: 'lot-empty', lotNumber: 'VACIO', quantityOnHand: 0 }),
  lot({ id: 'lot-old', lotNumber: 'VIEJO', expired: true, expiresAt: '2026-01-01T00:00:00.000Z' }),
  lot({ id: 'lot-north', branchId: 'b-2', lotNumber: 'NORTE' }),
];

vi.mock('@/hooks/useInventory', () => ({
  useProduct: (id: string) => ({ data: id ? { lots } : undefined, isPending: false }),
}));

const branches = [
  { id: 'b-1', name: 'Principal' },
  { id: 'b-2', name: 'Norte' },
] as Branch[];

const base = {
  category: null,
  barcode: null,
  price: '25.00',
  taxRatePercent: 15,
  tracksExpiry: false,
  minStock: 0,
  isActive: true,
  createdAt: '',
  updatedAt: '',
};
const products: ProductSummary[] = [
  {
    ...base,
    id: 'p-1',
    code: 'PROT-01',
    name: 'Protector solar',
    stock: [{ branchId: 'b-1', branchName: 'Principal', available: 4, belowMin: false }],
  },
  {
    ...base,
    id: 'p-2',
    code: 'GUAN-01',
    name: 'Guantes',
    stock: [{ branchId: 'b-2', branchName: 'Norte', available: 8, belowMin: false }],
  },
];

const pick = (label: string | RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Registrar traslado' }));
const optionTexts = (label: string | RegExp) =>
  Array.from((screen.getByLabelText(label) as HTMLSelectElement).options).map((option) => option.text);

beforeEach(() => vi.clearAllMocks());

describe('TransferForm', () => {
  const setup = () => render(<TransferForm branches={branches} products={products} onSubmit={onSubmit} />);

  it('does not offer the origin branch as destination and clears a destination that becomes the origin', () => {
    setup();
    pick(/^Sede de origen/, 'b-1');
    expect(optionTexts(/^Sede de destino/)).toEqual(['Elige la sede de destino', 'Norte']);

    pick(/^Sede de destino/, 'b-2');
    pick(/^Sede de origen/, 'b-2');
    expect((screen.getByLabelText(/^Sede de destino/) as HTMLSelectElement).value).toBe('');
    submit();

    expect(screen.getByText('Elige la sede de destino', { selector: 'p' })).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('offers only the products and the lots with balance, not expired, of the origin branch', () => {
    setup();
    pick(/^Sede de origen/, 'b-1');
    expect(optionTexts(/^Producto/)).toEqual(['Elige un producto', 'PROT-01 · Protector solar']);

    pick(/^Producto/, 'p-1');
    expect(optionTexts(/^Lote/)).toEqual(['Elige un lote', 'A-1 · disponible 4']);
  });

  it('caps the quantity at the lot balance', () => {
    setup();
    pick(/^Sede de origen/, 'b-1');
    pick(/^Sede de destino/, 'b-2');
    pick(/^Producto/, 'p-1');
    pick(/^Lote/, 'lot-a');
    pick(/^Cantidad/, '5');
    submit();

    expect(screen.getByText('Solo hay 4 disponibles en este lote')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits the lot lines', () => {
    setup();
    pick(/^Sede de origen/, 'b-1');
    pick(/^Sede de destino/, 'b-2');
    pick(/^Producto/, 'p-1');
    pick(/^Lote/, 'lot-a');
    pick(/^Cantidad/, '3');
    submit();

    expect(onSubmit).toHaveBeenCalledWith({
      fromBranchId: 'b-1',
      toBranchId: 'b-2',
      lines: [{ lotId: 'lot-a', quantity: 3 }],
    });
  });

  it('shows the message the API answered', () => {
    render(<TransferForm branches={branches} products={products} error="Stock insuficiente" onSubmit={onSubmit} />);
    expect(screen.getByText('Stock insuficiente')).toBeInTheDocument();
  });

  it('reports the product search and keeps the chosen product when the results change', () => {
    const onProductSearch = vi.fn();
    const props = { branches, onProductSearch, onSubmit };
    const { rerender } = render(<TransferForm {...props} products={products} />);
    pick(/^Sede de origen/, 'b-1');
    pick('Buscar producto', 'pro');
    expect(onProductSearch).toHaveBeenCalledWith('pro');

    pick(/^Producto/, 'p-1');
    const other = { ...products[0], id: 'p-9', code: 'X-9', name: 'Otro' };
    rerender(<TransferForm {...props} products={[other]} />);
    expect((screen.getByLabelText(/^Producto/) as HTMLSelectElement).value).toBe('p-1');
    expect(optionTexts(/^Producto/)).toEqual(['Elige un producto', 'X-9 · Otro', 'PROT-01 · Protector solar']);
  });
});
