import { useCallback, useEffect, useState } from 'react';

/**
 * Current page of a list the server pages. `resetKey` changes with the active search and filters,
 * so a new filter starts on the first page.
 */
export function useServerPage(resetKey: string) {
  const [state, setState] = useState({ page: 1, resetKey });
  // A new key replaces the state right away (page 1), so coming back to an earlier filter does not
  // bring back the page that filter was left on.
  if (state.resetKey !== resetKey) setState({ page: 1, resetKey });
  const page = state.resetKey === resetKey ? state.page : 1;
  const setPage = useCallback((next: number) => setState({ page: Math.max(1, next), resetKey }), [resetKey]);
  return { page, setPage };
}

/**
 * Falls back to the last page when the answer says the requested one no longer exists (the rows
 * of the last page were deleted). `settled` is false while the answer shown is a stand-in for
 * another request, so a stale page count never moves the pager.
 */
export function useFallbackToLastPage(
  page: number,
  setPage: (page: number) => void,
  answer: { totalPages: number; settled: boolean } | undefined,
) {
  const totalPages = answer?.totalPages;
  const settled = answer?.settled;
  useEffect(() => {
    if (settled && totalPages !== undefined && page > totalPages) setPage(totalPages);
  }, [settled, totalPages, page, setPage]);
}
