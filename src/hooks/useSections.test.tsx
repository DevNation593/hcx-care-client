import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parentSection, useSections } from './useSections';

const modules = vi.hoisted(() => ({
  state: {} as { data?: { moduleKey: string; enabled: boolean }[]; isPending: boolean; isError: boolean; refetch: () => void },
}));
vi.mock('@/hooks/useSpecialties', () => ({ useTenantModules: () => modules.state }));

beforeEach(() => {
  modules.state = { data: undefined, isPending: false, isError: false, refetch: vi.fn() };
});

describe('useSections', () => {
  it('reports a module enabled only when its row exists and is enabled', () => {
    modules.state.data = [
      { moduleKey: 'core.agenda', enabled: true },
      { moduleKey: 'core.patients', enabled: false },
      { moduleKey: 'psychology.records', enabled: true },
    ];
    const { result } = renderHook(() => useSections());
    expect(result.current.isEnabled('core.agenda')).toBe(true);
    expect(result.current.isEnabled('core.patients')).toBe(false);
    // No row at all.
    expect(result.current.isEnabled('core.billing')).toBe(false);
  });

  it('reports a submodule enabled only when its module is enabled too', () => {
    modules.state.data = [
      { moduleKey: 'core.agenda', enabled: true },
      { moduleKey: 'core.agenda.calendar', enabled: true },
      { moduleKey: 'core.agenda.tasks', enabled: false },
      { moduleKey: 'core.billing', enabled: false },
      { moduleKey: 'core.billing.cash', enabled: true },
    ];
    const { result } = renderHook(() => useSections());
    expect(result.current.isEnabled('core.agenda.calendar')).toBe(true);
    expect(result.current.isEnabled('core.agenda.tasks')).toBe(false);
    expect(result.current.isEnabled('core.billing.cash')).toBe(false);
  });

  it('reports every section disabled while loading', () => {
    modules.state = { data: undefined, isPending: true, isError: false, refetch: vi.fn() };
    const { result } = renderHook(() => useSections());
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isEnabled('core.agenda.calendar')).toBe(false);
    expect(result.current.isEnabled('core.admin')).toBe(false);
  });
});

describe('parentSection', () => {
  it('names the module of a submodule and nothing for a module', () => {
    expect(parentSection('core.billing.cash')).toBe('core.billing');
    expect(parentSection('core.billing')).toBeUndefined();
  });
});
