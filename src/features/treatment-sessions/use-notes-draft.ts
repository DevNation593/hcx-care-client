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
 * Saves the procedure notes as a draft once the user pauses typing, so leaving the session
 * does not lose them. Saves go one at a time: notes typed while one is in flight wait for it,
 * and only the latest are sent, so an older draft never lands after a newer one. A draft still
 * pending is sent at once when the page unmounts, and leaving the document (reload, closing the
 * tab) asks first while one is unsaved. Notes equal to the stored ones (the server trims them)
 * are not sent.
 */
export function useNotesDraft({ typed, stored, enabled, save }: NotesDraftOptions): NotesDraftState {
  const [state, setState] = useState<NotesDraftState>('idle');
  const saveRef = useRef(save);
  // The draft waiting for the pause, the save in flight, and the draft waiting for that save.
  const pending = useRef<string | null>(null);
  const inFlight = useRef(false);
  const queued = useRef<string | null>(null);

  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  // Kept in a ref so the timer, the unmount and the unload listener share one sender.
  const send = useRef((notes: string) => {
    if (inFlight.current) {
      queued.current = notes;
      return;
    }
    inFlight.current = true;
    setState('saving');
    // Started right away: on unload there is no later turn to start it in.
    let request: Promise<unknown>;
    try {
      request = Promise.resolve(saveRef.current(notes));
    } catch (error) {
      request = Promise.reject(error);
    }
    request
      .then(
        () => queued.current === null && setState('saved'),
        () => queued.current === null && setState('error'),
      )
      .finally(() => {
        inFlight.current = false;
        const next = queued.current;
        queued.current = null;
        if (next !== null) send.current(next);
      });
  });

  const draft = enabled && typed !== null && typed.trim() !== (stored ?? '').trim() ? typed : null;

  useEffect(() => {
    pending.current = draft;
    if (draft === null) return;
    const timer = setTimeout(() => {
      // Sent already when the user tried to leave the page.
      if (pending.current === null) return;
      pending.current = null;
      send.current(draft);
    }, NOTES_DRAFT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [draft]);

  useEffect(() => {
    const sendDraft = send.current;
    // A reload or a closed tab runs no React cleanup: ask first, and start the save meanwhile.
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (pending.current !== null) {
        const notes = pending.current;
        pending.current = null;
        sendDraft(notes);
      }
      if (!inFlight.current && queued.current === null) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      // Leaving the session inside the app: nothing is left on screen to report a failure to.
      if (pending.current !== null) sendDraft(pending.current);
    };
  }, []);

  return state;
}
