import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BillingSettingsPage from '@/app/(dashboard)/admin/billing/settings/page';
import { useAuthStore } from '@/store/authStore';
import { UserRole, type User } from '@/types';

const api = vi.hoisted(() => ({ issuer: vi.fn(), list: vi.fn() }));
vi.mock('@/lib/api/invoicing-api', () => ({ invoicingApi: { issuer: api.issuer, list: api.list } }));
vi.mock('@/hooks/usePermissions', () => ({ useMyPermissions: () => ({ can: () => true }) }));
vi.mock('@/hooks/useBranches', () => ({ useBranches: () => ({ data: [] }) }));
vi.mock('@/lib/api/endpoints', () => ({ billingApi: { listInvoices: vi.fn() } }));
vi.mock('@/hooks/useSpecialties', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/useSpecialties')>()),
  useTenantModules: () => ({
    data: [
      'core.agenda', 'core.agenda.calendar', 'core.agenda.tasks', 'core.agenda.notifications',
      'core.patients', 'core.patients.records', 'core.patients.team', 'core.patients.files',
      'core.clinical', 'core.clinical.notes', 'core.clinical.nextSession',
      'core.clinical.timeline', 'core.clinical.specialties', 'core.clinical.forms',
      'core.clinical.templates', 'core.treatments', 'core.treatments.catalog',
      'core.treatments.sessions', 'core.treatments.consents', 'core.billing',
      'core.billing.profiles', 'core.billing.orders', 'core.billing.cash',
      'core.billing.invoicing', 'core.admin', 'core.admin.team', 'core.admin.branches',
      'core.admin.reports',
    ].map((moduleKey) => ({ moduleKey, enabled: true })),
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

function renderPage(role: UserRole) {
  useAuthStore.setState({ user: { id: 'user-1', role, tenantId: 'tenant-1' } as User });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><BillingSettingsPage /></QueryClientProvider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  api.issuer.mockResolvedValue(null);
  api.list.mockResolvedValue({ items: [], total: 0 });
});

describe('Billing settings page', () => {
  it('gives the account holder the SRI issuer settings', async () => {
    renderPage(UserRole.MASTER);
    expect(screen.getByRole('heading', { name: /Configuración de facturación/ })).toBeInTheDocument();
    expect(await screen.findByLabelText('RUC')).toHaveValue('');
    expect(api.issuer).toHaveBeenCalled();
    expect(screen.queryByText(/Faktur/)).not.toBeInTheDocument();
  });

  it.each([UserRole.ASISTENTE, UserRole.PROFESIONAL, UserRole.CAJERO])(
    'is restricted for %s, who may see invoices but not configure them',
    (role) => {
      renderPage(role);
      expect(screen.getByText('Acceso restringido')).toBeInTheDocument();
      expect(screen.queryByLabelText('RUC')).not.toBeInTheDocument();
      expect(api.issuer).not.toHaveBeenCalled();
    },
  );
});
