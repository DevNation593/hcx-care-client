import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useFallbackToLastPage, useServerPage } from './useServerPage';

describe('useServerPage', () => {
  it('starts on the first page and moves to the one asked for', () => {
    const { result } = renderHook(() => useServerPage('a'));
    expect(result.current.page).toBe(1);
    act(() => result.current.setPage(3));
    expect(result.current.page).toBe(3);
  });

  it('never goes below the first page', () => {
    const { result } = renderHook(() => useServerPage('a'));
    act(() => result.current.setPage(0));
    expect(result.current.page).toBe(1);
  });

  it('returns to page 1 when the reset key changes, and can move again afterwards', () => {
    const { result, rerender } = renderHook(({ key }) => useServerPage(key), {
      initialProps: { key: 'a|all' },
    });
    act(() => result.current.setPage(4));
    rerender({ key: 'ab|all' });
    expect(result.current.page).toBe(1);
    act(() => result.current.setPage(2));
    expect(result.current.page).toBe(2);
  });
});

describe('useServerPage: coming back to an earlier filter', () => {
  it('does not recover the page that filter was left on', () => {
    const { result, rerender } = renderHook(({ key }) => useServerPage(key), {
      initialProps: { key: 'a|active' },
    });
    act(() => result.current.setPage(3));
    expect(result.current.page).toBe(3);

    rerender({ key: 'ab|active' });
    expect(result.current.page).toBe(1);
    rerender({ key: 'a|active' });
    expect(result.current.page).toBe(1);
    act(() => result.current.setPage(2));
    expect(result.current.page).toBe(2);
  });
});

describe('useFallbackToLastPage', () => {
  const setup = (answer: { totalPages: number; settled: boolean } | undefined, startPage = 3) => {
    const pager = renderHook(() => useServerPage('k'));
    act(() => pager.result.current.setPage(startPage));
    const fallback = renderHook(
      ({ current }) =>
        useFallbackToLastPage(pager.result.current.page, pager.result.current.setPage, current),
      { initialProps: { current: answer } },
    );
    return { pager, fallback };
  };

  it('moves to the last page when the page asked for no longer exists', () => {
    const { pager } = setup({ totalPages: 2, settled: true });
    expect(pager.result.current.page).toBe(2);
  });

  it('keeps the page while the answer is only a stand-in for another request', () => {
    const { pager } = setup({ totalPages: 2, settled: false });
    expect(pager.result.current.page).toBe(3);
  });

  it('keeps the page while there is no answer, or when it still exists', () => {
    expect(setup(undefined).pager.result.current.page).toBe(3);
    expect(setup({ totalPages: 3, settled: true }).pager.result.current.page).toBe(3);
  });
});
