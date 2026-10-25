'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { subscriptionApi } from '@/lib/api/endpoints';
import { QUERY_KEYS, PLAN_LABELS, ROUTES } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Skeleton, SkeletonCard } from '@/components/ui/skeleton';
import { useAuthStore } from '@/store/authStore';
import { RestrictedAccess } from '@/components/layout/restricted-access';
import { useCanManageAccount } from '@/hooks/useCanManageAccount';
import { Check, Users, HardDrive, Shield, Zap, Crown, AlertTriangle, Clock } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { PlanTier, type FeatureFlags } from '@/types';
import { getStatusDisplayName, getStatusColor, getPlanDisplayName } from '@/types/guards';
import { PlanPaymentsSection } from '@/features/subscription/plan-payments-section';

// ==========================================
// Subcomponents
// ==========================================

function UsageGauge({
  label,
  icon,
  current,
  limit,
  unit,
  formatValue,
}: {
  label: string;
  icon: React.ReactNode;
  current: number;
  limit: number;
  unit?: string;
  formatValue?: (v: number) => string;
}) {
  const percentage = limit > 0 ? Math.min((current / limit) * 100, 100) : 0;
  const displayCurrent = formatValue ? formatValue(current) : current.toString();
  const displayLimit = formatValue ? formatValue(limit) : limit.toString();
  const suffix = unit ? ` ${unit}` : '';

  const getColor = (pct: number) => {
    if (pct >= 90) return 'text-red-600';
    if (pct >= 70) return 'text-orange-500';
    return 'text-primary';
  };

  const getBarColor = (pct: number) => {
    if (pct >= 90) return '[&>div]:bg-red-500';
    if (pct >= 70) return '[&>div]:bg-orange-400';
    return '';
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            {icon}
            <span className="text-sm font-medium">{label}</span>
          </div>
          {percentage >= 80 && (
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          )}
        </div>
        <p className={`text-2xl font-bold ${getColor(percentage)}`}>
          {displayCurrent}
          <span className="text-sm font-normal text-muted-foreground">
            {' '}/ {displayLimit}{suffix}
          </span>
        </p>
        <Progress value={percentage} className={`mt-3 h-2 ${getBarColor(percentage)}`} />
        <p className="text-xs text-muted-foreground mt-1">
          {percentage.toFixed(0)}% utilizado
        </p>
      </CardContent>
    </Card>
  );
}

function SubscriptionStatusBar({
  status,
  trialEndsAt,
  cancelAtPeriodEnd,
  currentPeriodEnd,
}: {
  status: string;
  trialEndsAt: string | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string;
}) {
  if (status === 'TRIAL' && trialEndsAt) {
    const daysLeft = Math.max(
      0,
      Math.ceil(
        (new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      )
    );
    return (
      <Alert
        variant={daysLeft <= 3 ? 'destructive' : 'warning'}
        title={`Periodo de prueba: ${daysLeft} días restantes`}
        description={`Tu periodo de prueba termina el ${formatDate(trialEndsAt, 'dd/MM/yyyy')}. Te enviaremos el cobro del primer mes; contacta a soporte para registrar tu pago.`}
      />
    );
  }

  if (cancelAtPeriodEnd) {
    return (
      <Alert
        variant="warning"
        title="Suscripción programada para cancelarse"
        description={`Tu suscripción se cancelará al final del período actual (${formatDate(currentPeriodEnd, 'dd/MM/yyyy')}). Puedes reactivar en cualquier momento.`}
      />
    );
  }

  if (status === 'PAST_DUE') {
    return (
      <Alert
        variant="destructive"
        title="Pago pendiente"
        description="Tu período terminó sin un pago confirmado. La cuenta está en modo de solo lectura; registra tu pago con soporte para evitar la suspensión."
      />
    );
  }

  if (status === 'SUSPENDED') {
    return (
      <Alert
        variant="destructive"
        title="Cuenta suspendida"
        description="Tu cuenta está suspendida por falta de pago. Registra tu pago con soporte para restaurar el acceso."
      />
    );
  }

  return null;
}

// ==========================================
// Main Page
// ==========================================

function SubscriptionPageContent() {
  const router = useRouter();
  const tenant = useAuthStore((state) => state.tenant);

  const { data: usageData, isLoading: usageLoading } = useQuery({
    queryKey: QUERY_KEYS.SUBSCRIPTION_USAGE,
    queryFn: async () => {
      const response = await subscriptionApi.getUsage();
      return response;
    },
  });

  // Guard: no tenant at all — still loading from persist
  if (!tenant) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48 mt-2" />
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <SkeletonCard />
      </div>
    );
  }

  const subscription = tenant.subscription ?? null;
  const currentPlan = subscription?.plan ?? null;
  const currentPlanType = currentPlan?.planType ?? PlanTier.TRIAL;
  const hasSubscriptionData = !!subscription && !!currentPlan;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Suscripción y Facturación</h1>
          <p className="text-muted-foreground mt-1">
            Administra tu plan, uso de recursos y facturación
          </p>
        </div>
        <Button
          variant="outline"
          className="gap-2"
          onClick={() => router.push(ROUTES.ADMIN_STORAGE)}
        >
          <HardDrive className="h-4 w-4" />
          Gestionar Almacenamiento
        </Button>
      </div>

      {/* Status Alerts */}
      {hasSubscriptionData && (
        <SubscriptionStatusBar
          status={subscription!.status}
          trialEndsAt={subscription!.trialEndsAt}
          cancelAtPeriodEnd={subscription!.cancelAtPeriodEnd}
          currentPeriodEnd={subscription!.currentPeriodEnd}
        />
      )}

      {/* Current Plan Summary */}
      {hasSubscriptionData ? (
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  {currentPlanType === PlanTier.BASIC && <Shield className="h-5 w-5 text-primary" />}
                  {currentPlanType === PlanTier.PROFESSIONAL && <Zap className="h-5 w-5 text-primary" />}
                  {currentPlanType === PlanTier.ENTERPRISE && <Crown className="h-5 w-5 text-primary" />}
                  {currentPlanType === PlanTier.TRIAL && <Clock className="h-5 w-5 text-primary" />}
                </div>
                <div>
                  <CardTitle className="text-lg">
                    Plan {currentPlan!.name || PLAN_LABELS[currentPlanType] || getPlanDisplayName(currentPlanType)}
                  </CardTitle>
                  <CardDescription>Tu suscripción actual</CardDescription>
                </div>
              </div>
              <Badge variant={getStatusColor(subscription!.status)}>
                {getStatusDisplayName(subscription!.status)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Inicio del período</p>
                <p className="font-semibold">
                  {subscription!.currentPeriodStart ? formatDate(subscription!.currentPeriodStart, 'dd MMM yyyy') : '—'}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Próxima facturación</p>
                <p className="font-semibold">
                  {subscription!.currentPeriodEnd
                    ? formatDate(subscription!.currentPeriodEnd, 'dd MMM yyyy')
                    : '—'}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Intervalo</p>
                <p className="font-semibold">
                  {currentPlan!.billingInterval === 'ANNUAL' ? 'Anual' : 'Mensual'}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Precio por profesional</p>
                <p className="font-semibold">
                  ${((currentPlan!.pricePerSeatMonthly ?? 0) / 100).toLocaleString('en-US')} USD
                  <span className="text-xs text-muted-foreground font-normal"> /mes</span>
                </p>
              </div>
            </div>

          </CardContent>
        </Card>
      ) : (
        <Alert
          variant="warning"
          title="Sin plan activo"
          description="No se encontró información de suscripción. Contacta a soporte para que te asignen un plan."
        />
      )}

      {/* Usage Metrics */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Uso de Recursos</h2>
        {usageLoading ? (
          <div className="grid md:grid-cols-3 gap-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : usageData ? (
          <div className="grid md:grid-cols-3 gap-4">
            <UsageGauge
              label="Profesionales"
              icon={<Users className="h-4 w-4" />}
              current={usageData?.users?.psychologists?.active ?? 0}
              limit={usageData?.users?.psychologists?.limit ?? 0}
            />
            <UsageGauge
              label="Pacientes activos"
              icon={<Users className="h-4 w-4" />}
              current={usageData?.patients?.active ?? 0}
              limit={usageData?.patients?.limit ?? 0}
            />
            <UsageGauge
              label="Almacenamiento"
              icon={<HardDrive className="h-4 w-4" />}
              current={usageData?.storage?.usedGB ?? 0}
              limit={usageData?.storage?.limitGB ?? 0}
              unit="GB"
              formatValue={(v) => v.toFixed(1)}
            />
          </div>
        ) : (
          <Alert
            variant="default"
            title="Datos de uso no disponibles"
            description="No se pudieron cargar las métricas de uso. Intenta recargar la página."
          />
        )}
      </div>

      <PlanPaymentsSection />
    </div>
  );
}

// ==========================================
// Helper: Render feature list from FeatureFlags
// ==========================================

function renderFeatureList(features?: FeatureFlags) {
  if (!features) return null;
  const featureEntries: { key: string; label: string; value: boolean | string }[] = [
    { key: 'dashboard', label: 'Dashboard', value: features.dashboard },
    { key: 'calendar', label: 'Calendario', value: features.calendar },
    { key: 'patients', label: 'Pacientes', value: features.patients },
    { key: 'appointments', label: 'Citas', value: features.appointments },
    { key: 'clinicalNotes', label: 'Notas clínicas', value: features.clinicalNotes },
    { key: 'tasks', label: 'Actividades', value: features.tasks },
    { key: 'attachments', label: 'Adjuntos', value: features.attachments },
    { key: 'sessionPlans', label: 'Planes de sesión', value: features.sessionPlans },
    { key: 'emailNotifications', label: 'Email', value: features.emailNotifications },
    { key: 'webPush', label: 'Push', value: features.webPush },
    { key: 'advancedAnalytics', label: 'Analíticas', value: features.advancedAnalytics },
    { key: 'dataExport', label: 'Exportar datos', value: features.dataExport },
    { key: 'videoIntegration', label: 'Video', value: features.videoIntegration },
    { key: 'customBranding', label: 'Marca propia', value: features.customBranding },
    { key: 'mfa', label: 'MFA', value: features.mfa },
    { key: 'sso', label: 'SSO', value: features.sso },
    { key: 'auditLogs', label: 'Auditoría', value: features.auditLogs },
  ];

  return featureEntries
    .filter((f) => f.value === true || f.value === 'full' || f.value === 'read')
    .map((f) => (
      <span
        key={f.key}
        className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 rounded-md px-2 py-1"
      >
        <Check className="h-3 w-3" />
        {f.label}
      </span>
    ));
}

export default function SubscriptionPage() {
  const user = useAuthStore((state) => state.user);
  const canManage = useCanManageAccount();
  if (!user) return null;
  // The menu entry is hidden for other roles; this covers direct navigation.
  if (!canManage) return <RestrictedAccess />;
  return <SubscriptionPageContent />;
}
