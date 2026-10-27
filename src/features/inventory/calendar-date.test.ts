import { afterEach, describe, expect, it } from 'vitest';
import { formatCalendarDate } from './calendar-date';

const originalTz = process.env.TZ;
afterEach(() => {
  if (originalTz === undefined) delete process.env.TZ;
  else process.env.TZ = originalTz;
});

describe('formatCalendarDate', () => {
  it.each(['America/Guayaquil', 'UTC', 'Pacific/Auckland'])('keeps the calendar day in %s', (tz) => {
    process.env.TZ = tz;
    expect(formatCalendarDate('2026-11-15T00:00:00.000Z')).toBe('15/11/2026');
  });
});
