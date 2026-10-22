import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserRole, type TenantSpecialty, type UpdateTenantUserInput, type User } from '@/types';
import { TeamMemberDialog } from './team-member-dialog';

const psychology: TenantSpecialty = {
  id: 'specialty-psychology',
  code: 'PSYCHOLOGY',
  name: 'Psicología',
  description: null,
  isActive: true,
  modules: [],
};

const nutrition: TenantSpecialty = {
  id: 'specialty-nutrition',
  code: 'NUTRITION',
  name: 'Nutrición',
  description: null,
  isActive: true,
  modules: [],
};

function renderDialog({
  onSubmit = vi.fn().mockResolvedValue(undefined),
  member,
  specialties = [psychology, nutrition],
}: {
  onSubmit?: (input: unknown) => Promise<void>;
  member?: User;
  specialties?: TenantSpecialty[];
} = {}) {
  const onOpenChange = vi.fn();
  const view = render(
    <TeamMemberDialog
      open
      onOpenChange={onOpenChange}
      specialties={specialties}
      member={member}
      tenantId="tenant-1"
      onSubmit={onSubmit}
    />,
  );
  return {
    ...view,
    onSubmit: onSubmit as ReturnType<typeof vi.fn>,
    onOpenChange: onOpenChange as ReturnType<typeof vi.fn>,
  };
}

function fillIdentityAndPassword() {
  fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'ana@example.com' } });
  fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Ana' } });
  fireEvent.change(screen.getByLabelText('Apellido'), { target: { value: 'Vega' } });
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'Secret123' } });
}

function chooseRole(role: UserRole) {
  fireEvent.change(screen.getByLabelText('Rol'), { target: { value: role } });
}

describe('TeamMemberDialog', () => {
  beforeEach(() => vi.clearAllMocks());

  it('requires one enabled specialty for a professional and sends an active profile', async () => {
    const { onSubmit, onOpenChange } = renderDialog();
    fillIdentityAndPassword();
    chooseRole(UserRole.PROFESIONAL);
    fireEvent.click(screen.getByRole('button', { name: 'Crear miembro' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Selecciona una especialidad');
    const specialty = screen.getByLabelText('Especialidad');
    expect(specialty.getAttribute('aria-describedby')?.split(' ')).toContain('team-member-specialty-error');
    expect(document.getElementById('team-member-specialty-error')).toHaveTextContent('Selecciona una especialidad');
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Especialidad'), { target: { value: psychology.id } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear miembro' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({
      email: 'ana@example.com',
      password: 'Secret123',
      firstName: 'Ana',
      lastName: 'Vega',
      role: UserRole.PROFESIONAL,
      professionalProfile: { specialtyId: psychology.id, isActive: true },
    }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('clears hidden clinical fields when the role changes to assistant', async () => {
    const { onSubmit } = renderDialog();
    fillIdentityAndPassword();
    chooseRole(UserRole.PROFESIONAL);
    fireEvent.change(screen.getByLabelText('Especialidad'), { target: { value: psychology.id } });
    fireEvent.change(screen.getByLabelText('Título profesional'), { target: { value: 'Psicóloga clínica' } });
    chooseRole(UserRole.ASISTENTE);
    fireEvent.click(screen.getByRole('button', { name: 'Crear miembro' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({
      email: 'ana@example.com',
      password: 'Secret123',
      firstName: 'Ana',
      lastName: 'Vega',
      role: UserRole.ASISTENTE,
    }));
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('professionalProfile');
  });

  it('offers only Profesional and Asistente when adding a member', () => {
    renderDialog();
    const options = Array.from(
      (screen.getByLabelText('Rol') as HTMLSelectElement).options,
    ).map((option) => option.value);
    expect(options).toEqual([UserRole.PROFESIONAL, UserRole.ASISTENTE]);
    expect(screen.queryByLabelText('También atiende pacientes')).not.toBeInTheDocument();
  });

  it('defaults a new member to Profesional', () => {
    renderDialog();
    expect(screen.getByLabelText('Rol')).toHaveValue(UserRole.PROFESIONAL);
  });

  it('edits an assistant without offering a clinical profile', async () => {
    const assistant = {
      id: 'assistant-1', email: 'abel@example.com', firstName: 'Abel', lastName: 'Asistente',
      role: UserRole.ASISTENTE, tenantId: 'tenant-1', isActive: true,
    } as User;
    const { onSubmit } = renderDialog({ member: assistant });
    expect(screen.getByLabelText('Rol')).toHaveValue(UserRole.ASISTENTE);
    expect(screen.queryByLabelText('Especialidad')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({
      email: 'abel@example.com', firstName: 'Abel', lastName: 'Asistente', role: UserRole.ASISTENTE,
    }));
  });

  const master = {
    id: 'master-1',
    email: 'titular@example.com',
    firstName: 'Tina',
    lastName: 'Titular',
    role: UserRole.MASTER,
    tenantId: 'tenant-1',
    isActive: true,
  } as User;

  it('shows the account holder role as fixed text, without a role selector', () => {
    renderDialog({ member: master });
    expect(screen.queryByLabelText('Rol')).not.toBeInTheDocument();
    expect(screen.getByText('Titular de la cuenta')).toBeInTheDocument();
    expect(screen.getByLabelText('También atiende pacientes')).not.toBeChecked();
  });

  it('keeps the MASTER role when the account holder edits their name', async () => {
    const { onSubmit } = renderDialog({ member: master });
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Nueva' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ role: UserRole.MASTER, firstName: 'Nueva' });
  });

  it('requires a specialty when the account holder starts seeing patients', async () => {
    const { onSubmit } = renderDialog({ member: master });
    fireEvent.click(screen.getByLabelText('También atiende pacientes'));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Selecciona una especialidad');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('keeps the clinical profile of an account holder who already sees patients', async () => {
    const holderWithProfile = {
      ...master,
      professionalProfile: {
        userId: 'master-1', specialtyId: psychology.id,
        specialty: { id: psychology.id, code: 'PSYCHOLOGY', name: psychology.name, isActive: true },
        isActive: true,
      },
    } as User;
    const { onSubmit } = renderDialog({ member: holderWithProfile });
    expect(screen.getByLabelText('También atiende pacientes')).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      role: UserRole.MASTER,
      professionalProfile: expect.objectContaining({ specialtyId: psychology.id, isActive: true }),
    })));
  });

  it('keeps create fields and dialog open after a server error', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('No se pudo crear el usuario.'));
    const { onOpenChange } = renderDialog({ onSubmit });
    fillIdentityAndPassword();
    chooseRole(UserRole.ASISTENTE);
    fireEvent.click(screen.getByRole('button', { name: 'Crear miembro' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo crear el usuario.');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText('Correo electrónico')).toHaveValue('ana@example.com');
    expect(screen.getByLabelText('Nombre')).toHaveValue('Ana');
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('associates identity validation messages with their fields and describes the optional phone field', async () => {
    renderDialog();
    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'ana@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear miembro' }));

    const identityErrors = [
      ['Nombre', 'team-member-first-name-error', 'Ingresa el nombre'],
      ['Apellido', 'team-member-last-name-error', 'Ingresa el apellido'],
      ['Contraseña', 'team-member-password-error', 'La contraseña debe tener al menos 8 caracteres'],
    ] as const;
    for (const [label, errorId, message] of identityErrors) {
      const field = screen.getByLabelText(label);
      expect(field.getAttribute('aria-describedby')?.split(' ')).toContain(errorId);
      expect(document.getElementById(errorId)).toHaveTextContent(message);
    }

    const phone = screen.getByLabelText('Teléfono');
    expect(phone.getAttribute('aria-describedby')?.split(' ')).toContain('team-member-phone-description');
    expect(document.getElementById('team-member-phone-description')).toHaveTextContent('Opcional');
  });

  it('edits a professional keeping the existing profile, without a password or tenant field', async () => {
    const professional = {
      id: 'user-1',
      email: 'luis@example.com',
      firstName: 'Luis',
      lastName: 'Paz',
      role: UserRole.PROFESIONAL,
      tenantId: 'tenant-1',
      isActive: true,
      emailVerified: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      professionalProfile: {
        userId: 'user-1',
        specialtyId: psychology.id,
        specialty: { id: psychology.id, code: 'PSYCHOLOGY', name: psychology.name, isActive: true },
        professionalTitle: 'Psicólogo',
        licenseNumber: 'LIC-8',
        bio: 'Consulta clínica',
        isActive: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    } as User;
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderDialog({ onSubmit, member: professional });

    expect(screen.queryByLabelText('Contraseña')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Rol')).toHaveValue(UserRole.PROFESIONAL);
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    const expected: UpdateTenantUserInput = {
      email: 'luis@example.com',
      firstName: 'Luis',
      lastName: 'Paz',
      role: UserRole.PROFESIONAL,
      professionalProfile: {
        specialtyId: psychology.id,
        professionalTitle: 'Psicólogo',
        licenseNumber: 'LIC-8',
        bio: 'Consulta clínica',
        isActive: false,
      },
    };
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expected));
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('password');
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('tenantId');
  });

  it('preserves unsaved form values when the same member row is refreshed', async () => {
    const member = {
      id: 'master-refresh', email: 'luis@example.com', firstName: 'Luis', lastName: 'Paz',
      role: UserRole.MASTER, tenantId: 'tenant-1', isActive: true,
      createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    } as User;
    const { rerender, onOpenChange } = renderDialog({ member });
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Nombre sin guardar' } });

    rerender(
      <TeamMemberDialog
        open
        onOpenChange={onOpenChange}
        specialties={[psychology, nutrition]}
        member={{ ...member, firstName: 'Luis actualizado' }}
        tenantId="tenant-1"
        onSubmit={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.getByLabelText('Nombre')).toHaveValue('Nombre sin guardar');
  });

  it('removes an existing profile when an edited professional becomes an assistant', async () => {
    const member = {
      id: 'user-2', email: 'luis@example.com', firstName: 'Luis', lastName: 'Paz',
      role: UserRole.PROFESIONAL, tenantId: 'tenant-1', isActive: true, emailVerified: true,
      createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
      professionalProfile: {
        userId: 'user-2', specialtyId: psychology.id,
        specialty: { id: psychology.id, code: 'PSYCHOLOGY', name: psychology.name, isActive: true },
        isActive: true, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
      },
    } as User;
    const { onSubmit } = renderDialog({ member });
    chooseRole(UserRole.ASISTENTE);
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({
      email: 'luis@example.com',
      firstName: 'Luis',
      lastName: 'Paz',
      role: UserRole.ASISTENTE,
      professionalProfile: null,
    }));
  });

  it('prevents duplicate submissions while a save is pending', async () => {
    let resolve!: () => void;
    const onSubmit = vi.fn(() => new Promise<void>((res) => { resolve = res; }));
    renderDialog({ onSubmit });
    fillIdentityAndPassword();
    chooseRole(UserRole.ASISTENTE);
    const submit = screen.getByRole('button', { name: 'Crear miembro' });
    fireEvent.click(submit);
    fireEvent.click(submit);

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(submit).toBeDisabled();
    await act(async () => resolve());
  });
});
