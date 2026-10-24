import { TenantType, type ApiSubscriptionStatus, type PlanValueField, type SubscriptionPayment } from '@/types';

export const TENANT_TYPE_LABELS: Record<TenantType, string> = {
  [TenantType.PERSONAL]: 'Personal',
  [TenantType.CLINIC]: 'Clínica',
};

/** How the panel names each value a plan gives a clinic. */
export const PLAN_VALUE_LABELS: Record<PlanValueField, string> = {
  basePrice: 'Precio mensual',
  pricePerSeat: 'Precio por profesional adicional',
  specialtyPrice: 'Precio por especialidad adicional',
  currency: 'Moneda',
  seatsPsychologistsMax: 'Profesionales',
  maxActivePatients: 'Pacientes activos',
  storageGB: 'Almacenamiento (GB)',
  monthlyElectronicInvoicesLimit: 'Facturas electrónicas al mes',
  includedSpecialties: 'Especialidades incluidas',
};

export const formatMoney = (amount: number, currency = 'USD') =>
  new Intl.NumberFormat('es-EC', { style: 'currency', currency }).format(amount);

export const SUBSCRIPTION_STATUS_LABELS: Record<ApiSubscriptionStatus, string> = {
  TRIALING: 'En prueba',
  ACTIVE: 'Al día',
  PAST_DUE: 'Vencido',
  UNPAID: 'Bloqueado',
  CANCELED: 'Bloqueado',
  INCOMPLETE: 'Bloqueado',
};

export const SUSPENDED_LABEL = 'Suspendido';

/** An inactive clinic reads as suspended whatever its subscription says. */
export function tenantStatusLabel(tenant: {
  isActive: boolean;
  status: ApiSubscriptionStatus | null;
}): string {
  if (!tenant.isActive) return SUSPENDED_LABEL;
  return tenant.status ? SUBSCRIPTION_STATUS_LABELS[tenant.status] : 'Sin suscripción';
}

export const PAYMENT_KIND_LABELS: Record<SubscriptionPayment['kind'], string> = {
  PLAN_UPGRADE: 'Mejora de plan (anterior)',
  RENEWAL: 'Renovación',
};

export const PAYMENT_STATUS_LABELS: Record<SubscriptionPayment['status'], string> = {
  PENDING: 'Pendiente',
  CONFIRMED: 'Confirmado',
  REJECTED: 'Rechazado',
  CANCELED: 'Cancelado',
  EXPIRED: 'Vencido',
};
