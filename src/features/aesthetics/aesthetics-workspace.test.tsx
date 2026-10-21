import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/store/authStore';
import { TenantBusinessKind, UserRole } from '@/types';
import { AestheticsWorkspace } from './aesthetics-workspace';

const api = vi.hoisted(() => ({
  clients: vi.fn(), createClient: vi.fn(), updateClient: vi.fn(),
  services: vi.fn(), createService: vi.fn(), updateService: vi.fn(),
  bookings: vi.fn(), createBooking: vi.fn(), updateBooking: vi.fn(),
  sessions: vi.fn(), createSession: vi.fn(), completeSession: vi.fn(),
  consents: vi.fn(), recordConsent: vi.fn(),
  photos: vi.fn(), uploadPhoto: vi.fn(), downloadPhoto: vi.fn(), removePhoto: vi.fn(),
}));

vi.mock('@/lib/api/aesthetics-api', () => ({ aestheticsApi: api }));
vi.mock('@/lib/api/endpoints', () => ({
  usersApi: { list: vi.fn().mockResolvedValue([]) },
  extractArray: (value: unknown) => value,
}));
vi.mock('@/hooks/usePermissions', () => ({ useMyPermissions: () => ({ can: () => true }) }));

const client = { id: 'client-1', firstName: 'Lucía', lastName: 'Mora', isActive: true, email: null, phone: null };
const service = { id: 'service-1', name: 'Facial', consentText: 'Acepto el tratamiento.', durationMinutes: 60, price: 40, isActive: true };
const session = {
  id: 'session-1', clientId: client.id, serviceId: service.id, staffId: 'staff-1',
  startedAt: '2026-10-19T10:00:00Z', completedAt: null, notes: null,
  client, service, staff: { id: 'staff-1', firstName: 'Ana', lastName: 'Paz' },
  consent: null,
};

function renderWorkspace() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><AestheticsWorkspace /></QueryClientProvider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({
    tenant: { id: 'studio-1', name: 'Estudio Luna', businessKind: TenantBusinessKind.AESTHETIC_STUDIO } as never,
    user: { id: 'master-1', role: UserRole.MASTER, tenantId: 'studio-1' } as never,
  });
  api.clients.mockResolvedValue([]);
  api.services.mockResolvedValue([]);
  api.bookings.mockResolvedValue([]);
  api.sessions.mockResolvedValue([]);
  api.consents.mockResolvedValue([]);
  api.photos.mockResolvedValue([]);
  api.createClient.mockResolvedValue(client);
  api.recordConsent.mockResolvedValue({ id: 'consent-1' });
  api.uploadPhoto.mockResolvedValue({ id: 'photo-1' });
});

describe('AestheticsWorkspace', () => {
  it('registers a client without sending blank optional contact fields', async () => {
    renderWorkspace();
    await screen.findByText('Clientes (0)');
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Lucía' } });
    fireEvent.change(screen.getByLabelText('Apellido'), { target: { value: 'Mora' } });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar' }));
    await waitFor(() => expect(api.createClient).toHaveBeenCalledWith('studio-1', { firstName: 'Lucía', lastName: 'Mora' }));
  });

  it('requires an explicit consent confirmation and sends photos to the chosen session', async () => {
    api.clients.mockResolvedValue([client]);
    api.services.mockResolvedValue([service]);
    api.sessions.mockResolvedValue([session]);
    renderWorkspace();
    await screen.findByText('Clientes (1)');

    fireEvent.click(screen.getByRole('button', { name: 'Consentimientos' }));
    await screen.findByRole('option', { name: /Lucía Mora · Facial/ });
    fireEvent.change(screen.getByLabelText('Sesión'), { target: { value: session.id } });
    expect(screen.getByText('Acepto el tratamiento.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Nombre de quien acepta'), { target: { value: 'Lucía Mora' } });
    const register = screen.getByRole('button', { name: 'Registrar' });
    expect(register).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(register);
    await waitFor(() => expect(api.recordConsent).toHaveBeenCalledWith('studio-1', session.id, 'Lucía Mora', 'Acepto el tratamiento.'));

    fireEvent.click(screen.getByRole('button', { name: 'Fotos' }));
    fireEvent.change(screen.getAllByLabelText('Sesión')[0], { target: { value: session.id } });
    expect(screen.getAllByLabelText('Sesión')[0]).toHaveValue(session.id);
    const photo = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'before.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByLabelText('Foto JPG o PNG'), { target: { files: [photo] } });
    expect((screen.getByLabelText('Foto JPG o PNG') as HTMLInputElement).files?.[0]).toBe(photo);
    const upload = screen.getByRole('button', { name: 'Subir foto' });
    await waitFor(() => expect(upload).toBeEnabled());
    fireEvent.submit(upload.closest('form')!);
    await waitFor(() => expect(api.uploadPhoto).toHaveBeenCalledWith('studio-1', session.id, 'BEFORE', photo));
  });
});
