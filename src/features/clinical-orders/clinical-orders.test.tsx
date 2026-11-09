import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/store/authStore';
import type { ClinicalInbox, ClinicalOrder, ClinicalResult } from '@/types/clinical-orders';
import { ClinicalInboxView } from './clinical-inbox';
import { ClinicalOrdersTab } from './clinical-orders-tab';
import { availableActions } from './order-actions';

const hooks = vi.hoisted(() => ({
  orders: [] as unknown[],
  followUps: [] as unknown[],
  encounters: [] as unknown[],
  inbox: undefined as unknown,
  inboxScope: [] as string[],
  create: vi.fn(),
  review: vi.fn(),
  result: vi.fn(),
  complete: vi.fn(),
  closeFollowUp: vi.fn(),
  createError: null as unknown,
}));

const mutation = (fn: ReturnType<typeof vi.fn>, error: unknown = null) => ({
  mutate: fn,
  isPending: false,
  error,
});

vi.mock('@/hooks/useClinicalOrders', () => ({
  usePatientClinicalOrders: () => ({ data: hooks.orders, isLoading: false, isError: false }),
  usePatientClinicalFollowUps: () => ({ data: hooks.followUps }),
  useClinicalInbox: (scope: string) => {
    hooks.inboxScope.push(scope);
    return { data: hooks.inbox, isLoading: false, isError: false };
  },
  useCreateClinicalOrder: () => mutation(hooks.create, hooks.createError),
  useCreateClinicalFollowUp: () => mutation(vi.fn()),
  useCollectSample: () => mutation(vi.fn()),
  useSendToLab: () => mutation(vi.fn()),
  useAddClinicalResult: () => mutation(hooks.result),
  useReviewClinicalResult: () => mutation(hooks.review),
  useCommunicateClinicalResult: () => mutation(vi.fn()),
  useCompleteClinicalOrder: () => mutation(hooks.complete),
  useCancelClinicalOrder: () => mutation(vi.fn()),
  useCloseClinicalFollowUp: () => mutation(hooks.closeFollowUp),
}));
vi.mock('@/hooks/useEncounters', () => ({
  usePatientEncounters: () => ({ data: hooks.encounters }),
}));
vi.mock('@/hooks/useBranches', () => ({
  useClinicProfessionals: () => ({
    data: [
      { id: 'me', firstName: 'Ana', lastName: 'Gómez' },
      { id: 'colleague', firstName: 'Luis', lastName: 'Mora' },
    ],
  }),
}));
vi.mock('@/hooks/usePatientFiles', () => ({ usePatientFiles: () => ({ data: [] }) }));

const result = (overrides: Partial<ClinicalResult> = {}): ClinicalResult => ({
  id: 'result-1',
  orderId: 'order-1',
  patientId: 'patient-1',
  version: 1,
  enteredById: 'me',
  enteredBy: null,
  receivedAt: '2026-11-08T12:00:00.000Z',
  studyDate: null,
  issuedBy: null,
  content: 'Negativo para lesión intraepitelial.',
  fileId: null,
  file: null,
  recordId: null,
  contentHash: 'v1:x',
  status: 'PENDING_REVIEW',
  reviewedAt: null,
  reviewedById: null,
  reviewedBy: null,
  reviewDecision: null,
  reviewNote: null,
  appointmentNeeded: false,
  communicatedAt: null,
  communicatedById: null,
  communicationChannel: null,
  communicationNote: null,
  ...overrides,
});

const order = (overrides: Partial<ClinicalOrder> = {}): ClinicalOrder => ({
  id: 'order-1',
  patientId: 'patient-1',
  orderedById: 'me',
  orderedBy: { id: 'me', firstName: 'Ana', lastName: 'Gómez' },
  encounterId: null,
  orderType: 'PATHOLOGY',
  priority: 'ROUTINE',
  studyName: 'Citología cervicovaginal',
  indication: 'Tamizaje',
  provider: null,
  externalReference: null,
  status: 'ORDERED',
  orderedAt: '2026-11-01T12:00:00.000Z',
  resultDueAt: null,
  sampleCollectedAt: null,
  sampleNotes: null,
  sentAt: null,
  completedAt: null,
  completionNote: null,
  cancelledAt: null,
  cancellationReason: null,
  signedAt: '2026-11-01T12:00:00.000Z',
  version: 1,
  results: [],
  currentResult: null,
  followUps: [],
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  hooks.orders = [];
  hooks.followUps = [];
  hooks.encounters = [];
  hooks.inbox = undefined;
  hooks.inboxScope = [];
  hooks.createError = null;
  useAuthStore.setState({ user: { id: 'me', tenantId: 'tenant-1' } as never });
});

describe('availableActions', () => {
  it('offers each status only the steps the API accepts', () => {
    expect(availableActions(order({ status: 'ORDERED' }))).toEqual(['sample', 'send', 'result', 'cancel']);
    expect(availableActions(order({ status: 'PENDING_REVIEW' }))).toEqual(['review', 'result']);
    // A reviewed result cannot be closed nor cancelled straight from reception: it has a review.
    expect(availableActions(order({ status: 'REVIEWED' }))).toEqual(['communicate', 'complete', 'result']);
    expect(availableActions(order({ status: 'COMPLETED' }))).toEqual([]);
    expect(availableActions(order({ status: 'CANCELLED' }))).toEqual([]);
  });
});

describe('ClinicalOrdersTab', () => {
  it('shows a received result as pending review, not as informed', () => {
    const pending = result();
    hooks.orders = [order({ status: 'PENDING_REVIEW', results: [pending], currentResult: pending })];

    render(<ClinicalOrdersTab patientId="patient-1" />);

    expect(screen.getByText('Resultado por revisar')).toBeInTheDocument();
    expect(screen.getByText('Pendiente de revisión')).toBeInTheDocument();
    expect(screen.queryByText(/Informado al paciente/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cerrar orden' })).not.toBeInTheDocument();
  });

  it('signs a new order with the password when no encounter is open', async () => {
    render(<ClinicalOrdersTab patientId="patient-1" />);
    fireEvent.click(screen.getByRole('button', { name: /Nueva orden/ }));

    fireEvent.change(screen.getByLabelText(/Estudio o procedimiento/), {
      target: { value: ' Ecografía transvaginal ' },
    });
    const save = screen.getByRole('button', { name: 'Guardar y firmar' });
    expect(save).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Tu contraseña para firmar/), { target: { value: 'secret' } });
    await act(async () => fireEvent.click(save));

    expect(hooks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        studyName: 'Ecografía transvaginal',
        orderType: 'LABORATORY',
        encounterId: undefined,
        password: 'secret',
      }),
      expect.anything(),
    );
  });

  it('places the order in the open encounter of the professional, without a password', async () => {
    hooks.encounters = [{ id: 'encounter-1', status: 'OPEN', professionalId: 'me' }];
    render(<ClinicalOrdersTab patientId="patient-1" />);
    fireEvent.click(screen.getByRole('button', { name: /Nueva orden/ }));

    expect(screen.queryByLabelText(/Tu contraseña para firmar/)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Estudio o procedimiento/), { target: { value: 'Hemograma' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Guardar orden' })));

    expect(hooks.create).toHaveBeenCalledWith(
      expect.objectContaining({ encounterId: 'encounter-1', password: undefined }),
      expect.anything(),
    );
  });

  it('asks who and when for the follow-up a review decides', async () => {
    const pending = result();
    hooks.orders = [order({ status: 'PENDING_REVIEW', version: 3, results: [pending], currentResult: pending })];
    render(<ClinicalOrdersTab patientId="patient-1" />);

    fireEvent.click(screen.getByRole('button', { name: 'Revisar resultado' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/Decisión/), { target: { value: 'REPEAT_REQUIRED' } });
    fireEvent.change(within(dialog).getByLabelText(/Conducta/), { target: { value: 'Muestra inadecuada' } });
    const submit = within(dialog).getByRole('button', { name: 'Revisar resultado' });
    expect(submit).toBeDisabled();

    fireEvent.change(within(dialog).getByLabelText(/Qué hay que hacer/), { target: { value: 'Repetir citología' } });
    fireEvent.change(within(dialog).getByLabelText(/Fecha objetivo/), { target: { value: '2027-01-15' } });
    fireEvent.change(within(dialog).getByLabelText(/Responsable/), { target: { value: 'colleague' } });
    await act(async () => fireEvent.click(submit));

    expect(hooks.review).toHaveBeenCalledWith(
      {
        resultId: 'result-1',
        decision: 'REPEAT_REQUIRED',
        note: 'Muestra inadecuada',
        appointmentNeeded: false,
        followUp: {
          title: 'Repetir citología',
          dueDate: '2027-01-15T12:00:00.000Z',
          assignedToId: 'colleague',
        },
      },
      expect.anything(),
    );
  });

  it('asks why an order is closed when the patient contact was not recorded', async () => {
    const reviewed = result({ status: 'REVIEWED', reviewedAt: '2026-11-08T13:00:00.000Z', reviewDecision: 'NO_FURTHER_ACTION' });
    hooks.orders = [order({ status: 'REVIEWED', version: 4, results: [reviewed], currentResult: reviewed })];
    render(<ClinicalOrdersTab patientId="patient-1" />);

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar orden' }));
    const dialog = screen.getByRole('dialog');
    const close = within(dialog).getByRole('button', { name: 'Cerrar orden' });
    expect(close).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText(/Por qué se cierra/), {
      target: { value: 'Informada en la consulta de control' },
    });
    await act(async () => fireEvent.click(close));

    expect(hooks.complete).toHaveBeenCalledWith(
      { orderId: 'order-1', version: 4, note: 'Informada en la consulta de control' },
      expect.anything(),
    );
  });
});

describe('ClinicalInboxView', () => {
  const inboxOrder = {
    id: 'order-1',
    patientId: 'patient-1',
    orderType: 'PATHOLOGY' as const,
    priority: 'URGENT' as const,
    studyName: 'Biopsia de cérvix',
    provider: null,
    externalReference: null,
    status: 'SENT_TO_LAB' as const,
    orderedAt: '2026-10-01T12:00:00.000Z',
    resultDueAt: '2026-10-15T00:00:00.000Z',
    sentAt: null,
    version: 2,
    orderedBy: { id: 'me', firstName: 'Ana', lastName: 'Gómez' },
    patient: { id: 'patient-1', firstName: 'Lucía', lastName: 'Mora' },
  };

  it('lists what waits, flags what is overdue and switches to the whole clinic', () => {
    const inbox: ClinicalInbox = {
      scope: 'mine',
      thresholds: { resultReviewAlertDays: 3, orderResultAlertDays: 15 },
      pendingReview: [],
      awaitingResult: [{ ...inboxOrder, overdue: true }],
      toCommunicate: [],
      followUps: [],
    };
    hooks.inbox = inbox;

    render(<ClinicalInboxView />);

    expect(screen.getByText('Lucía Mora')).toHaveAttribute('href', '/patients/patient-1?tab=orders');
    expect(screen.getByText('Vencido')).toBeInTheDocument();
    expect(screen.getByText('Urgente')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Todo el consultorio' }));
    expect(hooks.inboxScope.at(-1)).toBe('all');
  });
});
