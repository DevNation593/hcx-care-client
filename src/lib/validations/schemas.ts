import { z } from 'zod';
import {
  identificationErrors,
  isMinor,
  normalizeIdentification,
} from '@/features/patients/patient-identity';
import { UserRole, Gender, TaskStatus, TaskPriority, AppointmentStatus, TenantType, SECTION_KEYS, type CreatePlatformTenantInput } from '@/types';
import { PASSWORD_MIN_LENGTH } from '@/lib/constants';

// ==========================================
// AUTH SCHEMAS
// ==========================================

export const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'La contraseña es requerida'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Email inválido'),
});

export const resetPasswordSchema = z.object({
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`)
    .regex(/[A-Z]/, 'Debe contener al menos una mayúscula')
    .regex(/[a-z]/, 'Debe contener al menos una minúscula')
    .regex(/[0-9]/, 'Debe contener al menos un número'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
});

export type LoginFormData = z.infer<typeof loginSchema>;
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

const professionalProfileInputSchema = z.object({
  specialtyId: z.string().min(1),
  professionalTitle: z.string().optional(),
  licenseNumber: z.string().optional(),
  bio: z.string().optional(),
  isActive: z.boolean().optional(),
});

const onboardingEmail = z.string().trim().toLowerCase().email('Email inválido');
const specialtyCode = z.string().trim().toUpperCase().min(1, 'Selecciona una especialidad');

/** Platform panel: a clinic together with its account holder. The password is never trimmed. */
export const createPlatformTenantSchema: z.ZodType<CreatePlatformTenantInput> = z.object({
  name: z.string().trim().min(1, 'Ingresa el nombre del consultorio'),
  email: onboardingEmail,
  phone: z.string().trim().optional(),
  address: z.string().trim().optional(),
  tenantType: z.nativeEnum(TenantType),
  timezone: z.string().trim().min(1, 'Selecciona una zona horaria'),
  locale: z.string().trim().min(1, 'Selecciona un idioma'),
  masterFirstName: z.string().trim().min(1, 'Ingresa el nombre'),
  masterLastName: z.string().trim().min(1, 'Ingresa el apellido'),
  masterEmail: onboardingEmail,
  temporaryPassword: z.string().min(PASSWORD_MIN_LENGTH, `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`),
  planId: z.string().min(1, 'Selecciona un plan'),
  trialDays: z.number({ invalid_type_error: 'Ingresa los días de prueba' }).int('Ingresa un número entero').min(0, 'Ingresa 0 o más días').max(365, 'Hasta 365 días').optional(),
  specialtyCodes: z.array(specialtyCode).min(1, 'Selecciona al menos una especialidad'),
  sections: z.array(z.enum(SECTION_KEYS)).optional(),
}).strict();

/** Platform panel: the account data of an existing clinic. Blank phone and address clear the value. */
export const updatePlatformTenantSchema = z.object({
  name: z.string().trim().min(1, 'Ingresa el nombre del consultorio'),
  email: onboardingEmail,
  phone: z.string().trim(),
  address: z.string().trim(),
}).strict();

/** Platform panel: plan change, optionally as a trial of the new plan. */
export const changePlatformPlanSchema = z.object({
  planId: z.string().min(1, 'Selecciona un plan'),
  trialDays: z.number({ invalid_type_error: 'Ingresa los días de prueba' }).int('Ingresa un número entero').min(1, 'Ingresa al menos 1 día').max(365, 'Hasta 365 días').optional(),
  reason: z.string().trim().min(1, 'Indica el motivo del cambio'),
}).strict();

const money = (label: string) =>
  z.number({ required_error: `Ingresa ${label}`, invalid_type_error: `Ingresa ${label}` }).min(0, `${label} no puede ser negativo`)
    .refine((value) => Math.round(value * 100) === value * 100, 'Usa hasta 2 decimales');
const whole = (label: string, minimum: number) =>
  z.number({ required_error: `Ingresa ${label}`, invalid_type_error: `Ingresa ${label}` }).int(`${label} debe ser un número entero`).min(minimum, `${label} debe ser al menos ${minimum}`);

/** Platform panel: a plan. The code identifies it for good and is only sent when creating it. */
export const platformPlanSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9][A-Z0-9_]{1,39}$/, 'Usa de 2 a 40 letras, números o _').optional(),
  name: z.string().trim().min(1, 'Ingresa el nombre del plan').max(80, 'Hasta 80 caracteres'),
  description: z.string().trim().max(300, 'Hasta 300 caracteres').optional(),
  tenantType: z.nativeEnum(TenantType),
  sortOrder: whole('el orden', 0).optional(),
  basePrice: money('el precio'),
  pricePerSeat: money('el precio por profesional'),
  specialtyPrice: money('el precio por especialidad'),
  seatsIncluded: whole('los profesionales', 1),
  maxActivePatients: whole('los pacientes', 1),
  storageGB: whole('el almacenamiento', 1),
  monthlyElectronicInvoicesLimit: whole('las facturas', 0),
  includedSpecialties: whole('las especialidades', 1),
  trialDays: whole('los días de prueba', 0),
  modules: z.array(z.enum(SECTION_KEYS)),
}).strict();

export const suspendReasonSchema = z.string().trim().min(1, 'Indica el motivo de la suspensión');

/** Platform panel: payment confirmation reference and rejection reason (same limits as the API). */
export const paymentReferenceSchema = z.string().trim().min(1, 'Indica la referencia del pago').max(120, 'La referencia admite hasta 120 caracteres');
export const paymentRejectReasonSchema = z.string().trim().min(1, 'Indica el motivo del rechazo').max(500, 'El motivo admite hasta 500 caracteres');

/** Platform panel: temporary password reset. Never trimmed. */
export const temporaryPasswordSchema = z.string().min(PASSWORD_MIN_LENGTH, `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`);

const teamProfileSchema = z.object({
  specialtyId: z.string().trim().min(1, 'Selecciona una especialidad'),
  professionalTitle: z.string().trim().optional(),
  licenseNumber: z.string().trim().optional(),
  bio: z.string().trim().optional(),
  isActive: z.boolean(),
}).strict();

const tenantTeamMemberBaseFields = {
  email: onboardingEmail,
  firstName: z.string().trim().min(1, 'Ingresa el nombre'),
  lastName: z.string().trim().min(1, 'Ingresa el apellido'),
  phone: z.string().trim().optional(),
  professionalProfile: teamProfileSchema.optional(),
};

const assignableTeamRole = z.union([
  z.literal(UserRole.PROFESIONAL),
  z.literal(UserRole.ASISTENTE),
]);

function refineTenantTeamMember(
  data: { role: UserRole; professionalProfile?: { specialtyId: string } },
  context: z.RefinementCtx,
) {
  if (data.role === UserRole.PROFESIONAL && !data.professionalProfile) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['professionalProfile'], message: 'Selecciona una especialidad' });
  }
  if (data.role === UserRole.ASISTENTE && data.professionalProfile) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['professionalProfile'], message: 'El asistente no puede tener perfil clínico' });
  }
}

/** New members can only be professionals or assistants. */
export const tenantTeamMemberSchema = z.object({
  ...tenantTeamMemberBaseFields,
  role: assignableTeamRole,
  password: z.string().min(PASSWORD_MIN_LENGTH, `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`),
}).strict().superRefine(refineTenantTeamMember);

/** Editing also accepts MASTER, because the account holder's own row resends its role. */
export const tenantTeamMemberUpdateSchema = z.object({
  ...tenantTeamMemberBaseFields,
  role: z.union([z.literal(UserRole.MASTER), assignableTeamRole]),
}).strict().superRefine(refineTenantTeamMember);

export type TenantTeamMemberFormData = z.infer<typeof tenantTeamMemberSchema>;

// ==========================================
// PATIENT SCHEMAS
// ==========================================

export const patientSchema = z.object({
  firstName: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  lastName: z.string().min(2, 'El apellido debe tener al menos 2 caracteres'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.preprocess(
    (val) => (val === '' ? undefined : val),
    z.nativeEnum(Gender).optional(),
  ),
  address: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  notes: z.string().optional(),
  // Identification: optional, but type and number go together and follow the type's format.
  identificationType: z.string().optional(),
  identificationNumber: z
    .string()
    .optional()
    .transform((value) => (value ? normalizeIdentification(value) : value)),
  maritalStatus: z.string().optional(),
  occupation: z.string().optional(),
  nationality: z.string().optional(),
  bloodType: z.string().optional(),
  disability: z.string().optional(),
  insuranceProvider: z.string().optional(),
  insurancePolicyNumber: z.string().optional(),
  // Legal guardian: required when the birth date makes the patient a minor.
  guardianName: z.string().optional(),
  guardianRelationship: z.string().optional(),
  guardianIdentification: z.string().optional(),
  guardianPhone: z.string().optional(),
}).superRefine((data, context) => {
  const identification = identificationErrors(
    data.identificationType ?? '',
    data.identificationNumber ?? '',
  );
  for (const [field, message] of Object.entries(identification)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message, path: [field] });
  }
  if (isMinor(data.dateOfBirth) && !data.guardianName?.trim()) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Un paciente menor de edad necesita un representante legal.',
      path: ['guardianName'],
    });
  }
});

// Existing patient pages are migrated in Task 9. Their registered field is
// accepted by the form type during transition, while patientSchema strips it.
export type PatientFormData = z.infer<typeof patientSchema> & { assignedPsychologistId?: string };

// ==========================================
// APPOINTMENT SCHEMAS
// ==========================================

export const appointmentSchema = z.object({
  patientId: z.string().min(1, 'Selecciona un paciente'),
  professionalId: z.string().min(1, 'Selecciona un profesional'),
  specialtyId: z.string().min(1, 'Selecciona una especialidad'),
  title: z.string().min(3, 'El título debe tener al menos 3 caracteres'),
  description: z.string().optional(),
  startTime: z.string().min(1, 'Selecciona fecha y hora de inicio'),
  duration: z.number().min(15, 'La duración mínima es 15 minutos').max(240),
  isOnline: z.boolean().default(false),
  meetingUrl: z.string().url('URL inválida').optional().or(z.literal('')),
  location: z.string().optional(),
  branchId: z.string().optional(),
});

// Task 10 replaces the old dialog; the runtime schema emits only canonical fields.
export type AppointmentFormData = z.infer<typeof appointmentSchema> & { psychologistId?: string };

// ==========================================
// CLINICAL NOTE SCHEMAS
// ==========================================

export const clinicalNoteSchema = z.object({
  patientId: z.string().min(1, 'El paciente ID es requerido'),
  appointmentId: z.string().optional(),
  content: z.string().min(10, 'El contenido debe tener al menos 10 caracteres'),
  diagnosis: z.string().optional(),
  treatment: z.string().optional(),
  observations: z.string().optional(),
  sessionDuration: z.number().min(1).max(240).optional(),
  sessionDate: z.string().optional(),
});

export type ClinicalNoteFormData = z.infer<typeof clinicalNoteSchema>;

// ==========================================
// SESSION PLAN SCHEMAS
// ==========================================

export const sessionPlanSchema = z.object({
  objectives: z.string().optional(),
  techniques: z.string().optional(),
  homework: z.string().optional(),
  notes: z.string().optional(),
});

export type SessionPlanFormData = z.infer<typeof sessionPlanSchema>;

// ==========================================
// TASK SCHEMAS
// ==========================================

export const taskSchema = z.object({
  title: z.string().min(3, 'El título debe tener al menos 3 caracteres'),
  description: z.string().optional(),
  assignedToId: z.string().min(1, 'Asigna la actividad a un usuario'),
  patientId: z.string().min(1, 'Selecciona un paciente'),
  priority: z.nativeEnum(TaskPriority).default(TaskPriority.MEDIUM),
  dueDate: z.string().optional(),
});

export type TaskFormData = z.infer<typeof taskSchema>;

// ==========================================
// USER INVITE SCHEMA
// ==========================================

export const userInviteSchema = z.object({
  email: z.string().email('Email inválido'),
  firstName: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  lastName: z.string().min(2, 'El apellido debe tener al menos 2 caracteres'),
  role: z.nativeEnum(UserRole),
  professionalTitle: z.string().optional(),
  specialtyId: z.string().optional(),
  professionalProfile: professionalProfileInputSchema.optional(),
});

export type UserInviteFormData = z.infer<typeof userInviteSchema>;

// ==========================================
// SUBSCRIPTION SCHEMAS
// ==========================================

export const subscriptionUpgradeSchema = z.object({
  planId: z.string().min(1, 'Selecciona un plan'),
  billingCycle: z.enum(['MONTHLY', 'YEARLY']),
  paymentMethodId: z.string().optional(),
});

export type SubscriptionUpgradeFormData = z.infer<typeof subscriptionUpgradeSchema>;

// ==========================================
// TENANT SETTINGS SCHEMAS
// ==========================================

export const tenantSettingsSchema = z.object({
  defaultSessionDuration: z.number().min(15, 'La duración mínima es 15 minutos').max(240),
  timezone: z.string(),
  locale: z.string(),
  workingHours: z.object({
    monday: z.object({ enabled: z.boolean(), startTime: z.string(), endTime: z.string() }),
    tuesday: z.object({ enabled: z.boolean(), startTime: z.string(), endTime: z.string() }),
    wednesday: z.object({ enabled: z.boolean(), startTime: z.string(), endTime: z.string() }),
    thursday: z.object({ enabled: z.boolean(), startTime: z.string(), endTime: z.string() }),
    friday: z.object({ enabled: z.boolean(), startTime: z.string(), endTime: z.string() }),
    saturday: z.object({ enabled: z.boolean(), startTime: z.string(), endTime: z.string() }),
    sunday: z.object({ enabled: z.boolean(), startTime: z.string(), endTime: z.string() }),
  }),
});

export type TenantSettingsFormData = z.infer<typeof tenantSettingsSchema>;
