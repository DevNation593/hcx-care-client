import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/store/authStore';
import type { SpecialtyRecord } from '@/types';
import type { ClinicalModuleDefinition, PatientClinicalAlert } from '@/types/clinical';
import { ClinicalRecordsTab } from './clinical-records-tab';
import { PatientClinicalAlerts } from './patient-clinical-alerts';

// Rendered without a QueryClient: name people as in a clinical practice.
vi.mock('@/hooks/usePatientTerms', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/usePatientTerms')>();
  return { ...actual, usePatientTerms: () => actual.patientTerms(false) };
});

const hooks = vi.hoisted(() => ({
  records: [] as unknown[],
  modules: [] as unknown[],
  alerts: [] as unknown[],
  encounters: [] as unknown[],
  create: vi.fn(),
  correct: vi.fn(),
  remove: vi.fn(),
}));

// Procedure consents have their own tests.
vi.mock('./procedure-consents', () => ({
  ProcedureConsents: () => <p>Consentimientos de procedimientos</p>,
}));
vi.mock('@/hooks/useSpecialtyRecords', () => ({
  usePatientSpecialtyRecords: () => ({ data: hooks.records, isLoading: false }),
  usePatientClinicalAlerts: () => ({ data: hooks.alerts }),
  useCreateSpecialtyRecord: () => ({ mutateAsync: hooks.create, isPending: false }),
  useCorrectSpecialtyRecord: () => ({ mutateAsync: hooks.correct, isPending: false }),
  useRemoveSpecialtyRecord: () => ({ mutateAsync: hooks.remove, isPending: false }),
}));
vi.mock('@/hooks/useEncounters', () => ({
  usePatientEncounters: () => ({ data: hooks.encounters }),
  useStartEncounter: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCloseEncounter: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRemoveEncounter: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('@/hooks/useBranches', () => ({ useBranches: () => ({ data: [] }) }));
vi.mock('@/hooks/useAppointments', () => ({ useAppointments: () => ({ data: [] }) }));
vi.mock('@/hooks/useClinicalModules', () => ({
  useClinicalModules: () => ({ data: hooks.modules, isError: false, isPending: false, error: null }),
}));

const vitals: ClinicalModuleDefinition = {
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
      {
        key: 'vitals',
        title: 'Signos vitales',
        fields: [
          { key: 'weightKg', label: 'Peso', type: 'decimal', unit: 'kg' },
          { key: 'oxygenSaturation', label: 'Saturación de oxígeno', type: 'integer', unit: '%' },
        ],
      },
    ],
  },
};
const legacyAssessment: ClinicalModuleDefinition = {
  ...vitals,
  moduleKey: 'nutrition.assessments',
  scope: 'SPECIALTY',
  specialtyCode: 'NUTRITION',
  name: 'Evaluación antropométrica',
  isLatest: false,
  legacy: true,
  canRecord: false,
  schema: {
    sections: [{ key: 'main', title: 'Datos', fields: [{ key: 'weightKg', label: 'Peso (kg)', type: 'text' }] }],
  },
};

const record = (overrides: Partial<SpecialtyRecord> = {}): SpecialtyRecord => ({
  id: 'record-1',
  patientId: 'patient-1',
  professionalId: 'me',
  specialtyId: 'nutrition',
  moduleKey: 'general.vital-signs',
  schemaVersion: 1,
  version: 1,
  recordDate: '2026-10-01T15:00:00.000Z',
  data: { weightKg: 70, oxygenSaturation: 88 },
  notes: 'Control mensual',
  alerts: [{ level: 'critical', message: 'Saturación de oxígeno menor al 90 %.' }],
  professional: { id: 'me', firstName: 'Luis', lastName: 'Mora' },
  specialty: { code: 'NUTRITION', name: 'Nutrición' },
  ...overrides,
});

const cardOf = (text: string) => screen.getByText(text).closest('.space-y-3') as HTMLElement;

beforeEach(() => {
  vi.clearAllMocks();
  hooks.modules = [vitals, legacyAssessment];
  hooks.records = [record()];
  hooks.alerts = [];
  hooks.encounters = [];
  hooks.create.mockResolvedValue(undefined);
  hooks.correct.mockResolvedValue(undefined);
  hooks.remove.mockResolvedValue(undefined);
  useAuthStore.setState({
    user: { id: 'me', tenantId: 'tenant-1' } as never,
    tenant: { id: 'tenant-1' } as never,
  });
});

describe('ClinicalRecordsTab', () => {
  it('reads each record with its definition, its author and its alerts', () => {
    render(<ClinicalRecordsTab patientId="patient-1" />);

    expect(screen.getByText('Luis Mora · Nutrición · 01/10/2026')).toBeInTheDocument();
    expect(screen.getByText('70 kg')).toBeInTheDocument();
    expect(screen.getByText('88 %')).toBeInTheDocument();
    expect(screen.getByText('Control mensual')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Saturación de oxígeno menor al 90 %.');
  });

  it('offers only the modules the professional can record', () => {
    render(<ClinicalRecordsTab patientId="patient-1" />);

    const select = screen.getByLabelText('Tipo de registro');
    expect(within(select).getByRole('option', { name: 'Signos vitales' })).toBeInTheDocument();
    expect(within(select).queryByRole('option', { name: 'Evaluación antropométrica' })).not.toBeInTheDocument();
  });

  describe('with encounters', () => {
    const openEncounter = {
      id: 'encounter-1',
      professionalId: 'me',
      status: 'OPEN',
      encounterType: 'CONTROL',
      reason: 'Control mensual de peso',
      startedAt: '2026-10-03T15:00:00.000Z',
      recordCount: 0,
    };
    const saveVitals = async () => {
      fireEvent.change(screen.getByLabelText('Tipo de registro'), { target: { value: 'general.vital-signs' } });
      fireEvent.change(document.getElementById('record-weightKg')!, { target: { value: '70' } });
      await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Guardar registro' })));
    };

    it('writes new records into the open encounter of the professional', async () => {
      hooks.encounters = [openEncounter];
      render(<ClinicalRecordsTab patientId="patient-1" />);

      expect(screen.getByText('Atención en curso')).toBeInTheDocument();
      await saveVitals();

      expect(hooks.create).toHaveBeenCalledWith(
        expect.objectContaining({ moduleKey: 'general.vital-signs', encounterId: 'encounter-1' }),
      );
    });

    it('leaves the record outside any encounter when the open one belongs to someone else', async () => {
      hooks.encounters = [{ ...openEncounter, professionalId: 'someone-else' }];
      render(<ClinicalRecordsTab patientId="patient-1" />);

      expect(screen.queryByText('Atención en curso')).not.toBeInTheDocument();
      fireEvent.change(screen.getByLabelText('Tipo de registro'), { target: { value: 'general.vital-signs' } });
      fireEvent.change(document.getElementById('record-weightKg')!, { target: { value: '70' } });
      // Outside an encounter it is signed as it is saved: the password is asked.
      const save = screen.getByRole('button', { name: 'Guardar y firmar' });
      expect(save).toBeDisabled();
      fireEvent.change(screen.getByLabelText(/Tu contraseña para firmar/), { target: { value: 'Clave-1' } });
      await act(async () => fireEvent.click(save));

      expect(hooks.create.mock.calls[0][0]).not.toHaveProperty('encounterId');
      expect(hooks.create.mock.calls[0][0]).toMatchObject({ password: 'Clave-1' });
    });

    it('asks no password for a record written into the open encounter', async () => {
      hooks.encounters = [openEncounter];
      render(<ClinicalRecordsTab patientId="patient-1" />);

      await saveVitals();

      expect(screen.queryByLabelText(/Tu contraseña para firmar/)).not.toBeInTheDocument();
      expect(hooks.create.mock.calls[0][0]).not.toHaveProperty('password');
    });

    it('says which encounter a record belongs to and links to its printable document', () => {
      hooks.records = [
        record({
          encounter: { id: 'encounter-1', encounterType: 'CONTROL', status: 'CLOSED', startedAt: '2026-10-01T15:00:00.000Z' },
        }),
      ];
      render(<ClinicalRecordsTab patientId="patient-1" />);

      expect(screen.getByText('Atención: Control · 01/10/2026')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Imprimir Signos vitales' })).toHaveAttribute(
        'href',
        '/patients/patient-1/records/record-1/print',
      );
    });
  });

  it('lets only the author correct or remove a record', () => {
    hooks.records = [record(), record({ id: 'record-2', professionalId: 'someone-else', notes: 'De otro profesional' })];
    render(<ClinicalRecordsTab patientId="patient-1" />);

    expect(screen.getAllByRole('button', { name: 'Corregir Signos vitales' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Eliminar Signos vitales' })).toHaveLength(1);
  });

  it('corrects a record with a reason and the data of its own version', async () => {
    render(<ClinicalRecordsTab patientId="patient-1" />);

    fireEvent.click(screen.getByRole('button', { name: 'Corregir Signos vitales' }));
    const save = screen.getByRole('button', { name: 'Guardar corrección' });
    // Nothing is sent without a reason.
    expect(save).toBeDisabled();

    fireEvent.change(document.getElementById('correct-weightKg')!, { target: { value: '69.5' } });
    fireEvent.change(screen.getByLabelText(/Motivo/), { target: { value: ' Peso mal digitado ' } });
    await act(async () => fireEvent.click(save));

    expect(hooks.correct).toHaveBeenCalledWith({
      recordId: 'record-1',
      data: {
        data: { weightKg: 69.5, oxygenSaturation: 88 },
        notes: 'Control mensual',
        changeReason: 'Peso mal digitado',
        // The version edited: a save made by someone else since answers 409.
        version: 1,
      },
    });
    expect(screen.queryByRole('button', { name: 'Guardar corrección' })).not.toBeInTheDocument();
  });

  it('corrects only the notes of a record in the pre-definition format', async () => {
    hooks.records = [
      record({ moduleKey: 'nutrition.assessments', data: { weightKg: '70', bmi: 24 }, alerts: [] }),
    ];
    render(<ClinicalRecordsTab patientId="patient-1" />);

    // The legacy version still names its fields; extra keys are shown as stored.
    expect(screen.getByText('Peso (kg)')).toBeInTheDocument();
    expect(screen.getByText('bmi')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Corregir Evaluación antropométrica' }));
    expect(screen.getByText(/solo se pueden corregir sus notas/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Notas adicionales', { selector: '#correct-notes' }), {
      target: { value: '' },
    });
    fireEvent.change(screen.getByLabelText(/Motivo/), { target: { value: 'Nota equivocada' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Guardar corrección' })));

    expect(hooks.correct).toHaveBeenCalledWith({
      recordId: 'record-1',
      data: { notes: null, changeReason: 'Nota equivocada', version: 1 },
    });
  });

  it('removes a record only with a reason', async () => {
    render(<ClinicalRecordsTab patientId="patient-1" />);

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar Signos vitales' }));
    const confirm = screen.getByRole('button', { name: 'Eliminar registro' });
    expect(confirm).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Motivo/), { target: { value: 'Paciente equivocado' } });
    await act(async () => fireEvent.click(confirm));

    expect(hooks.remove).toHaveBeenCalledWith({ recordId: 'record-1', reason: 'Paciente equivocado' });
  });

  it('marks corrected records and filters the history by module', () => {
    hooks.records = [
      record({ version: 3 }),
      record({ id: 'record-2', moduleKey: 'nutrition.assessments', data: { weightKg: '71' }, alerts: [], notes: null }),
    ];
    render(<ClinicalRecordsTab patientId="patient-1" />);

    expect(within(cardOf('Control mensual')).getByText('Corregido')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Mostrar'), { target: { value: 'nutrition.assessments' } });
    expect(screen.queryByText('Control mensual')).not.toBeInTheDocument();
    expect(screen.getByText('71')).toBeInTheDocument();
  });

  describe('signed records', () => {
    const signed = (overrides: Partial<SpecialtyRecord> = {}) =>
      record({ signed: true, signedAt: '2026-10-01T16:00:00.000Z', ...overrides });

    it('offers its author an addendum instead of correcting or removing it', () => {
      hooks.records = [signed()];
      render(<ClinicalRecordsTab patientId="patient-1" />);

      expect(within(cardOf('Control mensual')).getByText('Firmado')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Corregir con adenda Signos vitales' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Corregir Signos vitales' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Eliminar Signos vitales' })).not.toBeInTheDocument();
    });

    it('offers no addendum to someone who is not the author', () => {
      hooks.records = [signed({ professionalId: 'someone-else' })];
      render(<ClinicalRecordsTab patientId="patient-1" />);

      expect(screen.queryByRole('button', { name: /adenda/i })).not.toBeInTheDocument();
    });

    it('saves the addendum with its reason, linked to the signed record', async () => {
      hooks.records = [signed()];
      render(<ClinicalRecordsTab patientId="patient-1" />);

      fireEvent.click(screen.getByRole('button', { name: 'Corregir con adenda Signos vitales' }));
      const save = screen.getByRole('button', { name: 'Guardar adenda' });
      expect(save).toBeDisabled();

      fireEvent.change(document.getElementById('amend-weightKg')!, { target: { value: '69.5' } });
      fireEvent.change(screen.getByLabelText(/Motivo/), { target: { value: ' Peso mal digitado ' } });
      // An addendum is a signature: it waits for the password.
      expect(save).toBeDisabled();
      fireEvent.change(screen.getByLabelText(/Tu contraseña para firmar/), { target: { value: 'Clave-1' } });
      await act(async () => fireEvent.click(save));

      expect(hooks.create).toHaveBeenCalledWith({
        password: 'Clave-1',
        moduleKey: 'general.vital-signs',
        schemaVersion: 1,
        data: { weightKg: 69.5, oxygenSaturation: 88 },
        notes: 'Control mensual',
        amendsRecordId: 'record-1',
        amendmentReason: 'Peso mal digitado',
      });
      expect(hooks.correct).not.toHaveBeenCalled();
    });

    it('shows a corrected record as superseded, and its addendum with the reason', () => {
      hooks.records = [
        signed({ id: 'addendum', amendsRecordId: 'record-1', amendmentReason: 'Peso mal digitado', notes: 'Nueva' }),
        signed({ amendedBy: { id: 'addendum', createdAt: '2026-10-02T09:00:00.000Z' } }),
      ];
      render(<ClinicalRecordsTab patientId="patient-1" />);

      const original = cardOf('Control mensual');
      expect(within(original).getByText('Corregido por adenda')).toBeInTheDocument();
      expect(within(original).queryByRole('button', { name: /adenda/i })).not.toBeInTheDocument();

      const addendum = cardOf('Nueva');
      expect(within(addendum).getByText('Adenda')).toBeInTheDocument();
      expect(within(addendum).getByText('Peso mal digitado')).toBeInTheDocument();
      // The addendum itself can be corrected with another one.
      expect(within(addendum).getByRole('button', { name: /Corregir con adenda/ })).toBeInTheDocument();
    });

    it('drops an edit that the record no longer accepts and lets the history reload', async () => {
      hooks.correct.mockRejectedValue({ code: 'CLINICAL_RECORD_VERSION_CONFLICT', message: 'Alguien más modificó este registro.' });
      render(<ClinicalRecordsTab patientId="patient-1" />);

      fireEvent.click(screen.getByRole('button', { name: 'Corregir Signos vitales' }));
      fireEvent.change(screen.getByLabelText(/Motivo/), { target: { value: 'x' } });
      await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Guardar corrección' })));

      expect(screen.queryByRole('button', { name: 'Guardar corrección' })).not.toBeInTheDocument();
    });

    it('warns that without an open encounter a record is signed as it is saved', () => {
      render(<ClinicalRecordsTab patientId="patient-1" />);

      expect(screen.getByText(/queda firmado al instante/)).toBeInTheDocument();
    });
  });

  it('takes procedure consents only for a health professional', () => {
    const { unmount } = render(<ClinicalRecordsTab patientId="patient-1" />);
    expect(screen.getByText('Consentimientos de procedimientos')).toBeInTheDocument();
    unmount();

    // An aesthetic professional takes consents inside a treatment session; the API refuses this one.
    useAuthStore.setState({
      user: {
        id: 'me',
        tenantId: 'tenant-1',
        professionalProfile: { isActive: true, specialty: { code: 'AESTHETICS' } },
      } as never,
    });
    render(<ClinicalRecordsTab patientId="patient-1" />);
    expect(screen.queryByText('Consentimientos de procedimientos')).not.toBeInTheDocument();
  });

  it('says so when the patient has no records', () => {
    hooks.records = [];
    render(<ClinicalRecordsTab patientId="patient-1" />);

    expect(screen.getByText('Aún no hay registros clínicos de este paciente.')).toBeInTheDocument();
  });
});

describe('PatientClinicalAlerts', () => {
  const alert = (overrides: Partial<PatientClinicalAlert>): PatientClinicalAlert => ({
    level: 'critical',
    message: 'Alergia grave registrada.',
    recordId: 'allergy-1',
    moduleKey: 'general.allergies',
    moduleName: 'Alergias',
    recordDate: '2026-09-01T10:00:00.000Z',
    ...overrides,
  });

  it('renders nothing when the patient has no alerts', () => {
    const { container } = render(<PatientClinicalAlerts patientId="patient-1" />);

    expect(container).toBeEmptyDOMElement();
  });

  it('lists critical alerts first, with the record they come from', () => {
    hooks.alerts = [
      alert({ level: 'info', message: 'PHQ-9 entre 10 y 14.', recordId: 'phq', moduleName: 'PHQ-9' }),
      alert({}),
    ];
    render(<PatientClinicalAlerts patientId="patient-1" />);

    const region = screen.getByRole('region', { name: 'Alertas clínicas' });
    const items = within(region).getAllByText(/registrada|PHQ-9 entre/);
    expect(items.map((item) => item.textContent)).toEqual([
      'Alergia grave registrada.',
      'PHQ-9 entre 10 y 14.',
    ]);
    expect(within(region).getByRole('alert')).toHaveTextContent('Alergias · 01/09/2026');
  });
});
