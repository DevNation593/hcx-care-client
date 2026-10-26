/**
 * Formats a date-only API value (`YYYY-MM-DDT00:00:00.000Z`) as `dd/MM/yyyy`.
 * It reads the UTC parts, so the day never shifts with the browser time zone.
 */
export function formatCalendarDate(value: string): string {
  const date = new Date(value);
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${date.getUTCFullYear()}`;
}
