import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import NewPatientPage from './new/page';
import EditPatientPage from './[id]/edit/page';

const mocks = vi.hoisted(() => ({
  create: vi.fn(), update: vi.fn(), listUsers: vi.fn(),
  patient: {
    id: 'patient-1', tenantId: 'tenant-1', firstName: 'Ana', lastName: 'Vega',
    email: 'ana@example.com', phone: '555', dateOfBirth: '1990-01-01',
    gender: null, address: 'Centro', emergencyContactName: 'Luis',
    emergencyContactPhone: '123', notes: 'Nota', assignedPsychologistId: 'legacy-1',
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useParams: () => ({ id: 'patient-1' }),
}));
vi.mock('@/hooks/usePatients', () => ({
  useCreatePatient: () => ({ mutate: mocks.create, isPending: false }),
  useUpdatePatient: () => ({ mutate: mocks.update, isPending: false }),
  usePatient: () => ({ data: mocks.patient, isLoading: false }),
}));
vi.mock('@/lib/api/endpoints', () => ({
  usersApi: { list: mocks.listUsers },
  extractArray: (data: unknown) => data,
}));

function renderPage(page: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{page}</QueryClientProvider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listUsers.mockResolvedValue([]);
});

describe('patient demographic forms', () => {
  it('creates a patient without showing or querying a single assignee', async () => {
    renderPage(<NewPatientPage />);
    expect(screen.queryByLabelText(/Psicólogo.*Asignado/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Asignación')).not.toBeInTheDocument();
    fireEvent.change(document.getElementById('firstName')!, { target: { value: 'Ana' } });
    fireEvent.change(document.getElementById('lastName')!, { target: { value: 'Vega' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear Paciente' }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalled());
    expect(mocks.create.mock.calls[0][0]).not.toHaveProperty('assignedPsychologistId');
    expect(mocks.listUsers).not.toHaveBeenCalled();
  });

  it('edits demographics without sending the legacy assignee from the response', async () => {
    renderPage(<EditPatientPage />);
    expect(screen.queryByLabelText(/Psicólogo.*Asignado/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Asignación')).not.toBeInTheDocument();
    fireEvent.change(document.getElementById('firstName')!, { target: { value: 'Anabel' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar Cambios' }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalled());
    expect(mocks.update.mock.calls[0][0]).toMatchObject({ firstName: 'Anabel', lastName: 'Vega', notes: 'Nota' });
    expect(mocks.update.mock.calls[0][0]).not.toHaveProperty('assignedPsychologistId');
    expect(mocks.listUsers).not.toHaveBeenCalled();
  });
});

describe('patient forms without billing data', () => {
  const fillRequired = () => {
    fireEvent.change(document.getElementById('firstName')!, { target: { value: 'Ana' } });
    fireEvent.change(document.getElementById('lastName')!, { target: { value: 'Vega' } });
  };

  it('renders no billing section when creating and submits no billing fields', async () => {
    renderPage(<NewPatientPage />);
    expect(screen.queryByText('Datos de facturación')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Nombre o razón social')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Usar los datos del paciente' })).not.toBeInTheDocument();
    fillRequired();
    fireEvent.click(screen.getByRole('button', { name: 'Crear Paciente' }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalled());
    const sent = Object.keys(mocks.create.mock.calls[0][0]);
    expect(sent.filter((key) => key.startsWith('billing'))).toEqual([]);
  });

  it('renders no billing section when editing and submits no billing fields', async () => {
    renderPage(<EditPatientPage />);
    expect(screen.queryByText('Datos de facturación')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Nombre o razón social')).not.toBeInTheDocument();
    fireEvent.change(document.getElementById('firstName')!, { target: { value: 'Anabel' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar Cambios' }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalled());
    const sent = Object.keys(mocks.update.mock.calls[0][0]);
    expect(sent.filter((key) => key.startsWith('billing'))).toEqual([]);
  });
});
