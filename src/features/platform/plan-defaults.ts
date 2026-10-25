import type { SectionCatalog, SectionKey } from '@/types';

/**
 * The module keys a plan turns on for a clinic, as the API computes them: health-only submodules
 * stay off when every specialty of the clinic is non-health.
 */
export function planDefaults(
  planModules: readonly SectionKey[],
  catalog: SectionCatalog,
  specialtyCodes: readonly string[],
): SectionKey[] {
  const healthCare =
    specialtyCodes.length === 0 ||
    specialtyCodes.some((code) => !catalog.nonHealthSpecialtyCodes.includes(code));
  return catalog.sections
    .filter((section) => planModules.includes(section.key) && (healthCare || !section.healthOnly))
    .map((section) => section.key);
}
