// Contracts of the clinical module definitions and tenant forms served by the API.

export type FormFieldType =
  | 'text'
  | 'textarea'
  | 'integer'
  | 'decimal'
  | 'date'
  | 'time'
  | 'checkbox'
  | 'radio'
  | 'select'
  | 'multiselect'
  | 'scale'
  | 'table'
  | 'calculated'
  // A handwritten signature drawn on screen: a PNG data URL.
  | 'signature';

export type FormAlertLevel = 'info' | 'warning' | 'critical';

export interface FormFieldOption {
  value: string;
  label: string;
}

export interface FormField {
  key: string;
  label: string;
  type: FormFieldType;
  required?: boolean;
  help?: string;
  unit?: string;
  min?: number;
  max?: number;
  maxLength?: number;
  options?: FormFieldOption[];
  columns?: FormField[];
  minRows?: number;
  maxRows?: number;
  /** Computed by the API when the record is saved. */
  formula?: string;
  /** Text fields only: the catalog suggestions come from. The value stays free text. */
  lookup?: 'diagnosis' | 'medication';
}

export interface FormSection {
  key: string;
  title: string;
  description?: string;
  fields: FormField[];
}

export interface FormAlertRule {
  when: string;
  level: FormAlertLevel;
  message: string;
}

export interface FormSchema {
  sections: FormSection[];
  alerts?: FormAlertRule[];
}

export interface FormAlert {
  level: FormAlertLevel;
  message: string;
}

/** A problem the API found in a record or a form definition. */
export interface FormIssue {
  field: string;
  message: string;
}

/** One version of a platform module or of a form designed by the clinic. */
export interface ClinicalModuleDefinition {
  moduleKey: string;
  scope: 'GENERAL' | 'SPECIALTY' | 'CUSTOM';
  specialtyCode: string | null;
  name: string;
  description: string | null;
  category: string | null;
  schemaVersion: number;
  isLatest: boolean;
  renderer: 'FORM' | 'ODONTOGRAM';
  /** Written before definitions existed: free values under known keys. */
  legacy: boolean;
  schema: FormSchema;
  enabled: boolean;
  /** The signed-in professional may create records of this version. */
  canRecord: boolean;
}

export interface FormDefinitionVersion {
  id: string;
  version: number;
  schema: FormSchema;
  createdAt: string;
}

export interface FormDefinition {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  specialtyId: string | null;
  specialty: { id: string; code: string; name: string } | null;
  isActive: boolean;
  currentVersion: number;
  versions: FormDefinitionVersion[];
  createdAt: string;
  updatedAt: string;
}

export interface FormDefinitionInput {
  name: string;
  description?: string | null;
  category?: string | null;
  specialtyCode?: string | null;
  schema: FormSchema;
}

export type FormDefinitionUpdate = Partial<FormDefinitionInput> & { isActive?: boolean };

export interface ClinicalRecordInput {
  moduleKey: string;
  schemaVersion: number;
  data: Record<string, unknown>;
  notes?: string;
  recordDate?: string;
  appointmentId?: string;
  /** An open encounter of the signed-in professional; the record is written in it. */
  encounterId?: string;
  /** Makes it an addendum to that signed record of the author, with the reason. */
  amendsRecordId?: string;
  amendmentReason?: string;
  /** Required when the record is signed as it is saved: an addendum, or outside any encounter. */
  password?: string;
}

export interface Branch {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  phone: string | null;
  openingHours: string | null;
  rooms: string[];
  isMain: boolean;
  isActive: boolean;
  /** Professionals tied to the branch. One tied to no branch attends in all of them. */
  professionalIds?: string[];
}

export interface BranchInput {
  name: string;
  address?: string;
  city?: string;
  phone?: string;
  openingHours?: string;
  rooms?: string[];
}

export type BranchUpdate = Partial<BranchInput> & { isActive?: boolean; isMain?: boolean };

export const ENCOUNTER_TYPES = [
  'FIRST_VISIT',
  'FOLLOW_UP',
  'CONTROL',
  'EMERGENCY',
  'TELECONSULTATION',
  'HOME_VISIT',
  'PROCEDURE',
  'ASSESSMENT',
  'INTERCONSULTATION',
] as const;
export type EncounterType = (typeof ENCOUNTER_TYPES)[number];

export const ENCOUNTER_TYPE_LABELS: Record<EncounterType, string> = {
  FIRST_VISIT: 'Primera consulta',
  FOLLOW_UP: 'Consulta subsecuente',
  CONTROL: 'Control',
  EMERGENCY: 'Emergencia',
  TELECONSULTATION: 'Teleconsulta',
  HOME_VISIT: 'Visita domiciliaria',
  PROCEDURE: 'Procedimiento',
  ASSESSMENT: 'Evaluación',
  INTERCONSULTATION: 'Interconsulta',
};

export interface Encounter {
  id: string;
  patientId: string;
  professionalId: string;
  specialtyId: string;
  appointmentId: string | null;
  branchId: string | null;
  encounterType: EncounterType;
  status: 'OPEN' | 'CLOSED';
  reason: string;
  summary: string | null;
  startedAt: string;
  closedAt: string | null;
  /** The signature taken at the close; null for encounters closed before signatures. */
  signedAt?: string | null;
  signedById?: string | null;
  contentHash?: string | null;
  recordCount: number;
  professional?: { id: string; firstName: string; lastName: string };
  specialty?: { id: string; code: string; name: string };
  branch?: { id: string; name: string } | null;
  appointment?: { id: string; title: string; startTime: string } | null;
}

export interface EncounterInput {
  encounterType: EncounterType;
  reason: string;
  appointmentId?: string;
  branchId?: string;
}

export const PATIENT_FILE_CATEGORY_LABELS = {
  EXAMEN: 'Examen o resultado',
  IMAGEN: 'Imagen',
  INFORME: 'Informe',
  CONSENTIMIENTO: 'Consentimiento firmado',
  RECETA: 'Receta',
  OTRO: 'Otro',
} as const;
export type PatientFileCategory = keyof typeof PATIENT_FILE_CATEGORY_LABELS;

/** A clinical file of the patient. Its bytes are downloaded through the API. */
export interface PatientFile {
  id: string;
  patientId: string;
  uploadedById: string;
  encounterId: string | null;
  category: PatientFileCategory;
  fileName: string;
  description: string | null;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  uploadedBy?: { id: string; firstName: string; lastName: string };
  /**
   * What the antivirus said. NOT_SCANNED: uploaded before scanning existed or with no antivirus
   * configured (scanned on its next download). INFECTED: quarantined, never served.
   */
  scanStatus?: 'NOT_SCANNED' | 'CLEAN' | 'INFECTED';
}

export interface DiagnosisCode {
  system: 'CIE10' | 'CIE11';
  code: string;
  description: string;
}

export interface Medication {
  id: string;
  commercialName: string;
  activeIngredient: string | null;
  concentration: string | null;
  presentation: string | null;
  pharmaceuticalForm: string | null;
  isActive: boolean;
}

export interface MedicationInput {
  commercialName: string;
  activeIngredient?: string;
  concentration?: string;
  presentation?: string;
  pharmaceuticalForm?: string;
}

export type MedicationUpdate = Partial<MedicationInput> & { isActive?: boolean };

export interface ClinicalRecordCorrection {
  data?: Record<string, unknown>;
  notes?: string | null;
  changeReason: string;
  /** The version edited: if someone saved since, the API answers 409 instead of overwriting. */
  version?: number;
}

export interface PatientClinicalAlert extends FormAlert {
  recordId: string;
  moduleKey: string;
  moduleName: string;
  recordDate: string;
}
