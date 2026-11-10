import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProcedureHistory } from './procedure-history';

const hooks = vi.hoisted(() => ({
  sessions: { data: [] as unknown[], isPending: false, isError: false },
}));

vi.mock('@/hooks/useTreatmentSessions', () => ({
  usePatientTreatmentSessions: () => hooks.sessions,
}));

const summary = (overrides: Record<string, unknown>) => ({
  id: 's-1',
  status: 'CLINICAL_COMPLETE',
  createdAt: '2026-10-15T14:00:00.000Z',
  startedAt: '2026-10-15T15:00:00.000Z',
  completedAt: '2026-10-15T15:40:00.000Z',
  procedureNotes: null,
  treatment: { id: 'tr-1', name: 'Toxina botulínica', version: 1 },
  professional: { id: 'pro', firstName: 'Sofía', lastName: 'Ruiz' },
  ...overrides,
});

beforeEach(() => {
  hooks.sessions = { data: [], isPending: false, isError: false };
});

describe('ProcedureHistory', () => {
  it('shows each started procedure with its notes, status, professional and a link to it', () => {
    hooks.sessions.data = [
      summary({ id: 's-2', procedureNotes: 'Toxina 20 U en glabela.\nSin incidencias.' }),
      summary({
        id: 's-1',
        status: 'IN_PROGRESS',
        completedAt: null,
        treatment: { id: 'tr-2', name: 'Peeling químico', version: 1 },
        procedureNotes: 'Borrador en curso',
      }),
    ];

    render(<ProcedureHistory patientId="patient-1" />);

    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText('Toxina botulínica')).toBeInTheDocument();
    expect(within(rows[0]).getByText('Cerrada')).toBeInTheDocument();
    expect(within(rows[0]).getByText(/Toxina 20 U en glabela\./)).toBeInTheDocument();
    expect(within(rows[0]).getByText(/Sofía Ruiz/)).toBeInTheDocument();
    expect(within(rows[0]).getByRole('link', { name: /Ver atención/ })).toHaveAttribute(
      'href',
      '/treatment-sessions/s-2',
    );
    expect(within(rows[1]).getByText('Borrador en curso')).toBeInTheDocument();
    expect(within(rows[1]).getByText(/borrador hasta cerrar la atención/)).toBeInTheDocument();
  });

  it('leaves out sessions whose procedure never started', () => {
    hooks.sessions.data = [
      summary({ id: 's-1', status: 'CONSENTED', startedAt: null, completedAt: null }),
      summary({ id: 's-2', status: 'NO_SHOW', startedAt: null, completedAt: null }),
    ];

    render(<ProcedureHistory patientId="patient-1" />);

    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
    expect(screen.getByText('No hay procedimientos registrados')).toBeInTheDocument();
  });

  it('says when a procedure has no notes', () => {
    hooks.sessions.data = [summary({ procedureNotes: null })];

    render(<ProcedureHistory patientId="patient-1" />);

    expect(screen.getByText('Sin notas del procedimiento')).toBeInTheDocument();
  });

  it('says when the procedures could not be loaded', () => {
    hooks.sessions = { data: undefined as never, isPending: false, isError: true };

    render(<ProcedureHistory patientId="patient-1" />);

    expect(screen.getByText('No se pudieron cargar los procedimientos.')).toBeInTheDocument();
  });
});
