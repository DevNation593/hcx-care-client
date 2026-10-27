import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render as rtlRender, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { productsApi } from '@/lib/api/endpoints';
import type { ProductForSale } from '@/types/inventory';
import { ProductPicker } from './product-picker';

function render(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return rtlRender(ui, { wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> });
}

const whey: ProductForSale = {
  id: 'prod-1',
  code: 'WHEY',
  name: 'Proteína',
  barcode: '7501',
  price: '25.00',
  taxRatePercent: 15,
  available: 4,
};
const soldOut: ProductForSale = { ...whey, id: 'prod-2', code: 'CREA', name: 'Creatina', barcode: null, available: 0 };

const forSale = vi.spyOn(productsApi, 'forSale');
const label = 'Buscar producto o código de barras';

beforeEach(() => {
  forSale.mockReset();
});

describe('ProductPicker', () => {
  it('adds one unit of the product with the scanned barcode and clears the field', async () => {
    forSale.mockImplementation(async (_branch, _search, barcode) => (barcode ? [whey] : []));
    const onAdd = vi.fn().mockResolvedValue(undefined);
    render(<ProductPicker branchId="b-1" disabled={false} onAdd={onAdd} />);

    const field = screen.getByLabelText(label);
    fireEvent.change(field, { target: { value: ' 7501 ' } });
    await act(async () => fireEvent.keyDown(field, { key: 'Enter' }));

    expect(forSale).toHaveBeenCalledWith('b-1', '', '7501');
    expect(onAdd).toHaveBeenCalledWith('prod-1', 1);
    await waitFor(() => expect(field).toHaveValue(''));
  });

  it('keeps the field and adds nothing when the barcode matches no single product', async () => {
    forSale.mockImplementation(async (_branch, search, barcode) => (barcode ? [] : search ? [whey] : []));
    const onAdd = vi.fn();
    render(<ProductPicker branchId="b-1" disabled={false} onAdd={onAdd} />);

    const field = screen.getByLabelText(label);
    fireEvent.change(field, { target: { value: 'prot' } });
    await act(async () => fireEvent.keyDown(field, { key: 'Enter' }));

    expect(onAdd).not.toHaveBeenCalled();
    expect(field).toHaveValue('prot');
    expect(await screen.findByText('Proteína')).toBeInTheDocument();
  });

  it('lists the results with code, price and availability, and adds the typed quantity', async () => {
    forSale.mockResolvedValue([whey]);
    const onAdd = vi.fn().mockResolvedValue(undefined);
    render(<ProductPicker branchId="b-1" disabled={false} onAdd={onAdd} />);

    fireEvent.change(screen.getByLabelText(label), { target: { value: 'prot' } });
    expect(await screen.findByText('Proteína')).toBeInTheDocument();
    expect(screen.getByText(/WHEY/)).toBeInTheDocument();
    expect(screen.getByText(/\$25\.00/)).toBeInTheDocument();
    expect(screen.getByText('4 disponibles')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Cantidad de Proteína'), { target: { value: '3' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Agregar Proteína' })));

    expect(onAdd).toHaveBeenCalledWith('prod-1', 3);
  });

  it('rejects a quantity that is not an integer of at least 1', async () => {
    forSale.mockResolvedValue([whey]);
    render(<ProductPicker branchId="b-1" disabled={false} onAdd={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(label), { target: { value: 'prot' } });
    await screen.findByText('Proteína');
    for (const value of ['0', '1.5', '']) {
      fireEvent.change(screen.getByLabelText('Cantidad de Proteína'), { target: { value } });
      expect(screen.getByRole('button', { name: 'Agregar Proteína' })).toBeDisabled();
    }
  });

  it('disables a product without stock in the branch', async () => {
    forSale.mockResolvedValue([soldOut]);
    render(<ProductPicker branchId="b-1" disabled={false} onAdd={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(label), { target: { value: 'crea' } });
    const button = await screen.findByRole('button', { name: 'Agregar Creatina' });

    expect(button).toBeDisabled();
    expect(button).toHaveTextContent('Sin stock en esta sede');
  });

  it('disables the adding while the order is locked', async () => {
    forSale.mockResolvedValue([whey]);
    render(<ProductPicker branchId="b-1" disabled onAdd={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(label), { target: { value: 'prot' } });

    expect(await screen.findByRole('button', { name: 'Agregar Proteína' })).toBeDisabled();
  });
});
