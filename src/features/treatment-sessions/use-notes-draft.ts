'use client';

import { useEffect, useRef, useState } from 'react';

export type NotesDraftState = 'idle' | 'saving' | 'saved' | 'error';

/** How long the notes stay untouched before they are saved. */
export const NOTES_DRAFT_DELAY_MS = 1000;

export const NOTES_DRAFT_LABELS: Record<Exclude<NotesDraftState, 'idle'>, string> = {
  saving: 'Guardando borrador…',
  saved: 'Borrador guardado',
  error: 'No se pudo guardar el borrador. Se intentará de nuevo cuando sigas escribiendo.',
};

interface NotesDraftOptions {
  /** What the user typed; null until they type. */
  typed: string | null;
  /** The notes the server holds. */
  stored: string | null | undefined;
  /** Whether the session takes a draft now (`SAVE_NOTES` among its commands). */
  enabled: boolean;
  save: (notes: string) => Promise<unknown>;
}

/**
 * Saves the procedure notes as a draft once the user pauses typing, and at once when the page
 * closes with a draft pending, so leaving the session does not lose them. Notes equal to the
 * stored ones (the server trims them) are not sent.
 */
export function useNotesDraft({ typed, stored, enabled, save }: NotesDraftOptions): NotesDraftState {
  const [state, setState] = useState<NotesDraftState>('idle');
  const saveRef = useRef(save);
  const pending = useRef<string | null>(null);
  // Only the answer to the latest save changes what is shown.
  const latest = useRef(0);

  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  const draft = enabled && typed !== null && typed.trim() !== (stored ?? '').trim() ? typed : null;

  useEffect(() => {
    pending.current = draft;
    if (draft === null) return;
    const timer = setTimeout(() => {
      pending.current = null;
      const attempt = ++latest.current;
      setState('saving');
      saveRef.current(draft).then(
        () => attempt === latest.current && setState('saved'),
        () => attempt === latest.current && setState('error'),
      );
    }, NOTES_DRAFT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [draft]);

  useEffect(
    () => () => {
      // Nothing is left on screen to report a failure to.
      if (pending.current !== null) {
        Promise.resolve(saveRef.current(pending.current)).catch(() => undefined);
      }
    },
    [],
  );

  return state;
}
