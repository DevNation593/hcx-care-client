import type { MissingRequirement } from './treatments';

// ==========================================
// ENUMS
// ==========================================

export enum UserRole {
  MASTER = 'MASTER',
  ADMIN = 'ADMIN',
  PROFESIONAL = 'PROFESIONAL',
  ASISTENTE = 'ASISTENTE',
  SOPORTE = 'SOPORTE',
  PACIENTE = 'PACIENTE',
}

export type SectionKey =
  | 'core.calendar'
  | 'core.patients'
  | 'core.tasks'
  | 'core.clinicalNotes'
  | 'core.specialties'
  | 'core.billing'
  | 'core.team'
  | 'core.storage';

export enum TenantType {
  PERSONAL = 'PERSONAL',
  CLINIC = 'CLINIC',
}

export enum PlanTier {
  TRIAL = 'TRIAL',
  BASIC = 'BASIC',
  PROFESSIONAL = 'PROFESSIONAL',
  ENTERPRISE = 'ENTERPRISE',
}

export enum SubscriptionStatus {
  TRIAL = 'TRIAL',
  ACTIVE = 'ACTIVE',
  PAST_DUE = 'PAST_DUE',
  SUSPENDED = 'SUSPENDED',
  CANCELED = 'CANCELED',
  ARCHIVED = 'ARCHIVED',
  DELETED = 'DELETED',
}

export enum AppointmentStatus {
  SCHEDULED = 'SCHEDULED',
  CONFIRMED = 'CONFIRMED',
  // Set while the appointment is being attended in an open encounter.
  IN_PROGRESS = 'IN_PROGRESS',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED',
  NO_SHOW = 'NO_SHOW',
}

export enum TaskStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum TaskPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export enum NotificationType {
  APPOINTMENT_REMINDER = 'APPOINTMENT_REMINDER',
  APPOINTMENT_CANCELLED = 'APPOINTMENT_CANCELLED',
  APPOINTMENT_RESCHEDULED = 'APPOINTMENT_RESCHEDULED',
  TASK_ASSIGNED = 'TASK_ASSIGNED',
  TASK_DUE = 'TASK_DUE',
  USER_INVITED = 'USER_INVITED',
  SUBSCRIPTION_UPDATED = 'SUBSCRIPTION_UPDATED',
  SYSTEM = 'SYSTEM',
}

export enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  NON_BINARY = 'NON_BINARY',
  PREFER_NOT_TO_SAY = 'PREFER_NOT_TO_SAY',
}

// ==========================================
// TENANT & PLAN
// ==========================================

export interface Plan {
  id: string;
  planType: PlanTier;
  name: string;
  description: string;
  basePrice: number; // cents
  currency: 'EUR';
  billingInterval: 'MONTHLY' | 'ANNUAL';
  limits: ResourceLimits;
  features: FeatureFlags;
  pricePerSeatMonthly: number; // cents
  pricePerSeatYearly: number; // cents
}

export interface ResourceLimits {
  maxPsychologists: number; // Billable seats
  maxAssistants: number | null; // null = unlimited
  maxPatients: number;
  storageGB: number;
  maxEmailsPerMonth: number;
  maxPushPerMonth: number;
  maxSmsPerMonth: number;
  maxApiRequestsPerHour: number | null;
}

export interface FeatureFlags {
  // Core features (all plans)
  dashboard: boolean;
  calendar: boolean;
  appointments: boolean;
  patients: boolean;
  
  // Advanced features
  clinicalNotes: boolean;
  tasks: boolean;
  attachments: boolean;
  sessionPlans: boolean;
  
  // Notifications
  inAppNotifications: boolean;
  emailNotifications: boolean;
  webPush: boolean;
  smsNotifications: boolean;
  
  // Analytics & Reports
  basicStats: boolean;
  advancedAnalytics: boolean;
  customReports: boolean;
  dataExport: boolean;
  
  // Integrations
  googleCalendarSync: boolean;
  videoIntegration: boolean;
  apiAccess: 'none' | 'read' | 'full';
  webhooks: boolean;
  
  // Security & Compliance
  mfa: boolean;
  sso: boolean;
  auditLogs: boolean;
  customBranding: boolean;
}

export interface Subscription {
  id: string;
  tenantId: string;
  plan: Plan;
  /** The plan as the API names it; `plan.planType` only keeps the tier. */
  apiPlanType?: ApiPlanType;
  status: SubscriptionStatus;
  trialEndsAt: string | null;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  canceledAt: string | null;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
  updatedAt: string;
  specialtyPricing?: {
    includedSpecialties: number;
    selectedSpecialties: number;
    specialtyUnitPrice: number;
    currency?: string;
  };
}

export interface UsageMetrics {
  tenantId: string;
  period: {
    start: string;
    end: string;
  };
  users: {
    admins: {
      total: number;
      active: number;
    };
    professionals: {
      total: number;
      active: number;
      inactive: number;
      limit: number;
      percentUsed: number;
    };
    /** @deprecated Use professionals. */
    psychologists: {
      total: number;
      active: number; // Billable count
      inactive: number;
      limit: number;
      percentUsed: number; // 0-100
    };
    assistants: {
      total: number;
      active: number;
      limit: number | null;
    };
  };
  patients: {
    total: number;
    active: number;
    archived: number;
    limit: number;
    percentUsed: number;
  };
  storage: {
    usedGB: number;
    limitGB: number;
    percentUsed: number;
    breakdown: {
      attachments: number;
      avatars: number;
      exports: number;
    };
  };
  notifications: {
    email: {
      sent: number;
      limit: number;
      percentUsed: number;
    };
    push: {
      sent: number;
      limit: number;
      percentUsed: number;
    };
    sms: {
      sent: number;
      limit: number;
      percentUsed: number;
    };
  };
  appointments: {
    total: number;
    completed: number;
    upcoming: number;
    canceled: number;
  };
  api: {
    requests: number;
    limit: number | null;
  };
}

export interface Tenant {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  logoUrl?: string;
  tenantType?: TenantType;
  isActive?: boolean;
  onboardingCompleted?: boolean;
  contactEmail?: string;
  contactPhone?: string;
  subscription: Subscription;
  settings: TenantSettings;
  createdAt: string;
  updatedAt: string;
  specialties?: Specialty[];
  enabledModules?: TenantModule[];
}

export interface Specialty {
  id: string;
  code: string;
  name: string;
  description?: string;
  isActive: boolean;
  modules?: SpecialtyModule[];
}

/** Full tenant specialty row returned by GET /tenants/:id/specialties. */
export interface TenantSpecialty extends Omit<Specialty, 'description' | 'modules'> {
  description: string | null;
  modules: SpecialtyModule[];
}

export interface SpecialtyModule {
  id: string;
  specialtyId: string;
  moduleKey: string;
}

/** Public catalog projection; the API does not send the internal active flag. */
export interface SpecialtyCatalogModule {
  id: string;
  moduleKey: string;
}

export interface SpecialtyCatalogItem {
  id: string;
  code: string;
  name: string;
  description: string | null;
  modules: SpecialtyCatalogModule[];
}

export interface SpecialtyPricingSummary {
  includedSpecialties: number;
  selectedSpecialties: number;
  billableSpecialties: number;
  specialtyUnitPrice: number;
  basePlanPrice: number;
  featureAddonsPrice: number;
  specialtyAddonsPrice: number;
  totalMonthly: number;
  currency: string;
}

/** State in a selection result; GET /modules returns full TenantModule rows. */
export interface TenantModuleSelection {
  moduleKey: string;
  enabled: boolean;
}

export interface SpecialtySelectionResult {
  tenantId: string;
  specialties: SpecialtyCatalogItem[];
  modules: TenantModuleSelection[];
  pricing: SpecialtyPricingSummary;
}

export interface TenantModule {
  id: string;
  tenantId: string;
  moduleKey: string;
  enabled: boolean;
  limits?: Record<string, unknown>;
}

export interface TenantSettings {
  legalName?: string;
  taxIdentificationType?: string;
  taxIdentificationNumber?: string;
  workingHours: WorkingHours;
  defaultSessionDuration: number; // minutes
  reminderRules: ReminderRule[];
  timezone: string;
  locale: string;
}

export interface Invoice {
  id: string;
  status: 'PENDING' | 'ISSUED' | 'FAILED' | 'VOIDED';
  issueDate: string;
  customerName: string;
  customerEmail?: string;
  customerTaxIdType?: string;
  customerTaxId?: string;
  customerAddress?: string | null;
  patientId?: string | null;
  /** Null for invoices issued before invoices were linked to patients. */
  patient?: { id: string; firstName: string; lastName: string } | null;
  description: string;
  subtotal: number | string;
  tax: number | string;
  total: number | string;
  externalId?: string;
  accessKey?: string;
  pdfUrl?: string;
  xmlUrl?: string;
  errorMessage?: string;
  issuer?: { id: string; firstName: string; lastName: string; role: string };
}

export interface WorkingHours {
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
  sunday: DaySchedule;
}

export interface DaySchedule {
  enabled: boolean;
  startTime: string; // HH:mm format
  endTime: string;
}

export interface ReminderRule {
  id: string;
  type: 'EMAIL' | 'SMS' | 'PUSH';
  minutesBefore: number;
  enabled: boolean;
}

// ==========================================
// USER
// ==========================================

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  tenantId: string;
  avatarUrl?: string;
  phone?: string;
  professionalTitle?: string;
  licenseNumber?: string;
  professionalSpecialties?: Specialty[];
  professionalProfile?: ProfessionalProfile;
  isActive: boolean;
  managedByProvider?: boolean;
  /** True while the user still has the temporary password set by the platform. */
  mustChangePassword?: boolean;
  invitedAt?: string;
  invitedBy?: string;
  activatedAt?: string;
  lastLogin?: string;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Roles that appear in the clinic team list. */
export type TenantTeamRole = UserRole.MASTER | UserRole.PROFESIONAL | UserRole.ASISTENTE;
/** Roles the account holder can give to a team member. MASTER is never assignable. */
export type AssignableTeamRole = UserRole.PROFESIONAL | UserRole.ASISTENTE;

export interface TenantTeamProfessionalProfileInput {
  specialtyId: string;
  professionalTitle?: string;
  licenseNumber?: string;
  bio?: string;
  isActive: boolean;
}

export interface CreateTenantUserInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: AssignableTeamRole;
  professionalProfile?: TenantTeamProfessionalProfileInput;
}

export type UpdateTenantUserInput = {
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  role?: TenantTeamRole;
  isActive?: boolean;
  professionalProfile?: TenantTeamProfessionalProfileInput | null;
};

export interface ProfessionalProfile {
  userId: string;
  specialtyId: string;
  specialty: Specialty;
  professionalTitle?: string;
  licenseNumber?: string;
  bio?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile extends User {
  professionalTitle?: string;
  bio?: string;
  licenseNumber?: string;
}

export type UpdateSelfProfileInput = Partial<Pick<User, 'firstName' | 'lastName' | 'phone'>> & {
  professionalProfile?: Partial<
    Pick<ProfessionalProfile, 'professionalTitle' | 'licenseNumber' | 'bio'>
  >;
};

// ==========================================
// AUTHENTICATION
// ==========================================

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

// ==========================================
// PATIENT
// ==========================================

export interface Patient {
  id: string;
  tenantId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  dateOfBirth: string | null;
  gender: Gender | null;
  address: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  assignedPsychologistId: string | null;
  assignedPsychologist?: PatientAssignee | null;
  isActive: boolean;
  notes: string | null;
  identificationType?: string | null;
  identificationNumber?: string | null;
  maritalStatus?: string | null;
  occupation?: string | null;
  nationality?: string | null;
  bloodType?: string | null;
  disability?: string | null;
  insuranceProvider?: string | null;
  insurancePolicyNumber?: string | null;
  // Legal guardian; the API requires it for patients under 18.
  guardianName?: string | null;
  guardianRelationship?: string | null;
  guardianIdentification?: string | null;
  guardianPhone?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PatientAssignee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl: string | null;
  role: UserRole;
  phone?: string | null;
}

export interface PatientDetail extends Patient {
  _count: { appointments: number; clinicalNotes: number; tasks: number };
  // Older patient detail components still read these optional display aliases.
  appointmentsCount?: number;
  tasksCount?: number;
  lastAppointmentDate?: string;
  nextAppointmentDate?: string;
}

export interface PatientInput {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: Gender;
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  notes?: string;
  identificationType?: string | null;
  identificationNumber?: string | null;
  maritalStatus?: string;
  occupation?: string;
  nationality?: string;
  bloodType?: string;
  disability?: string;
  insuranceProvider?: string;
  insurancePolicyNumber?: string;
  guardianName?: string;
  guardianRelationship?: string;
  guardianIdentification?: string;
  guardianPhone?: string;
}

export interface SpecialtySummary {
  id: string;
  code: string;
  name: string;
}

export interface TeamProfessional {
  id: string;
  firstName: string;
  lastName: string;
  professionalTitle: string | null;
  licenseNumber: string | null;
  specialty: SpecialtySummary | null;
}

export interface PatientTeamMember {
  id: string;
  patientId: string;
  professionalId: string;
  assignedAt: string;
  assignedBy: Pick<User, 'id' | 'firstName' | 'lastName'> | null;
  isActive: boolean;
  professional: TeamProfessional;
}

export type EligiblePatientProfessional = Omit<TeamProfessional, 'specialty'> & {
  specialty: SpecialtySummary;
  isAssigned: boolean;
};

export interface AppointmentProfessional {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  professionalTitle?: string | null;
}

export interface AppointmentPatient {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
}

// ==========================================
// APPOINTMENT
// ==========================================

export interface Appointment {
  id: string;
  tenantId: string;
  patientId: string;
  patient: AppointmentPatient;
  professionalId: string;
  professional: AppointmentProfessional | null;
  specialtyId: string | null;
  specialty: SpecialtySummary | null;
  branchId?: string | null;
  branch?: { id: string; name: string } | null;
  psychologistId: string;
  psychologist: AppointmentProfessional | null;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string;
  duration: number;
  status: AppointmentStatus;
  location: string | null;
  isOnline: boolean;
  meetingUrl: string | null;
  notes?: string;
  cancelledAt: string | null;
  cancelledBy: string | null;
  cancellationReason: string | null;
  reminderSent24h: boolean;
  reminderSent2h: boolean;
  lastReminderSentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AppointmentCreateInput {
  patientId: string;
  professionalId: string;
  specialtyId: string;
  title: string;
  description?: string;
  startTime: string;
  duration: number;
  isOnline: boolean;
  meetingUrl?: string;
  location?: string;
  /** Null on update takes the appointment out of any branch. */
  branchId?: string | null;
}

export type AppointmentUpdateInput = Partial<AppointmentCreateInput> & { status?: AppointmentStatus };

export interface AppointmentFilters {
  professionalId?: string;
  specialtyId?: string;
  branchId?: string;
  patientId?: string;
  status?: AppointmentStatus;
  from?: string;
  to?: string;
}

// ==========================================
// CLINICAL RECORDS
// ==========================================

export interface ClinicalNote {
  id: string;
  tenantId: string;
  patientId: string;
  psychologistId: string;
  psychologist: User;
  appointmentId?: string;
  /** The encounter the note was written in, when one was open. */
  encounterId?: string | null;
  content: string;
  diagnosis?: string;
  treatment?: string;
  observations?: string;
  sessionDuration?: number;
  sessionDate?: string;
  /** Starts at 1 and grows with every correction. */
  version: number;
  // Backward-compatibility fields used in some UI sections.
  title?: string;
  isConfidential?: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

export type ClinicalNoteCorrection = Partial<
  Pick<
    ClinicalNote,
    'content' | 'diagnosis' | 'treatment' | 'observations' | 'sessionDuration' | 'sessionDate'
  >
> & { changeReason: string };

export interface SpecialtyRecord {
  id: string;
  patientId: string;
  professionalId?: string;
  specialtyId: string;
  moduleKey: string;
  /** Version of the module or form definition the data follows. */
  schemaVersion?: number;
  /** Bumped by every correction. */
  version?: number;
  /** Printed on the document and encoded in its QR, for third parties to check it. */
  verificationCode?: string | null;
  recordDate: string;
  data: Record<string, unknown>;
  notes?: string | null;
  alerts?: { level: 'info' | 'warning' | 'critical'; message: string }[];
  encounterId?: string | null;
  encounter?: { id: string; encounterType: string; status: string; startedAt: string } | null;
  specialty?: { code: string; name: string };
  professional?: {
    id: string;
    firstName: string;
    lastName: string;
    professionalProfile?: { professionalTitle: string | null; licenseNumber: string | null } | null;
  };
  appointment?: { id: string; title: string; startTime: string };
}

export interface SessionPlan {
  id: string;
  patientId: string;
  psychologistId: string;
  objectives?: string[] | string;
  techniques?: string;
  homework?: string;
  notes?: string;
  // Backward-compatibility fields used in some UI sections.
  interventions?: string[];
  progress?: string;
  nextSteps?: string;
  targetDate?: string;
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// TASKS
// ==========================================

export interface Task {
  id: string;
  tenantId: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignedToId: string;
  assignedTo: User;
  patientId?: string;
  patient?: Patient;
  dueDate?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

// ==========================================
// NOTIFICATIONS
// ==========================================

export interface Notification {
  id: string;
  tenantId: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, any>;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
}

export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

// ==========================================
// API RESPONSE WRAPPER
// ==========================================

export interface ApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiError {
  message: string;
  status?: number;
  code?: string;
  field?: string;
  details?: Record<string, any>;
  /** Requirement codes a blocked treatment session start or completion is missing. */
  missing?: MissingRequirement[];
  /** Checklist of a blocked invoice; clinical workflow codes remain in `missing`. */
  billingEligibility?: import('./cash').BillingEligibility;
  /** Per-field problems of a rejected clinical record or form definition; `field` is empty for a plain text problem (treatment requirements). */
  issues?: { field: string; message: string }[];
}

// ==========================================
// SUBSCRIPTION & BILLING
// ==========================================

/** Plan identifiers exactly as the API uses them. */
export type ApiPlanType =
  | 'TRIAL'
  | 'PERSONAL_BASIC'
  | 'PERSONAL_PRO'
  | 'CLINIC_BASIC'
  | 'CLINIC_PRO'
  | 'CLINIC_ENTERPRISE';

/** One plan of `GET /subscription/plans`: the only source of prices and limits. */
export interface PlanCatalogEntry {
  planType: ApiPlanType;
  basePrice: number;
  pricePerSeat: number;
  seatsIncluded: number;
  maxActivePatients: number;
  storageGB: number;
  monthlyNotificationsLimit: number;
  includedModules: string[];
  includedSpecialties: number;
  specialtyPricePerMonth: number;
}

export interface PlanCatalog {
  plans: PlanCatalogEntry[];
  modulePricing: Record<string, number>;
}

/** A charge of the subscription. A paid plan is enabled only after its payment is confirmed. */
export interface SubscriptionPayment {
  id: string;
  kind: 'PLAN_UPGRADE' | 'RENEWAL';
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'CANCELED' | 'EXPIRED';
  amount: number | string;
  currency: string;
  targetPlan: ApiPlanType;
  periodStart: string | null;
  periodEnd: string | null;
  expiresAt: string | null;
  createdAt: string;
}

/** A payment as the platform panel lists it, with the clinic that owes it. */
export type PlatformPayment = SubscriptionPayment & {
  tenant: { id: string; name: string; email: string };
};

export interface UpgradeRequest {
  newPlan: ApiPlanType;
}

export interface UpgradeResponse {
  success: boolean;
  status: 'PENDING_PAYMENT';
  currentPlan: ApiPlanType;
  requestedPlan: ApiPlanType;
  payment: SubscriptionPayment;
  message: string;
}

export interface DowngradeRequest {
  newPlan: ApiPlanType;
}

export interface ConstraintViolation {
  constraint: string;
  current: number;
  limit: number;
  action: string;
}

export interface DowngradeResponse {
  success: boolean;
  effectiveDate: string | null;
  daysUntilChange: number;
  currentPlan: ApiPlanType;
  newPlan: ApiPlanType;
  warnings: string[];
  message: string;
}

export interface AddSeatRequest {
  quantity: number;
}

export interface AddSeatResponse {
  success: boolean;
  subscription: {
    id: string;
    psychologistSeats: {
      previous: number;
      current: number;
      max: number;
    };
    pricing: {
      basePrice: number;
      pricePerSeat: number;
      addedSeats: number;
      totalMonthly: number;
    };
    proratedCharge: number;
    nextBillingAmount: number;
  };
}

// ==========================================
// STORAGE MANAGEMENT
// ==========================================

export interface StorageFile {
  id: string;
  tenantId: string;
  fileName: string;
  fileSize: number; // bytes
  mimeType: string;
  category: 'attachment' | 'avatar' | 'export';
  relatedTo?: {
    type: 'patient' | 'appointment' | 'clinical_note';
    id: string;
    name?: string;
  };
  uploadedBy: string;
  uploadedByUser?: User;
  createdAt: string;
  url: string;
}

export interface StorageBreakdown {
  total: number; // GB
  attachments: number;
  avatars: number;
  exports: number;
}

// ==========================================
// ERROR RESPONSES
// ==========================================

export interface SeatLimitError {
  error: 'SEAT_LIMIT_REACHED';
  message: string;
  details: {
    currentSeats: number;
    maxSeats: number;
    planTier: PlanTier;
    upgradeUrl: string;
    suggestion: string;
  };
}

export interface ConstraintViolationError {
  error: 'CONSTRAINT_VIOLATION' | 'DOWNGRADE_CONSTRAINTS_VIOLATED';
  message: string;
  details: {
    violations: ConstraintViolation[];
  };
}

export interface PaymentError {
  error: 'PAYMENT_FAILED';
  message: string;
  details: {
    code: string;
    declineCode?: string;
  };
}

// ==========================================
// STATS & DASHBOARD
// ==========================================

export interface DashboardStats {
  todayAppointments: number;
  upcomingAppointments: number;
  overdueTasks: number;
  activePatientsCount: number;
  totalPatientsThisMonth: number;
  completedAppointmentsThisWeek: number;
}

export interface AppointmentSummary {
  id: string;
  patientName: string;
  psychologistName: string;
  startTime: string;
  status: AppointmentStatus;
}

export interface TaskSummary {
  id: string;
  title: string;
  priority: TaskPriority;
  dueDate?: string;
  patientName?: string;
}

// ==========================================
// PLATFORM PANEL (mirrors the API's src/platform; dates arrive as ISO strings)
// ==========================================

/** Subscription statuses exactly as the API names them. */
export type ApiSubscriptionStatus =
  | 'TRIALING'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'UNPAID'
  | 'CANCELED'
  | 'INCOMPLETE';

export interface PlatformSummary {
  tenants: { active: number; suspended: number };
  /** blocked = UNPAID + CANCELED + INCOMPLETE. */
  subscriptions: { trialing: number; active: number; pastDue: number; blocked: number };
  pendingPayments: { count: number; amount: number; currency: string };
  trialsEndingSoon: { id: string; name: string; trialEndsAt: string }[];
  recentTenants: { id: string; name: string; planType: ApiPlanType | null; createdAt: string }[];
}

export interface PlatformTenantRow {
  id: string;
  name: string;
  tenantType: TenantType;
  isActive: boolean;
  createdAt: string;
  master: { firstName: string; lastName: string; email: string } | null;
  planType: ApiPlanType | null;
  status: ApiSubscriptionStatus | null;
  seatsPsychologistsUsed: number;
  seatsPsychologistsMax: number;
  activePatientsCount: number;
  maxActivePatients: number;
}

export interface PlatformTenantList {
  items: PlatformTenantRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PlatformTenantListParams {
  search?: string;
  planType?: ApiPlanType;
  status?: ApiSubscriptionStatus;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
}

export interface UpdatePlatformTenantInput {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
}

export interface ChangePlatformPlanInput {
  planType: ApiPlanType;
  seatsPsychologistsMax?: number;
  maxActivePatients?: number;
  reason: string;
}

export interface PlatformTenantDetail {
  tenant: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    address: string | null;
    tenantType: TenantType;
    isActive: boolean;
    createdAt: string;
  };
  master: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    mustChangePassword: boolean;
  } | null;
  subscription: {
    planType: ApiPlanType;
    status: ApiSubscriptionStatus;
    trialEndsAt: string | null;
    currentPeriodStart: string;
    currentPeriodEnd: string | null;
    seatsPsychologistsMax: number;
    maxActivePatients: number;
    basePrice: number;
    includedSpecialties: number;
    specialtyPrice: number;
    currency: string;
  };
  usage: {
    seatsPsychologistsUsed: number;
    activePatientsCount: number;
    monthlyNotificationsSent: number;
  };
  specialties: { id: string; code: string; name: string }[];
  sections: { key: SectionKey; name: string; enabled: boolean }[];
  modules: { key: string; enabled: boolean }[];
}

export type ClinicRole = 'MASTER' | 'PROFESIONAL' | 'ASISTENTE';

export interface PlatformRolePermissions {
  tenantId: string;
  role: ClinicRole;
  effective: string[];
  permissions: {
    key: string;
    group: string;
    label: string;
    allowed: boolean;
    source: 'role' | 'grant';
  }[];
}

export interface SectionCatalog {
  /** `healthOnly`: starts off in a clinic whose specialties are all non-health. */
  sections: { key: SectionKey; name: string; requires: SectionKey[]; healthOnly?: boolean }[];
  defaults: { planType: ApiPlanType; tenantType: TenantType; sections: SectionKey[] }[];
  /** Specialties that are not health care (Estética). */
  nonHealthSpecialtyCodes?: string[];
}

export interface CreatePlatformTenantInput {
  name: string;
  email: string;
  phone?: string;
  address?: string;
  tenantType: TenantType;
  timezone: string;
  locale: string;
  masterFirstName: string;
  masterLastName: string;
  masterEmail: string;
  temporaryPassword: string;
  planType: ApiPlanType;
  specialtyCodes: string[];
  sections?: SectionKey[];
}
