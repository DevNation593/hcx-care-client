'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { appointmentSchema, type AppointmentFormData } from '@/lib/validations/schemas';
import { useCreateAppointment, useUpdateAppointment } from '@/hooks/useAppointments';
import { usePatients } from '@/hooks/usePatients';
import { useTenantSpecialties } from '@/hooks/useSpecialties';
import { useEligiblePatientProfessionals } from '@/hooks/usePatientTeam';
import { useAuthStore } from '@/store/authStore';
import { UserRole, type Appointment } from '@/types';
import { getAppointmentErrorMessage } from './appointment-errors';
import { useBranches } from '@/hooks/useBranches';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { usePatientTerms } from '@/hooks/usePatientTerms';

interface AppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment?: Appointment | null;
  initialDate?: Date | null;
}

function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '';
  const date = typeof value === 'string' ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? '' : format(date, "yyyy-MM-dd'T'HH:mm");
}

function formValues(appointment?: Appointment | null, initialDate?: Date | null): AppointmentFormData {
  return {
    patientId: appointment?.patientId ?? '',
    specialtyId: appointment?.specialtyId ?? '',
    professionalId: appointment?.professionalId ?? '',
    title: appointment?.title ?? 'Consulta',
    description: appointment?.description ?? '',
    startTime: formatDateTime(appointment?.startTime ?? initialDate),
    duration: appointment?.duration ?? 60,
    isOnline: appointment?.isOnline ?? false,
    meetingUrl: appointment?.meetingUrl ?? '',
    location: appointment?.location ?? '',
    branchId: appointment?.branchId ?? '',
  };
}

export function AppointmentDialog({
  open,
  onOpenChange,
  appointment,
  initialDate,
}: AppointmentDialogProps) {
  const actor = useAuthStore((state) => state.user);
  const createAppointment = useCreateAppointment();
  const updateAppointment = useUpdateAppointment(appointment?.id ?? '');
  const patients = usePatients();
  const terms = usePatientTerms();
  const specialties = useTenantSpecialties();
  const { data: branches = [] } = useBranches();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const initialDateKey = initialDate?.getTime() ?? null;
  const appointmentRef = useRef(appointment);
  const initialDateRef = useRef(initialDate);
  appointmentRef.current = appointment;
  initialDateRef.current = initialDate;

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    getValues,
    setValue,
  } = useForm<AppointmentFormData>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: formValues(appointment, initialDate),
  });

  useEffect(() => {
    if (!open) return;
    reset(formValues(appointmentRef.current, initialDateRef.current));
    setSubmitError(null);
    // Primitive keys avoid clearing hydrated values when query objects change identity.
  }, [appointment?.id, initialDateKey, open, reset]);

  const patientId = watch('patientId') ?? '';
  const specialtyId = watch('specialtyId') ?? '';
  const professionalId = watch('professionalId') ?? '';
  const isOnline = watch('isOnline');
  const eligible = useEligiblePatientProfessionals(patientId, specialtyId);

  const enabledSpecialties = useMemo(
    () => (specialties.data ?? []).filter((specialty) => specialty.isActive),
    [specialties.data],
  );
  const visibleProfessionals = useMemo(() => {
    const candidates = eligible.data ?? [];
    if (!actor || actor.role !== UserRole.PROFESIONAL) return candidates;
    return candidates.filter((candidate) => candidate.id === actor.id);
  }, [actor, eligible.data]);

  const historicalSpecialty = appointment?.specialtyId
    && appointment.specialty
    && specialtyId === appointment.specialtyId
    && !enabledSpecialties.some((specialty) => specialty.id === appointment.specialtyId)
    ? appointment.specialty
    : null;
  const historicalProfessional = appointment?.professionalId
    && appointment.professional
    && patientId === appointment.patientId
    && specialtyId === appointment.specialtyId
    && professionalId === appointment.professionalId
    && !visibleProfessionals.some((professional) => professional.id === appointment.professionalId)
    ? appointment.professional
    : null;

  const patientRegistration = register('patientId');
  // A professional tied to some branches is booked only in those.
  const professionalBranches = branches.filter(
    (branch) => branch.isActive && branch.professionalIds?.includes(watch('professionalId') ?? ''),
  );
  const activeBranches =
    professionalBranches.length > 0
      ? professionalBranches
      : branches.filter((branch) => branch.isActive);
  // A new appointment goes to the main branch unless another one is chosen.
  const defaultBranchId = appointment
    ? ''
    : (activeBranches.find((branch) => branch.isMain) ?? activeBranches[0])?.id ?? '';
  const chosenBranchId = watch('branchId') ?? '';
  // A new appointment never keeps a branch that stopped being offered, e.g. after changing
  // the professional; an existing one keeps what it has until the user changes it.
  const branchId =
    appointment || activeBranches.some((branch) => branch.id === chosenBranchId)
      ? chosenBranchId
      : defaultBranchId;
  const specialtyRegistration = register('specialtyId');
  const professionalRegistration = register('professionalId');
  const isPending = createAppointment.isPending || updateAppointment.isPending;

  const onSubmit = (formData: AppointmentFormData) => {
    setSubmitError(null);
    // datetime-local has no offset; send the instant so the server does not reinterpret it in its own zone.
    const { branchId: _formBranch, ...fields } = formData;
    const data = {
      ...fields,
      startTime: new Date(formData.startTime).toISOString(),
      // Null removes the branch of an appointment that had one.
      ...(branchId ? { branchId } : appointment?.branchId ? { branchId: null } : {}),
    };
    const callbacks = {
      onSuccess: () => {
        reset(formValues(null, null));
        onOpenChange(false);
      },
      onError: (error: Error) => setSubmitError(getAppointmentErrorMessage(error)),
    };

    if (appointment) {
      updateAppointment.mutate(
        { ...data, previousPatientId: appointment.patientId },
        callbacks,
      );
      return;
    }

    createAppointment.mutate(data, callbacks);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto" role="dialog" aria-modal="true">
        <DialogHeader>
          <DialogTitle>{appointment ? 'Editar cita' : 'Nueva cita'}</DialogTitle>
          <DialogDescription>
            {appointment ? 'Actualiza la cita y su profesional tratante.' : `Programa una nueva cita con un ${terms.one}.`}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="patientId">{terms.One}</Label>
            <select
              id="patientId"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              {...patientRegistration}
              onChange={(event) => {
                const changed = getValues('patientId') !== event.target.value;
                patientRegistration.onChange(event);
                if (changed) setValue('professionalId', '', { shouldValidate: false });
                setSubmitError(null);
              }}
              disabled={patients.isLoading}
              aria-required="true"
            >
              <option value="">Seleccionar {terms.one}</option>
              {patients.data?.map((patient) => (
                <option key={patient.id} value={patient.id}>
                  {patient.firstName} {patient.lastName}
                </option>
              ))}
            </select>
            {patients.isLoading && <p role="status" className="text-sm text-muted-foreground">Cargando {terms.many}...</p>}
            {patients.isError && <p role="alert" className="text-sm text-destructive">No se pudieron cargar los {terms.many}.</p>}
            {errors.patientId && <p role="alert" className="text-sm text-destructive">{errors.patientId.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="specialtyId">Especialidad</Label>
            <select
              id="specialtyId"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              {...specialtyRegistration}
              onChange={(event) => {
                const changed = getValues('specialtyId') !== event.target.value;
                specialtyRegistration.onChange(event);
                if (changed) setValue('professionalId', '', { shouldValidate: false });
                setSubmitError(null);
              }}
              disabled={specialties.isLoading}
              aria-required="true"
            >
              <option value="">Seleccionar especialidad</option>
              {historicalSpecialty && (
                <option value={historicalSpecialty.id} disabled>
                  {historicalSpecialty.name} (actual/histórica)
                </option>
              )}
              {enabledSpecialties.map((specialty) => (
                <option key={specialty.id} value={specialty.id}>{specialty.name}</option>
              ))}
            </select>
            {specialties.isLoading && <p role="status" className="text-sm text-muted-foreground">Cargando especialidades...</p>}
            {specialties.isError && <p role="alert" className="text-sm text-destructive">No se pudieron cargar las especialidades.</p>}
            {errors.specialtyId && <p role="alert" className="text-sm text-destructive">{errors.specialtyId.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="professionalId">Profesional</Label>
            <select
              id="professionalId"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              {...professionalRegistration}
              disabled={!patientId || !specialtyId || eligible.isLoading}
              aria-required="true"
              onChange={(event) => {
                professionalRegistration.onChange(event);
                setSubmitError(null);
              }}
            >
              <option value="">Seleccionar profesional</option>
              {historicalProfessional && (
                <option value={historicalProfessional.id} disabled>
                  {historicalProfessional.firstName} {historicalProfessional.lastName} (actual/histórico)
                </option>
              )}
              {visibleProfessionals.map((professional) => (
                <option key={professional.id} value={professional.id}>
                  {professional.firstName} {professional.lastName}
                </option>
              ))}
            </select>
            {eligible.isLoading && <p role="status" className="text-sm text-muted-foreground">Cargando profesionales...</p>}
            {eligible.isError && <p role="alert" className="text-sm text-destructive">No se pudieron cargar los profesionales.</p>}
            {!!patientId && !!specialtyId && !eligible.isLoading && !eligible.isError
              && visibleProfessionals.length === 0 && !historicalProfessional && (
              <p className="text-sm text-muted-foreground">No hay profesionales disponibles.</p>
            )}
            {errors.professionalId && <p role="alert" className="text-sm text-destructive">{errors.professionalId.message}</p>}
          </div>

          <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
            Si aún no integra el equipo tratante, el profesional será agregado automáticamente al crear o reasignar la cita.
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="startTime">Fecha y hora de inicio</Label>
              <Input id="startTime" type="datetime-local" aria-required="true" {...register('startTime')} error={errors.startTime?.message} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="duration">Duración (minutos)</Label>
              <select
                id="duration"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                {...register('duration', { valueAsNumber: true })}
                aria-required="true"
              >
                {[30, 45, 50, 60, 90].map((duration) => <option key={duration} value={duration}>{duration}</option>)}
              </select>
              {errors.duration && <p role="alert" className="text-sm text-destructive">{errors.duration.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Título de la cita</Label>
            <Input id="title" placeholder="Consulta" aria-required="true" {...register('title')} error={errors.title?.message} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea id="description" placeholder="Notas adicionales sobre la cita..." {...register('description')} error={errors.description?.message} />
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="isOnline" className="h-4 w-4 rounded border-input" {...register('isOnline')} />
            <Label htmlFor="isOnline">Cita en línea</Label>
          </div>

          {isOnline ? (
            <div className="space-y-2">
              <Label htmlFor="meetingUrl">URL de la reunión</Label>
              <Input id="meetingUrl" type="url" placeholder="https://meet.google.com/..." {...register('meetingUrl')} error={errors.meetingUrl?.message} />
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="location">Ubicación</Label>
              <Input id="location" placeholder="Consultorio 101" {...register('location')} />
            </div>
          )}

          {activeBranches.length > 1 && (
            <div className="space-y-2">
              <Label htmlFor="branchId">Sede</Label>
              <select
                id="branchId"
                value={branchId}
                onChange={(event) => setValue('branchId', event.target.value, { shouldDirty: true })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {appointment && <option value="">Sin sede</option>}
                {activeBranches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {submitError && <p role="alert" className="text-sm text-destructive">{submitError}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              Cerrar
            </Button>
            <Button type="submit" loading={isPending}>
              {appointment ? 'Guardar cambios' : 'Crear cita'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
