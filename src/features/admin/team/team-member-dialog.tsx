'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { tenantTeamMemberSchema, tenantTeamMemberUpdateSchema } from '@/lib/validations/schemas';
import { ROLE_LABELS } from '@/lib/constants';
import { isMasterRole } from '@/types/guards';
import {
  UserRole,
  type AssignableTeamRole,
  type CreateTenantUserInput,
  type TenantSpecialty,
  type TenantTeamProfessionalProfileInput,
  type TenantTeamRole,
  type UpdateTenantUserInput,
  type User,
} from '@/types';

type TeamMemberDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  specialties: TenantSpecialty[];
  member?: User | null;
  tenantId: string | null;
  pending?: boolean;
  specialtiesLoading?: boolean;
  specialtiesError?: string | null;
  onRetrySpecialties?: () => void;
  onSubmit: (input: CreateTenantUserInput | UpdateTenantUserInput) => Promise<void>;
};

type FormValues = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: TenantTeamRole;
  specialtyId: string;
  professionalTitle: string;
  licenseNumber: string;
  bio: string;
  masterProvidesCare: boolean;
};

const EMPTY_FORM: FormValues = {
  email: '',
  password: '',
  firstName: '',
  lastName: '',
  phone: '',
  role: UserRole.PROFESIONAL,
  specialtyId: '',
  professionalTitle: '',
  licenseNumber: '',
  bio: '',
  masterProvidesCare: false,
};

function errorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null) {
    const response = 'response' in error ? error.response : undefined;
    if (typeof response === 'object' && response !== null && 'data' in response) {
      const data = response.data;
      if (typeof data === 'object' && data !== null && 'message' in data) {
        const message = data.message;
        if (typeof message === 'string') return message;
        if (Array.isArray(message)) return message.join(' ');
      }
    }
    if ('message' in error && typeof error.message === 'string') return error.message;
  }
  return fallback;
}

function optionalProfileField(value: string | undefined): string | undefined {
  return value?.trim() ? value.trim() : undefined;
}

function getInitialValues(member?: User | null): FormValues {
  if (!member) return { ...EMPTY_FORM };
  const profile = member.professionalProfile;
  return {
    email: member.email,
    password: '',
    firstName: member.firstName,
    lastName: member.lastName,
    phone: member.phone ?? '',
    role: member.role as TenantTeamRole,
    specialtyId: profile?.specialtyId ?? member.professionalSpecialties?.[0]?.id ?? '',
    professionalTitle: profile?.professionalTitle ?? member.professionalTitle ?? '',
    licenseNumber: profile?.licenseNumber ?? member.licenseNumber ?? '',
    bio: profile?.bio ?? '',
    masterProvidesCare: isMasterRole(member.role) && !!profile,
  };
}

function getFieldErrors(issues: { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const path = issue.path.map(String).join('.');
    if (path === 'professionalProfile' || path === 'professionalProfile.specialtyId') {
      errors.specialtyId = issue.message;
    } else if (path && !errors[path]) {
      errors[path] = issue.message;
    }
  }
  return errors;
}

export function TeamMemberDialog({
  open,
  onOpenChange,
  specialties,
  member,
  tenantId,
  pending = false,
  specialtiesLoading = false,
  specialtiesError,
  onRetrySpecialties,
  onSubmit,
}: TeamMemberDialogProps) {
  const [values, setValues] = useState<FormValues>(() => getInitialValues(member));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submitLock = useRef(false);
  const memberRef = useRef(member);
  const memberId = member?.id;
  const isEditing = !!member;
  const isSaving = pending || submitting;
  const isMaster = !!member && isMasterRole(member.role);

  useEffect(() => {
    memberRef.current = member;
  }, [member]);

  useEffect(() => {
    if (!open) return;
    setValues(getInitialValues(memberRef.current));
    setFieldErrors({});
    setServerError(null);
    setSubmitting(false);
    submitLock.current = false;
  }, [open, memberId, tenantId]);

  const enabledSpecialties = specialties.filter((specialty) => specialty.isActive);
  const currentProfile = member?.professionalProfile ?? null;
  const currentSpecialtyIsEnabled = !!currentProfile && enabledSpecialties.some(
    (specialty) => specialty.id === currentProfile.specialtyId,
  );
  const profileOptions = currentProfile && !currentSpecialtyIsEnabled
    ? [
        ...enabledSpecialties,
        {
          id: currentProfile.specialtyId,
          name: currentProfile.specialty?.name ?? 'Especialidad actual no habilitada',
          isActive: false,
        },
      ]
    : enabledSpecialties;
  const profileIsRequired = values.role === UserRole.PROFESIONAL ||
    (isMaster && values.masterProvidesCare);

  const setValue = <K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => {
      const next = { ...current };
      delete next[key];
      if (key === 'role' || key === 'masterProvidesCare') delete next.specialtyId;
      return next;
    });
    setServerError(null);
  };

  const handleRoleChange = (role: AssignableTeamRole) => {
    setValues((current) =>
      role === UserRole.ASISTENTE
        ? { ...current, role, specialtyId: '', professionalTitle: '', licenseNumber: '', bio: '' }
        : { ...current, role },
    );
    setFieldErrors({});
    setServerError(null);
  };

  const buildProfile = (isActive: boolean): TenantTeamProfessionalProfileInput => ({
    specialtyId: values.specialtyId,
    professionalTitle: optionalProfileField(values.professionalTitle),
    licenseNumber: optionalProfileField(values.licenseNumber),
    bio: optionalProfileField(values.bio),
    isActive,
  });

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving || submitLock.current) return;
    setServerError(null);

    const candidateProfile = profileIsRequired
      ? buildProfile(!isEditing || !currentProfile ? true : currentProfile.isActive)
      : undefined;
    const candidate = {
      email: values.email,
      firstName: values.firstName,
      lastName: values.lastName,
      phone: values.phone,
      role: values.role,
      ...(candidateProfile ? { professionalProfile: candidateProfile } : {}),
    };
    let payload: CreateTenantUserInput | UpdateTenantUserInput;
    if (isEditing) {
      const validation = tenantTeamMemberUpdateSchema.safeParse(candidate);
      if (!validation.success) {
        setFieldErrors(getFieldErrors(validation.error.issues));
        return;
      }
      const parsed = validation.data;
      const updatedProfile = parsed.professionalProfile
        ? {
            specialtyId: parsed.professionalProfile.specialtyId,
            professionalTitle: parsed.professionalProfile.professionalTitle,
            licenseNumber: parsed.professionalProfile.licenseNumber,
            bio: parsed.professionalProfile.bio,
            isActive: parsed.professionalProfile.isActive ?? currentProfile?.isActive ?? true,
          }
        : currentProfile
          ? null
          : undefined;
      payload = {
        email: parsed.email,
        firstName: parsed.firstName,
        lastName: parsed.lastName,
        role: parsed.role,
        ...(member?.phone !== undefined || parsed.phone ? { phone: parsed.phone } : {}),
        ...(updatedProfile !== undefined ? { professionalProfile: updatedProfile } : {}),
      };
    } else {
      const validation = tenantTeamMemberSchema.safeParse({ ...candidate, password: values.password });
      if (!validation.success) {
        setFieldErrors(getFieldErrors(validation.error.issues));
        return;
      }
      const parsed = validation.data;
      const profile = parsed.professionalProfile;
      payload = {
        email: parsed.email,
        password: parsed.password,
        firstName: parsed.firstName,
        lastName: parsed.lastName,
        role: parsed.role,
        ...(parsed.phone ? { phone: parsed.phone } : {}),
        ...(profile
          ? {
              professionalProfile: {
                specialtyId: profile.specialtyId,
                professionalTitle: profile.professionalTitle || undefined,
                licenseNumber: profile.licenseNumber || undefined,
                bio: profile.bio || undefined,
                isActive: true,
              },
            }
          : {}),
      };
    }

    submitLock.current = true;
    setSubmitting(true);
    try {
      await onSubmit(payload);
      setValues({ ...EMPTY_FORM });
      setFieldErrors({});
      setServerError(null);
      onOpenChange(false);
    } catch (error) {
      setServerError(errorMessage(error, 'No se pudo guardar el miembro.'));
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  };

  const changeField = (key: keyof FormValues) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setValue(key, event.target.value as FormValues[typeof key]);
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (isSaving && !nextOpen) return;
      onOpenChange(nextOpen);
    }}>
      <DialogContent
        role="dialog"
        aria-modal="true"
        aria-labelledby="team-member-dialog-title"
        className="max-h-[90vh] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle id="team-member-dialog-title">
            {isEditing ? 'Editar miembro del equipo' : 'Agregar miembro del equipo'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Actualiza los datos y el perfil clínico del miembro.'
              : 'Crea una cuenta activa para un miembro del consultorio.'}
          </DialogDescription>
        </DialogHeader>

        {serverError && <Alert variant="destructive" description={serverError} />}
        {specialtiesError && (
          <Alert variant="destructive" title="No se pudieron cargar las especialidades" description={specialtiesError}>
            {onRetrySpecialties && (
              <Button type="button" variant="outline" size="sm" onClick={onRetrySpecialties} disabled={specialtiesLoading}>
                Reintentar especialidades
              </Button>
            )}
          </Alert>
        )}

        <form className="space-y-4" onSubmit={handleSubmit} noValidate>
          <div className="space-y-2">
            <label htmlFor="team-member-email" className="text-sm font-medium">Correo electrónico</label>
            <Input
              id="team-member-email"
              type="email"
              autoComplete="email"
              value={values.email}
              onChange={changeField('email')}
              aria-invalid={!!fieldErrors.email}
              aria-describedby={fieldErrors.email ? 'team-member-email-error' : undefined}
              error={fieldErrors.email}
              errorId="team-member-email-error"
              disabled={isSaving}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="team-member-first-name" className="text-sm font-medium">Nombre</label>
              <Input
                id="team-member-first-name"
                autoComplete="given-name"
                value={values.firstName}
                onChange={changeField('firstName')}
                aria-invalid={!!fieldErrors.firstName}
                aria-describedby={fieldErrors.firstName ? 'team-member-first-name-error' : undefined}
                error={fieldErrors.firstName}
                errorId="team-member-first-name-error"
                disabled={isSaving}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="team-member-last-name" className="text-sm font-medium">Apellido</label>
              <Input
                id="team-member-last-name"
                autoComplete="family-name"
                value={values.lastName}
                onChange={changeField('lastName')}
                aria-invalid={!!fieldErrors.lastName}
                aria-describedby={fieldErrors.lastName ? 'team-member-last-name-error' : undefined}
                error={fieldErrors.lastName}
                errorId="team-member-last-name-error"
                disabled={isSaving}
              />
            </div>
          </div>

          {!isEditing && (
            <div className="space-y-2">
              <label htmlFor="team-member-password" className="text-sm font-medium">Contraseña</label>
              <Input
                id="team-member-password"
                type="password"
                autoComplete="new-password"
                value={values.password}
                onChange={changeField('password')}
                aria-invalid={!!fieldErrors.password}
                aria-describedby={fieldErrors.password ? 'team-member-password-error' : undefined}
                error={fieldErrors.password}
                errorId="team-member-password-error"
                disabled={isSaving}
              />
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="team-member-phone" className="text-sm font-medium">Teléfono</label>
            <Input
              id="team-member-phone"
              type="tel"
              autoComplete="tel"
              value={values.phone}
              onChange={changeField('phone')}
              aria-invalid={!!fieldErrors.phone}
              aria-describedby={fieldErrors.phone
                ? 'team-member-phone-description team-member-phone-error'
                : 'team-member-phone-description'}
              error={fieldErrors.phone}
              errorId="team-member-phone-error"
              disabled={isSaving}
            />
            <p id="team-member-phone-description" className="text-xs text-muted-foreground">Opcional</p>
          </div>

          {isMaster ? (
            <div className="space-y-1">
              <p className="text-sm font-medium">Rol</p>
              <p className="text-sm">{ROLE_LABELS[UserRole.MASTER]}</p>
              <p className="text-xs text-muted-foreground">
                El rol del titular de la cuenta no se puede cambiar.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <label htmlFor="team-member-role" className="text-sm font-medium">Rol</label>
              <select
                id="team-member-role"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={values.role}
                onChange={(event) => handleRoleChange(event.target.value as AssignableTeamRole)}
                disabled={isSaving}
                aria-describedby="team-member-role-description"
              >
                <option value={UserRole.PROFESIONAL}>Profesional</option>
                <option value={UserRole.ASISTENTE}>Asistente</option>
              </select>
              <p id="team-member-role-description" className="text-xs text-muted-foreground">
                Los perfiles clínicos requieren una especialidad habilitada para el consultorio.
              </p>
            </div>
          )}

          {isMaster && (
            <div className="flex items-start gap-3 rounded-md border p-3">
              <input
                id="team-member-admin-care"
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-input"
                checked={values.masterProvidesCare}
                onChange={(event) => {
                  const checked = event.target.checked;
                  setValues((current) => ({
                    ...current,
                    masterProvidesCare: checked,
                    ...(checked ? {} : { specialtyId: '', professionalTitle: '', licenseNumber: '', bio: '' }),
                  }));
                  setFieldErrors((current) => ({ ...current, specialtyId: '' }));
                  setServerError(null);
                }}
                disabled={isSaving}
                aria-describedby="team-member-admin-care-description"
              />
              <div>
                <label htmlFor="team-member-admin-care" className="text-sm font-medium">También atiende pacientes</label>
                <p id="team-member-admin-care-description" className="text-xs text-muted-foreground">
                  Habilita un perfil clínico para el titular de la cuenta.
                </p>
              </div>
            </div>
          )}

          {profileIsRequired && (
            <div className="space-y-4 rounded-md border p-4">
              <div className="space-y-2">
                <label htmlFor="team-member-specialty" className="text-sm font-medium">Especialidad</label>
                <select
                  id="team-member-specialty"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={values.specialtyId}
                  onChange={(event) => setValue('specialtyId', event.target.value)}
                  disabled={isSaving || specialtiesLoading}
                  aria-invalid={!!fieldErrors.specialtyId}
                  aria-describedby={fieldErrors.specialtyId
                    ? 'team-member-specialty-description team-member-specialty-error'
                    : 'team-member-specialty-description'}
                >
                  <option value="">Selecciona una especialidad</option>
                  {profileOptions.map((specialty) => (
                    <option key={specialty.id} value={specialty.id} disabled={!specialty.isActive}>
                      {specialty.name}{!specialty.isActive ? ' (ya no habilitada)' : ''}
                    </option>
                  ))}
                </select>
                <p id="team-member-specialty-description" className="text-xs text-muted-foreground">
                  {specialtiesLoading
                    ? 'Cargando especialidades habilitadas…'
                    : enabledSpecialties.length === 0
                      ? 'El consultorio no tiene especialidades habilitadas.'
                      : 'Selecciona exactamente una especialidad habilitada.'}
                </p>
                {fieldErrors.specialtyId && (
                  <p id="team-member-specialty-error" className="text-sm text-destructive" role="alert">
                    {fieldErrors.specialtyId}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label htmlFor="team-member-title" className="text-sm font-medium">Título profesional</label>
                <Input id="team-member-title" value={values.professionalTitle} onChange={changeField('professionalTitle')} disabled={isSaving} />
              </div>
              <div className="space-y-2">
                <label htmlFor="team-member-license" className="text-sm font-medium">Número de licencia</label>
                <Input id="team-member-license" value={values.licenseNumber} onChange={changeField('licenseNumber')} disabled={isSaving} />
              </div>
              <div className="space-y-2">
                <label htmlFor="team-member-bio" className="text-sm font-medium">Biografía</label>
                <Textarea id="team-member-bio" value={values.bio} onChange={changeField('bio')} disabled={isSaving} />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Guardando…' : isEditing ? 'Guardar cambios' : 'Crear miembro'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
