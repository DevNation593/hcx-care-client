import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/store/authStore';
import { appointmentsApi, extractArray, patientTeamApi, patientsApi } from './endpoints';
import type { Appointment, AppointmentFilters, Patient, PatientTeamMember } from '@/types';
import { AppointmentStatus } from '@/types';

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() }));
vi.mock('./client', () => ({ apiClient: http }));

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ tenant: null, user: null });
  http.get.mockResolvedValue([]);
  http.post.mockResolvedValue({});
  http.put.mockResolvedValue({});
  http.patch.mockResolvedValue({});
  http.delete.mockResolvedValue(undefined);
});

describe('patient team transport', () => {
  it('uses explicit encoded tenant, patient, and professional segments', async () => {
    await patientTeamApi.list('tenant/1', 'patient?1');
    await patientTeamApi.listEligible('tenant/1', 'patient?1', 'nutrition');
    await patientTeamApi.assign('tenant/1', 'patient?1', 'professional/1');
    await patientTeamApi.remove('tenant/1', 'patient?1', 'professional/1');
    const base = '/tenants/tenant%2F1/patients/patient%3F1/team';
    expect(http.get).toHaveBeenCalledWith(base);
    expect(http.get).toHaveBeenCalledWith(`${base}/eligible`, { params: { specialtyId: 'nutrition' } });
    expect(http.put).toHaveBeenCalledWith(`${base}/professional%2F1`);
    expect(http.delete).toHaveBeenCalledWith(`${base}/professional%2F1`);
  });

  it('omits the specialty query when there is no filter', async () => {
    await patientTeamApi.listEligible('tenant-1', 'patient-1');
    expect(http.get).toHaveBeenCalledWith('/tenants/tenant-1/patients/patient-1/team/eligible');
  });

  it('rejects missing explicit team IDs and never borrows the auth tenant', () => {
    useAuthStore.setState({ tenant: { id: 'tenant-2' } as ReturnType<typeof useAuthStore.getState>['tenant'] });
    expect(() => patientTeamApi.list('', 'patient-1')).toThrow('tenant ID');
    expect(() => patientTeamApi.assign('tenant-1', 'patient-1', '')).toThrow('professional ID');
    expect(http.get).not.toHaveBeenCalled();
    expect(http.put).not.toHaveBeenCalled();
  });

  it('rejects an explicitly empty tenant instead of using the auth fallback', () => {
    useAuthStore.setState({ tenant: { id: 'tenant-2' } as ReturnType<typeof useAuthStore.getState>['tenant'] });
    expect(() => patientsApi.get('patient-1', '')).toThrow('No tenant ID');
    expect(() => appointmentsApi.get('appointment-1', '')).toThrow('No tenant ID');
    expect(http.get).not.toHaveBeenCalled();
  });

  it('uses explicit tenant for legacy clients even after the store switches', async () => {
    useAuthStore.setState({ tenant: { id: 'tenant-2' } as ReturnType<typeof useAuthStore.getState>['tenant'] });
    await patientsApi.get('patient-1', 'tenant-1');
    await appointmentsApi.get('appointment-1', 'tenant-1');
    expect(http.get).toHaveBeenCalledWith('/tenants/tenant-1/patients/patient-1');
    expect(http.get).toHaveBeenCalledWith('/tenants/tenant-1/appointments/appointment-1');
  });
});

describe('appointment response boundary', () => {
  const legacy = { id: 'appointment-1', patientId: 'patient-1', title: 'Consulta', status: 'SCHEDULED',
    psychologistId: 'pro-1', psychologist: { id: 'pro-1', firstName: 'Ana' }, specialtyId: 'nutrition' };

  it('normalizes list, get, create, update and cancel without dropping other fields', async () => {
    http.get.mockResolvedValueOnce({ data: [legacy], total: 1 }).mockResolvedValueOnce(legacy);
    http.post.mockResolvedValue(legacy);
    http.patch.mockResolvedValue(legacy);
    const input = { patientId: 'patient-1', professionalId: 'pro-1', specialtyId: 'nutrition',
      title: 'Consulta', startTime: '2026-10-01T10:00', duration: 60, isOnline: false };
    const rows = await appointmentsApi.list(undefined, 'tenant-1');
    const results = [extractArray(rows)[0], await appointmentsApi.get('appointment-1', 'tenant-1'),
      await appointmentsApi.create(input, 'tenant-1'),
      await appointmentsApi.update('appointment-1', { title: 'Consulta' }, 'tenant-1'),
      await appointmentsApi.cancel('appointment-1', 'reason', 'tenant-1')];
    for (const row of results) {
      expect(row).toMatchObject({ id: 'appointment-1', title: 'Consulta', patientId: 'patient-1',
        professionalId: 'pro-1', professional: { id: 'pro-1', firstName: 'Ana' },
        psychologistId: 'pro-1', psychologist: { id: 'pro-1', firstName: 'Ana' } });
    }
    expect(http.post).toHaveBeenCalledWith('/tenants/tenant-1/appointments', input);
  });

  it('makes canonical professional fields authoritative over stale aliases', async () => {
    http.get.mockResolvedValue({ ...legacy, professionalId: 'pro-2',
      professional: { id: 'pro-2', firstName: 'Noa' } });
    await expect(appointmentsApi.get('appointment-1', 'tenant-1')).resolves.toMatchObject({
      professionalId: 'pro-2', psychologistId: 'pro-2',
      professional: { id: 'pro-2', firstName: 'Noa' },
      psychologist: { id: 'pro-2', firstName: 'Noa' }, title: 'Consulta',
    });
  });

  it('does not relabel a stale legacy object as a different canonical professional', async () => {
    http.get.mockResolvedValue({ ...legacy, professionalId: 'pro-2' });
    await expect(appointmentsApi.get('appointment-1', 'tenant-1')).resolves.toMatchObject({
      professionalId: 'pro-2', professional: null,
      psychologistId: 'pro-2', psychologist: null,
    });
  });

  it('uses the matching legacy object when the canonical object is stale', async () => {
    http.get.mockResolvedValue({ ...legacy, professionalId: 'pro-1',
      professional: { id: 'pro-2', firstName: 'Wrong' } });
    await expect(appointmentsApi.get('appointment-1', 'tenant-1')).resolves.toMatchObject({
      professionalId: 'pro-1', professional: { id: 'pro-1', firstName: 'Ana' },
      psychologistId: 'pro-1', psychologist: { id: 'pro-1', firstName: 'Ana' },
    });
  });

  it('sends only supported appointment list filters', async () => {
    const filters = { professionalId: 'pro-1', page: 2, limit: 20 } as AppointmentFilters;
    await appointmentsApi.list(filters, 'tenant-1');
    expect(http.get).toHaveBeenCalledWith('/tenants/tenant-1/appointments', {
      params: { professionalId: 'pro-1' },
    });
  });
});

describe('response projections', () => {
  it('accepts nullable patient, team and appointment fields without full user profiles', () => {
    const patient = {
      id: 'patient-1', tenantId: 'tenant-1', firstName: 'Ana', lastName: 'Paz',
      email: null, phone: null, dateOfBirth: null, gender: null, address: null,
      emergencyContactName: null, emergencyContactPhone: null, notes: null,
      assignedPsychologistId: null, assignedPsychologist: null,
      isActive: true, createdAt: '2026-09-01', updatedAt: '2026-09-01',
    } satisfies Patient;
    const team = {
      id: 'assignment-1', patientId: 'patient-1', professionalId: 'pro-1',
      assignedAt: '2026-09-01', assignedBy: null, isActive: false,
      professional: { id: 'pro-1', firstName: 'Noa', lastName: 'Paz',
        professionalTitle: null, licenseNumber: null, specialty: null },
    } satisfies PatientTeamMember;
    const appointment = {
      id: 'appointment-1', tenantId: 'tenant-1', patientId: 'patient-1',
      patient: { id: 'patient-1', firstName: 'Ana', lastName: 'Paz', email: null, phone: null },
      professionalId: 'pro-1', professional: null, psychologistId: 'pro-1', psychologist: null,
      specialtyId: null, specialty: null, title: 'Consulta', description: null,
      startTime: '2026-10-01', endTime: '2026-10-01', duration: 60, status: AppointmentStatus.SCHEDULED,
      location: null, isOnline: false, meetingUrl: null,
      cancelledAt: null, cancelledBy: null, cancellationReason: null,
      reminderSent24h: false, reminderSent2h: false, lastReminderSentAt: null,
      createdAt: '2026-09-01', updatedAt: '2026-09-01',
    } satisfies Appointment;
    expect(patient.assignedPsychologist).toBeNull();
    expect(team.professional.specialty).toBeNull();
    expect(appointment.professional).toBeNull();
  });
});

const unsupportedPageFilter: AppointmentFilters = {
  // @ts-expect-error The API list DTO does not accept pagination.
  page: 2,
};
const unsupportedLimitFilter: AppointmentFilters = {
  // @ts-expect-error The API list DTO does not accept pagination.
  limit: 20,
};
void unsupportedPageFilter;
void unsupportedLimitFilter;
