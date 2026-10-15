import type { FormSchema } from './clinical';

// Mirrors the API JSON of treatments, consent templates and treatment sessions.
// Dates are ISO strings; money fields are numbers.

export type TreatmentSessionStatus =
  | 'INTAKE_IN_PROGRESS'
  | 'READY_FOR_CONSENT'
  | 'CONSENTED'
  | 'IN_PROGRESS'
  | 'CLINICAL_COMPLETE'
  | 'CONSENT_REFUSED'
  | 'CONSENT_REVOKED'
  | 'CANCELLED'
  | 'NO_SHOW';

/** What a blocked start or completion is missing, as the API reports it in `missing`. */
export type MissingRequirement =
  | 'FINALIZED_MEDICAL_FORM'
  | 'SIGNED_APPLICABLE_CONSENT'
  | 'BEFORE_PHOTOS'
  | 'CLINICAL_NOTES'
  | 'AFTER_PHOTOS';

export type ConsentTemplateVersionStatus = 'DRAFT' | 'PUBLISHED' | 'RETIRED';
export type ConsentDocumentStatus = 'PRESENTED' | 'SIGNED' | 'REFUSED' | 'REVOKED';
export type ConsentSignerRole = 'PATIENT' | 'REPRESENTATIVE';
export type SessionMediaPhase = 'BEFORE' | 'AFTER' | 'OTHER';

/** Commands the session accepts in its current status. */
export type SessionCommandName =
  | 'SAVE_FORM'
  | 'PRESENT_CONSENT'
  | 'SIGN_CONSENT'
  | 'REFUSE_CONSENT'
  | 'REVOKE_CONSENT'
  | 'UPLOAD_BEFORE'
  | 'UPLOAD_AFTER'
  | 'UPLOAD_OTHER'
  | 'START'
  | 'COMPLETE'
  | 'CANCEL'
  | 'NO_SHOW';

export const SESSION_STATUS_LABELS: Record<TreatmentSessionStatus, string> = {
  INTAKE_IN_PROGRESS: 'Ficha en curso',
  READY_FOR_CONSENT: 'Pendiente de consentimiento',
  CONSENTED: 'Consentimiento firmado',
  IN_PROGRESS: 'En procedimiento',
  CLINICAL_COMPLETE: 'Cerrada',
  CONSENT_REFUSED: 'Consentimiento rechazado',
  CONSENT_REVOKED: 'Consentimiento revocado',
  CANCELLED: 'Cancelada',
  NO_SHOW: 'No asistió',
};

export const MISSING_REQUIREMENT_LABELS: Record<MissingRequirement, string> = {
  FINALIZED_MEDICAL_FORM: 'Falta la ficha',
  SIGNED_APPLICABLE_CONSENT: 'Falta el consentimiento firmado',
  BEFORE_PHOTOS: 'Faltan fotos de antes',
  CLINICAL_NOTES: 'Faltan las notas del procedimiento',
  AFTER_PHOTOS: 'Faltan fotos de después',
};

/** What a treatment demands before a session starts and before it is completed. */
export interface TreatmentRequirements {
  medicalForm: { required: boolean };
  informedConsent: { required: boolean; validityDays: number | null };
  photos: { minimumBefore: number; minimumAfter: number };
  clinicalNotes: { requiredForCompletion: boolean };
}

// ==========================================
// TREATMENTS
// ==========================================

/** An immutable snapshot of a treatment's price and requirements. */
export interface TreatmentVersion {
  id: string;
  tenantId: string;
  treatmentId: string;
  version: number;
  price: number;
  taxRatePercent: number;
  durationMinutes: number;
  formDefinitionId: string | null;
  formVersion: number | null;
  consentTemplateVersionId: string | null;
  requirements: TreatmentRequirements;
  createdById: string;
  createdAt: string;
}

export interface Treatment {
  id: string;
  tenantId: string;
  name: string;
  category: string | null;
  specialtyId: string | null;
  isActive: boolean;
  currentVersion: number;
  createdAt: string;
  updatedAt: string;
}

/** The catalog listing: each treatment with its current version. */
export interface TreatmentWithCurrent extends Treatment {
  current: TreatmentVersion;
}

/** A treatment with every version, newest first. */
export interface TreatmentWithVersions extends Treatment {
  versions: TreatmentVersion[];
}

export interface TreatmentFilters {
  active?: boolean;
}

/** A version being created; keys left out of `requirements` take their defaults. */
export interface TreatmentVersionInput {
  price: number;
  taxRatePercent: number;
  durationMinutes: number;
  formDefinitionId?: string | null;
  formVersion?: number | null;
  consentTemplateVersionId?: string | null;
  requirements?: {
    medicalForm?: Partial<TreatmentRequirements['medicalForm']>;
    informedConsent?: Partial<TreatmentRequirements['informedConsent']>;
    photos?: Partial<TreatmentRequirements['photos']>;
    clinicalNotes?: Partial<TreatmentRequirements['clinicalNotes']>;
  };
}

export interface TreatmentInput {
  name: string;
  category?: string;
  specialtyId?: string;
  version: TreatmentVersionInput;
}

export interface TreatmentUpdate {
  name?: string;
  category?: string | null;
  specialtyId?: string | null;
  isActive?: boolean;
}

// ==========================================
// CONSENT TEMPLATES
// ==========================================

/** A version as the template listing returns it: without the text. */
export interface ConsentTemplateVersionSummary {
  id: string;
  version: number;
  title: string;
  status: ConsentTemplateVersionStatus;
  checksum: string;
  publishedAt: string | null;
  retiredAt: string | null;
  createdAt: string;
}

export interface ConsentTemplateVersion extends ConsentTemplateVersionSummary {
  tenantId: string;
  templateId: string;
  body: string;
  createdById: string;
  updatedAt: string;
}

interface ConsentTemplateBase {
  id: string;
  tenantId: string;
  name: string;
  isActive: boolean;
  /** Number of the latest published version (1 until the first publish). */
  currentVersion: number;
  createdAt: string;
  updatedAt: string;
}

/** The listing: the state of each version, newest first, without the text. */
export interface ConsentTemplateSummary extends ConsentTemplateBase {
  versions: ConsentTemplateVersionSummary[];
}

/** A template with the text of every version, newest first. */
export interface ConsentTemplate extends ConsentTemplateBase {
  versions: ConsentTemplateVersion[];
}

export interface ConsentTemplateInput {
  name: string;
  title: string;
  body: string;
}

export interface ConsentDraftInput {
  title: string;
  body: string;
}

// ==========================================
// CONSENT DOCUMENTS
// ==========================================

/** A consent as the session detail lists it: title and checksum, never the body. */
export interface ConsentDocumentSummary {
  id: string;
  treatmentSessionId: string;
  templateVersionId: string;
  title: string;
  checksum: string;
  status: ConsentDocumentStatus;
  presentedAt: string;
  signedAt: string | null;
  refusedAt: string | null;
  revokedAt: string | null;
  pdfChecksum: string | null;
  createdAt: string;
}

/** What the consent routes return; `body` comes only when the document is presented. */
export interface ConsentDocument extends ConsentDocumentSummary {
  tenantId: string;
  patientId: string;
  body?: string;
  updatedAt: string;
}

export interface SignConsentInput {
  signerRole: ConsentSignerRole;
  signerName: string;
  signerIdentification?: string;
  /** Required when the signer is a representative. */
  relationship?: string;
  understood: boolean;
  questionsAnswered: boolean;
  marketingPhotos: boolean;
  /** The drawn signature as a PNG data URL. */
  signature: string;
}

// ==========================================
// TREATMENT SESSIONS
// ==========================================

export interface SessionTreatment {
  id: string;
  name: string;
  version: number;
}

interface TreatmentSessionBase {
  id: string;
  tenantId: string;
  patientId: string;
  professionalId: string;
  branchId: string | null;
  appointmentId: string | null;
  treatmentVersionId: string;
  encounterId: string;
  formRecordId: string | null;
  consentDocumentId: string | null;
  status: TreatmentSessionStatus;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

/** A session in the patient's list: no clinical text. */
export interface TreatmentSessionSummary extends TreatmentSessionBase {
  treatment: SessionTreatment;
  professional: { id: string; firstName: string; lastName: string };
}

export interface SessionPatient {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  identificationNumber: string | null;
  guardianName: string | null;
  guardianRelationship: string | null;
  guardianIdentification: string | null;
}

/** A photo of the session; its bytes are not part of the detail. */
export interface SessionMedia {
  id: string;
  treatmentSessionId: string;
  encounterId: string | null;
  uploadedById: string;
  phase: SessionMediaPhase;
  category: string;
  fileName: string;
  description: string | null;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

/** The medical form the treatment pins, with the answers saved so far. */
export interface SessionForm {
  formDefinitionId: string;
  formVersion: number;
  name: string;
  schema: FormSchema;
  data: Record<string, unknown> | null;
}

export interface TreatmentSessionDetail extends TreatmentSessionBase {
  procedureNotes: string | null;
  cancellationReason: string | null;
  patient: SessionPatient;
  treatment: SessionTreatment;
  policy: TreatmentRequirements;
  /** Null when the treatment asks for no medical form. */
  form: SessionForm | null;
  consentDocuments: ConsentDocumentSummary[];
  media: SessionMedia[];
  requirements: { start: MissingRequirement[]; complete: MissingRequirement[] };
  allowedCommands: SessionCommandName[];
}

export interface TreatmentSessionInput {
  treatmentId: string;
  appointmentId?: string;
  branchId?: string;
}
