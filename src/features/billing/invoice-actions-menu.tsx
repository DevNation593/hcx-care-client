'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import type { InvoiceRequest } from '@/types/invoicing';

export type InvoiceDocumentKind = 'xml' | 'ride';

/** Marks the controls that open the menu, so pressing them again toggles it instead of reopening. */
export const INVOICE_MENU_TRIGGER_ATTRIBUTE = 'data-invoice-menu-trigger';

const VIEWPORT_MARGIN = 8;

/** Why a document cannot be downloaded yet, or null when it can. */
export function documentUnavailableReason(
  request: InvoiceRequest,
  kind: InvoiceDocumentKind,
): string | null {
  if (request.artifacts[kind]) return null;
  if (request.status === 'AUTHORIZED') return 'Se está preparando; se actualizará sola.';
  if (request.status === 'REJECTED' || request.status === 'FAILED')
    return 'No disponible: la factura no fue autorizada.';
  return 'Disponible cuando el SRI autorice la factura.';
}

interface InvoiceActionsMenuProps {
  request: InvoiceRequest;
  /** Viewport point of the right click, or the corner of the button that opened the menu. */
  x: number;
  y: number;
  /** `end` hangs the menu to the left of the point, as a button at the end of a row needs. */
  align?: 'start' | 'end';
  onSelect: (kind: InvoiceDocumentKind) => void;
  /** `restoreFocus` is true when the menu was closed from the keyboard. */
  onClose: (restoreFocus: boolean) => void;
}

const OPTIONS: { kind: InvoiceDocumentKind; label: string }[] = [
  { kind: 'xml', label: 'Descargar XML' },
  { kind: 'ride', label: 'Descargar RIDE' },
];

/**
 * Menu with the downloads of one invoice. It opens at the pointer (right click) or under the row
 * button, stays inside the viewport and closes with Esc, a click outside, Tab, scrolling or
 * resizing. An option whose file does not exist yet stays focusable but does nothing, and says why.
 */
export function InvoiceActionsMenu({
  request,
  x,
  y,
  align = 'start',
  onSelect,
  onClose,
}: InvoiceActionsMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: x, top: y });
  const close = useCallback(() => onClose(false), [onClose]);

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const { width, height } = menu.getBoundingClientRect();
    const wantedLeft = align === 'end' ? x - width : x;
    const maxLeft = window.innerWidth - width - VIEWPORT_MARGIN;
    const maxTop = window.innerHeight - height - VIEWPORT_MARGIN;
    setPosition({
      left: Math.max(VIEWPORT_MARGIN, Math.min(wantedLeft, maxLeft)),
      top: Math.max(VIEWPORT_MARGIN, Math.min(y, maxTop)),
    });
  }, [x, y, align]);

  useEffect(() => {
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const outside = (event: Event) => {
      const target = event.target as Element | null;
      if (menuRef.current?.contains(target)) return;
      if (target?.closest?.(`[${INVOICE_MENU_TRIGGER_ATTRIBUTE}]`)) return;
      close();
    };
    document.addEventListener('mousedown', outside);
    document.addEventListener('touchstart', outside);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    window.addEventListener('blur', close);
    return () => {
      document.removeEventListener('mousedown', outside);
      document.removeEventListener('touchstart', outside);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      window.removeEventListener('blur', close);
    };
  }, [close]);

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose(true);
      return;
    }
    if (event.key === 'Tab') {
      onClose(false);
      return;
    }
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [],
    );
    const current = items.indexOf(document.activeElement as HTMLElement);
    let next = -1;
    if (event.key === 'ArrowDown') next = (current + 1) % items.length;
    else if (event.key === 'ArrowUp') next = (current - 1 + items.length) % items.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = items.length - 1;
    if (next >= 0) {
      event.preventDefault();
      items[next]?.focus({ preventScroll: true });
    }
  }

  const label = request.number ? `Factura ${request.number}` : 'Factura';

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label={`Acciones de la ${label.toLowerCase()}`}
      onKeyDown={onKeyDown}
      onContextMenu={(event) => event.preventDefault()}
      style={{ position: 'fixed', left: position.left, top: position.top }}
      className="z-50 w-64 rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
    >
      {OPTIONS.map(({ kind, label: optionLabel }) => {
        const reason = documentUnavailableReason(request, kind);
        return (
          <button
            key={kind}
            type="button"
            role="menuitem"
            aria-disabled={reason ? true : undefined}
            onClick={() => {
              if (!reason) onSelect(kind);
            }}
            className={cn(
              'flex w-full flex-col items-start rounded-sm px-3 py-2 text-left text-sm outline-none focus:bg-accent focus:text-accent-foreground',
              reason ? 'cursor-not-allowed text-muted-foreground' : 'hover:bg-accent',
            )}
          >
            <span>{optionLabel}</span>
            {reason && <span className="text-xs font-normal">{reason}</span>}
          </button>
        );
      })}
    </div>,
    document.body,
  );
}
