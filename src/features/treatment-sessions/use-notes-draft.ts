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

const same = (a: string | null | undefined, b: string | null | undefined) =>
  (a ?? '').trim() === (b ?? '').trim();

/**
 * Saves the procedure notes as a draft once the user pauses typing, so leaving the session
 * does not lose them.
 *
 * - Saves go one at a time: notes typed while one is in flight wait for it and only the latest
 *   are sent, so an older draft never lands after a newer one.
 * - Whether there is something to send is judged against what the server will hold once the
 *   saves in flight and queued land, not only against the stored notes: typing the stored text
 *   back while a different draft is saving still sends it.
 * - A draft stays pending until a save confirms it: a failed one is tried again when the page
 *   unmounts or the document is left, and leaving the document (reload, closing the tab) asks
 *   first while anything is unsaved.
 */
export function useNotesDraft({ typed, stored, enabled, save }: NotesDraftOptions): NotesDraftState {
  const [state, setState] = useState<NotesDraftState>('idle');
  const saveRef = useRef(save);
  // The draft not sent yet, the text in flight, and the text waiting for that save.
  const pending = useRef<string | null>(null);
  const sending = useRef<string | null>(null);
  const queued = useRef<string | null>(null);

  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  // Kept in a ref so the timer, the unmount and the unload listener share one sender.
  const send = useRef((notes: string) => {
    if (sending.current !== null) {
      queued.current = notes;
      return;
    }
    sending.current = notes;
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
        () => {
          // Not saved: still pending unless something newer replaces it.
          if (queued.current !== null) return;
          if (pending.current === null) pending.current = notes;
          setState('error');
        },
      )
      .finally(() => {
        sending.current = null;
        const next = queued.current;
        queued.current = null;
        if (next !== null) send.current(next);
      });
  });

  useEffect(() => {
    if (!enabled || typed === null) {
      pending.current = null;
      return;
    }
    // What the server will hold once the saves in flight and queued land.
    const target = queued.current ?? sending.current ?? stored;
    if (same(typed, target)) {
      pending.current = null;
      return;
    }
    pending.current = typed;
    const timer = setTimeout(() => {
      // Sent already when the user tried to leave the page.
      if (pending.current === null) return;
      const notes = pending.current;
      pending.current = null;
      send.current(notes);
    }, NOTES_DRAFT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [typed, stored, enabled]);

  useEffect(() => {
    const sendDraft = send.current;
    // A reload or a closed tab runs no React cleanup: ask first, and start the save meanwhile.
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (pending.current !== null) {
        const notes = pending.current;
        pending.current = null;
        sendDraft(notes);
      }
      if (sending.current === null && queued.current === null) return;
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
