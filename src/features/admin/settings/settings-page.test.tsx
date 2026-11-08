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
vi.mock('@/features/admin/settings/clinic-profile-card', () => ({ ClinicProfileCard: () => null }));
vi.mock('@/hooks/useSections', () => ({ useSections: () => ({ isEnabled: () => true }) }));
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

// The selector first renders with its default and takes the stored timezone in an effect.
async function waitForStoredSettings() {
  const timezone = await screen.findByRole('combobox', { name: 'Zona horaria' });
  await waitFor(() => expect(timezone).toHaveValue('America/Bogota'));
}

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

describe('clinic settings', () => {
  it('holds no electronic invoicing data: it lives in Billing > Settings', async () => {
    renderPage();

    await waitForStoredSettings();
    expect(screen.queryByText('Facturación electrónica')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Razón social')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Número de identificación')).not.toBeInTheDocument();
    expect(screen.queryByText(/Faktur/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText('API key')).not.toBeInTheDocument();
  });

  it('saves without sending any billing or faktur field', async () => {
    renderPage();

    await waitForStoredSettings();
    fireEvent.click(screen.getByRole('button', { name: '45 min' }));
    fireEvent.click(screen.getByRole('button', { name: /Guardar Cambios/ }));

    await waitFor(() => expect(http.patch).toHaveBeenCalledTimes(1));
    const body = http.patch.mock.calls[0][1];
    for (const key of ['legalName', 'taxIdentificationType', 'taxIdentificationNumber']) {
      // undefined is dropped from the JSON body, so the API never receives the key.
      expect(body[key]).toBeUndefined();
    }
    expect(Object.keys(body).filter((key) => key.startsWith('faktur'))).toEqual([]);
  });
});
