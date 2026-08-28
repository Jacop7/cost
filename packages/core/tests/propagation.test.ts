import { describe, expect, it } from 'vitest';
import { PROPAGATION, type PropagationEvent } from '../src';

const EXPECTED_EVENTS = [
  'E1',
  'E2',
  'E3',
  'E4',
  'E5',
  'E7',
  'E8',
  'E9',
  'E10',
  'E11',
  'E12',
] as const satisfies readonly PropagationEvent[];

describe('PROPAGATION — 이벤트 목록 계약 (ARCHITECTURE.md §4)', () => {
  it('E1~E12 중 E6만 결번이고 각 id와 원자성이 표 키에 맞는다', () => {
    expect(Object.keys(PROPAGATION).sort()).toEqual([...EXPECTED_EVENTS].sort());

    for (const event of EXPECTED_EVENTS) {
      expect(PROPAGATION[event].id).toBe(event);
      expect(PROPAGATION[event].atomic).toBe(true);
    }
  });
});
