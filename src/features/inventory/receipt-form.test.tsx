import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Branch } from '@/types/clinical';
import type { ProductSummary } from '@/types/inventory';
import { ReceiptForm } from './receipt-form';

const onSubmit = vi.fn();

const branches = [
  { id: 'b-1', name: 'Principal' },
  { id: 'b-2', name: 'Norte' },
] as Branch[];

const base = {
  category: null,
  barcode: null,
  price: '25.00',
  taxRatePercent: 15,
  minStock: 0,
  isActive: true,
  createdAt: '',
  updatedAt: '',
  stock: [],
};
const products: ProductSummary[] = [
  { ...base, id: 'p-1', code: 'PROT-01', name: 'Protector solar', tracksExpiry: true },
  { ...base, id: 'p-2', code: 'GUAN-01', name: 'Guantes', tracksExpiry: false },
];

const type = (label: string | RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Registrar entrada' }));
const setup = () => render(<ReceiptForm branches={branches} products={products} onSubmit={onSubmit} />);

beforeEach(() => vi.clearAllMocks());

const GUANTES_ONLY = [products[1]];

describe('ReceiptForm', () => {
  it('does not submit a product that tracks expiry without a date and flags that line', () => {
    setup();
    type(/^Producto/, 'p-1');
    type(/^Cantidad/, '5');
    type(/^Costo unitario/, '2,5');
    submit();

    expect(screen.getByText('Este producto lleva vencimiento: indica la fecha')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits a tracked product once it has an expiry date', () => {
    setup();
    type('Proveedor', ' Distribuidora Sol ');
    type(/^Producto/, 'p-1');
    type(/^Cantidad/, '5');
    type(/^Costo unitario/, '2,5');
    type(/^Lote/, 'L-01');
    type(/^Vencimiento/, '2027-06-30');
    submit();

    expect(onSubmit).toHaveBeenCalledWith({
      branchId: 'b-1',
      supplierName: 'Distribuidora Sol',
      lines: [{ productId: 'p-1', quantity: 5, unitCost: '2.50', lotNumber: 'L-01', expiresAt: '2027-06-30' }],
    });
  });

  it('does not require an expiry for a product that does not track it', () => {
    setup();
    type(/^Producto/, 'p-2');
    type(/^Cantidad/, '3');
    type(/^Costo unitario/, '0');
    submit();

    expect(onSubmit).toHaveBeenCalledWith({
      branchId: 'b-1',
      lines: [{ productId: 'p-2', quantity: 3, unitCost: '0.00' }],
    });
  });

  it('rejects a fractional quantity and a cost with 3 decimals', () => {
    setup();
    type(/^Producto/, 'p-2');
    type(/^Cantidad/, '1.5');
    type(/^Costo unitario/, '1.234');
    submit();

    expect(screen.getByText('Ingresa un entero, 1 o más')).toBeInTheDocument();
    expect(screen.getByText('Ingresa un costo, con hasta 2 decimales')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows the message the API answered', () => {
    render(<ReceiptForm branches={branches} products={products} error="Producto inactivo" onSubmit={onSubmit} />);
    expect(screen.getByText('Producto inactivo')).toBeInTheDocument();
  });

  it('sends the chosen day as local noon so the day does not shift with the time zone', () => {
    setup();
    type(/^Fecha de recepción/, '2026-10-26');
    type(/^Producto/, 'p-2');
    type(/^Cantidad/, '1');
    type(/^Costo unitario/, '1');
    submit();

    const sent = onSubmit.mock.calls[0][0].receivedAt as string;
    expect(sent).toBe(new Date(2026, 9, 26, 12).toISOString());
    const back = new Date(sent);
    expect([back.getFullYear(), back.getMonth(), back.getDate(), back.getHours()]).toEqual([2026, 9, 26, 12]);
  });

  it('reports the product search and keeps a chosen product after the results change', () => {
    const onProductSearch = vi.fn();
    const { rerender } = render(
      <ReceiptForm branches={branches} products={products} onProductSearch={onProductSearch} onSubmit={onSubmit} />,
    );
    type('Buscar producto', 'gua');
    expect(onProductSearch).toHaveBeenCalledWith('gua');

    type(/^Producto/, 'p-1');
    rerender(
      <ReceiptForm branches={branches} products={GUANTES_ONLY} onProductSearch={onProductSearch} onSubmit={onSubmit} />,
    );
    expect(Array.from((screen.getByLabelText(/^Producto/) as HTMLSelectElement).options).map((o) => o.value)).toEqual([
      '',
      'p-2',
      'p-1',
    ]);
    expect((screen.getByLabelText(/^Producto/) as HTMLSelectElement).value).toBe('p-1');
  });

  it('can choose a product that only appears in a later search', () => {
    const later: ProductSummary = { ...products[1], id: 'p-300', code: 'ZZ-300', name: 'Mascarilla' };
    const { rerender } = render(<ReceiptForm branches={branches} products={products} onSubmit={onSubmit} />);
    rerender(<ReceiptForm branches={branches} products={[later]} onSubmit={onSubmit} />);
    type(/^Producto/, 'p-300');
    type(/^Cantidad/, '2');
    type(/^Costo unitario/, '3');
    submit();

    expect(onSubmit).toHaveBeenCalledWith({
      branchId: 'b-1',
      lines: [{ productId: 'p-300', quantity: 2, unitCost: '3.00' }],
    });
  });
});
