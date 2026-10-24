import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SpecialtiesPage from '@/app/(dashboard)/admin/specialties/page';
import { useAuthStore } from '@/store/authStore';
import { UserRole, type User } from '@/types';

vi.mock('@/hooks/useSpecialties', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/useSpecialties')>()),
  useTenantModules: () => ({
    data: [
      'core.agenda', 'core.agenda.calendar', 'core.agenda.tasks', 'core.agenda.notifications',
      'core.patients', 'core.patients.records', 'core.patients.team', 'core.patients.files',
      'core.clinical', 'core.clinical.notes', 'core.clinical.nextSession',
      'core.clinical.timeline', 'core.clinical.specialties', 'core.clinical.forms',
      'core.clinical.templates', 'core.treatments', 'core.treatments.catalog',
      'core.treatments.sessions', 'core.treatments.consents', 'core.billing',
      'core.billing.profiles', 'core.billing.orders', 'core.billing.cash',
      'core.billing.invoicing', 'core.admin', 'core.admin.team', 'core.admin.branches',
      'core.admin.reports',
    ].map((moduleKey) => ({ moduleKey, enabled: true })),
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));
vi.mock('./specialty-manager', () => ({
  SpecialtyManager: () => <div data-testid="specialty-manager" />,
}));

const signIn = (role: UserRole) =>
  useAuthStore.setState({ user: { id: 'user-1', role, tenantId: 'tenant-1' } as User });

beforeEach(() => useAuthStore.setState({ user: null }));

describe('SpecialtiesPage access', () => {
  it.each([UserRole.MASTER])('opens for %s', (role) => {
    signIn(role);
    render(<SpecialtiesPage />);
    expect(screen.getByTestId('specialty-manager')).toBeInTheDocument();
  });

  it.each([UserRole.ASISTENTE, UserRole.PROFESIONAL, UserRole.ADMIN, UserRole.SOPORTE])(
    'tells %s the section is restricted instead of showing it',
    (role) => {
      signIn(role);
      render(<SpecialtiesPage />);
      expect(screen.queryByTestId('specialty-manager')).not.toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent('Solo el titular de la cuenta puede acceder a esta sección.');
    },
  );

  it('shows nothing until the session is known', () => {
    const { container } = render(<SpecialtiesPage />);
    expect(container).toBeEmptyDOMElement();
  });
});
