'use client';

import { useState } from 'react';
import { useCancelAppointment } from '@/hooks/useAppointments';
import { useAuthStore } from '@/store/authStore';
import Link from 'next/link';
import { canAccessClinicalNotes, canEditAppointment } from '@/types/guards';
import { AppointmentStatus, type Appointment } from '@/types';
import { APPOINTMENT_STATUS_COLORS, APPOINTMENT_STATUS_LABELS } from '@/lib/constants';
import { formatDate } from '@/lib/utils';
import { getAppointmentErrorMessage } from './appointment-errors';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { usePatientTerms } from '@/hooks/usePatientTerms';

const ATTENDABLE: AppointmentStatus[] = [
  AppointmentStatus.SCHEDULED,
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.IN_PROGRESS,
];

interface AppointmentDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: Appointment | null;
  onEdit: (appointment: Appointment) => void;
}

export function AppointmentDetailsDialog({
  open,
  onOpenChange,
  appointment,
  onEdit,
}: AppointmentDetailsDialogProps) {
  const user = useAuthStore((state) => state.user);
  const cancelAppointment = useCancelAppointment();
  const terms = usePatientTerms();
  const [showCancellation, setShowCancellation] = useState(false);
  const [reason, setReason] = useState('');
  const [cancelError, setCancelError] = useState<string | null>(null);

  if (!appointment) return null;

  const canEdit = !!user && canEditAppointment(user, appointment);
  // Only the professional of the appointment attends it, and only with clinical access.
  const canAttend =
    !!user &&
    user.id === appointment.professionalId &&
    canAccessClinicalNotes(user) &&
    ATTENDABLE.includes(appointment.status);
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setShowCancellation(false);
      setReason('');
      setCancelError(null);
    }
    onOpenChange(nextOpen);
  };
  const handleCancel = () => {
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      setCancelError('Ingresa un motivo de cancelación.');
      return;
    }

    setCancelError(null);
    cancelAppointment.mutate(
      {
        id: appointment.id,
        patientId: appointment.patientId,
        reason: trimmedReason,
      },
      {
        onSuccess: () => handleOpenChange(false),
        onError: (error: Error) => setCancelError(getAppointmentErrorMessage(error)),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg" role="dialog" aria-modal="true">
        <DialogHeader>
          <DialogTitle>{appointment.title || 'Detalle de cita'}</DialogTitle>
        </DialogHeader>

        <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">{terms.One}</dt>
            <dd className="font-medium">
              {appointment.patient
                ? `${appointment.patient.firstName} ${appointment.patient.lastName}`
                : `${terms.One} no disponible`}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Profesional</dt>
            <dd className="font-medium">
              {appointment.professional
                ? `${appointment.professional.firstName} ${appointment.professional.lastName}`
                : 'Profesional no disponible'}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Especialidad</dt>
            <dd className="font-medium">{appointment.specialty?.name ?? 'Especialidad no disponible'}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Estado</dt>
            <dd>
              <Badge className={APPOINTMENT_STATUS_COLORS[appointment.status]}>
                {APPOINTMENT_STATUS_LABELS[appointment.status]}
              </Badge>
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Inicio</dt>
            <dd className="font-medium">{formatDate(appointment.startTime, 'dd/MM/yyyy HH:mm')}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Fin</dt>
            <dd className="font-medium">{formatDate(appointment.endTime, 'dd/MM/yyyy HH:mm')}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Modalidad</dt>
            <dd className="font-medium">{appointment.isOnline ? 'Cita en línea' : 'Presencial'}</dd>
          </div>
        </dl>

        {appointment.description && (
          <div>
            <p className="text-sm text-muted-foreground">Descripción</p>
            <p className="text-sm">{appointment.description}</p>
          </div>
        )}

        {showCancellation && (
          <div className="space-y-2 rounded-md border p-3">
            <Label htmlFor="cancellationReason">Motivo de cancelación</Label>
            <Textarea
              id="cancellationReason"
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
                setCancelError(null);
              }}
              disabled={cancelAppointment.isPending}
              aria-required="true"
            />
            {cancelError && <p role="alert" className="text-sm text-destructive">{cancelError}</p>}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowCancellation(false);
                  setCancelError(null);
                }}
                disabled={cancelAppointment.isPending}
              >
                Volver
              </Button>
              <Button type="button" variant="destructive" loading={cancelAppointment.isPending} onClick={handleCancel}>
                Confirmar cancelación
              </Button>
            </div>
          </div>
        )}

        {canAttend && !showCancellation && (
          <Link
            href={`/patients/${appointment.patientId}?tab=specialties&appointmentId=${appointment.id}`}
            className={buttonVariants({ variant: 'default' })}
          >
            {appointment.status === AppointmentStatus.IN_PROGRESS
              ? 'Continuar atención'
              : 'Iniciar atención'}
          </Link>
        )}

        {canEdit && !showCancellation && (
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onEdit(appointment)}>
              Editar cita
            </Button>
            <Button type="button" variant="destructive" onClick={() => setShowCancellation(true)}>
              Cancelar cita
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
