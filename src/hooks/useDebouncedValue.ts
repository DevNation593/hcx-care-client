import { useEffect, useState } from 'react';

/** Delay of the search boxes that query the server on every change. */
export const SEARCH_DEBOUNCE_MS = 300;

/**
 * Follows `value` after it has stopped changing for `delay` ms. Typing stays immediate (the input
 * keeps the raw value) while the request, and its query key, use the settled one.
 */
export function useDebouncedValue<T>(value: T, delay: number = SEARCH_DEBOUNCE_MS): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
