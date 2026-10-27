import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StockLotView } from '@/types/inventory';
import { AdjustLotForm } from './adjust-lot-form';

const hooks = vi.hoisted(() => ({
  mutate: vi.fn(),
  error: undefined as { message: string } | undefined,
}));

vi.mock('@/hooks/useInventory', () => ({
  useAdjustLot: () => ({ mutate: hooks.mutate, isPending: false, error: hooks.error }),
}));

const lot: StockLotView = {
  id: 'lot-1',
  branchId: 'b-1',
  lotNumber: 'L-001',
  expiresAt: null,
  unitCost: '10.00',
  quantityReceived: 12,
  quantityOnHand: 7,
  receivedAt: '2026-08-01T00:00:00.000Z',
  expired: false,
};

const onDone = vi.fn();
const save = () => fireEvent.click(screen.getByRole('button', { name: 'Registrar ajuste' }));
const setup = () => render(<AdjustLotForm productId="p-1" lot={lot} onDone={onDone} />);

beforeEach(() => {
  vi.clearAllMocks();
  hooks.error = undefined;
});

describe('AdjustLotForm', () => {
  it('offers the reasons with their labels', () => {
    setup();
    const options = Array.from((screen.getByLabelText(/^Motivo/) as HTMLSelectElement).options).map(
      (option) => option.text,
    );
    expect(options).toEqual(['Conteo físico', 'Daño', 'Vencido', 'Uso interno', 'Otro']);
  });

  it('sends a delta', () => {
    setup();
    fireEvent.change(screen.getByLabelText(/^Unidades a sumar/), { target: { value: '-2' } });
    fireEvent.change(screen.getByLabelText(/^Motivo/), { target: { value: 'DAMAGE' } });
    save();

    expect(hooks.mutate).toHaveBeenCalledWith(
      { lotId: 'lot-1', data: { delta: -2, reason: 'DAMAGE' } },
      expect.anything(),
    );
  });

  it('sends the counted quantity instead of a delta', () => {
    setup();
    fireEvent.click(screen.getByLabelText('Cantidad contada'));
    fireEvent.change(screen.getByLabelText(/^Unidades contadas/), { target: { value: '5' } });
    save();

    expect(hooks.mutate).toHaveBeenCalledWith(
      { lotId: 'lot-1', data: { countedQuantity: 5, reason: 'COUNT' } },
      expect.anything(),
    );
  });

  it('requires a note with the reason Otro', () => {
    setup();
    fireEvent.change(screen.getByLabelText(/^Unidades a sumar/), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText(/^Motivo/), { target: { value: 'OTHER' } });
    save();

    expect(screen.getByText('Escribe una nota para el motivo «Otro»')).toBeInTheDocument();
    expect(hooks.mutate).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/^Nota/), { target: { value: 'Regalo' } });
    save();
    expect(hooks.mutate).toHaveBeenCalledWith(
      { lotId: 'lot-1', data: { delta: 1, reason: 'OTHER', note: 'Regalo' } },
      expect.anything(),
    );
  });

  it('rejects a zero difference and shows the API message', () => {
    hooks.error = { message: 'El saldo no puede quedar negativo' };
    setup();
    fireEvent.change(screen.getByLabelText(/^Unidades a sumar/), { target: { value: '0' } });
    save();

    expect(screen.getByText('La diferencia no puede ser 0')).toBeInTheDocument();
    expect(screen.getByText('El saldo no puede quedar negativo')).toBeInTheDocument();
    expect(hooks.mutate).not.toHaveBeenCalled();
  });
});
