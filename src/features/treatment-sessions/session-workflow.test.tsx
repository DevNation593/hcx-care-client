import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TreatmentSessionDetail } from '@/types/treatments';
import { SessionWorkflow } from './session-workflow';

const PNG = 'data:image/png;base64,iVBORw0KGgo=';

const hooks = vi.hoisted(() => ({
  session: null as unknown,
  presentConsent: vi.fn(),
  signConsent: vi.fn(),
  refuseConsent: vi.fn(),
  revokeConsent: vi.fn(),
  complete: vi.fn(),
  cancel: vi.fn(),
  noShow: vi.fn(),
}));

const mutation = (mutateAsync: unknown) => ({ mutateAsync, isPending: false });
vi.mock('@/hooks/useTreatmentSessions', () => ({
  useTreatmentSession: () => ({ data: hooks.session, isPending: false, isError: false }),
  useSessionCommand: () => ({
    saveForm: mutation(vi.fn()),
    presentConsent: mutation(hooks.presentConsent),
    signConsent: mutation(hooks.signConsent),
    refuseConsent: mutation(hooks.refuseConsent),
    revokeConsent: mutation(hooks.revokeConsent),
    uploadMedia: mutation(vi.fn()),
    start: mutation(vi.fn()),
    complete: mutation(hooks.complete),
    cancel: mutation(hooks.cancel),
    noShow: mutation(hooks.noShow),
  }),
}));

const document = {
  id: 'doc-1',
  treatmentSessionId: 'session-1',
  templateVersionId: 'cv-1',
  title: 'Consentimiento informado',
  body: 'Texto del consentimiento.',
  checksum: 'abcdef0123456789',
  status: 'PRESENTED',
  presentedAt: '2026-10-15T15:00:00.000Z',
  signedAt: null,
  refusedAt: null,
  revokedAt: null,
  pdfChecksum: null,
  createdAt: '2026-10-15T15:00:00.000Z',
};

const session = (overrides: Partial<TreatmentSessionDetail> = {}): TreatmentSessionDetail =>
  ({
    id: 'session-1',
    patientId: 'patient-1',
    status: 'READY_FOR_CONSENT',
    startedAt: null,
    formRecordId: null,
    consentDocumentId: null,
    cancellationReason: null,
    patient: {
      id: 'patient-1',
      firstName: 'Ana',
      lastName: 'Pérez',
      dateOfBirth: '1990-04-02',
      identificationNumber: '1712345678',
      guardianName: null,
      guardianRelationship: null,
      guardianIdentification: null,
    },
    treatment: { id: 'tr-1', name: 'Toxina botulínica', version: 2 },
    policy: {
      medicalForm: { required: false },
      informedConsent: { required: true, validityDays: null },
      photos: { minimumBefore: 0, minimumAfter: 0 },
      clinicalNotes: { requiredForCompletion: false },
    },
    form: null,
    consentDocuments: [],
    media: [],
    requirements: { start: ['SIGNED_APPLICABLE_CONSENT'], complete: [] },
    allowedCommands: ['PRESENT_CONSENT', 'SIGN_CONSENT', 'REFUSE_CONSENT', 'CANCEL', 'NO_SHOW'],
    ...overrides,
  }) as TreatmentSessionDetail;

beforeEach(() => {
  vi.clearAllMocks();
  hooks.session = session();
  hooks.presentConsent.mockResolvedValue(document);
  hooks.signConsent.mockImplementation(async () => {
    const signed = { ...document, status: 'SIGNED', signedAt: '2026-10-15T15:10:00.000Z' };
    // What the refetched detail says once the signature is stored.
    hooks.session = session({
      status: 'CONSENTED',
      consentDocumentId: 'doc-1',
      consentDocuments: [signed] as TreatmentSessionDetail['consentDocuments'],
      requirements: { start: [], complete: [] },
      allowedCommands: ['REVOKE_CONSENT', 'START', 'CANCEL', 'NO_SHOW'],
    });
    return signed;
  });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    clearRect: vi.fn(),
  } as never);
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(PNG);
});
afterEach(() => vi.restoreAllMocks());

const heading = () => screen.getByRole('heading', { level: 2 });
const stepButton = (name: RegExp) => screen.getByRole('button', { name });

describe('SessionWorkflow', () => {
  it('shows the patient, the treatment, the status and the current step', () => {
    render(<SessionWorkflow id="session-1" />);

    expect(screen.getByRole('heading', { name: 'Ana Pérez' })).toBeInTheDocument();
    expect(screen.getByText('Toxina botulínica · versión 2')).toBeInTheDocument();
    expect(screen.getByText('Pendiente de consentimiento')).toBeInTheDocument();
    expect(heading()).toHaveTextContent('Consentimiento');
    expect(stepButton(/^Consentimiento/)).toHaveAttribute('aria-current', 'step');
    expect(stepButton(/^Ficha/)).toBeDisabled();
  });

  it('moves the focus to the next step and announces it after a signature', async () => {
    const { rerender } = render(<SessionWorkflow id="session-1" />);
    await act(async () =>
      fireEvent.click(screen.getByRole('button', { name: 'Mostrar consentimiento al paciente' })),
    );
    fireEvent.click(screen.getByLabelText('Recibí la información y la comprendí'));
    fireEvent.click(screen.getByLabelText('Pude hacer preguntas y fueron respondidas'));
    const pad = screen.getByRole('img', { name: /área para firmar/ });
    fireEvent.pointerDown(pad, { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerUp(pad, { pointerId: 1 });
    expect(screen.queryByText(/Paso actual/)).not.toBeInTheDocument();

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Firmar' })));
    // The query refetches the session after the mutation.
    rerender(<SessionWorkflow id="session-1" />);

    expect(heading()).toHaveTextContent('Procedimiento');
    expect(heading()).toHaveFocus();
    expect(screen.getByText('Paso actual: Procedimiento')).toBeInTheDocument();
  });

  it('returns the focus to the consent and announces the refusal, although the step stays', async () => {
    hooks.refuseConsent.mockImplementation(async () => {
      hooks.session = session({
        status: 'CONSENT_REFUSED',
        consentDocuments: [
          { ...document, status: 'REFUSED', refusedAt: '2026-10-15T15:05:00.000Z' },
        ] as TreatmentSessionDetail['consentDocuments'],
        allowedCommands: [],
      });
    });
    const { rerender } = render(<SessionWorkflow id="session-1" />);
    await act(async () =>
      fireEvent.click(screen.getByRole('button', { name: 'Mostrar consentimiento al paciente' })),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Rechazar' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/Motivo/), { target: { value: 'Prefiere pensarlo' } });
    await act(async () =>
      fireEvent.click(within(dialog).getByRole('button', { name: 'Rechazar consentimiento' })),
    );
    rerender(<SessionWorkflow id="session-1" />);

    expect(hooks.refuseConsent).toHaveBeenCalledWith({ documentId: 'doc-1', reason: 'Prefiere pensarlo' });
    expect(heading()).toHaveTextContent('Consentimiento');
    expect(stepButton(/^Consentimiento/)).toHaveTextContent('Detenido');
    expect(heading()).toHaveFocus();
    expect(
      screen.getByText('Consentimiento rechazado. Paso actual: Consentimiento'),
    ).toBeInTheDocument();
  });

  it('returns the focus to the consent and announces the revocation', async () => {
    const signed = { ...document, status: 'SIGNED', signedAt: '2026-10-15T15:10:00.000Z' };
    hooks.session = session({
      status: 'CONSENTED',
      consentDocumentId: 'doc-1',
      consentDocuments: [signed] as TreatmentSessionDetail['consentDocuments'],
      requirements: { start: [], complete: [] },
      allowedCommands: ['REVOKE_CONSENT', 'START', 'CANCEL', 'NO_SHOW'],
    });
    hooks.revokeConsent.mockImplementation(async () => {
      hooks.session = session({
        status: 'CONSENT_REVOKED',
        consentDocumentId: 'doc-1',
        consentDocuments: [
          { ...signed, status: 'REVOKED', revokedAt: '2026-10-15T15:20:00.000Z' },
        ] as TreatmentSessionDetail['consentDocuments'],
        allowedCommands: [],
      });
    });
    const { rerender } = render(<SessionWorkflow id="session-1" />);
    // The procedure is current; the professional goes back to the consent to revoke it.
    fireEvent.click(stepButton(/^Consentimiento/));
    fireEvent.click(screen.getByRole('button', { name: 'Revocar consentimiento' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/Motivo/), { target: { value: 'Cambió de opinión' } });
    await act(async () =>
      fireEvent.click(within(dialog).getByRole('button', { name: 'Revocar consentimiento' })),
    );
    rerender(<SessionWorkflow id="session-1" />);

    expect(hooks.revokeConsent).toHaveBeenCalledWith({ documentId: 'doc-1', reason: 'Cambió de opinión' });
    expect(heading()).toHaveTextContent('Consentimiento');
    expect(heading()).toHaveFocus();
    expect(
      screen.getByText('Consentimiento revocado. Paso actual: Consentimiento'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Paso actual: Procedimiento')).not.toBeInTheDocument();
  });

  it('leaves the focus alone when the user picks a step', () => {
    render(<SessionWorkflow id="session-1" />);

    fireEvent.click(stepButton(/Cierre/));

    expect(heading()).toHaveTextContent('Cierre');
    expect(heading()).not.toHaveFocus();
    expect(screen.queryByText(/Paso actual/)).not.toBeInTheDocument();
  });

  it('marks the step where an ended session stopped as the current one', () => {
    hooks.session = session({ status: 'NO_SHOW', allowedCommands: [] });
    render(<SessionWorkflow id="session-1" />);

    expect(stepButton(/Consentimiento/)).toHaveAttribute('aria-current', 'step');
    expect(stepButton(/Consentimiento/)).toHaveTextContent('Detenido');
    expect(stepButton(/Cierre/)).toHaveTextContent('Detenido');
  });
  describe('procedure steps', () => {
    const started = (overrides: Partial<TreatmentSessionDetail> = {}) =>
      session({
        status: 'IN_PROGRESS',
        startedAt: '2026-10-15T15:00:00.000Z',
        consentDocumentId: 'doc-1',
        requirements: { start: [], complete: [] },
        allowedCommands: ['UPLOAD_AFTER', 'UPLOAD_OTHER', 'COMPLETE', 'CANCEL'],
        ...overrides,
      });

    it('mounts the photos, the procedure and the summary in their steps', () => {
      hooks.session = started();
      render(<SessionWorkflow id="session-1" />);

      expect(heading()).toHaveTextContent('Procedimiento');
      expect(screen.getByRole('button', { name: 'Cerrar atención' })).toBeInTheDocument();

      fireEvent.click(stepButton(/Fotos antes/));
      expect(heading()).toHaveTextContent('Fotos antes');
      expect(screen.getByLabelText(/Agregar foto de antes/)).toBeDisabled();

      fireEvent.click(stepButton(/Fotos después/));
      expect(screen.getByLabelText(/Agregar foto de después/)).toBeEnabled();

      fireEvent.click(stepButton(/Cierre/));
      expect(heading()).toHaveTextContent('Cierre');
      expect(screen.getByText('Notas del procedimiento')).toBeInTheDocument();
    });

    it('moves the focus to the summary and announces it after closing the session', async () => {
      hooks.session = started();
      hooks.complete.mockImplementation(async () => {
        hooks.session = started({
          status: 'CLINICAL_COMPLETE',
          completedAt: '2026-10-15T16:00:00.000Z',
          allowedCommands: [],
        });
      });
      const { rerender } = render(<SessionWorkflow id="session-1" />);

      await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Cerrar atención' })));
      rerender(<SessionWorkflow id="session-1" />);

      expect(heading()).toHaveTextContent('Cierre');
      expect(heading()).toHaveFocus();
      expect(screen.getByText('Paso actual: Cierre')).toBeInTheDocument();
    });

    it('moves the focus to the summary after cancelling, even when the stepper stays put', async () => {
      hooks.session = started();
      hooks.cancel.mockImplementation(async () => {
        hooks.session = started({
          status: 'CANCELLED',
          cancelledAt: '2026-10-15T16:00:00.000Z',
          cancellationReason: 'Paciente con fiebre',
          allowedCommands: [],
        });
      });
      const { rerender } = render(<SessionWorkflow id="session-1" />);

      await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Cancelar atención' })));
      const dialog = screen.getByRole('dialog');
      fireEvent.change(within(dialog).getByLabelText(/Motivo/), { target: { value: 'Paciente con fiebre' } });
      await act(async () =>
        fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmar cancelación' })),
      );
      rerender(<SessionWorkflow id="session-1" />);

      expect(hooks.cancel).toHaveBeenCalledWith('Paciente con fiebre');
      expect(heading()).toHaveTextContent('Cierre');
      expect(heading()).toHaveFocus();
      expect(screen.getByText('Paso actual: Cierre')).toBeInTheDocument();
    });

    it('moves the focus to the summary after marking a no show', async () => {
      hooks.session = session({
        status: 'CONSENTED',
        consentDocumentId: 'doc-1',
        requirements: { start: [], complete: [] },
        allowedCommands: ['START', 'CANCEL', 'NO_SHOW'],
      });
      hooks.noShow.mockImplementation(async () => {
        hooks.session = session({ status: 'NO_SHOW', requirements: { start: [], complete: [] }, allowedCommands: [] });
      });
      const { rerender } = render(<SessionWorkflow id="session-1" />);

      await act(async () => fireEvent.click(screen.getByRole('button', { name: 'No asistió' })));
      rerender(<SessionWorkflow id="session-1" />);

      expect(heading()).toHaveTextContent('Cierre');
      expect(heading()).toHaveFocus();
    });
  });
});
