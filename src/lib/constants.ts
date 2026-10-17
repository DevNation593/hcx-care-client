import { PlanTier, UserRole, AppointmentStatus, TaskStatus, TaskPriority } from '@/types';

// ==========================================
// APPLICATION
// ==========================================

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'HCX Care';
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:4200';
const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

if (!apiBaseUrl && process.env.NODE_ENV === 'production') {
  throw new Error('Missing NEXT_PUBLIC_API_BASE_URL in production environment');
}

export const API_BASE_URL = apiBaseUrl || 'http://localhost:3000/api/v1';

function requiredPathSegment(value: string, label: string): string {
  if (!value?.trim()) throw new Error(`${label} ID is required.`);
  return encodeURIComponent(value);
}

// ==========================================
// ROUTES
// ==========================================

export const ROUTES = {
  // Public
  LOGIN: '/login',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',
  CHANGE_PASSWORD: '/change-password',

  // Platform panel (ADMIN)
  PLATFORM: '/platform',
  PLATFORM_TENANTS: '/platform/tenants',
  PLATFORM_TENANT_NEW: '/platform/tenants/new',
  PLATFORM_TENANT_DETAIL: (id: string) => `/platform/tenants/${id}`,
  PLATFORM_PAYMENTS: '/platform/payments',
  
  // Onboarding
  ONBOARDING: '/onboarding',
  
  // Dashboard
  DASHBOARD: '/dashboard',
  
  // Calendar
  CALENDAR: '/calendar',
  
  // Patients
  PATIENTS: '/patients',
  PATIENT_DETAIL: (id: string) => `/patients/${id}`,
  PATIENT_NEW: '/patients/new',
  
  // Admin
  ADMIN_TEAM: '/admin/team',
  ADMIN_SUBSCRIPTION: '/admin/subscription',
  ADMIN_SETTINGS: '/admin/settings',
  ADMIN_BILLING: '/admin/billing',
  ADMIN_SPECIALTIES: '/admin/specialties',
  ADMIN_STORAGE: '/admin/storage',
  
  // Profile
  PROFILE: '/profile',
  
  // Notifications
  NOTIFICATIONS: '/notifications',
} as const;

// ==========================================
// API ENDPOINTS
// ==========================================

export const API_ENDPOINTS = {
  PLATFORM_SUMMARY: '/platform/summary',
  PLATFORM_TENANTS: '/platform/tenants',
  PLATFORM_TENANT: (tenantId: string) => `/platform/tenants/${tenantId}`,
  PLATFORM_SECTION_CATALOG: '/platform/section-catalog',
  PLATFORM_PAYMENTS: '/platform/subscription-payments',
  SPECIALTY_CATALOG: '/specialties',
  // Auth (public, no tenantId)
  LOGIN: '/auth/login',
  REFRESH: '/auth/refresh',
  LOGOUT: '/auth/logout',
  LOGOUT_ALL: '/auth/logout-all',
  FORGOT_PASSWORD: '/auth/forgot-password',
  RESET_PASSWORD: '/auth/reset-password',
  CHANGE_PASSWORD: '/auth/change-password',

  // Tenants (partially public)
  TENANT: (tenantId: string) => `/tenants/${tenantId}`,
  TENANT_UPDATE: (tenantId: string) => `/tenants/${tenantId}`,
  TENANT_COMPLETE_ONBOARDING: (tenantId: string) => `/tenants/${tenantId}/complete-onboarding`,
  TENANT_SUBSCRIPTION: (tenantId: string) => `/tenants/${tenantId}/subscription`,
  TENANT_SPECIALTIES: (tenantId: string) => `/tenants/${tenantId}/specialties`,
  TENANT_MODULES: (tenantId: string) => `/tenants/${tenantId}/modules`,
  TENANT_MODULE: (tenantId: string, moduleKey: string) =>
    `/tenants/${tenantId}/modules/${encodeURIComponent(moduleKey)}`,
  TENANT_SPECIALTIES_UPDATE: (tenantId: string) => `/tenants/${tenantId}/specialties`,

  // Users (tenant-scoped)
  USERS: (tenantId: string) => `/tenants/${tenantId}/users`,
  USER_SELF_PROFILE: (tenantId: string) => `/tenants/${tenantId}/users/me`,
  USER_DETAIL: (tenantId: string, userId: string) => `/tenants/${tenantId}/users/${userId}`,
  USER_ACTIVATE: (tenantId: string, userId: string) => `/tenants/${tenantId}/users/${userId}/activate`,
  USER_AVATAR: (tenantId: string, userId: string) => `/tenants/${tenantId}/users/${userId}/avatar`,

  // Tenant Settings
  TENANT_SETTINGS: (tenantId: string) => `/tenants/${tenantId}/settings`,

  // Patients (tenant-scoped)
  PATIENTS: (tenantId: string) => `/tenants/${tenantId}/patients`,
  PATIENT_DETAIL: (tenantId: string, patientId: string) => `/tenants/${tenantId}/patients/${patientId}`,
  PATIENT_TEAM: (tenantId: string, patientId: string) =>
    `/tenants/${requiredPathSegment(tenantId, 'tenant')}/patients/${requiredPathSegment(patientId, 'patient')}/team`,
  PATIENT_TEAM_ELIGIBLE: (tenantId: string, patientId: string) =>
    `/tenants/${requiredPathSegment(tenantId, 'tenant')}/patients/${requiredPathSegment(patientId, 'patient')}/team/eligible`,
  PATIENT_TEAM_PROFESSIONAL: (tenantId: string, patientId: string, professionalId: string) =>
    `/tenants/${requiredPathSegment(tenantId, 'tenant')}/patients/${requiredPathSegment(patientId, 'patient')}/team/${requiredPathSegment(professionalId, 'professional')}`,
  PATIENT_SPECIALTY_RECORDS: (tenantId: string, patientId: string) =>
    `/tenants/${tenantId}/patients/${patientId}/specialty-records`,
  PATIENT_SPECIALTY_RECORD: (tenantId: string, patientId: string, recordId: string) =>
    `/tenants/${tenantId}/patients/${patientId}/specialty-records/${recordId}`,
  PATIENT_CLINICAL_ALERTS: (tenantId: string, patientId: string) =>
    `/tenants/${tenantId}/patients/${patientId}/specialty-records/alerts`,

  PATIENT_ENCOUNTERS: (tenantId: string, patientId: string) =>
    `/tenants/${tenantId}/patients/${patientId}/encounters`,
  PATIENT_ENCOUNTER: (tenantId: string, patientId: string, encounterId: string) =>
    `/tenants/${tenantId}/patients/${patientId}/encounters/${encounterId}`,
  PATIENT_ENCOUNTER_CLOSE: (tenantId: string, patientId: string, encounterId: string) =>
    `/tenants/${tenantId}/patients/${patientId}/encounters/${encounterId}/close`,

  // Treatments, consent templates and treatment sessions
  TREATMENTS: (tenantId: string) => `/tenants/${tenantId}/treatments`,
  TREATMENT: (tenantId: string, id: string) => `/tenants/${tenantId}/treatments/${id}`,
  TREATMENT_VERSIONS: (tenantId: string, id: string) =>
    `/tenants/${tenantId}/treatments/${id}/versions`,
  BILLING_PROFILES: (tenantId: string) => `/tenants/${tenantId}/billing-profiles`,
  BILLING_PROFILE: (tenantId: string, id: string) =>
    `/tenants/${tenantId}/billing-profiles/${id}`,
  PATIENT_BILLING_PROFILES: (tenantId: string, patientId: string) =>
    `/tenants/${tenantId}/patients/${patientId}/billing-profiles`,
  PATIENT_BILLING_PROFILE: (tenantId: string, patientId: string, profileId: string) =>
    `/tenants/${tenantId}/patients/${patientId}/billing-profiles/${profileId}`,
  CASH_REGISTERS: (tenantId: string) => `/tenants/${tenantId}/cash-registers`,
  CASH_REGISTER_OPEN: (tenantId: string) => `/tenants/${tenantId}/cash-registers/open`,
  CASH_REGISTER: (tenantId: string, id: string) => `/tenants/${tenantId}/cash-registers/${id}`,
  CASH_REGISTER_CLOSE: (tenantId: string, id: string) =>
    `/tenants/${tenantId}/cash-registers/${id}/close`,
  ORDERS: (tenantId: string) => `/tenants/${tenantId}/orders`,
  ORDER: (tenantId: string, id: string) => `/tenants/${tenantId}/orders/${id}`,
  ORDER_ITEMS: (tenantId: string, id: string) => `/tenants/${tenantId}/orders/${id}/items`,
  ORDER_ITEM: (tenantId: string, id: string, itemId: string) =>
    `/tenants/${tenantId}/orders/${id}/items/${itemId}`,
  ORDER_BILLING_PROFILE: (tenantId: string, id: string) =>
    `/tenants/${tenantId}/orders/${id}/billing-profile`,
  ORDER_CANCEL: (tenantId: string, id: string) => `/tenants/${tenantId}/orders/${id}/cancel`,
  ORDER_PAYMENTS: (tenantId: string, id: string) => `/tenants/${tenantId}/orders/${id}/payments`,
  ORDER_ELIGIBILITY: (tenantId: string, id: string) =>
    `/tenants/${tenantId}/orders/${id}/billing-eligibility`,
  PAYMENT_REFUND: (tenantId: string, id: string) => `/tenants/${tenantId}/payments/${id}/refund`,
  BILLABLE_SESSIONS: (tenantId: string) => `/tenants/${tenantId}/treatment-sessions/billable`,
  CONSENT_TEMPLATES: (tenantId: string) => `/tenants/${tenantId}/consent-templates`,
  CONSENT_TEMPLATE: (tenantId: string, id: string) =>
    `/tenants/${tenantId}/consent-templates/${id}`,
  CONSENT_TEMPLATE_DRAFT: (tenantId: string, id: string) =>
    `/tenants/${tenantId}/consent-templates/${id}/draft`,
  CONSENT_TEMPLATE_PUBLISH: (tenantId: string, id: string) =>
    `/tenants/${tenantId}/consent-templates/${id}/publish`,
  CONSENT_TEMPLATE_VERSION_RETIRE: (tenantId: string, versionId: string) =>
    `/tenants/${tenantId}/consent-template-versions/${versionId}/retire`,
  PATIENT_TREATMENT_SESSIONS: (tenantId: string, patientId: string) =>
    `/tenants/${tenantId}/patients/${patientId}/treatment-sessions`,
  TREATMENT_SESSION: (tenantId: string, id: string) =>
    `/tenants/${tenantId}/treatment-sessions/${id}`,
  TREATMENT_SESSION_COMMAND: (tenantId: string, id: string, command: string) =>
    `/tenants/${tenantId}/treatment-sessions/${id}/${command}`,
  CONSENT_DOCUMENT_COMMAND: (tenantId: string, id: string, command: string) =>
    `/tenants/${tenantId}/consent-documents/${id}/${command}`,

  // Branches and catalogs
  BRANCHES: (tenantId: string) => `/tenants/${tenantId}/branches`,
  BRANCH: (tenantId: string, branchId: string) => `/tenants/${tenantId}/branches/${branchId}`,
  BRANCH_PROFESSIONALS: (tenantId: string, branchId: string) =>
    `/tenants/${tenantId}/branches/${branchId}/professionals`,
  PATIENT_FILES: (tenantId: string, patientId: string) =>
    `/tenants/${tenantId}/patients/${patientId}/files`,
  PATIENT_FILE: (tenantId: string, patientId: string, fileId: string) =>
    `/tenants/${tenantId}/patients/${patientId}/files/${fileId}`,
  PATIENT_FILE_DOWNLOAD: (tenantId: string, patientId: string, fileId: string) =>
    `/tenants/${tenantId}/patients/${patientId}/files/${fileId}/download`,
  DIAGNOSIS_CODES: (tenantId: string) => `/tenants/${tenantId}/diagnosis-codes`,
  MEDICATIONS: (tenantId: string) => `/tenants/${tenantId}/medications`,
  MEDICATION: (tenantId: string, medicationId: string) =>
    `/tenants/${tenantId}/medications/${medicationId}`,

  // Clinical module definitions and forms designed by the clinic
  CLINICAL_MODULES: (tenantId: string) => `/tenants/${tenantId}/clinical-modules`,
  FORM_DEFINITIONS: (tenantId: string) => `/tenants/${tenantId}/form-definitions`,
  FORM_DEFINITION: (tenantId: string, formId: string) =>
    `/tenants/${tenantId}/form-definitions/${formId}`,

  // Appointments (tenant-scoped)
  APPOINTMENTS: (tenantId: string) => `/tenants/${tenantId}/appointments`,
  APPOINTMENT_DETAIL: (tenantId: string, appointmentId: string) => `/tenants/${tenantId}/appointments/${appointmentId}`,
  APPOINTMENT_CANCEL: (tenantId: string, appointmentId: string) => `/tenants/${tenantId}/appointments/${appointmentId}/cancel`,

  // Clinical Notes (tenant-scoped)
  CLINICAL_NOTES: (tenantId: string) => `/tenants/${tenantId}/clinical-notes`,
  CLINICAL_NOTE_DETAIL: (tenantId: string, noteId: string) => `/tenants/${tenantId}/clinical-notes/${noteId}`,

  // Tasks (tenant-scoped)
  TASKS: (tenantId: string) => `/tenants/${tenantId}/tasks`,
  TASK_DETAIL: (tenantId: string, taskId: string) => `/tenants/${tenantId}/tasks/${taskId}`,

  // Next Session Plans (tenant-scoped)
  SESSION_PLANS: (tenantId: string) => `/tenants/${tenantId}/next-session-plans`,
  SESSION_PLAN_BY_PATIENT: (tenantId: string, patientId: string) => `/tenants/${tenantId}/next-session-plans/patient/${patientId}`,

  // Notifications (tenant-scoped)
  NOTIFICATIONS: (tenantId: string) => `/tenants/${tenantId}/notifications`,
  NOTIFICATION_READ: (tenantId: string, notificationId: string) => `/tenants/${tenantId}/notifications/${notificationId}/read`,
  NOTIFICATIONS_READ_ALL: (tenantId: string) => `/tenants/${tenantId}/notifications/read-all`,

  // Subscription (tenant-scoped)
  SUBSCRIPTION: (tenantId: string) => `/tenants/${tenantId}/subscription`,
  SUBSCRIPTION_USAGE: (tenantId: string) => `/tenants/${tenantId}/subscription/usage`,
  SUBSCRIPTION_UPGRADE: (tenantId: string) => `/tenants/${tenantId}/subscription/upgrade`,
  SUBSCRIPTION_DOWNGRADE: (tenantId: string) => `/tenants/${tenantId}/subscription/downgrade`,
  SUBSCRIPTION_PLANS: (tenantId: string) => `/tenants/${tenantId}/subscription/plans`,
  SUBSCRIPTION_PAYMENTS: (tenantId: string) => `/tenants/${tenantId}/subscription/payments`,
  BILLING_INVOICES: (tenantId: string) => `/tenants/${tenantId}/billing/invoices`,
  BILLING_INVOICE: (tenantId: string, invoiceId: string) => `/tenants/${tenantId}/billing/invoices/${invoiceId}`,

  // Audit Logs (tenant-scoped)
  AUDIT_LOGS: (tenantId: string) => `/tenants/${tenantId}/audit-logs`,
  AUDIT_LOG_ENTITY: (tenantId: string, entity: string, entityId: string) => `/tenants/${tenantId}/audit-logs/${entity}/${entityId}`,
} as const;

// ==========================================
// LOCAL STORAGE KEYS
// ==========================================

export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  USER: 'user',
  TENANT: 'tenant',
  THEME: 'theme',
  SIDEBAR_COLLAPSED: 'sidebar_collapsed',
  PUSH_SUBSCRIPTION: 'push_subscription',
} as const;

// ==========================================
// QUERY KEYS
// ==========================================

export const QUERY_KEYS = {
  // Platform panel
  PLATFORM_SUMMARY: ['platform', 'summary'],
  PLATFORM_TENANTS: ['platform', 'tenants'],
  PLATFORM_TENANT: (id: string) => ['platform', 'tenants', id],
  PLATFORM_SECTION_CATALOG: ['platform', 'section-catalog'],
  PLATFORM_PAYMENTS: ['platform', 'payments'],
  SPECIALTY_CATALOG: ['specialties', 'catalog'],
  // Auth
  ME: ['me'],
  
  // Users
  USERS: ['users'],
  USERS_SCOPED: (tenantId: string) => ['users', 'tenant', tenantId],
  USER_DETAIL: (id: string) => ['users', id],
  
  // Patients
  PATIENTS: ['patients'],
  PATIENTS_SCOPED: (tenantId: string, filters?: unknown) => ['patients', 'tenant', tenantId, filters] as const,
  PATIENT_DETAIL: (id: string) => ['patients', id],
  PATIENT_DETAIL_SCOPED: (tenantId: string, patientId: string) => ['patients', 'tenant', tenantId, patientId] as const,
  PATIENT_TEAM: (tenantId: string, patientId: string) => ['patient-team', tenantId, patientId] as const,
  PATIENT_TEAM_ELIGIBLE: (tenantId: string, patientId: string, specialtyId?: string) =>
    ['patient-team', tenantId, patientId, 'eligible', specialtyId] as const,
  PATIENT_CLINICAL_NOTES: (patientId: string) => ['patients', patientId, 'clinical-notes'],
  PATIENT_SESSION_PLAN: (patientId: string) => ['patients', patientId, 'session-plan'],
  PATIENT_SPECIALTY_RECORDS: (patientId: string) => ['patients', patientId, 'specialty-records'],
  PATIENT_CLINICAL_ALERTS: (patientId: string) => ['patients', patientId, 'clinical-alerts'],
  PATIENT_SPECIALTY_RECORD: (patientId: string, recordId: string) =>
    ['patients', patientId, 'specialty-records', recordId],
  PATIENT_ENCOUNTERS: (patientId: string) => ['patients', patientId, 'encounters'],
  PATIENT_FILES: (patientId: string) => ['patients', patientId, 'files'],
  TREATMENTS: ['treatments'],
  TREATMENT: (id: string) => ['treatments', id],
  BILLING_PROFILES: ['billing-profiles'],
  CASH_REGISTERS: ['cash-registers'],
  ORDERS: ['orders'],
  ORDER: (id: string) => ['orders', id],
  ORDER_ELIGIBILITY: (id: string) => ['orders', id, 'eligibility'],
  BILLABLE_SESSIONS: ['billable-sessions'],
  CONSENT_TEMPLATES: ['consent-templates'],
  CONSENT_TEMPLATE: (id: string) => ['consent-templates', id],
  PATIENT_TREATMENT_SESSIONS: (patientId: string) => ['patients', patientId, 'treatment-sessions'],
  TREATMENT_SESSIONS: ['treatment-sessions'],
  TREATMENT_SESSION: (id: string) => ['treatment-sessions', id],
  BRANCHES: (tenantId: string) => ['tenant', 'branches', tenantId],
  MEDICATIONS: (tenantId: string) => ['tenant', 'medications', tenantId],
  CLINICAL_MODULES: (tenantId: string) => ['tenant', 'clinical-modules', tenantId],
  FORM_DEFINITIONS: (tenantId: string) => ['tenant', 'form-definitions', tenantId],
  
  // Appointments
  APPOINTMENTS: ['appointments'],
  APPOINTMENTS_SCOPED: (tenantId: string, filters?: unknown) => ['appointments', 'tenant', tenantId, filters] as const,
  APPOINTMENT_DETAIL: (id: string) => ['appointments', id],
  APPOINTMENT_DETAIL_SCOPED: (tenantId: string, id: string) => ['appointments', 'tenant', tenantId, id] as const,
  APPOINTMENTS_TODAY: ['appointments', 'today'],
  APPOINTMENTS_UPCOMING: ['appointments', 'upcoming'],
  
  // Tasks
  TASKS: ['tasks'],
  TASK_DETAIL: (id: string) => ['tasks', id],
  TASKS_MY: ['tasks', 'my'],
  TASKS_OVERDUE: ['tasks', 'overdue'],
  
  // Notifications
  NOTIFICATIONS: ['notifications'],
  
  // Dashboard
  DASHBOARD_STATS: ['dashboard', 'stats'],
  
  // Subscription
  PLANS: ['plans'],
  SUBSCRIPTION: ['subscription'],
  SUBSCRIPTION_SCOPED: (tenantId: string) => ['subscription', 'tenant', tenantId],
  SUBSCRIPTION_USAGE: ['subscription', 'usage'],
  SUBSCRIPTION_PAYMENTS: ['subscription', 'payments'],
  SUBSCRIPTION_USAGE_SCOPED: (tenantId: string, period: string) => ['subscription', 'usage', tenantId, period],
  
  // Storage
  STORAGE_FILES: ['storage', 'files'],
  STORAGE_BREAKDOWN: ['storage', 'breakdown'],
  
  // Tenant
  TENANT: ['tenant'],
  TENANT_SETTINGS: ['tenant', 'settings'],
  TENANT_SPECIALTIES: ['tenant', 'specialties'],
  TENANT_SPECIALTIES_SCOPED: (tenantId: string) => ['tenant', 'specialties', tenantId],
  LEGACY_TENANT_SPECIALTIES: ['tenant-specialties'],
  LEGACY_PATIENT_SPECIALTIES: ['specialties'],
  TENANT_MODULES: ['tenant', 'modules'],
  TENANT_MODULES_SCOPED: (tenantId: string) => ['tenant', 'modules', tenantId],
} as const;

// ==========================================
// ROLE LABELS
// ==========================================

export const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.MASTER]: 'Titular de la cuenta',
  [UserRole.ADMIN]: 'Administrador',
  [UserRole.PROFESIONAL]: 'Profesional',
  [UserRole.ASISTENTE]: 'Asistente',
  [UserRole.SOPORTE]: 'Soporte',
  [UserRole.PACIENTE]: 'Paciente',
};

// ==========================================
// PLAN LABELS
// ==========================================

export const PLAN_LABELS: Record<PlanTier, string> = {
  [PlanTier.TRIAL]: 'Prueba',
  [PlanTier.BASIC]: 'Básico',
  [PlanTier.PROFESSIONAL]: 'Profesional',
  [PlanTier.ENTERPRISE]: 'Empresarial',
};

// ==========================================
// STATUS LABELS
// ==========================================

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  [AppointmentStatus.SCHEDULED]: 'Programada',
  [AppointmentStatus.CONFIRMED]: 'Confirmada',
  [AppointmentStatus.IN_PROGRESS]: 'En atención',
  [AppointmentStatus.CANCELLED]: 'Cancelada',
  [AppointmentStatus.COMPLETED]: 'Completada',
  [AppointmentStatus.NO_SHOW]: 'No asistió',
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  [TaskStatus.PENDING]: 'Pendiente',
  [TaskStatus.IN_PROGRESS]: 'En progreso',
  [TaskStatus.COMPLETED]: 'Completada',
  [TaskStatus.CANCELLED]: 'Cancelada',
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  [TaskPriority.LOW]: 'Baja',
  [TaskPriority.MEDIUM]: 'Media',
  [TaskPriority.HIGH]: 'Alta',
  [TaskPriority.URGENT]: 'Urgente',
};

// ==========================================
// STATUS COLORS
// ==========================================

export const APPOINTMENT_STATUS_COLORS: Record<AppointmentStatus, string> = {
  [AppointmentStatus.SCHEDULED]: 'bg-blue-100 text-blue-800',
  [AppointmentStatus.CONFIRMED]: 'bg-green-100 text-green-800',
  [AppointmentStatus.IN_PROGRESS]: 'bg-violet-100 text-violet-800',
  [AppointmentStatus.CANCELLED]: 'bg-red-100 text-red-800',
  [AppointmentStatus.COMPLETED]: 'bg-gray-100 text-gray-800',
  [AppointmentStatus.NO_SHOW]: 'bg-orange-100 text-orange-800',
};

export const TASK_PRIORITY_COLORS: Record<TaskPriority, string> = {
  [TaskPriority.LOW]: 'bg-gray-100 text-gray-800',
  [TaskPriority.MEDIUM]: 'bg-blue-100 text-blue-800',
  [TaskPriority.HIGH]: 'bg-orange-100 text-orange-800',
  [TaskPriority.URGENT]: 'bg-red-100 text-red-800',
};

// ==========================================
// PAGINATION
// ==========================================

export const DEFAULT_PAGE_SIZE = 20;
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

// ==========================================
// VALIDATION
// ==========================================

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;

// ==========================================
// DATE/TIME
// ==========================================

export const DEFAULT_SESSION_DURATION = 60; // minutes
export const TIME_SLOTS = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
  '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30',
  '20:00',
];
