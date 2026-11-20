const APPOINTMENT_ERROR_MESSAGES: Record<string, string> = {
  APPOINTMENT_CONFLICT: 'El profesional ya tiene una cita en ese horario.',
  PROFESSIONAL_SPECIALTY_MISMATCH:
    'El profesional no pertenece a la especialidad seleccionada.',
  SPECIALTY_NOT_ENABLED:
    'La especialidad ya no está habilitada en el consultorio.',
  PROFESSIONAL_NOT_AUTHORIZED:
    'El profesional ya no está disponible para atención.',
  NON_WORKING_DAY: 'No se pueden programar citas en un día no laboral.',
  OUTSIDE_WORKING_HOURS: 'La cita debe estar dentro del horario laboral.',
};

const DAY_LABELS: Record<string, string> = {
  MONDAY: 'Lunes',
  TUESDAY: 'Martes',
  WEDNESDAY: 'Miércoles',
  THURSDAY: 'Jueves',
  FRIDAY: 'Viernes',
  SATURDAY: 'Sábado',
  SUNDAY: 'Domingo',
};

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function readDetails(error: object): Record<string, unknown> {
  const details = (error as { details?: unknown }).details;
  return details && typeof details === 'object' && !Array.isArray(details)
    ? (details as Record<string, unknown>)
    : {};
}

/** Builds the working-day copy only from known day codes, never from raw server text. */
function nonWorkingDayMessage(details: Record<string, unknown>): string | null {
  const day = typeof details.dayOfWeek === 'string' ? DAY_LABELS[details.dayOfWeek] : undefined;
  const workingDays = Array.isArray(details.workingDays)
    ? details.workingDays
        .map((value) => (typeof value === 'string' ? DAY_LABELS[value] : undefined))
        .filter((label): label is string => Boolean(label))
    : [];
  if (!day || !workingDays.length) return null;
  return `No se pueden programar citas el día ${day}. Días laborales: ${workingDays.join(', ')}.`;
}

function outsideWorkingHoursMessage(details: Record<string, unknown>): string | null {
  const { workingHoursStart: start, workingHoursEnd: end } = details;
  if (typeof start !== 'string' || typeof end !== 'string') return null;
  if (!TIME_PATTERN.test(start) || !TIME_PATTERN.test(end)) return null;
  return `La cita debe estar dentro del horario laboral: ${start} - ${end}.`;
}

export function getAppointmentErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && !Array.isArray(error)) {
    const code = (error as { code?: unknown }).code;
    if (code === 'NON_WORKING_DAY') {
      const message = nonWorkingDayMessage(readDetails(error));
      if (message) return message;
    }
    if (code === 'OUTSIDE_WORKING_HOURS') {
      const message = outsideWorkingHoursMessage(readDetails(error));
      if (message) return message;
    }
    if (typeof code === 'string' && APPOINTMENT_ERROR_MESSAGES[code]) {
      return APPOINTMENT_ERROR_MESSAGES[code];
    }
  }

  return 'No se pudo completar la operación. Inténtalo nuevamente.';
}
