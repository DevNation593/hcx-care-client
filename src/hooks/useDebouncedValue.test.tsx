import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SEARCH_DEBOUNCE_MS, useDebouncedValue } from './useDebouncedValue';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('useDebouncedValue', () => {
  it('starts with the value it is given', () => {
    const { result } = renderHook(() => useDebouncedValue('ana'));
    expect(result.current).toBe('ana');
  });

  it('waits 300 ms of silence before following a change', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value), {
      initialProps: { value: '' },
    });
    rerender({ value: 'a' });
    act(() => vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 1));
    expect(result.current).toBe('');
    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe('a');
    expect(SEARCH_DEBOUNCE_MS).toBe(300);
  });

  it('settles once, on the last value, when several keystrokes arrive in a row', () => {
    const seen: string[] = [];
    const { result, rerender } = renderHook(
      ({ value }) => {
        const debounced = useDebouncedValue(value);
        if (seen[seen.length - 1] !== debounced) seen.push(debounced);
        return debounced;
      },
      { initialProps: { value: '' } },
    );
    for (const typed of ['m', 'ma', 'mar', 'mari', 'maria']) {
      rerender({ value: typed });
      act(() => vi.advanceTimersByTime(100));
    }
    expect(result.current).toBe('');
    act(() => vi.advanceTimersByTime(300));
    expect(result.current).toBe('maria');
    expect(seen).toEqual(['', 'maria']);
  });

  it('does not fire after unmount', () => {
    const { result, rerender, unmount } = renderHook(({ value }) => useDebouncedValue(value), {
      initialProps: { value: 'a' },
    });
    rerender({ value: 'ab' });
    unmount();
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current).toBe('a');
  });
});
