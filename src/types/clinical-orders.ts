/** Orders, results and follow-ups, as the API returns them (decrypted). */

export type ClinicalOrderType =
  | 'LABORATORY'
  | 'IMAGING'
  | 'PATHOLOGY'
  | 'PROCEDURE'
  | 'THERAPY'
  | 'INTERCONSULTATION'
  | 'OTHER';

export type ClinicalOrderPriority = 'ROUTINE' | 'PREFERENTIAL' | 'URGENT';

export type ClinicalOrderStatus =
  | 'ORDERED'
  | 'SAMPLE_COLLECTED'
  | 'SENT_TO_LAB'
  | 'PENDING_REVIEW'
  | 'REVIEWED'
  | 'PATIENT_CONTACTED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NOT_PERFORMED';

export type ClinicalResultStatus = 'PENDING_REVIEW' | 'REVIEWED' | 'SUPERSEDED';
export type ResultReviewDecision = 'NO_FURTHER_ACTION' | 'FOLLOW_UP_REQUIRED' | 'REPEAT_REQUIRED';
export type PatientContactChannel = 'IN_PERSON' | 'PHONE' | 'VIDEO_CALL' | 'MESSAGE' | 'OTHER';
export type ClinicalFollowUpStatus = 'OPEN' | 'DONE' | 'CANCELLED';

export const ORDER_TYPE_LABELS: Record<ClinicalOrderType, string> = {
  LABORATORY: 'Laboratorio',
  IMAGING: 'Imagen',
  PATHOLOGY: 'Anatomía patológica',
  PROCEDURE: 'Procedimiento',
  THERAPY: 'Terapia',
  INTERCONSULTATION: 'Interconsulta',
  OTHER: 'Otro',
};

export const ORDER_PRIORITY_LABELS: Record<ClinicalOrderPriority, string> = {
  ROUTINE: 'Rutina',
  PREFERENTIAL: 'Preferente',
  URGENT: 'Urgente',
};

export const ORDER_STATUS_LABELS: Record<ClinicalOrderStatus, string> = {
  ORDERED: 'Ordenada',
  SAMPLE_COLLECTED: 'Muestra tomada',
  SENT_TO_LAB: 'Enviada al laboratorio',
  PENDING_REVIEW: 'Resultado por revisar',
  REVIEWED: 'Revisada, falta informar',
  PATIENT_CONTACTED: 'Paciente informado',
  COMPLETED: 'Cerrada',
  CANCELLED: 'Anulada',
  NOT_PERFORMED: 'No realizada',
};

export const REVIEW_DECISION_LABELS: Record<ResultReviewDecision, string> = {
  NO_FURTHER_ACTION: 'Sin acciones adicionales',
  FOLLOW_UP_REQUIRED: 'Requiere seguimiento',
  REPEAT_REQUIRED: 'Repetir el estudio',
};

export const CONTACT_CHANNEL_LABELS: Record<PatientContactChannel, string> = {
  IN_PERSON: 'En consulta',
  PHONE: 'Teléfono',
  VIDEO_CALL: 'Videollamada',
  MESSAGE: 'Mensaje',
  OTHER: 'Otro',
};

export const FOLLOW_UP_STATUS_LABELS: Record<ClinicalFollowUpStatus, string> = {
  OPEN: 'Abierto',
  DONE: 'Realizado',
  CANCELLED: 'Cancelado',
};

interface PersonRef {
  id: string;
  firstName: string;
  lastName: string;
}

export interface ClinicalFollowUp {
  id: string;
  patientId: string;
  orderId: string | null;
  resultId: string | null;
  title: string;
  description: string | null;
  assignedToId: string;
  assignedTo: PersonRef | null;
  createdById: string;
  dueDate: string;
  status: ClinicalFollowUpStatus;
  closedAt: string | null;
  closedById: string | null;
  closureNote: string | null;
  version: number;
  createdAt: string;
  patient?: PersonRef | null;
  overdue?: boolean;
}

export interface ClinicalResult {
  id: string;
  orderId: string;
  patientId: string;
  version: number;
  enteredById: string;
  enteredBy: PersonRef | null;
  receivedAt: string;
  studyDate: string | null;
  issuedBy: string | null;
  content: string | null;
  fileId: string | null;
  file: { id: string; fileName: string; mimeType: string; sizeBytes: number } | null;
  recordId: string | null;
  contentHash: string;
  status: ClinicalResultStatus;
  reviewedAt: string | null;
  reviewedById: string | null;
  reviewedBy: PersonRef | null;
  reviewDecision: ResultReviewDecision | null;
  reviewNote: string | null;
  appointmentNeeded: boolean;
  communicatedAt: string | null;
  communicatedById: string | null;
  communicationChannel: PatientContactChannel | null;
  communicationNote: string | null;
}

export interface ClinicalOrder {
  id: string;
  patientId: string;
  orderedById: string;
  orderedBy: PersonRef | null;
  encounterId: string | null;
  orderType: ClinicalOrderType;
  priority: ClinicalOrderPriority;
  studyName: string;
  indication: string | null;
  provider: string | null;
  externalReference: string | null;
  status: ClinicalOrderStatus;
  orderedAt: string;
  resultDueAt: string | null;
  sampleCollectedAt: string | null;
  sampleNotes: string | null;
  sentAt: string | null;
  completedAt: string | null;
  completionNote: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  signedAt: string | null;
  version: number;
  results: ClinicalResult[];
  currentResult: ClinicalResult | null;
  followUps: ClinicalFollowUp[];
}

export interface ClinicalOrderInput {
  orderType: ClinicalOrderType;
  studyName: string;
  indication?: string;
  priority?: ClinicalOrderPriority;
  provider?: string;
  resultDueAt?: string;
  encounterId?: string;
  password?: string;
}

export interface FollowUpInput {
  title: string;
  description?: string;
  dueDate: string;
  assignedToId?: string;
}

export interface ResultInput {
  version: number;
  content?: string;
  fileId?: string;
  issuedBy?: string;
  studyDate?: string;
}

export interface ReviewInput {
  decision: ResultReviewDecision;
  note: string;
  appointmentNeeded?: boolean;
  followUp?: FollowUpInput;
}

/** An order as the inbox lists it: only what identifies it, with the patient. */
export interface InboxOrder {
  id: string;
  patientId: string;
  orderType: ClinicalOrderType;
  priority: ClinicalOrderPriority;
  studyName: string;
  provider: string | null;
  externalReference: string | null;
  status: ClinicalOrderStatus;
  orderedAt: string;
  resultDueAt: string | null;
  sentAt: string | null;
  version: number;
  orderedBy: PersonRef | null;
  patient: PersonRef;
  overdue?: boolean;
}

export type InboxScope = 'mine' | 'all';

export interface ClinicalInbox {
  scope: InboxScope;
  /** Each list holds `pageSize` items of page `page`, the oldest first; `totals` counts them all. */
  page: number;
  pageSize: number;
  totals: { pendingReview: number; awaitingResult: number; toCommunicate: number; followUps: number };
  thresholds: { resultReviewAlertDays: number; orderResultAlertDays: number };
  pendingReview: (ClinicalResult & { order: InboxOrder; overdue: boolean })[];
  awaitingResult: (InboxOrder & { overdue: boolean })[];
  toCommunicate: InboxOrder[];
  followUps: (ClinicalFollowUp & { overdue: boolean })[];
}

/** Statuses of an order that is still waiting for its result. */
export const AWAITING_RESULT_STATUSES: ClinicalOrderStatus[] = ['ORDERED', 'SAMPLE_COLLECTED', 'SENT_TO_LAB'];

/** Orders that take no more steps. */
export const CLOSED_ORDER_STATUSES: ClinicalOrderStatus[] = ['COMPLETED', 'CANCELLED', 'NOT_PERFORMED'];

/** The legacy order form: orders are now placed from their own tab, not as a free record. */
export const LEGACY_ORDER_MODULE_KEY = 'general.orders';
