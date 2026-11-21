'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EncounterPanel } from '@/features/patients/encounter-panel';
import { usePatientEncounters } from '@/hooks/useEncounters';
import { useSections } from '@/hooks/useSections';
import { usePatientTreatmentSessions } from '@/hooks/useTreatmentSessions';
import { formatDate } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import {
  SESSION_STATUS_LABELS,
  type TreatmentSessionStatus,
  type TreatmentSessionSummary,
} from '@/types/treatments';
import { usePatientTerms } from '@/hooks/usePatientTerms';

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

/** The encounter panel (the one place to start an encounter) and the treatment sessions of a patient. */
export function PatientTreatmentsTab({
  patientId,
  initialAppointmentId,
}: {
  patientId: string;
  /** Arriving from the agenda to attend this appointment. */
  initialAppointmentId?: string;
}) {
  const terms = usePatientTerms();
  const sessions = usePatientTreatmentSessions(patientId);
  const { isEnabled } = useSections();
  const userId = useAuthStore((state) => state.user?.id);
  const encountersQuery = usePatientEncounters(patientId);
  const encounters = encountersQuery.data ?? [];
  // One open encounter per professional and patient.
  const openEncounter = encounters.find(
    (encounter) => encounter.status === 'OPEN' && encounter.professionalId === userId,
  );

  return (
    <div className="space-y-6">
      {/* Here the panel is the "Tratamiento": treatments only, no type or reason. */}
      {isEnabled('core.treatments.sessions') &&
        (encountersQuery.isPending ? (
          <p role="status" className="text-sm text-muted-foreground">
            Cargando la atención…
          </p>
        ) : encountersQuery.isError ? (
          // A failed read is not an empty list: starting an encounter could clash with an open one.
          <Alert variant="destructive" title="No se pudo cargar la atención">
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => encountersQuery.refetch()}
            >
              Reintentar
            </Button>
          </Alert>
        ) : (
          <EncounterPanel
            patientId={patientId}
            encounters={encounters}
            openEncounter={openEncounter}
            initialAppointmentId={initialAppointmentId}
            mode="treatments"
          />
        ))}
      <Card>
        <CardHeader>
          <CardTitle>Tratamientos</CardTitle>
          <CardDescription>
            Cada atención sigue la ficha, el consentimiento, las fotos y el procedimiento del tratamiento.
          </CardDescription>
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
              Este {terms.one} aún no tiene atenciones de tratamiento.
            </p>
          ) : (
            <ul className="divide-y rounded-md border border-input">
              {sessions.data.map((session) => (
                <SessionRow key={session.id} session={session} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
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
