import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TreatmentWithCurrent } from '@/types/treatments';
import { TreatmentsPage } from './treatments-page';

const hooks = vi.hoisted(() => ({
  treatments: { data: [] as unknown[], isPending: false, isError: false, refetch: vi.fn() },
  forms: { data: [] as unknown[] },
  templates: { data: [] as unknown[] },
  update: vi.fn(),
  addVersion: vi.fn(),
  create: vi.fn(),
}));

vi.mock('@/hooks/useTreatments', () => ({
  useTreatments: () => hooks.treatments,
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
  hooks.forms = { data: [] };
  hooks.templates = {
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
});
