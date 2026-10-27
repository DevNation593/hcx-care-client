import { describe, expect, it } from 'vitest';
import { ROLE_LABELS } from '@/lib/constants';
import { UserRole, type Appointment, type User } from './index';
import {
  canAccessClinicalNotes,
  canAddPatientTeamMember,
  canDeletePatient,
  canEditAppointment,
  canManageSubscription,
  canManageUsers,
  canRemovePatientTeamMember,
  hasActiveProfessionalProfile,
  isCashierRole,
  isMasterRole,
  isPlatformAdmin,
  isProfessionalRole,
} from './guards';

const userWith = (role: UserRole) => ({ id: 'user-1', role }) as User;
const ALL_ROLES = Object.values(UserRole);

describe('role families', () => {
  it('has no legacy roles', () => {
    expect(ALL_ROLES.sort()).toEqual(
      ['ADMIN', 'ASISTENTE', 'CAJERO', 'MASTER', 'PACIENTE', 'PROFESIONAL', 'SOPORTE'].sort(),
    );
  });

  it('classifies only CAJERO as the cashier', () => {
    expect(ALL_ROLES.filter(isCashierRole)).toEqual([UserRole.CAJERO]);
  });

  it('classifies only MASTER as the account holder', () => {
    expect(ALL_ROLES.filter(isMasterRole)).toEqual([UserRole.MASTER]);
  });

  it('classifies only PROFESIONAL as professional', () => {
    expect(ALL_ROLES.filter(isProfessionalRole)).toEqual([UserRole.PROFESIONAL]);
  });

  it('recognises only ADMIN as platform admin', () => {
    expect(ALL_ROLES.filter((role) => isPlatformAdmin({ role }))).toEqual([UserRole.ADMIN]);
  });

  it('labels every role', () => {
    expect(ROLE_LABELS).toEqual({
      MASTER: 'Titular de la cuenta',
      ADMIN: 'Administrador',
      PROFESIONAL: 'Profesional',
      ASISTENTE: 'Asistente',
      CAJERO: 'Cajero',
      SOPORTE: 'Soporte',
      PACIENTE: 'Paciente',
    });
  });

  it('recognizes an active profile regardless of role', () => {
    const master = { role: UserRole.MASTER, professionalProfile: { isActive: true } } as User;
    expect(hasActiveProfessionalProfile(master)).toBe(true);
    expect(
      hasActiveProfessionalProfile({
        ...master,
        professionalProfile: { ...master.professionalProfile!, isActive: false },
      }),
    ).toBe(false);
    expect(hasActiveProfessionalProfile({ ...master, professionalProfile: undefined })).toBe(false);
  });
});

describe('permission matrix', () => {
  const allowed = (guard: (user: User) => boolean) =>
    ALL_ROLES.filter((role) => guard(userWith(role))).sort();

  it.each([
    ['canManageUsers', canManageUsers],
    ['canManageSubscription', canManageSubscription],
    ['canDeletePatient', canDeletePatient],
  ] as const)('%s is limited to the account holder', (_name, guard) => {
    expect(allowed(guard)).toEqual([UserRole.MASTER]);
  });

  it('gives SOPORTE no management permission', () => {
    const support = userWith(UserRole.SOPORTE);
    expect(canManageUsers(support)).toBe(false);
    expect(canManageSubscription(support)).toBe(false);
    expect(canDeletePatient(support)).toBe(false);
  });

  it('opens clinical notes only to an account holder or professional with an active profile', () => {
    const withProfile = (role: UserRole, isActive: boolean) =>
      ({ id: 'user-1', role, professionalProfile: { isActive } }) as User;

    expect(allowed(canAccessClinicalNotes)).toEqual([]);
    expect(
      ALL_ROLES.filter((role) => canAccessClinicalNotes(withProfile(role, true))).sort(),
    ).toEqual([UserRole.MASTER, UserRole.PROFESIONAL].sort());
    expect(ALL_ROLES.filter((role) => canAccessClinicalNotes(withProfile(role, false)))).toEqual(
      [],
    );
  });

  it('lets the clinic team add patient team members', () => {
    expect(allowed(canAddPatientTeamMember)).toEqual(
      [UserRole.MASTER, UserRole.ASISTENTE, UserRole.PROFESIONAL].sort(),
    );
  });

  it('lets only the account holder and assistants remove patient team members', () => {
    expect(allowed(canRemovePatientTeamMember)).toEqual(
      [UserRole.MASTER, UserRole.ASISTENTE].sort(),
    );
  });

  it('lets a professional edit only their own appointments', () => {
    const own = { professionalId: 'user-1' } as Appointment;
    const other = { professionalId: 'user-2' } as Appointment;
    expect(canEditAppointment(userWith(UserRole.PROFESIONAL), own)).toBe(true);
    expect(canEditAppointment(userWith(UserRole.PROFESIONAL), other)).toBe(false);
    expect(canEditAppointment(userWith(UserRole.MASTER), other)).toBe(true);
    expect(canEditAppointment(userWith(UserRole.ASISTENTE), other)).toBe(true);
  });

  // ADMIN is the platform role: inside a clinic it unlocks nothing.
  it('grants nothing to ADMIN', () => {
    const admin = userWith(UserRole.ADMIN);
    const guards = [
      canManageUsers,
      canManageSubscription,
      canDeletePatient,
      canAccessClinicalNotes,
      canAddPatientTeamMember,
      canRemovePatientTeamMember,
    ];
    expect(guards.map((guard) => guard(admin))).toEqual(guards.map(() => false));
    expect(canEditAppointment(admin, { professionalId: 'user-1' } as Appointment)).toBe(false);
  });
});
