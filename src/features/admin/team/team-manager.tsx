'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Stethoscope, UserCheck, UserPlus, UserX } from 'lucide-react';
import Link from 'next/link';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Pagination } from '@/components/ui/pagination';
import { SkeletonTable } from '@/components/ui/skeleton';
import { usePagination } from '@/hooks/usePagination';
import { useTenantSpecialties } from '@/hooks/useSpecialties';
import { subscriptionApi, usersApi, extractArray } from '@/lib/api/endpoints';
import { countActiveProfessionalProfiles } from '@/lib/professional-profiles';
import { QUERY_KEYS, ROLE_LABELS } from '@/lib/constants';
import { isMasterRole, isClinicPlan } from '@/types/guards';
import { UserRole, type TenantTeamProfessionalProfileInput, type UpdateTenantUserInput, type UsageMetrics, type User } from '@/types';
import { useAuthStore } from '@/store/authStore';
import { TeamMemberDialog } from './team-member-dialog';

type UserListData = {
  users: User[];
  isPaginated: boolean;
};

type ActionError = {
  tenantId: string;
  message: string;
};

const TEAM_USER_ROLES = new Set<UserRole>([
  UserRole.MASTER,
  UserRole.PROFESIONAL,
  UserRole.ASISTENTE,
]);

function messageFrom(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null) {
    const response = 'response' in error ? error.response : undefined;
    if (typeof response === 'object' && response !== null && 'data' in response) {
      const data = response.data;
      if (typeof data === 'object' && data !== null && 'message' in data) {
        const message = data.message;
        if (typeof message === 'string') return message;
        if (Array.isArray(message)) return message.join(' ');
      }
    }
    if ('message' in error && typeof error.message === 'string') return error.message;
  }
  return fallback;
}

function currentTenantId(): string | null {
  const state = useAuthStore.getState();
  return state.tenant?.id ?? state.user?.tenantId ?? null;
}

function getProfileInput(user: User, isActive: boolean): TenantTeamProfessionalProfileInput | null {
  const profile = user.professionalProfile;
  if (!profile) return null;
  return {
    specialtyId: profile.specialtyId,
    ...(profile.professionalTitle !== undefined ? { professionalTitle: profile.professionalTitle } : {}),
    ...(profile.licenseNumber !== undefined ? { licenseNumber: profile.licenseNumber } : {}),
    ...(profile.bio !== undefined ? { bio: profile.bio } : {}),
    isActive,
  };
}

function memberName(user: User): string {
  return `${user.firstName} ${user.lastName}`.trim();
}

export function TeamManager() {
  const tenant = useAuthStore((state) => state.tenant);
  const tenantId = useAuthStore((state) => state.tenant?.id ?? state.user?.tenantId ?? null);
  const currentUser = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const hasTeamModule = isClinicPlan(tenant);
  const canManage = !!currentUser && isMasterRole(currentUser.role);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<User | null>(null);
  const [actionError, setActionError] = useState<ActionError | null>(null);
  const [pendingTenantIds, setPendingTenantIds] = useState<string[]>([]);
  const actionLocks = useRef(new Set<string>());
  const specialtiesQuery = useTenantSpecialties(hasTeamModule);

  const usersQuery = useQuery({
    queryKey: QUERY_KEYS.USERS_SCOPED(tenantId ?? ''),
    queryFn: async (): Promise<UserListData> => {
      if (!tenantId) throw new Error('No tenant ID available.');
      const response = await usersApi.list(undefined, tenantId);
      return {
        users: extractArray(response),
        isPaginated: !Array.isArray(response),
      };
    },
    enabled: hasTeamModule && !!tenantId,
  });

  const usageQuery = useQuery({
    queryKey: QUERY_KEYS.SUBSCRIPTION_USAGE_SCOPED(tenantId ?? '', 'current'),
    queryFn: () => {
      if (!tenantId) throw new Error('No tenant ID available.');
      return subscriptionApi.getUsage({ period: 'current' }, tenantId);
    },
    enabled: hasTeamModule && !!tenantId,
  });

  useEffect(() => {
    setDialogOpen(false);
    setEditingMember(null);
    setActionError(null);
  }, [tenantId]);

  const users = (usersQuery.data?.users ?? []).filter((user) => TEAM_USER_ROLES.has(user.role));
  const pagination = usePagination(users, { resetKey: tenantId ?? '' });
  const usage = usageQuery.isError ? undefined : usageQuery.data as UsageMetrics | undefined;
  const usageBelongsToTenant = !!tenantId && usage?.tenantId === tenantId;
  const profileLimit = usageBelongsToTenant ? usage.users.professionals.limit : undefined;
  const activeProfiles = usageBelongsToTenant
    ? usage.users.professionals.active
    : usersQuery.data && !usersQuery.data.isPaginated
      ? countActiveProfessionalProfiles(users)
      : null;
  const usageDescription = activeProfiles === null
    ? usageQuery.isError
      ? 'No se pudo consultar el uso de perfiles clínicos.'
      : 'Consultando el uso de perfiles clínicos…'
    : profileLimit !== undefined
      ? `${activeProfiles} de ${profileLimit} perfiles clínicos activos`
      : `${activeProfiles} perfiles clínicos activos`;
  const isMutationPending = !!tenantId && pendingTenantIds.includes(tenantId);
  const enabledSpecialties = useMemo(
    () => (specialtiesQuery.data ?? []).filter((specialty) => specialty.isActive),
    [specialtiesQuery.data],
  );
  const specialtyError = specialtiesQuery.isError
    ? messageFrom(specialtiesQuery.error, 'No se pudieron cargar las especialidades.')
    : null;

  const invalidateTeamData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.USERS }),
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SUBSCRIPTION }),
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SUBSCRIPTION_USAGE }),
    ]);
  };

  const runAction = async (actionTenantId: string, operation: () => Promise<unknown>) => {
    if (actionLocks.current.has(actionTenantId)) return;
    actionLocks.current.add(actionTenantId);
    setPendingTenantIds((current) => current.includes(actionTenantId) ? current : [...current, actionTenantId]);
    if (currentTenantId() === actionTenantId) setActionError(null);
    try {
      await operation();
      await invalidateTeamData();
    } catch (error) {
      if (currentTenantId() === actionTenantId) {
        setActionError({
          tenantId: actionTenantId,
          message: messageFrom(error, 'No se pudo completar la acción.'),
        });
      }
    } finally {
      actionLocks.current.delete(actionTenantId);
      setPendingTenantIds((current) => current.filter((id) => id !== actionTenantId));
    }
  };

  const handleDialogSubmit = async (input: Parameters<typeof usersApi.create>[0] | UpdateTenantUserInput) => {
    const actionTenantId = tenantId;
    if (!actionTenantId) throw new Error('No hay un consultorio activo.');
    if (actionLocks.current.has(actionTenantId)) throw new Error('Ya hay una acción en curso.');
    actionLocks.current.add(actionTenantId);
    setPendingTenantIds((current) => current.includes(actionTenantId) ? current : [...current, actionTenantId]);
    try {
      if ('password' in input) {
        await usersApi.create(input, actionTenantId);
      } else {
        if (!editingMember) throw new Error('Selecciona el miembro que deseas editar.');
        await usersApi.update(editingMember.id, input, actionTenantId);
      }
      await invalidateTeamData();
      if (currentTenantId() === actionTenantId) setActionError(null);
    } finally {
      actionLocks.current.delete(actionTenantId);
      setPendingTenantIds((current) => current.filter((id) => id !== actionTenantId));
    }
  };

  const editMember = (user: User) => {
    setActionError(null);
    setEditingMember(user);
    setDialogOpen(true);
  };

  const deactivateAccount = (user: User) => {
    if (!tenantId || !window.confirm(`¿Desactivar la cuenta de ${memberName(user)}?`)) return;
    const actionTenantId = tenantId;
    void runAction(actionTenantId, () => usersApi.delete(user.id, actionTenantId));
  };

  const reactivateAccount = (user: User) => {
    if (!tenantId) return;
    const actionTenantId = tenantId;
    void runAction(actionTenantId, () => usersApi.update(user.id, { isActive: true }, actionTenantId));
  };

  const toggleClinicalCare = (user: User) => {
    if (!tenantId || !user.professionalProfile) return;
    const actionTenantId = tenantId;
    const profileInput = getProfileInput(user, !user.professionalProfile.isActive);
    if (!profileInput) return;
    void runAction(actionTenantId, () => usersApi.update(user.id, { professionalProfile: profileInput }, actionTenantId));
  };

  if (!hasTeamModule) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <UserPlus className="mb-4 h-12 w-12 text-muted-foreground" aria-hidden="true" />
          <h2 className="mb-2 text-xl font-semibold">Módulo de Equipo no disponible</h2>
          <p className="mb-4 max-w-md text-center text-muted-foreground">
            Tu plan actual es individual y solo permite un usuario. Para gestionar un equipo de profesionales, actualiza a un plan de clínica.
          </p>
          <Link className={buttonVariants()} href="/admin/subscription">
            Ver Planes de Clínica
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gestión de Equipo</h1>
          <p className="mt-1 text-muted-foreground">Administra las cuentas y perfiles clínicos del consultorio.</p>
        </div>
        {canManage && (
          <Button
            onClick={() => {
              setActionError(null);
              setEditingMember(null);
              setDialogOpen(true);
            }}
            disabled={isMutationPending}
          >
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            Agregar miembro
          </Button>
        )}
      </div>

      {!canManage && (
        <Alert title="Vista de solo lectura" description="Solo el titular de la cuenta puede modificar el equipo." />
      )}

      {actionError?.tenantId === tenantId && (
        <Alert variant="destructive" title="No se pudo actualizar el equipo" description={actionError.message} />
      )}

      <Alert
        variant={usageQuery.isError || (profileLimit !== undefined && activeProfiles !== null && activeProfiles >= profileLimit)
          ? 'warning'
          : 'default'}
        title="Uso de perfiles clínicos"
        description={usageDescription}
      >
        {usageQuery.isError && activeProfiles !== null && (
          <p role="status" className="text-sm text-destructive">
            No se pudo confirmar el uso ni el límite de perfiles clínicos con el servidor. El número mostrado es solo un conteo local de la lista completa.
          </p>
        )}
        {usageQuery.isError && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            aria-label="Reintentar uso de perfiles clínicos"
            onClick={() => void usageQuery.refetch()}
          >
            Reintentar uso
          </Button>
        )}
      </Alert>

      {usersQuery.isError && (
        <Alert variant="destructive" title="No se pudo cargar el equipo" description={messageFrom(usersQuery.error, 'Intenta nuevamente.')}>
          <Button type="button" size="sm" variant="outline" onClick={() => void usersQuery.refetch()}>
            Reintentar miembros
          </Button>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Miembros del equipo{usersQuery.data ? ` (${users.length})` : ''}</CardTitle>
        </CardHeader>
        <CardContent>
          {usersQuery.isLoading ? (
            <SkeletonTable />
          ) : users.length > 0 ? (
            <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th scope="col" className="px-4 py-3 text-left font-medium">Nombre y correo</th>
                    <th scope="col" className="px-4 py-3 text-left font-medium">Rol</th>
                    <th scope="col" className="px-4 py-3 text-left font-medium">Especialidad</th>
                    <th scope="col" className="px-4 py-3 text-left font-medium">Cuenta</th>
                    <th scope="col" className="px-4 py-3 text-left font-medium">Atención clínica</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {pagination.pageItems.map((user) => {
                    const profile = user.professionalProfile;
                    const name = memberName(user);
                    const roleLabel = ROLE_LABELS[user.role] ?? String(user.role);
                    const isHolder = isMasterRole(user.role);
                    const specialtyName = profile
                      ? profile.specialty?.name ?? enabledSpecialties.find((specialty) => specialty.id === profile.specialtyId)?.name ?? profile.specialtyId
                      : 'Sin perfil clínico';
                    return (
                      <tr key={user.id} className="border-b hover:bg-muted/50">
                        <td className="px-4 py-3">
                          <p className="font-medium">{name}</p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </td>
                        <td className="px-4 py-3"><Badge variant="outline">{roleLabel}</Badge></td>
                        <td className="px-4 py-3">{specialtyName}</td>
                        <td className="px-4 py-3">
                          <Badge variant={user.isActive ? 'success' : 'secondary'}>
                            {user.isActive ? 'Cuenta activa' : 'Cuenta inactiva'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          {!profile ? (
                            <Badge variant="outline">No aplica</Badge>
                          ) : (
                            <Badge variant={profile.isActive ? 'success' : 'secondary'}>
                              {profile.isActive ? 'Atención clínica activa' : 'Atención clínica inactiva'}
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap justify-end gap-2">
                            {canManage && (
                              <>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  aria-label={`Editar ${name}`}
                                  onClick={() => editMember(user)}
                                  disabled={isMutationPending}
                                >
                                  <Pencil className="h-4 w-4" aria-hidden="true" />
                                </Button>
                                {profile && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    aria-label={`${profile.isActive ? 'Desactivar' : 'Activar'} atención clínica de ${name}`}
                                    onClick={() => toggleClinicalCare(user)}
                                    disabled={isMutationPending}
                                  >
                                    <Stethoscope className="h-4 w-4" aria-hidden="true" />
                                  </Button>
                                )}
                                {!isHolder && (user.isActive ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    aria-label={`Desactivar cuenta de ${name}`}
                                    onClick={() => deactivateAccount(user)}
                                    disabled={isMutationPending}
                                  >
                                    <UserX className="h-4 w-4" aria-hidden="true" />
                                  </Button>
                                ) : (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    aria-label={`Reactivar cuenta de ${name}`}
                                    onClick={() => reactivateAccount(user)}
                                    disabled={isMutationPending}
                                  >
                                    <UserCheck className="h-4 w-4" aria-hidden="true" />
                                  </Button>
                                ))}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination
              className="mt-4"
              page={pagination.page}
              totalPages={pagination.totalPages}
              total={pagination.total}
              pageSize={pagination.pageSize}
              onPageChange={pagination.setPage}
            />
            </>
          ) : usersQuery.isError ? null : (
            <div className="py-12 text-center text-muted-foreground">
              <p>No hay usuarios registrados</p>
              {canManage && <p className="mt-1 text-sm">Agrega el primer miembro del equipo para comenzar.</p>}
            </div>
          )}
        </CardContent>
      </Card>

      <TeamMemberDialog
        key={tenantId ?? 'no-tenant'}
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingMember(null);
        }}
        tenantId={tenantId}
        member={editingMember}
        specialties={enabledSpecialties}
        specialtiesLoading={specialtiesQuery.isLoading}
        specialtiesError={specialtyError}
        onRetrySpecialties={() => void specialtiesQuery.refetch()}
        pending={isMutationPending}
        onSubmit={handleDialogSubmit}
      />
    </div>
  );
}
