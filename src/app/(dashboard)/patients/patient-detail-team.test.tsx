import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/store/authStore';
import { AppointmentStatus, UserRole, type Appointment, type Patient, type User } from '@/types';
import PatientDetailPage from './[id]/page';

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  removePatient: vi.fn(),
  get: vi.fn(),
  disabledSections: [] as string[],
  alerts: [] as unknown[],
  search: '',
}));

const SECTION_KEYS = [
  'core.agenda', 'core.agenda.calendar', 'core.agenda.tasks', 'core.agenda.notifications',
  'core.patients', 'core.patients.records', 'core.patients.team', 'core.patients.files',
  'core.clinical', 'core.clinical.notes', 'core.clinical.nextSession', 'core.clinical.timeline',
  'core.clinical.specialties', 'core.clinical.forms', 'core.clinical.templates', 'core.treatments',
  'core.treatments.catalog', 'core.treatments.sessions', 'core.treatments.consents',
  'core.billing', 'core.billing.profiles', 'core.billing.orders', 'core.billing.cash',
  'core.billing.invoicing', 'core.admin', 'core.admin.team', 'core.admin.branches',
  'core.admin.reports',
];

const patient = {
  id: 'patient-1',
  tenantId: 'tenant-1',
  firstName: 'Ana',
  lastName: 'Vega',
  email: 'ana@example.com',
  phone: '555',
  dateOfBirth: '1990-01-01',
  gender: null,
  address: 'Centro',
  emergencyContactName: 'Luis',
  emergencyContactPhone: '123',
  notes: 'Nota clínica preservada',
  assignedPsychologistId: 'legacy-1',
  assignedPsychologist: { id: 'legacy-1', firstName: 'Legacy', lastName: 'Psych', email: 'legacy@example.com' },
  isActive: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
} as Patient;

const canonicalAppointment = {
  id: 'appointment-1',
  tenantId: 'tenant-1',
  patientId: 'patient-1',
  patient: { id: 'patient-1', firstName: 'Ana', lastName: 'Vega', email: null, phone: null },
  professionalId: 'professional-1',
  professional: {
    id: 'professional-1', firstName: 'Noa', lastName: 'Paz', email: 'noa@example.com',
    professionalTitle: 'Nutricionista',
  },
  specialtyId: 'nutrition',
  specialty: { id: 'nutrition', code: 'NUTRITION', name: 'Nutrición' },
  psychologistId: 'legacy-psychologist',
  psychologist: { id: 'legacy-psychologist', firstName: 'Legacy', lastName: 'Psych', email: 'legacy@example.com' },
  title: 'Consulta nutricional',
  description: null,
  startTime: '2025-01-01T15:00:00.000Z',
  endTime: '2025-01-01T16:00:00.000Z',
  duration: 60,
  status: AppointmentStatus.COMPLETED,
  location: null,
  isOnline: false,
  meetingUrl: null,
  cancelledAt: null,
  cancelledBy: null,
  cancellationReason: null,
  reminderSent24h: false,
  reminderSent2h: false,
  lastReminderSentAt: null,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
} as Appointment;

const canonicalAppointmentWithoutTitle = {
  ...canonicalAppointment,
  id: 'appointment-2',
  professionalId: 'professional-2',
  professional: {
    id: 'professional-2', firstName: 'Luis', lastName: 'Claro', email: 'luis@example.com',
    professionalTitle: null,
  },
  psychologistId: 'legacy-psychologist-2',
  psychologist: { id: 'legacy-psychologist-2', firstName: 'Otro', lastName: 'Legado', email: 'otro@example.com' },
} as Appointment;

const permissions = vi.hoisted(() => ({ withdrawn: [] as string[], granted: [] as string[] }));
vi.mock('@/hooks/usePermissions', () => ({
  useMyPermissions: () => ({
    // As the hook: a granted permission is held whatever the role; otherwise the role decides
    // unless the permission was withdrawn.
    can: (permission: string, byRole = true) =>
      permissions.granted.includes(permission) ||
      (byRole && !permissions.withdrawn.includes(permission)),
  }),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push }),
  useParams: () => ({ id: 'patient-1' }),
  useSearchParams: () => new URLSearchParams(mocks.search),
}));
// The tabs have their own tests; here only which one opens, and with what, matters.
vi.mock('@/features/patients/clinical-records-tab', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/patients/clinical-records-tab')>()),
  ClinicalRecordsTab: ({ startAppointmentId }: { startAppointmentId?: string }) => (
    <div data-testid="records-tab">{startAppointmentId ?? 'no appointment'}</div>
  ),
}));
vi.mock('@/features/patients/patient-files-tab', () => ({
  PatientFilesTab: ({ patientId }: { patientId: string }) => (
    <div data-testid="files-tab">{patientId}</div>
  ),
}));
vi.mock('@/hooks/useSpecialties', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/useSpecialties')>()),
  useTenantModules: () => ({
    data: SECTION_KEYS.map((moduleKey) => ({ moduleKey, enabled: !mocks.disabledSections.includes(moduleKey) })),
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));
vi.mock('@/hooks/usePatients', () => ({
  usePatient: () => ({ data: patient, isLoading: false }),
  useUpdatePatient: vi.fn(),
  useDeletePatient: () => ({ mutate: mocks.removePatient, isPending: false }),
}));
vi.mock('@/features/billing/patient-invoices-tab', () => ({
  PatientInvoicesTab: ({ patientId }: { patientId: string }) => (
    <div data-testid="patient-invoices">{patientId}</div>
  ),
}));
vi.mock('@/lib/api/client', () => ({
  apiClient: { get: mocks.get, put: vi.fn(), delete: vi.fn() },
}));

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><PatientDetailPage /></QueryClientProvider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.disabledSections = [];
  mocks.alerts = [];
  mocks.search = '';
  permissions.withdrawn = [];
  useAuthStore.setState({
    user: {
      id: 'admin-1',
      tenantId: 'tenant-1',
      role: UserRole.MASTER,
      professionalProfile: { isActive: true },
    } as User,
    tenant: { id: 'tenant-1' } as ReturnType<typeof useAuthStore.getState>['tenant'],
  });
  mocks.get.mockImplementation((url: string) => {
    if (url.endsWith('/appointments')) {
      return Promise.resolve([canonicalAppointment, canonicalAppointmentWithoutTitle]);
    }
    if (url.endsWith('/team') || url.endsWith('/team/eligible') || url.includes('/specialties')) {
      return Promise.resolve([]);
    }
    if (url.endsWith('/specialty-records/alerts')) {
      return Promise.resolve(mocks.alerts);
    }
    throw new Error(`Unexpected request: ${url}`);
  });

});

describe('patient detail invoices tab', () => {
  it.each([
    [UserRole.MASTER, true],
    [UserRole.PROFESIONAL, true],
    [UserRole.ASISTENTE, false],
  ])('for %s is visible: %s', (role, visible) => {
    useAuthStore.setState({ user: { id: 'user-1', tenantId: 'tenant-1', role } as User });
    renderPage();

    expect(!!screen.queryByRole('button', { name: 'Facturas' })).toBe(visible);
    if (visible) {
      fireEvent.click(screen.getByRole('button', { name: 'Facturas' }));
      expect(screen.getByTestId('patient-invoices')).toHaveTextContent('patient-1');
    }
  });
});

describe('patient detail clinical tabs', () => {
  it.each([
    ['a MASTER without a professional profile', UserRole.MASTER, undefined],
    ['a PROFESIONAL with an inactive profile', UserRole.PROFESIONAL, { isActive: false }],
    ['an ASISTENTE', UserRole.ASISTENTE, undefined],
  ])('are hidden from %s', (_label, role, professionalProfile) => {
    useAuthStore.setState({
      user: { id: 'user-1', tenantId: 'tenant-1', role, professionalProfile } as User,
    });
    renderPage();

    expect(screen.queryByRole('button', { name: 'Historia Clínica' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Registros clínicos' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tratamientos' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Equipo tratante' })).toBeInTheDocument();
  });
});

describe('patient detail withdrawn permissions', () => {
  it.each([
    ['clinical_records.view', 'Registros clínicos'],
    ['clinical_records.view', 'Tratamientos'],
    ['billing.view', 'Facturas'],
  ])('hides what %s gave access to', (permission, tab) => {
    renderPage();
    expect(screen.getByRole('button', { name: tab })).toBeInTheDocument();
    cleanup();

    permissions.withdrawn = [permission];
    renderPage();
    expect(screen.queryByRole('button', { name: tab })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'General' })).toBeInTheDocument();
  });
});

describe('patient detail opened from the agenda', () => {
  it('opens the records tab with the appointment to attend', () => {
    mocks.search = 'tab=specialties&appointmentId=appointment-1';
    renderPage();

    expect(screen.getByTestId('records-tab')).toHaveTextContent('appointment-1');
  });

  it('opens the files tab from the storage page', () => {
    mocks.search = 'tab=files';
    renderPage();

    expect(screen.getByTestId('files-tab')).toHaveTextContent('patient-1');
  });

  it('ignores an unknown tab and never shows clinical tabs to an account without clinical access', () => {
    mocks.search = 'tab=unknown';
    renderPage();
    expect(screen.getByText('Información Personal')).toBeInTheDocument();
    cleanup();

    mocks.search = 'tab=files';
    useAuthStore.setState({
      user: { id: 'user-1', tenantId: 'tenant-1', role: UserRole.ASISTENTE } as User,
    });
    renderPage();
    expect(screen.queryByTestId('files-tab')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Archivos' })).not.toBeInTheDocument();
  });
});

describe('patient detail clinical alerts', () => {
  const allergy = {
    level: 'critical',
    message: 'Alergia grave registrada.',
    recordId: 'allergy-1',
    moduleKey: 'general.allergies',
    moduleName: 'Alergias',
    recordDate: '2026-09-01T10:00:00.000Z',
  };
  const requestedAlerts = () =>
    mocks.get.mock.calls.some(([url]) => String(url).endsWith('/specialty-records/alerts'));

  it('shows the alerts of the patient above the tabs to a clinical account', async () => {
    mocks.alerts = [allergy];
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('Alergia grave registrada.');
    expect(screen.getByRole('region', { name: 'Alertas clínicas' })).toBeInTheDocument();
  });

  it.each([
    ['an account without a professional profile', undefined, []],
    ['a clinic without clinical modules', { isActive: true }, ['core.clinical.specialties']],
  ])('never requests them for %s', async (_label, professionalProfile, disabledSections) => {
    mocks.alerts = [allergy];
    mocks.disabledSections = disabledSections;
    useAuthStore.setState({
      user: { id: 'user-1', tenantId: 'tenant-1', role: UserRole.MASTER, professionalProfile } as User,
    });
    renderPage();

    // The appointments request shows the page finished loading its data.
    await screen.findByRole('button', { name: 'General' });
    expect(requestedAlerts()).toBe(false);
    expect(screen.queryByRole('region', { name: 'Alertas clínicas' })).not.toBeInTheDocument();
  });
});

describe('patient detail treating-team wiring', () => {
  it('places the team tab after General and removes only the legacy assignee overview card', async () => {
    renderPage();

    const tabs = screen.getByRole('navigation', { name: 'Tabs' });
    const tabButtons = Array.from(tabs.querySelectorAll('button')).map((button) => button.textContent?.trim());
    expect(tabButtons).toEqual([
      'General',
      'Equipo tratante',
      'Historia Clínica',
      'Registros clínicos',
      'Tratamientos',
      'Archivos',
      'Citas',
      'Actividades',
      'Facturas',
      'Plan de Sesión',
    ]);
    expect(screen.queryByText('Psicólogo Asignado')).not.toBeInTheDocument();
    expect(screen.getByText('Información Personal')).toBeInTheDocument();
    expect(screen.getByText('Contacto de Emergencia')).toBeInTheDocument();
    expect(screen.getByText('Nota clínica preservada')).toBeInTheDocument();
    expect(screen.getByText('Resumen')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Equipo tratante' }));
    expect(await screen.findByRole('heading', { name: 'Equipo tratante' })).toBeInTheDocument();
    expect(mocks.get).toHaveBeenCalledWith('/tenants/tenant-1/patients/patient-1/team');
  });

  it('renders appointment cards from canonical professional and specialty metadata', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Citas' }));

    expect(await screen.findByText('Nutricionista Noa Paz')).toBeInTheDocument();
    expect(screen.getByText('Luis Claro')).toBeInTheDocument();
    expect(screen.getAllByText('Nutrición')).toHaveLength(2);
    expect(screen.queryByText(/Legacy Psych/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Dr\. Noa Paz/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Dr\. Luis Claro/)).not.toBeInTheDocument();
  });
});

describe('patient detail section gating', () => {
  it.each([
    ['Equipo tratante', 'core.patients.team'],
    ['Historia Clínica', 'core.clinical.notes'],
    ['Registros clínicos', 'core.clinical.specialties'],
    ['Tratamientos', 'core.treatments.sessions'],
    ['Archivos', 'core.patients.files'],
    ['Actividades', 'core.agenda.tasks'],
    ['Facturas', 'core.billing.profiles'],
    ['Historia Clínica', 'core.clinical'],
  ])('hides the %s tab when %s is off', (label, key) => {
    mocks.disabledSections = [key];
    renderPage();
    expect(screen.queryByRole('button', { name: label })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'General' })).toBeInTheDocument();
  });

  it('hides Citas when core.agenda.calendar is off and Plan de Sesión when core.clinical.nextSession is off', () => {
    mocks.disabledSections = ['core.agenda.calendar', 'core.clinical.nextSession'];
    renderPage();
    expect(screen.queryByRole('button', { name: 'Citas' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Plan de Sesión' })).not.toBeInTheDocument();
  });

  it('shows the section notice instead of the page when core.patients.records is off', () => {
    mocks.disabledSections = ['core.patients.records'];
    renderPage();
    expect(screen.getByText('Sección no disponible')).toBeInTheDocument();
    expect(screen.queryByText('Información Personal')).not.toBeInTheDocument();
  });
});
