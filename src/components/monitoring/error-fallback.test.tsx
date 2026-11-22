import { fireEvent, render, screen } from '@testing-library/react';
import * as Sentry from '@sentry/nextjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorFallback } from './error-fallback';

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }));

describe('ErrorFallback', () => {
  beforeEach(() => {
    vi.mocked(Sentry.captureException).mockClear();
  });

  it("shows the Spanish heading 'Algo salió mal' and a 'Reintentar' button", () => {
    render(<ErrorFallback error={new Error('boom')} reset={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Algo salió mal' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });

  it('does not claim the error was reported', () => {
    render(<ErrorFallback error={new Error('boom')} reset={vi.fn()} />);
    expect(
      screen.getByText('Ocurrió un error inesperado. Puedes reintentar; si el problema continúa, contacta a soporte.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/reportado/i)).not.toBeInTheDocument();
  });

  it('reports the error to Sentry once on mount', () => {
    const error = new Error('boom');
    render(<ErrorFallback error={error} reset={vi.fn()} />);
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    expect(Sentry.captureException).toHaveBeenCalledWith(error);
  });

  it('is a full-page <main> by default', () => {
    const { container } = render(<ErrorFallback error={new Error('boom')} reset={vi.fn()} />);
    expect(container.querySelector('main')).toHaveClass('min-h-screen');
  });

  it('embedded renders a <section> without <main> nor full-height, keeping copy, reporting and reset', () => {
    const error = new Error('boom');
    const reset = vi.fn();
    const { container } = render(<ErrorFallback error={error} reset={reset} embedded />);

    expect(container.querySelector('main')).toBeNull();
    const section = container.querySelector('section');
    expect(section).not.toBeNull();
    expect(section).not.toHaveClass('min-h-screen');
    expect(screen.getByRole('heading', { name: 'Algo salió mal' })).toBeInTheDocument();
    expect(
      screen.getByText('Ocurrió un error inesperado. Puedes reintentar; si el problema continúa, contacta a soporte.'),
    ).toBeInTheDocument();
    expect(Sentry.captureException).toHaveBeenCalledWith(error);
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("calls reset when 'Reintentar' is clicked", () => {
    const reset = vi.fn();
    render(<ErrorFallback error={new Error('boom')} reset={reset} />);
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
