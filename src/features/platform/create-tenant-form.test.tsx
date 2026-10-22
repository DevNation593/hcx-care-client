import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { platformApi, specialtyCatalogApi } from '@/lib/api/endpoints';
import { ROUTES } from '@/lib/constants';
import { TenantType, type PlatformTenantDetail, type SectionCatalog } from '@/types';
import { CreateTenantForm } from './create-tenant-form';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/lib/api/endpoints', () => ({
  platformApi: { getSectionCatalog: vi.fn(), createTenant: vi.fn() },
  specialtyCatalogApi: { list: vi.fn() },
}));

const catalog: SectionCatalog = {
  sections: [
    { key: 'core.calendar', name: 'Agenda', requires: [] },
    { key: 'core.patients', name: 'Pacientes', requires: [] },
    { key: 'core.tasks', name: 'Actividades', requires: ['core.patients'] },
    { key: 'core.billing', name: 'Facturación', requires: [] },
  ],
  defaults: [
    { planType: 'TRIAL', tenantType: TenantType.CLINIC, sections: ['core.calendar', 'core.patients'] },
    { planType: 'CLINIC_PRO', tenantType: TenantType.CLINIC, sections: ['core.calendar', 'core.patients', 'core.tasks', 'core.billing'] },
    { planType: 'TRIAL', tenantType: TenantType.PERSONAL, sections: ['core.calendar'] },
    { planType: 'PERSONAL_PRO', tenantType: TenantType.PERSONAL, sections: ['core.calendar', 'core.patients'] },
  ],
};

const specialties = [
  { id: 's1', code: 'PSICOLOGIA', name: 'Psicología', description: null, modules: [] },
  { id: 's2', code: 'NUTRICION', name: 'Nutrición', description: null, modules: [] },
];

const detail = { tenant: { id: 'new-1' } } as PlatformTenantDetail;

let client: QueryClient;

function renderForm() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <CreateTenantForm />
    </QueryClientProvider>,
  );
}

const type = (label: string | RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

const checked = (name: string) => (screen.getByLabelText(name) as HTMLInputElement).checked;

async function ready() {
  await screen.findByLabelText('Psicología');
  await waitFor(() => expect(checked('Agenda')).toBe(true));
}

async function fillRequired() {
  await ready();
  type('Nombre del consultorio', 'Clínica Sol');
  type('Correo del consultorio', 'info@sol.com');
  type('Nombre del titular', 'Rosa');
  type('Apellido del titular', 'Paz');
  type('Correo del titular', 'rosa@sol.com');
  fireEvent.click(screen.getByLabelText('Psicología'));
  type('Contraseña temporal', 'Temporal-123');
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(platformApi.getSectionCatalog).mockResolvedValue(catalog);
  vi.mocked(specialtyCatalogApi.list).mockResolvedValue(specialties);
  vi.mocked(platformApi.createTenant).mockResolvedValue(detail);
});

describe('CreateTenantForm', () => {
  it('preselects the sections of the plan and tenant type from the catalog', async () => {
    renderForm();
    await ready();
    expect(checked('Pacientes')).toBe(true);
    expect(checked('Actividades')).toBe(false);
    expect(checked('Facturación')).toBe(false);
  });

  it('offers only the plans that match the tenant type', async () => {
    renderForm();
    await ready();
    const plans = () =>
      within(screen.getByLabelText('Plan')).getAllByRole('option').map((o) => (o as HTMLOptionElement).value);
    expect(plans()).toEqual(['TRIAL', 'CLINIC_BASIC', 'CLINIC_PRO', 'CLINIC_ENTERPRISE']);
    type('Tipo de consultorio', 'PERSONAL');
    expect(plans()).toEqual(['TRIAL', 'PERSONAL_BASIC', 'PERSONAL_PRO']);
  });

  it('updates the preselection when the plan changes and no box was touched', async () => {
    renderForm();
    await ready();
    type('Plan', 'CLINIC_PRO');
    await waitFor(() => expect(checked('Facturación')).toBe(true));
    expect(checked('Actividades')).toBe(true);
    expect(screen.queryByRole('button', { name: 'Reemplazar selección' })).not.toBeInTheDocument();
  });

  it('asks before replacing a selection the admin edited by hand', async () => {
    renderForm();
    await ready();
    fireEvent.click(screen.getByLabelText('Facturación'));
    type('Plan', 'CLINIC_PRO');
    expect(await screen.findByRole('button', { name: 'Reemplazar selección' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Conservar mi selección' }));
    expect(screen.queryByRole('button', { name: 'Reemplazar selección' })).not.toBeInTheDocument();
    expect(checked('Facturación')).toBe(true);
    expect(checked('Actividades')).toBe(false);

    type('Plan', 'TRIAL');
    fireEvent.click(await screen.findByRole('button', { name: 'Reemplazar selección' }));
    await waitFor(() => expect(checked('Facturación')).toBe(false));
    expect(checked('Agenda')).toBe(true);
    expect(checked('Actividades')).toBe(false);
  });

  it('does not ask to replace the selection when the plan defaults hold the same keys in another order', async () => {
    vi.mocked(platformApi.getSectionCatalog).mockResolvedValue({
      ...catalog,
      defaults: [
        ...catalog.defaults,
        {
          planType: 'CLINIC_ENTERPRISE',
          tenantType: TenantType.CLINIC,
          sections: ['core.billing', 'core.tasks', 'core.patients', 'core.calendar'],
        },
      ],
    });
    renderForm();
    await ready();
    type('Plan', 'CLINIC_PRO');
    await waitFor(() => expect(checked('Facturación')).toBe(true));
    // Toggle by hand: the selection is now "edited" but holds the same keys.
    fireEvent.click(screen.getByLabelText('Facturación'));
    fireEvent.click(screen.getByLabelText('Facturación'));
    type('Plan', 'CLINIC_ENTERPRISE');
    expect(screen.queryByRole('button', { name: 'Reemplazar selección' })).not.toBeInTheDocument();
    expect(checked('Facturación')).toBe(true);
  });

  it('requires at least one specialty and an 8 character password', async () => {
    renderForm();
    await ready();
    type('Contraseña temporal', 'corta');
    fireEvent.click(screen.getByRole('button', { name: 'Crear consultorio' }));
    expect(await screen.findByText('Selecciona al menos una especialidad')).toBeInTheDocument();
    expect(screen.getByText('La contraseña debe tener al menos 8 caracteres')).toBeInTheDocument();
    expect(platformApi.createTenant).not.toHaveBeenCalled();
  });

  it('fills the password field with Generar and reveals it with Mostrar', async () => {
    renderForm();
    await ready();
    const field = screen.getByLabelText('Contraseña temporal') as HTMLInputElement;
    expect(field.type).toBe('password');
    fireEvent.click(screen.getByRole('button', { name: 'Generar' }));
    expect(field.value).toHaveLength(16);
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar' }));
    expect(field.type).toBe('text');
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar' }));
    expect(field.type).toBe('password');
  });

  it('submits the exact payload of CreatePlatformTenantInput', async () => {
    renderForm();
    await fillRequired();
    type('Teléfono', '0999999999');
    fireEvent.click(screen.getByRole('button', { name: 'Crear consultorio' }));
    await waitFor(() => expect(platformApi.createTenant).toHaveBeenCalledTimes(1));
    expect(vi.mocked(platformApi.createTenant).mock.calls[0][0]).toEqual({
      name: 'Clínica Sol',
      email: 'info@sol.com',
      phone: '0999999999',
      tenantType: 'CLINIC',
      timezone: 'America/Guayaquil',
      locale: 'es',
      masterFirstName: 'Rosa',
      masterLastName: 'Paz',
      masterEmail: 'rosa@sol.com',
      temporaryPassword: 'Temporal-123',
      planType: 'TRIAL',
      specialtyCodes: ['PSICOLOGIA'],
      sections: ['core.calendar', 'core.patients'],
    });
  });

  it('shows the master e-mail and the password once, then goes to the clinic detail', async () => {
    renderForm();
    await fillRequired();
    fireEvent.click(screen.getByRole('button', { name: 'Crear consultorio' }));
    expect(await screen.findByText('rosa@sol.com')).toBeInTheDocument();
    expect(screen.getByText('Temporal-123')).toBeInTheDocument();
    expect(screen.queryByLabelText('Contraseña temporal')).not.toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Listo' }));
    expect(push).toHaveBeenCalledWith(ROUTES.PLATFORM_TENANT_DETAIL('new-1'));
    expect(screen.queryByText('Temporal-123')).not.toBeInTheDocument();
  });

  it('keeps the password out of the query cache', async () => {
    renderForm();
    await fillRequired();
    fireEvent.click(screen.getByRole('button', { name: 'Crear consultorio' }));
    await screen.findByText('Temporal-123');
    const entries = client
      .getQueryCache()
      .getAll()
      .map((q) => JSON.stringify({ key: q.queryKey, data: q.state.data }));
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.some((e) => e.includes('Temporal-123'))).toBe(false);
    await waitFor(() => expect(client.getMutationCache().getAll()).toHaveLength(0));
  });

  it('shows the API message on a 409 and keeps the form values', async () => {
    vi.mocked(platformApi.createTenant).mockRejectedValue({ status: 409, message: 'El correo ya está registrado' });
    renderForm();
    await fillRequired();
    fireEvent.click(screen.getByRole('button', { name: 'Crear consultorio' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('El correo ya está registrado');
    expect((screen.getByLabelText('Nombre del consultorio') as HTMLInputElement).value).toBe('Clínica Sol');
    expect((screen.getByLabelText('Correo del titular') as HTMLInputElement).value).toBe('rosa@sol.com');
    expect((screen.getByLabelText('Contraseña temporal') as HTMLInputElement).value).toBe('Temporal-123');
    expect(checked('Psicología')).toBe(true);
    await waitFor(() => expect(client.getMutationCache().getAll()).toHaveLength(0));
    expect(JSON.stringify(client.getMutationCache().getAll().map((m) => m.state.variables))).not.toContain('Temporal-123');
    expect(push).not.toHaveBeenCalled();
  });
});

describe('CreateTenantForm with an aesthetic specialty', () => {
  const healthCatalog: SectionCatalog = {
    sections: [
      { key: 'core.patients', name: 'Pacientes', requires: [] },
      { key: 'core.clinicalNotes', name: 'Notas clínicas', requires: ['core.patients'], healthOnly: true },
      { key: 'core.specialties', name: 'Módulos clínicos', requires: ['core.patients'] },
    ],
    defaults: [
      {
        planType: 'TRIAL',
        tenantType: TenantType.CLINIC,
        sections: ['core.patients', 'core.clinicalNotes', 'core.specialties'],
      },
    ],
    nonHealthSpecialtyCodes: ['AESTHETICS'],
  };

  beforeEach(() => {
    vi.mocked(platformApi.getSectionCatalog).mockResolvedValue(healthCatalog);
    vi.mocked(specialtyCatalogApi.list).mockResolvedValue([
      { id: 'a', code: 'AESTHETICS', name: 'Estética', description: null, modules: [] },
      { id: 'g', code: 'GENERAL_MEDICINE', name: 'Medicina General', description: null, modules: [] },
    ]);
  });

  async function start() {
    renderForm();
    await screen.findByLabelText('Estética');
    await waitFor(() => expect(checked('Notas clínicas')).toBe(true));
  }

  it('has no business kind control', async () => {
    await start();
    expect(screen.queryByLabelText('Tipo de negocio')).not.toBeInTheDocument();
  });

  it('unchecks clinical notes for an aesthetic-only clinic and checks them again with a health specialty', async () => {
    await start();
    fireEvent.click(screen.getByLabelText('Estética'));
    await waitFor(() => expect(checked('Notas clínicas')).toBe(false));
    expect(checked('Pacientes')).toBe(true);

    fireEvent.click(screen.getByLabelText('Medicina General'));
    await waitFor(() => expect(checked('Notas clínicas')).toBe(true));
  });

  it('keeps and sends clinical notes the admin checks again by hand', async () => {
    await start();
    type('Nombre del consultorio', 'Estudio Sol');
    type('Correo del consultorio', 'info@estudio.com');
    type('Nombre del titular', 'Rosa');
    type('Apellido del titular', 'Paz');
    type('Correo del titular', 'rosa@estudio.com');
    type('Contraseña temporal', 'Temporal-123');
    fireEvent.click(screen.getByLabelText('Estética'));
    await waitFor(() => expect(checked('Notas clínicas')).toBe(false));
    fireEvent.click(screen.getByLabelText('Notas clínicas'));

    fireEvent.click(screen.getByRole('button', { name: 'Crear consultorio' }));
    await waitFor(() => expect(platformApi.createTenant).toHaveBeenCalledTimes(1));
    expect(vi.mocked(platformApi.createTenant).mock.calls[0][0]).toMatchObject({
      specialtyCodes: ['AESTHETICS'],
      sections: expect.arrayContaining(['core.clinicalNotes']),
    });
  });
});
