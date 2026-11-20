import { useState } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionCommandName, TreatmentSessionDetail } from '@/types/treatments';
import { ProcedureStep } from './procedure-step';

// Rendered without a QueryClient: name people as in a clinical practice.
vi.mock('@/hooks/usePatientTerms', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/usePatientTerms')>();
  return { ...actual, usePatientTerms: () => actual.patientTerms(false) };
});

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
    allowedCommands: ['START', 'CANCEL'],
    encounterStatus: 'OPEN',
    // By default another treatment of the encounter is still pending.
    encounterSessions: [{ id: 'session-2', status: 'CONSENTED', treatmentName: 'Relleno' }],
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
    expect(screen.getByRole('button', { name: 'Cancelar tratamiento' })).toBeDisabled();

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

describe('ProcedureStep complete', () => {
  it('shows the notes and the complete button only while in progress', () => {
    const { rerender } = render(<Step session={session()} />);
    expect(screen.queryByLabelText(/Notas del procedimiento/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Completar tratamiento' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cerrar atención' })).not.toBeInTheDocument();

    rerender(<Step session={inProgress()} />);

    expect(screen.getByLabelText(/Notas del procedimiento/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Completar tratamiento' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Cerrar atención' })).not.toBeInTheDocument();
  });

  it('asks for confirmation before completing and does not call the API when the user goes back', async () => {
    render(<Step session={inProgress()} />);

    await click('Completar tratamiento');

    const dialog = screen.getByRole('dialog', { name: 'Completar tratamiento' });
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
    await click('Completar tratamiento');
    await confirm('Completar');

    expect(hooks.complete).toHaveBeenCalledWith({ procedureNotes: 'Se aplicaron 20 unidades en la frente.' });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('sends no notes when none were typed and leaves the decision to the API', async () => {
    render(<Step session={inProgress()} />);

    await click('Completar tratamiento');
    await confirm('Completar');

    expect(hooks.complete).toHaveBeenCalledWith({});
  });

  it('keeps the typed notes and the page where it is when the API blocks the completion', async () => {
    const onDone = vi.fn();
    hooks.complete.mockRejectedValue({
      status: 422,
      message: 'Faltan requisitos',
      missing: ['CLINICAL_NOTES', 'AFTER_PHOTOS'],
    });
    render(<Step session={inProgress()} onDone={onDone} />);
    fireEvent.change(screen.getByLabelText(/Notas del procedimiento/), { target: { value: 'ok' } });

    await click('Completar tratamiento');
    await confirm('Completar');

    const alert = screen.getByRole('alert');
    expect(within(alert).getByText('Faltan las notas del procedimiento')).toBeInTheDocument();
    expect(within(alert).getByText('Faltan fotos de después')).toBeInTheDocument();
    expect(screen.getByLabelText(/Notas del procedimiento/)).toHaveValue('ok');
    expect(onDone).not.toHaveBeenCalled();
  });

  it('disables the complete and the cancel buttons while pending and sends it once', async () => {
    const pending = deferred();
    hooks.complete.mockReturnValue(pending.promise);
    render(<Step session={inProgress()} />);
    await click('Completar tratamiento');
    await confirm('Completar');

    const complete = screen.getByRole('button', { name: 'Completar tratamiento' });
    expect(complete).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancelar tratamiento' })).toBeDisabled();
    fireEvent.submit(complete.closest('form')!);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(hooks.complete).toHaveBeenCalledTimes(1);

    await act(async () => pending.resolve({}));
    expect(screen.getByRole('button', { name: 'Completar tratamiento' })).toBeEnabled();
  });

  it('disables the complete button when COMPLETE is not allowed', () => {
    render(<Step session={inProgress(['CANCEL'])} />);

    expect(screen.getByRole('button', { name: 'Completar tratamiento' })).toBeDisabled();
  });

  it('offers no complete button to a read-only viewer', () => {
    render(<ProcedureStep session={inProgress()} readOnly notes="" onNotesChange={vi.fn()} />);

    expect(screen.queryByRole('button', { name: 'Completar tratamiento' })).not.toBeInTheDocument();
  });
});

describe('ProcedureStep complete as the last pending treatment', () => {
  const lastPending = (siblings: TreatmentSessionDetail['encounterSessions'] = []) =>
    session({
      status: 'IN_PROGRESS',
      startedAt: '2026-10-15T15:00:00.000Z',
      allowedCommands: ['UPLOAD_AFTER', 'COMPLETE', 'CANCEL'],
      encounterSessions: siblings,
    });
  const open = async () => {
    await click('Completar tratamiento');
    return screen.getByRole('dialog');
  };
  const typePassword = (dialog: HTMLElement, value: string) =>
    fireEvent.change(within(dialog).getByLabelText(/Tu contraseña para firmar/), { target: { value } });

  it('offers to complete and close the encounter or to complete and stay in it', async () => {
    render(<Step session={lastPending()} />);

    const dialog = await open();

    expect(within(dialog).getByRole('button', { name: 'Completar y cerrar atención' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Completar y seguir en la atención' })).toBeInTheDocument();
  });

  it('also counts finished or cancelled siblings as nothing pending', async () => {
    render(
      <Step
        session={lastPending([
          { id: 's2', status: 'CLINICAL_COMPLETE', treatmentName: 'Relleno' },
          { id: 's3', status: 'CANCELLED', treatmentName: 'Peeling' },
        ])}
      />,
    );

    const dialog = await open();

    expect(within(dialog).getByRole('button', { name: 'Completar y cerrar atención' })).toBeInTheDocument();
  });

  it('keeps complete and close disabled until the password is typed, then sends it with the summary', async () => {
    const onDone = vi.fn();
    render(<Step session={lastPending()} onDone={onDone} />);
    fireEvent.change(screen.getByLabelText(/Notas del procedimiento/), { target: { value: ' Notas ' } });
    const dialog = await open();

    const closeButton = within(dialog).getByRole('button', { name: 'Completar y cerrar atención' });
    expect(closeButton).toBeDisabled();
    const summary = within(dialog).getByLabelText('Resumen de la atención');
    expect(summary).toHaveAttribute('maxlength', '5000');
    fireEvent.change(summary, { target: { value: '  Todo bien  ' } });
    typePassword(dialog, 'secreto');
    expect(closeButton).toBeEnabled();
    await act(async () => fireEvent.click(closeButton));

    expect(hooks.complete).toHaveBeenCalledWith({
      procedureNotes: 'Notas',
      closeEncounter: true,
      password: 'secreto',
      encounterSummary: 'Todo bien',
    });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('omits the summary when it was left empty', async () => {
    render(<Step session={lastPending()} />);
    const dialog = await open();

    typePassword(dialog, 'secreto');
    await act(async () =>
      fireEvent.click(within(dialog).getByRole('button', { name: 'Completar y cerrar atención' })),
    );

    expect(hooks.complete).toHaveBeenCalledWith({ closeEncounter: true, password: 'secreto' });
  });

  it('completes without closing the encounter and sends no password', async () => {
    const onDone = vi.fn();
    render(<Step session={lastPending()} onDone={onDone} />);
    const dialog = await open();

    await act(async () =>
      fireEvent.click(within(dialog).getByRole('button', { name: 'Completar y seguir en la atención' })),
    );

    expect(hooks.complete).toHaveBeenCalledWith({});
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('shows the password error, clears the field and keeps the dialog open', async () => {
    const onDone = vi.fn();
    hooks.complete.mockRejectedValue({
      status: 403,
      code: 'SIGNATURE_PASSWORD_INVALID',
      message: 'La contraseña no es correcta.',
    });
    render(<Step session={lastPending()} onDone={onDone} />);
    const dialog = await open();

    typePassword(dialog, 'mala');
    await act(async () =>
      fireEvent.click(within(dialog).getByRole('button', { name: 'Completar y cerrar atención' })),
    );

    const still = screen.getByRole('dialog');
    expect(within(still).getByRole('alert')).toHaveTextContent('La contraseña no es correcta.');
    expect(within(still).getByLabelText(/Tu contraseña para firmar/)).toHaveValue('');
    expect(within(still).getByRole('button', { name: 'Completar y cerrar atención' })).toBeDisabled();
    expect(onDone).not.toHaveBeenCalled();
  });

  it('closes the dialog and lists what is missing when the API blocks the completion', async () => {
    hooks.complete.mockRejectedValue({ status: 422, message: 'x', missing: ['AFTER_PHOTOS'] });
    render(<Step session={lastPending()} />);
    const dialog = await open();

    typePassword(dialog, 'secreto');
    await act(async () =>
      fireEvent.click(within(dialog).getByRole('button', { name: 'Completar y cerrar atención' })),
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Faltan fotos de después');
  });

  it('offers only "Completar" while another treatment is pending', async () => {
    render(<Step session={lastPending([{ id: 's2', status: 'READY_FOR_CONSENT', treatmentName: 'Relleno' }])} />);

    const dialog = await open();

    expect(within(dialog).getByRole('button', { name: 'Completar' })).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: /cerrar atención/ })).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText(/Tu contraseña para firmar/)).not.toBeInTheDocument();
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

describe('ProcedureStep cancel', () => {
  it('asks for a reason of 3 to 1000 characters and sends it', async () => {
    const onDone = vi.fn();
    render(<Step session={session()} onDone={onDone} />);
    await click('Cancelar tratamiento');

    const dialog = screen.getByRole('dialog', { name: 'Cancelar tratamiento' });
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

  it('says the encounter stays open and does not talk about the appointment', async () => {
    render(<Step session={inProgress(['COMPLETE', 'CANCEL'])} />);
    await click('Cancelar tratamiento');

    const dialog = screen.getByRole('dialog', { name: 'Cancelar tratamiento' });
    expect(dialog).toHaveTextContent(
      'El tratamiento termina y el motivo queda registrado. La atención sigue abierta.',
    );
    expect(dialog).not.toHaveTextContent(/cita/i);
  });

  it('keeps the dialog open with the API message when the cancellation fails', async () => {
    hooks.cancel.mockRejectedValue({ status: 409, message: 'El tratamiento ya terminó' });
    render(<Step session={session()} />);
    await click('Cancelar tratamiento');

    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/Motivo/), { target: { value: 'Motivo válido' } });
    await act(async () =>
      fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmar cancelación' })),
    );

    expect(within(dialog).getByRole('alert')).toHaveTextContent('El tratamiento ya terminó');
    expect(within(dialog).getByLabelText(/Motivo/)).toHaveValue('Motivo válido');
  });

  it('no longer offers a no show, even when the API still allows it', () => {
    render(<Step session={session({ allowedCommands: ['START', 'CANCEL', 'NO_SHOW'] })} />);

    expect(screen.queryByRole('button', { name: 'No asistió' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar tratamiento' })).toBeInTheDocument();
  });

  it('offers no action once the session ended', () => {
    render(<Step session={session({ status: 'CANCELLED', allowedCommands: [] })} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText(/Cancelada: este tratamiento ya no admite cambios/)).toBeInTheDocument();
  });
});
