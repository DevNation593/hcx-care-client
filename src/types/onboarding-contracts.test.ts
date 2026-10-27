import { describe, expectTypeOf, it } from 'vitest';
import type {
  CreateTenantUserInput,
  SpecialtyCatalogItem,
  SpecialtyPricingSummary,
  SpecialtySelectionResult,
  TenantSpecialty,
  TenantTeamProfessionalProfileInput,
  TenantModule,
  TenantModuleSelection,
  UpdateTenantUserInput,
} from './index';
import type { TenantTeamMemberFormData } from '@/lib/validations/schemas';
import { tenantSpecialtiesApi, usersApi } from '@/lib/api/endpoints';
import { UserRole } from './index';

describe('specialty onboarding wire contracts', () => {
  it('keeps the public catalog and selection modules distinct from database rows', () => {
    expectTypeOf<SpecialtyCatalogItem>().toEqualTypeOf<{
      id: string;
      code: string;
      name: string;
      description: string | null;
      modules: { id: string; moduleKey: string }[];
    }>();
    expectTypeOf<TenantModuleSelection>().toEqualTypeOf<{ moduleKey: string; enabled: boolean }>();
    expectTypeOf<TenantModule>().toHaveProperty('tenantId');
    expectTypeOf<SpecialtySelectionResult['modules'][number]>().toEqualTypeOf<TenantModuleSelection>();
    expectTypeOf<TenantSpecialty['description']>().toEqualTypeOf<string | null>();
    expectTypeOf<Awaited<ReturnType<typeof tenantSpecialtiesApi.list>>>().toEqualTypeOf<TenantSpecialty[]>();
  });

  it('keeps the complete numeric pricing summary and the team member form contract', () => {
    expectTypeOf<SpecialtyPricingSummary>().toEqualTypeOf<{
      includedSpecialties: number;
      selectedSpecialties: number;
      billableSpecialties: number;
      specialtyUnitPrice: number;
      basePlanPrice: number;
      featureAddonsPrice: number;
      specialtyAddonsPrice: number;
      totalMonthly: number;
      currency: string;
    }>();
    expectTypeOf<TenantTeamMemberFormData>().toExtend<CreateTenantUserInput>();
  });

  it('keeps team user transports narrow and role creation canonical', () => {
    expectTypeOf<Pick<TenantTeamProfessionalProfileInput, 'isActive'>>().toEqualTypeOf<{ isActive: boolean }>();
    expectTypeOf<Omit<TenantTeamProfessionalProfileInput, 'isActive'>>().not.toExtend<TenantTeamProfessionalProfileInput>();
    expectTypeOf<CreateTenantUserInput>().toEqualTypeOf<{
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      phone?: string;
      role: UserRole.PROFESIONAL | UserRole.ASISTENTE | UserRole.CAJERO;
      professionalProfile?: {
        specialtyId: string;
        professionalTitle?: string;
        licenseNumber?: string;
        bio?: string;
        isActive: boolean;
      };
    }>();
    expectTypeOf<UpdateTenantUserInput>().toEqualTypeOf<{
      email?: string;
      firstName?: string;
      lastName?: string;
      phone?: string;
      role?: UserRole.MASTER | UserRole.PROFESIONAL | UserRole.ASISTENTE | UserRole.CAJERO;
      isActive?: boolean;
      professionalProfile?: {
        specialtyId: string;
        professionalTitle?: string;
        licenseNumber?: string;
        bio?: string;
        isActive: boolean;
      } | null;
    }>();

    expectTypeOf<CreateTenantUserInput>().not.toHaveProperty('tenantId');
    expectTypeOf<CreateTenantUserInput>().not.toHaveProperty('managedByProvider');
    expectTypeOf<CreateTenantUserInput>().not.toHaveProperty('emailVerified');
    expectTypeOf<CreateTenantUserInput>().not.toHaveProperty('activatedAt');
    expectTypeOf<CreateTenantUserInput>().not.toHaveProperty('invitedAt');
    expectTypeOf<CreateTenantUserInput>().not.toHaveProperty('invitedBy');
    expectTypeOf<UpdateTenantUserInput>().not.toHaveProperty('password');
    expectTypeOf<UpdateTenantUserInput>().not.toHaveProperty('tenantId');
    expectTypeOf<UpdateTenantUserInput>().not.toHaveProperty('managedByProvider');
    expectTypeOf<UpdateTenantUserInput>().not.toHaveProperty('emailVerified');
    expectTypeOf<UpdateTenantUserInput>().not.toHaveProperty('activatedAt');
    expectTypeOf<UpdateTenantUserInput>().not.toHaveProperty('invitedAt');
    expectTypeOf<UpdateTenantUserInput>().not.toHaveProperty('invitedBy');
    expectTypeOf<Parameters<typeof usersApi.create>[0]>().toEqualTypeOf<CreateTenantUserInput>();
    expectTypeOf<Parameters<typeof usersApi.update>[1]>().toEqualTypeOf<UpdateTenantUserInput>();
  });
});
