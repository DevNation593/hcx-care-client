'use client';

import { useRouter } from 'next/navigation';
import { Users, UserPlus, Database, HardDrive } from 'lucide-react';
import { UsageCard } from './usage-card';
import { useCanManageAccount } from '@/hooks/useCanManageAccount';
import { useSubscription, useUsageMetrics } from '@/hooks/useSubscription';
import { getRemainingSeats, getRemainingPatients, getRemainingStorageGB, isClinicPlan } from '@/types/guards';
import { useSections } from '@/hooks/useSections';
import { useAuthStore } from '@/store/authStore';
import { ROUTES } from '@/lib/constants';

export function PsychologistsUsageWidget() {
  const router = useRouter();
  const canManage = useCanManageAccount();
  const { data: subscription } = useSubscription();
  const { data: usage } = useUsageMetrics();

  if (!subscription || !usage) return null;

  const activeProfessionals = usage.users.professionals.active;
  const limit = subscription.plan.limits.maxPsychologists;
  const remaining = getRemainingSeats(usage);

  const handleUpgrade = () => {
    router.push(`${ROUTES.ADMIN_SUBSCRIPTION}?action=upgrade&reason=seats`);
  };

  const handleManage = () => {
    router.push(ROUTES.ADMIN_TEAM);
  };

  return (
    <UsageCard
      title="Profesionales"
      description="Miembros del equipo activos"
      icon={Users}
      current={activeProfessionals}
      limit={limit}
      unit="profesionales"
      onUpgrade={canManage ? handleUpgrade : undefined}
      upgradeNotice={canManage ? undefined : 'Contacta al titular de la cuenta.'}
      onManage={canManage ? handleManage : undefined}
      manageLabel="Ver Equipo"
    />
  );
}

export function PatientsUsageWidget() {
  const router = useRouter();
  const canManage = useCanManageAccount();
  const { data: subscription } = useSubscription();
  const { data: usage } = useUsageMetrics();

  if (!subscription || !usage) return null;

  const activePatients = usage.patients.active;
  const limit = subscription.plan.limits.maxPatients;
  const remaining = getRemainingPatients(usage);

  const handleUpgrade = () => {
    router.push(`${ROUTES.ADMIN_SUBSCRIPTION}?action=upgrade&reason=patients`);
  };

  const handleManage = () => {
    router.push('/patients'); // Asume ruta de gestión de pacientes
  };

  return (
    <UsageCard
      title="Pacientes"
      description="Expedientes activos"
      icon={UserPlus}
      current={activePatients}
      limit={limit}
      unit="pacientes"
      onUpgrade={canManage ? handleUpgrade : undefined}
      upgradeNotice={canManage ? undefined : 'Contacta al titular de la cuenta.'}
      onManage={handleManage}
      manageLabel="Ver Pacientes"
    />
  );
}

export function StorageUsageWidget() {
  const router = useRouter();
  const { isEnabled } = useSections();
  const canManage = useCanManageAccount();
  const { data: subscription } = useSubscription();
  const { data: usage } = useUsageMetrics();

  if (!isEnabled('core.patients.files') || !subscription || !usage) return null;

  const usedGB = usage.storage.usedGB;
  const limitGB = subscription.plan.limits.storageGB;
  const remainingGB = getRemainingStorageGB(usage);

  const handleUpgrade = () => {
    router.push(`${ROUTES.ADMIN_SUBSCRIPTION}?action=upgrade&reason=storage`);
  };

  const handleManage = () => {
    router.push(ROUTES.ADMIN_STORAGE);
  };

  const formatGB = (gb: number) => {
    if (gb < 1) {
      return `${(gb * 1024).toFixed(0)} MB`;
    }
    return `${gb.toFixed(1)} GB`;
  };

  return (
    <UsageCard
      title="Almacenamiento"
      description="Archivos y documentos"
      icon={HardDrive}
      current={usedGB}
      limit={limitGB}
      unit="GB"
      formatValue={formatGB}
      onUpgrade={canManage ? handleUpgrade : undefined}
      upgradeNotice={canManage ? undefined : 'Contacta al titular de la cuenta.'}
      onManage={canManage ? handleManage : undefined}
      manageLabel="Gestionar Archivos"
    />
  );
}

// Combined widget for dashboard overview
export function UsageOverview() {
  const tenant = useAuthStore((state) => state.tenant);

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {isClinicPlan(tenant) && <PsychologistsUsageWidget />}
      <PatientsUsageWidget />
      <StorageUsageWidget />
    </div>
  );
}
