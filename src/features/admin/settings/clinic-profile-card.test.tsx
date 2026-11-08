import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/store/authStore';
import { UserRole, type Tenant, type User } from '@/types';
import { ClinicProfileCard } from './clinic-profile-card';

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }));
vi.mock('@/lib/api/client', () => ({ apiClient: http }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const storedTenant = {
  id: 'tenant-1',
  name: 'Consultorio Bienestar',
  email: 'contacto@bienestar.ec',
  phone: '+593 2 123 4567',
  address: null,
  settings: null,
  subscription: { status: 'ACTIVE', plan: { id: 'plan-1', code: 'CLINIC_BASIC', name: 'Clínica' } },
};

function renderCard() {
  useAuthStore.setState({
    user: { id: 'user-1', role: UserRole.MASTER, tenantId: 'tenant-1' } as User,
    tenant: { id: 'tenant-1', name: 'Consultorio Bienestar', email: 'contacto@bienestar.ec' } as Tenant,
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ClinicProfileCard />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  http.get.mockResolvedValue(storedTenant);
  http.patch.mockImplementation(async (_url: string, body: Record<string, unknown>) => ({ ...storedTenant, ...body }));
});

describe('ClinicProfileCard', () => {
  it('shows the clinic data and keeps saving off until something changes', async () => {
    renderCard();

    expect(await screen.findByLabelText(/Nombre del consultorio/)).toHaveValue('Consultorio Bienestar');
    expect(screen.getByLabelText(/Correo de contacto/)).toHaveValue('contacto@bienestar.ec');
    expect(screen.getByLabelText('Teléfono')).toHaveValue('+593 2 123 4567');
    expect(screen.getByLabelText('Dirección')).toHaveValue('');
    expect(http.get).toHaveBeenCalledWith('/tenants/tenant-1');
    expect(screen.getByRole('button', { name: 'Guardar datos' })).toBeDisabled();
  });

  it('saves the edited data to its own clinic and updates the name the app shows', async () => {
    renderCard();

    fireEvent.change(await screen.findByLabelText(/Nombre del consultorio/), {
      target: { value: '  Centro Bienestar  ' },
    });
    fireEvent.change(screen.getByLabelText('Dirección'), { target: { value: 'Av. Amazonas 100' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar datos' }));

    await waitFor(() => expect(http.patch).toHaveBeenCalledTimes(1));
    expect(http.patch).toHaveBeenCalledWith('/tenants/tenant-1', {
      name: 'Centro Bienestar',
      email: 'contacto@bienestar.ec',
      phone: '+593 2 123 4567',
      address: 'Av. Amazonas 100',
    });
    await waitFor(() => expect(useAuthStore.getState().tenant?.name).toBe('Centro Bienestar'));
    expect(useAuthStore.getState().tenant?.address).toBe('Av. Amazonas 100');
  });

  it('does not send a blank name or an invalid email', async () => {
    renderCard();

    fireEvent.change(await screen.findByLabelText(/Nombre del consultorio/), { target: { value: '   ' } });
    fireEvent.change(screen.getByLabelText(/Correo de contacto/), { target: { value: 'no-es-correo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar datos' }));

    expect(await screen.findByText('Ingresa el nombre del consultorio')).toBeInTheDocument();
    expect(screen.getByText('Email inválido')).toBeInTheDocument();
    expect(http.patch).not.toHaveBeenCalled();
  });

  it('locks the fields while saving so no edit is typed and then overwritten', async () => {
    let finish: (value: unknown) => void = () => {};
    http.patch.mockImplementation(
      (_url: string, body: Record<string, unknown>) =>
        new Promise((resolve) => {
          finish = () => resolve({ ...storedTenant, ...body });
        }),
    );
    renderCard();

    fireEvent.change(await screen.findByLabelText('Teléfono'), { target: { value: '0999999999' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar datos' }));

    await waitFor(() => expect(screen.getByLabelText('Dirección')).toBeDisabled());
    expect(screen.getByLabelText(/Nombre del consultorio/)).toBeDisabled();

    finish(undefined);

    await waitFor(() => expect(screen.getByLabelText('Dirección')).toBeEnabled());
    expect(screen.getByLabelText('Teléfono')).toHaveValue('0999999999');
  });

  it('reports a failed save and keeps the edits', async () => {
    http.patch.mockRejectedValue({ message: 'No tienes permiso para esta acción' });
    renderCard();

    fireEvent.change(await screen.findByLabelText('Teléfono'), { target: { value: '0999999999' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar datos' }));

    expect(await screen.findByText('No tienes permiso para esta acción')).toBeInTheDocument();
    expect(screen.getByLabelText('Teléfono')).toHaveValue('0999999999');
    expect(useAuthStore.getState().tenant?.phone).toBeUndefined();
  });
});
