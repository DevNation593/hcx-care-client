import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tenantModulesApi } from '@/lib/api/endpoints';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { TenantType, UserRole, type Tenant, type TenantModule, type User } from '@/types';
import { Sidebar } from './sidebar';

const api = vi.hoisted(() => ({ listModules: vi.fn(), legacyListModules: vi.fn() }));

const route = vi.hoisted(() => ({ pathname: '/dashboard' }));
vi.mock('next/navigation', () => ({ usePathname: () => route.pathname }));
const permissions = vi.hoisted(() => ({ withdrawn: [] as string[], granted: [] as string[] }));
vi.mock('@/hooks/usePermissions', () => ({
  useMyPermissions: () => ({
    // As the hook: a granted permission is held whatever the role; otherwise the role decides
    // unless the permission was withdrawn.
    can: (permission: string, byRole = true) =>
      permissions.granted.includes(permission) ||
      (byRole && !permissions.withdrawn.includes(permission)),
  }),
}));
vi.mock('@/lib/api/endpoints', () => ({
  specialtyCatalogApi: { list: vi.fn() },
  tenantSpecialtiesApi: { list: vi.fn(), replace: vi.fn() },
  tenantModulesApi: { list: api.listModules, setEnabled: vi.fn() },
  specialtiesApi: { modules: api.legacyListModules },
}));

const SECTION_KEYS = [
  'core.agenda', 'core.agenda.calendar', 'core.agenda.tasks', 'core.agenda.notifications',
  'core.patients', 'core.patients.records', 'core.patients.team', 'core.patients.files',
  'core.clinical', 'core.clinical.notes', 'core.clinical.nextSession', 'core.clinical.timeline',
  'core.clinical.specialties', 'core.clinical.forms', 'core.clinical.templates', 'core.treatments',
  'core.treatments.catalog', 'core.treatments.sessions', 'core.treatments.consents',
  'core.billing', 'core.billing.profiles', 'core.billing.orders', 'core.billing.cash',
  'core.billing.invoicing', 'core.admin', 'core.admin.team', 'core.admin.branches',
  'core.admin.reports',
] as const;

function sectionRows(disabled: string[] = []): TenantModule[] {
  return SECTION_KEYS.map((moduleKey) => ({
    id: `${moduleKey}-a`,
    tenantId: 'tenant-a',
    moduleKey,
    enabled: !disabled.includes(moduleKey),
  }));
}

const teamModule = sectionRows()[6];

const admin = {
  id: 'admin-1',
  email: 'admin@example.com',
  firstName: 'Ana',
  lastName: 'Vega',
  role: UserRole.MASTER,
  tenantId: 'tenant-a',
} as User;

function clinicTenant(id: string): Tenant {
  return { id, name: id, tenantType: TenantType.CLINIC } as Tenant;
}

function renderSidebar() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <Sidebar />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(tenantModulesApi.list).mockImplementation(async () =>
    useAuthStore.getState().tenant?.id === 'tenant-a' ? sectionRows() : [],
  );
  api.legacyListModules.mockResolvedValue([teamModule]);
  useAuthStore.setState({ user: admin, tenant: clinicTenant('tenant-a') });
  useUIStore.setState({ sidebarCollapsed: false });
  route.pathname = '/dashboard';
});

describe('Sidebar modules and submodules', () => {
  const linksIn = (module: string) =>
    within(screen.getByRole('group', { name: module }))
      .getAllByRole('link')
      .map((link) => link.textContent);

  it('groups the entries of the account holder into modules with their submodules', async () => {
    renderSidebar();
    await screen.findByRole('link', { name: 'Equipo' });

    expect(linksIn('Agenda')).toEqual(['Calendario', 'Actividades']);
    expect(linksIn('Clínica')).toEqual(['Módulos clínicos', 'Formularios', 'Tratamientos', 'Consentimientos']);
    expect(linksIn('Administración')).toEqual([
      'Equipo',
      'Reportes',
      'Suscripción',
      'Almacenamiento',
      'Configuración',
    ]);
    // Modules with a single screen stay as a direct entry.
    for (const name of ['Dashboard', 'Pacientes', 'Facturación']) {
      expect(screen.getByRole('link', { name }).closest('[role="group"]')).toBeNull();
    }
  });

  it('has no aesthetics screen, even if a clinic kept the retired section row', async () => {
    vi.mocked(tenantModulesApi.list).mockResolvedValue([
      ...sectionRows(),
      { id: 'aes', tenantId: 'tenant-a', moduleKey: 'core.aesthetics', enabled: true },
    ] as TenantModule[]);
    renderSidebar();
    await screen.findByRole('link', { name: 'Equipo' });

    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Estética' })).toBeNull();
    expect(
      screen.getAllByRole('link').some((link) => link.getAttribute('href') === '/aesthetics'),
    ).toBe(false);
  });

  it('collapses and expands the submodules of a module', async () => {
    renderSidebar();
    const agenda = await screen.findByRole('button', { name: 'Agenda' });
    expect(agenda).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(agenda);
    expect(agenda).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('link', { name: 'Calendario' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Equipo' })).toBeInTheDocument();

    fireEvent.click(agenda);
    expect(screen.getByRole('link', { name: 'Calendario' })).toBeInTheDocument();
  });

  it('marks a collapsed module that holds the current page', async () => {
    route.pathname = '/calendar';
    renderSidebar();
    const agenda = await screen.findByRole('button', { name: 'Agenda' });
    const clinic = screen.getByRole('button', { name: 'Clínica' });

    fireEvent.click(agenda);
    fireEvent.click(clinic);

    expect(agenda).toHaveClass('bg-primary/10');
    expect(clinic).not.toHaveClass('bg-primary/10');
  });

  it('leaves out a module when none of its submodules is available', async () => {
    useAuthStore.setState({ user: { ...admin, role: UserRole.PROFESIONAL } });
    renderSidebar();
    await screen.findByRole('link', { name: 'Pacientes' });

    expect(linksIn('Agenda')).toEqual(['Calendario', 'Actividades']);
    expect(screen.queryByRole('button', { name: 'Clínica' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Administración' })).not.toBeInTheDocument();
  });

  it('keeps a module with the submodules that remain when a section is off', async () => {
    vi.mocked(tenantModulesApi.list).mockResolvedValue(sectionRows(['core.agenda.tasks']));
    renderSidebar();
    await screen.findByRole('link', { name: 'Equipo' });

    expect(linksIn('Agenda')).toEqual(['Calendario']);
  });

  it('shows every entry as an icon, without module headers, when the sidebar is collapsed', async () => {
    useUIStore.setState({ sidebarCollapsed: true });
    renderSidebar();

    expect(await screen.findByRole('link', { name: 'Calendario' })).toHaveAttribute('href', '/calendar');
    expect(screen.getByRole('link', { name: 'Configuración' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Agenda' })).not.toBeInTheDocument();
  });
});

describe('Sidebar clinical modules entry', () => {
  it.each([UserRole.MASTER])('is shown to %s', async (role) => {
    useAuthStore.setState({ user: { ...admin, role } });
    renderSidebar();
    expect(await screen.findByRole('link', { name: 'Módulos clínicos' })).toHaveAttribute('href', '/admin/specialties');
  });

  it.each([UserRole.ASISTENTE, UserRole.PROFESIONAL, UserRole.ADMIN, UserRole.SOPORTE])('is hidden from %s', async (role) => {
    useAuthStore.setState({ user: { ...admin, role } });
    renderSidebar();
    expect(await screen.findByRole('link', { name: 'Pacientes' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Módulos clínicos' })).not.toBeInTheDocument();
  });
});

describe('Sidebar forms entry', () => {
  it('takes the account holder to the form builder', async () => {
    renderSidebar();
    expect(await screen.findByRole('link', { name: 'Formularios' })).toHaveAttribute('href', '/admin/forms');
  });

  it.each([UserRole.ASISTENTE, UserRole.PROFESIONAL, UserRole.ADMIN])('is hidden from %s', async (role) => {
    useAuthStore.setState({ user: { ...admin, role } });
    renderSidebar();
    expect(await screen.findByRole('link', { name: 'Pacientes' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Formularios' })).not.toBeInTheDocument();
  });
});

describe('Sidebar billing entry', () => {
  it('is hidden from assistants, who cannot issue invoices', async () => {
    useAuthStore.setState({ user: { ...admin, role: UserRole.ASISTENTE } });
    renderSidebar();
    expect(await screen.findByRole('link', { name: 'Pacientes' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Facturación' })).not.toBeInTheDocument();
  });

  it('is shown to the account holder', async () => {
    renderSidebar();
    expect(await screen.findByRole('link', { name: 'Facturación' })).toBeInTheDocument();
  });

  it('is shown to a professional only when billing.view was given to them', async () => {
    useAuthStore.setState({ user: { ...admin, role: UserRole.PROFESIONAL } });
    permissions.granted = ['billing.view'];
    renderSidebar();
    expect(await screen.findByRole('link', { name: 'Facturación' })).toBeInTheDocument();
    permissions.granted = [];
  });
});

describe('Sidebar cash entry', () => {
  it('is shown to an assistant with billing.view and hidden with cash.manage alone', async () => {
    useAuthStore.setState({ user: { ...admin, role: UserRole.ASISTENTE } });
    const { unmount } = renderSidebar();
    expect(await screen.findByRole('link', { name: 'Pacientes' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Caja' })).not.toBeInTheDocument();
    unmount();

    permissions.granted = ['cash.manage'];
    const second = renderSidebar();
    expect(await screen.findByRole('link', { name: 'Pacientes' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Caja' })).not.toBeInTheDocument();
    second.unmount();

    permissions.granted = ['billing.view'];
    renderSidebar();
    expect(await screen.findByRole('link', { name: 'Caja' })).toHaveAttribute('href', '/cash');
    permissions.granted = [];
  });

  it('is hidden when the billing section is off', async () => {
    vi.mocked(tenantModulesApi.list).mockResolvedValue(sectionRows(['core.billing']));
    renderSidebar();
    expect(await screen.findByRole('link', { name: 'Equipo' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Caja' })).not.toBeInTheDocument();
  });
});

describe('Sidebar tenant module visibility', () => {
  it('drops tenant A module access after switching to tenant B', async () => {
    renderSidebar();

    expect(await screen.findByRole('link', { name: 'Equipo' })).toBeInTheDocument();

    act(() => useAuthStore.setState({ tenant: { ...clinicTenant('tenant-b'), tenantType: undefined } }));

    await waitFor(() => expect(tenantModulesApi.list).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Equipo' })).not.toBeInTheDocument());
  });
});

describe('Sidebar administration section', () => {
  const adminLinks = ['Equipo', 'Suscripción', 'Almacenamiento', 'Configuración'];

  it('shows every administration entry to the account holder', async () => {
    renderSidebar();
    for (const name of adminLinks) {
      expect(await screen.findByRole('link', { name })).toBeInTheDocument();
    }
  });

  it.each([UserRole.PROFESIONAL, UserRole.ASISTENTE, UserRole.ADMIN])(
    'hides the whole section from %s',
    async (role) => {
      useAuthStore.setState({ user: { ...admin, role } });
      renderSidebar();
      expect(await screen.findByRole('link', { name: 'Pacientes' })).toBeInTheDocument();
      for (const name of [...adminLinks, 'Módulos clínicos']) {
        expect(screen.queryByRole('link', { name })).not.toBeInTheDocument();
      }
      expect(screen.queryByText('Administración')).not.toBeInTheDocument();
    },
  );

  it('hides billing from a user whose permission to see invoices was withdrawn', async () => {
    permissions.withdrawn = ['billing.view'];
    useAuthStore.setState({ user: { ...admin, role: UserRole.PROFESIONAL } });
    renderSidebar();
    expect(await screen.findByRole('link', { name: 'Pacientes' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Facturación' })).not.toBeInTheDocument();
    permissions.withdrawn = [];
  });

  it('shows billing to an assistant only when the permission was given to them', async () => {
    useAuthStore.setState({ user: { ...admin, role: UserRole.ASISTENTE } });
    const { unmount } = renderSidebar();
    expect(await screen.findByRole('link', { name: 'Pacientes' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Facturación' })).not.toBeInTheDocument();
    unmount();

    permissions.granted = ['billing.view'];
    renderSidebar();
    expect(await screen.findByRole('link', { name: 'Facturación' })).toBeInTheDocument();
    permissions.granted = [];
  });

  it('shows treatments and consents to who holds treatments.manage, and to nobody else without it', async () => {
    useAuthStore.setState({ user: { ...admin, role: UserRole.ASISTENTE } });
    const { unmount } = renderSidebar();
    expect(await screen.findByRole('link', { name: 'Pacientes' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Tratamientos' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Consentimientos' })).not.toBeInTheDocument();
    unmount();

    permissions.granted = ['treatments.manage'];
    renderSidebar();
    expect(await screen.findByRole('link', { name: 'Tratamientos' })).toHaveAttribute('href', '/admin/treatments');
    expect(screen.getByRole('link', { name: 'Consentimientos' })).toHaveAttribute('href', '/admin/consents');
    permissions.granted = [];
  });

  // ADMIN is reserved: it is neither the account holder nor a professional.
  it('hides billing from ADMIN', async () => {
    useAuthStore.setState({ user: { ...admin, role: UserRole.ADMIN } });
    renderSidebar();
    expect(await screen.findByRole('link', { name: 'Pacientes' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Facturación' })).not.toBeInTheDocument();
  });
});

describe('Sidebar section visibility', () => {
  it.each([
    ['Calendario', 'core.agenda.calendar'],
    ['Pacientes', 'core.patients.records'],
    ['Actividades', 'core.agenda.tasks'],
    ['Módulos clínicos', 'core.clinical.specialties'],
    ['Formularios', 'core.clinical.forms'],
    ['Tratamientos', 'core.treatments.catalog'],
    ['Consentimientos', 'core.treatments.consents'],
    ['Caja', 'core.billing.cash'],
    ['Facturación', 'core.billing.invoicing'],
    ['Equipo', 'core.admin.team'],
    ['Reportes', 'core.admin.reports'],
    ['Almacenamiento', 'core.patients.files'],
    ['Calendario', 'core.agenda'],
  ])('hides %s when %s is off', async (name, key) => {
    vi.mocked(tenantModulesApi.list).mockResolvedValue(sectionRows([key]));
    renderSidebar();
    // Dashboard is always on; Suscripción only shows once the account holder is known, and
    // Configuración is never gated. Wait for an enabled gated entry so the data has landed.
    const landed = name === 'Equipo' || name === 'Almacenamiento' ? 'Módulos clínicos' : 'Equipo';
    expect(await screen.findByRole('link', { name: landed })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Suscripción' })).toBeInTheDocument();
  });

  it('always shows Dashboard, Suscripción and Configuración to the account holder', async () => {
    // Only core.admin.team and its module stay on, so its link proves the rows were applied.
    vi.mocked(tenantModulesApi.list).mockResolvedValue(
      sectionRows(SECTION_KEYS.filter((key) => key !== 'core.admin.team' && key !== 'core.admin')),
    );
    renderSidebar();
    expect(await screen.findByRole('link', { name: 'Equipo' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Pacientes' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Almacenamiento' })).not.toBeInTheDocument();
    for (const name of ['Dashboard', 'Suscripción', 'Configuración']) {
      expect(screen.getByRole('link', { name })).toBeInTheDocument();
    }
  });

  it('shows Equipo to a personal clinic when core.admin.team is on', async () => {
    useAuthStore.setState({ tenant: { ...clinicTenant('tenant-a'), tenantType: TenantType.PERSONAL } });
    renderSidebar();
    expect(await screen.findByRole('link', { name: 'Equipo' })).toBeInTheDocument();
  });

  it('shows no gated entry while the sections are loading', () => {
    vi.mocked(tenantModulesApi.list).mockImplementation(() => new Promise(() => {}));
    renderSidebar();
    expect(screen.queryByRole('link', { name: 'Pacientes' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
  });
});
