import { useState } from 'react';
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

// A mutation that reports isPending while its promise is unsettled, like the real one.
vi.mock('@/hooks/useTreatmentSessions', async () => {
  const { useState: useLocalState } = await import('react');
  const useMutation = (run: (input?: unknown) => Promise<unknown>) => {
    const [isPending, setPending] = useLocalState(false);
    return {
      isPending,
      mutateAsync: async (input?: unknown) => {
        setPending(true);
        try {
          return await run(input);
        } finally {
          setPending(false);
        }
      },
    };
  };
  return {
    useSessionCommand: () => ({
      start: useMutation((input) => hooks.start(input)),
      complete: useMutation((input) => hooks.complete(input)),
      cancel: useMutation((input) => hooks.cancel(input)),
      noShow: useMutation((input) => hooks.noShow(input)),
    }),
  };
});

/** The page keeps the notes; this stands in for it. */
function Step({
  session: detail,
  onDone,
  initialNotes = '',
}: {
  session: TreatmentSessionDetail;
  onDone?: () => void;
  initialNotes?: string;
}) {
  const [notes, setNotes] = useState(initialNotes);
  return <ProcedureStep session={detail} notes={notes} onNotesChange={setNotes} onDone={onDone} />;
}

const deferred = () => {
  let resolve!: (value?: unknown) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

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
    requirements: { start: [], complete: [] },
    allowedCommands: ['START', 'CANCEL', 'NO_SHOW'],
    ...overrides,
  }) as TreatmentSessionDetail;

const inProgress = (commands: SessionCommandName[] = ['UPLOAD_AFTER', 'COMPLETE', 'CANCEL']) =>
  session({ status: 'IN_PROGRESS', startedAt: '2026-10-15T15:00:00.000Z', allowedCommands: commands });

const click = (name: string | RegExp) =>
  act(async () => fireEvent.click(screen.getByRole('button', { name })));
const confirm = async (name: string) => {
  const dialog = screen.getByRole('dialog');
  await act(async () => fireEvent.click(within(dialog).getByRole('button', { name })));
};

beforeEach(() => {
  vi.clearAllMocks();
  hooks.start.mockResolvedValue({});
  hooks.complete.mockResolvedValue({});
  hooks.cancel.mockResolvedValue({});
  hooks.noShow.mockResolvedValue({});
});

describe('ProcedureStep start', () => {
  it('starts the procedure when START is allowed', async () => {
    render(<Step session={session()} />);

    await click('Iniciar procedimiento');

    expect(hooks.start).toHaveBeenCalledTimes(1);
  });

  it('says everything is ready only when nothing is missing to start', () => {
    render(<Step session={session()} />);

    expect(screen.getByText(/Todo está listo/)).toBeInTheDocument();
  });

  it('does not claim it is ready while the API still lists pending requirements', () => {
    render(
      <Step
        session={session({ requirements: { start: ['BEFORE_PHOTOS'], complete: [] } })}
      />,
    );

    expect(screen.queryByText(/Todo está listo/)).not.toBeInTheDocument();
    expect(screen.getByText('Revisa los pendientes antes de iniciar.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Iniciar procedimiento' })).toBeEnabled();
  });

  it('disables the start button while the start is pending and sends it once', async () => {
    const pending = deferred();
    hooks.start.mockReturnValue(pending.promise);
    render(<Step session={session()} />);

    await click('Iniciar procedimiento');

    const button = screen.getByRole('button', { name: 'Iniciar procedimiento' });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(hooks.start).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'No asistió' })).toBeDisabled();

    await act(async () => pending.resolve({}));
    expect(screen.getByRole('button', { name: 'Iniciar procedimiento' })).toBeEnabled();
  });

  it('disables the start button and says why when START is not allowed', () => {
    render(<Step session={session({ status: 'READY_FOR_CONSENT', allowedCommands: ['CANCEL'] })} />);

    expect(screen.getByRole('button', { name: 'Iniciar procedimiento' })).toBeDisabled();
    expect(screen.getByText(/cuando termines los pasos anteriores/)).toBeInTheDocument();
  });

  it('lists every missing requirement of a 422 with its label', async () => {
    hooks.start.mockRejectedValue({
      status: 422,
      message: 'Faltan requisitos',
      missing: ['SIGNED_APPLICABLE_CONSENT', 'BEFORE_PHOTOS'],
    });
    render(<Step session={session()} />);

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
    render(<Step session={session()} />);

    await click('Iniciar procedimiento');

    expect(screen.getByRole('alert')).toHaveTextContent('La atención cambió de estado');
  });

  it('clears the previous failure when trying again', async () => {
    hooks.start.mockRejectedValueOnce({ status: 422, message: 'x', missing: ['BEFORE_PHOTOS'] });
    render(<Step session={session()} />);
    await click('Iniciar procedimiento');
    expect(screen.getByRole('alert')).toBeInTheDocument();

    await click('Iniciar procedimiento');

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('ProcedureStep close', () => {
  it('shows the notes and the close button only while in progress', () => {
    const { rerender } = render(<Step session={session()} />);
    expect(screen.queryByLabelText(/Notas del procedimiento/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cerrar atención' })).not.toBeInTheDocument();

    rerender(<Step session={inProgress()} />);

    expect(screen.getByLabelText(/Notas del procedimiento/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cerrar atención' })).toBeEnabled();
  });

  it('asks for confirmation before closing and does not call the API when the user goes back', async () => {
    render(<Step session={inProgress()} />);

    await click('Cerrar atención');

    const dialog = screen.getByRole('dialog', { name: 'Cerrar atención' });
    expect(hooks.complete).not.toHaveBeenCalled();
    await act(async () => fireEvent.click(within(dialog).getByRole('button', { name: 'Volver' })));

    expect(hooks.complete).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('sends the typed notes after the confirmation and tells the page the session is done', async () => {
    const onDone = vi.fn();
    render(<Step session={inProgress()} onDone={onDone} />);

    fireEvent.change(screen.getByLabelText(/Notas del procedimiento/), {
      target: { value: '  Se aplicaron 20 unidades en la frente.  ' },
    });
    await click('Cerrar atención');
    await confirm('Confirmar cierre');

    expect(hooks.complete).toHaveBeenCalledWith('Se aplicaron 20 unidades en la frente.');
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('sends no notes when none were typed and leaves the decision to the API', async () => {
    render(<Step session={inProgress()} />);

    await click('Cerrar atención');
    await confirm('Confirmar cierre');

    expect(hooks.complete).toHaveBeenCalledWith(undefined);
  });

  it('keeps the typed notes and the page where it is when the API blocks the close', async () => {
    const onDone = vi.fn();
    hooks.complete.mockRejectedValue({
      status: 422,
      message: 'Faltan requisitos',
      missing: ['CLINICAL_NOTES', 'AFTER_PHOTOS'],
    });
    render(<Step session={inProgress()} onDone={onDone} />);
    fireEvent.change(screen.getByLabelText(/Notas del procedimiento/), { target: { value: 'ok' } });

    await click('Cerrar atención');
    await confirm('Confirmar cierre');

    const alert = screen.getByRole('alert');
    expect(within(alert).getByText('Faltan las notas del procedimiento')).toBeInTheDocument();
    expect(within(alert).getByText('Faltan fotos de después')).toBeInTheDocument();
    expect(screen.getByLabelText(/Notas del procedimiento/)).toHaveValue('ok');
    expect(onDone).not.toHaveBeenCalled();
  });

  it('disables the close and the cancel buttons while the close is pending and sends it once', async () => {
    const pending = deferred();
    hooks.complete.mockReturnValue(pending.promise);
    render(<Step session={inProgress()} />);
    await click('Cerrar atención');
    await confirm('Confirmar cierre');

    const close = screen.getByRole('button', { name: 'Cerrar atención' });
    expect(close).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancelar atención' })).toBeDisabled();
    fireEvent.submit(close.closest('form')!);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(hooks.complete).toHaveBeenCalledTimes(1);

    await act(async () => pending.resolve({}));
    expect(screen.getByRole('button', { name: 'Cerrar atención' })).toBeEnabled();
  });

  it('disables the close button when COMPLETE is not allowed', () => {
    render(<Step session={inProgress(['CANCEL'])} />);

    expect(screen.getByRole('button', { name: 'Cerrar atención' })).toBeDisabled();
  });
});

describe('ProcedureStep notes', () => {
  it('shows the notes the page hands down and reports each change', () => {
    const onNotesChange = vi.fn();
    render(
      <ProcedureStep session={inProgress()} notes="Borrador" onNotesChange={onNotesChange} />,
    );

    const field = screen.getByLabelText(/Notas del procedimiento/);
    expect(field).toHaveValue('Borrador');
    fireEvent.change(field, { target: { value: 'Borrador ampliado' } });

    expect(onNotesChange).toHaveBeenCalledWith('Borrador ampliado');
  });
});

describe('ProcedureStep cancel and no show', () => {
  it('asks for a reason of 3 to 1000 characters and sends it', async () => {
    const onDone = vi.fn();
    render(<Step session={session()} onDone={onDone} />);
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
    render(<Step session={session()} />);
    await click('Cancelar atención');

    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/Motivo/), { target: { value: 'Motivo válido' } });
    await act(async () =>
      fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmar cancelación' })),
    );

    expect(within(dialog).getByRole('alert')).toHaveTextContent('La atención ya terminó');
    expect(within(dialog).getByLabelText(/Motivo/)).toHaveValue('Motivo válido');
  });

  it('asks for confirmation before a no show and does not call the API when the user goes back', async () => {
    render(<Step session={session()} />);

    await click('No asistió');

    const dialog = screen.getByRole('dialog', { name: 'Registrar inasistencia' });
    await act(async () => fireEvent.click(within(dialog).getByRole('button', { name: 'Volver' })));

    expect(hooks.noShow).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('disables the no show and start buttons while the no show is pending and sends it once', async () => {
    const pending = deferred();
    hooks.noShow.mockReturnValue(pending.promise);
    render(<Step session={session()} />);
    await click('No asistió');
    await confirm('Confirmar inasistencia');

    expect(screen.getByRole('button', { name: 'No asistió' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Iniciar procedimiento' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'No asistió' }));
    expect(hooks.noShow).toHaveBeenCalledTimes(1);

    await act(async () => pending.resolve({}));
  });

  it('registers a no show after the confirmation and tells the page', async () => {
    const onDone = vi.fn();
    render(<Step session={session()} onDone={onDone} />);

    await click('No asistió');
    await confirm('Confirmar inasistencia');

    expect(hooks.noShow).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('shows No asistió only while NO_SHOW is allowed', () => {
    render(<Step session={inProgress()} />);

    expect(screen.queryByRole('button', { name: 'No asistió' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar atención' })).toBeInTheDocument();
  });

  it('offers no action once the session ended', () => {
    render(<Step session={session({ status: 'CANCELLED', allowedCommands: [] })} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText(/Cancelada: esta atención ya no admite cambios/)).toBeInTheDocument();
  });
});
