import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { platformApi } from '@/lib/api/endpoints';
import { QUERY_KEYS } from '@/lib/constants';
import { TenantType, type ApiError, type PlatformTenantDetail, type SectionCatalog } from '@/types';
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
    suspendTenant: vi.fn(),
    reactivateTenant: vi.fn(),
    setSections: vi.fn(),
    resetMasterPassword: vi.fn(),
  },
}));

const catalog: SectionCatalog = {
  sections: [
    { key: 'core.calendar', name: 'Agenda', requires: [] },
    { key: 'core.patients', name: 'Pacientes', requires: [] },
    { key: 'core.tasks', name: 'Actividades', requires: ['core.patients'] },
    { key: 'core.billing', name: 'Facturación', requires: [] },
  ],
  defaults: [],
};

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
    planType: 'CLINIC_BASIC',
    status: 'ACTIVE',
    trialEndsAt: null,
    currentPeriodStart: '2026-01-10T00:00:00.000Z',
    currentPeriodEnd: null,
    seatsPsychologistsMax: 5,
    maxActivePatients: 100,
    basePrice: 49,
    currency: 'USD',
  },
  usage: { seatsPsychologistsUsed: 3, activePatientsCount: 42, monthlyNotificationsSent: 17 },
  specialties: [{ id: 's1', code: 'PSICOLOGIA', name: 'Psicología' }],
  sections: [
    { key: 'core.calendar', name: 'Agenda', enabled: true },
    { key: 'core.patients', name: 'Pacientes', enabled: true },
    { key: 'core.tasks', name: 'Actividades', enabled: false },
    { key: 'core.billing', name: 'Facturación', enabled: false },
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
  vi.mocked(platformApi.suspendTenant).mockResolvedValue(suspended);
  vi.mocked(platformApi.reactivateTenant).mockResolvedValue(detail);
  vi.mocked(platformApi.setSections).mockResolvedValue(detail);
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

  it('requires a reason to change the plan and sends the new limits', async () => {
    renderDetail();
    await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar plan' }));
    type('Plan', 'CLINIC_PRO');
    type('Cupos de profesionales', '10');
    type('Pacientes activos máximos', '300');
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar cambio' }));
    expect(await screen.findByText('Indica el motivo del cambio')).toBeTruthy();
    expect(platformApi.changePlan).not.toHaveBeenCalled();

    type('Motivo del cambio', 'Pagó el plan anual');
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar cambio' }));
    await waitFor(() =>
      expect(platformApi.changePlan).toHaveBeenCalledWith('t-1', {
        planType: 'CLINIC_PRO',
        seatsPsychologistsMax: 10,
        maxActivePatients: 300,
        reason: 'Pagó el plan anual',
      }),
    );
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Cambiar plan' })).toBeNull());
  });

  it('only offers the plans of the clinic type', async () => {
    renderDetail();
    await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar plan' }));
    const options = within(screen.getByLabelText('Plan')).getAllByRole('option').map((option) => option.getAttribute('value'));
    expect(options).toEqual(['TRIAL', 'CLINIC_BASIC', 'CLINIC_PRO', 'CLINIC_ENTERPRISE']);
  });

  it('shows the PLAN_BELOW_USAGE message and leaves the plan unchanged', async () => {
    const error: ApiError = {
      status: 409,
      code: 'PLAN_BELOW_USAGE',
      message: 'El consultorio usa más cupos de profesionales de los que permite el nuevo plan.',
      details: { seatsPsychologistsUsed: 3, seatsPsychologistsMax: 2 },
    };
    vi.mocked(platformApi.changePlan).mockRejectedValue(error);
    renderDetail();
    await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar plan' }));
    type('Plan', 'CLINIC_PRO');
    type('Cupos de profesionales', '2');
    type('Motivo del cambio', 'Reducción');
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar cambio' }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain(error.message);
    // The dialog stays open and the card still shows the current plan.
    expect(screen.getByRole('heading', { name: 'Cambiar plan' })).toBeTruthy();
    expect(screen.getAllByText('Clínica Básico').length).toBeGreaterThan(0);
    expect(client.getQueryData(QUERY_KEYS.PLATFORM_TENANT('t-1'))).toEqual(detail);
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
      expect(platformApi.setSections).toHaveBeenCalledWith('t-1', ['core.calendar', 'core.patients', 'core.billing']),
    );
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
