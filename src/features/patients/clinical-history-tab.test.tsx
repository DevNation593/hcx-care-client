import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/store/authStore';
import type { ClinicalNote, SpecialtyRecord, User } from '@/types';
import type { ClinicalModuleDefinition, Encounter } from '@/types/clinical';
import type { TreatmentSessionSummary } from '@/types/treatments';
import { UserRole } from '@/types';
import { ClinicalHistoryTab } from './clinical-history-tab';

// Rendered without a QueryClient: name people as in a clinical practice.
vi.mock('@/hooks/usePatientTerms', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/usePatientTerms')>();
  return { ...actual, usePatientTerms: () => actual.patientTerms(false) };
});

type Query = { data?: unknown[]; isPending?: boolean; isError?: boolean; error?: unknown; refetch: () => void };
const query = (data: unknown[] = []): Query => ({ data, isPending: false, isError: false, refetch: vi.fn() });

const hooks = vi.hoisted(() => ({
  notes: null as unknown as Query,
  encounters: null as unknown as Query,
  records: null as unknown as Query,
  procedures: null as unknown as Query,
  modules: [] as unknown[],
  enabledArgs: {} as Record<string, boolean | undefined>,
  sections: new Set<string>(),
}));

vi.mock('@/hooks/useClinicalNotes', () => ({
  usePatientClinicalNotes: (_id: string, enabled?: boolean) => {
    hooks.enabledArgs.notes = enabled;
    return hooks.notes;
  },
}));
vi.mock('@/hooks/useEncounters', () => ({
  usePatientEncounters: (_id: string, enabled?: boolean) => {
    hooks.enabledArgs.encounters = enabled;
    return hooks.encounters;
  },
}));
vi.mock('@/hooks/useSpecialtyRecords', () => ({
  usePatientSpecialtyRecords: (_id: string, enabled?: boolean) => {
    hooks.enabledArgs.records = enabled;
    return hooks.records;
  },
}));
vi.mock('@/hooks/useTreatmentSessions', () => ({
  usePatientTreatmentSessions: (_id: string, enabled?: boolean) => {
    hooks.enabledArgs.procedures = enabled;
    return hooks.procedures;
  },
}));
vi.mock('@/hooks/useClinicalModules', () => ({
  useClinicalModules: () => ({ data: hooks.modules, isError: false, isPending: false }),
}));
vi.mock('@/hooks/useSections', () => ({
  useSections: () => ({ isEnabled: (key: string) => hooks.sections.has(key) }),
}));

const vitals = {
  moduleKey: 'general.vital-signs',
  scope: 'GENERAL',
  specialtyCode: null,
  name: 'Signos vitales',
  description: null,
  category: null,
  schemaVersion: 1,
  isLatest: true,
  renderer: 'FORM',
  legacy: false,
  enabled: true,
  canRecord: true,
  schema: {
    sections: [
      { key: 'vitals', title: 'Signos vitales', fields: [{ key: 'weightKg', label: 'Peso', type: 'decimal', unit: 'kg' }] },
    ],
  },
} as ClinicalModuleDefinition;

const consultation = {
  id: 'e1',
  patientId: 'patient-1',
  professionalId: 'me',
  encounterType: 'FIRST_VISIT',
  status: 'CLOSED',
  reason: 'Dolor de cabeza de una semana',
  summary: 'Control en 7 días',
  startedAt: '2026-10-01T15:00:00.000Z',
  signedAt: '2026-10-01T16:00:00.000Z',
  contentHash: 'v1:0123456789abcdef',
  recordCount: 1,
  professional: { id: 'me', firstName: 'Luis', lastName: 'Mora' },
  specialty: { id: 'sp', code: 'GENERAL_MEDICINE', name: 'Medicina general' },
} as unknown as Encounter;

const vitalsRecord = {
  id: 'r1',
  patientId: 'patient-1',
  professionalId: 'me',
  moduleKey: 'general.vital-signs',
  schemaVersion: 1,
  version: 1,
  recordDate: '2026-10-01T15:30:00.000Z',
  data: { weightKg: 70 },
  alerts: [{ level: 'critical', message: 'Peso por debajo de lo esperado.' }],
  signed: true,
  professional: { id: 'me', firstName: 'Luis', lastName: 'Mora' },
  specialty: { code: 'GENERAL_MEDICINE', name: 'Medicina general' },
  encounter: { id: 'e1', encounterType: 'FIRST_VISIT', status: 'CLOSED', startedAt: '2026-10-01T15:00:00.000Z' },
} as unknown as SpecialtyRecord;

const clinicalNote = {
  id: 'n1',
  patientId: 'patient-1',
  psychologistId: 'me',
  psychologist: { id: 'me', firstName: 'Luis', lastName: 'Mora' },
  encounterId: 'e1',
  diagnosis: 'Cefalea tensional',
  content: 'Refiere mejoría con reposo.',
  version: 1,
  createdAt: '2026-10-01T15:45:00.000Z',
  sessionDate: '2026-10-01T15:45:00.000Z',
} as unknown as ClinicalNote;

const procedureSession = {
  id: 's1',
  status: 'CLINICAL_COMPLETE',
  startedAt: '2026-10-02T15:00:00.000Z',
  completedAt: '2026-10-02T15:40:00.000Z',
  procedureNotes: 'Infiltración sin incidentes.',
  treatment: { id: 'tr', name: 'Infiltración', version: 1 },
  professional: { id: 'me', firstName: 'Luis', lastName: 'Mora' },
} as unknown as TreatmentSessionSummary;

const ALL_SECTIONS = ['core.clinical.notes', 'core.clinical.specialties', 'core.treatments.sessions'];

beforeEach(() => {
  hooks.notes = query([clinicalNote]);
  hooks.encounters = query([consultation]);
  hooks.records = query([vitalsRecord]);
  hooks.procedures = query([procedureSession]);
  hooks.modules = [vitals];
  hooks.enabledArgs = {};
  hooks.sections = new Set(ALL_SECTIONS);
  useAuthStore.setState({
    user: {
      id: 'me',
      tenantId: 'tenant-1',
      role: UserRole.PROFESIONAL,
      professionalProfile: { isActive: true },
    } as unknown as User,
  });
});

const renderTab = (props: Partial<React.ComponentProps<typeof ClinicalHistoryTab>> = {}) =>
  render(<ClinicalHistoryTab patientId="patient-1" showProcedures {...props} />);

const entries = () => within(screen.getByRole('list', { name: 'Cronología clínica' })).getAllByRole('listitem');

describe('ClinicalHistoryTab', () => {
  it('reads every clinical source of the patient in one chronology, newest first', () => {
    renderTab();

    expect(entries().map((entry) => entry.querySelector('p')?.textContent)).toEqual([
      'Procedimiento',
      'Nota clínica',
      'Registro clínico',
      'Atención',
    ]);
    // The attention, with its reason and signature.
    expect(within(entries()[3]).getByText('Dolor de cabeza de una semana')).toBeInTheDocument();
    expect(within(entries()[3]).getByText('Firmada')).toBeInTheDocument();
    // The record, read with the definition it was written under.
    expect(within(entries()[2]).getByText('Signos vitales', { selector: 'p' })).toBeInTheDocument();
    expect(within(entries()[2]).getByText('70 kg')).toBeInTheDocument();
    expect(within(entries()[2]).getByRole('alert')).toHaveTextContent('Peso por debajo de lo esperado.');
    // The note, tied to its attention.
    expect(within(entries()[1]).getByText('Cefalea tensional')).toBeInTheDocument();
    expect(within(entries()[1]).getByText('Refiere mejoría con reposo.')).toBeInTheDocument();
    expect(within(entries()[1]).getByText(/Atención: Primera consulta · 01\/10\/2026/)).toBeInTheDocument();
    // The procedure.
    expect(within(entries()[0]).getByText('Infiltración')).toBeInTheDocument();
    expect(within(entries()[0]).getByText('Infiltración sin incidentes.')).toBeInTheDocument();
  });

  it('creates, corrects and removes nothing: it only reads', () => {
    renderTab();

    expect(screen.queryByRole('button', { name: /nueva nota|crear|guardar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /eliminar|corregir|adenda/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByText(/de solo lectura/)).toBeInTheDocument();
  });

  it('opens what it shows with a way back to the history, and never to Registros clínicos', () => {
    renderTab();

    expect(screen.getByRole('link', { name: 'Imprimir Signos vitales' })).toHaveAttribute(
      'href',
      '/patients/patient-1/records/r1/print?from=clinical',
    );
    expect(screen.getByRole('link', { name: /Ver atención/ })).toHaveAttribute(
      'href',
      '/treatment-sessions/s1?from=clinical',
    );
  });

  it('sends the work to Registros clínicos when asked', () => {
    const onOpenRecords = vi.fn();
    renderTab({ onOpenRecords });

    fireEvent.click(screen.getByRole('button', { name: 'Ir a Registros clínicos' }));
    expect(onOpenRecords).toHaveBeenCalledTimes(1);
  });

  it('offers no way to Registros clínicos when the page does not offer that tab', () => {
    renderTab();
    expect(screen.queryByRole('button', { name: 'Ir a Registros clínicos' })).not.toBeInTheDocument();
  });

  it('filters the chronology by kind', () => {
    renderTab();

    fireEvent.change(screen.getByLabelText('Mostrar'), { target: { value: 'note' } });
    expect(entries()).toHaveLength(1);
    expect(screen.getByText('Cefalea tensional')).toBeInTheDocument();
    expect(screen.queryByText('Signos vitales')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Mostrar'), { target: { value: '' } });
    expect(entries()).toHaveLength(4);
  });

  describe('respects the sections of the clinic', () => {
    it('reads no records nor attentions, and shows none, with the specialties section off', () => {
      hooks.sections.delete('core.clinical.specialties');
      renderTab();

      expect(hooks.enabledArgs).toMatchObject({ encounters: false, records: false, notes: true });
      expect(screen.queryByText('Signos vitales')).not.toBeInTheDocument();
      expect(screen.queryByText('Dolor de cabeza de una semana')).not.toBeInTheDocument();
      expect(screen.getByText('Cefalea tensional')).toBeInTheDocument();
    });

    it('reads no notes, and shows none, with the clinical notes section off', () => {
      hooks.sections.delete('core.clinical.notes');
      renderTab();

      expect(hooks.enabledArgs.notes).toBe(false);
      expect(screen.queryByText('Cefalea tensional')).not.toBeInTheDocument();
      expect(screen.getByText('Signos vitales', { selector: 'p' })).toBeInTheDocument();
    });

    it('reads no procedures unless the page allows them', () => {
      renderTab({ showProcedures: false });

      expect(hooks.enabledArgs.procedures).toBe(false);
      expect(screen.queryByText('Infiltración sin incidentes.')).not.toBeInTheDocument();
    });
  });

  it('asks for a professional profile and reads nothing without one', () => {
    useAuthStore.setState({
      user: { id: 'me', tenantId: 'tenant-1', role: UserRole.MASTER } as unknown as User,
    });
    renderTab();

    expect(screen.getByText('Acceso restringido')).toBeInTheDocument();
    expect(hooks.enabledArgs).toMatchObject({
      notes: false,
      encounters: false,
      records: false,
      procedures: false,
    });
  });

  it('says so when the patient has no clinical activity', () => {
    hooks.notes = query();
    hooks.encounters = query();
    hooks.records = query();
    hooks.procedures = query();
    renderTab();

    expect(screen.getByText('Aún no hay actividad clínica registrada de este paciente.')).toBeInTheDocument();
  });

  it('keeps showing what loaded when one source fails, and retries only the failed one', () => {
    hooks.records = { ...query(), isError: true };
    renderTab();

    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo cargar los registros.');
    expect(screen.getByText('Cefalea tensional')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(hooks.records.refetch).toHaveBeenCalledTimes(1);
    expect(hooks.notes.refetch).not.toHaveBeenCalled();
  });

  it('shows skeletons while nothing has loaded yet', () => {
    hooks.notes = { ...query(), data: undefined, isPending: true };
    hooks.encounters = { ...query(), data: undefined, isPending: true };
    hooks.records = { ...query(), data: undefined, isPending: true };
    hooks.procedures = { ...query(), data: undefined, isPending: true };
    renderTab();

    expect(screen.queryByRole('list', { name: 'Cronología clínica' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Aún no hay actividad/)).not.toBeInTheDocument();
  });
});
