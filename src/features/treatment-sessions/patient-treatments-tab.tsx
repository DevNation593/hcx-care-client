'use client';

import { useId, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight, Plus } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useAppointments } from '@/hooks/useAppointments';
import { useCreateTreatmentSession, usePatientTreatmentSessions } from '@/hooks/useTreatmentSessions';
import { useTreatments } from '@/hooks/useTreatments';
import { formatDate } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import { AppointmentStatus, type ApiError } from '@/types';
import {
  SESSION_STATUS_LABELS,
  type TreatmentSessionStatus,
  type TreatmentSessionSummary,
} from '@/types/treatments';

const SELECT_CLASS = 'mt-1 h-11 w-full rounded-md border border-input bg-background px-3 text-sm';
const PENDING_APPOINTMENT = [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED];

export const SESSION_STATUS_VARIANTS: Record<
  TreatmentSessionStatus,
  'default' | 'secondary' | 'destructive' | 'success' | 'warning'
> = {
  INTAKE_IN_PROGRESS: 'warning',
  READY_FOR_CONSENT: 'warning',
  CONSENTED: 'default',
  IN_PROGRESS: 'default',
  CLINICAL_COMPLETE: 'success',
  CONSENT_REFUSED: 'destructive',
  CONSENT_REVOKED: 'destructive',
  CANCELLED: 'secondary',
  NO_SHOW: 'secondary',
  BILLING_PENDING: 'warning',
  BILLED: 'success',
  BILLING_FAILED: 'destructive',
};

/** The treatment sessions of a patient, and the start of a new one. */
export function PatientTreatmentsTab({ patientId }: { patientId: string }) {
  const router = useRouter();
  const sessions = usePatientTreatmentSessions(patientId);
  const [creating, setCreating] = useState(false);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Tratamientos</CardTitle>
            <CardDescription>
              Cada atención sigue la ficha, el consentimiento, las fotos y el procedimiento del tratamiento.
            </CardDescription>
          </div>
          <Button size="lg" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" />
            Nueva atención
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {sessions.isPending ? (
          <p role="status" className="text-sm text-muted-foreground">
            Cargando atenciones…
          </p>
        ) : sessions.isError ? (
          <Alert variant="destructive" title="No se pudieron cargar las atenciones">
            <Button variant="outline" size="sm" className="mt-2" onClick={() => sessions.refetch()}>
              Reintentar
            </Button>
          </Alert>
        ) : !sessions.data?.length ? (
          <p className="text-sm text-muted-foreground">
            Este paciente aún no tiene atenciones de tratamiento.
          </p>
        ) : (
          <ul className="divide-y rounded-md border border-input">
            {sessions.data.map((session) => (
              <SessionRow key={session.id} session={session} />
            ))}
          </ul>
        )}
      </CardContent>

      {creating && (
        <NewSessionDialog
          patientId={patientId}
          onClose={() => setCreating(false)}
          onCreated={(id) => router.push(`/treatment-sessions/${id}`)}
        />
      )}
    </Card>
  );
}

function SessionRow({ session }: { session: TreatmentSessionSummary }) {
  return (
    <li>
      <Link
        href={`/treatment-sessions/${session.id}`}
        className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm hover:bg-accent"
      >
        <span className="font-medium">{session.treatment.name}</span>
        <Badge variant={SESSION_STATUS_VARIANTS[session.status]}>
          {SESSION_STATUS_LABELS[session.status]}
        </Badge>
        <span className="text-muted-foreground">
          {[
            formatDate(session.createdAt, 'dd/MM/yyyy HH:mm'),
            `${session.professional.firstName} ${session.professional.lastName}`,
          ].join(' · ')}
        </span>
        <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" aria-hidden />
      </Link>
    </li>
  );
}

function NewSessionDialog({
  patientId,
  onClose,
  onCreated,
}: {
  patientId: string;
  onClose: () => void;
  onCreated: (sessionId: string) => void;
}) {
  const userId = useAuthStore((state) => state.user?.id);
  const create = useCreateTreatmentSession(patientId);
  const { data: treatments = [] } = useTreatments({ active: true });
  const { data: appointments = [] } = useAppointments({ patientId });
  const [treatmentId, setTreatmentId] = useState('');
  const [appointmentId, setAppointmentId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const titleId = useId();

  // Own appointments of the patient that are still to be attended.
  const pending = appointments.filter(
    (appointment) =>
      appointment.professionalId === userId && PENDING_APPOINTMENT.includes(appointment.status),
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!treatmentId || create.isPending) return;
    setError(null);
    try {
      const session = await create.mutateAsync({
        treatmentId,
        ...(appointmentId ? { appointmentId } : {}),
      });
      onCreated(session.id);
    } catch (failure) {
      // An open encounter with the patient, an inactive treatment…: the API says which.
      setError((failure as ApiError | undefined)?.message || 'No se pudo iniciar la atención.');
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <DialogHeader>
            <DialogTitle id={titleId}>Nueva atención</DialogTitle>
            <DialogDescription>
              La atención usa los requisitos vigentes del tratamiento que elijas.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="new-session-treatment">
              Tratamiento<span className="text-destructive"> *</span>
            </Label>
            <select
              id="new-session-treatment"
              value={treatmentId}
              onChange={(event) => setTreatmentId(event.target.value)}
              className={SELECT_CLASS}
            >
              <option value="">Selecciona un tratamiento</option>
              {treatments.map((treatment) => (
                <option key={treatment.id} value={treatment.id}>
                  {treatment.name}
                </option>
              ))}
            </select>
            {treatments.length === 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                No hay tratamientos activos en el catálogo del consultorio.
              </p>
            )}
          </div>
          {pending.length > 0 && (
            <div>
              <Label htmlFor="new-session-appointment">Cita (opcional)</Label>
              <select
                id="new-session-appointment"
                value={appointmentId}
                onChange={(event) => setAppointmentId(event.target.value)}
                className={SELECT_CLASS}
              >
                <option value="">Sin cita</option>
                {pending.map((appointment) => (
                  <option key={appointment.id} value={appointment.id}>
                    {formatDate(appointment.startTime, 'dd/MM/yyyy HH:mm')} · {appointment.title}
                  </option>
                ))}
              </select>
            </div>
          )}
          {error && <Alert variant="destructive">{error}</Alert>}
          <DialogFooter className="gap-2">
            <Button type="button" size="lg" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" size="lg" disabled={!treatmentId} loading={create.isPending}>
              Iniciar atención
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
