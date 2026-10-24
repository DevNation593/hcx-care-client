'use client';

import type { SectionCatalog, SectionKey } from '@/types';

type Catalog = SectionCatalog['sections'];

interface SectionChecklistProps {
  catalog: Catalog;
  value: SectionKey[];
  onChange: (next: SectionKey[]) => void;
  disabled?: boolean;
  /** Keys set apart from the plan for this clinic, marked as such. */
  overridden?: SectionKey[];
  /** Overrides the legend, e.g. on a plan, where modules are what it includes. */
  legend?: string;
}

/** A module works with its own key; a submodule also needs its module's. */
function inEffect(catalog: Catalog, keys: Set<SectionKey>, key: SectionKey): boolean {
  const parent = catalog.find((section) => section.key === key)?.parent;
  return keys.has(key) && (!parent || keys.has(parent));
}

/** Turns on `added`, their modules and every submodule they need, directly or through another one. */
function withRequirements(catalog: Catalog, keys: Set<SectionKey>, added: SectionKey[]): Set<SectionKey> {
  const result = new Set(keys);
  const pending = [...added];
  while (pending.length > 0) {
    const key = pending.pop()!;
    const section = catalog.find((entry) => entry.key === key);
    if (!section) continue;
    result.add(key);
    for (const next of [section.parent, ...section.requires]) {
      if (next && !result.has(next)) pending.push(next);
    }
  }
  return result;
}

/** Unchecks every submodule left in effect without one it needs, directly or through another one. */
function withoutBrokenDependents(catalog: Catalog, keys: Set<SectionKey>): Set<SectionKey> {
  const result = new Set(keys);
  let shrank = true;
  while (shrank) {
    shrank = false;
    for (const section of catalog) {
      if (!inEffect(catalog, result, section.key)) continue;
      if (section.requires.some((required) => !inEffect(catalog, result, required))) {
        result.delete(section.key);
        shrank = true;
      }
    }
  }
  return result;
}

export function SectionChecklist({ catalog, value, onChange, disabled, overridden = [], legend = 'Módulos habilitados' }: SectionChecklistProps) {
  const selected = new Set(value);
  const modules = catalog.filter((section) => !section.parent);
  const submodulesOf = (key: SectionKey) => catalog.filter((section) => section.parent === key);

  function emit(next: Set<SectionKey>) {
    onChange(catalog.map((section) => section.key).filter((key) => next.has(key)));
  }

  function toggle(key: SectionKey, checked: boolean) {
    if (checked) {
      // A module turned on with none of its submodules chosen starts with all of them.
      const children = submodulesOf(key).map((section) => section.key);
      const added = children.length > 0 && !children.some((child) => selected.has(child)) ? [key, ...children] : [key];
      emit(withRequirements(catalog, selected, added));
      return;
    }
    const next = new Set(selected);
    next.delete(key);
    emit(withoutBrokenDependents(catalog, next));
  }

  return (
    <fieldset className="space-y-3" disabled={disabled}>
      <legend className="font-medium">{legend}</legend>
      {modules.map((module) => {
        const moduleOn = selected.has(module.key);
        const children = submodulesOf(module.key);
        return (
          <div key={module.key} className="rounded-md border p-3">
            <div className="flex items-center gap-3">
              <label className="flex cursor-pointer items-center gap-3 font-medium">
                <input type="checkbox" checked={moduleOn} onChange={(event) => toggle(module.key, event.target.checked)} />
                {module.name}
              </label>
              {overridden.includes(module.key) && <span className="text-xs text-orange-700">Ajuste</span>}
              <span className="ml-auto text-xs text-muted-foreground">
                {children.filter((child) => selected.has(child.key)).length}/{children.length}
              </span>
            </div>
            {children.length > 0 && (
              <ul className="mt-2 space-y-1.5 pl-7" aria-label={`Submódulos de ${module.name}`}>
                {children.map((child) => (
                  <li key={child.key} className="flex items-center gap-2">
                    <label className={`flex cursor-pointer items-center gap-3 text-sm ${moduleOn ? '' : 'text-muted-foreground'}`}>
                      <input
                        type="checkbox"
                        checked={selected.has(child.key)}
                        onChange={(event) => toggle(child.key, event.target.checked)}
                      />
                      {child.name}
                    </label>
                    {child.healthOnly && <span className="text-xs text-muted-foreground">(solo salud)</span>}
                    {overridden.includes(child.key) && <span className="text-xs text-orange-700">Ajuste</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </fieldset>
  );
}
