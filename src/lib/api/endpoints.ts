import { apiClient } from './client';
import { API_ENDPOINTS } from '@/lib/constants';
import { useAuthStore } from '@/store/authStore';
import {
  User,
  CreateTenantUserInput,
  UpdateTenantUserInput,
  Patient,
  PatientDetail,
  PatientInput,
  PatientTeamMember,
  EligiblePatientProfessional,
  Appointment,
  AppointmentProfessional,
  AppointmentCreateInput,
  AppointmentUpdateInput,
  AppointmentFilters,
  Task,
  ClinicalNote,
  ClinicalNoteCorrection,
  SessionPlan,
  Notification,
  UsageMetrics,
  Tenant,
  Subscription,
  LoginCredentials,
  AuthResponse,
  PaginatedResponse,
  UpgradeRequest,
  PlanCatalog,
  SubscriptionPayment,
  UpgradeResponse,
  DowngradeRequest,
  DowngradeResponse,
  PlanTier,
  SubscriptionStatus,
  FeatureFlags,
  ResourceLimits,
  Plan,
  TenantSettings,
  WorkingHours,
  ReminderRule,
  TenantSpecialty,
  SpecialtyCatalogItem,
  SpecialtySelectionResult,
  TenantModule,
  Invoice,
  SpecialtyRecord,
  UpdateSelfProfileInput,
  PlatformPayment,
  PlatformSummary,
  PlatformTenantList,
  PlatformTenantListParams,
  PlatformTenantDetail,
  SectionCatalog,
  SectionKey,
  CreatePlatformTenantInput,
  UpdatePlatformTenantInput,
  ChangePlatformPlanInput,
} from '@/types';
import type {
  Branch,
  BranchInput,
  BranchUpdate,
  ClinicalModuleDefinition,
  ClinicalRecordCorrection,
  ClinicalRecordInput,
  DiagnosisCode,
  Encounter,
  EncounterInput,
  Medication,
  MedicationInput,
  MedicationUpdate,
  PatientFile,
  FormDefinition,
  FormDefinitionInput,
  FormDefinitionUpdate,
  PatientClinicalAlert,
} from '@/types/clinical';
import type {
  ConsentDocument,
  ConsentDraftInput,
  ConsentTemplate,
  ConsentTemplateInput,
  ConsentTemplateSummary,
  ConsentTemplateVersion,
  SessionMedia,
  SessionMediaPhase,
  SignConsentInput,
  TreatmentFilters,
  TreatmentInput,
  TreatmentSessionDetail,
  TreatmentSessionInput,
  TreatmentSessionSummary,
  TreatmentUpdate,
  TreatmentVersionInput,
  TreatmentWithCurrent,
  TreatmentWithVersions,
} from '@/types/treatments';
import type {
  Paginated,
  BillingProfile,
  BillingProfileInput,
  BillingProfileUpdate,
  BillingProfileFilters,
  LinkedBillingProfile,
  LinkBillingProfileInput,
  CashRegister,
  CashRegisterDetail,
  CashRegisterFilters,
  OpenCashRegisterInput,
  CloseCashRegisterInput,
  Order,
  OrderFilters,
  CreateOrderInput,
  AddOrderItemInput,
  UpdateOrderItemInput,
  SetOrderBillingProfileInput,
  CancelOrderInput,
  RecordPaymentInput,
  RefundPaymentInput,
  BillableSession,
  BillableSessionFilters,
  BillingEligibility,
} from '@/types/cash';

// ==========================================
// HELPER: Get tenantId from auth store
// ==========================================

function getTenantId(tenantIdOverride?: string): string {
  const state = useAuthStore.getState();
  const tenantId = tenantIdOverride === undefined
    ? state.tenant?.id || state.user?.tenantId
    : tenantIdOverride;
  if (!tenantId) {
    throw new Error('No tenant ID available. User must be authenticated.');
  }
  return tenantId;
}

function mapPlanType(apiPlan: string): PlanTier {
  switch (apiPlan) {
    case 'PRO':
    case 'PERSONAL_PRO':
    case 'CLINIC_PRO':
      return PlanTier.PROFESSIONAL;
    case 'CUSTOM':
    case 'CLINIC_ENTERPRISE':
      return PlanTier.ENTERPRISE;
    case 'BASIC':
    case 'PERSONAL_BASIC':
    case 'CLINIC_BASIC':
      return PlanTier.BASIC;
    default:
      return PlanTier.TRIAL;
  }
}

function mapSubscriptionStatus(apiStatus: string): SubscriptionStatus {
  switch (apiStatus) {
    case 'TRIALING':
      return SubscriptionStatus.TRIAL;
    case 'ACTIVE':
      return SubscriptionStatus.ACTIVE;
    case 'PAST_DUE':
      return SubscriptionStatus.PAST_DUE;
    case 'CANCELED':
      return SubscriptionStatus.CANCELED;
    case 'INCOMPLETE':
    case 'UNPAID':
      return SubscriptionStatus.SUSPENDED;
    default:
      return SubscriptionStatus.ARCHIVED;
  }
}

function defaultFeatureFlags(): FeatureFlags {
  return {
    dashboard: true,
    calendar: true,
    appointments: true,
    patients: true,
    clinicalNotes: false,
    tasks: false,
    attachments: false,
    sessionPlans: false,
    inAppNotifications: true,
    emailNotifications: true,
    webPush: false,
    smsNotifications: false,
    basicStats: true,
    advancedAnalytics: false,
    customReports: false,
    dataExport: false,
    googleCalendarSync: false,
    videoIntegration: false,
    apiAccess: 'none',
    webhooks: false,
    mfa: false,
    sso: false,
    auditLogs: false,
    customBranding: false,
  };
}

function normalizeSubscription(raw: any): Subscription {
  if (!raw) {
    throw new Error('Subscription data is missing');
  }

  const specialtyPricing =
    raw.includedSpecialties != null && raw.specialtyPrice != null && Array.isArray(raw.specialties)
      ? {
          includedSpecialties: Number(raw.includedSpecialties),
          selectedSpecialties: raw.specialties.length,
          specialtyUnitPrice: Number(raw.specialtyPrice),
          ...(typeof raw.currency === 'string' ? { currency: raw.currency } : {}),
        }
      : undefined;

  // Already normalized shape.
  if (raw.plan && raw.plan.limits) {
    return { ...raw, ...(specialtyPricing ? { specialtyPricing } : {}) } as Subscription;
  }

  const planType = mapPlanType(raw.planType);
  const limits: ResourceLimits = {
    maxPsychologists: raw.seatsPsychologistsMax ?? 1,
    maxAssistants: null,
    maxPatients: raw.maxActivePatients ?? 10,
    storageGB: raw.storageGB ?? 0,
    maxEmailsPerMonth: raw.monthlyNotificationsLimit ?? 0,
    maxPushPerMonth: raw.monthlyNotificationsLimit ?? 0,
    maxSmsPerMonth: raw.monthlyNotificationsLimit ?? 0,
    maxApiRequestsPerHour: null,
  };

  const features = {
    ...defaultFeatureFlags(),
    clinicalNotes: !!raw.featureClinicalNotes || !!raw.features?.clinicalNotes,
    tasks: !!raw.featureTasks || !!raw.features?.tasks,
    attachments: !!raw.featureAttachments || !!raw.features?.attachments,
    sessionPlans: !!raw.featureTasks || !!raw.features?.sessionPlans,
    webPush: !!raw.featureWebPush || !!raw.features?.webPush,
    smsNotifications: !!raw.featureWhatsAppIntegration || !!raw.features?.smsNotifications,
    advancedAnalytics: !!raw.featureAdvancedAnalytics || !!raw.features?.advancedAnalytics,
    customReports: !!raw.featureCustomReports || !!raw.features?.customReports,
    dataExport: !!raw.featureCustomReports || !!raw.features?.dataExport,
    googleCalendarSync: !!raw.featureCalendarSync || !!raw.features?.googleCalendarSync,
    videoIntegration: !!raw.featureVideoConsultation || !!raw.features?.videoIntegration,
    apiAccess: raw.featureAPIAccess || raw.features?.apiAccess ? 'full' : 'none',
    webhooks: !!raw.featureAPIAccess || !!raw.features?.webhooks,
    mfa: !!raw.featureSSO || !!raw.features?.mfa,
    sso: !!raw.featureSSO || !!raw.features?.sso,
    auditLogs: !!raw.featureAdvancedAnalytics || !!raw.features?.auditLogs,
    customBranding: !!raw.featureWhatsAppIntegration || !!raw.features?.customBranding,
  } as FeatureFlags;

  const plan: Plan = {
    id: `plan-${planType.toLowerCase()}`,
    planType,
    name: planType,
    description: `${planType} plan`,
    basePrice: Math.round(Number(raw.basePrice ?? 0) * 100),
    currency: typeof raw.currency === 'string' ? raw.currency : 'USD',
    billingInterval: 'MONTHLY',
    limits,
    features,
    pricePerSeatMonthly: Math.round(Number(raw.pricePerSeat ?? 0) * 100),
    pricePerSeatYearly: Math.round(Number(raw.pricePerSeat ?? 0) * 100 * 12),
  };

  return {
    id: raw.id,
    tenantId: raw.tenantId,
    plan,
    apiPlanType: raw.planType,
    status: mapSubscriptionStatus(raw.status),
    trialEndsAt: raw.trialEndsAt ?? null,
    currentPeriodStart: raw.currentPeriodStart ?? raw.startDate ?? new Date().toISOString(),
    currentPeriodEnd: raw.currentPeriodEnd ?? raw.endDate ?? new Date().toISOString(),
    canceledAt: raw.canceledAt ?? null,
    cancelAtPeriodEnd: !!raw.cancelAt,
    createdAt: raw.createdAt ?? new Date().toISOString(),
    updatedAt: raw.updatedAt ?? new Date().toISOString(),
    ...(specialtyPricing ? { specialtyPricing } : {}),
  };
}

function normalizeWorkingHours(raw: any): WorkingHours {
  const defaultDay = { enabled: false, startTime: '09:00', endTime: '18:00' };
  const enabledDays = new Set<string>(raw?.workingDays ?? []);
  const start = raw?.workingHoursStart ?? '09:00';
  const end = raw?.workingHoursEnd ?? '18:00';

  const toDay = (apiDay: string) => ({
    ...defaultDay,
    enabled: enabledDays.has(apiDay),
    startTime: start,
    endTime: end,
  });

  return {
    monday: toDay('MONDAY'),
    tuesday: toDay('TUESDAY'),
    wednesday: toDay('WEDNESDAY'),
    thursday: toDay('THURSDAY'),
    friday: toDay('FRIDAY'),
    saturday: toDay('SATURDAY'),
    sunday: toDay('SUNDAY'),
  };
}

function normalizeTenantSettings(raw: any): TenantSettings {
  if (!raw) {
    return {
      workingHours: normalizeWorkingHours(null),
      defaultSessionDuration: 60,
      reminderRules: [],
      timezone: 'America/Mexico_City',
      locale: 'es-MX',
    };
  }

  // Already frontend shape.
  if (raw.workingHours) {
    return raw as TenantSettings;
  }

  const reminderRules: ReminderRule[] = (raw.reminderRules ?? []).map((r: string, i: number) => {
    const value = String(r).toLowerCase();
    let minutesBefore = 60;
    if (value.endsWith('h')) minutesBefore = Number(value.replace('h', '')) * 60;
    if (value.endsWith('m')) minutesBefore = Number(value.replace('m', ''));
    return {
      id: `${i + 1}`,
      type: 'PUSH',
      minutesBefore,
      enabled: !!raw.reminderEnabled,
    };
  });

  return {
    legalName: raw.legalName ?? '',
    taxIdentificationType: raw.taxIdentificationType ?? 'RUC',
    taxIdentificationNumber: raw.taxIdentificationNumber ?? '',
    fakturApiKey: raw.fakturApiKey ?? '',
    fakturEstablishment: raw.fakturEstablishment ?? '',
    fakturEmissionPoint: raw.fakturEmissionPoint ?? '',
    fakturNextSequential: raw.fakturNextSequential ?? 1,
    fakturBusinessName: raw.fakturBusinessName ?? '',
    fakturBusinessAddress: raw.fakturBusinessAddress ?? '',
    fakturSpecialTaxpayer: !!raw.fakturSpecialTaxpayer,
    fakturAccountingRequired: !!raw.fakturAccountingRequired,
    fakturWithholdingAgent: !!raw.fakturWithholdingAgent,
    fakturEnabled: !!raw.fakturEnabled,
    workingHours: normalizeWorkingHours(raw),
    defaultSessionDuration: raw.defaultAppointmentDuration ?? 60,
    reminderRules,
    timezone: raw.timezone ?? 'America/Mexico_City',
    locale: raw.locale ?? 'es-MX',
  };
}

function normalizeTenant(raw: any): Tenant {
  return {
    ...raw,
    email: raw?.email ?? raw?.contactEmail,
    phone: raw?.phone ?? raw?.contactPhone,
    settings: normalizeTenantSettings(raw.settings),
    subscription: normalizeSubscription(raw.subscription),
  } as Tenant;
}

function normalizeUser(raw: any): User {
  return {
    ...raw,
    mustChangePassword: raw?.mustChangePassword ?? false,
    isActive: raw?.isActive ?? true,
    emailVerified: raw?.emailVerified ?? true,
    managedByProvider: raw?.managedByProvider ?? false,
    createdAt: raw?.createdAt ?? new Date().toISOString(),
    updatedAt: raw?.updatedAt ?? new Date().toISOString(),
  } as User;
}

// ==========================================
// AUTH API (public, no tenantId required)
// ==========================================

export const authApi = {
  login: (credentials: LoginCredentials) =>
    apiClient.post<AuthResponse>(API_ENDPOINTS.LOGIN, credentials).then((raw) => ({
      ...raw,
      user: normalizeUser(raw.user),
    })),

  refresh: (refreshToken: string) =>
    apiClient
      .post<{ accessToken: string; refreshToken: string; user?: User }>(API_ENDPOINTS.REFRESH, {
        refreshToken,
      })
      .then((raw) => ({
        accessToken: raw.accessToken,
        refreshToken: raw.refreshToken,
      })),

  logout: (refreshToken: string) =>
    apiClient.post<void>(API_ENDPOINTS.LOGOUT, { refreshToken }),

  logoutAll: () =>
    apiClient.post<void>(API_ENDPOINTS.LOGOUT_ALL),

  changePassword: (input: { currentPassword: string; newPassword: string }) =>
    apiClient.post<void>(API_ENDPOINTS.CHANGE_PASSWORD, input),
};

// ==========================================
// TENANTS API
// ==========================================

export const tenantsApi = {
  get: (tenantId?: string) =>
    apiClient
      .get<Tenant>(API_ENDPOINTS.TENANT(tenantId ?? getTenantId()))
      .then((raw) => normalizeTenant(raw)),

  update: (data: Partial<Tenant>, tenantId?: string) =>
    apiClient
      .patch<Tenant>(API_ENDPOINTS.TENANT_UPDATE(tenantId ?? getTenantId()), data)
      .then((raw) => normalizeTenant(raw)),

  completeOnboarding: (tenantId?: string) =>
    apiClient.post<void>(API_ENDPOINTS.TENANT_COMPLETE_ONBOARDING(tenantId ?? getTenantId())),

  getSubscription: (tenantId?: string) =>
    apiClient
      .get<any>(API_ENDPOINTS.TENANT_SUBSCRIPTION(tenantId ?? getTenantId()))
      .then((raw) => normalizeSubscription(raw)),
};

export const specialtyCatalogApi = {
  list: () => apiClient.get<SpecialtyCatalogItem[]>(API_ENDPOINTS.SPECIALTY_CATALOG),
};

export const tenantSpecialtiesApi = {
  list: (tenantId?: string) =>
    apiClient.get<TenantSpecialty[]>(API_ENDPOINTS.TENANT_SPECIALTIES(tenantId ?? getTenantId())),
  replace: (specialtyCodes: string[], tenantId?: string) =>
    apiClient.put<SpecialtySelectionResult>(
      API_ENDPOINTS.TENANT_SPECIALTIES(tenantId ?? getTenantId()),
      { specialtyCodes },
    ),
};

export const platformApi = {
  getSummary: () => apiClient.get<PlatformSummary>(API_ENDPOINTS.PLATFORM_SUMMARY),
  listTenants: (params?: PlatformTenantListParams) =>
    apiClient.get<PlatformTenantList>(API_ENDPOINTS.PLATFORM_TENANTS, { params }),
  getTenant: (id: string) =>
    apiClient.get<PlatformTenantDetail>(API_ENDPOINTS.PLATFORM_TENANT(id)),
  getSectionCatalog: () =>
    apiClient.get<SectionCatalog>(API_ENDPOINTS.PLATFORM_SECTION_CATALOG),
  createTenant: (input: CreatePlatformTenantInput) =>
    apiClient.post<PlatformTenantDetail>(API_ENDPOINTS.PLATFORM_TENANTS, input),
  updateTenant: (id: string, input: UpdatePlatformTenantInput) =>
    apiClient.patch<PlatformTenantDetail>(API_ENDPOINTS.PLATFORM_TENANT(id), input),
  changePlan: (id: string, input: ChangePlatformPlanInput) =>
    apiClient.patch<PlatformTenantDetail>(`${API_ENDPOINTS.PLATFORM_TENANT(id)}/subscription`, input),
  suspendTenant: (id: string, reason: string) =>
    apiClient.post<PlatformTenantDetail>(`${API_ENDPOINTS.PLATFORM_TENANT(id)}/suspend`, { reason }),
  reactivateTenant: (id: string) =>
    apiClient.post<PlatformTenantDetail>(`${API_ENDPOINTS.PLATFORM_TENANT(id)}/reactivate`),
  setSections: (id: string, sections: SectionKey[]) =>
    apiClient.put<PlatformTenantDetail>(`${API_ENDPOINTS.PLATFORM_TENANT(id)}/sections`, { sections }),
  resetMasterPassword: (id: string, temporaryPassword: string) =>
    apiClient.post<void>(`${API_ENDPOINTS.PLATFORM_TENANT(id)}/master/reset-password`, { temporaryPassword }),
  listPayments: (status?: SubscriptionPayment['status']) =>
    apiClient.get<PlatformPayment[]>(API_ENDPOINTS.PLATFORM_PAYMENTS, { params: status ? { status } : undefined }),
  confirmPayment: (id: string, input: { reference: string; note?: string }) =>
    apiClient.post<void>(`${API_ENDPOINTS.PLATFORM_PAYMENTS}/${id}/confirm`, input),
  rejectPayment: (id: string, reason: string) =>
    apiClient.post<void>(`${API_ENDPOINTS.PLATFORM_PAYMENTS}/${id}/reject`, { reason }),
};

export const tenantModulesApi = {
  list: (tenantId?: string) =>
    apiClient.get<TenantModule[]>(API_ENDPOINTS.TENANT_MODULES(tenantId ?? getTenantId())),
  setEnabled: (moduleKey: string, enabled: boolean, tenantId?: string) =>
    apiClient.patch<TenantModule>(
      API_ENDPOINTS.TENANT_MODULE(tenantId ?? getTenantId(), moduleKey),
      { enabled },
    ),
};

export const specialtiesApi = {
  list: (tenantId?: string) => tenantSpecialtiesApi.list(tenantId),
  modules: (tenantId?: string) => tenantModulesApi.list(tenantId),
  setModuleEnabled: (moduleKey: string, enabled: boolean, tenantId?: string) =>
    tenantModulesApi.setEnabled(moduleKey, enabled, tenantId),
  setForTenant: (specialtyCodes: string[], tenantId?: string) =>
    tenantSpecialtiesApi.replace(specialtyCodes, tenantId),
};

export const tenantSettingsApi = {
  get: () =>
    apiClient
      .get<any>(API_ENDPOINTS.TENANT_SETTINGS(getTenantId()))
      .then((raw) => normalizeTenantSettings(raw)),

  update: (settings: Partial<TenantSettings>) => {
    const workingDays: string[] = [];
    const workingHours = settings.workingHours;
    if (workingHours) {
      if (workingHours.monday?.enabled) workingDays.push('MONDAY');
      if (workingHours.tuesday?.enabled) workingDays.push('TUESDAY');
      if (workingHours.wednesday?.enabled) workingDays.push('WEDNESDAY');
      if (workingHours.thursday?.enabled) workingDays.push('THURSDAY');
      if (workingHours.friday?.enabled) workingDays.push('FRIDAY');
      if (workingHours.saturday?.enabled) workingDays.push('SATURDAY');
      if (workingHours.sunday?.enabled) workingDays.push('SUNDAY');
    }

    const payload: Record<string, unknown> = {
      legalName: settings.legalName,
      taxIdentificationType: settings.taxIdentificationType,
      taxIdentificationNumber: settings.taxIdentificationNumber,
      fakturApiKey: settings.fakturApiKey,
      fakturEstablishment: settings.fakturEstablishment,
      fakturEmissionPoint: settings.fakturEmissionPoint,
      fakturNextSequential: settings.fakturNextSequential,
      fakturBusinessName: settings.fakturBusinessName,
      fakturBusinessAddress: settings.fakturBusinessAddress,
      fakturSpecialTaxpayer: settings.fakturSpecialTaxpayer,
      fakturAccountingRequired: settings.fakturAccountingRequired,
      fakturWithholdingAgent: settings.fakturWithholdingAgent,
      fakturEnabled: settings.fakturEnabled,
      timezone: settings.timezone,
      locale: settings.locale,
      defaultAppointmentDuration: settings.defaultSessionDuration,
      reminderEnabled:
        settings.reminderRules !== undefined
          ? settings.reminderRules.some((r) => r.enabled)
          : undefined,
      reminderRules:
        settings.reminderRules?.map((r) => {
          if (r.minutesBefore % 60 === 0) return `${r.minutesBefore / 60}h`;
          return `${r.minutesBefore}m`;
        }) ?? undefined,
    };

    if (workingHours) {
      const firstEnabled =
        workingHours.monday?.enabled
          ? workingHours.monday
          : workingHours.tuesday?.enabled
            ? workingHours.tuesday
            : workingHours.wednesday?.enabled
              ? workingHours.wednesday
              : workingHours.thursday?.enabled
                ? workingHours.thursday
                : workingHours.friday?.enabled
                  ? workingHours.friday
                  : workingHours.saturday?.enabled
                    ? workingHours.saturday
                    : workingHours.sunday;

      payload.workingHoursStart = firstEnabled?.startTime ?? '09:00';
      payload.workingHoursEnd = firstEnabled?.endTime ?? '18:00';
      payload.workingDays = workingDays;
    }

    return apiClient
      .patch<any>(API_ENDPOINTS.TENANT_SETTINGS(getTenantId()), payload)
      .then((raw) => normalizeTenantSettings(raw));
  },
};

export interface CreateInvoiceInput {
  patientId: string;
  subtotal: number;
  tax?: number;
  description: string;
  idempotencyKey?: string;
  /** Recipient for this invoice; anything omitted comes from the patient record. */
  customer?: Partial<Record<'name' | 'taxIdType' | 'taxId' | 'email' | 'address', string>>;
  saveCustomerToPatient?: boolean;
}

export const billingApi = {
  listInvoices: (params?: { patientId?: string }) =>
    apiClient.get<Invoice[]>(
      API_ENDPOINTS.BILLING_INVOICES(getTenantId()),
      params?.patientId ? { params: { patientId: params.patientId } } : undefined,
    ),
  createInvoice: (data: CreateInvoiceInput) =>
    apiClient.post<Invoice>(API_ENDPOINTS.BILLING_INVOICES(getTenantId()), data),
};

export const specialtyRecordsApi = {
  list: (patientId: string, moduleKey?: string) =>
    apiClient.get<SpecialtyRecord[]>(
      API_ENDPOINTS.PATIENT_SPECIALTY_RECORDS(getTenantId(), patientId),
      moduleKey ? { params: { moduleKey } } : undefined,
    ),
  get: (patientId: string, recordId: string) =>
    apiClient.get<SpecialtyRecord>(
      API_ENDPOINTS.PATIENT_SPECIALTY_RECORD(getTenantId(), patientId, recordId),
    ),
  create: (patientId: string, data: ClinicalRecordInput) => apiClient.post<SpecialtyRecord>(
    API_ENDPOINTS.PATIENT_SPECIALTY_RECORDS(getTenantId(), patientId),
    data,
  ),
  // A correction: the API requires a reason and keeps the previous version in the audit log.
  update: (patientId: string, recordId: string, data: ClinicalRecordCorrection) =>
    apiClient.patch<SpecialtyRecord>(
      API_ENDPOINTS.PATIENT_SPECIALTY_RECORD(getTenantId(), patientId, recordId),
      data,
    ),
  remove: (patientId: string, recordId: string, reason: string) =>
    apiClient.delete<{ message: string }>(
      API_ENDPOINTS.PATIENT_SPECIALTY_RECORD(getTenantId(), patientId, recordId),
      { data: { reason } },
    ),
  alerts: (patientId: string) =>
    apiClient.get<PatientClinicalAlert[]>(
      API_ENDPOINTS.PATIENT_CLINICAL_ALERTS(getTenantId(), patientId),
    ),
};

export const encountersApi = {
  list: (patientId: string) =>
    apiClient.get<Encounter[]>(API_ENDPOINTS.PATIENT_ENCOUNTERS(getTenantId(), patientId)),
  start: (patientId: string, data: EncounterInput) =>
    apiClient.post<Encounter>(API_ENDPOINTS.PATIENT_ENCOUNTERS(getTenantId(), patientId), data),
  // Closing is the professional's sign-off: the encounter takes no more records.
  close: (patientId: string, encounterId: string, summary?: string) =>
    apiClient.post<Encounter>(
      API_ENDPOINTS.PATIENT_ENCOUNTER_CLOSE(getTenantId(), patientId, encounterId),
      summary ? { summary } : {},
    ),
  remove: (patientId: string, encounterId: string, reason: string) =>
    apiClient.delete<{ message: string }>(
      API_ENDPOINTS.PATIENT_ENCOUNTER(getTenantId(), patientId, encounterId),
      { data: { reason } },
    ),
};

export const treatmentsApi = {
  list: (filters?: TreatmentFilters) =>
    apiClient.get<TreatmentWithCurrent[]>(API_ENDPOINTS.TREATMENTS(getTenantId()), {
      params: filters?.active === undefined ? undefined : { active: filters.active },
    }),
  get: (id: string) =>
    apiClient.get<TreatmentWithVersions>(API_ENDPOINTS.TREATMENT(getTenantId(), id)),
  create: (data: TreatmentInput) =>
    apiClient.post<TreatmentWithVersions>(API_ENDPOINTS.TREATMENTS(getTenantId()), data),
  update: (id: string, data: TreatmentUpdate) =>
    apiClient.patch<TreatmentWithVersions>(API_ENDPOINTS.TREATMENT(getTenantId(), id), data),
  // Price and requirements are immutable: a change is a new version, which becomes the current one.
  addVersion: (id: string, data: TreatmentVersionInput) =>
    apiClient.post<TreatmentWithVersions>(API_ENDPOINTS.TREATMENT_VERSIONS(getTenantId(), id), data),
};

export const billingProfilesApi = {
  list: (filters?: BillingProfileFilters) =>
    apiClient.get<Paginated<BillingProfile>>(API_ENDPOINTS.BILLING_PROFILES(getTenantId()), {
      params: filters,
    }),
  get: (id: string) =>
    apiClient.get<BillingProfile>(API_ENDPOINTS.BILLING_PROFILE(getTenantId(), id)),
  create: (data: BillingProfileInput) =>
    apiClient.post<BillingProfile>(API_ENDPOINTS.BILLING_PROFILES(getTenantId()), data),
  update: (id: string, data: BillingProfileUpdate) =>
    apiClient.patch<BillingProfile>(API_ENDPOINTS.BILLING_PROFILE(getTenantId(), id), data),
  forPatient: (patientId: string) =>
    apiClient.get<LinkedBillingProfile[]>(
      API_ENDPOINTS.PATIENT_BILLING_PROFILES(getTenantId(), patientId),
    ),
  link: (patientId: string, data: LinkBillingProfileInput) =>
    apiClient.post<LinkedBillingProfile[]>(
      API_ENDPOINTS.PATIENT_BILLING_PROFILES(getTenantId(), patientId),
      data,
    ),
  // The profile stays; only the link to the patient goes.
  unlink: (patientId: string, profileId: string) =>
    apiClient.delete<void>(
      API_ENDPOINTS.PATIENT_BILLING_PROFILE(getTenantId(), patientId, profileId),
    ),
};

export const cashRegistersApi = {
  list: (filters?: CashRegisterFilters) =>
    apiClient.get<Paginated<CashRegister>>(API_ENDPOINTS.CASH_REGISTERS(getTenantId()), {
      params: filters,
    }),
  get: (id: string) =>
    apiClient.get<CashRegisterDetail>(API_ENDPOINTS.CASH_REGISTER(getTenantId(), id)),
  open: (data: OpenCashRegisterInput) =>
    apiClient.post<CashRegisterDetail>(API_ENDPOINTS.CASH_REGISTER_OPEN(getTenantId()), data),
  close: (id: string, data: CloseCashRegisterInput) =>
    apiClient.post<CashRegisterDetail>(API_ENDPOINTS.CASH_REGISTER_CLOSE(getTenantId(), id), data),
};

export const ordersApi = {
  list: (filters?: OrderFilters) =>
    apiClient.get<Paginated<Order>>(API_ENDPOINTS.ORDERS(getTenantId()), { params: filters }),
  get: (id: string) => apiClient.get<Order>(API_ENDPOINTS.ORDER(getTenantId(), id)),
  create: (data: CreateOrderInput) =>
    apiClient.post<Order>(API_ENDPOINTS.ORDERS(getTenantId()), data),
  addItem: (id: string, data: AddOrderItemInput) =>
    apiClient.post<Order>(API_ENDPOINTS.ORDER_ITEMS(getTenantId(), id), data),
  removeItem: (id: string, itemId: string, version: number) =>
    apiClient.delete<Order>(API_ENDPOINTS.ORDER_ITEM(getTenantId(), id, itemId), {
      params: { version },
    }),
  updateItem: (id: string, itemId: string, data: UpdateOrderItemInput) =>
    apiClient.patch<Order>(API_ENDPOINTS.ORDER_ITEM(getTenantId(), id, itemId), data),
  setBillingProfile: (id: string, data: SetOrderBillingProfileInput) =>
    apiClient.put<Order>(API_ENDPOINTS.ORDER_BILLING_PROFILE(getTenantId(), id), data),
  cancel: (id: string, data: CancelOrderInput) =>
    apiClient.post<Order>(API_ENDPOINTS.ORDER_CANCEL(getTenantId(), id), data),
  // The key makes a retried request return the original payment instead of recording another.
  recordPayment: (id: string, data: RecordPaymentInput, idempotencyKey: string) =>
    apiClient.post<Order>(API_ENDPOINTS.ORDER_PAYMENTS(getTenantId(), id), data, {
      headers: { 'Idempotency-Key': idempotencyKey },
    }),
  refundPayment: (paymentId: string, data: RefundPaymentInput) =>
    apiClient.post<Order>(API_ENDPOINTS.PAYMENT_REFUND(getTenantId(), paymentId), data),
  eligibility: (id: string) =>
    apiClient.get<BillingEligibility>(API_ENDPOINTS.ORDER_ELIGIBILITY(getTenantId(), id)),
  billableSessions: (filters?: BillableSessionFilters) =>
    apiClient.get<BillableSession[]>(API_ENDPOINTS.BILLABLE_SESSIONS(getTenantId()), {
      params: filters,
    }),
};

export const consentTemplatesApi = {
  list: () =>
    apiClient.get<ConsentTemplateSummary[]>(API_ENDPOINTS.CONSENT_TEMPLATES(getTenantId())),
  get: (id: string) =>
    apiClient.get<ConsentTemplate>(API_ENDPOINTS.CONSENT_TEMPLATE(getTenantId(), id)),
  create: (data: ConsentTemplateInput) =>
    apiClient.post<ConsentTemplate>(API_ENDPOINTS.CONSENT_TEMPLATES(getTenantId()), data),
  // Replaces the open draft, or starts the next version as a draft.
  saveDraft: (id: string, data: ConsentDraftInput) =>
    apiClient.put<ConsentTemplate>(API_ENDPOINTS.CONSENT_TEMPLATE_DRAFT(getTenantId(), id), data),
  publish: (id: string) =>
    apiClient.post<ConsentTemplate>(API_ENDPOINTS.CONSENT_TEMPLATE_PUBLISH(getTenantId(), id), {}),
  retire: (versionId: string) =>
    apiClient.post<ConsentTemplateVersion>(
      API_ENDPOINTS.CONSENT_TEMPLATE_VERSION_RETIRE(getTenantId(), versionId),
      {},
    ),
};

export const treatmentSessionsApi = {
  listForPatient: (patientId: string) =>
    apiClient.get<TreatmentSessionSummary[]>(
      API_ENDPOINTS.PATIENT_TREATMENT_SESSIONS(getTenantId(), patientId),
    ),
  create: (patientId: string, data: TreatmentSessionInput) =>
    apiClient.post<TreatmentSessionDetail>(
      API_ENDPOINTS.PATIENT_TREATMENT_SESSIONS(getTenantId(), patientId),
      data,
    ),
  get: (id: string) =>
    apiClient.get<TreatmentSessionDetail>(API_ENDPOINTS.TREATMENT_SESSION(getTenantId(), id)),
  // The whole answers, not a patch.
  saveForm: (id: string, data: Record<string, unknown>) =>
    apiClient.put<TreatmentSessionDetail>(
      API_ENDPOINTS.TREATMENT_SESSION_COMMAND(getTenantId(), id, 'form'),
      { data },
    ),
  presentConsent: (id: string) =>
    apiClient.post<ConsentDocument>(
      API_ENDPOINTS.TREATMENT_SESSION_COMMAND(getTenantId(), id, 'consents'),
      {},
    ),
  signConsent: (documentId: string, input: SignConsentInput) =>
    apiClient.post<ConsentDocument>(
      API_ENDPOINTS.CONSENT_DOCUMENT_COMMAND(getTenantId(), documentId, 'sign'),
      input,
    ),
  refuseConsent: (documentId: string, reason: string) =>
    apiClient.post<ConsentDocument>(
      API_ENDPOINTS.CONSENT_DOCUMENT_COMMAND(getTenantId(), documentId, 'refuse'),
      { reason },
    ),
  revokeConsent: (documentId: string, reason: string) =>
    apiClient.post<ConsentDocument>(
      API_ENDPOINTS.CONSENT_DOCUMENT_COMMAND(getTenantId(), documentId, 'revoke'),
      { reason },
    ),
  // The bytes come through the API, which checks them against the stored checksum and audits the read.
  consentPdf: (documentId: string) =>
    apiClient.get<Blob>(API_ENDPOINTS.CONSENT_DOCUMENT_COMMAND(getTenantId(), documentId, 'pdf'), {
      responseType: 'blob',
    }),
  uploadMedia: (sessionId: string, file: File, phase: SessionMediaPhase, description?: string) =>
    apiClient.upload<SessionMedia>(
      API_ENDPOINTS.TREATMENT_SESSION_COMMAND(getTenantId(), sessionId, 'media'),
      file,
      undefined,
      // An absent description must not travel as the text "undefined".
      description ? { phase, description } : { phase },
    ),
  start: (id: string) =>
    apiClient.post<TreatmentSessionDetail>(
      API_ENDPOINTS.TREATMENT_SESSION_COMMAND(getTenantId(), id, 'start'),
      {},
    ),
  complete: (id: string, procedureNotes?: string) =>
    apiClient.post<TreatmentSessionDetail>(
      API_ENDPOINTS.TREATMENT_SESSION_COMMAND(getTenantId(), id, 'complete'),
      procedureNotes ? { procedureNotes } : {},
    ),
  cancel: (id: string, reason: string) =>
    apiClient.post<TreatmentSessionDetail>(
      API_ENDPOINTS.TREATMENT_SESSION_COMMAND(getTenantId(), id, 'cancel'),
      { reason },
    ),
  noShow: (id: string) =>
    apiClient.post<TreatmentSessionDetail>(
      API_ENDPOINTS.TREATMENT_SESSION_COMMAND(getTenantId(), id, 'no-show'),
      {},
    ),
};

export const branchesApi = {
  list: (tenantId: string) => apiClient.get<Branch[]>(API_ENDPOINTS.BRANCHES(tenantId)),
  create: (tenantId: string, data: BranchInput) =>
    apiClient.post<Branch>(API_ENDPOINTS.BRANCHES(tenantId), data),
  update: (tenantId: string, branchId: string, data: BranchUpdate) =>
    apiClient.patch<Branch>(API_ENDPOINTS.BRANCH(tenantId, branchId), data),
  // A professional tied to no branch attends in all of them.
  setProfessionals: (tenantId: string, branchId: string, userIds: string[]) =>
    apiClient.put<{ branchId: string; professionalIds: string[] }>(
      API_ENDPOINTS.BRANCH_PROFESSIONALS(tenantId, branchId),
      { userIds },
    ),
};

export const patientFilesApi = {
  list: (patientId: string) =>
    apiClient.get<PatientFile[]>(API_ENDPOINTS.PATIENT_FILES(getTenantId(), patientId)),
  upload: (
    patientId: string,
    file: File,
    metadata: { category: string; description?: string; encounterId?: string },
  ) =>
    apiClient.upload<PatientFile>(
      API_ENDPOINTS.PATIENT_FILES(getTenantId(), patientId),
      file,
      undefined,
      metadata,
    ),
  // The bytes come through the API, which decrypts them and audits the read.
  download: (patientId: string, fileId: string) =>
    apiClient.get<Blob>(API_ENDPOINTS.PATIENT_FILE_DOWNLOAD(getTenantId(), patientId, fileId), {
      responseType: 'blob',
    }),
  remove: (patientId: string, fileId: string, reason: string) =>
    apiClient.delete<{ message: string }>(
      API_ENDPOINTS.PATIENT_FILE(getTenantId(), patientId, fileId),
      { data: { reason } },
    ),
};

export const catalogsApi = {
  searchDiagnosisCodes: (tenantId: string, search: string) =>
    apiClient.get<DiagnosisCode[]>(API_ENDPOINTS.DIAGNOSIS_CODES(tenantId), { params: { search } }),
  listMedications: (tenantId: string, search?: string) =>
    apiClient.get<Medication[]>(
      API_ENDPOINTS.MEDICATIONS(tenantId),
      search ? { params: { search } } : undefined,
    ),
  createMedication: (tenantId: string, data: MedicationInput) =>
    apiClient.post<Medication>(API_ENDPOINTS.MEDICATIONS(tenantId), data),
  updateMedication: (tenantId: string, medicationId: string, data: MedicationUpdate) =>
    apiClient.patch<Medication>(API_ENDPOINTS.MEDICATION(tenantId, medicationId), data),
};

export const clinicalModulesApi = {
  list: (tenantId: string) =>
    apiClient.get<ClinicalModuleDefinition[]>(API_ENDPOINTS.CLINICAL_MODULES(tenantId)),
};

export const formDefinitionsApi = {
  list: (tenantId: string) =>
    apiClient.get<FormDefinition[]>(API_ENDPOINTS.FORM_DEFINITIONS(tenantId)),
  create: (tenantId: string, data: FormDefinitionInput) =>
    apiClient.post<FormDefinition>(API_ENDPOINTS.FORM_DEFINITIONS(tenantId), data),
  // A changed schema becomes a new version; earlier versions are never modified.
  update: (tenantId: string, formId: string, data: FormDefinitionUpdate) =>
    apiClient.patch<FormDefinition>(API_ENDPOINTS.FORM_DEFINITION(tenantId, formId), data),
};

// ==========================================
// USERS API (tenant-scoped)
// ==========================================

export const usersApi = {
  list: (params?: { role?: string; isActive?: boolean; page?: number; limit?: number }, tenantId?: string) =>
    apiClient
      .get<PaginatedResponse<User> | User[]>(API_ENDPOINTS.USERS(getTenantId(tenantId)), { params })
      .then((raw) =>
        Array.isArray(raw)
          ? raw.map(normalizeUser)
          : {
              ...raw,
              data: (raw.data ?? []).map(normalizeUser),
            }
      ),

  get: (userId: string) =>
    apiClient
      .get<User>(API_ENDPOINTS.USER_DETAIL(getTenantId(), userId))
      .then((raw) => normalizeUser(raw)),

  create: (data: CreateTenantUserInput, tenantId?: string) =>
    apiClient
      .post<User>(API_ENDPOINTS.USERS(getTenantId(tenantId)), data)
      .then((raw) => normalizeUser(raw)),


  update: (userId: string, data: UpdateTenantUserInput, tenantId?: string) =>
    apiClient
      .patch<User>(API_ENDPOINTS.USER_DETAIL(getTenantId(tenantId), userId), data)
      .then((raw) => normalizeUser(raw)),

  updateSelf: (data: UpdateSelfProfileInput) =>
    apiClient
      .patch<User>(API_ENDPOINTS.USER_SELF_PROFILE(getTenantId()), data)
      .then((raw) => normalizeUser(raw)),

  delete: (userId: string, tenantId?: string) =>
    apiClient.delete<void>(API_ENDPOINTS.USER_DETAIL(getTenantId(tenantId), userId)),

  activate: (userId: string, password: string) =>
    apiClient.post<void>(API_ENDPOINTS.USER_ACTIVATE(getTenantId(), userId), { password }),

  activateWithTenant: (tenantId: string, userId: string, password: string) =>
    apiClient.post<void>(API_ENDPOINTS.USER_ACTIVATE(tenantId, userId), { password }),
};

// ==========================================
// PATIENTS API (tenant-scoped)
// ==========================================

export const patientsApi = {
  list: (params?: { search?: string; isActive?: boolean; page?: number; limit?: number }, tenantId?: string) =>
    apiClient.get<PaginatedResponse<Patient>>(API_ENDPOINTS.PATIENTS(getTenantId(tenantId)), { params }),

  get: (patientId: string, tenantId?: string) =>
    apiClient.get<PatientDetail>(API_ENDPOINTS.PATIENT_DETAIL(getTenantId(tenantId), patientId)),

  create: (data: Partial<PatientInput>, tenantId?: string) =>
    apiClient.post<Patient>(API_ENDPOINTS.PATIENTS(getTenantId(tenantId)), patientPayload(data)),

  update: (patientId: string, data: Partial<PatientInput>, tenantId?: string) =>
    apiClient.patch<Patient>(API_ENDPOINTS.PATIENT_DETAIL(getTenantId(tenantId), patientId), patientPayload(data)),

  delete: (patientId: string, tenantId?: string) =>
    apiClient.delete<void>(API_ENDPOINTS.PATIENT_DETAIL(getTenantId(tenantId), patientId)),
};

const patientFields = [
  'firstName', 'lastName', 'email', 'phone', 'dateOfBirth', 'gender', 'address',
  'emergencyContactName', 'emergencyContactPhone', 'notes',
  'identificationType', 'identificationNumber',
  'maritalStatus', 'occupation', 'nationality', 'bloodType', 'disability',
  'insuranceProvider', 'insurancePolicyNumber',
  'guardianName', 'guardianRelationship', 'guardianIdentification', 'guardianPhone',
  'billingName', 'billingTaxIdType', 'billingTaxId', 'billingEmail', 'billingAddress',
] as const;

function patientPayload(data: Partial<PatientInput>): Partial<PatientInput> {
  return Object.fromEntries(patientFields.filter((field) => field in data).map((field) => [field, data[field]]));
}

export const patientTeamApi = {
  list: (tenantId: string, patientId: string) =>
    apiClient.get<PatientTeamMember[]>(API_ENDPOINTS.PATIENT_TEAM(tenantId, patientId)),
  listEligible: (tenantId: string, patientId: string, specialtyId?: string) =>
    specialtyId
      ? apiClient.get<EligiblePatientProfessional[]>(API_ENDPOINTS.PATIENT_TEAM_ELIGIBLE(tenantId, patientId), { params: { specialtyId } })
      : apiClient.get<EligiblePatientProfessional[]>(API_ENDPOINTS.PATIENT_TEAM_ELIGIBLE(tenantId, patientId)),
  assign: (tenantId: string, patientId: string, professionalId: string) =>
    apiClient.put<PatientTeamMember>(API_ENDPOINTS.PATIENT_TEAM_PROFESSIONAL(tenantId, patientId, professionalId)),
  remove: (tenantId: string, patientId: string, professionalId: string) =>
    apiClient.delete<PatientTeamMember>(API_ENDPOINTS.PATIENT_TEAM_PROFESSIONAL(tenantId, patientId, professionalId)),
};

// ==========================================
// APPOINTMENTS API (tenant-scoped)
// ==========================================

export const appointmentsApi = {
  list: (params?: AppointmentFilters, tenantId?: string) =>
    apiClient.get<PaginatedResponse<AppointmentResponse> | AppointmentResponse[]>(
      API_ENDPOINTS.APPOINTMENTS(getTenantId(tenantId)), { params: appointmentFilterParams(params) })
      .then((response) => Array.isArray(response)
        ? response.map(normalizeAppointment)
        : { ...response, data: response.data.map(normalizeAppointment) }),

  get: (appointmentId: string, tenantId?: string) =>
    apiClient.get<AppointmentResponse>(API_ENDPOINTS.APPOINTMENT_DETAIL(getTenantId(tenantId), appointmentId))
      .then(normalizeAppointment),

  create: (data: AppointmentCreateInput, tenantId?: string) =>
    apiClient.post<AppointmentResponse>(API_ENDPOINTS.APPOINTMENTS(getTenantId(tenantId)), appointmentPayload(data))
      .then(normalizeAppointment),

  update: (appointmentId: string, data: AppointmentUpdateInput, tenantId?: string) =>
    apiClient.patch<AppointmentResponse>(API_ENDPOINTS.APPOINTMENT_DETAIL(getTenantId(tenantId), appointmentId), appointmentPayload(data))
      .then(normalizeAppointment),

  cancel: (appointmentId: string, reason: string, tenantId?: string) =>
    apiClient.post<AppointmentResponse>(API_ENDPOINTS.APPOINTMENT_CANCEL(getTenantId(tenantId), appointmentId), { reason })
      .then(normalizeAppointment),
};

const appointmentFilterFields = [
  'professionalId', 'specialtyId', 'branchId', 'patientId', 'status', 'from', 'to',
] as const;

function appointmentFilterParams(filters?: AppointmentFilters): AppointmentFilters | undefined {
  if (!filters) return undefined;
  return Object.fromEntries(appointmentFilterFields
    .filter((field) => field in filters)
    .map((field) => [field, filters[field]]));
}

const appointmentFields = [
  'patientId', 'professionalId', 'specialtyId', 'title', 'description', 'startTime',
  'duration', 'isOnline', 'meetingUrl', 'location', 'status', 'branchId',
] as const;

function appointmentPayload(data: AppointmentUpdateInput): AppointmentUpdateInput {
  return Object.fromEntries(appointmentFields.filter((field) => field in data).map((field) => [field, data[field]]));
}

type AppointmentResponse = Omit<Appointment, 'professionalId' | 'professional' | 'psychologistId' | 'psychologist'> & {
  professionalId?: string | null;
  professional?: AppointmentProfessional | null;
  psychologistId: string;
  psychologist?: AppointmentProfessional | null;
};

function normalizeAppointment(raw: AppointmentResponse): Appointment {
  const professionalId = raw.professionalId || raw.psychologistId;
  const professional = [raw.professional, raw.psychologist]
    .find((candidate) => candidate?.id === professionalId) ?? null;
  return {
    ...raw,
    professionalId,
    professional,
    psychologistId: professionalId,
    psychologist: professional,
  };
}

// ==========================================
// CLINICAL NOTES API (tenant-scoped)
// ==========================================

export const clinicalNotesApi = {
  list: (params?: { patientId?: string; psychologistId?: string; page?: number; limit?: number }) =>
    apiClient.get<PaginatedResponse<ClinicalNote>>(API_ENDPOINTS.CLINICAL_NOTES(getTenantId()), { params }),

  get: (noteId: string) =>
    apiClient.get<ClinicalNote>(API_ENDPOINTS.CLINICAL_NOTE_DETAIL(getTenantId(), noteId)),

  create: (data: Partial<ClinicalNote>) =>
    apiClient.post<ClinicalNote>(API_ENDPOINTS.CLINICAL_NOTES(getTenantId()), data),

  // A correction needs a reason and cannot move the note to another patient or appointment.
  update: (noteId: string, data: ClinicalNoteCorrection) =>
    apiClient.patch<ClinicalNote>(API_ENDPOINTS.CLINICAL_NOTE_DETAIL(getTenantId(), noteId), data),

  // Soft delete: the API keeps the note for audit and requires the reason.
  delete: (noteId: string, reason: string) =>
    apiClient.delete<void>(API_ENDPOINTS.CLINICAL_NOTE_DETAIL(getTenantId(), noteId), {
      data: { reason },
    }),
};

// ==========================================
// NEXT SESSION PLANS API (tenant-scoped)
// ==========================================

export const sessionPlansApi = {
  create: (data: Partial<SessionPlan>) =>
    apiClient.post<SessionPlan>(API_ENDPOINTS.SESSION_PLANS(getTenantId()), data),

  list: (params?: { psychologistId?: string }) =>
    apiClient.get<PaginatedResponse<SessionPlan>>(API_ENDPOINTS.SESSION_PLANS(getTenantId()), { params }),

  getByPatient: (patientId: string) =>
    apiClient.get<SessionPlan>(API_ENDPOINTS.SESSION_PLAN_BY_PATIENT(getTenantId(), patientId)),

  updateByPatient: (patientId: string, data: Partial<SessionPlan>) =>
    apiClient.patch<SessionPlan>(API_ENDPOINTS.SESSION_PLAN_BY_PATIENT(getTenantId(), patientId), data),

  deleteByPatient: (patientId: string) =>
    apiClient.delete<void>(API_ENDPOINTS.SESSION_PLAN_BY_PATIENT(getTenantId(), patientId)),
};

// ==========================================
// TASKS API (tenant-scoped)
// ==========================================

export const tasksApi = {
  list: (params?: { patientId?: string; assignedToId?: string; status?: string; priority?: string; page?: number; limit?: number }) =>
    apiClient.get<PaginatedResponse<Task>>(API_ENDPOINTS.TASKS(getTenantId()), { params }),

  get: (taskId: string) =>
    apiClient.get<Task>(API_ENDPOINTS.TASK_DETAIL(getTenantId(), taskId)),

  create: (data: Partial<Task>) =>
    apiClient.post<Task>(API_ENDPOINTS.TASKS(getTenantId()), data),

  update: (taskId: string, data: Partial<Task>) =>
    apiClient.patch<Task>(API_ENDPOINTS.TASK_DETAIL(getTenantId(), taskId), data),

  delete: (taskId: string) =>
    apiClient.delete<void>(API_ENDPOINTS.TASK_DETAIL(getTenantId(), taskId)),
};

// ==========================================
// NOTIFICATIONS API (tenant-scoped)
// ==========================================

export const notificationsApi = {
  list: (params?: { unreadOnly?: boolean; page?: number; limit?: number }) =>
    apiClient.get<PaginatedResponse<Notification>>(API_ENDPOINTS.NOTIFICATIONS(getTenantId()), { params }),

  // Web Push. The FCM token endpoints belong to the mobile app: a browser endpoint is not a token.
  getWebPushKey: () =>
    apiClient.get<{ enabled: boolean; publicKey: string | null }>(
      `${API_ENDPOINTS.NOTIFICATIONS(getTenantId())}/web-push/public-key`,
    ),

  subscribeWebPush: (subscription: PushSubscriptionJSON) =>
    apiClient.post<void>(
      `${API_ENDPOINTS.NOTIFICATIONS(getTenantId())}/web-push/subscriptions`,
      { endpoint: subscription.endpoint, keys: subscription.keys },
    ),

  unsubscribeWebPush: (endpoint: string) =>
    apiClient.delete<void>(
      `${API_ENDPOINTS.NOTIFICATIONS(getTenantId())}/web-push/subscriptions`,
      { data: { endpoint } },
    ),

  markAsRead: (notificationId: string) =>
    apiClient.post<void>(API_ENDPOINTS.NOTIFICATION_READ(getTenantId(), notificationId)),

  markAllAsRead: () =>
    apiClient.post<void>(API_ENDPOINTS.NOTIFICATIONS_READ_ALL(getTenantId())),
};

// ==========================================
// SUBSCRIPTION API (tenant-scoped)
// ==========================================

export const subscriptionApi = {
  getCurrent: (tenantId?: string) =>
    apiClient.get<any>(API_ENDPOINTS.SUBSCRIPTION(getTenantId(tenantId))).then((raw) => {
      // API may return { subscription, tenant } or a direct subscription object.
      return normalizeSubscription(raw.subscription ?? raw);
    }),

  getUsage: (params?: { period?: 'current' | 'previous' | string }, tenantId?: string) =>
    apiClient.get<any>(API_ENDPOINTS.SUBSCRIPTION_USAGE(getTenantId(tenantId)), { params }).then((raw) => {
      // API shape: { period, usage, activity, warnings }
      if (raw?.users && raw?.patients && raw?.storage) {
        const professionals = raw.users.professionals ?? raw.users.psychologists;
        return {
          ...raw,
          users: { ...raw.users, professionals, psychologists: professionals },
        } as UsageMetrics;
      }

      const usage = raw?.usage ?? {};
      const professionals = {
        total: usage?.seats?.used ?? 0,
        active: usage?.seats?.used ?? 0,
        inactive: 0,
        limit: usage?.seats?.limit ?? 0,
        percentUsed: usage?.seats?.percentage ?? 0,
      };
      return {
        tenantId: getTenantId(tenantId),
        period: {
          start: raw?.period?.start ?? new Date().toISOString(),
          end: raw?.period?.end ?? new Date().toISOString(),
        },
        users: {
          admins: { total: 0, active: 0 },
          professionals,
          psychologists: professionals,
          assistants: {
            total: 0,
            active: 0,
            limit: null,
          },
        },
        patients: {
          total: usage?.patients?.active ?? 0,
          active: usage?.patients?.active ?? 0,
          archived: 0,
          limit: usage?.patients?.limit ?? 0,
          percentUsed: usage?.patients?.percentage ?? 0,
        },
        storage: {
          usedGB: usage?.storage?.usedGB ?? 0,
          limitGB: usage?.storage?.limitGB ?? 0,
          percentUsed: usage?.storage?.percentage ?? 0,
          breakdown: {
            attachments: 0,
            avatars: 0,
            exports: 0,
          },
        },
        notifications: {
          email: {
            sent: usage?.notifications?.sentThisMonth ?? 0,
            limit: usage?.notifications?.limit ?? 0,
            percentUsed: usage?.notifications?.percentage ?? 0,
          },
          push: {
            sent: usage?.notifications?.sentThisMonth ?? 0,
            limit: usage?.notifications?.limit ?? 0,
            percentUsed: usage?.notifications?.percentage ?? 0,
          },
          sms: {
            sent: 0,
            limit: usage?.notifications?.limit ?? 0,
            percentUsed: 0,
          },
        },
        appointments: {
          total: raw?.activity?.appointmentsThisMonth ?? 0,
          completed: 0,
          upcoming: 0,
          canceled: 0,
        },
        api: {
          requests: 0,
          limit: null,
        },
      } as UsageMetrics;
    }),

  // Plans, prices and limits. Every screen that shows them reads this catalog.
  getPlans: () => apiClient.get<PlanCatalog>(API_ENDPOINTS.SUBSCRIPTION_PLANS(getTenantId())),

  getPayments: () =>
    apiClient.get<SubscriptionPayment[]>(API_ENDPOINTS.SUBSCRIPTION_PAYMENTS(getTenantId())),

  // Registers a pending payment; the plan changes when support confirms it.
  upgrade: (data: UpgradeRequest) =>
    apiClient.post<UpgradeResponse>(API_ENDPOINTS.SUBSCRIPTION_UPGRADE(getTenantId()), data),

  // Scheduled for the end of the current period.
  downgrade: (data: DowngradeRequest) =>
    apiClient.post<DowngradeResponse>(API_ENDPOINTS.SUBSCRIPTION_DOWNGRADE(getTenantId()), data),
};

// ==========================================
// AUDIT LOGS API (tenant-scoped)
// ==========================================

export const auditLogsApi = {
  list: (params?: { entity?: string; userId?: string; action?: string; from?: string; to?: string; page?: number; limit?: number }) =>
    apiClient.get<PaginatedResponse<any>>(API_ENDPOINTS.AUDIT_LOGS(getTenantId()), { params }),

  getByEntity: (entity: string, entityId: string) =>
    apiClient.get<any[]>(API_ENDPOINTS.AUDIT_LOG_ENTITY(getTenantId(), entity, entityId)),
};

// ==========================================
// UTILITY: Extract array from paginated or direct response
// ==========================================

export function extractArray<T>(response: PaginatedResponse<T> | T[]): T[] {
  return Array.isArray(response) ? response : (response.data ?? []);
}
