import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminSettingsPage from '@/app/(dashboard)/admin/settings/page';
import { useAuthStore } from '@/store/authStore';
import { UserRole, type User } from '@/types';

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }));
vi.mock('@/lib/api/client', () => ({ apiClient: http }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock('@/features/admin/branches/branches-manager', () => ({ BranchesManager: () => null }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// Settings as the API returns them.
const storedSettings = {
  legalName: 'Clínica Integral S.A.',
  taxIdentificationType: 'RUC',
  taxIdentificationNumber: '1790012345001',
  workingHoursStart: '09:00',
  workingHoursEnd: '18:00',
  workingDays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
  defaultAppointmentDuration: 60,
  reminderRules: ['24h'],
  reminderEnabled: true,
  timezone: 'America/Bogota',
  locale: 'es',
};

function renderPage() {
  useAuthStore.setState({
    user: { id: 'user-1', role: UserRole.MASTER, tenantId: 'tenant-1' } as User,
    tenant: { id: 'tenant-1' } as ReturnType<typeof useAuthStore.getState>['tenant'],
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}><AdminSettingsPage /></QueryClientProvider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  http.get.mockResolvedValue(storedSettings);
  http.patch.mockImplementation(async (_url: string, body: unknown) => body);
});

describe('clinic settings without Faktur', () => {
  it('shows no Faktur connection fields', async () => {
    renderPage();

    expect(await screen.findByDisplayValue('Clínica Integral S.A.')).toBeInTheDocument();
    expect(screen.queryByText(/Faktur/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText('API key')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Establecimiento')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Punto de emisión')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Activar facturación electrónica')).not.toBeInTheDocument();
  });

  it('saves without sending any faktur field', async () => {
    renderPage();

    fireEvent.change(await screen.findByDisplayValue('Clínica Integral S.A.'), { target: { value: 'Clínica Nueva' } });
    fireEvent.click(screen.getByRole('button', { name: /Guardar Cambios/ }));

    await waitFor(() => expect(http.patch).toHaveBeenCalledTimes(1));
    const body = http.patch.mock.calls[0][1];
    expect(body).toMatchObject({ legalName: 'Clínica Nueva' });
    expect(Object.keys(body).filter((key) => key.startsWith('faktur'))).toEqual([]);
  });
});
