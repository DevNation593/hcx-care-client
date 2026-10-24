import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { SectionCatalog, SectionKey } from '@/types';
import { SectionChecklist } from './section-checklist';

const catalog: SectionCatalog['sections'] = [
  { key: 'core.agenda', name: 'Agenda', requires: [] },
  { key: 'core.agenda.calendar', name: 'Calendario y citas', parent: 'core.agenda', requires: ['core.patients.records'] },
  { key: 'core.agenda.tasks', name: 'Actividades', parent: 'core.agenda', requires: ['core.patients.records'] },
  { key: 'core.patients', name: 'Pacientes', requires: [] },
  { key: 'core.patients.records', name: 'Fichas de pacientes', parent: 'core.patients', requires: [] },
  { key: 'core.clinical', name: 'Clínico', requires: [] },
  { key: 'core.clinical.notes', name: 'Notas clínicas', parent: 'core.clinical', requires: ['core.patients.records'], healthOnly: true },
];

function Harness({ initial, onChange }: { initial: SectionKey[]; onChange?: (next: SectionKey[]) => void }) {
  const [value, setValue] = useState<SectionKey[]>(initial);
  return (
    <SectionChecklist
      catalog={catalog}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
}

describe('SectionChecklist', () => {
  it('shows each module with its submodules underneath', () => {
    render(<Harness initial={['core.agenda', 'core.agenda.tasks']} />);
    const agenda = screen.getByRole('list', { name: 'Submódulos de Agenda' });
    expect(agenda).toHaveTextContent('Calendario y citas');
    expect(agenda).toHaveTextContent('Actividades');
    expect(screen.getByText('1/2')).toBeInTheDocument();
    expect(screen.getByText('(solo salud)')).toBeInTheDocument();
  });

  it('turns on the module and the submodules a checked submodule needs', () => {
    render(<Harness initial={[]} />);
    fireEvent.click(screen.getByLabelText('Actividades'));
    expect(screen.getByLabelText('Actividades')).toBeChecked();
    expect(screen.getByLabelText('Agenda')).toBeChecked();
    expect(screen.getByLabelText('Fichas de pacientes')).toBeChecked();
    expect(screen.getByLabelText('Pacientes')).toBeChecked();
    expect(screen.getByLabelText('Calendario y citas')).not.toBeChecked();
  });

  it('starts a module turned on with none chosen with all its submodules', () => {
    const onChange = vi.fn();
    render(<Harness initial={[]} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Agenda'));
    expect(onChange).toHaveBeenLastCalledWith([
      'core.agenda',
      'core.agenda.calendar',
      'core.agenda.tasks',
      'core.patients',
      'core.patients.records',
    ]);
  });

  it('keeps the submodules chosen when their module is turned off', () => {
    render(<Harness initial={['core.agenda', 'core.agenda.tasks', 'core.patients', 'core.patients.records']} />);
    fireEvent.click(screen.getByLabelText('Agenda'));
    expect(screen.getByLabelText('Agenda')).not.toBeChecked();
    expect(screen.getByLabelText('Actividades')).toBeChecked();
  });

  it('unchecks the submodules that need one taken away, also through its module', () => {
    render(
      <Harness
        initial={['core.agenda', 'core.agenda.calendar', 'core.patients', 'core.patients.records', 'core.clinical', 'core.clinical.notes']}
      />,
    );
    fireEvent.click(screen.getByLabelText('Pacientes'));
    expect(screen.getByLabelText('Fichas de pacientes')).toBeChecked();
    expect(screen.getByLabelText('Calendario y citas')).not.toBeChecked();
    expect(screen.getByLabelText('Notas clínicas')).not.toBeChecked();
    expect(screen.getByLabelText('Agenda')).toBeChecked();
  });
});
