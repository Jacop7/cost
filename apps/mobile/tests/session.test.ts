/**
 * 세션의 매장 선택 — 서버 create_store 와 같은 기준(created_at, id)으로 **정렬해서** 고른다.
 * 정렬 없이 limit(1) 이면 매장이 둘일 때 실행마다 다른 매장이 잡힌다(검토 지적).
 */
import { describe, expect, it, vi } from 'vitest';
import { pickStoreQuery, type StoreQueryBuilder } from '@/lib/session';

describe('pickStoreQuery', () => {
  it('created_at, id 순으로 정렬해 하나만 고른다', () => {
    const calls: unknown[][] = [];
    const chain = {
      select: (c: string) => { calls.push(['select', c]); return chain; },
      order: (col: string, opts: { ascending: boolean }) => { calls.push(['order', col, opts.ascending]); return chain; },
      limit: (n: number) => { calls.push(['limit', n]); return 'query'; },
    };
    const from = vi.fn(() => chain as unknown as StoreQueryBuilder);
    expect(pickStoreQuery(from)).toBe('query');
    expect(from).toHaveBeenCalledWith('stores');
    expect(calls).toEqual([
      ['select', 'id'],
      ['order', 'created_at', true],
      ['order', 'id', true],
      ['limit', 1],
    ]);
  });
});
