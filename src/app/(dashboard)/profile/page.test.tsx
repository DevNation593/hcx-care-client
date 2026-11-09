import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { UserProfile } from '@/types';
import { UserRole } from '@/types';
import ProfilePage from './page';

const state = vi.hoisted(() => ({
  profile: null as UserProfile | null,
  mutate: vi.fn(),
}));

// Two-factor sign-in has its own tests.
vi.mock('@/features/security/two-factor-setup', () => ({ TwoFactorCard: () => null }));
vi.mock('@/store/authStore', () => ({
  useAuthStore: (selector: (store: { user: UserProfile | null }) => unknown) =>
    selector({ user: state.profile }),
}));

vi.mock('@/hooks/useProfile', () => ({
  useProfile: () => ({ data: state.profile, isLoading: false }),
  useUpdateProfile: () => ({ mutate: state.mutate, isPending: false }),
  useChangePassword: () => ({ mutate: vi.fn(), isPending: false }),
  useUploadAvatar: () => ({ mutate: vi.fn(), isPending: false }),
}));

const professional: UserProfile = {
  id: 'user-1', tenantId: 'tenant-1', email: 'ana@example.com',
  firstName: 'Ana', lastName: 'Vega', role: UserRole.PROFESIONAL,
  isActive: true, emailVerified: true,
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  professionalTitle: 'Psicóloga', licenseNumber: 'LIC-1',
  professionalProfile: {
    userId: 'user-1', specialtyId: 'specialty-1',
    specialty: { id: 'specialty-1', code: 'PSY', name: 'Psicología', isActive: true },
    professionalTitle: 'Psicóloga', licenseNumber: 'LIC-1', bio: 'Biografía anterior',
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  },
};

describe('ProfilePage submit', () => {
  beforeEach(() => {
    state.mutate.mockReset();
    state.profile = professional;
  });

  it('sends only supported self-update fields for the professional profile', async () => {
    render(<ProfilePage />);
    fireEvent.change(screen.getByLabelText('Biografía'), { target: { value: 'Nueva biografía clínica' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar Cambios' }));

    await waitFor(() => expect(state.mutate).toHaveBeenCalledOnce());
    expect(state.mutate.mock.calls[0][0]).toEqual({
      firstName: 'Ana',
      lastName: 'Vega',
      phone: '',
      professionalProfile: {
        professionalTitle: 'Psicóloga',
        licenseNumber: 'LIC-1',
        bio: 'Nueva biografía clínica',
      },
    });
  });

  it('submits personal edits without creating a professional profile for a patient', async () => {
    state.profile = { ...professional, role: UserRole.PACIENTE, professionalProfile: undefined };
    render(<ProfilePage />);
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'María' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar Cambios' }));

    await waitFor(() => expect(state.mutate).toHaveBeenCalledOnce());
    expect(state.mutate.mock.calls[0][0]).toEqual({
      firstName: 'María',
      lastName: 'Vega',
      phone: '',
    });
  });
});
