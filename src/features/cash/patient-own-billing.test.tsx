import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiError } from '@/types';
import { PatientOwnBilling } from './patient-own-billing';

type Callbacks = { onSuccess?: (profile: unknown) => void; onError?: (error: ApiError) => void };

const mocks = vi.hoisted(() => ({
  mutate: vi.fn(),
  onReady: vi.fn(),
  role: 'MASTER',
  can: vi.fn(),
  recordsOn: true,
}));

vi.mock('@/hooks/useBillingProfiles', () => ({
  useBillAsPatient: () => ({ mutate: mocks.mutate, isPending: false }),
}));
vi.mock('@/hooks/usePatientTerms', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/usePatientTerms')>();
  return { ...actual, usePatientTerms: () => actual.patientTerms(true) };
});
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/hooks/usePermissions', () => ({ useMyPermissions: () => ({ can: mocks.can }) }));
vi.mock('@/hooks/useSections', () => ({
  useSections: () => ({ isEnabled: (section: string) => section !== 'core.patients.records' || mocks.recordsOn }),
}));
vi.mock('@/store/authStore', () => ({
  useAuthStore: (select: (state: { user: { role: string } }) => unknown) => select({ user: { role: mocks.role } }),
}));

const patient = { id: 'patient-1', name: 'Ana Paz' };
const profile = { id: 'bp-1', legalName: 'Ana Paz', isDefault: true };

const incomplete = (missing: string[], invalid: string[] = []): ApiError => ({
  message: invalid.length ? 'Corrige en la ficha la identificación antes de facturar a su nombre.' : 'Faltan datos',
  status: 422,
  code: 'PATIENT_BILLING_DATA_INCOMPLETE',
  details: { missing, invalid },
});

/** Answers the next mutate with an error, and the one after it with the profile. */
function failThenSucceed(error: ApiError) {
  mocks.mutate
    .mockImplementationOnce((_data: unknown, callbacks: Callbacks) => callbacks.onError?.(error))
    .mockImplementationOnce((_data: unknown, callbacks: Callbacks) => callbacks.onSuccess?.(profile));
}

beforeEach(() => {
  vi.clearAllMocks();
  // Drops the answers a test queued and did not use.
  mocks.mutate.mockReset();
  mocks.role = 'MASTER';
  mocks.can.mockReturnValue(true);
  mocks.recordsOn = true;
});

describe('PatientOwnBilling', () => {
  it('bills with the data on file in one click', () => {
    mocks.mutate.mockImplementation((_data: unknown, callbacks: Callbacks) => callbacks.onSuccess?.(profile));
    render(<PatientOwnBilling patient={patient} onReady={mocks.onReady} />);

    fireEvent.click(screen.getByRole('button', { name: 'Facturar a nombre de Ana Paz' }));

    expect(mocks.mutate).toHaveBeenCalledWith(undefined, expect.anything());
    expect(mocks.onReady).toHaveBeenCalledWith(profile);
  });

  it('asks only for what is missing and sends it normalized', () => {
    failThenSucceed(incomplete(['identification', 'email']));
    render(<PatientOwnBilling patient={patient} onReady={mocks.onReady} />);
    fireEvent.click(screen.getByRole('button', { name: 'Facturar a nombre de Ana Paz' }));

    fireEvent.change(screen.getByLabelText('Número de identificación'), { target: { value: '171003406-5' } });
    fireEvent.change(screen.getByLabelText('Correo para la factura'), { target: { value: ' ana@example.test ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar y facturar' }));

    expect(mocks.mutate).toHaveBeenLastCalledWith(
      { identificationType: 'CEDULA', identificationNumber: '1710034065', email: 'ana@example.test' },
      expect.anything(),
    );
    expect(mocks.onReady).toHaveBeenCalledWith(profile);
  });

  it('does not ask for an e-mail the patient already has', () => {
    failThenSucceed(incomplete(['identification']));
    render(<PatientOwnBilling patient={patient} onReady={mocks.onReady} />);
    fireEvent.click(screen.getByRole('button', { name: 'Facturar a nombre de Ana Paz' }));

    expect(screen.getByLabelText('Número de identificación')).toBeInTheDocument();
    expect(screen.queryByLabelText('Correo para la factura')).not.toBeInTheDocument();
  });

  it('refuses an invalid cedula before sending', () => {
    failThenSucceed(incomplete(['identification']));
    render(<PatientOwnBilling patient={patient} onReady={mocks.onReady} />);
    fireEvent.click(screen.getByRole('button', { name: 'Facturar a nombre de Ana Paz' }));

    fireEvent.change(screen.getByLabelText('Número de identificación'), { target: { value: '1710034066' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar y facturar' }));

    expect(screen.getByRole('alert')).toHaveTextContent('La cédula no es válida');
    expect(mocks.mutate).toHaveBeenCalledTimes(1);
  });

  it('sends to the record when the identification on file cannot be invoiced', () => {
    failThenSucceed(incomplete(['email'], ['identification']));
    render(<PatientOwnBilling patient={patient} onReady={mocks.onReady} />);
    fireEvent.click(screen.getByRole('button', { name: 'Facturar a nombre de Ana Paz' }));

    expect(screen.getByText(/Corrige en la ficha la identificación/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Editar cliente' })).toHaveAttribute('href', '/patients/patient-1/edit');
    expect(screen.queryByLabelText('Número de identificación')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Correo para la factura')).not.toBeInTheDocument();
  });

  it('sends a cashier to someone who may edit the record, without a link or a form', () => {
    mocks.role = 'CAJERO';
    failThenSucceed(incomplete(['email'], ['identification']));
    render(<PatientOwnBilling patient={patient} onReady={mocks.onReady} />);
    fireEvent.click(screen.getByRole('button', { name: 'Facturar a nombre de Ana Paz' }));

    expect(screen.getByText(/Pide a un usuario que pueda editar clientes/)).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Correo para la factura')).not.toBeInTheDocument();
  });

  it('asks for nothing without patients.update or with the patient records section off', () => {
    mocks.can.mockImplementation((permission: string) => permission !== 'patients.update');
    failThenSucceed(incomplete(['identification']));
    const { unmount } = render(<PatientOwnBilling patient={patient} onReady={mocks.onReady} />);
    fireEvent.click(screen.getByRole('button', { name: 'Facturar a nombre de Ana Paz' }));
    expect(screen.queryByLabelText('Número de identificación')).not.toBeInTheDocument();
    expect(screen.getByText(/Pide a un usuario/)).toBeInTheDocument();
    unmount();

    mocks.mutate.mockReset();
    mocks.can.mockReturnValue(true);
    mocks.recordsOn = false;
    failThenSucceed(incomplete(['identification']));
    render(<PatientOwnBilling patient={patient} onReady={mocks.onReady} />);
    fireEvent.click(screen.getByRole('button', { name: 'Facturar a nombre de Ana Paz' }));
    expect(screen.queryByLabelText('Número de identificación')).not.toBeInTheDocument();
  });

  it('shows any other failure as it comes', () => {
    mocks.mutate.mockImplementation((_data: unknown, callbacks: Callbacks) =>
      callbacks.onError?.({ message: 'Tu rol no tiene este permiso.', status: 403, code: 'PERMISSION_DENIED' }),
    );
    render(<PatientOwnBilling patient={patient} onReady={mocks.onReady} />);
    fireEvent.click(screen.getByRole('button', { name: 'Facturar a nombre de Ana Paz' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Tu rol no tiene este permiso.');
    expect(mocks.onReady).not.toHaveBeenCalled();
  });
});
