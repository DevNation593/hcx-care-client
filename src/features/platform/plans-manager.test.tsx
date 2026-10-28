import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { platformApi } from '@/lib/api/endpoints';
import { TenantType, type PlatformPlan, type SectionCatalog } from '@/types';
import { PlansManager } from './plans-manager';

vi.mock('@/lib/api/endpoints', () => ({
  platformApi: {
    listPlans: vi.fn(),
    getSectionCatalog: vi.fn(),
    createPlan: vi.fn(),
    updatePlan: vi.fn(),
    setPlanArchived: vi.fn(),
  },
}));

const catalog: SectionCatalog = {
  sections: [
    { key: 'core.agenda', name: 'Agenda', requires: [] },
    { key: 'core.patients', name: 'Pacientes', requires: [] },
  ],
  nonHealthSpecialtyCodes: [],
};

const pro: PlatformPlan = {
  id: 'plan_clinic_pro',
  code: 'CLINIC_PRO',
  name: 'Clínica Pro',
  description: null,
  tenantType: TenantType.CLINIC,
  sortOrder: 40,
  archivedAt: null,
  basePrice: 199,
  pricePerSeat: 12,
  specialtyPrice: 15,
  currency: 'USD',
  seatsIncluded: 10,
  maxActivePatients: 500,
  storageGB: 25,
  monthlyElectronicInvoicesLimit: 50,
  includedSpecialties: 3,
  maxBranches: 2,
  trialDays: 14,
  modules: ['core.agenda', 'core.patients'],
  clinicsCount: 4,
};
const old: PlatformPlan = {
  ...pro,
  id: 'plan_clinic_old',
  code: 'CLINIC_OLD',
  name: 'Clínica Antiguo',
  archivedAt: '2026-01-01T00:00:00.000Z',
  clinicsCount: 0,
};
const personal: PlatformPlan = {
  ...pro,
  id: 'plan_personal_basic',
  code: 'PERSONAL_BASIC',
  name: 'Personal Básico',
  tenantType: TenantType.PERSONAL,
  basePrice: 29,
  seatsIncluded: 1,
  clinicsCount: 0,
};

function renderManager() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PlansManager />
    </QueryClientProvider>,
  );
}

const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(platformApi.listPlans).mockResolvedValue([pro, old, personal]);
  vi.mocked(platformApi.getSectionCatalog).mockResolvedValue(catalog);
  vi.mocked(platformApi.createPlan).mockResolvedValue(pro);
  vi.mocked(platformApi.updatePlan).mockResolvedValue(pro);
  vi.mocked(platformApi.setPlanArchived).mockResolvedValue(old);
});

describe('PlansManager', () => {
  it('lists the plans by tenant type with their price, limits and clinics', async () => {
    renderManager();
    const row = (await screen.findByText('Clínica Pro')).closest('tr') as HTMLElement;
    expect(row).toHaveTextContent('CLINIC_PRO');
    expect(row).toHaveTextContent('/mes');
    expect(row).toHaveTextContent('500');
    expect(within(row).getAllByRole('cell')[6]).toHaveTextContent('4');
    expect(screen.getByRole('heading', { name: 'Planes Clínica' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Planes Personal' })).toBeInTheDocument();
    const archived = screen.getByText('Clínica Antiguo').closest('tr') as HTMLElement;
    expect(archived).toHaveTextContent('Archivado');
    expect(within(archived).getByRole('button', { name: 'Restaurar Clínica Antiguo' })).toBeInTheDocument();
  });

  it('creates a plan with its code, values and modules', async () => {
    renderManager();
    await screen.findByText('Clínica Pro');
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo plan' }));
    await screen.findByLabelText('Agenda');
    type('Código', 'clinic_plus');
    type('Nombre', 'Clínica Plus');
    type('Precio mensual (USD)', '149.5');
    type('Pacientes activos', '300');
    type('Almacenamiento (GB)', '15');
    type('Sedes activas', '3');
    fireEvent.click(screen.getByRole('button', { name: 'Crear plan' }));

    await waitFor(() => expect(platformApi.createPlan).toHaveBeenCalledTimes(1));
    expect(vi.mocked(platformApi.createPlan).mock.calls[0][0]).toEqual({
      code: 'CLINIC_PLUS',
      name: 'Clínica Plus',
      tenantType: 'CLINIC',
      sortOrder: 0,
      basePrice: 149.5,
      pricePerSeat: 0,
      specialtyPrice: 15,
      seatsIncluded: 1,
      maxActivePatients: 300,
      storageGB: 15,
      monthlyElectronicInvoicesLimit: 50,
      includedSpecialties: 1,
      maxBranches: 3,
      trialDays: 14,
      modules: ['core.agenda', 'core.patients'],
    });
  });

  it('refuses a plan without a price or a storage quota', async () => {
    renderManager();
    await screen.findByText('Clínica Pro');
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo plan' }));
    await screen.findByLabelText('Agenda');
    type('Código', 'X1');
    type('Nombre', 'Sin datos');
    fireEvent.click(screen.getByRole('button', { name: 'Crear plan' }));
    expect(await screen.findByText('Ingresa el precio')).toBeInTheDocument();
    expect(platformApi.createPlan).not.toHaveBeenCalled();
  });

  it('warns that an edit reaches every clinic on the plan, and never sends the code', async () => {
    renderManager();
    await screen.findByText('Clínica Pro');
    fireEvent.click(screen.getByRole('button', { name: 'Editar Clínica Pro' }));
    expect(await screen.findByText(/se aplican de inmediato a los 4 consultorio/)).toBeInTheDocument();
    expect((screen.getByLabelText('Código') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByLabelText('Tipo de consultorio') as HTMLSelectElement).disabled).toBe(true);
    type('Precio mensual (USD)', '189');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar y aplicar' }));

    await waitFor(() => expect(platformApi.updatePlan).toHaveBeenCalledTimes(1));
    const [id, input] = vi.mocked(platformApi.updatePlan).mock.calls[0];
    expect(id).toBe('plan_clinic_pro');
    expect(input).toMatchObject({ basePrice: 189, maxActivePatients: 500, maxBranches: 2 });
    expect(input).not.toHaveProperty('code');
  });

  it('archives a plan in use and restores an archived one', async () => {
    renderManager();
    await screen.findByText('Clínica Pro');
    fireEvent.click(screen.getByRole('button', { name: 'Archivar Clínica Pro' }));
    await waitFor(() =>
      expect(platformApi.setPlanArchived).toHaveBeenCalledWith('plan_clinic_pro', true),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Restaurar Clínica Antiguo' }));
    await waitFor(() =>
      expect(platformApi.setPlanArchived).toHaveBeenCalledWith('plan_clinic_old', false),
    );
  });
});
