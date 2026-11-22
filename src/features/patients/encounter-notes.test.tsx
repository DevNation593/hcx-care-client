import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/store/authStore';
import type { ClinicalNote, User } from '@/types';
import type { Encounter } from '@/types/clinical';
import { EncounterNotes } from './encounter-notes';

const hooks = vi.hoisted(() => ({
  notes: [] as unknown[],
  error: null as unknown,
  isLoading: false,
  listed: vi.fn(),
  create: vi.fn(),
  remove: vi.fn(),
}));

vi.mock('@/hooks/useClinicalNotes', () => ({
  usePatientClinicalNotes: (patientId: string) => {
    hooks.listed(patientId);
    return { data: hooks.notes, isLoading: hooks.isLoading, error: hooks.error };
  },
  useCreateClinicalNote: () => ({ mutate: hooks.create, isPending: false }),
  useDeleteClinicalNote: () => ({ mutate: hooks.remove, isPending: false }),
}));

const openEncounter = { id: 'enc-1', status: 'OPEN' } as Encounter;

const note = (overrides: Partial<ClinicalNote> = {}): ClinicalNote =>
  ({
    id: 'n1',
    patientId: 'patient-1',
    psychologistId: 'me',
    psychologist: { id: 'me', firstName: 'Luis', lastName: 'Mora' },
    encounterId: 'enc-1',
    diagnosis: 'Cefalea tensional',
    content: 'Refiere mejoría con reposo.',
    version: 1,
    createdAt: '2026-10-01T15:45:00.000Z',
    sessionDate: '2026-10-01T15:45:00.000Z',
    ...overrides,
  }) as ClinicalNote;

const renderNotes = (withOpenEncounter = true) =>
  render(
    <EncounterNotes
      patientId="patient-1"
      openEncounter={withOpenEncounter ? openEncounter : undefined}
      startHint="Pulsa «Iniciar atención» en el panel de arriba."
    />,
  );

beforeEach(() => {
  vi.clearAllMocks();
  hooks.notes = [];
  hooks.error = null;
  hooks.isLoading = false;
  useAuthStore.setState({ user: { id: 'me', tenantId: 'tenant-1' } as User });
});

describe('EncounterNotes', () => {
  describe('without an open attention', () => {
    it('says how to start one and offers no way to write a note', () => {
      renderNotes(false);

      expect(screen.getByText(/Las notas se escriben dentro de una atención abierta\./)).toBeInTheDocument();
      expect(screen.getByText(/Pulsa «Iniciar atención»/)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Nueva nota' })).not.toBeInTheDocument();
    });

    it('does not read the notes of the patient just to say so', () => {
      renderNotes(false);
      expect(hooks.listed).not.toHaveBeenCalled();
    });
  });

  describe('with an open attention', () => {
    it('lists only the notes written in this attention', () => {
      hooks.notes = [
        note(),
        note({ id: 'n2', encounterId: 'enc-0', diagnosis: 'De otra atención', content: 'Antigua' }),
        note({ id: 'n3', encounterId: null, diagnosis: 'Sin atención', content: 'Suelta' }),
      ];
      renderNotes();

      expect(screen.getByText('Cefalea tensional')).toBeInTheDocument();
      expect(screen.queryByText('De otra atención')).not.toBeInTheDocument();
      expect(screen.queryByText('Sin atención')).not.toBeInTheDocument();
    });

    it('says so when this attention has no notes yet', () => {
      renderNotes();
      expect(screen.getByText('Aún no hay notas en esta atención.')).toBeInTheDocument();
    });

    it('writes a note bound to the attention in course', () => {
      renderNotes();

      fireEvent.click(screen.getByRole('button', { name: 'Nueva nota' }));
      const dialog = screen.getByRole('dialog');
      const save = within(dialog).getByRole('button', { name: 'Guardar nota' });
      expect(save).toBeDisabled();

      fireEvent.change(within(dialog).getByLabelText('Diagnóstico (opcional)'), {
        target: { value: '  F41.1  ' },
      });
      fireEvent.change(within(dialog).getByLabelText('Contenido'), {
        target: { value: '  Se explica el plan.  ' },
      });
      expect(save).toBeEnabled();
      fireEvent.click(save);

      expect(hooks.create).toHaveBeenCalledTimes(1);
      expect(hooks.create.mock.calls[0][0]).toEqual({
        patientId: 'patient-1',
        encounterId: 'enc-1',
        content: 'Se explica el plan.',
        diagnosis: 'F41.1',
      });
    });

    it('does not send a note made of spaces', () => {
      renderNotes();

      fireEvent.click(screen.getByRole('button', { name: 'Nueva nota' }));
      const dialog = screen.getByRole('dialog');
      fireEvent.change(within(dialog).getByLabelText('Contenido'), { target: { value: '   ' } });

      expect(within(dialog).getByRole('button', { name: 'Guardar nota' })).toBeDisabled();
    });

    it('closes and clears the form once the API accepts the note', () => {
      hooks.create.mockImplementation((_input, options) => options.onSuccess());
      renderNotes();

      fireEvent.click(screen.getByRole('button', { name: 'Nueva nota' }));
      fireEvent.change(screen.getByLabelText('Contenido'), { target: { value: 'Texto' } });
      fireEvent.click(screen.getByRole('button', { name: 'Guardar nota' }));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Nueva nota' }));
      expect(screen.getByLabelText('Contenido')).toHaveValue('');
    });

    it('lets only the author remove a note, with a reason', () => {
      hooks.notes = [
        note(),
        note({ id: 'n2', psychologistId: 'someone-else', diagnosis: 'De un colega', content: 'Ajena' }),
      ];
      renderNotes();

      const buttons = screen.getAllByRole('button', { name: 'Eliminar nota clínica' });
      expect(buttons).toHaveLength(1);
      fireEvent.click(buttons[0]);

      const confirm = screen.getByRole('button', { name: 'Eliminar' });
      expect(confirm).toBeDisabled();
      fireEvent.change(screen.getByLabelText('Motivo de la eliminación'), {
        target: { value: '  Paciente equivocado  ' },
      });
      expect(confirm).toBeEnabled();
      fireEvent.click(confirm);

      expect(hooks.remove).toHaveBeenCalledTimes(1);
      expect(hooks.remove.mock.calls[0][0]).toEqual({
        noteId: 'n1',
        patientId: 'patient-1',
        reason: 'Paciente equivocado',
      });
    });

    it('shows the notice of a locked module instead of the notes', () => {
      hooks.error = { status: 403, code: 'FEATURE_NOT_AVAILABLE' };
      renderNotes();

      expect(screen.getByText(/El módulo de notas clínicas no está disponible/)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Nueva nota' })).not.toBeInTheDocument();
    });
  });
});
