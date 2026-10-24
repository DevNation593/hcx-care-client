import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SectionGate } from './section-gate';

type Row = { moduleKey: string; enabled: boolean };
const modules = vi.hoisted(() => ({
  state: {} as { data?: Row[]; isPending: boolean; isError: boolean; refetch: () => void },
}));
vi.mock('@/hooks/useSpecialties', () => ({ useTenantModules: () => modules.state }));

const tasksOn: Row[] = [{ moduleKey: 'core.admin', enabled: true }];

beforeEach(() => {
  modules.state = { data: tasksOn, isPending: false, isError: false, refetch: vi.fn() };
});

const renderGate = () =>
  render(<SectionGate section="core.admin"><p>Contenido</p></SectionGate>);

describe('SectionGate', () => {
  it('renders nothing while the sections load', () => {
    modules.state = { ...modules.state, data: undefined, isPending: true };
    const { container } = renderGate();
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the retry alert, not the disabled notice, when the request fails', () => {
    modules.state = { ...modules.state, data: undefined, isError: true };
    renderGate();
    expect(screen.getByText('No se pudieron cargar las secciones')).toBeInTheDocument();
    expect(screen.queryByText('Sección no disponible')).not.toBeInTheDocument();
    expect(screen.queryByText('Contenido')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(modules.state.refetch).toHaveBeenCalledTimes(1);
  });

  it('keeps the children when only a background refetch failed', () => {
    modules.state = { ...modules.state, data: tasksOn, isError: true };
    renderGate();
    expect(screen.getByText('Contenido')).toBeInTheDocument();
    expect(screen.queryByText('No se pudieron cargar las secciones')).not.toBeInTheDocument();
  });

  it('shows the disabled notice when the section is off', () => {
    modules.state = { ...modules.state, data: [{ moduleKey: 'core.admin', enabled: false }] };
    renderGate();
    expect(screen.getByText('Sección no disponible')).toBeInTheDocument();
    expect(screen.getByText('Esta sección no está habilitada para tu consultorio')).toBeInTheDocument();
    expect(screen.queryByText('Contenido')).not.toBeInTheDocument();
  });

  it('renders the children when the section is on', () => {
    renderGate();
    expect(screen.getByText('Contenido')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
