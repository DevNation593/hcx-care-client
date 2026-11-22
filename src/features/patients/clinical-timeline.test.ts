import { describe, expect, it } from 'vitest';
import type { ClinicalNote, SpecialtyRecord } from '@/types';
import type { Encounter } from '@/types/clinical';
import type { TreatmentSessionSummary } from '@/types/treatments';
import { buildTimeline } from './clinical-timeline';

const encounter = (id: string, startedAt: string) => ({ id, startedAt }) as Encounter;
const record = (id: string, recordDate: string) => ({ id, recordDate }) as SpecialtyRecord;
const note = (id: string, createdAt: string, sessionDate?: string) =>
  ({ id, createdAt, sessionDate }) as ClinicalNote;
const procedure = (id: string, startedAt: string | null, completedAt: string | null = null) =>
  ({ id, startedAt, completedAt }) as TreatmentSessionSummary;

describe('buildTimeline', () => {
  it('mixes every source in one chronology, newest first', () => {
    const items = buildTimeline({
      encounters: [encounter('e1', '2026-10-01T15:00:00.000Z'), encounter('e2', '2026-10-10T15:00:00.000Z')],
      records: [record('r1', '2026-10-05T15:00:00.000Z')],
      notes: [note('n1', '2026-10-12T15:00:00.000Z')],
      procedures: [procedure('s1', '2026-10-08T15:00:00.000Z')],
    });

    expect(items.map((item) => `${item.kind}:${item.id}`)).toEqual([
      'note:n1',
      'encounter:e2',
      'procedure:s1',
      'record:r1',
      'encounter:e1',
    ]);
  });

  it('dates a note by its session, and a procedure by when it was completed', () => {
    const items = buildTimeline({
      notes: [note('n1', '2026-10-20T10:00:00.000Z', '2026-10-02T10:00:00.000Z')],
      procedures: [procedure('s1', '2026-10-03T10:00:00.000Z', '2026-10-15T10:00:00.000Z')],
    });

    expect(items.map((item) => [item.id, item.date])).toEqual([
      ['s1', '2026-10-15T10:00:00.000Z'],
      ['n1', '2026-10-02T10:00:00.000Z'],
    ]);
  });

  it('leaves out the sessions whose procedure never started', () => {
    const items = buildTimeline({
      procedures: [procedure('s1', null), procedure('s2', '2026-10-03T10:00:00.000Z')],
    });

    expect(items.map((item) => item.id)).toEqual(['s2']);
  });

  it('puts what was written in an attention above the attention at the same instant', () => {
    const at = '2026-10-01T15:00:00.000Z';
    const items = buildTimeline({
      encounters: [encounter('e1', at)],
      records: [record('r1', at)],
      notes: [note('n1', at)],
      procedures: [procedure('s1', at)],
    });

    expect(items.map((item) => item.kind)).toEqual(['procedure', 'note', 'record', 'encounter']);
  });

  it('is empty, and does not fail, when every source is off or still loading', () => {
    expect(buildTimeline({})).toEqual([]);
    expect(buildTimeline({ encounters: undefined, records: undefined })).toEqual([]);
  });
});
