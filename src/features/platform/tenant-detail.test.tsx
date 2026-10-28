import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { platformApi } from '@/lib/api/endpoints';
import { QUERY_KEYS } from '@/lib/constants';
import { TenantType, type ApiError, type PlatformPlan, type PlatformTenantDetail, type SectionCatalog } from '@/types';
import { TenantDetail } from './tenant-detail';

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));
vi.mock('@/lib/api/endpoints', () => ({
  platformApi: {
    getTenant: vi.fn(),
    getSectionCatalog: vi.fn(),
    updateTenant: vi.fn(),
    changePlan: vi.fn(),
    setPlanOverrides: vi.fn(),
    listPlans: vi.fn(),
    suspendTenant: vi.fn(),
    reactivateTenant: vi.fn(),
    setSections: vi.fn(),
    getRolePermissions: vi.fn(),
    setRolePermissions: vi.fn(),
    getSpecialtyCatalog: vi.fn(),
    setSpecialties: vi.fn(),
    setClinicalModule: vi.fn(),
    resetMasterPassword: vi.fn(),
  },
}));

const catalog: SectionCatalog = {
  sections: [
    { key: 'core.agenda', name: 'Agenda', requires: [] },
    { key: 'core.patients', name: 'Pacientes', requires: [] },
    { key: 'core.admin', name: 'Actividades', requires: ['core.patients'] },
    { key: 'core.billing', name: 'Facturación', requires: [] },
  ],
  nonHealthSpecialtyCodes: ['AESTHETICS'],
};

const plan = (overrides: Partial<PlatformPlan>): PlatformPlan => ({
  id: 'plan_clinic_basic',
  code: 'CLINIC_BASIC',
  name: 'Clínica Básico',
  description: null,
  tenantType: TenantType.CLINIC,
  sortOrder: 30,
  archivedAt: null,
  basePrice: 99,
  pricePerSeat: 15,
  specialtyPrice: 15,
  currency: 'USD',
  seatsIncluded: 3,
  maxActivePatients: 150,
  storageGB: 10,
  monthlyElectronicInvoicesLimit: 50,
  includedSpecialties: 2,
  maxBranches: 50,
  trialDays: 14,
  modules: ['core.agenda', 'core.patients', 'core.admin', 'core.billing'],
  clinicsCount: 1,
  ...overrides,
});

const plans: PlatformPlan[] = [
  plan({}),
  plan({ id: 'plan_clinic_pro', code: 'CLINIC_PRO', name: 'Clínica Pro', basePrice: 199 }),
  plan({ id: 'plan_clinic_old', code: 'CLINIC_OLD', name: 'Clínica Antiguo', archivedAt: '2026-01-01T00:00:00.000Z' }),
  plan({ id: 'plan_personal_basic', code: 'PERSONAL_BASIC', name: 'Personal Básico', tenantType: TenantType.PERSONAL }),
];

const detail: PlatformTenantDetail = {
  tenant: {
    id: 't-1',
    name: 'Clínica Sol',
    email: 'info@sol.com',
    phone: '0999999999',
    address: 'Av. Principal 123',
    tenantType: TenantType.CLINIC,
    isActive: true,
    createdAt: '2026-01-10T00:00:00.000Z',
  },
  master: { id: 'u-1', firstName: 'Rosa', lastName: 'Paz', email: 'rosa@sol.com', mustChangePassword: false },
  subscription: {
    plan: { id: 'plan_clinic_basic', code: 'CLINIC_BASIC', name: 'Clínica Básico' },
    status: 'ACTIVE',
    trialEndsAt: null,
    currentPeriodStart: '2026-01-10T00:00:00.000Z',
    currentPeriodEnd: null,
    basePrice: 49,
    pricePerSeat: 15,
    specialtyPrice: 15,
    currency: 'USD',
    seatsPsychologistsMax: 5,
    maxActivePatients: 100,
    storageGB: 40,
    monthlyElectronicInvoicesLimit: 50,
    includedSpecialties: 2,
    maxBranches: 50,
    overriddenFields: ['basePrice', 'seatsPsychologistsMax', 'maxActivePatients', 'storageGB'],
    monthlyTotal: 49,
  },
  usage: { seatsPsychologistsUsed: 3, activePatientsCount: 42, monthlyNotificationsSent: 17 },
  specialties: [{ id: 's1', code: 'PSYCHOLOGY', name: 'Psicología' }],
  modules: [{ key: 'psychology.assessments', enabled: true }],
  sections: [
    { key: 'core.agenda', name: 'Agenda', enabled: true, source: 'PLAN' },
    { key: 'core.patients', name: 'Pacientes', enabled: true, source: 'PLAN' },
    { key: 'core.admin', name: 'Actividades', enabled: false, source: 'OVERRIDE' },
    { key: 'core.billing', name: 'Facturación', enabled: false, source: 'OVERRIDE' },
  ],
};

const suspended: PlatformTenantDetail = { ...detail, tenant: { ...detail.tenant, isActive: false } };

let client: QueryClient;

function renderDetail() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <TenantDetail tenantId="t-1" />
    </QueryClientProvider>,
  );
}

const type = (label: string | RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

const checked = (name: string) => (screen.getByLabelText(name) as HTMLInputElement).checked;

async function ready() {
  await screen.findByRole('heading', { name: 'Clínica Sol' });
  await screen.findByLabelText('Agenda');
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(platformApi.getTenant).mockResolvedValue(detail);
  vi.mocked(platformApi.getSectionCatalog).mockResolvedValue(catalog);
  vi.mocked(platformApi.updateTenant).mockResolvedValue(detail);
  vi.mocked(platformApi.changePlan).mockResolvedValue(detail);
  vi.mocked(platformApi.setPlanOverrides).mockResolvedValue(detail);
  vi.mocked(platformApi.listPlans).mockResolvedValue(plans);
  vi.mocked(platformApi.suspendTenant).mockResolvedValue(suspended);
  vi.mocked(platformApi.reactivateTenant).mockResolvedValue(detail);
  vi.mocked(platformApi.setSections).mockResolvedValue(detail);
  vi.mocked(platformApi.getRolePermissions).mockResolvedValue({
    tenantId: 't-1', role: 'MASTER', effective: ['patients.create', 'billing.view'],
    permissions: [
      { key: 'patients.create', group: 'Pacientes', label: 'Registrar pacientes', allowed: true, source: 'role' },
      { key: 'billing.view', group: 'Facturación', label: 'Ver facturas', allowed: true, source: 'role' },
      { key: 'billing.create', group: 'Facturación', label: 'Emitir facturas', allowed: false, source: 'role' },
    ],
  });
  vi.mocked(platformApi.setRolePermissions).mockResolvedValue({
    tenantId: 't-1', role: 'MASTER', effective: [], permissions: [],
  });
  vi.mocked(platformApi.getSpecialtyCatalog).mockResolvedValue([
    { id: 's1', code: 'PSYCHOLOGY', name: 'Psicología', description: null, modules: [{ id: 'm1', moduleKey: 'psychology.assessments' }] },
    { id: 's2', code: 'NUTRITION', name: 'Nutrición', description: null, modules: [{ id: 'm2', moduleKey: 'nutrition.assessments' }] },
  ]);
  vi.mocked(platformApi.setSpecialties).mockResolvedValue({ tenantId: 't-1', specialties: [], modules: [], pricing: {} } as never);
  vi.mocked(platformApi.setClinicalModule).mockResolvedValue({ id: 'm1', tenantId: 't-1', moduleKey: 'psychology.assessments', enabled: false });
  vi.mocked(platformApi.resetMasterPassword).mockResolvedValue(undefined);
});

describe('TenantDetail', () => {
  it('shows account, master, plan, sections, status and usage', async () => {
    renderDetail();
    await ready();
    expect((screen.getByLabelText('Nombre del consultorio') as HTMLInputElement).value).toBe('Clínica Sol');
    expect((screen.getByLabelText('Correo del consultorio') as HTMLInputElement).value).toBe('info@sol.com');
    expect((screen.getByLabelText('Teléfono') as HTMLInputElement).value).toBe('0999999999');
    expect((screen.getByLabelText('Dirección') as HTMLInputElement).value).toBe('Av. Principal 123');
    expect(screen.getByText('Rosa Paz')).toBeTruthy();
    expect(screen.getByText('rosa@sol.com')).toBeTruthy();
    expect(screen.getByText('Clínica Básico')).toBeTruthy();
    expect(checked('Agenda')).toBe(true);
    expect(checked('Pacientes')).toBe(true);
    expect(checked('Actividades')).toBe(false);
    expect(screen.getByText('Al día')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Suspender' })).toBeTruthy();
    expect(screen.getByText('42 de 100')).toBeTruthy();
    // Four values set apart from the plan, and the modules turned off for this clinic.
    expect(screen.getAllByText('Ajustado')).toHaveLength(4);
    expect(screen.getAllByText('Ajuste')).toHaveLength(2);
  });

  it('saves the account data', async () => {
    renderDetail();
    await ready();
    type('Nombre del consultorio', 'Clínica Luna');
    type('Teléfono', '0988888888');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar datos' }));
    await waitFor(() =>
      expect(platformApi.updateTenant).toHaveBeenCalledWith('t-1', {
        name: 'Clínica Luna',
        email: 'info@sol.com',
        phone: '0988888888',
        address: 'Av. Principal 123',
      }),
    );
  });

  it('requires a reason to change the plan and sends the plan and its trial', async () => {
    renderDetail();
    await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar plan' }));
    await screen.findByRole('option', { name: /Clínica Pro/ });
    type('Plan', 'plan_clinic_pro');
    type('Días de prueba', '30');
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar cambio' }));
    expect(await screen.findByText('Indica el motivo del cambio')).toBeTruthy();
    expect(platformApi.changePlan).not.toHaveBeenCalled();

    type('Motivo del cambio', 'Prueba del plan Pro');
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar cambio' }));
    await waitFor(() =>
      expect(platformApi.changePlan).toHaveBeenCalledWith('t-1', {
        planId: 'plan_clinic_pro',
        trialDays: 30,
        reason: 'Prueba del plan Pro',
      }),
    );
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Cambiar plan' })).toBeNull());
  });

  it('only offers the plans of the clinic type that are not archived', async () => {
    renderDetail();
    await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar plan' }));
    await screen.findByRole('option', { name: /Clínica Pro/ });
    const options = within(screen.getByLabelText('Plan')).getAllByRole('option').map((option) => option.getAttribute('value'));
    expect(options).toEqual(['plan_clinic_basic', 'plan_clinic_pro']);
  });

  it('shows the API message and leaves the plan unchanged when the change is refused', async () => {
    const error: ApiError = {
      status: 409,
      code: 'PLAN_ARCHIVED',
      message: 'El plan está archivado y no se puede asignar.',
    };
    vi.mocked(platformApi.changePlan).mockRejectedValue(error);
    renderDetail();
    await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar plan' }));
    await screen.findByRole('option', { name: /Clínica Pro/ });
    type('Plan', 'plan_clinic_pro');
    type('Motivo del cambio', 'Cambio');
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar cambio' }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain(error.message);
    // The dialog stays open and the card still shows the current plan.
    expect(screen.getByRole('heading', { name: 'Cambiar plan' })).toBeTruthy();
    expect(screen.getAllByText('Clínica Básico').length).toBeGreaterThan(0);
    expect(client.getQueryData(QUERY_KEYS.PLATFORM_TENANT('t-1'))).toEqual(detail);
  });

  it('sets a value for the clinic and puts another back on the plan', async () => {
    renderDetail();
    await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Ajustar valores' }));
    const row = (label: string) => within(screen.getByRole('group', { name: label }));

    // Pacientes activos already has its own value: change it. Almacenamiento goes back to the plan.
    const valueOf = (label: string, value: string) =>
      fireEvent.change(row(label).getByRole('spinbutton'), { target: { value } });
    valueOf('Pacientes activos', '320');
    fireEvent.click(row('Almacenamiento (GB)').getByLabelText('Del plan'));
    // Facturas follows the plan: give it its own value.
    fireEvent.click(row('Facturas electrónicas al mes').getByLabelText('Del plan'));
    valueOf('Facturas electrónicas al mes', '80');
    type('Motivo del ajuste', 'Acuerdo comercial');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar ajustes' }));

    await waitFor(() =>
      expect(platformApi.setPlanOverrides).toHaveBeenCalledWith('t-1', {
        values: { maxActivePatients: 320, monthlyElectronicInvoicesLimit: 80 },
        reset: ['storageGB'],
        reason: 'Acuerdo comercial',
      }),
    );
  });

  it('puts the modules back on the plan', async () => {
    renderDetail();
    await ready();
    fireEvent.click(await screen.findByRole('button', { name: 'Volver al plan' }));
    await waitFor(() =>
      expect(platformApi.setSections).toHaveBeenCalledWith('t-1', [
        'core.agenda',
        'core.patients',
        'core.admin',
        'core.billing',
      ]),
    );
  });

  it('enables Guardar cambios only when the section selection differs and sends the full list', async () => {
    renderDetail();
    await ready();
    const save = screen.getByRole('button', { name: 'Guardar cambios' }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.click(screen.getByLabelText('Actividades'));
    expect(save.disabled).toBe(false);
    fireEvent.click(screen.getByLabelText('Actividades'));
    expect(save.disabled).toBe(true);
    fireEvent.click(screen.getByLabelText('Facturación'));
    expect(save.disabled).toBe(false);
    fireEvent.click(save);
    await waitFor(() =>
      expect(platformApi.setSections).toHaveBeenCalledWith('t-1', ['core.agenda', 'core.patients', 'core.billing']),
    );
  });

  it('saves the selected permissions for MASTER in this clinic', async () => {
    renderDetail();
    await ready();
    expect(await screen.findByRole('heading', { name: 'Permisos por rol' })).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Emitir facturas'));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar permisos del rol' }));
    await waitFor(() => expect(platformApi.setRolePermissions).toHaveBeenCalledWith(
      't-1', 'MASTER', ['patients.create', 'billing.view', 'billing.create'],
    ));
  });

  it('assigns permissions to the selected clinic role', async () => {
    vi.mocked(platformApi.getRolePermissions).mockImplementation(async (_id, role) => ({
      tenantId: 't-1', role, effective: [],
      permissions: [{ key: 'billing.view', group: 'Facturación', label: 'Ver facturas', allowed: false, source: 'grant' }],
    }));
    renderDetail();
    await ready();
    fireEvent.change(screen.getByLabelText('Rol del consultorio'), { target: { value: 'ASISTENTE' } });
    fireEvent.click(await screen.findByLabelText('Ver facturas'));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar permisos del rol' }));
    await waitFor(() => expect(platformApi.setRolePermissions).toHaveBeenCalledWith('t-1', 'ASISTENTE', ['billing.view']));
  });

  it('lists the Cajero role in the per-role permissions card', async () => {
    renderDetail();
    await ready();
    const select = screen.getByLabelText('Rol del consultorio') as HTMLSelectElement;
    expect(Array.from(select.options).map((o) => o.textContent)).toContain('Cajero');
    fireEvent.change(select, { target: { value: 'CAJERO' } });
    await waitFor(() => expect(platformApi.getRolePermissions).toHaveBeenCalledWith('t-1', 'CAJERO'));
  });

  it('lets the owner assign clinical specialties and toggle their modules', async () => {
    renderDetail();
    await ready();
    expect(await screen.findByRole('heading', { name: 'Especialidades y módulos clínicos' })).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Nutrición'));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar especialidades' }));
    await waitFor(() => expect(platformApi.setSpecialties).toHaveBeenCalledWith('t-1', ['PSYCHOLOGY', 'NUTRITION']));
    fireEvent.click(screen.getByLabelText('Evaluaciones psicológicas'));
    await waitFor(() => expect(platformApi.setClinicalModule).toHaveBeenCalledWith('t-1', 'psychology.assessments', false));
  });

  it('shows the estimated monthly price before assigning a billable specialty', async () => {
    vi.mocked(platformApi.getTenant).mockResolvedValue({
      ...detail,
      specialties: [...detail.specialties, { id: 's2', code: 'NUTRITION', name: 'Nutrición' }],
    });
    vi.mocked(platformApi.getSpecialtyCatalog).mockResolvedValue([
      { id: 's1', code: 'PSYCHOLOGY', name: 'Psicología', description: null, modules: [] },
      { id: 's2', code: 'NUTRITION', name: 'Nutrición', description: null, modules: [] },
      { id: 's3', code: 'SPEECH', name: 'Fonoaudiología', description: null, modules: [] },
    ]);
    renderDetail();
    await ready();
    fireEvent.click(await screen.findByLabelText('Fonoaudiología'));
    const price = new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(64);
    expect(screen.getByText(`Total mensual estimado: ${price}`)).toBeTruthy();
    expect(platformApi.setSpecialties).not.toHaveBeenCalled();
  });

  it('shows an inactive assigned specialty so the owner can remove it', async () => {
    vi.mocked(platformApi.getTenant).mockResolvedValue({
      ...detail,
      specialties: [...detail.specialties, { id: 's2', code: 'NUTRITION', name: 'Nutrición' }],
    });
    vi.mocked(platformApi.getSpecialtyCatalog).mockResolvedValue([
      { id: 's1', code: 'PSYCHOLOGY', name: 'Psicología', description: null, modules: [] },
    ]);
    renderDetail();
    await ready();
    expect((screen.getByRole('button', { name: 'Guardar especialidades' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(await screen.findByLabelText('Nutrición (inactiva)'));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar especialidades' }));
    await waitFor(() => expect(platformApi.setSpecialties).toHaveBeenCalledWith('t-1', ['PSYCHOLOGY']));
  });

  it('asks for confirmation and a reason before suspending', async () => {
    renderDetail();
    await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Suspender' }));
    expect(platformApi.suspendTenant).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Suspender consultorio' }));
    expect(await screen.findByText('Indica el motivo de la suspensión')).toBeTruthy();
    expect(platformApi.suspendTenant).not.toHaveBeenCalled();

    type('Motivo de la suspensión', 'Falta de pago');
    fireEvent.click(screen.getByRole('button', { name: 'Suspender consultorio' }));
    await waitFor(() => expect(platformApi.suspendTenant).toHaveBeenCalledWith('t-1', 'Falta de pago'));
  });

  it('offers Reactivar instead of Suspender for a suspended clinic', async () => {
    vi.mocked(platformApi.getTenant).mockResolvedValue(suspended);
    renderDetail();
    await ready();
    expect(screen.queryByRole('button', { name: 'Suspender' })).toBeNull();
    expect(screen.getByText('Suspendido')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Reactivar' }));
    await waitFor(() => expect(platformApi.reactivateTenant).toHaveBeenCalledWith('t-1'));
  });

  it('resets the master password and shows it once', async () => {
    renderDetail();
    await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Restablecer contraseña' }));
    type('Contraseña temporal', 'corta');
    fireEvent.click(screen.getByRole('button', { name: 'Restablecer' }));
    expect(await screen.findByText(/al menos 8 caracteres/)).toBeTruthy();
    expect(platformApi.resetMasterPassword).not.toHaveBeenCalled();

    type('Contraseña temporal', ' Temporal-123 ');
    fireEvent.click(screen.getByRole('button', { name: 'Restablecer' }));
    await waitFor(() => expect(platformApi.resetMasterPassword).toHaveBeenCalledWith('t-1', ' Temporal-123 '));
    const shown = () => screen.queryByText(' Temporal-123 ', { normalizer: (text) => text });
    await waitFor(() => expect(shown()).toBeTruthy());

    // The password is neither in the query cache nor in the mutation cache.
    const cached = JSON.stringify([
      client.getQueryCache().getAll().map((query) => query.state.data),
      client.getMutationCache().getAll().map((mutation) => mutation.state),
    ]);
    expect(cached).not.toContain('Temporal-123');

    fireEvent.click(screen.getByRole('button', { name: 'Listo' }));
    expect(shown()).toBeNull();
  });

  it('shows a not-found state for an unknown clinic', async () => {
    vi.mocked(platformApi.getTenant).mockRejectedValue({ status: 404, message: 'Consultorio no encontrado' } satisfies ApiError);
    renderDetail();
    expect(await screen.findByRole('heading', { name: 'Consultorio no encontrado' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Volver a consultorios' })).toBeTruthy();
    expect(screen.queryByLabelText('Nombre del consultorio')).toBeNull();
  });

  it('shows only the three usage counters', async () => {
    renderDetail();
    await ready();
    const usage = screen.getByRole('group', { name: 'Uso' });
    const terms = within(usage).getAllByRole('term').map((term) => term.textContent);
    expect(terms).toEqual(['Profesionales en uso', 'Pacientes activos', 'Notificaciones del mes']);
    const values = within(usage).getAllByRole('definition').map((value) => value.textContent);
    expect(values).toEqual(['3 de 5', '42 de 100', '17']);
  });
});
