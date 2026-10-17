import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PatientBillingProfiles } from './patient-billing-profiles';

const mocks = vi.hoisted(() => ({
  profiles: { data: undefined as unknown, isPending: false, isError: false },
  link: vi.fn(),
  unlink: vi.fn(),
  can: vi.fn(),
}));

vi.mock('@/hooks/useBillingProfiles', () => ({
  usePatientBillingProfiles: () => mocks.profiles,
  useLinkBillingProfile: () => ({ mutate: mocks.link, isPending: false }),
  useUnlinkBillingProfile: () => ({ mutate: mocks.unlink, isPending: false }),
}));
vi.mock('@/hooks/usePermissions', () => ({ useMyPermissions: () => ({ can: mocks.can }) }));
vi.mock('@/store/authStore', () => ({
  useAuthStore: (select: (state: { user: { role: string } }) => unknown) =>
    select({ user: { role: 'PROFESSIONAL' } }),
}));
vi.mock('@/features/cash/billing-profile-picker', () => ({
  BillingProfilePicker: ({ onSelect }: { onSelect: (profile: { id: string }) => void }) => (
    <button type="button" onClick={() => onSelect({ id: 'bp-9' })}>
      Elegir receptor de prueba
    </button>
  ),
}));

const profile = (id: string, legalName: string, isDefault: boolean) => ({
  id,
  legalName,
  idType: '05',
  idNumber: '0912345678',
  kind: 'PERSON',
  isDefault,
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.can.mockReturnValue(true);
  mocks.profiles.data = [profile('bp-1', 'Ana Paz', true), profile('bp-2', 'Luis Mora', false)];
  mocks.profiles.isPending = false;
});

describe('PatientBillingProfiles', () => {
  it('lists the linked profiles with the default one marked', () => {
    render(<PatientBillingProfiles patientId="patient-1" />);

    expect(screen.getByText('Perfiles de facturación')).toBeInTheDocument();
    expect(screen.getByText('Ana Paz')).toBeInTheDocument();
    expect(screen.getByText('Luis Mora')).toBeInTheDocument();
    expect(screen.getAllByText('Predeterminado')).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: /Marcar como predeterminado/ })).toHaveLength(1);
  });

  it('marks another profile as the default through the link', () => {
    render(<PatientBillingProfiles patientId="patient-1" />);
    fireEvent.click(screen.getByRole('button', { name: /Marcar como predeterminado/ }));

    expect(mocks.link).toHaveBeenCalledWith({ billingProfileId: 'bp-2', isDefault: true });
  });

  it('unlinks a profile', () => {
    render(<PatientBillingProfiles patientId="patient-1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Desvincular Luis Mora' }));

    expect(mocks.unlink).toHaveBeenCalledWith('bp-2');
  });

  it('links the profile chosen from Agregar', () => {
    render(<PatientBillingProfiles patientId="patient-1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Elegir receptor de prueba' }));

    expect(mocks.link).toHaveBeenCalledWith({ billingProfileId: 'bp-9' }, expect.anything());
  });

  it('offers no actions without billing.create', () => {
    mocks.can.mockImplementation((permission: string) => permission !== 'billing.create');
    render(<PatientBillingProfiles patientId="patient-1" />);

    expect(screen.getByText('Ana Paz')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Agregar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Marcar como predeterminado/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Desvincular/ })).not.toBeInTheDocument();
  });

  it('says so when the patient has none', () => {
    mocks.profiles.data = [];
    render(<PatientBillingProfiles patientId="patient-1" />);
    expect(screen.getByText('Sin datos de facturación vinculados.')).toBeInTheDocument();
  });
});
