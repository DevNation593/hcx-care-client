import { describe, expect, it } from 'vitest';
import type { TreatmentSessionDetail } from '@/types/treatments';
import { encounterBackHref, unfinishedSiblings } from './encounter-navigation';

describe('encounterBackHref', () => {
  it('goes to the specialties tab when the section is enabled', () => {
    expect(encounterBackHref('p1', true)).toBe('/patients/p1?tab=specialties');
  });

  it('goes to the treatments tab otherwise', () => {
    expect(encounterBackHref('p1', false)).toBe('/patients/p1?tab=treatments');
  });
});

describe('unfinishedSiblings', () => {
  const sessions = (list: [string, string][]) =>
    ({
      encounterSessions: list.map(([id, status]) => ({ id, status, treatmentName: id })),
    }) as unknown as TreatmentSessionDetail;

  it('keeps only the sessions with work pending, in order', () => {
    const result = unfinishedSiblings(
      sessions([
        ['a', 'CLINICAL_COMPLETE'],
        ['b', 'CONSENTED'],
        ['c', 'CANCELLED'],
        ['d', 'IN_PROGRESS'],
      ]),
    );

    expect(result.map((item) => item.id)).toEqual(['b', 'd']);
  });

  it('is empty when the payload has no sessions', () => {
    expect(unfinishedSiblings({} as TreatmentSessionDetail)).toEqual([]);
  });
});
