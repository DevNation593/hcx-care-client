import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionCommandName, TreatmentSessionDetail } from '@/types/treatments';
import { ProcedureStep } from './procedure-step';

const hooks = vi.hoisted(() => ({
  start: vi.fn(),
  complete: vi.fn(),
  cancel: vi.fn(),
  noShow: vi.fn(),
}));

const mutation = (mutateAsync: unknown) => ({ mutateAsync, isPending: false });
vi.mock('@/hooks/useTreatmentSessions', () => ({
  useSessionCommand: () => ({
    start: mutation(hooks.start),
    complete: mutation(hooks.complete),
    cancel: mutation(hooks.cancel),
    noShow: mutation(hooks.noShow),
  }),
}));

const session = (overrides: Partial<TreatmentSessionDetail> = {}): TreatmentSessionDetail =>
  ({
    id: 'session-1',
    status: 'CONSENTED',
    procedureNotes: null,
    policy: {
      medicalForm: { required: false },
      informedConsent: { required: true, validityDays: null },
      photos: { minimumBefore: 0, minimumAfter: 0 },
      clinicalNotes: { requiredForCompletion: true },
    },
    allowedCommands: ['START', 'CANCEL', 'NO_SHOW'],
    ...overrides,
  }) as TreatmentSessionDetail;

const inProgress = (commands: SessionCommandName[] = ['UPLOAD_AFTER', 'COMPLETE', 'CANCEL']) =>
  session({ status: 'IN_PROGRESS', startedAt: '2026-10-15T15:00:00.000Z', allowedCommands: commands });

const click = (name: string | RegExp) =>
  act(async () => fireEvent.click(screen.getByRole('button', { name })));

beforeEach(() => {
  vi.clearAllMocks();
  hooks.start.mockResolvedValue({});
  hooks.complete.mockResolvedValue({});
  hooks.cancel.mockResolvedValue({});
  hooks.noShow.mockResolvedValue({});
});

describe('ProcedureStep start', () => {
  it('starts the procedure when START is allowed', async () => {
    render(<ProcedureStep session={session()} />);

    await click('Iniciar procedimiento');

    expect(hooks.start).toHaveBeenCalledTimes(1);
  });

  it('disables the start button and says why when START is not allowed', () => {
    render(<ProcedureStep session={session({ status: 'READY_FOR_CONSENT', allowedCommands: ['CANCEL'] })} />);

    expect(screen.getByRole('button', { name: 'Iniciar procedimiento' })).toBeDisabled();
    expect(screen.getByText(/cuando termines los pasos anteriores/)).toBeInTheDocument();
  });

  it('lists every missing requirement of a 422 with its label', async () => {
    hooks.start.mockRejectedValue({
      status: 422,
      message: 'Faltan requisitos',
      missing: ['SIGNED_APPLICABLE_CONSENT', 'BEFORE_PHOTOS'],
    });
    render(<ProcedureStep session={session()} />);

    await click('Iniciar procedimiento');

    const alert = screen.getByRole('alert');
    expect(within(alert).getByText('Falta el consentimiento firmado')).toBeInTheDocument();
    expect(within(alert).getByText('Faltan fotos de antes')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Iniciar procedimiento' })).toBeEnabled();
  });

  it('shows the message of a 409', async () => {
    hooks.start.mockRejectedValue({
      status: 409,
      message: 'La atención cambió de estado',
      code: 'TREATMENT_SESSION_INVALID_TRANSITION',
    });
    render(<ProcedureStep session={session()} />);

    await click('Iniciar procedimiento');

    expect(screen.getByRole('alert')).toHaveTextContent('La atención cambió de estado');
  });

  it('clears the previous failure when trying again', async () => {
    hooks.start.mockRejectedValueOnce({ status: 422, message: 'x', missing: ['BEFORE_PHOTOS'] });
    render(<ProcedureStep session={session()} />);
    await click('Iniciar procedimiento');
    expect(screen.getByRole('alert')).toBeInTheDocument();

    await click('Iniciar procedimiento');

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('ProcedureStep close', () => {
  it('shows the notes and the close button only while in progress', () => {
    const { rerender } = render(<ProcedureStep session={session()} />);
    expect(screen.queryByLabelText(/Notas del procedimiento/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cerrar atención' })).not.toBeInTheDocument();

    rerender(<ProcedureStep session={inProgress()} />);

    expect(screen.getByLabelText(/Notas del procedimiento/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cerrar atención' })).toBeEnabled();
  });

  it('sends the typed notes and tells the page the session is done', async () => {
    const onDone = vi.fn();
    render(<ProcedureStep session={inProgress()} onDone={onDone} />);

    fireEvent.change(screen.getByLabelText(/Notas del procedimiento/), {
      target: { value: '  Se aplicaron 20 unidades en la frente.  ' },
    });
    await click('Cerrar atención');

    expect(hooks.complete).toHaveBeenCalledWith('Se aplicaron 20 unidades en la frente.');
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('sends no notes when none were typed and leaves the decision to the API', async () => {
    render(<ProcedureStep session={inProgress()} />);

    await click('Cerrar atención');

    expect(hooks.complete).toHaveBeenCalledWith(undefined);
  });

  it('keeps the typed notes and the page where it is when the API blocks the close', async () => {
    const onDone = vi.fn();
    hooks.complete.mockRejectedValue({
      status: 422,
      message: 'Faltan requisitos',
      missing: ['CLINICAL_NOTES', 'AFTER_PHOTOS'],
    });
    render(<ProcedureStep session={inProgress()} onDone={onDone} />);
    fireEvent.change(screen.getByLabelText(/Notas del procedimiento/), { target: { value: 'ok' } });

    await click('Cerrar atención');

    const alert = screen.getByRole('alert');
    expect(within(alert).getByText('Faltan las notas del procedimiento')).toBeInTheDocument();
    expect(within(alert).getByText('Faltan fotos de después')).toBeInTheDocument();
    expect(screen.getByLabelText(/Notas del procedimiento/)).toHaveValue('ok');
    expect(onDone).not.toHaveBeenCalled();
  });

  it('disables the close button when COMPLETE is not allowed', () => {
    render(<ProcedureStep session={inProgress(['CANCEL'])} />);

    expect(screen.getByRole('button', { name: 'Cerrar atención' })).toBeDisabled();
  });
});

describe('ProcedureStep cancel and no show', () => {
  it('asks for a reason of 3 to 1000 characters and sends it', async () => {
    const onDone = vi.fn();
    render(<ProcedureStep session={session()} onDone={onDone} />);
    await click('Cancelar atención');

    const dialog = screen.getByRole('dialog', { name: 'Cancelar atención' });
    const confirm = within(dialog).getByRole('button', { name: 'Confirmar cancelación' });
    expect(confirm).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText(/Motivo/), { target: { value: 'ab' } });
    expect(confirm).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText(/Motivo/), {
      target: { value: '  La paciente pidió reprogramar  ' },
    });
    await act(async () => fireEvent.click(confirm));

    expect(hooks.cancel).toHaveBeenCalledWith('La paciente pidió reprogramar');
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('keeps the dialog open with the API message when the cancellation fails', async () => {
    hooks.cancel.mockRejectedValue({ status: 409, message: 'La atención ya terminó' });
    render(<ProcedureStep session={session()} />);
    await click('Cancelar atención');

    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/Motivo/), { target: { value: 'Motivo válido' } });
    await act(async () =>
      fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmar cancelación' })),
    );

    expect(within(dialog).getByRole('alert')).toHaveTextContent('La atención ya terminó');
    expect(within(dialog).getByLabelText(/Motivo/)).toHaveValue('Motivo válido');
  });

  it('registers a no show and tells the page', async () => {
    const onDone = vi.fn();
    render(<ProcedureStep session={session()} onDone={onDone} />);

    await click('No asistió');

    expect(hooks.noShow).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('shows No asistió only while NO_SHOW is allowed', () => {
    render(<ProcedureStep session={inProgress()} />);

    expect(screen.queryByRole('button', { name: 'No asistió' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar atención' })).toBeInTheDocument();
  });

  it('offers no action once the session ended', () => {
    render(<ProcedureStep session={session({ status: 'CANCELLED', allowedCommands: [] })} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText(/Cancelada: esta atención ya no admite cambios/)).toBeInTheDocument();
  });
});
