import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ConsentDocument,
  ConsentDocumentSummary,
  TreatmentSessionDetail,
} from '@/types/treatments';
import { ConsentStep } from './consent-step';

const PNG = 'data:image/png;base64,iVBORw0KGgo=';

const hooks = vi.hoisted(() => ({
  presentConsent: vi.fn(),
  signConsent: vi.fn(),
  refuseConsent: vi.fn(),
  revokeConsent: vi.fn(),
  consentPdf: vi.fn(),
}));

const mutation = (mutateAsync: unknown) => ({ mutateAsync, isPending: false });
vi.mock('@/hooks/useTreatmentSessions', () => ({
  useSessionCommand: () => ({
    presentConsent: mutation(hooks.presentConsent),
    signConsent: mutation(hooks.signConsent),
    refuseConsent: mutation(hooks.refuseConsent),
    revokeConsent: mutation(hooks.revokeConsent),
  }),
}));
vi.mock('@/lib/api/endpoints', () => ({
  treatmentSessionsApi: { consentPdf: hooks.consentPdf },
}));

const presented: ConsentDocument = {
  id: 'doc-1',
  tenantId: 'tenant-1',
  patientId: 'patient-1',
  treatmentSessionId: 'session-1',
  templateVersionId: 'cv-1',
  title: 'Consentimiento informado para toxina botulínica',
  body: 'Yo, Ana Pérez, declaro haber sido informada de los riesgos del procedimiento.',
  checksum: 'abcdef0123456789abcdef',
  status: 'PRESENTED',
  presentedAt: '2026-10-15T15:00:00.000Z',
  signedAt: null,
  refusedAt: null,
  revokedAt: null,
  pdfChecksum: null,
  createdAt: '2026-10-15T15:00:00.000Z',
  updatedAt: '2026-10-15T15:00:00.000Z',
};

const signedSummary = (overrides: Partial<ConsentDocumentSummary> = {}): ConsentDocumentSummary => ({
  id: 'doc-1',
  treatmentSessionId: 'session-1',
  templateVersionId: 'cv-1',
  title: presented.title,
  checksum: 'abcdef0123456789abcdef',
  status: 'SIGNED',
  presentedAt: '2026-10-15T15:00:00.000Z',
  signedAt: '2026-10-15T15:10:00.000Z',
  refusedAt: null,
  revokedAt: null,
  pdfChecksum: 'f'.repeat(64),
  createdAt: '2026-10-15T15:00:00.000Z',
  ...overrides,
});

const session = (overrides: Partial<TreatmentSessionDetail> = {}): TreatmentSessionDetail =>
  ({
    id: 'session-1',
    status: 'READY_FOR_CONSENT',
    patientId: 'patient-1',
    consentDocumentId: null,
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
    policy: {
      medicalForm: { required: true },
      informedConsent: { required: true, validityDays: null },
      photos: { minimumBefore: 0, minimumAfter: 0 },
      clinicalNotes: { requiredForCompletion: false },
    },
    consentDocuments: [],
    requirements: { start: ['SIGNED_APPLICABLE_CONSENT'], complete: [] },
    allowedCommands: ['SAVE_FORM', 'PRESENT_CONSENT', 'SIGN_CONSENT', 'REFUSE_CONSENT', 'CANCEL'],
    ...overrides,
  }) as TreatmentSessionDetail;

const overflow = { scrollHeight: 0, clientHeight: 0 };

beforeEach(() => {
  vi.clearAllMocks();
  overflow.scrollHeight = 0;
  overflow.clientHeight = 0;
  hooks.presentConsent.mockResolvedValue(presented);
  hooks.signConsent.mockResolvedValue({ ...presented, ...signedSummary(), body: undefined });
  hooks.refuseConsent.mockResolvedValue(undefined);
  hooks.revokeConsent.mockResolvedValue(undefined);
  // jsdom lays nothing out: the reading panel overflows only when a test says so.
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(() => overflow.scrollHeight);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(() => overflow.clientHeight);
  // jsdom has no canvas: the drawn signature is a fixed image.
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

const click = (name: string | RegExp) =>
  act(async () => fireEvent.click(screen.getByRole('button', { name })));
const pad = () => screen.queryByRole('img', { name: /área para firmar/ });

async function present(detail = session()) {
  render(<ConsentStep session={detail} />);
  await click('Mostrar consentimiento al paciente');
}

function fillAndDraw() {
  fireEvent.click(screen.getByLabelText('Recibí la información y la comprendí'));
  fireEvent.click(screen.getByLabelText('Pude hacer preguntas y fueron respondidas'));
  fireEvent.pointerDown(pad()!, { clientX: 10, clientY: 10, pointerId: 1 });
  fireEvent.pointerUp(pad()!, { pointerId: 1 });
}

describe('ConsentStep', () => {
  it('presents the consent and shows its text in a reading panel', async () => {
    await present();

    expect(hooks.presentConsent).toHaveBeenCalledTimes(1);
    const panel = screen.getByRole('document', { name: 'Texto del consentimiento' });
    expect(within(panel).getByText(presented.title)).toBeInTheDocument();
    expect(within(panel).getByText(presented.body!)).toBeInTheDocument();
  });

  it('shows the signing form only after the text is scrolled to the end', async () => {
    overflow.scrollHeight = 1000;
    overflow.clientHeight = 300;
    await present();

    expect(pad()).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Firmar' })).not.toBeInTheDocument();

    const panel = screen.getByRole('document', { name: 'Texto del consentimiento' });
    Object.defineProperty(panel, 'scrollTop', { value: 300, configurable: true });
    fireEvent.scroll(panel);
    expect(pad()).not.toBeInTheDocument();

    Object.defineProperty(panel, 'scrollTop', { value: 700, configurable: true });
    fireEvent.scroll(panel);
    expect(pad()).toBeInTheDocument();
  });

  it('shows the signing form at once when the text does not overflow', async () => {
    await present();

    expect(pad()).toBeInTheDocument();
  });

  it('draws on the true 3:1 surface at full width, without a fixed height', async () => {
    await present();

    expect(pad()).toHaveAttribute('width', '600');
    expect(pad()).toHaveAttribute('height', '200');
    expect(pad()).toHaveClass('w-full', 'aspect-[3/1]');
    expect(pad()!.className).not.toMatch(/\bh-\[|max-w-/);
  });

  it('keeps the signer within the limits of the API', async () => {
    await present();
    fillAndDraw();
    const name = screen.getByLabelText(/Nombre de quien firma/);

    fireEvent.change(name, { target: { value: ' A ' } });
    expect(screen.getByText('El nombre debe tener al menos 2 caracteres.')).toBeInTheDocument();
    expect(name).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('button', { name: 'Firmar' })).toBeDisabled();

    fireEvent.change(name, { target: { value: 'Al' } });
    expect(screen.queryByText(/al menos 2 caracteres/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Firmar' })).toBeEnabled();

    expect(name).toHaveAttribute('maxLength', '200');
    expect(screen.getByLabelText('Identificación')).toHaveAttribute('maxLength', '30');
    fireEvent.change(screen.getByLabelText('Identificación'), { target: { value: '1'.repeat(31) } });
    expect(screen.getByText('La identificación admite hasta 30 caracteres.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Firmar' })).toBeDisabled();
  });

  it('signs with the declarations and the drawn PNG, and says "Firmado" once the server answers', async () => {
    await present();

    // Prefilled from the patient, who is an adult.
    expect(screen.getByLabelText('Firma como')).toHaveValue('PATIENT');
    expect(screen.getByLabelText(/Nombre de quien firma/)).toHaveValue('Ana Pérez');
    expect(screen.getByLabelText('Identificación')).toHaveValue('1712345678');
    const sign = screen.getByRole('button', { name: 'Firmar' });
    expect(sign).toBeDisabled();

    fillAndDraw();
    expect(sign).toBeEnabled();
    await click('Firmar');

    expect(hooks.signConsent).toHaveBeenCalledWith({
      documentId: 'doc-1',
      input: {
        signerRole: 'PATIENT',
        signerName: 'Ana Pérez',
        signerIdentification: '1712345678',
        understood: true,
        questionsAnswered: true,
        marketingPhotos: false,
        signature: PNG,
      },
    });
    expect(screen.getByText('Firmado')).toBeInTheDocument();
    expect(screen.getByText(/Ana Pérez · Paciente/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Descargar PDF' })).toBeInTheDocument();
  });

  it('never says "Firmado" when the signature fails, and keeps the form filled with the error', async () => {
    hooks.signConsent.mockRejectedValue({
      message: 'No se recibió respuesta del servidor. Verifica tu conexión a internet.',
    });
    await present();
    fillAndDraw();
    await click('Firmar');

    expect(screen.queryByText('Firmado')).not.toBeInTheDocument();
    expect(screen.getByText(/No se recibió respuesta del servidor/)).toBeInTheDocument();
    expect(screen.getByLabelText('Recibí la información y la comprendí')).toBeChecked();
    expect(screen.getByLabelText('Pude hacer preguntas y fueron respondidas')).toBeChecked();
    expect(screen.getByLabelText(/Nombre de quien firma/)).toHaveValue('Ana Pérez');
    expect(screen.getByRole('button', { name: 'Firmar' })).toBeEnabled();
  });

  it('has a representative sign for a minor, prefilled from the guardian', async () => {
    const year = new Date().getFullYear() - 10;
    await present(
      session({
        patient: {
          ...session().patient,
          dateOfBirth: `${year}-01-01`,
          guardianName: 'Luis Pérez',
          guardianRelationship: 'Padre',
          guardianIdentification: '1700000001',
        },
      }),
    );
    fillAndDraw();
    await click('Firmar');

    expect(hooks.signConsent).toHaveBeenCalledWith({
      documentId: 'doc-1',
      input: expect.objectContaining({
        signerRole: 'REPRESENTATIVE',
        signerName: 'Luis Pérez',
        signerIdentification: '1700000001',
        relationship: 'Padre',
      }),
    });
  });

  it('asks for a reason to refuse', async () => {
    await present();
    await click('Rechazar');

    const dialog = screen.getByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: 'Rechazar consentimiento' });
    expect(confirm).toBeDisabled();
    expect(within(dialog).getByLabelText(/Motivo/)).toHaveAttribute('maxLength', '1000');
    fireEvent.change(within(dialog).getByLabelText(/Motivo/), { target: { value: ' No ' } });
    expect(within(dialog).getByText('El motivo debe tener al menos 3 caracteres.')).toBeInTheDocument();
    expect(confirm).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText(/Motivo/), {
      target: { value: ' Prefiere pensarlo ' },
    });
    await act(async () => fireEvent.click(confirm));

    expect(hooks.refuseConsent).toHaveBeenCalledWith({ documentId: 'doc-1', reason: 'Prefiere pensarlo' });
  });

  it('shows a signed document with its time, checksum and PDF', async () => {
    const pdf = new Blob(['%PDF'], { type: 'application/pdf' });
    hooks.consentPdf.mockResolvedValue(pdf);
    const createObjectURL = vi.fn(() => 'blob:consent');
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
    // jsdom cannot follow the download link.
    const follow = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    render(
      <ConsentStep
        session={session({
          status: 'CONSENTED',
          consentDocumentId: 'doc-1',
          consentDocuments: [signedSummary()],
          allowedCommands: ['REVOKE_CONSENT', 'START'],
        })}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Mostrar consentimiento al paciente' })).not.toBeInTheDocument();
    expect(screen.getByText('Firmado')).toBeInTheDocument();
    expect(screen.getByText(/abcdef012345/)).toBeInTheDocument();
    // No clinic zone in the answer: the device zone, named.
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    expect(screen.getByText(new RegExp(`2026.*\\(${zone.replace('/', '\\/')}\\)`))).toBeInTheDocument();

    await click('Descargar PDF');
    expect(hooks.consentPdf).toHaveBeenCalledWith('doc-1');
    expect(createObjectURL).toHaveBeenCalledWith(pdf);
    expect(follow).toHaveBeenCalledTimes(1);
  });

  it('shows the signer the API reports and the time in the clinic zone', () => {
    render(
      <ConsentStep
        session={session({
          status: 'CONSENTED',
          consentDocumentId: 'doc-1',
          timezone: 'America/Guayaquil',
          consentDocuments: [
            signedSummary({
              signature: { signerName: 'Luis Pérez', signerRole: 'REPRESENTATIVE', relationship: 'Padre' },
            }),
          ],
          allowedCommands: ['REVOKE_CONSENT', 'START'],
        })}
      />,
    );

    expect(screen.getByText('Luis Pérez · Representante legal (Padre)')).toBeInTheDocument();
    // 15:10 UTC is 10:10 in Guayaquil (UTC-5, no daylight saving).
    expect(screen.getByText(/15 de octubre de 2026.*10:10.*\(America\/Guayaquil\)/)).toBeInTheDocument();
  });

  it('shows the signer the sign response returned before the session reloads', async () => {
    hooks.signConsent.mockResolvedValue({
      ...presented,
      ...signedSummary(),
      body: undefined,
      signature: { signerName: 'Ana María Pérez', signerRole: 'PATIENT', relationship: null },
    });
    await present();
    fillAndDraw();
    await click('Firmar');

    expect(screen.getByText('Ana María Pérez · Paciente')).toBeInTheDocument();
  });

  it('revokes a signed consent with a reason', async () => {
    render(
      <ConsentStep
        session={session({
          status: 'CONSENTED',
          consentDocumentId: 'doc-1',
          consentDocuments: [signedSummary()],
          allowedCommands: ['REVOKE_CONSENT', 'START'],
        })}
      />,
    );
    await click('Revocar consentimiento');

    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/Motivo/), { target: { value: 'Cambió de opinión' } });
    await act(async () =>
      fireEvent.click(within(dialog).getByRole('button', { name: 'Revocar consentimiento' })),
    );

    expect(hooks.revokeConsent).toHaveBeenCalledWith({ documentId: 'doc-1', reason: 'Cambió de opinión' });
  });

  it('does not offer revoking without the command, and shows a refused document as such', () => {
    render(
      <ConsentStep
        session={session({
          status: 'CONSENT_REFUSED',
          consentDocuments: [signedSummary({ status: 'REFUSED', signedAt: null, refusedAt: '2026-10-15T15:05:00.000Z' })],
          allowedCommands: [],
        })}
      />,
    );

    expect(screen.getByText('Rechazado')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Revocar consentimiento' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mostrar consentimiento al paciente' })).not.toBeInTheDocument();
  });
});
