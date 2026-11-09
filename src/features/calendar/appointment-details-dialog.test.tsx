import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppointmentStatus, UserRole, type Appointment, type User } from '@/types';
import { useAuthStore } from '@/store/authStore';
import { canEditAppointment } from '@/types/guards';
import { getAppointmentErrorMessage } from './appointment-errors';
import { AppointmentDetailsDialog } from './appointment-details-dialog';

// Rendered without a QueryClient: name people as in a clinical practice.
vi.mock('@/hooks/usePatientTerms', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/usePatientTerms')>();
  return { ...actual, usePatientTerms: () => actual.patientTerms(false) };
});

const mocks = vi.hoisted(() => ({ cancel: vi.fn() }));
vi.mock('@/hooks/useAppointments', () => ({
  useCancelAppointment: () => ({ mutate: mocks.cancel, isPending: false }),
}));

function appointment(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: 'appointment-1',
    tenantId: 'tenant-1',
    patientId: 'patient-1',
    patient: { id: 'patient-1', firstName: 'Ana', lastName: 'Vega', email: null, phone: null },
    professionalId: 'professional-1',
    professional: { id: 'professional-1', firstName: 'Noa', lastName: 'Nutrición', email: 'noa@example.com' },
    specialtyId: 'nutrition',
    specialty: { id: 'nutrition', code: 'NUTRITION', name: 'Nutrición' },
    psychologistId: 'legacy-psychologist',
    psychologist: { id: 'legacy-psychologist', firstName: 'Nombre', lastName: 'Heredado', email: 'legacy@example.com' },
    title: 'Consulta',
    description: 'Seguimiento',
    startTime: '2026-10-01T15:00:00.000Z',
    endTime: '2026-10-01T16:00:00.000Z',
    duration: 60,
    status: AppointmentStatus.CONFIRMED,
    location: null,
    isOnline: true,
    meetingUrl: 'https://example.com/meeting',
    notes: undefined,
    cancelledAt: null,
    cancelledBy: null,
    cancellationReason: null,
    reminderSent24h: false,
    reminderSent2h: false,
    lastReminderSentAt: null,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

function actor(role: UserRole, id = 'actor-1'): User {
  return { id, role, tenantId: 'tenant-1' } as User;
}

function renderDetails({
  user = actor(UserRole.MASTER),
  currentAppointment = appointment(),
  onOpenChange = vi.fn(),
  onEdit = vi.fn(),
}: {
  user?: User;
  currentAppointment?: Appointment;
  onOpenChange?: ReturnType<typeof vi.fn>;
  onEdit?: ReturnType<typeof vi.fn>;
} = {}) {
  useAuthStore.setState({ user });
  return {
    onOpenChange,
    onEdit,
    ...render(
      <AppointmentDetailsDialog
        open
        onOpenChange={onOpenChange}
        appointment={currentAppointment}
        onEdit={onEdit}
      />,
    ),
  };
}

beforeEach(() => vi.clearAllMocks());

describe('appointment permissions', () => {
  it.each([
    [UserRole.MASTER, 'anyone', true],
    [UserRole.ASISTENTE, 'anyone', true],
    [UserRole.PROFESIONAL, 'professional-1', true],
    [UserRole.PROFESIONAL, 'professional-2', false],
    [UserRole.PACIENTE, 'professional-1', false],
    [UserRole.SOPORTE, 'professional-1', false],
  ] as const)('allows %s actor %s: %s', (role, id, expected) => {
    expect(canEditAppointment(actor(role, id), appointment())).toBe(expected);
  });
});

describe('AppointmentDetailsDialog', () => {
  it('renders canonical nullable projections, status, and modality without reading the legacy psychologist', () => {
    renderDetails();

    expect(screen.getByText('Noa Nutrición')).toBeInTheDocument();
    expect(screen.queryByText('Nombre Heredado')).not.toBeInTheDocument();
    expect(screen.getByText('Nutrición')).toBeInTheDocument();
    expect(screen.getByText('Confirmada')).toBeInTheDocument();
    expect(screen.getByText('Cita en línea')).toBeInTheDocument();
  });

  it('renders safe copy when canonical professional and specialty projections are null', () => {
    renderDetails({ currentAppointment: appointment({ professional: null, specialty: null }) });

    expect(screen.getByText('Profesional no disponible')).toBeInTheDocument();
    expect(screen.getByText('Especialidad no disponible')).toBeInTheDocument();
    expect(screen.queryByText('Nombre Heredado')).not.toBeInTheDocument();
  });

  it('shows edit and cancel only when the actor can edit the canonical appointment', () => {
    const permitted = renderDetails({ user: actor(UserRole.PROFESIONAL, 'professional-1') });
    expect(screen.getByRole('button', { name: 'Editar cita' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar cita' })).toBeInTheDocument();
    permitted.unmount();

    renderDetails({ user: actor(UserRole.PROFESIONAL, 'professional-2') });
    expect(screen.queryByRole('button', { name: 'Editar cita' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancelar cita' })).not.toBeInTheDocument();
  });

  describe('attending the appointment', () => {
    const professional = (overrides: Partial<User> = {}): User =>
      ({
        id: 'professional-1',
        role: UserRole.PROFESIONAL,
        tenantId: 'tenant-1',
        professionalProfile: { isActive: true },
        ...overrides,
      }) as User;
    const attentionLink = () => screen.queryByRole('link', { name: /atención/ });

    it('takes the professional of the appointment to the patient record to start it', () => {
      renderDetails({ user: professional() });

      expect(screen.getByRole('link', { name: 'Iniciar atención' })).toHaveAttribute(
        'href',
        '/patients/patient-1?tab=specialties&appointmentId=appointment-1',
      );
    });

    it('offers to continue an appointment that is already being attended', () => {
      renderDetails({
        user: professional(),
        currentAppointment: appointment({ status: AppointmentStatus.IN_PROGRESS }),
      });

      expect(screen.getByRole('link', { name: 'Continuar atención' })).toBeInTheDocument();
    });

    it.each([
      ['another professional', professional({ id: 'professional-2' }), appointment()],
      ['a professional without an active profile', professional({ professionalProfile: { isActive: false } as never }), appointment()],
      ['the account holder without a clinical profile', actor(UserRole.MASTER, 'professional-1'), appointment()],
      ['a completed appointment', professional(), appointment({ status: AppointmentStatus.COMPLETED })],
      ['a cancelled appointment', professional(), appointment({ status: AppointmentStatus.CANCELLED })],
    ])('is not offered to %s', (_label, user, currentAppointment) => {
      renderDetails({ user, currentAppointment });

      expect(attentionLink()).not.toBeInTheDocument();
    });
  });

  it('emits the canonical appointment for editing', () => {
    const currentAppointment = appointment();
    const { onEdit } = renderDetails({ currentAppointment });
    fireEvent.click(screen.getByRole('button', { name: 'Editar cita' }));
    expect(onEdit).toHaveBeenCalledWith(currentAppointment);
  });

  it('requires a non-empty cancellation reason and captures id and patient at invocation', () => {
    renderDetails();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar cita' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar cancelación' }));
    expect(mocks.cancel).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Ingresa un motivo de cancelación.');

    fireEvent.change(screen.getByLabelText('Motivo de cancelación'), { target: { value: 'Solicitud del paciente' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar cancelación' }));
    expect(mocks.cancel).toHaveBeenCalledWith(
      { id: 'appointment-1', patientId: 'patient-1', reason: 'Solicitud del paciente' },
      expect.any(Object),
    );
  });

  it('closes only after cancellation succeeds', () => {
    mocks.cancel.mockImplementationOnce((_variables, options) => options.onError({
      code: 'PROFESSIONAL_NOT_AUTHORIZED', message: 'raw server text',
    }));
    const failed = renderDetails();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar cita' }));
    fireEvent.change(screen.getByLabelText('Motivo de cancelación'), { target: { value: 'Cambio de agenda' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar cancelación' }));
    expect(failed.onOpenChange).not.toHaveBeenCalledWith(false);
    expect(screen.getByLabelText('Motivo de cancelación')).toHaveValue('Cambio de agenda');
    expect(screen.getByRole('alert')).toHaveTextContent('El profesional ya no está disponible para atención.');
    failed.unmount();

    mocks.cancel.mockImplementationOnce((_variables, options) => options.onSuccess());
    const succeeded = renderDetails();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar cita' }));
    fireEvent.change(screen.getByLabelText('Motivo de cancelación'), { target: { value: 'Cambio de agenda' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar cancelación' }));
    expect(succeeded.onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe('getAppointmentErrorMessage', () => {
  it.each([
    ['APPOINTMENT_CONFLICT', 'El profesional ya tiene una cita en ese horario.'],
    ['PROFESSIONAL_SPECIALTY_MISMATCH', 'El profesional no pertenece a la especialidad seleccionada.'],
    ['SPECIALTY_NOT_ENABLED', 'La especialidad ya no está habilitada en el consultorio.'],
    ['PROFESSIONAL_NOT_AUTHORIZED', 'El profesional ya no está disponible para atención.'],
  ])('maps %s to stable safe copy', (code, message) => {
    expect(getAppointmentErrorMessage({ code, message: 'unsafe backend text' })).toBe(message);
  });

  it('does not expose unknown raw server messages', () => {
    expect(getAppointmentErrorMessage({ code: 'UNKNOWN', message: 'SQL table appointments' }))
      .toBe('No se pudo completar la operación. Inténtalo nuevamente.');
  });
});
