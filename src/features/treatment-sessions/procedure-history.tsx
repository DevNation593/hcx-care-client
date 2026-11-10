'use client';

import Link from 'next/link';
import { ChevronRight, Syringe } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { usePatientTreatmentSessions } from '@/hooks/useTreatmentSessions';
import { formatDate } from '@/lib/utils';
import { SESSION_STATUS_LABELS } from '@/types/treatments';
import { SESSION_STATUS_VARIANTS } from './patient-treatments-tab';

/**
 * The procedures of the patient's treatment sessions in the clinical history: every session
 * whose procedure started, newest first, with its notes. A session in progress shows the draft.
 */
export function ProcedureHistory({ patientId }: { patientId: string }) {
  const { data, isPending, isError } = usePatientTreatmentSessions(patientId);
  const procedures = (data ?? []).filter((session) => session.startedAt !== null);

  return (
    <section className="space-y-3" aria-labelledby="procedure-history-title">
      <h3 id="procedure-history-title" className="text-lg font-semibold">
        Procedimientos
      </h3>

      {isPending ? (
        <Skeleton className="h-24 w-full" />
      ) : isError ? (
        <p className="text-sm text-destructive">No se pudieron cargar los procedimientos.</p>
      ) : procedures.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Syringe className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">No hay procedimientos registrados</p>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {procedures.map((session) => (
            <li key={session.id}>
              <Card>
                <CardContent className="space-y-2 pt-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-medium">{session.treatment.name}</h4>
                    <Badge variant={SESSION_STATUS_VARIANTS[session.status]}>
                      {SESSION_STATUS_LABELS[session.status]}
                    </Badge>
                  </div>
                  {session.procedureNotes ? (
                    <p className="whitespace-pre-wrap text-sm">{session.procedureNotes}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">Sin notas del procedimiento</p>
                  )}
                  {session.status === 'IN_PROGRESS' && (
                    <p className="text-xs text-muted-foreground">
                      Notas en borrador hasta cerrar la atención.
                    </p>
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>
                      {[
                        formatDate(session.completedAt ?? session.startedAt!, 'dd/MM/yyyy HH:mm'),
                        `${session.professional.firstName} ${session.professional.lastName}`,
                      ].join(' · ')}
                    </span>
                    <Link
                      href={`/treatment-sessions/${session.id}`}
                      className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                    >
                      Ver atención
                      <ChevronRight className="h-3 w-3" aria-hidden />
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
