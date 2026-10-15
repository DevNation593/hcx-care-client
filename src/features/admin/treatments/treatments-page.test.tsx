import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TreatmentWithCurrent } from '@/types/treatments';
import { TreatmentsPage } from './treatments-page';

const hooks = vi.hoisted(() => ({
  treatments: { data: [] as unknown[], isPending: false, isError: false, refetch: vi.fn() },
  forms: { data: [] as unknown[], isPending: false, isError: false, error: null as unknown, refetch: vi.fn() },
  templates: { data: [] as unknown[], isPending: false, isError: false, error: null as unknown, refetch: vi.fn() },
  detail: { data: undefined as unknown, isError: false, refetch: vi.fn() },
  update: vi.fn(),
  addVersion: vi.fn(),
  create: vi.fn(),
}));

vi.mock('@/hooks/useTreatments', () => ({
  useTreatments: () => hooks.treatments,
  useTreatment: () => hooks.detail,
  useUpdateTreatment: () => ({ mutate: hooks.update, isPending: false }),
  useAddTreatmentVersion: () => ({ mutate: hooks.addVersion, isPending: false, error: null }),
  useCreateTreatment: () => ({ mutate: hooks.create, isPending: false, error: null }),
}));
vi.mock('@/hooks/useClinicalModules', () => ({ useFormDefinitions: () => hooks.forms }));
vi.mock('@/hooks/useConsentTemplates', () => ({ useConsentTemplates: () => hooks.templates }));

const treatment = {
  id: 'tr-1',
  name: 'Toxina botulínica',
  category: 'Estética',
  isActive: true,
  currentVersion: 2,
  current: {
    id: 'v-2',
    price: 120.5,
    taxRatePercent: 15,
    durationMinutes: 45,
    formDefinitionId: null,
    formVersion: null,
    consentTemplateVersionId: 'cv-1',
    requirements: {
      medicalForm: { required: false },
      informedConsent: { required: true, validityDays: 365 },
      photos: { minimumBefore: 1, minimumAfter: 0 },
      clinicalNotes: { requiredForCompletion: true },
    },
  },
} as unknown as TreatmentWithCurrent;

beforeEach(() => {
  vi.clearAllMocks();
  hooks.treatments = { data: [treatment], isPending: false, isError: false, refetch: vi.fn() };
  hooks.forms = { data: [], isPending: false, isError: false, error: null, refetch: vi.fn() };
  hooks.detail = { data: undefined, isError: false, refetch: vi.fn() };
  hooks.templates = {
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    data: [
      {
        id: 'tpl-1',
        name: 'Toxina',
        isActive: true,
        versions: [
          { id: 'cv-2', version: 2, status: 'DRAFT' },
          { id: 'cv-1', version: 1, status: 'PUBLISHED' },
        ],
      },
      { id: 'tpl-2', name: 'Vieja', isActive: false, versions: [{ id: 'cv-9', version: 1, status: 'PUBLISHED' }] },
    ],
  };
});

describe('TreatmentsPage', () => {
  it('lists the catalog with price, duration and requirements', () => {
    render(<TreatmentsPage canManage />);
    expect(screen.getByText('Toxina botulínica')).toBeInTheDocument();
    expect(screen.getByText(/Precio 120,50/)).toBeInTheDocument();
    expect(screen.getByText(/Consentimiento \(365 días\)/)).toBeInTheDocument();
  });

  it('is read only without treatments.manage', () => {
    render(<TreatmentsPage canManage={false} />);
    expect(screen.getByText('Toxina botulínica')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nuevo tratamiento' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Nueva versión/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Desactivar/ })).not.toBeInTheDocument();
  });

  it('deactivates a treatment', () => {
    render(<TreatmentsPage canManage />);
    fireEvent.click(screen.getByRole('button', { name: 'Desactivar Toxina botulínica' }));
    expect(hooks.update).toHaveBeenCalledWith({ id: 'tr-1', data: { isActive: false } });
  });

  it('offers only published versions of active templates for the consent', () => {
    render(<TreatmentsPage canManage />);
    fireEvent.click(screen.getByRole('button', { name: 'Nueva versión de Toxina botulínica' }));
    const options = Array.from((screen.getByLabelText('Consentimiento') as HTMLSelectElement).options).map(
      (option) => option.textContent,
    );
    expect(options).toEqual(['Selecciona un consentimiento', 'Toxina · v1']);
  });

  it('saves a new version of the treatment', () => {
    render(<TreatmentsPage canManage />);
    fireEvent.click(screen.getByRole('button', { name: 'Nueva versión de Toxina botulínica' }));
    fireEvent.change(screen.getByLabelText(/^Precio/), { target: { value: '130' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar versión' }));
    expect(hooks.addVersion).toHaveBeenCalledWith(
      expect.objectContaining({ price: 130, consentTemplateVersionId: 'cv-1' }),
      expect.anything(),
    );
  });

  it('asks for a name before creating', () => {
    render(<TreatmentsPage canManage />);
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo tratamiento' }));
    fireEvent.change(screen.getByLabelText(/^Precio/), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar versión' }));
    expect(screen.getByText('El nombre debe tener al menos 2 caracteres')).toBeInTheDocument();
    expect(hooks.create).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/^Nombre/), { target: { value: ' Relleno ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar versión' }));
    expect(hooks.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Relleno', version: expect.objectContaining({ price: 10 }) }),
      expect.anything(),
    );
  });

  it('shows the version history newest first, marking the current one', () => {
    const version = (n: number, price: number, createdAt: string) => ({
      ...treatment.current,
      id: `v-${n}`,
      version: n,
      price,
      createdAt,
    });
    hooks.detail = {
      data: { ...treatment, versions: [version(1, 100, '2026-01-05T15:00:00.000Z'), version(2, 120.5, '2026-03-09T15:00:00.000Z')] },
      isError: false,
      refetch: vi.fn(),
    };
    // Read only users see the history too.
    render(<TreatmentsPage canManage={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Historial de Toxina botulínica' }));

    const rows = screen.getAllByRole('listitem').filter((row) => /^v\d/.test(row.textContent ?? ''));
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('v2');
    expect(rows[0]).toHaveTextContent('09/03/2026');
    expect(rows[0]).toHaveTextContent('Vigente');
    expect(rows[0]).toHaveTextContent('Precio 120,50');
    expect(rows[1]).toHaveTextContent('v1');
    expect(rows[1]).toHaveTextContent('05/01/2026');
    expect(rows[1]).not.toHaveTextContent('Vigente');
  });

  it('tells a user without access to the forms why the form requirement is off', () => {
    hooks.forms = { data: [], isPending: false, isError: true, error: { status: 403, message: 'x' }, refetch: vi.fn() };
    render(<TreatmentsPage canManage />);
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo tratamiento' }));

    expect(screen.getByText(/No tienes acceso al listado de fichas/)).toBeInTheDocument();
    expect(screen.getByLabelText('Exige ficha')).toBeDisabled();
  });

  it('shows a loading hint and then an error with retry for the consents list', () => {
    hooks.templates = { data: [], isPending: true, isError: false, error: null, refetch: vi.fn() };
    const { unmount } = render(<TreatmentsPage canManage />);
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo tratamiento' }));
    fireEvent.click(screen.getByLabelText('Exige consentimiento'));
    expect(screen.getByText('Cargando los consentimientos…')).toBeInTheDocument();
    unmount();

    const refetch = vi.fn();
    hooks.templates = { data: [], isPending: false, isError: true, error: { status: 500, message: 'x' }, refetch };
    render(<TreatmentsPage canManage />);
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo tratamiento' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(refetch).toHaveBeenCalled();
  });
});
