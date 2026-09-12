import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { recipeCostDisclosureKey, useRecipeCostDisclosure } from '@/features/recipes/useRecipeCostDisclosure';

const mock = vi.hoisted(() => ({ os: 'web', read: vi.fn(), write: vi.fn() }));
vi.mock('react-native', async original => {
  const rn = await original<typeof import('react-native')>();
  return { ...rn, Platform: { ...rn.Platform, get OS() { return mock.os; } } };
});
vi.mock('expo-secure-store', () => ({ getItemAsync: mock.read, setItemAsync: mock.write }));
beforeEach(() => { localStorage.clear(); mock.os = 'web'; mock.read.mockReset(); mock.write.mockReset().mockResolvedValue(undefined); });

it('defaults all open, persists each card separately and restores on remount', () => {
  const first = renderHook(() => useRecipeCostDisclosure('actor-a.store-a'));
  expect(Object.values(first.result.current.expanded)).toEqual([true, true, true, true]);
  act(() => first.result.current.toggle('material'));
  act(() => first.result.current.toggle('fixed'));
  expect(first.result.current.expanded).toEqual({ material: false, extra: true, fixed: false, tax: true });
  first.unmount();
  const next = renderHook(() => useRecipeCostDisclosure('actor-a.store-a'));
  expect(next.result.current.expanded).toEqual({ material: false, extra: true, fixed: false, tax: true });
  act(() => next.result.current.toggle('fixed'));
  expect(localStorage.getItem(recipeCostDisclosureKey('actor-a.store-a', 'fixed'))).toBe('true');
});

it('isolates account/store scopes and recovers the original selection when returning', () => {
  const view = renderHook(({ scope }) => useRecipeCostDisclosure(scope), { initialProps: { scope: 'a.store-a' } });
  act(() => view.result.current.toggle('tax'));
  view.rerender({ scope: 'a.store-b' }); expect(view.result.current.expanded.tax).toBe(true);
  view.rerender({ scope: 'b.store-a' }); expect(view.result.current.expanded.tax).toBe(true);
  view.rerender({ scope: 'a.store-a' }); expect(view.result.current.expanded.tax).toBe(false);
});

it('ignores malformed storage and keeps controls usable when storage is unavailable', () => {
  localStorage.setItem(recipeCostDisclosureKey('a', 'tax'), 'invalid');
  const view = renderHook(() => useRecipeCostDisclosure('a'));
  expect(view.result.current.expanded.tax).toBe(true);
  const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw Error('unavailable'); });
  try { act(() => view.result.current.toggle('tax')); expect(view.result.current.expanded.tax).toBe(false); }
  finally { write.mockRestore(); }
});

it('a late native read cannot overwrite a newer tap', async () => {
  mock.os = 'ios'; let resolve!: (value: string) => void;
  mock.read.mockImplementation((key: string) => key.endsWith('.fixed') ? new Promise<string>(r => { resolve = r; }) : Promise.resolve(null));
  const view = renderHook(() => useRecipeCostDisclosure('native-a'));
  await waitFor(() => expect(mock.read).toHaveBeenCalledTimes(4));
  act(() => view.result.current.toggle('fixed'));
  await act(async () => { resolve('true'); });
  expect(view.result.current.expanded.fixed).toBe(false);
  await waitFor(() => expect(mock.write).toHaveBeenCalledWith(recipeCostDisclosureKey('native-a', 'fixed'), 'false'));
});

it('serializes native writes so rapid taps persist the final choice', async () => {
  mock.os = 'android'; mock.read.mockResolvedValue(null);
  let completeFirst!: () => void;
  mock.write.mockImplementationOnce(() => new Promise<void>(resolve => { completeFirst = resolve; }));
  const view = renderHook(() => useRecipeCostDisclosure('native-b'));
  await waitFor(() => expect(mock.read).toHaveBeenCalledTimes(4));
  act(() => { view.result.current.toggle('extra'); view.result.current.toggle('extra'); });
  await waitFor(() => expect(mock.write).toHaveBeenCalledTimes(1));
  await act(async () => { completeFirst(); });
  await waitFor(() => expect(mock.write).toHaveBeenCalledTimes(2));
  expect(mock.write.mock.calls.map(call => call[1])).toEqual(['false', 'true']);
  expect(view.result.current.expanded.extra).toBe(true);
});
