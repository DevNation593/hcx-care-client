import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProductSummary } from '@/types/inventory';
import { ProductForm } from './product-form';

const onSubmit = vi.fn();

const product: ProductSummary = {
  id: 'p-1',
  code: 'PROT-01',
  name: 'Protector solar',
  category: null,
  barcode: null,
  price: '25.00',
  taxRatePercent: 15,
  tracksExpiry: true,
  minStock: 3,
  isActive: true,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  stock: [],
};

const type = (label: string | RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

beforeEach(() => vi.clearAllMocks());

describe('ProductForm', () => {
  it('sends a numeric taxRatePercent and the price as a string with 2 decimals', () => {
    render(<ProductForm onSubmit={onSubmit} />);
    type(/^Código\b(?! de barras)/, 'prot-02');
    type(/^Nombre/, 'Crema');
    type(/^Precio/, '12,5');
    type(/^IVA/, '5');
    fireEvent.click(screen.getByLabelText('Lleva vencimiento'));
    type(/^Stock mínimo/, '4');
    fireEvent.click(screen.getByRole('button', { name: 'Crear producto' }));

    expect(onSubmit).toHaveBeenCalledWith({
      code: 'PROT-02',
      name: 'Crema',
      price: '12.50',
      taxRatePercent: 5,
      tracksExpiry: true,
      minStock: 4,
    });
  });

  it('blocks the submit with an invalid price', () => {
    render(<ProductForm onSubmit={onSubmit} />);
    type(/^Código\b(?! de barras)/, 'A1');
    type(/^Nombre/, 'Crema');
    type(/^Precio/, '0');
    fireEvent.click(screen.getByRole('button', { name: 'Crear producto' }));

    expect(screen.getByText('Ingresa un precio mayor que 0, con hasta 2 decimales')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('disables tracksExpiry when editing a product with lots', () => {
    render(<ProductForm product={product} hasLots onSubmit={onSubmit} />);
    expect(screen.getByLabelText('Lleva vencimiento')).toBeDisabled();
    expect(screen.getByText('No se puede cambiar mientras el producto tenga lotes.')).toBeInTheDocument();
  });

  it('keeps tracksExpiry editable without lots', () => {
    render(<ProductForm product={product} onSubmit={onSubmit} />);
    expect(screen.getByLabelText('Lleva vencimiento')).toBeEnabled();
  });

  it('shows the message the API answered', () => {
    render(<ProductForm error="El producto tiene existencias" onSubmit={onSubmit} />);
    expect(screen.getByText('El producto tiene existencias')).toBeInTheDocument();
  });
});
