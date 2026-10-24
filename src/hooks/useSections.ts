import { useMemo } from 'react';
import { useTenantModules } from '@/hooks/useSpecialties';
import type { SectionKey } from '@/types';

/** The module a submodule key (`core.billing.cash`) belongs to; undefined for a module key. */
export function parentSection(key: SectionKey): SectionKey | undefined {
  const segments = key.split('.');
  return segments.length > 2 ? (segments.slice(0, 2).join('.') as SectionKey) : undefined;
}

/**
 * The clinic's enabled sections, read from the module rows the sidebar already loads.
 * A section is enabled only when its row exists and is on, so it reads as off while loading;
 * a submodule also needs its module's row on.
 */
export function useSections() {
  const { data, isPending, isError, refetch } = useTenantModules();
  const enabled = useMemo(
    () => new Set((data ?? []).filter((row) => row.enabled).map((row) => row.moduleKey)),
    [data],
  );

  return {
    isEnabled: (key: SectionKey) => {
      const parent = parentSection(key);
      return enabled.has(key) && (!parent || enabled.has(parent));
    },
    isLoading: isPending,
    // A failed background refetch keeps the cached rows, which are still enough to decide.
    isError: isError && data === undefined,
    refetch: () => {
      void refetch();
    },
  };
}
