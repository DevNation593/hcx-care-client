'use client';

import { useMemo, useState } from 'react';
import { History, Lock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { FeatureLockedNotice, isFeatureLockedError } from '@/features/subscription/feature-locked-notice';
import { ProcedureItem } from '@/features/treatment-sessions/procedure-history';
import { usePatientClinicalNotes } from '@/hooks/useClinicalNotes';
import { usePatientEncounters } from '@/hooks/useEncounters';
import { usePatientTerms } from '@/hooks/usePatientTerms';
import { useSections } from '@/hooks/useSections';
import { usePatientSpecialtyRecords } from '@/hooks/useSpecialtyRecords';
import { usePatientTreatmentSessions } from '@/hooks/useTreatmentSessions';
import { formatDate } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import type { ClinicalNote } from '@/types';
import type { Encounter } from '@/types/clinical';
import { canAccessClinicalNotes } from '@/types/guards';
import { EncounterSummary, describeEncounter } from './encounter-panel';
import { RecordCard, useRecordDefinitions } from './record-card';
import {
  buildTimeline,
  TIMELINE_KIND_LABELS,
  type TimelineItem,
  type TimelineKind,
} from './clinical-timeline';

function NoteItem({ note, encounter }: { note: ClinicalNote; encounter?: Encounter }) {
  return (
    <Card>
      <CardContent className="space-y-2 pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="font-medium">{note.diagnosis || 'Nota clínica'}</h4>
          {(note.version ?? 1) > 1 && <Badge variant="outline">Corregida</Badge>}
        </div>
        <p className="whitespace-pre-wrap text-sm">{note.content}</p>
        <p className="text-xs text-muted-foreground">
          {[
            note.psychologist && `${note.psychologist.firstName} ${note.psychologist.lastName}`,
            formatDate(note.sessionDate ?? note.createdAt, 'dd/MM/yyyy HH:mm'),
            encounter && `Atención: ${describeEncounter(encounter)}`,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </CardContent>
    </Card>
  );
}

/**
 * The clinical history of the patient: a read-only chronology of everything clinical, from the
 * attentions to the records of each specialty, the notes and the procedures of the treatments.
 * It creates, corrects and removes nothing: that work is done inside the attention in course, in
 * "Registros clínicos" (records, notes) and in "Tratamientos". Each source is read only when its
 * section is on, so a disabled section shows no content here either.
 */
export function ClinicalHistoryTab({
  patientId,
  showProcedures = false,
  onOpenRecords,
}: {
  patientId: string;
  /** The procedures of the treatment sessions, when the clinic uses them. */
  showProcedures?: boolean;
  /** Opens the tab where attentions, records and notes are written; absent when it is not offered. */
  onOpenRecords?: () => void;
}) {
  const terms = usePatientTerms();
  const user = useAuthStore((state) => state.user);
  const { isEnabled } = useSections();
  const allowed = !!user && canAccessClinicalNotes(user);
  const notesOn = allowed && isEnabled('core.clinical.notes');
  // Attentions and records belong to the specialties section.
  const specialtiesOn = allowed && isEnabled('core.clinical.specialties');
  const proceduresOn = allowed && showProcedures;

  const notes = usePatientClinicalNotes(patientId, notesOn);
  const encounters = usePatientEncounters(patientId, specialtiesOn);
  const records = usePatientSpecialtyRecords(patientId, specialtiesOn);
  const procedures = usePatientTreatmentSessions(patientId, proceduresOn);
  const { definitionOf, nameOf } = useRecordDefinitions(specialtiesOn);
  const [kindFilter, setKindFilter] = useState<TimelineKind | ''>('');

  const items = useMemo(
    () =>
      buildTimeline({
        encounters: specialtiesOn ? encounters.data : undefined,
        records: specialtiesOn ? records.data : undefined,
        notes: notesOn ? notes.data : undefined,
        procedures: proceduresOn ? procedures.data : undefined,
      }),
    [specialtiesOn, notesOn, proceduresOn, encounters.data, records.data, notes.data, procedures.data],
  );
  const encounterById = useMemo(
    () => new Map((encounters.data ?? []).map((encounter) => [encounter.id, encounter])),
    [encounters.data],
  );

  if (!allowed) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Lock className="mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-lg font-medium">Acceso restringido</p>
          <p className="text-sm text-muted-foreground">
            Solo las cuentas con un perfil profesional activo pueden ver la historia clínica.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (notesOn && isFeatureLockedError(notes.error)) {
    return <FeatureLockedNotice featureName="El módulo de notas clínicas" />;
  }

  const sources = [
    { on: notesOn, label: 'las notas', query: notes },
    { on: specialtiesOn, label: 'las atenciones', query: encounters },
    { on: specialtiesOn, label: 'los registros', query: records },
    { on: proceduresOn, label: 'los procedimientos', query: procedures },
  ].filter((source) => source.on);
  const failed = sources.filter((source) => source.query.isError);
  const loading = sources.some((source) => source.query.isPending);

  const kindsPresent = [...new Set(items.map((item) => item.kind))];
  const visible = kindFilter ? items.filter((item) => item.kind === kindFilter) : items;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">Historia clínica</h3>
          <p className="text-sm text-muted-foreground">
            Cronología de solo lectura de las atenciones, registros, notas y procedimientos de este{' '}
            {terms.one}. Se escribe desde la atención abierta, en «Registros clínicos».
          </p>
        </div>
        {onOpenRecords && (
          <Button variant="outline" onClick={onOpenRecords}>
            Ir a Registros clínicos
          </Button>
        )}
      </div>

      {failed.length > 0 && (
        <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-destructive">
          <span>No se pudo cargar {failed.map((source) => source.label).join(', ')}.</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => failed.forEach((source) => void source.query.refetch())}
          >
            Reintentar
          </Button>
        </div>
      )}

      {kindsPresent.length > 1 && (
        <div className="flex items-center gap-2">
          <Label htmlFor="timeline-filter" className="text-sm text-muted-foreground">
            Mostrar
          </Label>
          <select
            id="timeline-filter"
            value={kindFilter}
            onChange={(event) => setKindFilter(event.target.value as TimelineKind | '')}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Todo</option>
            {kindsPresent.map((kind) => (
              <option key={kind} value={kind}>
                {TIMELINE_KIND_LABELS[kind]}
              </option>
            ))}
          </select>
        </div>
      )}

      {loading && items.length === 0 ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        failed.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <History className="mb-4 h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground">
                Aún no hay actividad clínica registrada de este {terms.one}.
              </p>
            </CardContent>
          </Card>
        )
      ) : (
        <ol className="space-y-4" aria-label="Cronología clínica">
          {visible.map((item) => (
            <li key={`${item.kind}-${item.id}`} className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {TIMELINE_KIND_LABELS[item.kind]}
              </p>
              <TimelineEntry item={item} encounterById={encounterById} definitions={{ definitionOf, nameOf }} />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function TimelineEntry({
  item,
  encounterById,
  definitions,
}: {
  item: TimelineItem;
  encounterById: Map<string, Encounter>;
  definitions: Pick<ReturnType<typeof useRecordDefinitions>, 'definitionOf' | 'nameOf'>;
}) {
  switch (item.kind) {
    case 'encounter':
      return (
        <Card>
          <CardContent className="space-y-1 pt-4 text-sm">
            <EncounterSummary encounter={item.encounter} />
          </CardContent>
        </Card>
      );
    case 'record':
      return (
        <RecordCard
          record={item.record}
          name={definitions.nameOf(item.record)}
          definition={definitions.definitionOf(item.record)}
          from="clinical"
        />
      );
    case 'note':
      return (
        <NoteItem
          note={item.note}
          encounter={item.note.encounterId ? encounterById.get(item.note.encounterId) : undefined}
        />
      );
    case 'procedure':
      return <ProcedureItem session={item.session} from="clinical" />;
  }
}
