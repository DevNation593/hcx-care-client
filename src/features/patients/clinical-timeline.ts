import type { ClinicalNote, SpecialtyRecord } from '@/types';
import type { Encounter } from '@/types/clinical';
import type { TreatmentSessionSummary } from '@/types/treatments';

export type TimelineKind = 'encounter' | 'record' | 'note' | 'procedure';

export type TimelineItem =
  | { kind: 'encounter'; id: string; date: string; encounter: Encounter }
  | { kind: 'record'; id: string; date: string; record: SpecialtyRecord }
  | { kind: 'note'; id: string; date: string; note: ClinicalNote }
  | { kind: 'procedure'; id: string; date: string; session: TreatmentSessionSummary };

export const TIMELINE_KIND_LABELS: Record<TimelineKind, string> = {
  encounter: 'Atención',
  record: 'Registro clínico',
  note: 'Nota clínica',
  procedure: 'Procedimiento',
};

/** At the same instant, what was written inside an attention goes above the attention itself. */
const KIND_ORDER: Record<TimelineKind, number> = { procedure: 0, note: 1, record: 2, encounter: 3 };

/**
 * Everything clinical of one patient as a single chronology, newest first: the attentions, the
 * records of the specialties, the notes and the procedures of the treatment sessions. A source
 * that is off (a disabled section, a failed read) is just left out.
 */
export function buildTimeline(sources: {
  encounters?: Encounter[];
  records?: SpecialtyRecord[];
  notes?: ClinicalNote[];
  /** Sessions whose procedure started; the others have nothing clinical to read yet. */
  procedures?: TreatmentSessionSummary[];
}): TimelineItem[] {
  const items: TimelineItem[] = [
    ...(sources.encounters ?? []).map((encounter) => ({
      kind: 'encounter' as const,
      id: encounter.id,
      date: encounter.startedAt,
      encounter,
    })),
    ...(sources.records ?? []).map((record) => ({
      kind: 'record' as const,
      id: record.id,
      date: record.recordDate,
      record,
    })),
    ...(sources.notes ?? []).map((note) => ({
      kind: 'note' as const,
      id: note.id,
      date: note.sessionDate ?? note.createdAt,
      note,
    })),
    ...(sources.procedures ?? [])
      .filter((session) => session.startedAt !== null)
      .map((session) => ({
        kind: 'procedure' as const,
        id: session.id,
        date: session.completedAt ?? session.startedAt!,
        session,
      })),
  ];

  return items.sort(
    (a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime() || KIND_ORDER[a.kind] - KIND_ORDER[b.kind],
  );
}
