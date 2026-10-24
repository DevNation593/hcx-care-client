import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/store/authStore';
import { TenantType, UserRole, type Tenant, type User } from '@/types';
import SpecialtiesPage from './specialties/page';
import StorageManagementPage from './storage/page';
import SubscriptionPage from './subscription/page';
import TeamPage from './team/page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/admin',
  useSearchParams: () => new URLSearchParams(),
}));

const sections = vi.hoisted(() => ({ rows: [] as { moduleKey: string; enabled: boolean }[] }));
vi.mock('@/hooks/useSpecialties', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/useSpecialties')>()),
  useTenantModules: () => ({ data: sections.rows, isPending: false, isError: false, refetch: vi.fn() }),
}));

const professional = {
  id: 'user-1',
  email: 'pro@example.com',
  firstName: 'Ana',
  lastName: 'Vega',
  role: UserRole.PROFESIONAL,
  tenantId: 'tenant-a',
} as User;

function renderPage(Page: () => JSX.Element | null) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <Page />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  sections.rows = [];
  useAuthStore.setState({
    user: professional,
    tenant: { id: 'tenant-a', name: 'tenant-a', tenantType: TenantType.CLINIC } as Tenant,
  });
});

describe('administration pages opened by URL', () => {
  it.each([
    ['team', TeamPage],
    ['subscription', SubscriptionPage],
    ['storage', StorageManagementPage],
    ['specialties', SpecialtiesPage],
  ] as const)('%s shows the restricted notice to a professional', (_name, Page) => {
    renderPage(Page);
    expect(screen.getByText('Acceso restringido')).toBeInTheDocument();
  });

  it.each([UserRole.ASISTENTE, UserRole.ADMIN])('team is restricted for %s', (role) => {
    useAuthStore.setState({ user: { ...professional, role } });
    renderPage(TeamPage);
    expect(screen.getByText('Acceso restringido')).toBeInTheDocument();
  });
});

describe('administration pages with the section off', () => {
  it.each([
    ['team', TeamPage, 'core.admin.team'],
    ['storage', StorageManagementPage, 'core.patients.files'],
    ['specialties', SpecialtiesPage, 'core.clinical.specialties'],
  ] as const)('%s tells the account holder the section is not available', (_name, Page, key) => {
    useAuthStore.setState({ user: { ...professional, role: UserRole.MASTER } });
    sections.rows = [{ moduleKey: key, enabled: false }];
    renderPage(Page);
    expect(screen.getByText('Sección no disponible')).toBeInTheDocument();
    expect(screen.queryByText('Acceso restringido')).not.toBeInTheDocument();
  });
});
