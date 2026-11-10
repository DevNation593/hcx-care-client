'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePatientTeam, useEligiblePatientProfessionals, useAssignPatientProfessional, useRemovePatientProfessional } from '@/hooks/usePatientTeam';
import { useTenantSpecialties } from '@/hooks/useSpecialties';
import { useAuthStore } from '@/store/authStore';
import { canAddPatientTeamMember, canRemovePatientTeamMember } from '@/types/guards';
import { UserRole, type PatientTeamMember } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { getErrorMessage } from '@/lib/api/error-messages';

const HISTORICAL_SPECIALTY = 'Sin especialidad vigente';
const BLOCKED_CODE = 'PROFESSIONAL_HAS_FUTURE_APPOINTMENTS';

interface FutureAppointment {
  id: string;
  title: string;
  startTime: string;
  status: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function futureAppointments(error: unknown): FutureAppointment[] | null {
  if (!isRecord(error) || error.code !== BLOCKED_CODE || !isRecord(error.details)) return null;
  const appointments = error.details.appointments;
  if (!Array.isArray(appointments)) return null;
  return appointments.flatMap((entry): FutureAppointment[] => {
    if (!isRecord(entry) || typeof entry.id !== 'string' || !entry.id.trim() ||
        typeof entry.title !== 'string' || !entry.title.trim() ||
        typeof entry.startTime !== 'string' || Number.isNaN(Date.parse(entry.startTime)) ||
        typeof entry.status !== 'string') return [];
    return [{ id: entry.id, title: entry.title, startTime: entry.startTime, status: entry.status }];
  });
}

function fullName(person: { firstName: string; lastName: string }): string {
  return `${person.firstName} ${person.lastName}`.trim();
}

function dateLabel(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Fecha no disponible' : date.toLocaleString('es-EC');
}

function specialtyGroups(members: PatientTeamMember[]): Array<{ id: string; name: string; members: PatientTeamMember[] }> {
  const groups = new Map<string, { id: string; name: string; members: PatientTeamMember[] }>();
  for (const member of members) {
    const specialty = member.professional.specialty;
    const id = specialty?.id ?? 'historical';
    const existing = groups.get(id);
    if (existing) existing.members.push(member);
    else groups.set(id, { id, name: specialty?.name ?? HISTORICAL_SPECIALTY, members: [member] });
  }
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

function PatientTeamCandidateControls({
  patientId,
  pending,
  onAssign,
}: {
  patientId: string;
  pending: boolean;
  onAssign: (professionalId: string) => Promise<boolean>;
}) {
  const specialties = useTenantSpecialties();
  const [specialtyId, setSpecialtyId] = useState('');
  const [professionalId, setProfessionalId] = useState('');
  const eligible = useEligiblePatientProfessionals(patientId, specialtyId);
  const activeSpecialties = (specialties.data ?? []).filter((specialty) => specialty.isActive);
  const candidates = eligible.data ?? [];

  const handleAssign = async () => {
    if (!professionalId || !specialtyId || pending) return;
    if (await onAssign(professionalId)) setProfessionalId('');
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <div className="space-y-2">
          <Label htmlFor="team-specialty">Especialidad</Label>
          <select
            id="team-specialty"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={specialtyId}
            disabled={pending || specialties.isLoading || specialties.isError || activeSpecialties.length === 0}
            onChange={(event) => {
              setSpecialtyId(event.target.value);
              setProfessionalId('');
            }}
          >
            <option value="">Seleccionar especialidad</option>
            {activeSpecialties.map((specialty) => (
              <option key={specialty.id} value={specialty.id}>{specialty.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="team-professional">Profesional</Label>
          <select
            id="team-professional"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={professionalId}
            disabled={!specialtyId || pending || eligible.isLoading || eligible.isError || candidates.length === 0}
            onChange={(event) => setProfessionalId(event.target.value)}
          >
            <option value="">Seleccionar profesional</option>
            {candidates.map((professional) => (
              <option key={professional.id} value={professional.id} disabled={professional.isAssigned}>
                {fullName(professional)}{professional.isAssigned ? ' (ya asignado)' : ''}
              </option>
            ))}
          </select>
        </div>
        <Button
          type="button"
          aria-label="Agregar al equipo"
          disabled={!specialtyId || !professionalId || pending}
          onClick={() => void handleAssign()}
        >
          Agregar al equipo
        </Button>
      </div>

      {specialties.isLoading && (
        <p role="status" aria-label="Cargando especialidades">Cargando especialidades…</p>
      )}
      {specialties.isError && (
        <div role="alert" className="space-y-2">
          <p>No se pudieron cargar las especialidades.</p>
          <Button
            type="button"
            variant="outline"
            aria-label="Reintentar especialidades"
            disabled={pending || specialties.isFetching}
            onClick={() => void specialties.refetch()}
          >
            Reintentar especialidades
          </Button>
        </div>
      )}
      {specialties.isSuccess && activeSpecialties.length === 0 && (
        <p>No hay especialidades disponibles.</p>
      )}
      {specialties.isSuccess && activeSpecialties.length > 0 && !specialtyId && (
        <p>Selecciona una especialidad para ver profesionales.</p>
      )}
      {specialtyId && eligible.isLoading && (
        <p role="status" aria-label="Cargando profesionales">Cargando profesionales…</p>
      )}
      {specialtyId && eligible.isError && (
        <div role="alert" className="space-y-2">
          <p>No se pudieron cargar los profesionales.</p>
          <Button
            type="button"
            variant="outline"
            aria-label="Reintentar profesionales"
            disabled={pending || eligible.isFetching}
            onClick={() => void eligible.refetch()}
          >
            Reintentar profesionales
          </Button>
        </div>
      )}
      {specialtyId && eligible.isSuccess && candidates.length === 0 && (
        <p>No hay profesionales elegibles para esta especialidad.</p>
      )}
    </div>
  );
}

export function PatientTeamTab({ patientId }: { patientId: string }) {
  const actor = useAuthStore((state) => state.user);
  const team = usePatientTeam(patientId);
  const assign = useAssignPatientProfessional(patientId);
  const remove = useRemovePatientProfessional(patientId);
  const [selectedMember, setSelectedMember] = useState<PatientTeamMember | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [blockedAppointments, setBlockedAppointments] = useState<FutureAppointment[] | null>(null);
  const canRemove = !!actor && canRemovePatientTeamMember(actor);
  const pending = assign.isPending || remove.isPending;
  const members = team.data ?? [];
  // A professional may read any team but only refer colleagues for patients they treat;
  // the API rejects the candidate list otherwise.
  const isOutsideProfessional = !!actor
    && actor.role === UserRole.PROFESIONAL
    && !members.some((member) => member.isActive && member.professionalId === actor.id);
  const canAdd = !!actor && canAddPatientTeamMember(actor) && !isOutsideProfessional;
  const activeGroups = specialtyGroups(members.filter((member) => member.isActive));
  const inactiveGroups = specialtyGroups(members.filter((member) => !member.isActive));

  const handleAssign = async (professionalId: string): Promise<boolean> => {
    if (!canAdd || !professionalId || pending) return false;
    setActionError(null);
    setBlockedAppointments(null);
    try {
      await assign.mutateAsync(professionalId);
      return true;
    } catch {
      setActionError('No se pudo agregar al profesional. Inténtalo de nuevo.');
      return false;
    }
  };

  const handleRemove = async () => {
    if (!canRemove || !selectedMember || pending) return;
    setActionError(null);
    setBlockedAppointments(null);
    try {
      await remove.mutateAsync(selectedMember.professionalId);
      setSelectedMember(null);
    } catch (error) {
      const appointments = futureAppointments(error);
      setBlockedAppointments(appointments);
      setActionError(appointments
        ? 'Cancela o reasigna las citas futuras antes de retirar a este profesional.'
        : 'No se pudo retirar al profesional. Inténtalo de nuevo.');
      setSelectedMember(null);
    }
  };

  if (team.isLoading) return <p role="status">Cargando equipo tratante…</p>;
  if (team.isError) return (
    <div role="alert" className="space-y-3">
      <p>No se pudo cargar el equipo tratante.</p>
      <p className="text-sm text-muted-foreground">{getErrorMessage(team.error, 'Intenta de nuevo.')}</p>
      <Button type="button" variant="outline" aria-label="Reintentar equipo tratante" onClick={() => void team.refetch()}>
        Reintentar equipo tratante
      </Button>
    </div>
  );

  const renderGroups = (groups: ReturnType<typeof specialtyGroups>, status: 'Activo' | 'Inactivo') => groups.map((group) => (
    <section key={`${status}-${group.id}`} className="space-y-3">
      <h3 className="font-semibold">{group.name}</h3>
      {group.members.map((member) => (
        <Card key={member.id} data-testid="team-member">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
            <div>
              <p className="font-medium">{fullName(member.professional)}</p>
              {member.professional.professionalTitle && <p className="text-sm text-muted-foreground">{member.professional.professionalTitle}</p>}
              <p className="text-sm">{status}</p>
              <p className="text-sm text-muted-foreground">
                Asignado el {dateLabel(member.assignedAt)} por {member.assignedBy ? fullName(member.assignedBy) : 'Usuario no disponible'}
              </p>
            </div>
            {canRemove && member.isActive && (
              <Button type="button" variant="outline" disabled={pending} aria-label={`Retirar ${fullName(member.professional)}`}
                onClick={() => { setActionError(null); setBlockedAppointments(null); setSelectedMember(member); }}>
                Retirar
              </Button>
            )}
          </CardContent>
        </Card>
      ))}
    </section>
  ));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Equipo tratante</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          {canAdd && (
            <PatientTeamCandidateControls
              patientId={patientId}
              pending={pending}
              onAssign={handleAssign}
            />
          )}
          {isOutsideProfessional && (
            <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
              Solo los profesionales que atienden a este paciente pueden agregar integrantes.
            </p>
          )}
          {actionError && <div role="alert" className="space-y-2">
            <p>{actionError}</p>
            {blockedAppointments && blockedAppointments.length > 0 && (
              <ul className="space-y-2">
                {blockedAppointments.map((appointment) => (
                  <li key={appointment.id}>
                    <span>{appointment.title}</span>
                    <span> · {dateLabel(appointment.startTime)} · {appointment.status}</span>{' '}
                    <Link href={`/calendar?appointmentId=${encodeURIComponent(appointment.id)}`}>Abrir cita</Link>
                  </li>
                ))}
              </ul>
            )}
          </div>}
          {members.length === 0 && <p className="text-sm text-muted-foreground">Este paciente aún no tiene profesionales en su equipo tratante.</p>}
          {activeGroups.length > 0 && <section className="space-y-4"><h2 className="text-lg font-semibold">Activos</h2>{renderGroups(activeGroups, 'Activo')}</section>}
          {inactiveGroups.length > 0 && <section className="space-y-4"><h2 className="text-lg font-semibold">Inactivos</h2>{renderGroups(inactiveGroups, 'Inactivo')}</section>}
        </CardContent>
      </Card>

      <AlertDialog open={!!selectedMember} onOpenChange={(open) => { if (!open && !pending) setSelectedMember(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Retirar del equipo tratante?</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedMember ? `Se retirará a ${fullName(selectedMember.professional)} del equipo tratante.` : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={pending} onClick={(event) => { event.preventDefault(); void handleRemove(); }}>
              Retirar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
