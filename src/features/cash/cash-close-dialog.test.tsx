import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CashRegister } from '@/types/cash';
import { CashCloseDialog } from './cash-close-dialog';

const hooks = vi.hoisted(() => ({ close: vi.fn(), detail: { data: undefined as unknown } }));

vi.mock('@/hooks/useCashRegisters', () => ({
  useCashRegister: () => hooks.detail,
  useCloseCashRegister: () => ({ mutateAsync: hooks.close, isPending: false }),
}));

const register = { id: 'reg-1', status: 'OPEN', openingCash: '10.00' } as CashRegister;

const method = (received: string) => ({ received, refunded: '0.00' });

beforeEach(() => {
  vi.clearAllMocks();
  hooks.close.mockResolvedValue({});
  hooks.detail = {
    data: {
      ...register,
      summary: {
        expectedCash: '35.00',
        byMethod: {
          CASH: method('25.00'),
          DEBIT_CARD: method('0.00'),
          CREDIT_CARD: method('12.00'),
          TRANSFER: method('0.00'),
          OTHER: method('0.00'),
        },
      },
    },
  };
});

describe('CashCloseDialog', () => {
  it('shows the count by method and the expected cash', () => {
    render(<CashCloseDialog register={register} open onOpenChange={vi.fn()} />);

    expect(screen.getByText('Efectivo esperado')).toBeInTheDocument();
    expect(screen.getByText('$35.00')).toBeInTheDocument();
    expect(screen.getByText('Tarjeta de crédito')).toBeInTheDocument();
    expect(screen.getByText('$12.00')).toBeInTheDocument();
  });

  it('requires a note when the count differs, and sends the amount with two decimals', async () => {
    const onOpenChange = vi.fn();
    render(<CashCloseDialog register={register} open onOpenChange={onOpenChange} />);

    fireEvent.change(screen.getByLabelText(/Efectivo contado/), { target: { value: '33' } });
    expect(screen.getByText('-$2.00')).toBeInTheDocument();
    const close = screen.getByRole('button', { name: 'Cerrar caja' });
    expect(close).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Nota/), { target: { value: 'Faltó dar vuelto' } });
    expect(close).toBeEnabled();
    await act(async () => fireEvent.click(close));

    expect(hooks.close).toHaveBeenCalledWith({
      id: 'reg-1',
      data: { countedCash: '33.00', closingNote: 'Faltó dar vuelto' },
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('closes without a note when the count matches', async () => {
    render(<CashCloseDialog register={register} open onOpenChange={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/Efectivo contado/), { target: { value: '35.00' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Cerrar caja' })));

    expect(hooks.close).toHaveBeenCalledWith({ id: 'reg-1', data: { countedCash: '35.00' } });
  });

  it('keeps the dialog open when the server rejects the close', async () => {
    hooks.close.mockRejectedValue(new Error('network'));
    const onOpenChange = vi.fn();
    render(<CashCloseDialog register={register} open onOpenChange={onOpenChange} />);

    fireEvent.change(screen.getByLabelText(/Efectivo contado/), { target: { value: '35.00' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Cerrar caja' })));

    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/Efectivo contado/)).toHaveValue('35.00');
  });
});
