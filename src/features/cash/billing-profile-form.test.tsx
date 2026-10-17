import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BillingProfileForm } from './billing-profile-form';

const hooks = vi.hoisted(() => ({
  create: vi.fn(),
  link: vi.fn(),
}));

vi.mock('@/hooks/useBillingProfiles', () => ({
  useCreateBillingProfile: () => ({ mutateAsync: hooks.create, isPending: false }),
  useLinkBillingProfile: () => ({ mutateAsync: hooks.link, isPending: false }),
}));

const created = { id: 'bp-1', legalName: 'Ana Paz' };

function fill(idNumber: string) {
  fireEvent.change(screen.getByLabelText(/Identificación/), { target: { value: idNumber } });
  fireEvent.change(screen.getByLabelText(/Nombre o razón social/), { target: { value: 'Ana Paz' } });
  fireEvent.change(screen.getByLabelText(/Correo/), { target: { value: 'ana@example.com' } });
}

beforeEach(() => {
  vi.clearAllMocks();
  hooks.create.mockResolvedValue(created);
  hooks.link.mockResolvedValue({});
});

describe('BillingProfileForm', () => {
  it('shows the cedula error and does not submit', async () => {
    const onCreated = vi.fn();
    render(<BillingProfileForm onCreated={onCreated} onCancel={vi.fn()} />);

    fill('1710034066');
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Guardar' })));

    expect(screen.getByText('La cédula no es válida')).toBeInTheDocument();
    expect(hooks.create).not.toHaveBeenCalled();
    expect(onCreated).not.toHaveBeenCalled();
  });

  it('sends the normalized profile and reports the created one', async () => {
    const onCreated = vi.fn();
    render(<BillingProfileForm onCreated={onCreated} onCancel={vi.fn()} />);

    fill(' 1710034065 ');
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Guardar' })));

    expect(hooks.create).toHaveBeenCalledWith({
      kind: 'PERSON',
      idType: '05',
      idNumber: '1710034065',
      legalName: 'Ana Paz',
      email: 'ana@example.com',
    });
    expect(onCreated).toHaveBeenCalledWith(created);
  });

  it('shows the server conflict as it comes and keeps the form', async () => {
    hooks.create.mockRejectedValue({ status: 409, message: 'Ya existe un receptor con esa identificación' });
    const onCreated = vi.fn();
    render(<BillingProfileForm onCreated={onCreated} onCancel={vi.fn()} />);

    fill('1710034065');
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Guardar' })));

    expect(screen.getByText('Ya existe un receptor con esa identificación')).toBeInTheDocument();
    expect(screen.getByLabelText(/Identificación/)).toHaveValue('1710034065');
    expect(onCreated).not.toHaveBeenCalled();
  });

  it('links the profile to the patient when the box is ticked', async () => {
    const onCreated = vi.fn();
    render(
      <BillingProfileForm
        onCreated={onCreated}
        onCancel={vi.fn()}
        linkToPatient={{ id: 'p-1', name: 'Ana Paz' }}
      />,
    );

    fill('1710034065');
    fireEvent.click(screen.getByLabelText('Vincular a Ana Paz'));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Guardar' })));

    expect(hooks.link).toHaveBeenCalledWith({ billingProfileId: 'bp-1' });
    expect(onCreated).toHaveBeenCalledWith(created);
  });
});
